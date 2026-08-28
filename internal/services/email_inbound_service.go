package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"agent-desk/internal/email"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/pkg/openidentity"
	"agent-desk/internal/repositories"

	"github.com/mlogclub/simple/common/strs"
	"github.com/mlogclub/simple/sqls"
)

var EmailInboundService = newEmailInboundService()

func newEmailInboundService() *emailInboundService {
	return &emailInboundService{}
}

type emailInboundService struct{}

// HandleWebhook processes an incoming email webhook from Brevo, SendGrid, or custom SMTP webhook gateway.
func (s *emailInboundService) HandleWebhook(ctx context.Context, channelID string, secretHeader string, rawPayload []byte) error {
	channelID = strings.TrimSpace(channelID)
	var channel *models.Channel
	if channelID != "" {
		channel = ChannelService.Take("channel_id = ? AND channel_type = ? AND status = ?", channelID, enums.ChannelTypeEmail, enums.StatusOk)
	}

	// 1. Parse inbound email items
	inboundItems, err := s.parseInboundPayload(rawPayload)
	if err != nil {
		return fmt.Errorf("parse email webhook failed: %w", err)
	}
	if len(inboundItems) == 0 {
		return nil
	}

	for _, item := range inboundItems {
		targetChannel := channel
		if targetChannel == nil {
			targetChannel = ChannelService.GetEnabledEmailChannelByAddress(item.ToEmail)
		}
		if targetChannel == nil {
			targetChannel = ChannelService.Take("channel_type = ? AND status = ?", enums.ChannelTypeEmail, enums.StatusOk)
		}
		if targetChannel == nil {
			slog.Warn("no active email channel found for recipient", "to", item.ToEmail)
			return errorsx.InvalidParam("email channel not found or disabled")
		}

		cfg, err := ChannelService.ParseEmailChannelConfig(targetChannel.ConfigJSON)
		if err != nil || cfg == nil {
			return errorsx.InvalidParam("email channel config invalid")
		}

		if cfg.WebhookSecret != "" && strings.TrimSpace(secretHeader) != cfg.WebhookSecret {
			return errorsx.UnauthorizedI18n("error.auth.invalidSignature")
		}

		if err := s.processInboundItem(ctx, targetChannel, item); err != nil {
			slog.Error("process inbound email item failed", "from", item.FromEmail, "to", item.ToEmail, "error", err)
			return err
		}
	}

	return nil
}

func (s *emailInboundService) processInboundItem(ctx context.Context, channel *models.Channel, item email.InboundEmailPayload) error {
	fromEmail := strings.ToLower(strings.TrimSpace(item.FromEmail))
	if fromEmail == "" {
		return nil
	}
	fromName := strings.TrimSpace(item.FromName)
	if fromName == "" {
		parts := strings.Split(fromEmail, "@")
		fromName = parts[0]
	}

	bodyText := strings.TrimSpace(item.BodyText)
	if bodyText == "" && item.BodyHTML != "" {
		bodyText = stripHTMLTags(item.BodyHTML)
	}
	if bodyText == "" {
		bodyText = "(Empty email body)"
	}

	// Format content with subject if provided
	content := bodyText
	if item.Subject != "" {
		content = fmt.Sprintf("[%s]\n\n%s", item.Subject, bodyText)
	}

	// 1. Resolve customer identity
	externalUser := openidentity.ExternalUser{
		ExternalSource: enums.ExternalSourceEmail,
		ExternalID:     fromEmail,
		ExternalName:   fromName,
	}

	// 2. Create or match Conversation
	conversation, err := ConversationService.Create(externalUser, channel.ID, channel.AIAgentID)
	if err != nil {
		return fmt.Errorf("create email conversation failed: %w", err)
	}

	// Ensure customer primary_email is populated
	if conversation.CustomerID > 0 {
		customer := repositories.CustomerRepository.Get(sqls.DB(), conversation.CustomerID)
		if customer != nil && customer.PrimaryEmail == "" {
			_ = repositories.CustomerRepository.UpdateColumn(sqls.DB(), customer.ID, "primary_email", fromEmail)
		}
	}

	// 3. Send message through MessageService (triggers AI response loop or agent notification)
	msgHash := strs.UUID()
	if item.MessageID != "" {
		msgHash = fmt.Sprintf("email_%s", strings.Trim(item.MessageID, "<>"))
	}
	clientMsgID := fmt.Sprintf("mail_%s", msgHash)

	payloadMap := map[string]any{
		"email_from":       fromEmail,
		"email_from_name":  fromName,
		"email_to":         item.ToEmail,
		"email_subject":    item.Subject,
		"email_message_id": item.MessageID,
		"email_in_reply":   item.InReplyTo,
	}
	payloadBytes, _ := json.Marshal(payloadMap)

	_, err = MessageService.SendCustomerMessage(
		conversation.ID,
		clientMsgID,
		enums.IMMessageTypeText,
		content,
		string(payloadBytes),
		externalUser,
	)
	if err != nil {
		return fmt.Errorf("send customer message failed: %w", err)
	}

	slog.Info("inbound email successfully processed", "from", fromEmail, "channel_id", channel.ChannelID, "conversation_id", conversation.ID)
	return nil
}

func (s *emailInboundService) parseInboundPayload(raw []byte) ([]email.InboundEmailPayload, error) {
	rawStr := strings.TrimSpace(string(raw))
	if rawStr == "" {
		return nil, nil
	}

	// Try Brevo format first
	var brevoWebhook email.BrevoInboundWebhook
	if err := json.Unmarshal(raw, &brevoWebhook); err == nil && len(brevoWebhook.Items) > 0 {
		var results []email.InboundEmailPayload
		for _, item := range brevoWebhook.Items {
			fromEmail, fromName := email.ParseAddress(item.Sender)
			toEmail, _ := email.ParseAddress(item.Recipient)
			msgID := ""
			if len(item.UUID) > 0 {
				msgID = item.UUID[0]
			}
			results = append(results, email.InboundEmailPayload{
				FromEmail: fromEmail,
				FromName:  fromName,
				ToEmail:   toEmail,
				Subject:   strings.TrimSpace(item.Subject),
				BodyText:  strings.TrimSpace(item.RawTextBody),
				BodyHTML:  strings.TrimSpace(item.RawHTMLBody),
				MessageID: msgID,
			})
		}
		return results, nil
	}

	// Try Generic JSON format
	var generic email.GenericInboundWebhook
	if err := json.Unmarshal(raw, &generic); err == nil && generic.From != "" {
		fromEmail, fromName := email.ParseAddress(generic.From)
		if generic.FromName != "" {
			fromName = generic.FromName
		}
		toEmail, _ := email.ParseAddress(generic.To)
		body := generic.Text
		if body == "" {
			body = generic.Body
		}
		return []email.InboundEmailPayload{
			{
				FromEmail: fromEmail,
				FromName:  fromName,
				ToEmail:   toEmail,
				Subject:   strings.TrimSpace(generic.Subject),
				BodyText:  strings.TrimSpace(body),
				BodyHTML:  strings.TrimSpace(generic.HTML),
				MessageID: generic.MessageID,
				InReplyTo: generic.InReplyTo,
			},
		}, nil
	}

	return nil, fmt.Errorf("unrecognized email webhook format")
}

func stripHTMLTags(s string) string {
	var builder strings.Builder
	inTag := false
	for _, r := range s {
		if r == '<' {
			inTag = true
		} else if r == '>' {
			inTag = false
		} else if !inTag {
			builder.WriteRune(r)
		}
	}
	return strings.TrimSpace(builder.String())
}

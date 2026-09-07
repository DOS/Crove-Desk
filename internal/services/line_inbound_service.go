package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"agent-desk/internal/line"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/pkg/openidentity"
)

var LineInboundService = newLineInboundService()

func newLineInboundService() *lineInboundService {
	return &lineInboundService{}
}

type lineInboundService struct{}

// HandleWebhook processes an incoming webhook from the LINE Platform.
func (s *lineInboundService) HandleWebhook(ctx context.Context, channelID string, signature string, rawPayload []byte) error {
	channelID = strings.TrimSpace(channelID)
	var channel *models.Channel
	if channelID != "" {
		channel = ChannelService.Take("channel_id = ? AND channel_type = ? AND status = ?", channelID, enums.ChannelTypeLine, enums.StatusOk)
	}
	if channel == nil {
		channel = ChannelService.Take("channel_type = ? AND status = ?", enums.ChannelTypeLine, enums.StatusOk)
	}
	if channel == nil {
		return errorsx.InvalidParam("line channel not found or disabled")
	}

	cfg, err := ChannelService.ParseLineChannelConfig(channel.ConfigJSON)
	if err != nil || cfg == nil || cfg.ChannelSecret == "" {
		return errorsx.InvalidParam("line channel config invalid")
	}

	// LINE requires webhook signature verification on every event.
	if !line.VerifyWebhookSignature(cfg.ChannelSecret, signature, rawPayload) {
		return errorsx.UnauthorizedI18n("error.auth.invalidSignature")
	}

	var event line.WebhookEvent
	if err := json.Unmarshal(rawPayload, &event); err != nil {
		return fmt.Errorf("unmarshal line webhook failed: %w", err)
	}

	for i := range event.Events {
		if err := s.processEvent(channel, &event.Events[i]); err != nil {
			return err
		}
	}
	return nil
}

func (s *lineInboundService) processEvent(channel *models.Channel, event *line.Event) error {
	if event.Type != "message" || event.Message == nil || event.Source == nil {
		return nil
	}
	// Only handle 1:1 user messages for now.
	if event.Source.Type != "user" || strings.TrimSpace(event.Source.UserID) == "" {
		return nil
	}
	if event.Message.Type != "text" {
		return nil // Ignore non-text messages for now
	}
	text := strings.TrimSpace(event.Message.Text)
	if text == "" {
		return nil
	}

	externalID := strings.TrimSpace(event.Source.UserID)
	name := fmt.Sprintf("LINE User %s", externalID)

	externalUser := openidentity.ExternalUser{
		ExternalSource: enums.ExternalSourceLine,
		ExternalID:     externalID,
		ExternalName:   name,
	}

	conversation, err := ConversationService.Create(externalUser, channel.ID, channel.AIAgentID)
	if err != nil {
		return fmt.Errorf("create line conversation failed: %w", err)
	}

	clientMsgID := fmt.Sprintf("line_%s", event.Message.ID)
	payloadMap := map[string]any{
		"line_message_id":  event.Message.ID,
		"line_user_id":     externalID,
		"line_reply_token": event.ReplyToken,
		"line_event_type":  event.Type,
	}
	payloadBytes, _ := json.Marshal(payloadMap)

	if _, err := MessageService.SendCustomerMessage(
		conversation.ID,
		clientMsgID,
		enums.IMMessageTypeText,
		text,
		string(payloadBytes),
		externalUser,
	); err != nil {
		return fmt.Errorf("send customer message failed: %w", err)
	}
	return nil
}

package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/pkg/openidentity"
	"agent-desk/internal/viber"
)

var ViberInboundService = newViberInboundService()

func newViberInboundService() *viberInboundService {
	return &viberInboundService{}
}

type viberInboundService struct{}

// HandleWebhook processes an incoming callback from Viber.
//
// Viber expects the HTTP response body of a conversation_started callback
// to carry the welcome message, so this method returns an optional JSON
// response body alongside the error.
func (s *viberInboundService) HandleWebhook(ctx context.Context, channelID string, signature string, rawPayload []byte) (string, error) {
	channelID = strings.TrimSpace(channelID)
	var channel *models.Channel
	if channelID != "" {
		channel = ChannelService.Take("channel_id = ? AND channel_type = ? AND status = ?", channelID, enums.ChannelTypeViber, enums.StatusOk)
	}
	if channel == nil {
		channel = ChannelService.Take("channel_type = ? AND status = ?", enums.ChannelTypeViber, enums.StatusOk)
	}
	if channel == nil {
		return "", errorsx.InvalidParam("viber channel not found or disabled")
	}

	cfg, err := ChannelService.ParseViberChannelConfig(channel.ConfigJSON)
	if err != nil || cfg == nil || cfg.AuthToken == "" {
		return "", errorsx.InvalidParam("viber channel config invalid")
	}

	// Every Viber callback is signed with the authentication token.
	if !viber.VerifyWebhookSignature(cfg.AuthToken, signature, rawPayload) {
		return "", errorsx.UnauthorizedI18n("error.auth.invalidSignature")
	}

	var callback viber.Callback
	if err := json.Unmarshal(rawPayload, &callback); err != nil {
		return "", fmt.Errorf("unmarshal viber callback failed: %w", err)
	}

	switch callback.Event {
	case "conversation_started":
		if strings.TrimSpace(cfg.WelcomeMessage) == "" {
			return "", nil
		}
		welcome := map[string]any{
			"sender": map[string]any{
				"name":   strings.TrimSpace(cfg.BotName),
				"avatar": strings.TrimSpace(cfg.AvatarURL),
			},
			"type": "text",
			"text": strings.TrimSpace(cfg.WelcomeMessage),
		}
		body, err := json.Marshal(welcome)
		if err != nil {
			return "", err
		}
		return string(body), nil
	case "message":
		if err := s.processMessage(channel, &callback); err != nil {
			return "", err
		}
		return "", nil
	default:
		// subscribed / unsubscribed / delivered / seen / failed are ignored.
		return "", nil
	}
}

func (s *viberInboundService) processMessage(channel *models.Channel, callback *viber.Callback) error {
	if callback.Sender == nil || callback.Message == nil {
		return nil
	}
	if strings.TrimSpace(callback.Message.Type) != "text" {
		return nil // Ignore non-text messages for now
	}
	text := strings.TrimSpace(callback.Message.Text)
	if text == "" {
		return nil
	}
	externalID := strings.TrimSpace(callback.Sender.ID)
	if externalID == "" {
		return nil
	}

	name := strings.TrimSpace(callback.Sender.Name)
	if name == "" {
		name = fmt.Sprintf("Viber User %s", externalID)
	}

	externalUser := openidentity.ExternalUser{
		ExternalSource: enums.ExternalSourceViber,
		ExternalID:     externalID,
		ExternalName:   name,
	}

	conversation, err := ConversationService.Create(externalUser, channel.ID, channel.AIAgentID)
	if err != nil {
		return fmt.Errorf("create viber conversation failed: %w", err)
	}

	clientMsgID := fmt.Sprintf("viber_%d", callback.MessageToken)
	payloadMap := map[string]any{
		"viber_message_token": callback.MessageToken,
		"viber_user_id":       externalID,
		"viber_message_type":  callback.Message.Type,
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

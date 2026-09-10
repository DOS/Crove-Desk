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
	"agent-desk/internal/tiktok"
)

var TikTokInboundService = newTikTokInboundService()

func newTikTokInboundService() *tiktokInboundService {
	return &tiktokInboundService{}
}

type tiktokInboundService struct{}

// HandleWebhook processes an incoming Webhook event from TikTok Business Messaging API.
func (s *tiktokInboundService) HandleWebhook(ctx context.Context, channelID string, verifyTokenHeader string, rawPayload []byte) error {
	var event tiktok.WebhookEvent
	if err := json.Unmarshal(rawPayload, &event); err != nil {
		return fmt.Errorf("unmarshal tiktok webhook failed: %w", err)
	}

	toUserID := strings.TrimSpace(event.ToUserID)
	clientKey := strings.TrimSpace(event.ClientKey)

	var channel *models.Channel
	channelID = strings.TrimSpace(channelID)
	if channelID != "" {
		channel = ChannelService.Take("channel_id = ? AND channel_type = ? AND status = ?", channelID, enums.ChannelTypeTikTok, enums.StatusOk)
	}
	if channel == nil && toUserID != "" {
		channel = ChannelService.Take("channel_type = ? AND status = ? AND (channel_id = ? OR config_json LIKE ?)",
			enums.ChannelTypeTikTok, enums.StatusOk, toUserID, "%"+toUserID+"%")
	}
	if channel == nil && clientKey != "" {
		channel = ChannelService.Take("channel_type = ? AND status = ? AND config_json LIKE ?",
			enums.ChannelTypeTikTok, enums.StatusOk, "%"+clientKey+"%")
	}
	if channel == nil {
		channel = ChannelService.Take("channel_type = ? AND status = ?", enums.ChannelTypeTikTok, enums.StatusOk)
	}
	if channel == nil {
		return errorsx.InvalidParam("tiktok channel not found or disabled")
	}

	cfg, err := ChannelService.ParseTikTokChannelConfig(channel.ConfigJSON)
	if err != nil || cfg == nil {
		return errorsx.InvalidParam("tiktok channel config invalid")
	}

	if cfg.WebhookVerifyToken != "" && strings.TrimSpace(verifyTokenHeader) != "" {
		if strings.TrimSpace(verifyTokenHeader) != cfg.WebhookVerifyToken {
			return errorsx.UnauthorizedI18n("error.auth.invalidSignature")
		}
	}

	senderID := strings.TrimSpace(event.FromUserID)
	if senderID == "" || senderID == toUserID {
		return nil // Ignore echo / self messages
	}

	text := strings.TrimSpace(event.Content)
	if text == "" {
		return nil
	}

	// 1. Resolve customer identity (TikTok OpenID)
	externalUser := openidentity.ExternalUser{
		ExternalSource: enums.ExternalSourceTikTok,
		ExternalID:     senderID,
		ExternalName:   fmt.Sprintf("TikTok User %s", senderID),
	}

	// 2. Create or match Conversation
	conversation, err := ConversationService.Create(externalUser, channel.ID, channel.AIAgentID)
	if err != nil {
		return fmt.Errorf("create tiktok conversation failed: %w", err)
	}

	// 3. Send message through MessageService
	msgID := event.EventID
	if msgID == "" {
		msgID = fmt.Sprintf("%d", event.CreateTime)
	}
	clientMsgID := fmt.Sprintf("tiktok_%s", msgID)
	payloadMap := map[string]any{
		"tiktok_event_id":   event.EventID,
		"tiktok_from_user":  senderID,
		"tiktok_to_user":    toUserID,
		"tiktok_timestamp":  event.CreateTime,
		"tiktok_event_type": event.Event,
	}
	payloadBytes, _ := json.Marshal(payloadMap)

	_, err = MessageService.SendCustomerMessage(
		conversation.ID,
		clientMsgID,
		enums.IMMessageTypeText,
		text,
		string(payloadBytes),
		externalUser,
	)
	if err != nil {
		return fmt.Errorf("send customer message failed: %w", err)
	}

	return nil
}

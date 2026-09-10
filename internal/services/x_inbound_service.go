package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/pkg/openidentity"
	"agent-desk/internal/x"
)

var XInboundService = newXInboundService()

func newXInboundService() *xInboundService {
	return &xInboundService{}
}

type xInboundService struct{}

// HandleCRC performs the Challenge-Response Check (CRC) required by X Account Activity API.
func (s *xInboundService) HandleCRC(channelID string, crcToken string) (string, error) {
	crcToken = strings.TrimSpace(crcToken)
	if crcToken == "" {
		return "", errorsx.InvalidParam("crc_token is required")
	}

	var channel *models.Channel
	channelID = strings.TrimSpace(channelID)
	if channelID != "" {
		channel = ChannelService.Take("channel_id = ? AND channel_type = ? AND status = ?", channelID, enums.ChannelTypeX, enums.StatusOk)
	}
	if channel == nil {
		channel = ChannelService.Take("channel_type = ? AND status = ?", enums.ChannelTypeX, enums.StatusOk)
	}
	if channel == nil {
		return "", errorsx.InvalidParam("x channel not found or disabled")
	}

	cfg, err := ChannelService.ParseXChannelConfig(channel.ConfigJSON)
	if err != nil || cfg == nil {
		return "", errorsx.InvalidParam("x channel config invalid")
	}

	secret := cfg.APISecretKey
	if secret == "" {
		secret = cfg.WebhookCRCSecret
	}
	if secret == "" {
		return "", errorsx.InvalidParam("x api_secret_key is required for CRC response")
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(crcToken))
	responseToken := "sha256=" + base64.StdEncoding.EncodeToString(mac.Sum(nil))
	return responseToken, nil
}

// HandleWebhook processes incoming Direct Message events from X Account Activity API.
func (s *xInboundService) HandleWebhook(ctx context.Context, channelID string, signatureHeader string, rawPayload []byte) error {
	var event x.WebhookEvent
	if err := json.Unmarshal(rawPayload, &event); err != nil {
		return fmt.Errorf("unmarshal x webhook failed: %w", err)
	}

	forUserID := strings.TrimSpace(event.ForUserID)

	var channel *models.Channel
	channelID = strings.TrimSpace(channelID)
	if channelID != "" {
		channel = ChannelService.Take("channel_id = ? AND channel_type = ? AND status = ?", channelID, enums.ChannelTypeX, enums.StatusOk)
	}
	if channel == nil && forUserID != "" {
		channel = ChannelService.Take("channel_type = ? AND status = ? AND (channel_id = ? OR config_json LIKE ?)",
			enums.ChannelTypeX, enums.StatusOk, forUserID, "%"+forUserID+"%")
	}
	if channel == nil {
		channel = ChannelService.Take("channel_type = ? AND status = ?", enums.ChannelTypeX, enums.StatusOk)
	}
	if channel == nil {
		return errorsx.InvalidParam("x channel not found or disabled")
	}

	cfg, err := ChannelService.ParseXChannelConfig(channel.ConfigJSON)
	if err != nil || cfg == nil {
		return errorsx.InvalidParam("x channel config invalid")
	}

	// Verify signature if secret configured
	secret := cfg.APISecretKey
	if secret == "" {
		secret = cfg.WebhookCRCSecret
	}
	if secret != "" && strings.TrimSpace(signatureHeader) != "" {
		if !verifyXSignature(secret, signatureHeader, rawPayload) {
			return errorsx.UnauthorizedI18n("error.auth.invalidSignature")
		}
	}

	for _, dm := range event.DirectMessageEvents {
		if dm.Type != "message_create" {
			continue
		}

		senderID := strings.TrimSpace(dm.MessageCreate.SenderID)
		if senderID == "" || senderID == forUserID || (cfg.AccountID != "" && senderID == cfg.AccountID) {
			continue // Ignore echo / self messages
		}

		text := strings.TrimSpace(dm.MessageCreate.MessageData.Text)
		if text == "" && dm.MessageCreate.MessageData.Attachment != nil {
			if dm.MessageCreate.MessageData.Attachment.Media.MediaURL != "" {
				text = dm.MessageCreate.MessageData.Attachment.Media.MediaURL
			}
		}
		if text == "" {
			continue
		}

		// 1. Resolve customer identity
		externalUser := openidentity.ExternalUser{
			ExternalSource: enums.ExternalSourceX,
			ExternalID:     senderID,
			ExternalName:   fmt.Sprintf("X User %s", senderID),
		}

		// 2. Create or match Conversation
		conversation, err := ConversationService.Create(externalUser, channel.ID, channel.AIAgentID)
		if err != nil {
			return fmt.Errorf("create x conversation failed: %w", err)
		}

		// 3. Send message through MessageService
		clientMsgID := fmt.Sprintf("x_%s", dm.ID)
		payloadMap := map[string]any{
			"x_dm_id":       dm.ID,
			"x_sender_id":   senderID,
			"x_for_user_id": forUserID,
			"x_timestamp":   dm.CreatedTimestamp,
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
	}

	return nil
}

func verifyXSignature(secret string, signatureHeader string, payload []byte) bool {
	sig := strings.TrimSpace(signatureHeader)
	if strings.HasPrefix(sig, "sha256=") {
		expectedSig := sig[len("sha256="):]
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write(payload)
		actualSig := base64.StdEncoding.EncodeToString(mac.Sum(nil))
		return hmac.Equal([]byte(actualSig), []byte(expectedSig))
	}
	return true
}

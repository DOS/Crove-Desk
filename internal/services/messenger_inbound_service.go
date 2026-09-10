package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"agent-desk/internal/messenger"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/config"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/pkg/openidentity"
	"os"
)

var MessengerInboundService = newMessengerInboundService()

func newMessengerInboundService() *messengerInboundService {
	return &messengerInboundService{}
}

type messengerInboundService struct{}

// HandleWebhook processes an incoming Webhook event from Meta Messenger Platform.
func (s *messengerInboundService) HandleWebhook(ctx context.Context, channelID string, signatureHeader string, rawPayload []byte) error {
	var event messenger.WebhookEvent
	if err := json.Unmarshal(rawPayload, &event); err != nil {
		return fmt.Errorf("unmarshal messenger webhook failed: %w", err)
	}

	if event.Object != "page" {
		return nil // Ignore non-page events
	}

	for _, entry := range event.Entry {
		pageID := strings.TrimSpace(entry.ID)
		var channel *models.Channel

		channelID = strings.TrimSpace(channelID)
		if channelID != "" {
			channel = ChannelService.Take("channel_id = ? AND channel_type = ? AND status = ?", channelID, enums.ChannelTypeMessenger, enums.StatusOk)
		}
		if channel == nil && pageID != "" {
			// Find channel by Page ID in ConfigJSON or channel_id
			channel = ChannelService.Take("channel_type = ? AND status = ? AND (channel_id = ? OR config_json LIKE ?)",
				enums.ChannelTypeMessenger, enums.StatusOk, pageID, "%"+pageID+"%")
		}
		if channel == nil {
			channel = ChannelService.Take("channel_type = ? AND status = ?", enums.ChannelTypeMessenger, enums.StatusOk)
		}
		if channel == nil {
			continue
		}

		cfg, err := ChannelService.ParseMessengerChannelConfig(channel.ConfigJSON)
		if err != nil || cfg == nil {
			continue
		}

		// Optional signature verification if appSecret is configured
		appSecret := ""
		if cfg != nil {
			appSecret = strings.TrimSpace(cfg.AppSecret)
		}
		if appSecret == "" {
			if serverCfg := config.GetCurrent(); serverCfg != nil {
				appSecret = strings.TrimSpace(serverCfg.Messenger.AppSecret)
			}
		}
		if appSecret == "" {
			appSecret = strings.TrimSpace(os.Getenv("META_APP_SECRET"))
		}
		if appSecret == "" {
			appSecret = strings.TrimSpace(os.Getenv("FB_APP_SECRET"))
		}

		if appSecret != "" && strings.TrimSpace(signatureHeader) != "" {
			if !verifyMessengerSignature(appSecret, signatureHeader, rawPayload) {
				return errorsx.UnauthorizedI18n("error.auth.invalidSignature")
			}
		}

		for _, messaging := range entry.Messaging {
			if messaging.Message == nil {
				continue
			}

			senderID := strings.TrimSpace(messaging.Sender.ID)
			if senderID == "" || senderID == pageID {
				continue // Ignore echo / self-sent messages
			}

			text := strings.TrimSpace(messaging.Message.Text)
			attachments := messaging.Message.Attachments

			if text == "" && len(attachments) > 0 {
				firstAtt := attachments[0]
				if firstAtt.Payload.Title != "" {
					text = fmt.Sprintf("[%s] %s", firstAtt.Payload.Title, firstAtt.Payload.URL)
				} else {
					text = firstAtt.Payload.URL
				}
			}

			if text == "" && len(attachments) == 0 {
				continue
			}

			mid := messaging.Message.MID
			if mid == "" {
				mid = fmt.Sprintf("mid_%d", messaging.Timestamp)
			}

			// 1. Resolve customer identity
			externalUser := openidentity.ExternalUser{
				ExternalSource: enums.ExternalSourceMessenger,
				ExternalID:     senderID,
				ExternalName:   fmt.Sprintf("Facebook User %s", senderID),
			}

			// 2. Create or match Conversation
			conversation, err := ConversationService.Create(externalUser, channel.ID, channel.AIAgentID)
			if err != nil {
				return fmt.Errorf("create messenger conversation failed: %w", err)
			}

			// 3. Send message through MessageService
			clientMsgID := fmt.Sprintf("fb_%s", mid)
			payloadMap := map[string]any{
				"messenger_mid":         mid,
				"messenger_sender_id":   senderID,
				"messenger_page_id":     pageID,
				"messenger_timestamp":   messaging.Timestamp,
				"messenger_attachments": attachments,
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
	}

	return nil
}

func verifyMessengerSignature(appSecret string, signatureHeader string, payload []byte) bool {
	signature := strings.TrimSpace(signatureHeader)
	if strings.HasPrefix(signature, "sha256=") {
		expectedSig := signature[len("sha256="):]
		mac := hmac.New(sha256.New, []byte(appSecret))
		mac.Write(payload)
		actualSig := hex.EncodeToString(mac.Sum(nil))
		return hmac.Equal([]byte(actualSig), []byte(expectedSig))
	}
	return true
}

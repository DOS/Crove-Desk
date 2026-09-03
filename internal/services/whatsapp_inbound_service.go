package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/config"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/pkg/openidentity"
	"agent-desk/internal/whatsapp"
)

var WhatsAppInboundService = newWhatsAppInboundService()

func newWhatsAppInboundService() *whatsappInboundService {
	return &whatsappInboundService{}
}

type whatsappInboundService struct{}

// HandleWebhook processes an incoming Webhook event from WhatsApp Cloud API (Meta Graph Platform).
func (s *whatsappInboundService) HandleWebhook(ctx context.Context, channelID string, signatureHeader string, rawPayload []byte) error {
	var event whatsapp.WebhookEvent
	if err := json.Unmarshal(rawPayload, &event); err != nil {
		return fmt.Errorf("unmarshal whatsapp webhook failed: %w", err)
	}

	if event.Object != "whatsapp_business_account" && event.Object != "whatsapp" {
		return nil // Ignore non-whatsapp events
	}

	for _, entry := range event.Entry {
		for _, change := range entry.Changes {
			if change.Field != "messages" {
				continue
			}

			val := change.Value
			phoneNumberID := strings.TrimSpace(val.Metadata.PhoneNumberID)

			var channel *models.Channel
			channelID = strings.TrimSpace(channelID)
			if channelID != "" {
				channel = ChannelService.Take("channel_id = ? AND channel_type = ? AND status = ?", channelID, enums.ChannelTypeWhatsApp, enums.StatusOk)
			}
			if channel == nil && phoneNumberID != "" {
				channel = ChannelService.Take("channel_type = ? AND status = ? AND (channel_id = ? OR config_json LIKE ?)",
					enums.ChannelTypeWhatsApp, enums.StatusOk, phoneNumberID, "%"+phoneNumberID+"%")
			}
			if channel == nil {
				channel = ChannelService.Take("channel_type = ? AND status = ?", enums.ChannelTypeWhatsApp, enums.StatusOk)
			}
			if channel == nil {
				continue
			}

			cfg, err := ChannelService.ParseWhatsAppChannelConfig(channel.ConfigJSON)
			if err != nil || cfg == nil {
				continue
			}

			// Signature verification if appSecret configured
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

			if appSecret != "" && strings.TrimSpace(signatureHeader) != "" {
				if !verifyWhatsAppSignature(appSecret, signatureHeader, rawPayload) {
					return errorsx.UnauthorizedI18n("error.auth.invalidSignature")
				}
			}

			contactNameMap := make(map[string]string)
			for _, contact := range val.Contacts {
				contactNameMap[contact.WaID] = contact.Profile.Name
			}

			for _, message := range val.Messages {
				senderPhone := strings.TrimSpace(message.From)
				if senderPhone == "" {
					continue
				}

				text := ""
				if message.Text != nil {
					text = strings.TrimSpace(message.Text.Body)
				} else if message.Image != nil {
					text = strings.TrimSpace(message.Image.Caption)
					if text == "" {
						text = "[Image Attachment]"
					}
				} else if message.Document != nil {
					text = strings.TrimSpace(message.Document.Caption)
					if text == "" {
						text = fmt.Sprintf("[%s]", message.Document.Filename)
					}
				}

				if text == "" {
					continue
				}

				name := contactNameMap[senderPhone]
				if name == "" {
					name = fmt.Sprintf("WhatsApp User +%s", senderPhone)
				}

				// 1. Resolve customer identity
				externalUser := openidentity.ExternalUser{
					ExternalSource: enums.ExternalSourceWhatsApp,
					ExternalID:     senderPhone,
					ExternalName:   name,
				}

				// 2. Create or match Conversation
				conversation, err := ConversationService.Create(externalUser, channel.ID, channel.AIAgentID)
				if err != nil {
					return fmt.Errorf("create whatsapp conversation failed: %w", err)
				}

				// 3. Send customer message
				clientMsgID := fmt.Sprintf("wa_%s", message.ID)
				payloadMap := map[string]any{
					"whatsapp_message_id": message.ID,
					"whatsapp_from":       senderPhone,
					"whatsapp_phone_id":   phoneNumberID,
					"whatsapp_type":       message.Type,
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
	}

	return nil
}

func verifyWhatsAppSignature(appSecret string, signatureHeader string, payload []byte) bool {
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

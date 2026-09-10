package services

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/repositories"
	"agent-desk/internal/services/storage"
	"agent-desk/internal/whatsapp"

	"github.com/mlogclub/simple/sqls"
)

const (
	whatsappOutboxBatchSize = 20
	whatsappOutboxMaxRetry  = 5
)

var WhatsAppOutboundService = newWhatsAppOutboundService()

func newWhatsAppOutboundService() *whatsappOutboundService {
	return &whatsappOutboundService{}
}

type whatsappOutboundService struct{}

func (s *whatsappOutboundService) DispatchPendingOutbox() int {
	return s.doDispatchPendingOutbox(whatsappOutboxBatchSize)
}

func (s *whatsappOutboundService) doDispatchPendingOutbox(limit int) int {
	if limit <= 0 {
		limit = whatsappOutboxBatchSize
	}
	items := ChannelMessageOutboxService.ListPending(enums.ChannelTypeWhatsApp, limit)
	if len(items) == 0 {
		return 0
	}

	successCount := 0
	for i := range items {
		if err := s.processOutbox(items[i].ID); err != nil {
			slog.Warn("process whatsapp outbox failed",
				"outbox_id", items[i].ID,
				"error", err,
			)
			continue
		}
		successCount++
	}
	return successCount
}

func (s *whatsappOutboundService) processOutbox(outboxID int64) error {
	outbox := ChannelMessageOutboxService.Get(outboxID)
	if outbox == nil {
		return nil
	}
	if outbox.ChannelType != enums.ChannelTypeWhatsApp {
		return nil
	}
	if outbox.SendStatus == string(enums.ChannelMessageOutboxStatusSent) {
		return nil
	}
	if outbox.NextRetryAt != nil && outbox.NextRetryAt.After(time.Now()) {
		return nil
	}

	if err := ChannelMessageOutboxService.Updates(outbox.ID, map[string]any{
		"send_status": string(enums.ChannelMessageOutboxStatusSending),
		"updated_at":  time.Now(),
	}); err != nil {
		return err
	}

	message := MessageService.Get(outbox.MessageID)
	if message == nil {
		return s.markOutboxFailed(outbox, "message not found")
	}
	conversation := ConversationService.Get(outbox.ConversationID)
	if conversation == nil {
		return s.markOutboxFailed(outbox, "conversation not found")
	}

	channel := ChannelService.Get(conversation.ChannelID)
	if channel == nil || channel.Status != enums.StatusOk {
		return s.markOutboxFailed(outbox, "whatsapp channel not found or disabled")
	}
	cfg, err := ChannelService.ParseWhatsAppChannelConfig(channel.ConfigJSON)
	if err != nil || cfg == nil || cfg.AccessToken == "" || cfg.PhoneNumberID == "" {
		return s.markOutboxFailed(outbox, "whatsapp credentials (access token / phone number id) not configured")
	}

	// Resolve target WhatsApp Phone Number (ExternalID)
	var recipientPhone string
	customerIdentity := repositories.CustomerIdentityRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("customer_id", conversation.CustomerID).
		Eq("external_source", enums.ExternalSourceWhatsApp))
	if customerIdentity != nil {
		recipientPhone = strings.TrimSpace(customerIdentity.ExternalID)
	}
	if recipientPhone == "" {
		return s.markOutboxFailed(outbox, "unable to resolve recipient phone number")
	}

	client := whatsapp.NewClient(cfg.AccessToken)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	var sendErr error
	if message.MessageType == enums.IMMessageTypeImage {
		assetPayload, err := parseIMMessageAssetPayload(message.Payload)
		var imageURL string
		if err == nil && assetPayload != nil {
			assetPayload = hydrateIMMessageAssetPayload(assetPayload)
			if assetPayload.Provider != "" && assetPayload.StorageKey != "" {
				if provider, err := storage.NewProvider(assetPayload.Provider); err == nil {
					imageURL = provider.GetSignedURL(assetPayload.StorageKey)
				}
			}
		}
		if imageURL == "" && strings.HasPrefix(strings.TrimSpace(message.Content), "http") {
			imageURL = strings.TrimSpace(message.Content)
		}

		if imageURL != "" {
			_, sendErr = client.SendMediaMessage(ctx, cfg.PhoneNumberID, recipientPhone, "image", imageURL, message.Content)
		} else {
			_, sendErr = client.SendTextMessage(ctx, cfg.PhoneNumberID, recipientPhone, message.Content)
		}
	} else if message.MessageType == enums.IMMessageTypeAttachment {
		assetPayload, err := parseIMMessageAssetPayload(message.Payload)
		var fileURL string
		if err == nil && assetPayload != nil {
			assetPayload = hydrateIMMessageAssetPayload(assetPayload)
			if assetPayload.Provider != "" && assetPayload.StorageKey != "" {
				if provider, err := storage.NewProvider(assetPayload.Provider); err == nil {
					fileURL = provider.GetSignedURL(assetPayload.StorageKey)
				}
			}
		}
		if fileURL == "" && strings.HasPrefix(strings.TrimSpace(message.Content), "http") {
			fileURL = strings.TrimSpace(message.Content)
		}

		if fileURL != "" {
			_, sendErr = client.SendMediaMessage(ctx, cfg.PhoneNumberID, recipientPhone, "document", fileURL, message.Content)
		} else {
			_, sendErr = client.SendTextMessage(ctx, cfg.PhoneNumberID, recipientPhone, message.Content)
		}
	} else {
		_, sendErr = client.SendTextMessage(ctx, cfg.PhoneNumberID, recipientPhone, message.Content)
	}

	if sendErr != nil {
		return s.markOutboxFailed(outbox, sendErr.Error())
	}

	return ChannelMessageOutboxService.Updates(outbox.ID, map[string]any{
		"send_status": string(enums.ChannelMessageOutboxStatusSent),
		"sent_at":     time.Now(),
		"updated_at":  time.Now(),
	})
}

func (s *whatsappOutboundService) markOutboxFailed(outbox *models.ChannelMessageOutbox, errMsg string) error {
	if outbox == nil {
		return nil
	}
	retryCount := outbox.RetryCount + 1
	status := string(enums.ChannelMessageOutboxStatusFailed)
	if retryCount >= whatsappOutboxMaxRetry {
		status = string(enums.ChannelMessageOutboxStatusIgnored)
	}
	nextRetryAt := time.Now().Add(time.Duration(retryCount*30) * time.Second)

	return ChannelMessageOutboxService.Updates(outbox.ID, map[string]any{
		"send_status":   status,
		"retry_count":   retryCount,
		"next_retry_at": &nextRetryAt,
		"last_error":    errMsg,
		"updated_at":    time.Now(),
	})
}

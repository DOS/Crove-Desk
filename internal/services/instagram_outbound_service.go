package services

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"agent-desk/internal/messenger"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/repositories"
	"agent-desk/internal/services/storage"

	"github.com/mlogclub/simple/sqls"
)

const (
	instagramOutboxBatchSize = 20
	instagramOutboxMaxRetry  = 5
)

var InstagramOutboundService = newInstagramOutboundService()

func newInstagramOutboundService() *instagramOutboundService {
	return &instagramOutboundService{}
}

type instagramOutboundService struct{}

func (s *instagramOutboundService) DispatchPendingOutbox() int {
	return s.doDispatchPendingOutbox(instagramOutboxBatchSize)
}

func (s *instagramOutboundService) doDispatchPendingOutbox(limit int) int {
	if limit <= 0 {
		limit = instagramOutboxBatchSize
	}
	items := ChannelMessageOutboxService.ListPending(enums.ChannelTypeInstagram, limit)
	if len(items) == 0 {
		return 0
	}

	successCount := 0
	for i := range items {
		if err := s.processOutbox(items[i].ID); err != nil {
			slog.Warn("process instagram outbox failed",
				"outbox_id", items[i].ID,
				"error", err,
			)
			continue
		}
		successCount++
	}
	return successCount
}

func (s *instagramOutboundService) processOutbox(outboxID int64) error {
	outbox := ChannelMessageOutboxService.Get(outboxID)
	if outbox == nil {
		return nil
	}
	if outbox.ChannelType != enums.ChannelTypeInstagram {
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
		return s.markOutboxFailed(outbox, "instagram channel not found or disabled")
	}
	cfg, err := ChannelService.ParseInstagramChannelConfig(channel.ConfigJSON)
	if err != nil || cfg == nil || cfg.PageAccessToken == "" {
		return s.markOutboxFailed(outbox, "instagram page access token not configured")
	}

	// Resolve target Instagram IGSID
	var igsid string
	customerIdentity := repositories.CustomerIdentityRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("customer_id", conversation.CustomerID).
		Eq("external_source", enums.ExternalSourceInstagram))
	if customerIdentity != nil {
		igsid = strings.TrimSpace(customerIdentity.ExternalID)
	}
	if igsid == "" {
		return s.markOutboxFailed(outbox, "unable to resolve instagram igsid")
	}

	// Send message via Meta Graph API
	client := messenger.NewClient(cfg.PageAccessToken)
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
			_, sendErr = client.SendMediaMessage(ctx, igsid, "image", imageURL)
		} else {
			_, sendErr = client.SendTextMessage(ctx, igsid, message.Content)
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
			_, sendErr = client.SendMediaMessage(ctx, igsid, "file", fileURL)
		} else {
			_, sendErr = client.SendTextMessage(ctx, igsid, message.Content)
		}
	} else {
		_, sendErr = client.SendTextMessage(ctx, igsid, message.Content)
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

func (s *instagramOutboundService) markOutboxFailed(outbox *models.ChannelMessageOutbox, errMsg string) error {
	if outbox == nil {
		return nil
	}
	retryCount := outbox.RetryCount + 1
	status := string(enums.ChannelMessageOutboxStatusFailed)
	if retryCount >= instagramOutboxMaxRetry {
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

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
	"agent-desk/internal/x"

	"github.com/mlogclub/simple/sqls"
)

const (
	xOutboxBatchSize = 20
	xOutboxMaxRetry  = 5
)

var XOutboundService = newXOutboundService()

func newXOutboundService() *xOutboundService {
	return &xOutboundService{}
}

type xOutboundService struct{}

func (s *xOutboundService) DispatchPendingOutbox() int {
	return s.doDispatchPendingOutbox(xOutboxBatchSize)
}

func (s *xOutboundService) doDispatchPendingOutbox(limit int) int {
	if limit <= 0 {
		limit = xOutboxBatchSize
	}
	items := ChannelMessageOutboxService.ListPending(enums.ChannelTypeX, limit)
	if len(items) == 0 {
		return 0
	}

	successCount := 0
	for i := range items {
		if err := s.processOutbox(items[i].ID); err != nil {
			slog.Warn("process x outbox failed",
				"outbox_id", items[i].ID,
				"error", err,
			)
			continue
		}
		successCount++
	}
	return successCount
}

func (s *xOutboundService) processOutbox(outboxID int64) error {
	outbox := ChannelMessageOutboxService.Get(outboxID)
	if outbox == nil {
		return nil
	}
	if outbox.ChannelType != enums.ChannelTypeX {
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
		return s.markOutboxFailed(outbox, "x channel not found or disabled")
	}
	cfg, err := ChannelService.ParseXChannelConfig(channel.ConfigJSON)
	if err != nil || cfg == nil || (cfg.BearerToken == "" && cfg.AccessToken == "") {
		return s.markOutboxFailed(outbox, "x credentials (bearer token / access token) not configured")
	}

	// Resolve target X User ID (ExternalID)
	var recipientID string
	customerIdentity := repositories.CustomerIdentityRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("customer_id", conversation.CustomerID).
		Eq("external_source", enums.ExternalSourceX))
	if customerIdentity != nil {
		recipientID = strings.TrimSpace(customerIdentity.ExternalID)
	}
	if recipientID == "" {
		return s.markOutboxFailed(outbox, "unable to resolve recipient x user_id")
	}

	token := cfg.BearerToken
	if token == "" {
		token = cfg.AccessToken
	}
	client := x.NewClient(token)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	textToSend := message.Content
	if message.MessageType == enums.IMMessageTypeImage || message.MessageType == enums.IMMessageTypeAttachment {
		assetPayload, err := parseIMMessageAssetPayload(message.Payload)
		if err == nil && assetPayload != nil {
			assetPayload = hydrateIMMessageAssetPayload(assetPayload)
			if assetPayload.Provider != "" && assetPayload.StorageKey != "" {
				if provider, err := storage.NewProvider(assetPayload.Provider); err == nil {
					fileURL := provider.GetSignedURL(assetPayload.StorageKey)
					if fileURL != "" {
						if textToSend != "" {
							textToSend += "\n" + fileURL
						} else {
							textToSend = fileURL
						}
					}
				}
			}
		}
	}

	_, sendErr := client.SendDirectMessage(ctx, recipientID, textToSend)
	if sendErr != nil {
		return s.markOutboxFailed(outbox, sendErr.Error())
	}

	return ChannelMessageOutboxService.Updates(outbox.ID, map[string]any{
		"send_status": string(enums.ChannelMessageOutboxStatusSent),
		"sent_at":     time.Now(),
		"updated_at":  time.Now(),
	})
}

func (s *xOutboundService) markOutboxFailed(outbox *models.ChannelMessageOutbox, errMsg string) error {
	if outbox == nil {
		return nil
	}
	retryCount := outbox.RetryCount + 1
	status := string(enums.ChannelMessageOutboxStatusFailed)
	if retryCount >= xOutboxMaxRetry {
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

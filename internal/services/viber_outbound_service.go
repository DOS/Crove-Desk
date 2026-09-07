package services

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/repositories"
	"agent-desk/internal/viber"

	"github.com/mlogclub/simple/sqls"
)

const (
	viberOutboxBatchSize = 20
	viberOutboxMaxRetry  = 5
)

var ViberOutboundService = newViberOutboundService()

func newViberOutboundService() *viberOutboundService {
	return &viberOutboundService{}
}

type viberOutboundService struct{}

func (s *viberOutboundService) DispatchPendingOutbox() int {
	return s.doDispatchPendingOutbox(viberOutboxBatchSize)
}

func (s *viberOutboundService) doDispatchPendingOutbox(limit int) int {
	if limit <= 0 {
		limit = viberOutboxBatchSize
	}
	items := ChannelMessageOutboxService.ListPending(enums.ChannelTypeViber, limit)
	if len(items) == 0 {
		return 0
	}

	successCount := 0
	for i := range items {
		if err := s.processOutbox(items[i].ID); err != nil {
			slog.Warn("process viber outbox failed",
				"outbox_id", items[i].ID,
				"error", err,
			)
			continue
		}
		successCount++
	}
	return successCount
}

func (s *viberOutboundService) processOutbox(outboxID int64) error {
	outbox := ChannelMessageOutboxService.Get(outboxID)
	if outbox == nil {
		return nil
	}
	if outbox.ChannelType != enums.ChannelTypeViber {
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
		return s.markOutboxFailed(outbox, "viber channel not found or disabled")
	}
	cfg, err := ChannelService.ParseViberChannelConfig(channel.ConfigJSON)
	if err != nil || cfg == nil || cfg.AuthToken == "" {
		return s.markOutboxFailed(outbox, "viber credentials (auth token) not configured")
	}

	// Resolve target Viber user ID (ExternalID)
	var recipientID string
	customerIdentity := repositories.CustomerIdentityRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("customer_id", conversation.CustomerID).
		Eq("external_source", enums.ExternalSourceViber))
	if customerIdentity != nil {
		recipientID = strings.TrimSpace(customerIdentity.ExternalID)
	}
	if recipientID == "" {
		return s.markOutboxFailed(outbox, "unable to resolve recipient viber user id")
	}

	text := strings.TrimSpace(message.Content)
	if text == "" {
		return s.markOutboxFailed(outbox, "viber only supports text content")
	}

	client := viber.NewClient(cfg.AuthToken)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if _, err := client.SendTextMessage(ctx, recipientID, cfg.BotName, cfg.AvatarURL, text); err != nil {
		return s.markOutboxFailed(outbox, err.Error())
	}

	return ChannelMessageOutboxService.Updates(outbox.ID, map[string]any{
		"send_status": string(enums.ChannelMessageOutboxStatusSent),
		"sent_at":     time.Now(),
		"updated_at":  time.Now(),
	})
}

func (s *viberOutboundService) markOutboxFailed(outbox *models.ChannelMessageOutbox, errMsg string) error {
	if outbox == nil {
		return nil
	}
	retryCount := outbox.RetryCount + 1
	status := string(enums.ChannelMessageOutboxStatusFailed)
	if retryCount >= viberOutboxMaxRetry {
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

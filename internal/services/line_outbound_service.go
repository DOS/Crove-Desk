package services

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"agent-desk/internal/line"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/repositories"

	"github.com/mlogclub/simple/sqls"
)

const (
	lineOutboxBatchSize = 20
	lineOutboxMaxRetry  = 5
)

var LineOutboundService = newLineOutboundService()

func newLineOutboundService() *lineOutboundService {
	return &lineOutboundService{}
}

type lineOutboundService struct{}

func (s *lineOutboundService) DispatchPendingOutbox() int {
	return s.doDispatchPendingOutbox(lineOutboxBatchSize)
}

func (s *lineOutboundService) doDispatchPendingOutbox(limit int) int {
	if limit <= 0 {
		limit = lineOutboxBatchSize
	}
	items := ChannelMessageOutboxService.ListPending(enums.ChannelTypeLine, limit)
	if len(items) == 0 {
		return 0
	}

	successCount := 0
	for i := range items {
		if err := s.processOutbox(items[i].ID); err != nil {
			slog.Warn("process line outbox failed",
				"outbox_id", items[i].ID,
				"error", err,
			)
			continue
		}
		successCount++
	}
	return successCount
}

func (s *lineOutboundService) processOutbox(outboxID int64) error {
	outbox := ChannelMessageOutboxService.Get(outboxID)
	if outbox == nil {
		return nil
	}
	if outbox.ChannelType != enums.ChannelTypeLine {
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
		return s.markOutboxFailed(outbox, "line channel not found or disabled")
	}
	cfg, err := ChannelService.ParseLineChannelConfig(channel.ConfigJSON)
	if err != nil || cfg == nil || cfg.ChannelAccessToken == "" {
		return s.markOutboxFailed(outbox, "line credentials (channel access token) not configured")
	}

	// Resolve target LINE user ID (ExternalID)
	var recipientID string
	customerIdentity := repositories.CustomerIdentityRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("customer_id", conversation.CustomerID).
		Eq("external_source", enums.ExternalSourceLine))
	if customerIdentity != nil {
		recipientID = strings.TrimSpace(customerIdentity.ExternalID)
	}
	if recipientID == "" {
		return s.markOutboxFailed(outbox, "unable to resolve recipient line user id")
	}

	text := strings.TrimSpace(message.Content)
	if text == "" {
		return s.markOutboxFailed(outbox, "line only supports text content")
	}

	client := line.NewClient(cfg.ChannelAccessToken)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if _, err := client.PushMessage(ctx, line.PushMessageRequest{
		To:       recipientID,
		Messages: []line.MessageObject{{Type: "text", Text: text}},
	}); err != nil {
		return s.markOutboxFailed(outbox, err.Error())
	}

	return ChannelMessageOutboxService.Updates(outbox.ID, map[string]any{
		"send_status": string(enums.ChannelMessageOutboxStatusSent),
		"sent_at":     time.Now(),
		"updated_at":  time.Now(),
	})
}

func (s *lineOutboundService) markOutboxFailed(outbox *models.ChannelMessageOutbox, errMsg string) error {
	if outbox == nil {
		return nil
	}
	retryCount := outbox.RetryCount + 1
	status := string(enums.ChannelMessageOutboxStatusFailed)
	if retryCount >= lineOutboxMaxRetry {
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

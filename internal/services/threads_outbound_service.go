package services

import (
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"time"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/repositories"
	"agent-desk/internal/threads"

	"github.com/mlogclub/simple/sqls"
)

const (
	threadsOutboxBatchSize = 20
	threadsOutboxMaxRetry  = 5
)

var ThreadsOutboundService = newThreadsOutboundService()

func newThreadsOutboundService() *threadsOutboundService {
	return &threadsOutboundService{}
}

type threadsOutboundService struct{}

func (s *threadsOutboundService) DispatchPendingOutbox() int {
	return s.doDispatchPendingOutbox(threadsOutboxBatchSize)
}

func (s *threadsOutboundService) doDispatchPendingOutbox(limit int) int {
	if limit <= 0 {
		limit = threadsOutboxBatchSize
	}
	items := ChannelMessageOutboxService.ListPending(enums.ChannelTypeThreads, limit)
	if len(items) == 0 {
		return 0
	}

	successCount := 0
	for i := range items {
		if err := s.processOutbox(items[i].ID); err != nil {
			slog.Warn("process threads outbox failed",
				"outbox_id", items[i].ID,
				"error", err,
			)
			continue
		}
		successCount++
	}
	return successCount
}

func (s *threadsOutboundService) processOutbox(outboxID int64) error {
	outbox := ChannelMessageOutboxService.Get(outboxID)
	if outbox == nil {
		return nil
	}
	if outbox.ChannelType != enums.ChannelTypeThreads {
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
		return s.markOutboxFailed(outbox, "threads channel not found or disabled")
	}
	cfg, err := ChannelService.ParseThreadsChannelConfig(channel.ConfigJSON)
	if err != nil || cfg == nil || cfg.AccessToken == "" || cfg.ThreadsUserID == "" {
		return s.markOutboxFailed(outbox, "threads credentials (access token / threads user id) not configured")
	}

	// Threads replies target a media object, not a user. Use the latest
	// customer message in the conversation as the reply anchor.
	var replyTargetID string
	lastCustomerMsg := repositories.MessageRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("conversation_id", conversation.ID).
		Eq("sender_type", enums.IMSenderTypeCustomer).
		Desc("id"))
	if lastCustomerMsg != nil && lastCustomerMsg.Payload != "" {
		var payloadMap map[string]any
		if err := json.Unmarshal([]byte(lastCustomerMsg.Payload), &payloadMap); err == nil {
			if id, ok := payloadMap["threads_media_id"].(string); ok && id != "" {
				replyTargetID = id
			} else if id, ok := payloadMap["threads_reply_to_id"].(string); ok && id != "" {
				replyTargetID = id
			}
		}
	}
	if replyTargetID == "" {
		return s.markOutboxFailed(outbox, "unable to resolve threads reply target")
	}

	text := strings.TrimSpace(message.Content)
	if text == "" {
		return s.markOutboxFailed(outbox, "threads only supports text content")
	}

	client := threads.NewClient(cfg.AccessToken)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	if _, err := client.PublishTextReply(ctx, cfg.ThreadsUserID, text, replyTargetID); err != nil {
		return s.markOutboxFailed(outbox, err.Error())
	}

	return ChannelMessageOutboxService.Updates(outbox.ID, map[string]any{
		"send_status": string(enums.ChannelMessageOutboxStatusSent),
		"sent_at":     time.Now(),
		"updated_at":  time.Now(),
	})
}

func (s *threadsOutboundService) markOutboxFailed(outbox *models.ChannelMessageOutbox, errMsg string) error {
	if outbox == nil {
		return nil
	}
	retryCount := outbox.RetryCount + 1
	status := string(enums.ChannelMessageOutboxStatusFailed)
	if retryCount >= threadsOutboxMaxRetry {
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

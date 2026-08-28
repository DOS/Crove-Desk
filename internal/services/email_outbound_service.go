package services

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"agent-desk/internal/email"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/repositories"

	"github.com/mlogclub/simple/sqls"
)

const (
	emailOutboxBatchSize = 20
	emailOutboxMaxRetry  = 5
)

var EmailOutboundService = newEmailOutboundService()

func newEmailOutboundService() *emailOutboundService {
	return &emailOutboundService{}
}

type emailOutboundService struct{}

func (s *emailOutboundService) DispatchPendingOutbox() int {
	return s.doDispatchPendingOutbox(emailOutboxBatchSize)
}

func (s *emailOutboundService) doDispatchPendingOutbox(limit int) int {
	if limit <= 0 {
		limit = emailOutboxBatchSize
	}
	items := ChannelMessageOutboxService.ListPending(enums.ChannelTypeEmail, limit)
	if len(items) == 0 {
		return 0
	}

	successCount := 0
	for i := range items {
		if err := s.processOutbox(items[i].ID); err != nil {
			slog.Warn("process email outbox failed",
				"outbox_id", items[i].ID,
				"error", err,
			)
			continue
		}
		successCount++
	}
	return successCount
}

func (s *emailOutboundService) processOutbox(outboxID int64) error {
	outbox := ChannelMessageOutboxService.Get(outboxID)
	if outbox == nil {
		return nil
	}
	if outbox.ChannelType != enums.ChannelTypeEmail {
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
		return s.markOutboxFailed(outbox, "email channel not found or disabled")
	}
	cfg, err := ChannelService.ParseEmailChannelConfig(channel.ConfigJSON)
	if err != nil || cfg == nil {
		return s.markOutboxFailed(outbox, "email channel config invalid")
	}

	// 1. Resolve recipient email address
	targetEmail := ""
	targetName := ""
	customer := repositories.CustomerRepository.Get(sqls.DB(), conversation.CustomerID)
	if customer != nil {
		targetEmail = strings.TrimSpace(customer.PrimaryEmail)
		targetName = strings.TrimSpace(customer.Name)
	}
	if targetEmail == "" {
		customerIdentity := repositories.CustomerIdentityRepository.FindOne(sqls.DB(), sqls.NewCnd().
			Eq("customer_id", conversation.CustomerID).
			Eq("external_source", enums.ExternalSourceEmail))
		if customerIdentity != nil {
			targetEmail = strings.TrimSpace(customerIdentity.ExternalID)
		}
	}
	if targetEmail == "" {
		return s.markOutboxFailed(outbox, "unable to resolve customer email address")
	}

	// 2. Resolve sender config & fallbacks
	fromEmail := strings.TrimSpace(cfg.EmailAddress)
	if fromEmail == "" {
		fromEmail = "help@crove.com"
	}
	fromName := strings.TrimSpace(cfg.SenderName)
	if fromName == "" {
		fromName = "Crove Desk Support"
	}

	apiKey := cfg.APIKey
	if apiKey == "" {
		apiKey = os.Getenv("BREVO_API_KEY")
		if apiKey == "" {
			apiKey = os.Getenv("CROVE_BREVO_API_KEY")
		}
	}

	smtpHost := cfg.SMTPHost
	if smtpHost == "" {
		smtpHost = os.Getenv("SMTP_HOST")
	}
	smtpPort := cfg.SMTPPort
	if smtpPort <= 0 {
		smtpPort = 587
	}
	smtpUser := cfg.SMTPUser
	if smtpUser == "" {
		smtpUser = os.Getenv("SMTP_USER")
	}
	smtpPassword := cfg.SMTPPassword
	if smtpPassword == "" {
		smtpPassword = os.Getenv("SMTP_PASSWORD")
	}

	provider := cfg.Provider
	if provider == "" {
		if apiKey != "" {
			provider = "brevo"
		} else {
			provider = "smtp"
		}
	}

	client := email.NewClient(email.ClientConfig{
		Provider:     provider,
		APIKey:       apiKey,
		SMTPHost:     smtpHost,
		SMTPPort:     smtpPort,
		SMTPUser:     smtpUser,
		SMTPPassword: smtpPassword,
	})

	subject := fmt.Sprintf("Re: Support Ticket #%d", conversation.ID)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	sendErr := client.SendEmail(ctx, email.SendEmailParams{
		FromEmail: fromEmail,
		FromName:  fromName,
		ToEmail:   targetEmail,
		ToName:    targetName,
		Subject:   subject,
		BodyText:  message.Content,
	})

	if sendErr != nil {
		return s.handleOutboxError(outbox, sendErr.Error())
	}

	return s.markOutboxSent(outbox, fmt.Sprintf("sent to %s", targetEmail))
}

func (s *emailOutboundService) markOutboxSent(outbox *models.ChannelMessageOutbox, detail string) error {
	now := time.Now()
	return ChannelMessageOutboxService.Updates(outbox.ID, map[string]any{
		"send_status":  string(enums.ChannelMessageOutboxStatusSent),
		"send_detail":  detail,
		"sent_at":      &now,
		"updated_at":   now,
		"next_retry_at": nil,
	})
}

func (s *emailOutboundService) markOutboxFailed(outbox *models.ChannelMessageOutbox, reason string) error {
	now := time.Now()
	return ChannelMessageOutboxService.Updates(outbox.ID, map[string]any{
		"send_status":  string(enums.ChannelMessageOutboxStatusFailed),
		"send_detail":  reason,
		"updated_at":   now,
		"next_retry_at": nil,
	})
}

func (s *emailOutboundService) handleOutboxError(outbox *models.ChannelMessageOutbox, errMsg string) error {
	retryCount := outbox.RetryCount + 1
	now := time.Now()

	if retryCount >= emailOutboxMaxRetry {
		return ChannelMessageOutboxService.Updates(outbox.ID, map[string]any{
			"send_status":  string(enums.ChannelMessageOutboxStatusFailed),
			"send_detail":  fmt.Sprintf("max retries exceeded: %s", errMsg),
			"retry_count":  retryCount,
			"updated_at":   now,
			"next_retry_at": nil,
		})
	}

	// Exponential backoff
	backoff := time.Duration(1<<retryCount) * 10 * time.Second
	nextRetry := now.Add(backoff)

	return ChannelMessageOutboxService.Updates(outbox.ID, map[string]any{
		"send_status":  string(enums.ChannelMessageOutboxStatusPending),
		"send_detail":  fmt.Sprintf("retry #%d error: %s", retryCount, errMsg),
		"retry_count":  retryCount,
		"updated_at":   now,
		"next_retry_at": &nextRetry,
	})
}

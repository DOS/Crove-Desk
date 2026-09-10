package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/pkg/openidentity"
	"agent-desk/internal/threads"
)

var ThreadsInboundService = newThreadsInboundService()

func newThreadsInboundService() *threadsInboundService {
	return &threadsInboundService{}
}

type threadsInboundService struct{}

// HandleWebhook processes an incoming webhook from Meta Threads.
func (s *threadsInboundService) HandleWebhook(ctx context.Context, channelID string, signature string, rawPayload []byte) error {
	channelID = strings.TrimSpace(channelID)
	var channel *models.Channel
	if channelID != "" {
		channel = ChannelService.Take("channel_id = ? AND channel_type = ? AND status = ?", channelID, enums.ChannelTypeThreads, enums.StatusOk)
	}
	if channel == nil {
		channel = ChannelService.Take("channel_type = ? AND status = ?", enums.ChannelTypeThreads, enums.StatusOk)
	}
	if channel == nil {
		return errorsx.InvalidParam("threads channel not found or disabled")
	}

	cfg, err := ChannelService.ParseThreadsChannelConfig(channel.ConfigJSON)
	if err != nil || cfg == nil || cfg.AccessToken == "" {
		return errorsx.InvalidParam("threads channel config invalid")
	}

	// Verify X-Hub-Signature-256 when the app secret is configured. The
	// check is fail-closed: once a secret is set, webhooks without a valid
	// signature are rejected.
	if cfg.AppSecret != "" {
		if !threads.VerifyWebhookSignature(cfg.AppSecret, signature, rawPayload) {
			return errorsx.UnauthorizedI18n("error.auth.invalidSignature")
		}
	}

	var payload threads.WebhookPayload
	if err := json.Unmarshal(rawPayload, &payload); err != nil {
		return fmt.Errorf("unmarshal threads webhook failed: %w", err)
	}

	for _, value := range collectThreadsReplyValues(&payload) {
		if err := s.processReply(channel, value); err != nil {
			return err
		}
	}
	return nil
}

// collectThreadsReplyValues extracts reply objects from both documented
// webhook envelope shapes.
func collectThreadsReplyValues(payload *threads.WebhookPayload) []*threads.WebhookValue {
	var values []*threads.WebhookValue

	appendValue := func(field string, value *threads.WebhookValue) {
		if field == "replies" && value != nil && strings.TrimSpace(value.Text) != "" {
			values = append(values, value)
		}
	}

	if payload == nil {
		return values
	}
	for i := range payload.Entry {
		for j := range payload.Entry[i].Changes {
			appendValue(payload.Entry[i].Changes[j].Field, payload.Entry[i].Changes[j].Value)
		}
	}
	if payload.Values != nil {
		appendValue(payload.Values.Field, payload.Values.Value)
	}
	return values
}

func (s *threadsInboundService) processReply(channel *models.Channel, value *threads.WebhookValue) error {
	replyMediaID := strings.TrimSpace(value.ID)
	if replyMediaID == "" {
		replyMediaID = strings.TrimSpace(value.MediaID)
	}
	if replyMediaID == "" {
		return nil
	}

	// Threads reply webhooks do not carry a stable user id, but the
	// @username is stable, so use it as the external identity to keep one
	// customer per person. Fall back to the reply media id when missing.
	externalID := strings.TrimSpace(value.Username)
	if externalID == "" {
		externalID = replyMediaID
	}

	name := strings.TrimSpace(value.Username)
	if name == "" {
		name = fmt.Sprintf("Threads User %s", replyMediaID)
	}

	externalUser := openidentity.ExternalUser{
		ExternalSource: enums.ExternalSourceThreads,
		ExternalID:     externalID,
		ExternalName:   name,
	}

	conversation, err := ConversationService.Create(externalUser, channel.ID, channel.AIAgentID)
	if err != nil {
		return fmt.Errorf("create threads conversation failed: %w", err)
	}

	clientMsgID := fmt.Sprintf("threads_%s", replyMediaID)
	payloadMap := map[string]any{
		"threads_media_id":   replyMediaID,
		"threads_username":   strings.TrimSpace(value.Username),
		"threads_media_type": strings.TrimSpace(value.MediaType),
		"threads_permalink":  strings.TrimSpace(value.Permalink),
	}
	if value.RepliedTo != nil && strings.TrimSpace(value.RepliedTo.ID) != "" {
		payloadMap["threads_reply_to_id"] = strings.TrimSpace(value.RepliedTo.ID)
	}
	if value.RootPost != nil && strings.TrimSpace(value.RootPost.ID) != "" {
		payloadMap["threads_root_post_id"] = strings.TrimSpace(value.RootPost.ID)
	}
	payloadBytes, _ := json.Marshal(payloadMap)

	if _, err := MessageService.SendCustomerMessage(
		conversation.ID,
		clientMsgID,
		enums.IMMessageTypeText,
		strings.TrimSpace(value.Text),
		string(payloadBytes),
		externalUser,
	); err != nil {
		return fmt.Errorf("send customer message failed: %w", err)
	}
	return nil
}

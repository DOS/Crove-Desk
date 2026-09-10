package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/repositories"

	"github.com/mlogclub/simple/sqls"
)

const threadsTestAppSecret = "threads_app_secret_123"

func signThreadsPayload(t *testing.T, secret string, payload []byte) string {
	t.Helper()
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func TestThreadsInboundAndOutbound(t *testing.T) {
	db := setupTikTokTestDB(t)

	now := time.Now()
	aiAgent := &models.AIAgent{
		Name:                "Threads AI Agent",
		Status:              enums.StatusOk,
		PublishedRevisionID: 1,
		AuditFields:         models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(aiAgent).Error; err != nil {
		t.Fatalf("create ai agent: %v", err)
	}

	threadsConfig := dto.ThreadsChannelConfig{
		ThreadsUserID:      "threads_biz_42",
		Username:           "crove_desk",
		AccessToken:        "test_threads_access_token",
		WebhookVerifyToken: "threads_verify_token_9",
		AppSecret:          threadsTestAppSecret,
	}
	cfgBytes, _ := json.Marshal(threadsConfig)

	channel := &models.Channel{
		ChannelType:           enums.ChannelTypeThreads,
		ChannelID:             "threads_channel_uuid_1",
		AIAgentID:             aiAgent.ID,
		AIAgentRolloutPercent: 100,
		Name:                  "Threads Support Channel",
		ConfigJSON:            string(cfgBytes),
		Status:                enums.StatusOk,
		AuditFields:           models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(channel).Error; err != nil {
		t.Fatalf("create threads channel: %v", err)
	}

	// Standard Meta envelope with a replies field change.
	payload := []byte(fmt.Sprintf(
		`{"object":"threads","entry":[{"id":"threads_biz_42","time":1725260000,"changes":[{"field":"replies","value":{"id":"reply_9001","username":"threads_customer","text":"Hello from Threads","media_type":"TEXT_POST","permalink":"https://www.threads.com/@threads_customer/post/Pp","replied_to":{"id":"root_post_1"},"root_post":{"id":"root_post_1","owner_id":"threads_biz_42"},"shortcode":"Pp","timestamp":"2026-09-07T10:33:16+0000"}}]}]}`,
	))
	signature := signThreadsPayload(t, threadsTestAppSecret, payload)

	ctx := context.Background()
	if err := ThreadsInboundService.HandleWebhook(ctx, "", signature, payload); err != nil {
		t.Fatalf("HandleWebhook failed: %v", err)
	}

	// Invalid signature must be rejected.
	if err := ThreadsInboundService.HandleWebhook(ctx, "", "sha256=deadbeef", payload); err == nil {
		t.Fatalf("expected invalid signature to be rejected")
	}

	// Verify customer identity - username is the stable external id, so
	// both replies from the same person map to one customer.
	identity := repositories.CustomerIdentityRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceThreads).
		Eq("external_id", "threads_customer"))
	if identity == nil {
		t.Fatalf("expected customer identity for threads_customer")
	}

	// Verify conversation
	conv := repositories.ConversationRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("customer_id", identity.CustomerID).
		Eq("channel_id", channel.ID))
	if conv == nil {
		t.Fatalf("expected conversation to be created")
	}

	// Verify message
	msg := repositories.MessageRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("conversation_id", conv.ID).
		Eq("sender_type", enums.IMSenderTypeCustomer))
	if msg == nil {
		t.Fatalf("expected customer message to be created")
	}
	if msg.Content != "Hello from Threads" {
		t.Fatalf("expected message content 'Hello from Threads', got %s", msg.Content)
	}

	// Verify outbox enqueue on agent reply
	operator := &dto.AuthPrincipal{UserID: 1, Username: "tester"}
	if _, err := MessageService.SendAIMessage(conv.ID, aiAgent.ID, "ai_threads_reply_1", enums.IMMessageTypeText, "Hi, how can we help?", "", operator); err != nil {
		t.Fatalf("SendAIMessage failed: %v", err)
	}

	replyMsg := repositories.MessageRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("conversation_id", conv.ID).
		Eq("sender_type", enums.IMSenderTypeAI).
		Desc("id"))
	if replyMsg == nil {
		t.Fatalf("expected agent reply message to be created")
	}
	outbox := ChannelMessageOutboxService.GetByMessageID(enums.ChannelTypeThreads, replyMsg.ID)
	if outbox == nil {
		t.Fatalf("expected threads outbox row for agent reply")
	}
	if outbox.ChannelType != enums.ChannelTypeThreads {
		t.Fatalf("expected outbox channel type 'threads', got %s", outbox.ChannelType)
	}

	// Topic/values envelope shape must also be parsed.
	topicPayload := []byte(`{"app_id":"123456","topic":"moderate","target_id":"78901","time":1723226877,"subscription_id":"234567","values":{"value":{"id":"reply_9002","username":"threads_customer","text":"Second reply","media_type":"TEXT_POST","permalink":"https://www.threads.com/@threads_customer/post/Pq","replied_to":{"id":"reply_9001"},"root_post":{"id":"root_post_1"}},"field":"replies"}}`)
	topicSignature := signThreadsPayload(t, threadsTestAppSecret, topicPayload)
	if err := ThreadsInboundService.HandleWebhook(ctx, "", topicSignature, topicPayload); err != nil {
		t.Fatalf("topic envelope HandleWebhook failed: %v", err)
	}
	// Same username must reuse the same customer identity (no fragmentation).
	identities := repositories.CustomerIdentityRepository.Find(sqls.DB(), sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceThreads).
		Eq("external_id", "threads_customer"))
	if len(identities) != 1 {
		t.Fatalf("expected exactly 1 customer identity for threads_customer, got %d", len(identities))
	}
}

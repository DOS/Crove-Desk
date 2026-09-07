package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/repositories"

	"github.com/mlogclub/simple/sqls"
)

const viberTestAuthToken = "viber_auth_token_123"

func signViberPayload(t *testing.T, token string, payload []byte) string {
	t.Helper()
	mac := hmac.New(sha256.New, []byte(token))
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}

func TestViberInboundAndOutbound(t *testing.T) {
	db := setupTikTokTestDB(t)

	now := time.Now()
	aiAgent := &models.AIAgent{
		Name:                "Viber AI Agent",
		Status:              enums.StatusOk,
		PublishedRevisionID: 1,
		AuditFields:         models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(aiAgent).Error; err != nil {
		t.Fatalf("create ai agent: %v", err)
	}

	viberConfig := dto.ViberChannelConfig{
		AuthToken:      viberTestAuthToken,
		BotName:        "Crove Support",
		WelcomeMessage: "Welcome! How can we help?",
	}
	cfgBytes, _ := json.Marshal(viberConfig)

	channel := &models.Channel{
		ChannelType:           enums.ChannelTypeViber,
		ChannelID:             "viber_channel_uuid_1",
		AIAgentID:             aiAgent.ID,
		AIAgentRolloutPercent: 100,
		Name:                  "Viber Support Channel",
		ConfigJSON:            string(cfgBytes),
		Status:                enums.StatusOk,
		AuditFields:           models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(channel).Error; err != nil {
		t.Fatalf("create viber channel: %v", err)
	}

	payload := []byte(fmt.Sprintf(
		`{"event":"message","timestamp":1457764199822,"message_token":4911,"sender":{"id":"viber_cust_777","name":"Viber Customer"},"message":{"type":"text","text":"Hello from Viber"}}`,
	))
	signature := signViberPayload(t, viberTestAuthToken, payload)

	ctx := context.Background()
	if _, err := ViberInboundService.HandleWebhook(ctx, "", signature, payload); err != nil {
		t.Fatalf("HandleWebhook failed: %v", err)
	}

	// Invalid signature must be rejected.
	if _, err := ViberInboundService.HandleWebhook(ctx, "", "deadbeef", payload); err == nil {
		t.Fatalf("expected invalid signature to be rejected")
	}

	// Verify customer identity
	identity := repositories.CustomerIdentityRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceViber).
		Eq("external_id", "viber_cust_777"))
	if identity == nil {
		t.Fatalf("expected customer identity for viber_cust_777")
	}

	// Verify conversation + message
	conv := repositories.ConversationRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("customer_id", identity.CustomerID).
		Eq("channel_id", channel.ID))
	if conv == nil {
		t.Fatalf("expected conversation to be created")
	}

	msg := repositories.MessageRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("conversation_id", conv.ID).
		Eq("sender_type", enums.IMSenderTypeCustomer))
	if msg == nil {
		t.Fatalf("expected customer message to be created")
	}
	if msg.Content != "Hello from Viber" {
		t.Fatalf("expected message content 'Hello from Viber', got %s", msg.Content)
	}

	// conversation_started returns the welcome message JSON body.
	convStartedPayload := []byte(`{"event":"conversation_started","timestamp":1457764199822,"message_token":4910,"user":{"id":"viber_cust_777","name":"Viber Customer"}}`)
	welcomeSignature := signViberPayload(t, viberTestAuthToken, convStartedPayload)
	respBody, err := ViberInboundService.HandleWebhook(ctx, "", welcomeSignature, convStartedPayload)
	if err != nil {
		t.Fatalf("conversation_started HandleWebhook failed: %v", err)
	}
	if !strings.Contains(respBody, "Welcome! How can we help?") {
		t.Fatalf("expected welcome message in response body, got %s", respBody)
	}

	// Verify outbox enqueue on agent reply
	operator := &dto.AuthPrincipal{UserID: 1, Username: "tester"}
	if _, err := MessageService.SendAIMessage(conv.ID, aiAgent.ID, "ai_viber_reply_1", enums.IMMessageTypeText, "Hi, how can we help?", "", operator); err != nil {
		t.Fatalf("SendAIMessage failed: %v", err)
	}

	replyMsg := repositories.MessageRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("conversation_id", conv.ID).
		Eq("sender_type", enums.IMSenderTypeAI).
		Desc("id"))
	if replyMsg == nil {
		t.Fatalf("expected agent reply message to be created")
	}
	outbox := ChannelMessageOutboxService.GetByMessageID(enums.ChannelTypeViber, replyMsg.ID)
	if outbox == nil {
		t.Fatalf("expected viber outbox row for agent reply")
	}
	if outbox.ChannelType != enums.ChannelTypeViber {
		t.Fatalf("expected outbox channel type 'viber', got %s", outbox.ChannelType)
	}
}

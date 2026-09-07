package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
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

const lineTestChannelSecret = "line_channel_secret_123"

func signLinePayload(t *testing.T, secret string, payload []byte) string {
	t.Helper()
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func TestLineInboundAndOutbound(t *testing.T) {
	db := setupTikTokTestDB(t)

	now := time.Now()
	aiAgent := &models.AIAgent{
		Name:                "LINE AI Agent",
		Status:              enums.StatusOk,
		PublishedRevisionID: 1,
		AuditFields:         models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(aiAgent).Error; err != nil {
		t.Fatalf("create ai agent: %v", err)
	}

	lineConfig := dto.LineChannelConfig{
		ChannelID:          "2001234567",
		ChannelSecret:      lineTestChannelSecret,
		ChannelAccessToken: "test_line_access_token",
	}
	cfgBytes, _ := json.Marshal(lineConfig)

	channel := &models.Channel{
		ChannelType:           enums.ChannelTypeLine,
		ChannelID:             "line_channel_uuid_1",
		AIAgentID:             aiAgent.ID,
		AIAgentRolloutPercent: 100,
		Name:                  "LINE Support Channel",
		ConfigJSON:            string(cfgBytes),
		Status:                enums.StatusOk,
		AuditFields:           models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(channel).Error; err != nil {
		t.Fatalf("create line channel: %v", err)
	}

	payload := []byte(fmt.Sprintf(
		`{"destination":"Udest123","events":[{"type":"message","replyToken":"reply_token_1","source":{"type":"user","userId":"Uline_cust_555"},"message":{"id":"msg_9001","type":"text","text":"Hello from LINE"},"timestamp":1725260000}]}`,
	))
	signature := signLinePayload(t, lineTestChannelSecret, payload)

	ctx := context.Background()
	if err := LineInboundService.HandleWebhook(ctx, "", signature, payload); err != nil {
		t.Fatalf("HandleWebhook failed: %v", err)
	}

	// Invalid signature must be rejected.
	if err := LineInboundService.HandleWebhook(ctx, "", "invalid-signature", payload); err == nil {
		t.Fatalf("expected invalid signature to be rejected")
	}

	// Verify customer identity
	identity := repositories.CustomerIdentityRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceLine).
		Eq("external_id", "Uline_cust_555"))
	if identity == nil {
		t.Fatalf("expected customer identity for Uline_cust_555")
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
	if msg.Content != "Hello from LINE" {
		t.Fatalf("expected message content 'Hello from LINE', got %s", msg.Content)
	}

	// Verify outbox enqueue on agent reply
	operator := &dto.AuthPrincipal{UserID: 1, Username: "tester"}
	if _, err := MessageService.SendAIMessage(conv.ID, aiAgent.ID, "ai_line_reply_1", enums.IMMessageTypeText, "Hi, how can we help?", "", operator); err != nil {
		t.Fatalf("SendAIMessage failed: %v", err)
	}

	// Look up the outbox row created for the agent reply.
	replyMsg := repositories.MessageRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("conversation_id", conv.ID).
		Eq("sender_type", enums.IMSenderTypeAI).
		Desc("id"))
	if replyMsg == nil {
		t.Fatalf("expected agent reply message to be created")
	}
	outbox := ChannelMessageOutboxService.GetByMessageID(enums.ChannelTypeLine, replyMsg.ID)
	if outbox == nil {
		t.Fatalf("expected line outbox row for agent reply")
	}
	if outbox.ChannelType != enums.ChannelTypeLine {
		t.Fatalf("expected outbox channel type 'line', got %s", outbox.ChannelType)
	}
}

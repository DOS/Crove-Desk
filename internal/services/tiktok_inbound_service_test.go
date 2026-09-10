package services

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/repositories"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func setupTikTokTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{
			TablePrefix:   "t_",
			SingularTable: true,
		},
	})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Channel{},
		&models.ChannelMessageOutbox{},
		&models.Customer{},
		&models.CustomerIdentity{},
		&models.CustomerContact{},
		&models.Conversation{},
		&models.ConversationParticipant{},
		&models.ConversationReadState{},
		&models.ConversationInterrupt{},
		&models.ConversationEventLog{},
		&models.Message{},
		&models.AIAgent{},
		&models.User{},
		&models.Role{},
		&models.UserRole{},
		&models.Permission{},
		&models.RolePermission{},
		&models.UserPermission{},
	); err != nil {
		t.Fatalf("migrate tiktok test tables: %v", err)
	}
	sqls.SetDB(db)
	return db
}

func TestTikTokInboundAndOutbound(t *testing.T) {
	db := setupTikTokTestDB(t)

	now := time.Now()
	aiAgent := &models.AIAgent{
		Name:                "TikTok AI Agent",
		Status:              enums.StatusOk,
		PublishedRevisionID: 1,
		AuditFields:         models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(aiAgent).Error; err != nil {
		t.Fatalf("create ai agent: %v", err)
	}

	tiktokConfig := dto.TikTokChannelConfig{
		OpenID:             "tiktok_open_999",
		Username:           "brand_tiktok",
		AccessToken:        "test_tt_access_token",
		WebhookVerifyToken: "verify_token_tt_456",
	}
	cfgBytes, _ := json.Marshal(tiktokConfig)

	channel := &models.Channel{
		ChannelType:           enums.ChannelTypeTikTok,
		ChannelID:             "tiktok_open_999",
		AIAgentID:             aiAgent.ID,
		AIAgentRolloutPercent: 100,
		Name:                  "TikTok Support Channel",
		ConfigJSON:            string(cfgBytes),
		Status:                enums.StatusOk,
		AuditFields:           models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(channel).Error; err != nil {
		t.Fatalf("create tiktok channel: %v", err)
	}

	payload := `{
		"event": "message_create",
		"event_id": "tt_evt_001",
		"from_user_id": "tt_cust_555",
		"to_user_id": "tiktok_open_999",
		"create_time": 1725260000,
		"content": "Hi, where is my order?"
	}`

	ctx := context.Background()
	err := TikTokInboundService.HandleWebhook(ctx, "", "verify_token_tt_456", []byte(payload))
	if err != nil {
		t.Fatalf("HandleWebhook failed: %v", err)
	}

	// Verify customer identity
	identity := repositories.CustomerIdentityRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceTikTok).
		Eq("external_id", "tt_cust_555"))
	if identity == nil {
		t.Fatalf("expected customer identity for tt_cust_555")
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
		t.Fatalf("expected message to be created")
	}
	if msg.Content != "Hi, where is my order?" {
		t.Fatalf("expected message content 'Hi, where is my order?', got %s", msg.Content)
	}

	operator := &dto.AuthPrincipal{UserID: 1, Nickname: "Agent Joy"}

	// Test Outbound enqueue
	replyMsg, err := MessageService.SendAIMessage(conv.ID, aiAgent.ID, "ai_tt_reply_1", enums.IMMessageTypeText, "We are checking your order tracking number!", "", operator)
	if err != nil {
		t.Fatalf("MessageService.SendAIMessage failed: %v", err)
	}

	outbox := ChannelMessageOutboxService.GetByMessageID(enums.ChannelTypeTikTok, replyMsg.ID)
	if outbox == nil {
		t.Fatalf("expected outbox entry for tiktok message")
	}
	if outbox.ChannelType != enums.ChannelTypeTikTok {
		t.Fatalf("expected outbox channel type 'tiktok', got %s", outbox.ChannelType)
	}
}

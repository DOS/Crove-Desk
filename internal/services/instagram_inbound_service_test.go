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

func setupInstagramTestDB(t *testing.T) *gorm.DB {
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
		t.Fatalf("migrate instagram test tables: %v", err)
	}
	sqls.SetDB(db)
	return db
}

func TestInstagramInboundAndOutbound(t *testing.T) {
	db := setupInstagramTestDB(t)

	now := time.Now()
	aiAgent := &models.AIAgent{
		Name:                "Instagram AI Agent",
		Status:              enums.StatusOk,
		PublishedRevisionID: 1,
		AuditFields:         models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(aiAgent).Error; err != nil {
		t.Fatalf("create ai agent: %v", err)
	}

	instagramConfig := dto.InstagramChannelConfig{
		InstagramID:        "ig_account_12345",
		InstagramUsername:  "acme_brand",
		PageAccessToken:    "test_ig_access_token",
		WebhookVerifyToken: "verify_token_ig_789",
	}
	cfgBytes, _ := json.Marshal(instagramConfig)

	channel := &models.Channel{
		ChannelType:           enums.ChannelTypeInstagram,
		ChannelID:             "ig_account_12345",
		AIAgentID:             aiAgent.ID,
		AIAgentRolloutPercent: 100,
		Name:                  "Instagram Brand Support",
		ConfigJSON:            string(cfgBytes),
		Status:                enums.StatusOk,
		AuditFields:           models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(channel).Error; err != nil {
		t.Fatalf("create instagram channel: %v", err)
	}

	payload := `{
		"object": "instagram",
		"entry": [
			{
				"id": "ig_account_12345",
				"time": 1725260000,
				"messaging": [
					{
						"sender": { "id": "igsid_customer_888" },
						"recipient": { "id": "ig_account_12345" },
						"timestamp": 1725260000,
						"message": {
							"mid": "mid_ig_112233",
							"text": "Hello, do you ship internationally?"
						}
					}
				]
			}
		]
	}`

	ctx := context.Background()
	err := InstagramInboundService.HandleWebhook(ctx, "", "", []byte(payload))
	if err != nil {
		t.Fatalf("HandleWebhook failed: %v", err)
	}

	// Verify customer identity
	identity := repositories.CustomerIdentityRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceInstagram).
		Eq("external_id", "igsid_customer_888"))
	if identity == nil {
		t.Fatalf("expected customer identity to be created for igsid_customer_888")
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
	if msg.Content != "Hello, do you ship internationally?" {
		t.Fatalf("expected message content 'Hello, do you ship internationally?', got %s", msg.Content)
	}

	operator := &dto.AuthPrincipal{UserID: 1, Nickname: "Agent Joy"}

	// Test Outbound enqueue
	replyMsg, err := MessageService.SendAIMessage(conv.ID, aiAgent.ID, "ai_ig_reply_1", enums.IMMessageTypeText, "Yes, we ship to over 50 countries!", "", operator)
	if err != nil {
		t.Fatalf("MessageService.SendAIMessage failed: %v", err)
	}

	outbox := ChannelMessageOutboxService.GetByMessageID(enums.ChannelTypeInstagram, replyMsg.ID)
	if outbox == nil {
		t.Fatalf("expected outbox entry for instagram message")
	}
	if outbox.ChannelType != enums.ChannelTypeInstagram {
		t.Fatalf("expected outbox channel type 'instagram', got %s", outbox.ChannelType)
	}
}

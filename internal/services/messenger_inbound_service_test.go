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

func setupMessengerTestDB(t *testing.T) *gorm.DB {
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
		t.Fatalf("migrate messenger test tables: %v", err)
	}
	sqls.SetDB(db)
	return db
}

func TestMessengerInboundAndOutbound(t *testing.T) {
	db := setupMessengerTestDB(t)

	now := time.Now()
	aiAgent := &models.AIAgent{
		Name:                "Support AI",
		Status:              enums.StatusOk,
		PublishedRevisionID: 1,
		AuditFields:         models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(aiAgent).Error; err != nil {
		t.Fatalf("create ai agent: %v", err)
	}

	messengerConfig := dto.MessengerChannelConfig{
		PageID:             "page_1001",
		PageName:           "Acme Fanpage",
		PageAccessToken:    "page_token_xyz",
		WebhookVerifyToken: "verify_token_123",
	}
	cfgBytes, _ := json.Marshal(messengerConfig)

	channel := &models.Channel{
		ChannelType:           enums.ChannelTypeMessenger,
		ChannelID:             "page_1001",
		AIAgentID:             aiAgent.ID,
		AIAgentRolloutPercent: 100,
		Name:                  "FB Messenger Support",
		ConfigJSON:            string(cfgBytes),
		Status:                enums.StatusOk,
		AuditFields:           models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(channel).Error; err != nil {
		t.Fatalf("create messenger channel: %v", err)
	}

	payload := `{
		"object": "page",
		"entry": [
			{
				"id": "page_1001",
				"time": 1725260000,
				"messaging": [
					{
						"sender": { "id": "psid_555" },
						"recipient": { "id": "page_1001" },
						"timestamp": 1725260000,
						"message": {
							"mid": "mid_fb_777",
							"text": "",
							"attachments": [
								{
									"type": "image",
									"payload": {
										"url": "https://scontent.facebook.com/image.jpg",
										"title": "photo.jpg"
									}
								}
							]
						}
					}
				]
			}
		]
	}`

	ctx := context.Background()
	err := MessengerInboundService.HandleWebhook(ctx, "", "", []byte(payload))
	if err != nil {
		t.Fatalf("HandleWebhook failed: %v", err)
	}

	// Verify customer identity
	identity := repositories.CustomerIdentityRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceMessenger).
		Eq("external_id", "psid_555"))
	if identity == nil {
		t.Fatalf("expected customer identity to be created")
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

	operator := &dto.AuthPrincipal{UserID: 1, Nickname: "Agent Joy"}

	// Test Outbound enqueue with image
	replyMsg, err := MessageService.SendAIMessage(conv.ID, aiAgent.ID, "ai_msg_2", enums.IMMessageTypeText, "https://example.com/banner.png", "", operator)
	if err != nil {
		t.Fatalf("MessageService.SendAIMessage failed: %v", err)
	}

	outbox := ChannelMessageOutboxService.GetByMessageID(enums.ChannelTypeMessenger, replyMsg.ID)
	if outbox == nil {
		t.Fatalf("expected outbox entry for messenger message")
	}
	if outbox.SendStatus != string(enums.ChannelMessageOutboxStatusPending) && outbox.SendStatus != string(enums.ChannelMessageOutboxStatusSending) && outbox.SendStatus != string(enums.ChannelMessageOutboxStatusFailed) {
		t.Fatalf("unexpected outbox status: %s", outbox.SendStatus)
	}
}

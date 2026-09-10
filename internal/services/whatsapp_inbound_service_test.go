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

func setupWhatsAppTestDB(t *testing.T) *gorm.DB {
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
		t.Fatalf("migrate whatsapp test tables: %v", err)
	}
	sqls.SetDB(db)
	return db
}

func TestWhatsAppInboundAndOutbound(t *testing.T) {
	db := setupWhatsAppTestDB(t)

	now := time.Now()
	aiAgent := &models.AIAgent{
		Name:                "WhatsApp AI Agent",
		Status:              enums.StatusOk,
		PublishedRevisionID: 1,
		AuditFields:         models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(aiAgent).Error; err != nil {
		t.Fatalf("create ai agent: %v", err)
	}

	waConfig := dto.WhatsAppChannelConfig{
		PhoneNumberID:      "phone_id_9999",
		WABAID:             "waba_id_8888",
		AccessToken:        "test_wa_access_token",
		WebhookVerifyToken: "verify_token_wa_123",
	}
	cfgBytes, _ := json.Marshal(waConfig)

	channel := &models.Channel{
		ChannelType:           enums.ChannelTypeWhatsApp,
		ChannelID:             "phone_id_9999",
		AIAgentID:             aiAgent.ID,
		AIAgentRolloutPercent: 100,
		Name:                  "WhatsApp Support Channel",
		ConfigJSON:            string(cfgBytes),
		Status:                enums.StatusOk,
		AuditFields:           models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(channel).Error; err != nil {
		t.Fatalf("create whatsapp channel: %v", err)
	}

	payload := `{
		"object": "whatsapp_business_account",
		"entry": [
			{
				"id": "waba_id_8888",
				"changes": [
					{
						"field": "messages",
						"value": {
							"messaging_product": "whatsapp",
							"metadata": {
								"display_phone_number": "15550269999",
								"phone_number_id": "phone_id_9999"
							},
							"contacts": [
								{
									"profile": { "name": "Anh Le" },
									"wa_id": "84901234567"
								}
							],
							"messages": [
								{
									"from": "84901234567",
									"id": "wamid.HBgLODQ5MDEyMzQ1NjcVAgASGBQz",
									"timestamp": "1725260000",
									"type": "text",
									"text": { "body": "Xin chào, tôi cần hỗ trợ!" }
								}
							]
						}
					}
				]
			}
		]
	}`

	ctx := context.Background()
	err := WhatsAppInboundService.HandleWebhook(ctx, "", "", []byte(payload))
	if err != nil {
		t.Fatalf("HandleWebhook failed: %v", err)
	}

	// Verify customer identity
	identity := repositories.CustomerIdentityRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceWhatsApp).
		Eq("external_id", "84901234567"))
	if identity == nil {
		t.Fatalf("expected customer identity for 84901234567")
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
	if msg.Content != "Xin chào, tôi cần hỗ trợ!" {
		t.Fatalf("expected message content 'Xin chào, tôi cần hỗ trợ!', got %s", msg.Content)
	}

	operator := &dto.AuthPrincipal{UserID: 1, Nickname: "Agent Joy"}

	// Test Outbound enqueue
	replyMsg, err := MessageService.SendAIMessage(conv.ID, aiAgent.ID, "ai_wa_reply_1", enums.IMMessageTypeText, "Chào bạn! Crove Desk có thể giúp gì cho bạn?", "", operator)
	if err != nil {
		t.Fatalf("MessageService.SendAIMessage failed: %v", err)
	}

	outbox := ChannelMessageOutboxService.GetByMessageID(enums.ChannelTypeWhatsApp, replyMsg.ID)
	if outbox == nil {
		t.Fatalf("expected outbox entry for whatsapp message")
	}
	if outbox.ChannelType != enums.ChannelTypeWhatsApp {
		t.Fatalf("expected outbox channel type 'whatsapp', got %s", outbox.ChannelType)
	}
}

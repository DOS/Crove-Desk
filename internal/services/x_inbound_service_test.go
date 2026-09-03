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

func setupXTestDB(t *testing.T) *gorm.DB {
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
		t.Fatalf("migrate x test tables: %v", err)
	}
	sqls.SetDB(db)
	return db
}

func TestXInboundAndOutbound(t *testing.T) {
	db := setupXTestDB(t)

	now := time.Now()
	aiAgent := &models.AIAgent{
		Name:                "X Support AI",
		Status:              enums.StatusOk,
		PublishedRevisionID: 1,
		AuditFields:         models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(aiAgent).Error; err != nil {
		t.Fatalf("create ai agent: %v", err)
	}

	xConfig := dto.XChannelConfig{
		AccountID:        "12345678",
		Username:         "crovedesk",
		BearerToken:      "test_x_bearer_token",
		APISecretKey:     "test_api_secret_key",
		WebhookCRCSecret: "test_crc_secret",
	}
	cfgBytes, _ := json.Marshal(xConfig)

	channel := &models.Channel{
		ChannelType:           enums.ChannelTypeX,
		ChannelID:             "12345678",
		AIAgentID:             aiAgent.ID,
		AIAgentRolloutPercent: 100,
		Name:                  "X (Twitter) Channel",
		ConfigJSON:            string(cfgBytes),
		Status:                enums.StatusOk,
		AuditFields:           models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(channel).Error; err != nil {
		t.Fatalf("create x channel: %v", err)
	}

	// 1. Test CRC Response
	crcResp, err := XInboundService.HandleCRC(channel.ChannelID, "test_crc_token_123")
	if err != nil {
		t.Fatalf("HandleCRC failed: %v", err)
	}
	if crcResp == "" {
		t.Fatalf("expected non-empty crc response token")
	}

	// 2. Test Inbound Direct Message
	payload := `{
		"for_user_id": "12345678",
		"direct_message_events": [
			{
				"type": "message_create",
				"id": "dm_event_999",
				"created_timestamp": "1725260000000",
				"message_create": {
					"target": {
						"recipient_id": "12345678"
					},
					"sender_id": "87654321",
					"message_data": {
						"text": "How do I connect webhooks?"
					}
				}
			}
		]
	}`

	ctx := context.Background()
	err = XInboundService.HandleWebhook(ctx, "", "", []byte(payload))
	if err != nil {
		t.Fatalf("HandleWebhook failed: %v", err)
	}

	// Verify customer identity
	identity := repositories.CustomerIdentityRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceX).
		Eq("external_id", "87654321"))
	if identity == nil {
		t.Fatalf("expected customer identity for 87654321")
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
	if msg.Content != "How do I connect webhooks?" {
		t.Fatalf("expected message content 'How do I connect webhooks?', got %s", msg.Content)
	}

	operator := &dto.AuthPrincipal{UserID: 1, Nickname: "Agent Joy"}

	// Test Outbound enqueue
	replyMsg, err := MessageService.SendAIMessage(conv.ID, aiAgent.ID, "ai_x_reply_1", enums.IMMessageTypeText, "You can configure webhooks in Dashboard > Channels.", "", operator)
	if err != nil {
		t.Fatalf("MessageService.SendAIMessage failed: %v", err)
	}

	outbox := ChannelMessageOutboxService.GetByMessageID(enums.ChannelTypeX, replyMsg.ID)
	if outbox == nil {
		t.Fatalf("expected outbox entry for x message")
	}
	if outbox.ChannelType != enums.ChannelTypeX {
		t.Fatalf("expected outbox channel type 'x', got %s", outbox.ChannelType)
	}
}

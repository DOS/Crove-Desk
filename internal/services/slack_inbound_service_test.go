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

func setupSlackTestDB(t *testing.T) *gorm.DB {
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
		t.Fatalf("migrate slack test tables: %v", err)
	}
	sqls.SetDB(db)
	return db
}

func TestSlackInboundAndOutbound(t *testing.T) {
	db := setupSlackTestDB(t)

	now := time.Now()
	aiAgent := &models.AIAgent{
		Name:                "Slack Bot Agent",
		Status:              enums.StatusOk,
		PublishedRevisionID: 1,
		AuditFields:         models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(aiAgent).Error; err != nil {
		t.Fatalf("create ai agent: %v", err)
	}

	slackConfig := dto.SlackChannelConfig{
		BotToken:       "xoxb-test-bot-token-12345",
		SigningSecret:  "test_signing_secret_999",
		TeamID:         "T0123456789",
		TeamName:       "Acme Corp",
		DefaultChannel: "C9876543210",
	}
	cfgBytes, _ := json.Marshal(slackConfig)

	channel := &models.Channel{
		ChannelType:           enums.ChannelTypeSlack,
		ChannelID:             "T0123456789",
		AIAgentID:             aiAgent.ID,
		AIAgentRolloutPercent: 100,
		Name:                  "Slack Support Channel",
		ConfigJSON:            string(cfgBytes),
		Status:                enums.StatusOk,
		AuditFields:           models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(channel).Error; err != nil {
		t.Fatalf("create slack channel: %v", err)
	}

	payload := `{
		"token": "verification_token",
		"team_id": "T0123456789",
		"api_app_id": "A01234567",
		"type": "event_callback",
		"event": {
			"type": "message",
			"user": "U12345678",
			"text": "Help with API key generation",
			"ts": "1725260000.000200",
			"channel": "C9876543210",
			"channel_type": "channel"
		}
	}`

	ctx := context.Background()
	_, err := SlackInboundService.HandleWebhook(ctx, "", "", "", []byte(payload))
	if err != nil {
		t.Fatalf("HandleWebhook failed: %v", err)
	}

	// Verify customer identity
	identity := repositories.CustomerIdentityRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceSlack).
		Eq("external_id", "U12345678"))
	if identity == nil {
		t.Fatalf("expected customer identity for U12345678")
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
	if msg.Content != "Help with API key generation" {
		t.Fatalf("expected message content 'Help with API key generation', got %s", msg.Content)
	}

	operator := &dto.AuthPrincipal{UserID: 1, Nickname: "Agent Joy"}

	// Test Outbound enqueue
	replyMsg, err := MessageService.SendAIMessage(conv.ID, aiAgent.ID, "ai_slack_reply_1", enums.IMMessageTypeText, "You can generate your API key under Settings > API Keys.", "", operator)
	if err != nil {
		t.Fatalf("MessageService.SendAIMessage failed: %v", err)
	}

	outbox := ChannelMessageOutboxService.GetByMessageID(enums.ChannelTypeSlack, replyMsg.ID)
	if outbox == nil {
		t.Fatalf("expected outbox entry for slack message")
	}
	if outbox.ChannelType != enums.ChannelTypeSlack {
		t.Fatalf("expected outbox channel type 'slack', got %s", outbox.ChannelType)
	}
}

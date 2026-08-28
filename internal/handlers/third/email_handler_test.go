package third

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/repositories"
	"agent-desk/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/mlogclub/simple/sqls"
)

func TestEmailPostWebhook_FullFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupThirdHandlerTestDB(t)

	now := time.Now()
	agent := &models.AIAgent{
		Name:                "Email Support Agent",
		ServiceMode:         enums.IMConversationServiceModeAIFirst,
		PublishedRevisionID: 1,
		WelcomeMessage:      "Thanks for emailing support.",
		Status:              enums.StatusOk,
		AuditFields:         models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	_ = db.Create(agent)

	emailConfig, _ := json.Marshal(dto.EmailChannelConfig{
		EmailAddress:   "help@crove.com",
		SenderName:     "Crove Desk Support",
		Provider:       "brevo",
		WebhookSecret:  "email_secret_token_123",
		WelcomeMessage: "We have received your email.",
	})

	operator := &dto.AuthPrincipal{UserID: 1, Username: "admin"}
	channel, err := services.ChannelService.CreateChannel(request.CreateChannelRequest{
		Name:                  "Email Support Channel",
		ChannelType:           enums.ChannelTypeEmail,
		AIAgentID:             agent.ID,
		AIAgentRolloutPercent: 100,
		ConfigJSON:            string(emailConfig),
		Status:                int(enums.StatusOk),
	}, operator)
	if err != nil {
		t.Fatalf("CreateChannel failed: %v", err)
	}

	router := gin.New()
	router.POST("/api/third/email/webhook/:channel_id", EmailPostWebhook)
	router.POST("/api/third/email/webhook", EmailPostWebhook)

	// 1. Test unauthorized when secret doesn't match
	genericPayload := []byte(`{
		"from": "alice@customer.com",
		"from_name": "Alice Customer",
		"to": "help@crove.com",
		"subject": "Need help with Crove Desk",
		"text": "Hello, I have an issue with my login credentials.",
		"message_id": "<msg-001@mail.customer.com>"
	}`)

	req, _ := http.NewRequest(http.MethodPost, "/api/third/email/webhook/"+channel.ChannelID, bytes.NewBuffer(genericPayload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Webhook-Secret", "wrong_secret")

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK wrapper, got: %d", rec.Code)
	}
	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp["ok"] != false {
		t.Fatalf("expected ok: false on wrong secret token, got: %v", resp)
	}

	// 2. Test successful processing with Generic payload
	req2, _ := http.NewRequest(http.MethodPost, "/api/third/email/webhook/"+channel.ChannelID, bytes.NewBuffer(genericPayload))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("X-Webhook-Secret", "email_secret_token_123")

	rec2 := httptest.NewRecorder()
	router.ServeHTTP(rec2, req2)

	var resp2 map[string]any
	_ = json.Unmarshal(rec2.Body.Bytes(), &resp2)
	if resp2["ok"] != true {
		t.Fatalf("expected ok: true, got: %v", resp2)
	}

	// Verify Customer was created with Email source
	identity := repositories.CustomerIdentityRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceEmail).
		Eq("external_id", "alice@customer.com"))
	if identity == nil {
		t.Fatalf("expected customer identity for alice@customer.com to be created")
	}

	customer := repositories.CustomerRepository.Get(sqls.DB(), identity.CustomerID)
	if customer == nil || customer.PrimaryEmail != "alice@customer.com" {
		t.Fatalf("expected customer primary_email 'alice@customer.com', got %+v", customer)
	}

	// Verify Conversation was created
	conversations := repositories.ConversationRepository.Find(sqls.DB(), sqls.NewCnd().
		Eq("customer_id", customer.ID).
		Eq("channel_id", channel.ID))
	if len(conversations) == 0 {
		t.Fatalf("expected conversation to be created")
	}

	// Verify Message was saved
	messages := repositories.MessageRepository.Find(sqls.DB(), sqls.NewCnd().
		Eq("conversation_id", conversations[0].ID))
	if len(messages) == 0 {
		t.Fatalf("expected message to be stored")
	}

	// 3. Test Brevo Inbound payload format
	brevoPayload := []byte(`{
		"items": [
			{
				"Uuid": ["brevo-uuid-999"],
				"Sender": "Bob Smith <bob@partner.org>",
				"Recipient": "help@crove.com",
				"Subject": "Enterprise Inquiry",
				"RawTextBody": "We would like to request enterprise support pricing."
			}
		]
	}`)

	req3, _ := http.NewRequest(http.MethodPost, "/api/third/email/webhook", bytes.NewBuffer(brevoPayload))
	req3.Header.Set("Content-Type", "application/json")
	req3.Header.Set("X-Webhook-Secret", "email_secret_token_123")

	rec3 := httptest.NewRecorder()
	router.ServeHTTP(rec3, req3)

	var resp3 map[string]any
	_ = json.Unmarshal(rec3.Body.Bytes(), &resp3)
	if resp3["ok"] != true {
		t.Fatalf("expected brevo format ok: true, got: %v", resp3)
	}

	bobIdentity := repositories.CustomerIdentityRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceEmail).
		Eq("external_id", "bob@partner.org"))
	if bobIdentity == nil {
		t.Fatalf("expected customer identity for bob@partner.org")
	}
}

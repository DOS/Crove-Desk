package third

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
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

// whatsAppTestSecret is the Meta App Secret the test channel is configured with.
const whatsAppTestSecret = "wa_app_secret_test_123"

// signWhatsAppTestPayload builds the X-Hub-Signature-256 value Meta would send.
func signWhatsAppTestPayload(payload []byte) string {
	mac := hmac.New(sha256.New, []byte(whatsAppTestSecret))
	mac.Write(payload)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func TestWhatsAppWebhook_Handler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupThirdHandlerTestDB(t)

	now := time.Now()
	agent := &models.AIAgent{
		Name:                "WhatsApp Agent",
		ServiceMode:         enums.IMConversationServiceModeAIFirst,
		PublishedRevisionID: 1,
		WelcomeMessage:      "Hello WhatsApp User!",
		Status:              enums.StatusOk,
		AuditFields:         models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	_ = db.Create(agent)

	waConfig, _ := json.Marshal(dto.WhatsAppChannelConfig{
		PhoneNumberID:      "phone_112233",
		WABAID:             "waba_445566",
		AccessToken:        "test_wa_token",
		WebhookVerifyToken: "my_wa_verify_token_999",
		AppSecret:          whatsAppTestSecret,
	})

	operator := &dto.AuthPrincipal{UserID: 1, Username: "admin"}
	channel, err := services.ChannelService.CreateChannel(request.CreateChannelRequest{
		Name:                  "WhatsApp Support",
		ChannelType:           enums.ChannelTypeWhatsApp,
		AIAgentID:             agent.ID,
		AIAgentRolloutPercent: 100,
		ConfigJSON:            string(waConfig),
		Status:                int(enums.StatusOk),
	}, operator)
	if err != nil {
		t.Fatalf("CreateChannel failed: %v", err)
	}

	router := gin.New()
	router.GET("/api/third/whatsapp/webhook/:channel_id", WhatsAppGetWebhook)
	router.GET("/api/third/whatsapp/webhook", WhatsAppGetWebhook)
	router.POST("/api/third/whatsapp/webhook/:channel_id", WhatsAppPostWebhook)
	router.POST("/api/third/whatsapp/webhook", WhatsAppPostWebhook)

	// 1. GET Verification Challenge
	reqGet, _ := http.NewRequest(http.MethodGet, "/api/third/whatsapp/webhook/"+channel.ChannelID+"?hub.mode=subscribe&hub.verify_token=my_wa_verify_token_999&hub.challenge=wa_challenge_code", nil)
	recGet := httptest.NewRecorder()
	router.ServeHTTP(recGet, reqGet)

	if recGet.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for challenge, got: %d", recGet.Code)
	}
	if recGet.Body.String() != "wa_challenge_code" {
		t.Fatalf("expected challenge code in body, got: %s", recGet.Body.String())
	}

	// 2. POST Inbound Message
	payload := []byte(`{
		"object": "whatsapp_business_account",
		"entry": [
			{
				"id": "waba_445566",
				"changes": [
					{
						"field": "messages",
						"value": {
							"messaging_product": "whatsapp",
							"metadata": {
								"phone_number_id": "phone_112233"
							},
							"contacts": [
								{
									"profile": { "name": "Customer John" },
									"wa_id": "1234567890"
								}
							],
							"messages": [
								{
									"from": "1234567890",
									"id": "wamid_001",
									"timestamp": "1725260000",
									"type": "text",
									"text": { "body": "Need pricing details" }
								}
							]
						}
					}
				]
			}
		]
	}`)

	// 2. An unsigned POST must be rejected. Accepting it would let anyone who
	// learns the webhook URL write into a customer conversation.
	reqUnsigned, _ := http.NewRequest(http.MethodPost, "/api/third/whatsapp/webhook/"+channel.ChannelID, bytes.NewBuffer(payload))
	reqUnsigned.Header.Set("Content-Type", "application/json")
	recUnsigned := httptest.NewRecorder()
	router.ServeHTTP(recUnsigned, reqUnsigned)

	if recUnsigned.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for an unsigned POST webhook, got: %d", recUnsigned.Code)
	}
	if unsigned := repositories.CustomerIdentityRepository.FindOne(db, sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceWhatsApp).
		Eq("external_id", "1234567890")); unsigned != nil {
		t.Fatalf("the unsigned webhook created a customer identity")
	}

	// 3. A correctly signed POST is accepted.
	reqPost, _ := http.NewRequest(http.MethodPost, "/api/third/whatsapp/webhook/"+channel.ChannelID, bytes.NewBuffer(payload))
	reqPost.Header.Set("Content-Type", "application/json")
	reqPost.Header.Set("X-Hub-Signature-256", signWhatsAppTestPayload(payload))
	recPost := httptest.NewRecorder()
	router.ServeHTTP(recPost, reqPost)

	if recPost.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for POST webhook, got: %d (body: %s)", recPost.Code, recPost.Body.String())
	}

	// Verify identity in DB
	identity := repositories.CustomerIdentityRepository.FindOne(db, sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceWhatsApp).
		Eq("external_id", "1234567890"))
	if identity == nil {
		t.Fatalf("expected customer identity for 1234567890")
	}
}

func TestSlackWebhook_Handler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupThirdHandlerTestDB(t)

	now := time.Now()
	agent := &models.AIAgent{
		Name:                "Slack Agent",
		ServiceMode:         enums.IMConversationServiceModeAIFirst,
		PublishedRevisionID: 1,
		WelcomeMessage:      "Hello Slack User!",
		Status:              enums.StatusOk,
		AuditFields:         models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	_ = db.Create(agent)

	slackConfig, _ := json.Marshal(dto.SlackChannelConfig{
		BotToken:       "xoxb-test-token",
		SigningSecret:  "test_signing_secret",
		TeamID:         "T_SLACK_100",
		DefaultChannel: "C_GENERAL",
	})

	operator := &dto.AuthPrincipal{UserID: 1, Username: "admin"}
	channel, err := services.ChannelService.CreateChannel(request.CreateChannelRequest{
		Name:                  "Slack Channel",
		ChannelType:           enums.ChannelTypeSlack,
		AIAgentID:             agent.ID,
		AIAgentRolloutPercent: 100,
		ConfigJSON:            string(slackConfig),
		Status:                int(enums.StatusOk),
	}, operator)
	if err != nil {
		t.Fatalf("CreateChannel failed: %v", err)
	}

	router := gin.New()
	router.POST("/api/third/slack/webhook/:channel_id", SlackPostWebhook)
	router.POST("/api/third/slack/webhook", SlackPostWebhook)

	// 1. URL Verification
	challengePayload := []byte(`{
		"token": "token123",
		"challenge": "slack_challenge_string_999",
		"type": "url_verification"
	}`)
	reqChallenge, _ := http.NewRequest(http.MethodPost, "/api/third/slack/webhook/"+channel.ChannelID, bytes.NewBuffer(challengePayload))
	reqChallenge.Header.Set("Content-Type", "application/json")
	recChallenge := httptest.NewRecorder()
	router.ServeHTTP(recChallenge, reqChallenge)

	if recChallenge.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for challenge, got: %d", recChallenge.Code)
	}
	var challengeResp map[string]any
	_ = json.Unmarshal(recChallenge.Body.Bytes(), &challengeResp)
	if challengeResp["challenge"] != "slack_challenge_string_999" {
		t.Fatalf("expected challenge in body, got: %+v", challengeResp)
	}

	// 2. Event Callback
	eventPayload := []byte(`{
		"token": "token123",
		"team_id": "T_SLACK_100",
		"type": "event_callback",
		"event": {
			"type": "message",
			"user": "U_USER_777",
			"text": "Hello support team on Slack!",
			"ts": "1725260000.000100",
			"channel": "C_GENERAL"
		}
	}`)
	reqEvent, _ := http.NewRequest(http.MethodPost, "/api/third/slack/webhook/"+channel.ChannelID, bytes.NewBuffer(eventPayload))
	reqEvent.Header.Set("Content-Type", "application/json")
	recEvent := httptest.NewRecorder()
	router.ServeHTTP(recEvent, reqEvent)

	if recEvent.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for event, got: %d", recEvent.Code)
	}

	// Verify identity
	identity := repositories.CustomerIdentityRepository.FindOne(db, sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceSlack).
		Eq("external_id", "U_USER_777"))
	if identity == nil {
		t.Fatalf("expected customer identity for U_USER_777")
	}
}

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

func TestMessengerWebhook_Handler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupThirdHandlerTestDB(t)

	now := time.Now()
	agent := &models.AIAgent{
		Name:                "Messenger Agent",
		ServiceMode:         enums.IMConversationServiceModeAIFirst,
		PublishedRevisionID: 1,
		WelcomeMessage:      "Hello Messenger!",
		Status:              enums.StatusOk,
		AuditFields:         models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	_ = db.Create(agent)

	messengerConfig, _ := json.Marshal(dto.MessengerChannelConfig{
		PageID:             "page_888",
		PageName:           "Official FB Page",
		PageAccessToken:    "test_page_access_token",
		WebhookVerifyToken: "my_verify_token_456",
		WelcomeMessage:     "Welcome to FB support!",
	})

	operator := &dto.AuthPrincipal{UserID: 1, Username: "admin"}
	channel, err := services.ChannelService.CreateChannel(request.CreateChannelRequest{
		Name:                  "FB Messenger Channel",
		ChannelType:           enums.ChannelTypeMessenger,
		AIAgentID:             agent.ID,
		AIAgentRolloutPercent: 100,
		ConfigJSON:            string(messengerConfig),
		Status:                int(enums.StatusOk),
	}, operator)
	if err != nil {
		t.Fatalf("CreateChannel failed: %v", err)
	}

	router := gin.New()
	router.GET("/api/third/messenger/webhook/:channel_id", MessengerGetWebhook)
	router.GET("/api/third/messenger/webhook", MessengerGetWebhook)
	router.POST("/api/third/messenger/webhook/:channel_id", MessengerPostWebhook)
	router.POST("/api/third/messenger/webhook", MessengerPostWebhook)

	// 1. Test GET Verification Challenge Success
	reqGet, _ := http.NewRequest(http.MethodGet, "/api/third/messenger/webhook/"+channel.ChannelID+"?hub.mode=subscribe&hub.verify_token=my_verify_token_456&hub.challenge=challenge_code_12345", nil)
	recGet := httptest.NewRecorder()
	router.ServeHTTP(recGet, reqGet)

	if recGet.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for challenge, got: %d", recGet.Code)
	}
	if recGet.Body.String() != "challenge_code_12345" {
		t.Fatalf("expected challenge code in body, got: %s", recGet.Body.String())
	}

	// 2. Test GET Verification Challenge Mismatch
	reqGetBad, _ := http.NewRequest(http.MethodGet, "/api/third/messenger/webhook/"+channel.ChannelID+"?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=challenge_code_12345", nil)
	recGetBad := httptest.NewRecorder()
	router.ServeHTTP(recGetBad, reqGetBad)

	if recGetBad.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for wrong token, got: %d", recGetBad.Code)
	}

	// 3. Test POST Inbound Message
	payload := []byte(`{
		"object": "page",
		"entry": [
			{
				"id": "page_888",
				"time": 1725260000,
				"messaging": [
					{
						"sender": {"id": "psid_999000"},
						"recipient": {"id": "page_888"},
						"timestamp": 1725260000,
						"message": {
							"mid": "mid_112233",
							"text": "Hello Meta Support!"
						}
					}
				]
			}
		]
	}`)

	reqPost, _ := http.NewRequest(http.MethodPost, "/api/third/messenger/webhook/"+channel.ChannelID, bytes.NewBuffer(payload))
	reqPost.Header.Set("Content-Type", "application/json")
	recPost := httptest.NewRecorder()
	router.ServeHTTP(recPost, reqPost)

	if recPost.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for POST webhook, got: %d", recPost.Code)
	}

	// Verify identity in DB
	identity := repositories.CustomerIdentityRepository.FindOne(db, sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceMessenger).
		Eq("external_id", "psid_999000"))
	if identity == nil {
		t.Fatalf("expected customer identity for psid_999000")
	}
}

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

func TestInstagramWebhook_Handler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupThirdHandlerTestDB(t)

	now := time.Now()
	agent := &models.AIAgent{
		Name:                "Instagram Agent",
		ServiceMode:         enums.IMConversationServiceModeAIFirst,
		PublishedRevisionID: 1,
		WelcomeMessage:      "Hello Instagram User!",
		Status:              enums.StatusOk,
		AuditFields:         models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	_ = db.Create(agent)

	instagramConfig, _ := json.Marshal(dto.InstagramChannelConfig{
		InstagramID:        "ig_page_999",
		InstagramUsername:  "shop_official",
		PageAccessToken:    "test_ig_page_access_token",
		WebhookVerifyToken: "my_verify_token_ig_123",
		WelcomeMessage:     "Welcome to Instagram support!",
	})

	operator := &dto.AuthPrincipal{UserID: 1, Username: "admin"}
	channel, err := services.ChannelService.CreateChannel(request.CreateChannelRequest{
		Name:                  "Instagram Shop Channel",
		ChannelType:           enums.ChannelTypeInstagram,
		AIAgentID:             agent.ID,
		AIAgentRolloutPercent: 100,
		ConfigJSON:            string(instagramConfig),
		Status:                int(enums.StatusOk),
	}, operator)
	if err != nil {
		t.Fatalf("CreateChannel failed: %v", err)
	}

	router := gin.New()
	router.GET("/api/third/instagram/webhook/:channel_id", InstagramGetWebhook)
	router.GET("/api/third/instagram/webhook", InstagramGetWebhook)
	router.POST("/api/third/instagram/webhook/:channel_id", InstagramPostWebhook)
	router.POST("/api/third/instagram/webhook", InstagramPostWebhook)

	// 1. Test GET Verification Challenge Success
	reqGet, _ := http.NewRequest(http.MethodGet, "/api/third/instagram/webhook/"+channel.ChannelID+"?hub.mode=subscribe&hub.verify_token=my_verify_token_ig_123&hub.challenge=challenge_instagram_777", nil)
	recGet := httptest.NewRecorder()
	router.ServeHTTP(recGet, reqGet)

	if recGet.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for challenge, got: %d", recGet.Code)
	}
	if recGet.Body.String() != "challenge_instagram_777" {
		t.Fatalf("expected challenge code in body, got: %s", recGet.Body.String())
	}

	// 2. Test GET Verification Challenge Mismatch
	reqGetBad, _ := http.NewRequest(http.MethodGet, "/api/third/instagram/webhook/"+channel.ChannelID+"?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=challenge_instagram_777", nil)
	recGetBad := httptest.NewRecorder()
	router.ServeHTTP(recGetBad, reqGetBad)

	if recGetBad.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for wrong token, got: %d", recGetBad.Code)
	}

	// 3. Test POST Inbound Message
	payload := []byte(`{
		"object": "instagram",
		"entry": [
			{
				"id": "ig_page_999",
				"time": 1725260000,
				"messaging": [
					{
						"sender": {"id": "igsid_customer_456"},
						"recipient": {"id": "ig_page_999"},
						"timestamp": 1725260000,
						"message": {
							"mid": "mid_ig_msg_888",
							"text": "How can I track my order?"
						}
					}
				]
			}
		]
	}`)

	reqPost, _ := http.NewRequest(http.MethodPost, "/api/third/instagram/webhook/"+channel.ChannelID, bytes.NewBuffer(payload))
	reqPost.Header.Set("Content-Type", "application/json")
	recPost := httptest.NewRecorder()
	router.ServeHTTP(recPost, reqPost)

	if recPost.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for POST webhook, got: %d", recPost.Code)
	}

	// Verify identity in DB
	identity := repositories.CustomerIdentityRepository.FindOne(db, sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceInstagram).
		Eq("external_id", "igsid_customer_456"))
	if identity == nil {
		t.Fatalf("expected customer identity for igsid_customer_456")
	}
}

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

func TestXWebhook_Handler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupThirdHandlerTestDB(t)

	now := time.Now()
	agent := &models.AIAgent{
		Name:                "X Agent",
		ServiceMode:         enums.IMConversationServiceModeAIFirst,
		PublishedRevisionID: 1,
		WelcomeMessage:      "Hello X User!",
		Status:              enums.StatusOk,
		AuditFields:         models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	_ = db.Create(agent)

	xConfig, _ := json.Marshal(dto.XChannelConfig{
		AccountID:        "x_user_999",
		Username:         "x_brand",
		BearerToken:      "test_x_bearer",
		APISecretKey:     "test_consumer_secret",
		WebhookCRCSecret: "test_consumer_secret",
	})

	operator := &dto.AuthPrincipal{UserID: 1, Username: "admin"}
	channel, err := services.ChannelService.CreateChannel(request.CreateChannelRequest{
		Name:                  "X (Twitter) Channel",
		ChannelType:           enums.ChannelTypeX,
		AIAgentID:             agent.ID,
		AIAgentRolloutPercent: 100,
		ConfigJSON:            string(xConfig),
		Status:                int(enums.StatusOk),
	}, operator)
	if err != nil {
		t.Fatalf("CreateChannel failed: %v", err)
	}

	router := gin.New()
	router.GET("/api/third/x/webhook/:channel_id", XGetWebhook)
	router.GET("/api/third/x/webhook", XGetWebhook)
	router.POST("/api/third/x/webhook/:channel_id", XPostWebhook)
	router.POST("/api/third/x/webhook", XPostWebhook)

	// 1. Test GET CRC
	reqGet, _ := http.NewRequest(http.MethodGet, "/api/third/x/webhook/"+channel.ChannelID+"?crc_token=test_crc_12345", nil)
	recGet := httptest.NewRecorder()
	router.ServeHTTP(recGet, reqGet)

	if recGet.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for CRC, got: %d", recGet.Code)
	}
	var crcResp map[string]any
	_ = json.Unmarshal(recGet.Body.Bytes(), &crcResp)
	if crcResp["response_token"] == nil || crcResp["response_token"] == "" {
		t.Fatalf("expected response_token in body, got: %+v", crcResp)
	}

	// 2. Test POST Inbound DM
	payload := []byte(`{
		"for_user_id": "x_user_999",
		"direct_message_events": [
			{
				"type": "message_create",
				"id": "dm_evt_112233",
				"created_timestamp": "1725260000000",
				"message_create": {
					"target": { "recipient_id": "x_user_999" },
					"sender_id": "cust_uid_888",
					"message_data": { "text": "Need help with X integration" }
				}
			}
		]
	}`)

	reqPost, _ := http.NewRequest(http.MethodPost, "/api/third/x/webhook/"+channel.ChannelID, bytes.NewBuffer(payload))
	reqPost.Header.Set("Content-Type", "application/json")
	recPost := httptest.NewRecorder()
	router.ServeHTTP(recPost, reqPost)

	if recPost.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for POST webhook, got: %d", recPost.Code)
	}

	// Verify identity in DB
	identity := repositories.CustomerIdentityRepository.FindOne(db, sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceX).
		Eq("external_id", "cust_uid_888"))
	if identity == nil {
		t.Fatalf("expected customer identity for cust_uid_888")
	}
}

func TestTikTokWebhook_Handler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupThirdHandlerTestDB(t)

	now := time.Now()
	agent := &models.AIAgent{
		Name:                "TikTok Agent",
		ServiceMode:         enums.IMConversationServiceModeAIFirst,
		PublishedRevisionID: 1,
		WelcomeMessage:      "Hello TikTok User!",
		Status:              enums.StatusOk,
		AuditFields:         models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	_ = db.Create(agent)

	tiktokConfig, _ := json.Marshal(dto.TikTokChannelConfig{
		ClientKey:          "client_key_123",
		ClientSecret:       "client_secret_456",
		OpenID:             "tt_open_888",
		AccessToken:        "tt_token_789",
		WebhookVerifyToken: "tt_verify_secret_999",
	})

	operator := &dto.AuthPrincipal{UserID: 1, Username: "admin"}
	channel, err := services.ChannelService.CreateChannel(request.CreateChannelRequest{
		Name:                  "TikTok Support",
		ChannelType:           enums.ChannelTypeTikTok,
		AIAgentID:             agent.ID,
		AIAgentRolloutPercent: 100,
		ConfigJSON:            string(tiktokConfig),
		Status:                int(enums.StatusOk),
	}, operator)
	if err != nil {
		t.Fatalf("CreateChannel failed: %v", err)
	}

	router := gin.New()
	router.GET("/api/third/tiktok/webhook/:channel_id", TikTokGetWebhook)
	router.GET("/api/third/tiktok/webhook", TikTokGetWebhook)
	router.POST("/api/third/tiktok/webhook/:channel_id", TikTokPostWebhook)
	router.POST("/api/third/tiktok/webhook", TikTokPostWebhook)

	// 1. Test GET challenge
	reqGet, _ := http.NewRequest(http.MethodGet, "/api/third/tiktok/webhook/"+channel.ChannelID+"?challenge=tiktok_challenge_code", nil)
	recGet := httptest.NewRecorder()
	router.ServeHTTP(recGet, reqGet)

	if recGet.Code != http.StatusOK || recGet.Body.String() != "tiktok_challenge_code" {
		t.Fatalf("expected 200 OK with challenge, got code %d body %s", recGet.Code, recGet.Body.String())
	}

	// 2. Test POST Inbound Message
	payload := []byte(`{
		"event": "message_create",
		"event_id": "tt_evt_9988",
		"from_user_id": "tt_cust_777",
		"to_user_id": "tt_open_888",
		"create_time": 1725260000,
		"content": "Can I return an item?"
	}`)

	reqPost, _ := http.NewRequest(http.MethodPost, "/api/third/tiktok/webhook/"+channel.ChannelID, bytes.NewBuffer(payload))
	reqPost.Header.Set("Content-Type", "application/json")
	reqPost.Header.Set("X-Tiktok-Verify-Token", "tt_verify_secret_999")
	recPost := httptest.NewRecorder()
	router.ServeHTTP(recPost, reqPost)

	if recPost.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for POST webhook, got: %d", recPost.Code)
	}

	// Verify identity
	identity := repositories.CustomerIdentityRepository.FindOne(db, sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceTikTok).
		Eq("external_id", "tt_cust_777"))
	if identity == nil {
		t.Fatalf("expected customer identity for tt_cust_777")
	}
}

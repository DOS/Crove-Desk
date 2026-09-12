package services

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/config"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/whatsapp"
)

// newGraphStub returns an httptest server that answers the WhatsApp connect flow
// with a single business, a single WABA and a single sender number.
func newGraphStub(t *testing.T, accessToken string) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()

	mux.HandleFunc("/oauth/access_token", func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Query().Get("code"); got != "auth-code-1" {
			t.Errorf("code = %q, want auth-code-1", got)
		}
		if got := r.URL.Query().Get("client_id"); got != "app-1" {
			t.Errorf("client_id = %q, want app-1", got)
		}
		if got := r.URL.Query().Get("client_secret"); got != "secret-1" {
			t.Errorf("client_secret = %q, want secret-1", got)
		}
		writeJSONStub(w, map[string]any{
			"access_token": accessToken,
			"token_type":   "bearer",
			"expires_in":   5184000,
		})
	})

	mux.HandleFunc("/debug_token", func(w http.ResponseWriter, r *http.Request) {
		writeJSONStub(w, map[string]any{
			"data": map[string]any{
				"app_id":     "app-1",
				"type":       "USER",
				"is_valid":   true,
				"expires_at": 1893456000,
				"scopes":     []string{"whatsapp_business_management", "whatsapp_business_messaging"},
				"user_id":    "user-1",
			},
		})
	})

	mux.HandleFunc("/me/businesses", func(w http.ResponseWriter, r *http.Request) {
		writeJSONStub(w, map[string]any{
			"data": []map[string]any{{"id": "biz-1", "name": "Crove Business"}},
		})
	})

	mux.HandleFunc("/biz-1/owned_whatsapp_business_accounts", func(w http.ResponseWriter, r *http.Request) {
		writeJSONStub(w, map[string]any{
			"data": []map[string]any{{"id": "waba-1", "name": "Crove WABA"}},
		})
	})

	mux.HandleFunc("/waba-1/phone_numbers", func(w http.ResponseWriter, r *http.Request) {
		writeJSONStub(w, map[string]any{
			"data": []map[string]any{{
				"id":                       "phone-1",
				"display_phone_number":     "+1 555 026 9999",
				"verified_name":            "Crove Desk",
				"quality_rating":           "GREEN",
				"code_verification_status": "VERIFIED",
			}},
		})
	})

	return httptest.NewServer(mux)
}

func writeJSONStub(w http.ResponseWriter, body any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(body)
}

// stubWhatsAppOAuthClient points the connect flow at a local stub and returns a
// restore func.
func stubWhatsAppOAuthClient(server *httptest.Server) func() {
	previous := newWhatsAppOAuthClient
	newWhatsAppOAuthClient = func(accessToken string) *whatsapp.Client {
		client := whatsapp.NewClient(accessToken)
		client.SetBaseURL(server.URL)
		client.SetHTTPClient(server.Client())
		return client
	}
	return func() { newWhatsAppOAuthClient = previous }
}

// setMetaAppCredentials installs the Meta app credentials the connect flow reads
// and restores whatever was configured before.
func setMetaAppCredentials(t *testing.T, appID, appSecret string) {
	t.Helper()
	previous := config.GetCurrent()
	cfg := &config.Config{}
	if previous != nil {
		*cfg = *previous
	}
	cfg.Messenger.AppID = appID
	cfg.Messenger.AppSecret = appSecret
	config.SetCurrent(cfg)
	t.Cleanup(func() { config.SetCurrent(previous) })
}

func TestWhatsAppOAuthConnectPersistsCredentials(t *testing.T) {
	db := setupWhatsAppTestDB(t)
	channel := seedWhatsAppChannel(t, db, whatsAppTestAppSecret)
	setMetaAppCredentials(t, "app-1", "secret-1")

	server := newGraphStub(t, "EAAtest-business-token")
	defer server.Close()
	defer stubWhatsAppOAuthClient(server)()

	operator := &dto.AuthPrincipal{UserID: 7, Username: "joy"}
	result, err := WhatsAppOAuthService.Connect(request.WhatsAppOAuthCallbackRequest{
		Code:      "auth-code-1",
		ChannelID: channel.ID,
		State:     "crove_whatsapp_connect:1",
	}, "en-US", operator)
	if err != nil {
		t.Fatalf("Connect failed: %v", err)
	}

	if !result.Connected {
		t.Errorf("Connected = false, want true")
	}
	if result.ChannelID != channel.ID {
		t.Errorf("ChannelID = %d, want %d", result.ChannelID, channel.ID)
	}
	if result.AccessToken != "EAAtest-business-token" {
		t.Errorf("AccessToken = %q, want the exchanged token", result.AccessToken)
	}
	if result.WabaID != "waba-1" || result.PhoneNumberID != "phone-1" {
		t.Errorf("discovered waba=%q phone=%q, want waba-1/phone-1", result.WabaID, result.PhoneNumberID)
	}
	if len(result.Accounts) != 1 || len(result.Accounts[0].PhoneNumbers) != 1 {
		t.Fatalf("accounts = %+v, want one account with one phone number", result.Accounts)
	}
	if len(result.Warnings) != 0 {
		t.Errorf("unexpected warnings: %v", result.Warnings)
	}
	if strings.Contains(result.TokenMasked, "business-token") {
		t.Errorf("TokenMasked = %q leaks the token", result.TokenMasked)
	}

	saved := ChannelService.Get(channel.ID)
	if saved == nil {
		t.Fatalf("channel %d disappeared", channel.ID)
	}
	cfg, err := ChannelService.ParseWhatsAppChannelConfig(saved.ConfigJSON)
	if err != nil {
		t.Fatalf("parse saved config: %v", err)
	}
	if cfg.AccessToken != "EAAtest-business-token" {
		t.Errorf("saved access token = %q", cfg.AccessToken)
	}
	if cfg.WABAID != "waba-1" {
		t.Errorf("saved waba id = %q, want waba-1", cfg.WABAID)
	}
	if cfg.PhoneNumberID != "phone-1" {
		t.Errorf("saved phone number id = %q, want phone-1", cfg.PhoneNumberID)
	}
	// The webhook verify token was already set and must survive the merge, or the
	// existing Meta webhook subscription would stop verifying.
	if cfg.WebhookVerifyToken != "verify_token_wa_123" {
		t.Errorf("webhook verify token = %q, want it preserved", cfg.WebhookVerifyToken)
	}
	if saved.UpdateUserName != "joy" {
		t.Errorf("update_user_name = %q, want the operator", saved.UpdateUserName)
	}
}

func TestWhatsAppOAuthConnectRequiresAppCredentials(t *testing.T) {
	db := setupWhatsAppTestDB(t)
	channel := seedWhatsAppChannel(t, db, whatsAppTestAppSecret)
	setMetaAppCredentials(t, "", "")

	operator := &dto.AuthPrincipal{UserID: 7, Username: "joy"}
	_, err := WhatsAppOAuthService.Connect(request.WhatsAppOAuthCallbackRequest{
		Code:      "auth-code-1",
		ChannelID: channel.ID,
	}, "en-US", operator)
	if err == nil {
		t.Fatalf("expected an error when the Meta app credentials are missing")
	}
	if i18nErrorKey(t, err) != "error.e0351" {
		t.Fatalf("error = %v, want error.e0351", err)
	}

	// The channel must be untouched.
	saved := ChannelService.Get(channel.ID)
	cfg, parseErr := ChannelService.ParseWhatsAppChannelConfig(saved.ConfigJSON)
	if parseErr != nil {
		t.Fatalf("parse config: %v", parseErr)
	}
	if cfg.AccessToken != "test_wa_access_token" {
		t.Errorf("access token was modified to %q", cfg.AccessToken)
	}
}

func TestWhatsAppOAuthConnectReportsFailedExchange(t *testing.T) {
	db := setupWhatsAppTestDB(t)
	channel := seedWhatsAppChannel(t, db, whatsAppTestAppSecret)
	setMetaAppCredentials(t, "app-1", "secret-1")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		writeJSONStub(w, map[string]any{
			"error": map[string]any{
				"message": "Error validating verification code.",
				"type":    "OAuthException",
				"code":    100,
			},
		})
	}))
	defer server.Close()
	defer stubWhatsAppOAuthClient(server)()

	operator := &dto.AuthPrincipal{UserID: 7, Username: "joy"}
	_, err := WhatsAppOAuthService.Connect(request.WhatsAppOAuthCallbackRequest{
		Code:      "auth-code-1",
		ChannelID: channel.ID,
	}, "en-US", operator)
	if err == nil {
		t.Fatalf("expected the failed exchange to surface as an error")
	}
	if !strings.Contains(err.Error(), "verification code") {
		t.Errorf("error = %v, want Meta's reason to be carried through", err)
	}

	// A failed exchange must not write credentials onto the channel.
	saved := ChannelService.Get(channel.ID)
	cfg, parseErr := ChannelService.ParseWhatsAppChannelConfig(saved.ConfigJSON)
	if parseErr != nil {
		t.Fatalf("parse config: %v", parseErr)
	}
	if cfg.AccessToken != "test_wa_access_token" {
		t.Errorf("access token was modified to %q", cfg.AccessToken)
	}
}

// A business token from Embedded Signup often cannot enumerate the business
// portfolio. The token is still usable, so discovery failure must degrade to a
// warning instead of failing the connect.
func TestWhatsAppOAuthConnectToleratesDiscoveryFailure(t *testing.T) {
	db := setupWhatsAppTestDB(t)
	channel := seedWhatsAppChannel(t, db, whatsAppTestAppSecret)
	setMetaAppCredentials(t, "app-1", "secret-1")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/oauth/access_token"):
			writeJSONStub(w, map[string]any{"access_token": "EAAtest-business-token", "token_type": "bearer"})
		default:
			w.WriteHeader(http.StatusForbidden)
			writeJSONStub(w, map[string]any{
				"error": map[string]any{"message": "(#200) Requires business_management", "code": 200},
			})
		}
	}))
	defer server.Close()
	defer stubWhatsAppOAuthClient(server)()

	operator := &dto.AuthPrincipal{UserID: 7, Username: "joy"}
	result, err := WhatsAppOAuthService.Connect(request.WhatsAppOAuthCallbackRequest{
		Code:      "auth-code-1",
		ChannelID: channel.ID,
	}, "en-US", operator)
	if err != nil {
		t.Fatalf("Connect failed: %v", err)
	}
	if !result.Connected {
		t.Errorf("Connected = false, want the token to be saved despite failed discovery")
	}
	if len(result.Accounts) != 0 {
		t.Errorf("accounts = %+v, want none", result.Accounts)
	}
	if len(result.Warnings) == 0 {
		t.Errorf("expected warnings explaining why discovery found nothing")
	}

	saved := ChannelService.Get(channel.ID)
	cfg, parseErr := ChannelService.ParseWhatsAppChannelConfig(saved.ConfigJSON)
	if parseErr != nil {
		t.Fatalf("parse config: %v", parseErr)
	}
	if cfg.AccessToken != "EAAtest-business-token" {
		t.Errorf("saved access token = %q", cfg.AccessToken)
	}
	// Nothing was discovered and nothing was requested, so the pre-existing
	// sender number must not be guessed over.
	if cfg.PhoneNumberID != "phone_id_9999" {
		t.Errorf("phone number id = %q, want the existing value preserved", cfg.PhoneNumberID)
	}
}

func TestWhatsAppOAuthConnectRejectsNonWhatsAppChannel(t *testing.T) {
	db := setupWhatsAppTestDB(t)
	setMetaAppCredentials(t, "app-1", "secret-1")

	telegram := &models.Channel{
		ChannelType:           enums.ChannelTypeTelegram,
		ChannelID:             "tg-1",
		AIAgentID:             1,
		AIAgentRolloutPercent: 100,
		Name:                  "Telegram",
		ConfigJSON:            "{}",
		Status:                enums.StatusOk,
	}
	if err := db.Create(telegram).Error; err != nil {
		t.Fatalf("create telegram channel: %v", err)
	}

	server := newGraphStub(t, "EAAtest-business-token")
	defer server.Close()
	defer stubWhatsAppOAuthClient(server)()

	operator := &dto.AuthPrincipal{UserID: 7, Username: "joy"}
	_, err := WhatsAppOAuthService.Connect(request.WhatsAppOAuthCallbackRequest{
		Code:      "auth-code-1",
		ChannelID: telegram.ID,
	}, "en-US", operator)
	if err == nil {
		t.Fatalf("expected an error when the target channel is not WhatsApp")
	}
	if key := i18nErrorKey(t, err); key != "error.e0250" {
		t.Fatalf("error key = %q, want error.e0250", key)
	}

	untouched := ChannelService.Take("id = ?", telegram.ID)
	if untouched == nil || untouched.ConfigJSON != "{}" {
		t.Errorf("the telegram channel config was modified")
	}
}

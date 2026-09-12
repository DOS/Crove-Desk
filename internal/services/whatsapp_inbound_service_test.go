package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/config"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/repositories"
	"agent-desk/internal/whatsapp"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

const whatsAppTestAppSecret = "test_meta_app_secret"

func setupWhatsAppTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	name := strings.ReplaceAll(t.Name(), "/", "_")
	db, err := gorm.Open(sqlite.Open("file:"+name+"?mode=memory&cache=shared"), &gorm.Config{
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
		&models.Asset{},
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

func signWhatsAppPayload(t *testing.T, secret string, payload []byte) string {
	t.Helper()
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

// seedWhatsAppChannel creates a usable AI agent plus a WhatsApp channel and
// returns the channel. appSecret is stored on the channel so signature
// verification has a credential to check against.
func seedWhatsAppChannel(t *testing.T, db *gorm.DB, appSecret string) *models.Channel {
	t.Helper()
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
		AppSecret:          appSecret,
	}
	cfgBytes, err := json.Marshal(waConfig)
	if err != nil {
		t.Fatalf("marshal channel config: %v", err)
	}

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
	return channel
}

func whatsAppWebhookPayload(messages string) string {
	return `{
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
								{ "profile": { "name": "Anh Le" }, "wa_id": "84901234567" }
							],
							"messages": [` + messages + `]
						}
					}
				]
			}
		]
	}`
}

func assertUnauthorized(t *testing.T, err error) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected an unauthorized error, got nil")
	}
	var i18nErr *errorsx.I18nError
	if !errors.As(err, &i18nErr) || i18nErr.Code != errorsx.CodeAuthUnauthorized {
		t.Fatalf("expected an unauthorized error, got %v", err)
	}
}

// i18nErrorKey returns the translation key an application error carries.
func i18nErrorKey(t *testing.T, err error) string {
	t.Helper()
	var i18nErr *errorsx.I18nError
	if !errors.As(err, &i18nErr) {
		return ""
	}
	return i18nErr.Key
}

func TestVerifyWhatsAppSignatureRejectsUnverifiableHeaders(t *testing.T) {
	payload := []byte(`{"object":"whatsapp_business_account"}`)
	mac := hmac.New(sha256.New, []byte(whatsAppTestAppSecret))
	mac.Write(payload)
	valid := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	cases := []struct {
		name   string
		secret string
		header string
		want   bool
	}{
		{name: "valid signature", secret: whatsAppTestAppSecret, header: valid, want: true},
		{name: "tampered payload", secret: "another_secret", header: valid, want: false},
		{name: "missing algorithm prefix", secret: whatsAppTestAppSecret, header: hex.EncodeToString(mac.Sum(nil)), want: false},
		{name: "empty header", secret: whatsAppTestAppSecret, header: "", want: false},
		{name: "empty digest", secret: whatsAppTestAppSecret, header: "sha256=", want: false},
		{name: "sha1 prefix is not sha256", secret: whatsAppTestAppSecret, header: "sha1=" + hex.EncodeToString(mac.Sum(nil)), want: false},
	}

	for _, tc := range cases {
		if got := verifyWhatsAppSignature(tc.secret, tc.header, payload); got != tc.want {
			t.Errorf("%s: verifyWhatsAppSignature() = %v, want %v", tc.name, got, tc.want)
		}
	}
}

func TestWhatsAppWebhookRejectsUnauthenticatedDelivery(t *testing.T) {
	db := setupWhatsAppTestDB(t)
	channel := seedWhatsAppChannel(t, db, whatsAppTestAppSecret)

	payload := []byte(whatsAppWebhookPayload(`{
		"from": "84901234567",
		"id": "wamid.FORGED0001",
		"timestamp": "1725260000",
		"type": "text",
		"text": { "body": "forged message" }
	}`))

	t.Run("missing signature header", func(t *testing.T) {
		err := WhatsAppInboundService.HandleWebhook(context.Background(), channel.ChannelID, "", payload)
		assertUnauthorized(t, err)
		assertNoWhatsAppMessage(t, db, "wamid.FORGED0001")
	})

	t.Run("invalid signature", func(t *testing.T) {
		err := WhatsAppInboundService.HandleWebhook(context.Background(), channel.ChannelID, "sha256=deadbeef", payload)
		assertUnauthorized(t, err)
		assertNoWhatsAppMessage(t, db, "wamid.FORGED0001")
	})

	t.Run("valid signature is accepted", func(t *testing.T) {
		signature := signWhatsAppPayload(t, whatsAppTestAppSecret, payload)
		if err := WhatsAppInboundService.HandleWebhook(context.Background(), channel.ChannelID, signature, payload); err != nil {
			t.Fatalf("HandleWebhook with a valid signature failed: %v", err)
		}
		if countWhatsAppMessages(t, db, "wamid.FORGED0001") != 1 {
			t.Fatalf("expected the signed message to be stored")
		}
	})
}

func TestWhatsAppWebhookRejectsWhenNoAppSecretIsConfigured(t *testing.T) {
	db := setupWhatsAppTestDB(t)
	channel := seedWhatsAppChannel(t, db, "")

	previousConfig := config.GetCurrent()
	config.SetCurrent(&config.Config{})
	t.Setenv("META_APP_SECRET", "")
	defer config.SetCurrent(previousConfig)

	payload := []byte(whatsAppWebhookPayload(`{
		"from": "84901234567",
		"id": "wamid.NOSECRET01",
		"timestamp": "1725260000",
		"type": "text",
		"text": { "body": "should not be stored" }
	}`))

	err := WhatsAppInboundService.HandleWebhook(context.Background(), channel.ChannelID, "sha256=anything", payload)
	assertUnauthorized(t, err)
	assertNoWhatsAppMessage(t, db, "wamid.NOSECRET01")
}

func TestWhatsAppInboundStructuredMessageTypes(t *testing.T) {
	db := setupWhatsAppTestDB(t)
	channel := seedWhatsAppChannel(t, db, whatsAppTestAppSecret)

	payload := []byte(whatsAppWebhookPayload(`
		{
			"from": "84901234567", "id": "wamid.LOC01", "timestamp": "1725260000", "type": "location",
			"location": { "latitude": 10.823099, "longitude": 106.629662, "name": "Ben Thanh Market", "address": "Quang Trung, Ho Chi Minh" }
		},
		{
			"from": "84901234567", "id": "wamid.BTN01", "timestamp": "1725260001", "type": "interactive",
			"interactive": { "type": "button_reply", "button_reply": { "id": "yes", "title": "Talk to a human" } }
		},
		{
			"from": "84901234567", "id": "wamid.RXN01", "timestamp": "1725260002", "type": "reaction",
			"reaction": { "message_id": "wamid.EARLIER", "emoji": "👍" }
		},
		{
			"from": "84901234567", "id": "wamid.ORD01", "timestamp": "1725260003", "type": "order",
			"errors": [ { "code": 131047, "title": "Message undeliverable", "message": "Order messages are not supported" } ]
		}
	`))

	signature := signWhatsAppPayload(t, whatsAppTestAppSecret, payload)
	if err := WhatsAppInboundService.HandleWebhook(context.Background(), channel.ChannelID, signature, payload); err != nil {
		t.Fatalf("HandleWebhook failed: %v", err)
	}

	expected := map[string]string{
		"wamid.LOC01": "[Location] 10.823099,106.629662 · Ben Thanh Market · Quang Trung, Ho Chi Minh",
		"wamid.BTN01": "Talk to a human",
		"wamid.RXN01": "👍",
		"wamid.ORD01": "[order] Order messages are not supported",
	}
	for messageID, wantContent := range expected {
		message := findWhatsAppMessage(t, db, messageID)
		if message == nil {
			t.Fatalf("%s: expected a message to be stored", messageID)
		}
		if message.MessageType != enums.IMMessageTypeText {
			t.Errorf("%s: message type = %s, want text", messageID, message.MessageType)
		}
		if message.Content != wantContent {
			t.Errorf("%s: content = %q, want %q", messageID, message.Content, wantContent)
		}
	}
}

func TestWhatsAppInboundImageStoresAsset(t *testing.T) {
	db := setupWhatsAppTestDB(t)
	channel := seedWhatsAppChannel(t, db, whatsAppTestAppSecret)

	previousConfig := config.GetCurrent()
	cfg := &config.Config{}
	cfg.Storage.Default = enums.AssetProviderLocal
	cfg.Storage.MaxUploadSizeMB = 5
	cfg.Storage.Local.Root = t.TempDir()
	cfg.Storage.Local.BaseURL = "https://cdn.test/assets"
	config.SetCurrent(cfg)
	defer config.SetCurrent(previousConfig)

	// A minimal JFIF so net/http.DetectContentType identifies it as an image.
	jpeg := []byte{
		0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
		0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9,
	}

	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/media/") {
			w.Header().Set("Content-Type", "image/jpeg")
			_, _ = w.Write(jpeg)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"id":        strings.TrimPrefix(r.URL.Path, "/"),
			"url":       "https://" + r.Host + "/media/" + strings.TrimPrefix(r.URL.Path, "/"),
			"mime_type": "image/jpeg",
		})
	}))
	defer server.Close()

	restore := stubWhatsAppClient(server)
	defer restore()

	payload := []byte(whatsAppWebhookPayload(`{
		"from": "84901234567", "id": "wamid.IMG01", "timestamp": "1725260000", "type": "image",
		"image": { "id": "media-img-01", "mime_type": "image/jpeg", "caption": "Báo giá giúp mình" }
	}`))

	signature := signWhatsAppPayload(t, whatsAppTestAppSecret, payload)
	if err := WhatsAppInboundService.HandleWebhook(context.Background(), channel.ChannelID, signature, payload); err != nil {
		t.Fatalf("HandleWebhook failed: %v", err)
	}

	message := findWhatsAppMessage(t, db, "wamid.IMG01")
	if message == nil {
		t.Fatalf("expected the image message to be stored")
	}
	if message.MessageType != enums.IMMessageTypeImage {
		t.Fatalf("message type = %s, want image", message.MessageType)
	}
	// The caption is carried in the file name because normalizeMessageContent
	// replaces an image message's content with the stored asset name.
	if !strings.Contains(message.Content, "Báo giá giúp mình") {
		t.Fatalf("content = %q, want it to carry the caption", message.Content)
	}

	assetPayload, err := parseIMMessageAssetPayload(message.Payload)
	if err != nil {
		t.Fatalf("message payload is not a valid asset payload: %v", err)
	}
	asset := AssetService.GetByAssetID(assetPayload.AssetID)
	if asset == nil {
		t.Fatalf("expected an asset row for %s", assetPayload.AssetID)
	}
	if asset.Status != enums.AssetStatusSuccess {
		t.Fatalf("asset status = %v, want success", asset.Status)
	}
	if asset.FileSize != int64(len(jpeg)) {
		t.Fatalf("asset size = %d, want %d", asset.FileSize, len(jpeg))
	}
	if !strings.HasSuffix(asset.StorageKey, ".jpg") {
		t.Fatalf("storage key = %q, want a .jpg suffix", asset.StorageKey)
	}
}

func TestWhatsAppInboundMediaFailureFallsBackToText(t *testing.T) {
	db := setupWhatsAppTestDB(t)
	channel := seedWhatsAppChannel(t, db, whatsAppTestAppSecret)

	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":{"message":"media expired","code":131047}}`, http.StatusGone)
	}))
	defer server.Close()

	restore := stubWhatsAppClient(server)
	defer restore()

	payload := []byte(whatsAppWebhookPayload(`{
		"from": "84901234567", "id": "wamid.IMG02", "timestamp": "1725260000", "type": "image",
		"image": { "id": "media-img-02", "mime_type": "image/jpeg", "caption": "Ảnh lỗi sản phẩm" }
	}`))

	signature := signWhatsAppPayload(t, whatsAppTestAppSecret, payload)
	if err := WhatsAppInboundService.HandleWebhook(context.Background(), channel.ChannelID, signature, payload); err != nil {
		t.Fatalf("HandleWebhook failed: %v", err)
	}

	message := findWhatsAppMessage(t, db, "wamid.IMG02")
	if message == nil {
		t.Fatalf("expected the failed media message to still be stored as text")
	}
	if message.MessageType != enums.IMMessageTypeText {
		t.Fatalf("message type = %s, want text", message.MessageType)
	}
	want := "Ảnh lỗi sản phẩm [Image Attachment]"
	if message.Content != want {
		t.Fatalf("content = %q, want %q", message.Content, want)
	}
}

// stubWhatsAppClient points the inbound Graph client at a local stub and returns
// a restore func. The inbound media download insists on https, so the stub is a
// TLS server and the client is given the test transport that trusts it.
func stubWhatsAppClient(server *httptest.Server) func() {
	previous := newWhatsAppClient
	newWhatsAppClient = func(accessToken string) *whatsapp.Client {
		client := whatsapp.NewClient(accessToken)
		client.SetBaseURL(server.URL)
		client.SetHTTPClient(server.Client())
		return client
	}
	return func() { newWhatsAppClient = previous }
}

// findWhatsAppMessage looks a stored message up by its client message id. The
// payload cannot be used: media messages carry the canonical asset payload, not
// the webhook metadata.
func findWhatsAppMessage(t *testing.T, db *gorm.DB, whatsAppMessageID string) *models.Message {
	t.Helper()
	var message models.Message
	err := db.Table("t_message").Where("client_msg_id = ?", "wa_"+whatsAppMessageID).First(&message).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		t.Fatalf("query message: %v", err)
	}
	return &message
}

func countWhatsAppMessages(t *testing.T, db *gorm.DB, whatsAppMessageID string) int64 {
	t.Helper()
	var count int64
	if err := db.Table("t_message").Where("client_msg_id = ?", "wa_"+whatsAppMessageID).Count(&count).Error; err != nil {
		t.Fatalf("count messages: %v", err)
	}
	return count
}

func assertNoWhatsAppMessage(t *testing.T, db *gorm.DB, whatsAppMessageID string) {
	t.Helper()
	if count := countWhatsAppMessages(t, db, whatsAppMessageID); count != 0 {
		t.Fatalf("expected no stored message for %s, found %d", whatsAppMessageID, count)
	}
}

func TestWhatsAppInboundAndOutbound(t *testing.T) {
	db := setupWhatsAppTestDB(t)
	channel := seedWhatsAppChannel(t, db, whatsAppTestAppSecret)

	payload := []byte(whatsAppWebhookPayload(`{
		"from": "84901234567",
		"id": "wamid.HBgLODQ5MDEyMzQ1NjcVAgASGBQz",
		"timestamp": "1725260000",
		"type": "text",
		"text": { "body": "Xin chào, tôi cần hỗ trợ!" }
	}`))

	signature := signWhatsAppPayload(t, whatsAppTestAppSecret, payload)
	if err := WhatsAppInboundService.HandleWebhook(context.Background(), channel.ChannelID, signature, payload); err != nil {
		t.Fatalf("HandleWebhook failed: %v", err)
	}

	identity := repositories.CustomerIdentityRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("external_source", enums.ExternalSourceWhatsApp).
		Eq("external_id", "84901234567"))
	if identity == nil {
		t.Fatalf("expected customer identity for 84901234567")
	}

	conv := repositories.ConversationRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("customer_id", identity.CustomerID).
		Eq("channel_id", channel.ID))
	if conv == nil {
		t.Fatalf("expected conversation to be created")
	}

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

	replyMsg, err := MessageService.SendAIMessage(conv.ID, channel.AIAgentID, "ai_wa_reply_1", enums.IMMessageTypeText, "Chào bạn! Crove Desk có thể giúp gì cho bạn?", "", operator)
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

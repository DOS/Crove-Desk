package line

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLinePushMessage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v2/bot/message/push" {
			t.Errorf("expected path /v2/bot/message/push, got %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test_token" {
			t.Errorf("expected Bearer test_token, got %s", r.Header.Get("Authorization"))
		}
		var req PushMessageRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("decode request failed: %v", err)
		}
		if req.To != "U4af4980629" {
			t.Errorf("expected to U4af4980629, got %s", req.To)
		}
		if len(req.Messages) != 1 || req.Messages[0].Text != "hello" {
			t.Errorf("unexpected messages: %+v", req.Messages)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"sentMessages":[{"id":"4612309"}]}`))
	}))
	defer server.Close()

	client := NewClient("test_token")
	client.SetBaseURL(server.URL)

	resp, err := client.PushMessage(context.Background(), PushMessageRequest{
		To:       "U4af4980629",
		Messages: []MessageObject{{Type: "text", Text: "hello"}},
	})
	if err != nil {
		t.Fatalf("PushMessage failed: %v", err)
	}
	if len(resp.SentMessages) != 1 || resp.SentMessages[0].ID != "4612309" {
		t.Errorf("unexpected response: %+v", resp)
	}
}

func TestLineVerifyWebhookSignature(t *testing.T) {
	const secret = "8c570fa6dd201bb328f1c1eac23a96d8"
	body := []byte(`{"destination":"U8e742f61d673b39c7fff3cecb7536ef0","events":[]}`)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	valid := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	if !VerifyWebhookSignature(secret, valid, body) {
		t.Errorf("expected valid signature to verify")
	}
	if VerifyWebhookSignature(secret, "bad-signature", body) {
		t.Errorf("expected invalid signature to fail")
	}
}

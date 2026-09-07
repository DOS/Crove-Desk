package viber

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestViberSendTextMessage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/pa/send_message" {
			t.Errorf("expected path /pa/send_message, got %s", r.URL.Path)
		}
		if r.Header.Get("X-Viber-Auth-Token") != "test_token" {
			t.Errorf("expected X-Viber-Auth-Token test_token, got %s", r.Header.Get("X-Viber-Auth-Token"))
		}
		var req SendTextRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("decode request failed: %v", err)
		}
		if req.Receiver != "01234567890=" {
			t.Errorf("expected receiver 01234567890=, got %s", req.Receiver)
		}
		if req.Type != "text" || req.Text != "hello" {
			t.Errorf("unexpected message: %+v", req)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":0,"status_message":"ok","message_token":4911}`))
	}))
	defer server.Close()

	client := NewClient("test_token")
	client.SetBaseURL(server.URL)

	resp, err := client.SendTextMessage(context.Background(), "01234567890=", "", "", "hello")
	if err != nil {
		t.Fatalf("SendTextMessage failed: %v", err)
	}
	if resp.Status != 0 || resp.MessageToken != 4911 {
		t.Errorf("unexpected response: %+v", resp)
	}
}

func TestViberSendTextMessageError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":5,"status_message":"Not a Viber user"}`))
	}))
	defer server.Close()

	client := NewClient("test_token")
	client.SetBaseURL(server.URL)

	if _, err := client.SendTextMessage(context.Background(), "unknown", "", "", "hello"); err == nil {
		t.Fatalf("expected error for non-zero status")
	}
}

func TestViberVerifyWebhookSignature(t *testing.T) {
	const token = "4453b0dcd47c3ae3-5e6c9866b2b1c3f7-oxv2lbqvbolcgtbe"
	body := []byte(`{"event":"message","timestamp":1457764199822,"message_token":4911}`)

	mac := hmac.New(sha256.New, []byte(token))
	mac.Write(body)
	valid := hex.EncodeToString(mac.Sum(nil))

	if !VerifyWebhookSignature(token, valid, body) {
		t.Errorf("expected valid signature to verify")
	}
	if VerifyWebhookSignature(token, "deadbeef", body) {
		t.Errorf("expected invalid signature to fail")
	}
}

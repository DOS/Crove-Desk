package threads

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestThreadsPublishTextReply(t *testing.T) {
	var publishedContainerID string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/threads") && !strings.HasSuffix(r.URL.Path, "/threads_publish") {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		if strings.HasSuffix(r.URL.Path, "/threads") {
			if err := r.ParseForm(); err != nil {
				t.Errorf("parse form failed: %v", err)
			}
			if r.Form.Get("media_type") != "TEXT" {
				t.Errorf("expected media_type TEXT, got %s", r.Form.Get("media_type"))
			}
			if r.Form.Get("text") != "hello" {
				t.Errorf("expected text hello, got %s", r.Form.Get("text"))
			}
			if r.Form.Get("reply_to_id") != "8901234" {
				t.Errorf("expected reply_to_id 8901234, got %s", r.Form.Get("reply_to_id"))
			}
			publishedContainerID = "container_1"
			w.Write([]byte(`{"id":"container_1"}`))
			return
		}
		if err := r.ParseForm(); err != nil {
			t.Errorf("parse form failed: %v", err)
		}
		if r.Form.Get("creation_id") != publishedContainerID {
			t.Errorf("expected creation_id %s, got %s", publishedContainerID, r.Form.Get("creation_id"))
		}
		w.Write([]byte(`{"id":"published_1"}`))
	}))
	defer server.Close()

	client := NewClient("test_token")
	client.SetBaseURL(server.URL)

	resp, err := client.PublishTextReply(context.Background(), "999", "hello", "8901234")
	if err != nil {
		t.Fatalf("PublishTextReply failed: %v", err)
	}
	if resp.ID != "published_1" {
		t.Errorf("expected published id published_1, got %s", resp.ID)
	}
}

func TestThreadsVerifyWebhookSignature(t *testing.T) {
	const secret = "app-secret"
	body := []byte(`{"object":"threads","entry":[]}`)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	valid := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	if !VerifyWebhookSignature(secret, valid, body) {
		t.Errorf("expected valid signature to verify")
	}
	if VerifyWebhookSignature(secret, "sha256=deadbeef", body) {
		t.Errorf("expected invalid signature to fail")
	}
}

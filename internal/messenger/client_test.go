package messenger

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMessengerSendMessage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/me/messages" {
			t.Errorf("expected path /me/messages, got %s", r.URL.Path)
		}
		if r.URL.Query().Get("access_token") != "test_page_token" {
			t.Errorf("expected access_token test_page_token, got %s", r.URL.Query().Get("access_token"))
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"recipient_id":"psid_123","message_id":"mid_456"}`))
	}))
	defer server.Close()

	client := NewClient("test_page_token")
	client.SetBaseURL(server.URL)

	resp, err := client.SendTextMessage(context.Background(), "psid_123", "hello")
	if err != nil {
		t.Fatalf("SendTextMessage failed: %v", err)
	}
	if resp.MessageID != "mid_456" {
		t.Errorf("expected MessageID mid_456, got %s", resp.MessageID)
	}
	if resp.RecipientID != "psid_123" {
		t.Errorf("expected RecipientID psid_123, got %s", resp.RecipientID)
	}
}

func TestMessengerSendMediaMessage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/me/messages" {
			t.Errorf("expected path /me/messages, got %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"recipient_id":"psid_123","message_id":"mid_media_789"}`))
	}))
	defer server.Close()

	client := NewClient("test_page_token")
	client.SetBaseURL(server.URL)

	resp, err := client.SendMediaMessage(context.Background(), "psid_123", "image", "https://example.com/pic.jpg")
	if err != nil {
		t.Fatalf("SendMediaMessage failed: %v", err)
	}
	if resp.MessageID != "mid_media_789" {
		t.Errorf("expected MessageID mid_media_789, got %s", resp.MessageID)
	}
}

func TestMessengerSubscribeAppToPage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/page_123/subscribed_apps" {
			t.Errorf("expected path /page_123/subscribed_apps, got %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"success":true}`))
	}))
	defer server.Close()

	client := NewClient("test_page_token")
	client.SetBaseURL(server.URL)

	if err := client.SubscribeAppToPage(context.Background(), "page_123"); err != nil {
		t.Fatalf("SubscribeAppToPage failed: %v", err)
	}
}

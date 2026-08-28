package email

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestParseAddress(t *testing.T) {
	tests := []struct {
		input     string
		wantEmail string
		wantName  string
	}{
		{"John Doe <john@example.com>", "john@example.com", "John Doe"},
		{"<support@crove.com>", "support@crove.com", ""},
		{"plain@example.com", "plain@example.com", ""},
		{"  Alice Smith <ALICE@DOMAIN.COM>  ", "alice@domain.com", "Alice Smith"},
		{"", "", ""},
	}

	for _, tt := range tests {
		gotEmail, gotName := ParseAddress(tt.input)
		if gotEmail != tt.wantEmail || gotName != tt.wantName {
			t.Errorf("ParseAddress(%q) = (%q, %q), want (%q, %q)", tt.input, gotEmail, gotName, tt.wantEmail, tt.wantName)
		}
	}
}

func TestBrevoSendEmail(t *testing.T) {
	var receivedBody string
	var receivedAPIKey string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedAPIKey = r.Header.Get("api-key")
		buf := make([]byte, 1024)
		n, _ := r.Body.Read(buf)
		receivedBody = string(buf[:n])

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`{"messageId":"<12345@smtp-relay.brevo.com>"}`))
	}))
	defer server.Close()

	client := NewClient(ClientConfig{
		Provider:     "brevo",
		APIKey:       "test-key",
		BrevoBaseURL: server.URL,
		HTTPClient:   server.Client(),
	})

	err := client.SendEmail(context.Background(), SendEmailParams{
		FromEmail: "help@crove.com",
		FromName:  "Crove Desk Support",
		ToEmail:   "user@example.com",
		ToName:    "User",
		Subject:   "Ticket Confirmation",
		BodyText:  "Thank you for reaching out.",
	})

	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if receivedAPIKey != "test-key" {
		t.Errorf("expected api-key 'test-key', got: %s", receivedAPIKey)
	}

	if len(receivedBody) == 0 {
		t.Error("expected non-empty request body")
	}
}

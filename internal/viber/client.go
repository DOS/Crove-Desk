package viber

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const defaultBaseURL = "https://chatapi.viber.com"

type Client struct {
	authToken  string
	baseURL    string
	httpClient *http.Client
}

func NewClient(authToken string) *Client {
	return &Client{
		authToken:  strings.TrimSpace(authToken),
		baseURL:    defaultBaseURL,
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *Client) SetBaseURL(url string) {
	if strings.TrimSpace(url) != "" {
		c.baseURL = strings.TrimRight(strings.TrimSpace(url), "/")
	}
}

// VerifyWebhookSignature validates the X-Viber-Content-Signature header value.
// The signature is HMAC-SHA256 of the raw body keyed by the authentication
// token, encoded as lowercase hex.
func VerifyWebhookSignature(authToken string, signature string, payload []byte) bool {
	token := strings.TrimSpace(authToken)
	sig := strings.TrimSpace(signature)
	if token == "" || sig == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(token))
	mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(sig))
}

// SendTextMessage sends a text message to a Viber user.
func (c *Client) SendTextMessage(ctx context.Context, receiverID string, senderName string, senderAvatar string, text string) (*SendResponse, error) {
	if strings.TrimSpace(receiverID) == "" {
		return nil, fmt.Errorf("viber receiver id is required")
	}
	if strings.TrimSpace(text) == "" {
		return nil, fmt.Errorf("viber message text is required")
	}

	req := SendTextRequest{
		Receiver: strings.TrimSpace(receiverID),
		Type:     "text",
		Text:     text,
	}
	if strings.TrimSpace(senderName) != "" || strings.TrimSpace(senderAvatar) != "" {
		req.Sender = &SenderRef{
			Name:   strings.TrimSpace(senderName),
			Avatar: strings.TrimSpace(senderAvatar),
		}
	}

	var resp SendResponse
	if err := c.doRequest(ctx, "/pa/send_message", req, &resp); err != nil {
		return nil, err
	}
	if resp.Status != 0 {
		return nil, fmt.Errorf("viber sendMessage failed (%d): %s", resp.Status, resp.StatusMessage)
	}
	return &resp, nil
}

func (c *Client) doRequest(ctx context.Context, path string, payload any, result any) error {
	if c.authToken == "" {
		return fmt.Errorf("viber auth token is required")
	}

	endpoint := c.baseURL + path

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal viber request failed: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return fmt.Errorf("create viber request failed: %w", err)
	}
	req.Header.Set("X-Viber-Auth-Token", c.authToken)
	req.Header.Set("Content-Type", "application/json")

	res, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("viber http request failed: %w", err)
	}
	defer res.Body.Close()

	respBytes, err := io.ReadAll(res.Body)
	if err != nil {
		return fmt.Errorf("read viber response failed: %w", err)
	}

	if err := json.Unmarshal(respBytes, result); err != nil {
		return fmt.Errorf("unmarshal viber response failed: %w (body: %s)", err, string(respBytes))
	}
	return nil
}

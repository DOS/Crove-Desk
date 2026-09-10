package line

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const defaultBaseURL = "https://api.line.me"

type Client struct {
	channelAccessToken string
	baseURL            string
	httpClient         *http.Client
}

func NewClient(channelAccessToken string) *Client {
	return &Client{
		channelAccessToken: strings.TrimSpace(channelAccessToken),
		baseURL:            defaultBaseURL,
		httpClient:         &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *Client) SetBaseURL(url string) {
	if strings.TrimSpace(url) != "" {
		c.baseURL = strings.TrimRight(strings.TrimSpace(url), "/")
	}
}

// VerifyWebhookSignature validates the x-line-signature header value.
// The signature is HMAC-SHA256 of the raw body keyed by the channel secret,
// encoded as base64.
func VerifyWebhookSignature(channelSecret string, signature string, payload []byte) bool {
	secret := strings.TrimSpace(channelSecret)
	sig := strings.TrimSpace(signature)
	if secret == "" || sig == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(sig))
}

// PushMessage sends a push message to a user via the LINE Messaging API.
func (c *Client) PushMessage(ctx context.Context, req PushMessageRequest) (*PushMessageResponse, error) {
	if strings.TrimSpace(req.To) == "" {
		return nil, fmt.Errorf("line recipient (to) is required")
	}
	if len(req.Messages) == 0 {
		return nil, fmt.Errorf("line message list is required")
	}

	var resp PushMessageResponse
	if err := c.doRequest(ctx, "/v2/bot/message/push", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *Client) doRequest(ctx context.Context, path string, payload any, result any) error {
	if c.channelAccessToken == "" {
		return fmt.Errorf("line channel access token is required")
	}

	endpoint := c.baseURL + path

	var bodyReader io.Reader
	if payload != nil {
		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("marshal line request failed: %w", err)
		}
		bodyReader = bytes.NewBuffer(bodyBytes)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bodyReader)
	if err != nil {
		return fmt.Errorf("create line request failed: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.channelAccessToken)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	res, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("line http request failed: %w", err)
	}
	defer res.Body.Close()

	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		return fmt.Errorf("read line response failed: %w", err)
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("line api error (%d): %s", res.StatusCode, string(bodyBytes))
	}

	if result != nil && len(bodyBytes) > 0 {
		if err := json.Unmarshal(bodyBytes, result); err != nil {
			return fmt.Errorf("unmarshal line response failed: %w (body: %s)", err, string(bodyBytes))
		}
	}
	return nil
}

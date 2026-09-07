package threads

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const defaultBaseURL = "https://graph.threads.net/v1.0"

type Client struct {
	accessToken string
	baseURL     string
	httpClient  *http.Client
}

func NewClient(accessToken string) *Client {
	return &Client{
		accessToken: strings.TrimSpace(accessToken),
		baseURL:     defaultBaseURL,
		httpClient:  &http.Client{Timeout: 20 * time.Second},
	}
}

func (c *Client) SetBaseURL(url string) {
	if strings.TrimSpace(url) != "" {
		c.baseURL = strings.TrimRight(strings.TrimSpace(url), "/")
	}
}

// VerifyWebhookSignature validates the X-Hub-Signature-256 header value.
// The signature is HMAC-SHA256 of the raw body keyed by the app secret,
// sent as "sha256=<hex>".
func VerifyWebhookSignature(appSecret string, signature string, payload []byte) bool {
	secret := strings.TrimSpace(appSecret)
	sig := strings.TrimSpace(signature)
	if secret == "" || sig == "" {
		return false
	}
	if strings.HasPrefix(sig, "sha256=") {
		sig = sig[len("sha256="):]
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(sig))
}

// PublishTextReply publishes a text reply to an existing Threads media
// object. The Threads API requires a two-step flow: create a media
// container, then publish it.
func (c *Client) PublishTextReply(ctx context.Context, threadsUserID string, text string, replyToID string) (*ContainerResponse, error) {
	userID := strings.TrimSpace(threadsUserID)
	if userID == "" {
		return nil, fmt.Errorf("threads user id is required")
	}
	if strings.TrimSpace(text) == "" {
		return nil, fmt.Errorf("threads text is required")
	}

	container, err := c.createTextContainer(ctx, userID, text, strings.TrimSpace(replyToID))
	if err != nil {
		return nil, err
	}

	published, err := c.publishContainer(ctx, userID, container.ID)
	if err != nil {
		return nil, err
	}
	return published, nil
}

func (c *Client) createTextContainer(ctx context.Context, threadsUserID string, text string, replyToID string) (*ContainerResponse, error) {
	params := url.Values{}
	params.Set("media_type", "TEXT")
	params.Set("text", text)
	params.Set("access_token", c.accessToken)
	if replyToID != "" {
		params.Set("reply_to_id", replyToID)
	}

	var resp ContainerResponse
	if err := c.doRequest(ctx, fmt.Sprintf("/%s/threads", threadsUserID), params, &resp); err != nil {
		return nil, err
	}
	if resp.ID == "" {
		return nil, fmt.Errorf("threads container creation returned no id")
	}
	return &resp, nil
}

func (c *Client) publishContainer(ctx context.Context, threadsUserID string, containerID string) (*ContainerResponse, error) {
	params := url.Values{}
	params.Set("creation_id", containerID)
	params.Set("access_token", c.accessToken)

	var resp ContainerResponse
	if err := c.doRequest(ctx, fmt.Sprintf("/%s/threads_publish", threadsUserID), params, &resp); err != nil {
		return nil, err
	}
	if resp.ID == "" {
		return nil, fmt.Errorf("threads publish returned no id")
	}
	return &resp, nil
}

func (c *Client) doRequest(ctx context.Context, path string, form url.Values, result any) error {
	if c.accessToken == "" {
		return fmt.Errorf("threads access token is required")
	}

	endpoint := c.baseURL + path

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("create threads request failed: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	res, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("threads http request failed: %w", err)
	}
	defer res.Body.Close()

	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		return fmt.Errorf("read threads response failed: %w", err)
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("threads api error (%d): %s", res.StatusCode, string(bodyBytes))
	}

	if result != nil && len(bodyBytes) > 0 {
		if err := json.Unmarshal(bodyBytes, result); err != nil {
			return fmt.Errorf("unmarshal threads response failed: %w (body: %s)", err, string(bodyBytes))
		}
	}
	return nil
}

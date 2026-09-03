package x

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const defaultBaseURL = "https://api.twitter.com/2"

type Client struct {
	bearerToken string
	baseURL     string
	httpClient  *http.Client
}

func NewClient(bearerToken string) *Client {
	return &Client{
		bearerToken: strings.TrimSpace(bearerToken),
		baseURL:     defaultBaseURL,
		httpClient:  &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *Client) SetBaseURL(url string) {
	if strings.TrimSpace(url) != "" {
		c.baseURL = strings.TrimRight(strings.TrimSpace(url), "/")
	}
}

func (c *Client) SendDirectMessage(ctx context.Context, recipientID string, text string) (*SendDMResponse, error) {
	recipientID = strings.TrimSpace(recipientID)
	if recipientID == "" {
		return nil, fmt.Errorf("recipient_id is required")
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, fmt.Errorf("message text is required")
	}

	payload := SendDMRequest{
		Text: text,
	}

	var resp SendDMResponse
	endpoint := fmt.Sprintf("/dm_conversations/with/%s/messages", recipientID)
	if err := c.doRequest(ctx, http.MethodPost, endpoint, payload, &resp); err != nil {
		return nil, err
	}
	if len(resp.Errors) > 0 {
		return nil, fmt.Errorf("x api error: %s - %s", resp.Errors[0].Title, resp.Errors[0].Detail)
	}
	return &resp, nil
}

func (c *Client) doRequest(ctx context.Context, method, path string, payload any, result any) error {
	if c.bearerToken == "" {
		return fmt.Errorf("x bearer token is required")
	}

	endpoint := fmt.Sprintf("%s%s", c.baseURL, path)

	var bodyReader io.Reader
	if payload != nil {
		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("marshal x request failed: %w", err)
		}
		bodyReader = bytes.NewBuffer(bodyBytes)
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, bodyReader)
	if err != nil {
		return fmt.Errorf("create x request failed: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.bearerToken)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	res, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("x http request failed: %w", err)
	}
	defer res.Body.Close()

	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		return fmt.Errorf("read x response failed: %w", err)
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("x api error (%d): %s", res.StatusCode, string(bodyBytes))
	}

	if result != nil {
		if err := json.Unmarshal(bodyBytes, result); err != nil {
			return fmt.Errorf("unmarshal x response failed: %w (body: %s)", err, string(bodyBytes))
		}
	}
	return nil
}

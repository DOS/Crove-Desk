package tiktok

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

const defaultBaseURL = "https://business-api.tiktok.com/open_api/v1.3"

type Client struct {
	accessToken string
	baseURL     string
	httpClient  *http.Client
}

func NewClient(accessToken string) *Client {
	return &Client{
		accessToken: strings.TrimSpace(accessToken),
		baseURL:     defaultBaseURL,
		httpClient:  &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *Client) SetBaseURL(url string) {
	if strings.TrimSpace(url) != "" {
		c.baseURL = strings.TrimRight(strings.TrimSpace(url), "/")
	}
}

func (c *Client) SendTextMessage(ctx context.Context, toUserID string, text string) (*SendMessageResponse, error) {
	toUserID = strings.TrimSpace(toUserID)
	if toUserID == "" {
		return nil, fmt.Errorf("to_user_id is required")
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, fmt.Errorf("content is required")
	}

	payload := SendMessageRequest{
		ToUserID:    toUserID,
		MessageType: "text",
		Content:     text,
	}

	var resp SendMessageResponse
	if err := c.doRequest(ctx, "/business/message/send/", payload, &resp); err != nil {
		return nil, err
	}
	if resp.Code != 0 {
		return nil, fmt.Errorf("tiktok api error (%d): %s", resp.Code, resp.Message)
	}
	return &resp, nil
}

func (c *Client) doRequest(ctx context.Context, path string, payload any, result any) error {
	if c.accessToken == "" {
		return fmt.Errorf("tiktok access token is required")
	}

	endpoint := fmt.Sprintf("%s%s", c.baseURL, path)

	var bodyReader io.Reader
	if payload != nil {
		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("marshal tiktok request failed: %w", err)
		}
		bodyReader = bytes.NewBuffer(bodyBytes)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bodyReader)
	if err != nil {
		return fmt.Errorf("create tiktok request failed: %w", err)
	}

	req.Header.Set("Access-Token", c.accessToken)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	res, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("tiktok http request failed: %w", err)
	}
	defer res.Body.Close()

	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		return fmt.Errorf("read tiktok response failed: %w", err)
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("tiktok api error (%d): %s", res.StatusCode, string(bodyBytes))
	}

	if result != nil {
		if err := json.Unmarshal(bodyBytes, result); err != nil {
			return fmt.Errorf("unmarshal tiktok response failed: %w (body: %s)", err, string(bodyBytes))
		}
	}
	return nil
}

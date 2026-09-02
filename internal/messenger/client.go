package messenger

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const defaultBaseURL = "https://graph.facebook.com/v21.0"

type Client struct {
	pageAccessToken string
	baseURL         string
	httpClient      *http.Client
}

func NewClient(pageAccessToken string) *Client {
	return &Client{
		pageAccessToken: strings.TrimSpace(pageAccessToken),
		baseURL:         defaultBaseURL,
		httpClient:      &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *Client) SetBaseURL(url string) {
	if strings.TrimSpace(url) != "" {
		c.baseURL = strings.TrimRight(strings.TrimSpace(url), "/")
	}
}

func (c *Client) SendTextMessage(ctx context.Context, psid string, text string) (*SendMessageResponse, error) {
	psid = strings.TrimSpace(psid)
	if psid == "" {
		return nil, fmt.Errorf("recipient psid is required")
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, fmt.Errorf("message text is required")
	}

	payload := SendMessageRequest{
		Recipient: Recipient{
			ID: psid,
		},
		Message: OutgoingMessage{
			Text: text,
		},
		MessagingType: "RESPONSE",
	}

	var resp SendMessageResponse
	if err := c.doRequest(ctx, http.MethodPost, "/me/messages", payload, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *Client) SendMediaMessage(ctx context.Context, psid string, mediaType string, mediaURL string) (*SendMessageResponse, error) {
	psid = strings.TrimSpace(psid)
	if psid == "" {
		return nil, fmt.Errorf("recipient psid is required")
	}
	mediaURL = strings.TrimSpace(mediaURL)
	if mediaURL == "" {
		return nil, fmt.Errorf("media url is required")
	}
	mediaType = strings.ToLower(strings.TrimSpace(mediaType))
	if mediaType == "" {
		mediaType = "image"
	}

	payload := SendMessageRequest{
		Recipient: Recipient{
			ID: psid,
		},
		Message: OutgoingMessage{
			Attachment: &OutgoingAttachment{
				Type: mediaType,
				Payload: OutgoingAttachmentPayload{
					URL:        mediaURL,
					IsReusable: true,
				},
			},
		},
		MessagingType: "RESPONSE",
	}

	var resp SendMessageResponse
	if err := c.doRequest(ctx, http.MethodPost, "/me/messages", payload, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *Client) SubscribeAppToPage(ctx context.Context, pageID string) error {
	pageID = strings.TrimSpace(pageID)
	if pageID == "" {
		return fmt.Errorf("page_id is required")
	}
	endpoint := fmt.Sprintf("/%s/subscribed_apps?subscribed_fields=messages,messaging_postbacks", pageID)
	return c.doRequest(ctx, http.MethodPost, endpoint, nil, nil)
}

func (c *Client) GetPageInfo(ctx context.Context, pageID string) (*PageInfo, error) {
	pageID = strings.TrimSpace(pageID)
	if pageID == "" {
		pageID = "me"
	}
	var page PageInfo
	endpoint := fmt.Sprintf("/%s?fields=id,name", pageID)
	if err := c.doRequest(ctx, http.MethodGet, endpoint, nil, &page); err != nil {
		return nil, err
	}
	return &page, nil
}

func (c *Client) doRequest(ctx context.Context, method, path string, payload any, result any) error {
	if c.pageAccessToken == "" {
		return fmt.Errorf("messenger page access token is required")
	}

	separator := "?"
	if strings.Contains(path, "?") {
		separator = "&"
	}
	endpoint := fmt.Sprintf("%s%s%saccess_token=%s", c.baseURL, path, separator, url.QueryEscape(c.pageAccessToken))

	var bodyReader io.Reader
	if payload != nil {
		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("marshal messenger request failed: %w", err)
		}
		bodyReader = bytes.NewBuffer(bodyBytes)
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, bodyReader)
	if err != nil {
		return fmt.Errorf("create messenger request failed: %w", err)
	}

	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	res, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("messenger http request failed: %w", err)
	}
	defer res.Body.Close()

	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		return fmt.Errorf("read messenger response failed: %w", err)
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("messenger api error (%d): %s", res.StatusCode, string(bodyBytes))
	}

	if result != nil {
		if err := json.Unmarshal(bodyBytes, result); err != nil {
			return fmt.Errorf("unmarshal messenger response failed: %w (body: %s)", err, string(bodyBytes))
		}
	}
	return nil
}

package whatsapp

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

const defaultBaseURL = "https://graph.facebook.com/v21.0"

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

func (c *Client) SendTextMessage(ctx context.Context, phoneNumberID string, recipientPhone string, text string) (*SendMessageResponse, error) {
	phoneNumberID = strings.TrimSpace(phoneNumberID)
	if phoneNumberID == "" {
		return nil, fmt.Errorf("phone_number_id is required")
	}
	recipientPhone = strings.TrimSpace(recipientPhone)
	if recipientPhone == "" {
		return nil, fmt.Errorf("recipient phone number is required")
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, fmt.Errorf("message text is required")
	}

	payload := SendTextMessageRequest{
		MessagingProduct: "whatsapp",
		RecipientType:    "individual",
		To:               recipientPhone,
		Type:             "text",
		Text: &TextPayload{
			PreviewURL: false,
			Body:       text,
		},
	}

	var resp SendMessageResponse
	path := fmt.Sprintf("/%s/messages", phoneNumberID)
	if err := c.doRequest(ctx, http.MethodPost, path, payload, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *Client) SendMediaMessage(ctx context.Context, phoneNumberID string, recipientPhone string, mediaType string, mediaURL string, caption string) (*SendMessageResponse, error) {
	phoneNumberID = strings.TrimSpace(phoneNumberID)
	if phoneNumberID == "" {
		return nil, fmt.Errorf("phone_number_id is required")
	}
	recipientPhone = strings.TrimSpace(recipientPhone)
	if recipientPhone == "" {
		return nil, fmt.Errorf("recipient phone number is required")
	}
	mediaURL = strings.TrimSpace(mediaURL)
	if mediaURL == "" {
		return nil, fmt.Errorf("media url is required")
	}

	payload := SendTextMessageRequest{
		MessagingProduct: "whatsapp",
		RecipientType:    "individual",
		To:               recipientPhone,
	}

	if strings.ToLower(mediaType) == "image" {
		payload.Type = "image"
		payload.Image = &MediaPayload{
			Link:    mediaURL,
			Caption: caption,
		}
	} else {
		payload.Type = "document"
		payload.Document = &DocumentPayload{
			Link:     mediaURL,
			Caption:  caption,
			Filename: "attachment",
		}
	}

	var resp SendMessageResponse
	path := fmt.Sprintf("/%s/messages", phoneNumberID)
	if err := c.doRequest(ctx, http.MethodPost, path, payload, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *Client) doRequest(ctx context.Context, method, path string, payload any, result any) error {
	if c.accessToken == "" {
		return fmt.Errorf("whatsapp access token is required")
	}

	endpoint := fmt.Sprintf("%s%s", c.baseURL, path)

	var bodyReader io.Reader
	if payload != nil {
		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("marshal whatsapp request failed: %w", err)
		}
		bodyReader = bytes.NewBuffer(bodyBytes)
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, bodyReader)
	if err != nil {
		return fmt.Errorf("create whatsapp request failed: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.accessToken)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	res, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("whatsapp http request failed: %w", err)
	}
	defer res.Body.Close()

	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		return fmt.Errorf("read whatsapp response failed: %w", err)
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("whatsapp api error (%d): %s", res.StatusCode, string(bodyBytes))
	}

	if result != nil {
		if err := json.Unmarshal(bodyBytes, result); err != nil {
			return fmt.Errorf("unmarshal whatsapp response failed: %w (body: %s)", err, string(bodyBytes))
		}
	}
	return nil
}

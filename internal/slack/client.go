package slack

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

const defaultBaseURL = "https://slack.com/api"

// defaultOAuthHTTPClient is separate from the per-client one because the code
// exchange runs before a bot token exists, so there is no Client to hang it on.
var defaultOAuthHTTPClient = &http.Client{Timeout: 20 * time.Second}

type Client struct {
	botToken   string
	baseURL    string
	httpClient *http.Client
}

func NewClient(botToken string) *Client {
	return &Client{
		botToken:   strings.TrimSpace(botToken),
		baseURL:    defaultBaseURL,
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *Client) SetBaseURL(url string) {
	if strings.TrimSpace(url) != "" {
		c.baseURL = strings.TrimRight(strings.TrimSpace(url), "/")
	}
}

func (c *Client) PostMessage(ctx context.Context, channel string, text string, threadTS string) (*SendMessageResponse, error) {
	channel = strings.TrimSpace(channel)
	if channel == "" {
		return nil, fmt.Errorf("slack channel is required")
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, fmt.Errorf("message text is required")
	}

	payload := SendMessageRequest{
		Channel:  channel,
		Text:     text,
		ThreadTS: threadTS,
	}

	var resp SendMessageResponse
	if err := c.doRequest(ctx, "/chat.postMessage", payload, &resp); err != nil {
		return nil, err
	}
	if !resp.OK {
		return nil, fmt.Errorf("slack api error: %s", resp.Error)
	}
	return &resp, nil
}

// ExchangeOAuthCode swaps an installation code for the bot credentials of the
// workspace the app was just installed into.
//
// oauth.v2.access is form-encoded rather than JSON, and it answers HTTP 200 with
// ok:false for every application-level failure, so the envelope has to be read
// rather than the status code. redirectURI must be empty or byte-identical to the
// one that built the authorization URL; Slack rejects the exchange otherwise.
func ExchangeOAuthCode(ctx context.Context, baseURL, clientID, clientSecret, code, redirectURI string) (*OAuthAccessResponse, error) {
	clientID = strings.TrimSpace(clientID)
	clientSecret = strings.TrimSpace(clientSecret)
	code = strings.TrimSpace(code)
	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("slack client id and client secret are required to exchange an oauth code")
	}
	if code == "" {
		return nil, fmt.Errorf("slack oauth code is required")
	}

	form := url.Values{}
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	form.Set("code", code)
	if redirectURI = strings.TrimSpace(redirectURI); redirectURI != "" {
		form.Set("redirect_uri", redirectURI)
	}

	endpoint := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if endpoint == "" {
		endpoint = defaultBaseURL
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint+"/oauth.v2.access", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("create slack oauth request failed: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=utf-8")

	res, err := defaultOAuthHTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("slack oauth request failed: %w", err)
	}
	defer res.Body.Close()

	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, fmt.Errorf("read slack oauth response failed: %w", err)
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("slack oauth http error (%d): %s", res.StatusCode, string(bodyBytes))
	}

	var resp OAuthAccessResponse
	if err := json.Unmarshal(bodyBytes, &resp); err != nil {
		return nil, fmt.Errorf("unmarshal slack oauth response failed: %w (body: %s)", err, string(bodyBytes))
	}
	if !resp.OK {
		return nil, fmt.Errorf("slack oauth error: %s", slackErrorOrUnknown(resp.Error))
	}
	if strings.TrimSpace(resp.AccessToken) == "" {
		return nil, fmt.Errorf("slack oauth exchange returned no access token")
	}
	return &resp, nil
}

// AuthTest confirms a bot token is live and reports the workspace it belongs to.
func (c *Client) AuthTest(ctx context.Context) (*AuthTestResponse, error) {
	var resp AuthTestResponse
	if err := c.doRequest(ctx, "/auth.test", nil, &resp); err != nil {
		return nil, err
	}
	if !resp.OK {
		return nil, fmt.Errorf("slack auth.test error: %s", slackErrorOrUnknown(resp.Error))
	}
	return &resp, nil
}

func slackErrorOrUnknown(err string) string {
	if err = strings.TrimSpace(err); err != "" {
		return err
	}
	return "unknown_error"
}

func (c *Client) doRequest(ctx context.Context, path string, payload any, result any) error {
	if c.botToken == "" {
		return fmt.Errorf("slack bot token is required")
	}

	endpoint := fmt.Sprintf("%s%s", c.baseURL, path)

	var bodyReader io.Reader
	if payload != nil {
		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("marshal slack request failed: %w", err)
		}
		bodyReader = bytes.NewBuffer(bodyBytes)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bodyReader)
	if err != nil {
		return fmt.Errorf("create slack request failed: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.botToken)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json; charset=utf-8")
	}

	res, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("slack http request failed: %w", err)
	}
	defer res.Body.Close()

	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		return fmt.Errorf("read slack response failed: %w", err)
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("slack api error (%d): %s", res.StatusCode, string(bodyBytes))
	}

	if result != nil {
		if err := json.Unmarshal(bodyBytes, result); err != nil {
			return fmt.Errorf("unmarshal slack response failed: %w (body: %s)", err, string(bodyBytes))
		}
	}
	return nil
}

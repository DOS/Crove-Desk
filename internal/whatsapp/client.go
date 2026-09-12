package whatsapp

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

// maxMediaReadBytes caps a media download when the caller does not supply a
// project limit, so a malformed Content-Length or an oversized payload cannot
// exhaust memory while it is being buffered for storage.
const maxMediaReadBytes = 64 << 20

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

// SetHTTPClient replaces the transport and timeouts used for Graph API and media
// calls. It exists so a deployment can supply a proxy, and so tests can trust a
// local TLS stub.
func (c *Client) SetHTTPClient(client *http.Client) {
	if client != nil {
		c.httpClient = client
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
	return c.do(ctx, method, path, payload, result, true)
}

// do issues one Graph API call. authorize is false only for the OAuth code
// exchange, which runs before a token exists and authenticates with the app
// secret instead.
func (c *Client) do(ctx context.Context, method, path string, payload any, result any, authorize bool) error {
	if authorize && c.accessToken == "" {
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

	if authorize {
		req.Header.Set("Authorization", "Bearer "+c.accessToken)
	}
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

// get issues a GET against a Graph edge with the supplied query parameters.
func (c *Client) get(ctx context.Context, path string, query url.Values, result any) error {
	if encoded := query.Encode(); encoded != "" {
		path = path + "?" + encoded
	}
	return c.do(ctx, http.MethodGet, path, nil, result, true)
}

// GetMediaMetadata resolves an inbound media id into the short-lived download
// URL Meta issues for it.
func (c *Client) GetMediaMetadata(ctx context.Context, mediaID string) (*MediaMetadata, error) {
	mediaID = strings.TrimSpace(mediaID)
	if mediaID == "" {
		return nil, fmt.Errorf("media id is required")
	}

	query := url.Values{}
	query.Set("fields", "id,url,mime_type")

	var meta MediaMetadata
	if err := c.get(ctx, "/"+url.PathEscape(mediaID), query, &meta); err != nil {
		return nil, err
	}
	if strings.TrimSpace(meta.URL) == "" {
		return nil, fmt.Errorf("whatsapp media %s returned no download url", mediaID)
	}
	return &meta, nil
}

// DownloadMedia fetches the bytes behind a URL returned by GetMediaMetadata.
//
// maxBytes caps the buffered payload; when it is not positive the built-in
// ceiling is used. The URL is Meta-issued: it is read from a Graph API response
// we requested ourselves, so it is trusted to be an https endpoint, and anything
// else is rejected rather than followed.
func (c *Client) DownloadMedia(ctx context.Context, mediaURL string, maxBytes int64) ([]byte, string, error) {
	if c.accessToken == "" {
		return nil, "", fmt.Errorf("whatsapp access token is required")
	}
	parsed, err := url.Parse(strings.TrimSpace(mediaURL))
	if err != nil {
		return nil, "", fmt.Errorf("invalid whatsapp media url: %w", err)
	}
	if parsed.Scheme != "https" || parsed.Host == "" {
		return nil, "", fmt.Errorf("whatsapp media url must be https, got %q", parsed.Scheme)
	}
	if maxBytes <= 0 {
		maxBytes = maxMediaReadBytes
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, "", fmt.Errorf("create whatsapp media request failed: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.accessToken)

	res, err := c.httpClient.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("whatsapp media download failed: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, "", fmt.Errorf("whatsapp media download error (%d)", res.StatusCode)
	}
	if res.ContentLength > maxBytes {
		return nil, "", fmt.Errorf("whatsapp media is %d bytes, over the %d byte limit", res.ContentLength, maxBytes)
	}

	data, err := io.ReadAll(io.LimitReader(res.Body, maxBytes+1))
	if err != nil {
		return nil, "", fmt.Errorf("read whatsapp media failed: %w", err)
	}
	if int64(len(data)) > maxBytes {
		return nil, "", fmt.Errorf("whatsapp media exceeds the %d byte limit", maxBytes)
	}
	if len(data) == 0 {
		return nil, "", fmt.Errorf("whatsapp media download returned an empty payload")
	}

	contentType := strings.TrimSpace(res.Header.Get("Content-Type"))
	if contentType == "" {
		contentType = strings.TrimSpace(http.DetectContentType(data))
	}
	return data, contentType, nil
}

// ExchangeCodeForToken swaps an OAuth authorization code for an access token.
//
// redirectURI must be empty or byte-identical to the one used to build the
// authorization URL; Meta rejects the exchange otherwise. It is omitted when
// blank because the Embedded Signup code exchange does not require it.
func (c *Client) ExchangeCodeForToken(ctx context.Context, clientID, clientSecret, code, redirectURI string) (*OAuthToken, error) {
	clientID = strings.TrimSpace(clientID)
	clientSecret = strings.TrimSpace(clientSecret)
	code = strings.TrimSpace(code)
	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("meta app id and app secret are required to exchange an oauth code")
	}
	if code == "" {
		return nil, fmt.Errorf("oauth code is required")
	}

	query := url.Values{}
	query.Set("client_id", clientID)
	query.Set("client_secret", clientSecret)
	query.Set("code", code)
	if redirectURI = strings.TrimSpace(redirectURI); redirectURI != "" {
		query.Set("redirect_uri", redirectURI)
	}

	var token OAuthToken
	if err := c.do(ctx, http.MethodGet, "/oauth/access_token?"+query.Encode(), nil, &token, false); err != nil {
		return nil, err
	}
	if token.Error != nil {
		return nil, fmt.Errorf("whatsapp oauth error (%d): %s", token.Error.Code, token.Error.Message)
	}
	if strings.TrimSpace(token.AccessToken) == "" {
		return nil, fmt.Errorf("whatsapp oauth exchange returned no access token")
	}
	return &token, nil
}

// DebugToken reports what an access token is authorised for. The app-scoped
// token authenticates the call, so this uses the client's own token.
func (c *Client) DebugToken(ctx context.Context, inputToken string) (*DebugTokenData, error) {
	inputToken = strings.TrimSpace(inputToken)
	if inputToken == "" {
		return nil, fmt.Errorf("input token is required")
	}

	query := url.Values{}
	query.Set("input_token", inputToken)

	var resp DebugTokenResponse
	if err := c.get(ctx, "/debug_token", query, &resp); err != nil {
		return nil, err
	}
	return &resp.Data, nil
}

// ListBusinesses returns the Meta business portfolios reachable with this token.
func (c *Client) ListBusinesses(ctx context.Context) ([]Business, error) {
	query := url.Values{}
	query.Set("fields", "id,name")

	var list GraphList[Business]
	if err := c.get(ctx, "/me/businesses", query, &list); err != nil {
		return nil, err
	}
	return list.Data, nil
}

// ListOwnedWhatsAppBusinessAccounts returns the WhatsApp Business Accounts a
// business portfolio owns. It needs an admin system user token and the
// whatsapp_business_management permission; without advanced access Meta answers
// with error code 200 and an empty list rather than a failure.
func (c *Client) ListOwnedWhatsAppBusinessAccounts(ctx context.Context, businessID string) ([]WhatsAppBusinessAccount, error) {
	businessID = strings.TrimSpace(businessID)
	if businessID == "" {
		return nil, fmt.Errorf("business id is required")
	}

	query := url.Values{}
	query.Set("fields", "id,name,message_template_namespace,phone_number")

	var list GraphList[WhatsAppBusinessAccount]
	if err := c.get(ctx, "/"+url.PathEscape(businessID)+"/owned_whatsapp_business_accounts", query, &list); err != nil {
		return nil, err
	}
	return list.Data, nil
}

// ListPhoneNumbers returns the sender numbers registered on a WhatsApp Business
// Account, which is where the phone_number_id needed to send messages comes from.
func (c *Client) ListPhoneNumbers(ctx context.Context, wabaID string) ([]WhatsAppPhoneNumber, error) {
	wabaID = strings.TrimSpace(wabaID)
	if wabaID == "" {
		return nil, fmt.Errorf("whatsapp business account id is required")
	}

	query := url.Values{}
	query.Set("fields", "id,display_phone_number,verified_name,quality_rating,code_verification_status")

	var list GraphList[WhatsAppPhoneNumber]
	if err := c.get(ctx, "/"+url.PathEscape(wabaID)+"/phone_numbers", query, &list); err != nil {
		return nil, err
	}
	return list.Data, nil
}

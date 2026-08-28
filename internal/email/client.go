package email

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/mail"
	"net/smtp"
	"strings"
	"time"
)

const (
	defaultBrevoBaseURL = "https://api.brevo.com/v3"
	defaultTimeout      = 15 * time.Second
)

type Client interface {
	SendEmail(ctx context.Context, req SendEmailParams) error
}

type SendEmailParams struct {
	FromEmail string
	FromName  string
	ToEmail   string
	ToName    string
	Subject   string
	BodyText  string
	BodyHTML  string
	InReplyTo string
}

type emailClient struct {
	provider     string
	apiKey       string
	brevoBaseURL string
	smtpHost     string
	smtpPort     int
	smtpUser     string
	smtpPassword string
	httpClient   *http.Client
}

type ClientConfig struct {
	Provider     string
	APIKey       string
	BrevoBaseURL string
	SMTPHost     string
	SMTPPort     int
	SMTPUser     string
	SMTPPassword string
	HTTPClient   *http.Client
}

func NewClient(cfg ClientConfig) Client {
	provider := strings.ToLower(strings.TrimSpace(cfg.Provider))
	if provider == "" {
		if cfg.APIKey != "" {
			provider = "brevo"
		} else {
			provider = "smtp"
		}
	}
	brevoBaseURL := strings.TrimRight(strings.TrimSpace(cfg.BrevoBaseURL), "/")
	if brevoBaseURL == "" {
		brevoBaseURL = defaultBrevoBaseURL
	}
	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: defaultTimeout}
	}
	smtpPort := cfg.SMTPPort
	if smtpPort <= 0 {
		smtpPort = 587
	}
	return &emailClient{
		provider:     provider,
		apiKey:       strings.TrimSpace(cfg.APIKey),
		brevoBaseURL: brevoBaseURL,
		smtpHost:     strings.TrimSpace(cfg.SMTPHost),
		smtpPort:     smtpPort,
		smtpUser:     strings.TrimSpace(cfg.SMTPUser),
		smtpPassword: strings.TrimSpace(cfg.SMTPPassword),
		httpClient:   httpClient,
	}
}

func (c *emailClient) SendEmail(ctx context.Context, req SendEmailParams) error {
	req.FromEmail = strings.TrimSpace(req.FromEmail)
	req.ToEmail = strings.TrimSpace(req.ToEmail)
	if req.FromEmail == "" || req.ToEmail == "" {
		return fmt.Errorf("fromEmail and toEmail are required")
	}
	if req.Subject == "" {
		req.Subject = "Support Notification"
	}

	if c.provider == "brevo" || (c.apiKey != "" && c.smtpHost == "") {
		return c.sendViaBrevo(ctx, req)
	}
	return c.sendViaSMTP(ctx, req)
}

func (c *emailClient) sendViaBrevo(ctx context.Context, req SendEmailParams) error {
	url := fmt.Sprintf("%s/smtp/email", c.brevoBaseURL)
	senderName := req.FromName
	if senderName == "" {
		senderName = "Crove Desk Support"
	}
	payload := BrevoSendEmailRequest{
		Sender: BrevoEmailContact{
			Name:  senderName,
			Email: req.FromEmail,
		},
		To: []BrevoEmailContact{
			{
				Name:  req.ToName,
				Email: req.ToEmail,
			},
		},
		Subject:     req.Subject,
		TextContent: req.BodyText,
		HTMLContent: req.BodyHTML,
	}
	if payload.HTMLContent == "" && payload.TextContent != "" {
		payload.HTMLContent = fmt.Sprintf("<div style=\"font-family: sans-serif; line-height: 1.5;\">%s</div>", strings.ReplaceAll(payload.TextContent, "\n", "<br/>"))
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal brevo request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("failed to create http request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("api-key", c.apiKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("brevo request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("brevo api error (status %d): %s", resp.StatusCode, string(respBody))
	}
	slog.Info("email successfully sent via brevo", "to", req.ToEmail, "subject", req.Subject)
	return nil
}

func (c *emailClient) sendViaSMTP(ctx context.Context, req SendEmailParams) error {
	if c.smtpHost == "" {
		return fmt.Errorf("smtp host is not configured")
	}

	addr := fmt.Sprintf("%s:%d", c.smtpHost, c.smtpPort)
	fromHeader := req.FromEmail
	if req.FromName != "" {
		fromHeader = fmt.Sprintf("%s <%s>", req.FromName, req.FromEmail)
	}

	header := make(map[string]string)
	header["From"] = fromHeader
	header["To"] = req.ToEmail
	header["Subject"] = req.Subject
	header["MIME-Version"] = "1.0"
	if req.InReplyTo != "" {
		header["In-Reply-To"] = req.InReplyTo
		header["References"] = req.InReplyTo
	}

	contentType := "text/plain; charset=UTF-8"
	body := req.BodyText
	if req.BodyHTML != "" {
		contentType = "text/html; charset=UTF-8"
		body = req.BodyHTML
	}
	header["Content-Type"] = contentType

	var msg bytes.Buffer
	for k, v := range header {
		msg.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}
	msg.WriteString("\r\n")
	msg.WriteString(body)

	var auth smtp.Auth
	if c.smtpUser != "" && c.smtpPassword != "" {
		auth = smtp.PlainAuth("", c.smtpUser, c.smtpPassword, c.smtpHost)
	}

	// Dial with timeout and TLS support
	tlsConfig := &tls.Config{
		ServerName: c.smtpHost,
	}

	var client *smtp.Client
	var err error

	if c.smtpPort == 465 {
		conn, err := tls.DialWithDialer(&net.Dialer{Timeout: defaultTimeout}, "tcp", addr, tlsConfig)
		if err != nil {
			return fmt.Errorf("failed to connect via tls: %w", err)
		}
		client, err = smtp.NewClient(conn, c.smtpHost)
		if err != nil {
			return fmt.Errorf("failed to create smtp client: %w", err)
		}
	} else {
		conn, err := net.DialTimeout("tcp", addr, defaultTimeout)
		if err != nil {
			return fmt.Errorf("failed to dial smtp: %w", err)
		}
		client, err = smtp.NewClient(conn, c.smtpHost)
		if err != nil {
			return fmt.Errorf("failed to create smtp client: %w", err)
		}
		if ok, _ := client.Extension("STARTTLS"); ok {
			if err = client.StartTLS(tlsConfig); err != nil {
				return fmt.Errorf("failed to starttls: %w", err)
			}
		}
	}
	defer client.Quit()

	if auth != nil {
		if ok, _ := client.Extension("AUTH"); ok {
			if err = client.Auth(auth); err != nil {
				return fmt.Errorf("smtp auth failed: %w", err)
			}
		}
	}

	if err = client.Mail(req.FromEmail); err != nil {
		return fmt.Errorf("smtp mail from failed: %w", err)
	}
	if err = client.Rcpt(req.ToEmail); err != nil {
		return fmt.Errorf("smtp rcpt to failed: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data command failed: %w", err)
	}
	_, err = w.Write(msg.Bytes())
	if err != nil {
		return fmt.Errorf("failed to write email body: %w", err)
	}
	err = w.Close()
	if err != nil {
		return fmt.Errorf("failed to close email writer: %w", err)
	}

	slog.Info("email successfully sent via smtp", "to", req.ToEmail, "subject", req.Subject)
	return nil
}

// ParseAddress parses a raw email string like "John Doe <john@example.com>" into email and name.
func ParseAddress(raw string) (emailStr string, nameStr string) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", ""
	}
	parsed, err := mail.ParseAddress(raw)
	if err == nil && parsed != nil {
		return strings.ToLower(strings.TrimSpace(parsed.Address)), strings.TrimSpace(parsed.Name)
	}
	return strings.ToLower(raw), ""
}

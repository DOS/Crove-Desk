package email

// BrevoSendEmailRequest represents payload to Brevo SMTP email API.
type BrevoSendEmailRequest struct {
	Sender      BrevoEmailContact   `json:"sender"`
	To          []BrevoEmailContact `json:"to"`
	Subject     string              `json:"subject"`
	HTMLContent string              `json:"htmlContent,omitempty"`
	TextContent string              `json:"textContent,omitempty"`
	ReplyTo     *BrevoEmailContact  `json:"replyTo,omitempty"`
}

type BrevoEmailContact struct {
	Name  string `json:"name,omitempty"`
	Email string `json:"email"`
}

// BrevoSendEmailResponse represents Brevo API response.
type BrevoSendEmailResponse struct {
	MessageID string `json:"messageId,omitempty"`
	Code      string `json:"code,omitempty"`
	Message   string `json:"message,omitempty"`
}

// InboundEmailPayload represents normalized parsed inbound email.
type InboundEmailPayload struct {
	FromEmail string `json:"fromEmail"`
	FromName  string `json:"fromName,omitempty"`
	ToEmail   string `json:"toEmail"`
	Subject   string `json:"subject"`
	BodyText  string `json:"bodyText"`
	BodyHTML  string `json:"bodyHtml,omitempty"`
	MessageID string `json:"messageId,omitempty"`
	InReplyTo string `json:"inReplyTo,omitempty"`
}

// GenericInboundWebhook represents standard webhook JSON format.
type GenericInboundWebhook struct {
	From      string `json:"from"`
	FromName  string `json:"from_name,omitempty"`
	To        string `json:"to"`
	Subject   string `json:"subject"`
	Text      string `json:"text,omitempty"`
	HTML      string `json:"html,omitempty"`
	Body      string `json:"body,omitempty"`
	MessageID string `json:"message_id,omitempty"`
	InReplyTo string `json:"in_reply_to,omitempty"`
}

// BrevoInboundItem represents an item in Brevo inbound webhook.
type BrevoInboundItem struct {
	UUID        []string `json:"Uuid,omitempty"`
	Sender      string   `json:"Sender,omitempty"`
	Recipient   string   `json:"Recipient,omitempty"`
	Subject     string   `json:"Subject,omitempty"`
	RawHTMLBody string   `json:"RawHtmlBody,omitempty"`
	RawTextBody string   `json:"RawTextBody,omitempty"`
}

// BrevoInboundWebhook represents Brevo inbound event payload.
type BrevoInboundWebhook struct {
	Items []BrevoInboundItem `json:"items,omitempty"`
}

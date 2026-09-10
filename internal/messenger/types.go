package messenger

// Recipient represents recipient of a Messenger message (PSID).
type Recipient struct {
	ID string `json:"id"`
}

// OutgoingAttachmentPayload represents payload of an outgoing media attachment.
type OutgoingAttachmentPayload struct {
	URL        string `json:"url"`
	IsReusable bool   `json:"is_reusable,omitempty"`
}

// OutgoingAttachment represents an attachment sent via Send API.
type OutgoingAttachment struct {
	Type    string                    `json:"type"` // image | audio | video | file | template
	Payload OutgoingAttachmentPayload `json:"payload"`
}

// OutgoingMessage represents text or media content to send to Facebook Messenger.
type OutgoingMessage struct {
	Text       string              `json:"text,omitempty"`
	Attachment *OutgoingAttachment `json:"attachment,omitempty"`
}

// SendMessageRequest represents payload for Meta Graph Send API.
type SendMessageRequest struct {
	Recipient     Recipient       `json:"recipient"`
	Message       OutgoingMessage `json:"message"`
	MessagingType string          `json:"messaging_type,omitempty"`
}

// SendMessageResponse represents response from Meta Graph Send API.
type SendMessageResponse struct {
	RecipientID string `json:"recipient_id"`
	MessageID   string `json:"message_id"`
}

// PageInfo represents Facebook Page details.
type PageInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// WebhookSender represents sender or recipient in a webhook event.
type WebhookSender struct {
	ID string `json:"id"`
}

// WebhookAttachmentData represents payload of an incoming webhook attachment.
type WebhookAttachmentData struct {
	URL   string `json:"url"`
	Title string `json:"title,omitempty"`
}

// WebhookAttachment represents an attachment in an incoming webhook.
type WebhookAttachment struct {
	Type    string                `json:"type"` // image | audio | video | file | fallback
	Payload WebhookAttachmentData `json:"payload"`
}

// WebhookMessage represents message data in a webhook event.
type WebhookMessage struct {
	MID         string              `json:"mid"`
	Text        string              `json:"text,omitempty"`
	Attachments []WebhookAttachment `json:"attachments,omitempty"`
}

// WebhookMessaging represents messaging object inside an entry.
type WebhookMessaging struct {
	Sender    WebhookSender   `json:"sender"`
	Recipient WebhookSender   `json:"recipient"`
	Timestamp int64           `json:"timestamp"`
	Message   *WebhookMessage `json:"message,omitempty"`
}

// WebhookEntry represents an entry within the webhook payload.
type WebhookEntry struct {
	ID        string             `json:"id"`
	Time      int64              `json:"time"`
	Messaging []WebhookMessaging `json:"messaging"`
}

// WebhookEvent represents root Facebook Messenger webhook payload.
type WebhookEvent struct {
	Object string         `json:"object"`
	Entry  []WebhookEntry `json:"entry"`
}

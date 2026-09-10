package tiktok

// SendMessageRequest represents payload for TikTok Business Direct Message Send API.
type SendMessageRequest struct {
	ToUserID    string `json:"to_user_id"`
	MessageType string `json:"message_type"` // text | image | video
	Content     string `json:"content"`
}

// SendMessageResponse represents response from TikTok Business API.
type SendMessageResponse struct {
	Code      int    `json:"code"`
	Message   string `json:"message"`
	RequestID string `json:"request_id"`
	Data      struct {
		MessageID string `json:"message_id"`
	} `json:"data"`
}

// WebhookEvent represents incoming TikTok Webhook event payload.
type WebhookEvent struct {
	Event      string `json:"event"`
	ClientKey  string `json:"client_key"`
	EventID    string `json:"event_id"`
	CreateTime int64  `json:"create_time"`
	FromUserID string `json:"from_user_id"`
	ToUserID   string `json:"to_user_id"`
	MsgType    string `json:"message_type"`
	Content    string `json:"content"`
	Challenge  string `json:"challenge,omitempty"` // For initial verification if challenged
}

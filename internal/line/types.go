package line

// WebhookEvent is the top-level webhook payload sent by the LINE Platform.
type WebhookEvent struct {
	Destination string  `json:"destination,omitempty"`
	Events      []Event `json:"events,omitempty"`
}

// Event is a single webhook event object.
type Event struct {
	Type       string  `json:"type,omitempty"` // message | follow | unfollow | join | leave | postback ...
	ReplyToken string  `json:"replyToken,omitempty"`
	Source     *Source `json:"source,omitempty"`
	Message    *Msg    `json:"message,omitempty"`
	Timestamp  int64   `json:"timestamp,omitempty"`
}

// Source describes where the event came from.
type Source struct {
	Type   string `json:"type,omitempty"` // user | group | room
	UserID string `json:"userId,omitempty"`
}

// Msg is the message object carried by a message event.
type Msg struct {
	ID   string `json:"id,omitempty"`
	Type string `json:"type,omitempty"` // text | image | video | audio | file | sticker ...
	Text string `json:"text,omitempty"`
}

// PushMessageRequest is the request body of the send push message endpoint.
type PushMessageRequest struct {
	To       string          `json:"to"`
	Messages []MessageObject `json:"messages"`
}

// MessageObject is a message to be sent to a user.
type MessageObject struct {
	Type string `json:"type"` // text
	Text string `json:"text"`
}

// PushMessageResponse is the response of the push message endpoint.
type PushMessageResponse struct {
	SentMessages []SentMessage `json:"sentMessages,omitempty"`
}

// SentMessage describes a message accepted by the LINE Platform.
type SentMessage struct {
	ID string `json:"id,omitempty"`
}

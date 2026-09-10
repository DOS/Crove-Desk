package viber

// Callback is the incoming callback payload pushed by Viber to the webhook.
type Callback struct {
	Event        string      `json:"event,omitempty"` // message | conversation_started | subscribed | unsubscribed | delivered | seen | failed
	Timestamp    int64       `json:"timestamp,omitempty"`
	MessageToken int64       `json:"message_token,omitempty"`
	Sender       *UserRef    `json:"sender,omitempty"`
	User         *UserRef    `json:"user,omitempty"`
	Message      *Msg        `json:"message,omitempty"`
	Silent       bool        `json:"silent,omitempty"`
	Declined     *FailedInfo `json:"declined_reason,omitempty"`
}

// UserRef identifies a Viber user.
type UserRef struct {
	ID     string `json:"id,omitempty"`
	Name   string `json:"name,omitempty"`
	Avatar string `json:"avatar,omitempty"`
}

// Msg is the message object carried by a message event.
type Msg struct {
	Type    string `json:"type,omitempty"` // text | picture | video | file | contact | location | url ...
	Text    string `json:"text,omitempty"`
	Media   string `json:"media,omitempty"`
	Contact *struct {
		Name        string `json:"name,omitempty"`
		PhoneNumber string `json:"phone_number,omitempty"`
	} `json:"contact,omitempty"`
}

// FailedInfo describes why a message delivery failed.
type FailedInfo struct {
	Description string `json:"description,omitempty"`
}

// SendTextRequest is the request body of the send_message API.
type SendTextRequest struct {
	Receiver string     `json:"receiver"`
	Type     string     `json:"type"`
	Text     string     `json:"text"`
	Sender   *SenderRef `json:"sender,omitempty"`
}

// SenderRef describes the sender displayed to the Viber user.
type SenderRef struct {
	Name   string `json:"name,omitempty"`
	Avatar string `json:"avatar,omitempty"`
}

// SendResponse is the response of the send_message API.
type SendResponse struct {
	Status        int    `json:"status"`
	StatusMessage string `json:"status_message,omitempty"`
	MessageToken  int64  `json:"message_token,omitempty"`
}

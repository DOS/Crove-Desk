package x

// SendDMRequest represents payload for X (Twitter) Direct Message API v2.
type SendDMRequest struct {
	Text string `json:"text"`
}

// SendDMResponse represents response from X API v2.
type SendDMResponse struct {
	Data struct {
		DMConversationID string `json:"dm_conversation_id"`
		DMEventID        string `json:"dm_event_id"`
	} `json:"data"`
	Errors []struct {
		Title  string `json:"title"`
		Detail string `json:"detail"`
	} `json:"errors,omitempty"`
}

// WebhookEvent represents incoming Account Activity API payload from X.
type WebhookEvent struct {
	ForUserID           string `json:"for_user_id"`
	DirectMessageEvents []struct {
		Type             string `json:"type"`
		ID               string `json:"id"`
		CreatedTimestamp string `json:"created_timestamp"`
		MessageCreate    struct {
			Target struct {
				RecipientID string `json:"recipient_id"`
			} `json:"target"`
			SenderID    string `json:"sender_id"`
			MessageData struct {
				Text       string `json:"text"`
				Attachment *struct {
					Type  string `json:"type"`
					Media struct {
						ID       int64  `json:"id"`
						MediaURL string `json:"media_url_https"`
					} `json:"media"`
				} `json:"attachment,omitempty"`
			} `json:"message_data"`
		} `json:"message_create"`
	} `json:"direct_message_events"`
}

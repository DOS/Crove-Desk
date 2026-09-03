package whatsapp

// SendTextMessageRequest represents payload to send text message via WhatsApp Cloud API.
type SendTextMessageRequest struct {
	MessagingProduct string           `json:"messaging_product"`
	RecipientType    string           `json:"recipient_type"`
	To               string           `json:"to"`
	Type             string           `json:"type"`
	Text             *TextPayload     `json:"text,omitempty"`
	Image            *MediaPayload    `json:"image,omitempty"`
	Document         *DocumentPayload `json:"document,omitempty"`
}

type TextPayload struct {
	PreviewURL bool   `json:"preview_url,omitempty"`
	Body       string `json:"body"`
}

type MediaPayload struct {
	Link    string `json:"link,omitempty"`
	Caption string `json:"caption,omitempty"`
}

type DocumentPayload struct {
	Link     string `json:"link,omitempty"`
	Caption  string `json:"caption,omitempty"`
	Filename string `json:"filename,omitempty"`
}

type SendMessageResponse struct {
	MessagingProduct string `json:"messaging_product"`
	Contacts         []struct {
		Input string `json:"input"`
		WaID  string `json:"wa_id"`
	} `json:"contacts"`
	Messages []struct {
		ID string `json:"id"`
	} `json:"messages"`
}

// WebhookEvent represents incoming WhatsApp Webhook payload from Meta.
type WebhookEvent struct {
	Object string `json:"object"`
	Entry  []struct {
		ID      string `json:"id"`
		Changes []struct {
			Field string `json:"field"`
			Value struct {
				MessagingProduct string `json:"messaging_product"`
				Metadata         struct {
					DisplayPhoneNumber string `json:"display_phone_number"`
					PhoneNumberID      string `json:"phone_number_id"`
				} `json:"metadata"`
				Contacts []struct {
					Profile struct {
						Name string `json:"name"`
					} `json:"profile"`
					WaID string `json:"wa_id"`
				} `json:"contacts"`
				Messages []struct {
					From      string `json:"from"`
					ID        string `json:"id"`
					Timestamp string `json:"timestamp"`
					Type      string `json:"type"`
					Text      *struct {
						Body string `json:"body"`
					} `json:"text,omitempty"`
					Image *struct {
						ID       string `json:"id"`
						MimeType string `json:"mime_type"`
						Caption  string `json:"caption,omitempty"`
					} `json:"image,omitempty"`
					Document *struct {
						ID       string `json:"id"`
						Filename string `json:"filename"`
						Caption  string `json:"caption,omitempty"`
					} `json:"document,omitempty"`
				} `json:"messages"`
			} `json:"value"`
		} `json:"changes"`
	} `json:"entry"`
}

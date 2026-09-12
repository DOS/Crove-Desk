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

// MediaMetadata is the result of resolving an inbound media id. The URL Meta
// hands back is a short-lived lookaside link that only answers a request
// carrying the same access token, so it has to be downloaded server-side
// immediately instead of being stored on the message.
type MediaMetadata struct {
	ID       string `json:"id"`
	URL      string `json:"url"`
	MimeType string `json:"mime_type"`
	Size     int64  `json:"size"`
}

// Inbound message types as they appear in the webhook `type` field.
const (
	MessageTypeText        = "text"
	MessageTypeImage       = "image"
	MessageTypeDocument    = "document"
	MessageTypeAudio       = "audio"
	MessageTypeVoice       = "voice"
	MessageTypeVideo       = "video"
	MessageTypeSticker     = "sticker"
	MessageTypeLocation    = "location"
	MessageTypeContacts    = "contacts"
	MessageTypeInteractive = "interactive"
	MessageTypeReaction    = "reaction"
	MessageTypeButton      = "button"
	MessageTypeOrder       = "order"
	MessageTypeUnsupported = "unsupported"
)

// TextRef carries the body of an inbound text message.
type TextRef struct {
	Body string `json:"body"`
}

// MediaRef identifies a stored media object for image, audio, voice and video.
type MediaRef struct {
	ID       string `json:"id"`
	MimeType string `json:"mime_type,omitempty"`
	Caption  string `json:"caption,omitempty"`
	Sha256   string `json:"sha256,omitempty"`
}

// DocumentRef is MediaRef plus the sender-supplied file name.
type DocumentRef struct {
	ID       string `json:"id"`
	MimeType string `json:"mime_type,omitempty"`
	Filename string `json:"filename,omitempty"`
	Caption  string `json:"caption,omitempty"`
	Sha256   string `json:"sha256,omitempty"`
}

// StickerRef describes an inbound sticker. Animated stickers arrive as
// image/webp and cannot be rendered as a still image.
type StickerRef struct {
	ID       string `json:"id"`
	MimeType string `json:"mime_type,omitempty"`
	Sha256   string `json:"sha256,omitempty"`
	Animated bool   `json:"animated,omitempty"`
}

// LocationPayload is a shared live or static location.
type LocationPayload struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Name      string  `json:"name,omitempty"`
	Address   string  `json:"address,omitempty"`
}

// InteractivePayload covers replies to template and list buttons we sent.
type InteractivePayload struct {
	Type        string `json:"type"`
	ButtonReply *struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	} `json:"button_reply,omitempty"`
	ListReply *struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	} `json:"list_reply,omitempty"`
	NFMReply *struct {
		Name string `json:"name"`
		Body string `json:"body"`
	} `json:"nfm_reply,omitempty"`
}

// ReactionPayload is an emoji reaction to one of our own messages.
type ReactionPayload struct {
	MessageID string `json:"message_id"`
	Emoji     string `json:"emoji"`
}

// ButtonPayload is the legacy interactive button reply.
type ButtonPayload struct {
	Payload string `json:"payload"`
	Text    string `json:"text"`
}

// ContactRef is one shared contact card. Only the fields a support agent can
// act on are decoded; the rest of the card is preserved in the raw webhook.
type ContactRef struct {
	Name struct {
		FormattedName string `json:"formatted_name"`
		FirstName     string `json:"first_name,omitempty"`
		LastName      string `json:"last_name,omitempty"`
	} `json:"name"`
	Phones []struct {
		Phone string `json:"phone,omitempty"`
		Type  string `json:"type,omitempty"`
	} `json:"phones,omitempty"`
	Emails []struct {
		Email string `json:"email,omitempty"`
		Type  string `json:"type,omitempty"`
	} `json:"emails,omitempty"`
}

// WebhookError accompanies a message Meta could not deliver or decode.
type WebhookError struct {
	Code    int    `json:"code"`
	Title   string `json:"title"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// InboundMessage is a single customer message inside a webhook change.
type InboundMessage struct {
	From      string `json:"from"`
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	Type      string `json:"type"`

	Text        *TextRef            `json:"text,omitempty"`
	Image       *MediaRef           `json:"image,omitempty"`
	Document    *DocumentRef        `json:"document,omitempty"`
	Audio       *MediaRef           `json:"audio,omitempty"`
	Voice       *MediaRef           `json:"voice,omitempty"`
	Video       *MediaRef           `json:"video,omitempty"`
	Sticker     *StickerRef         `json:"sticker,omitempty"`
	Location    *LocationPayload    `json:"location,omitempty"`
	Contacts    []ContactRef        `json:"contacts,omitempty"`
	Interactive *InteractivePayload `json:"interactive,omitempty"`
	Reaction    *ReactionPayload    `json:"reaction,omitempty"`
	Button      *ButtonPayload      `json:"button,omitempty"`
	Errors      []WebhookError      `json:"errors,omitempty"`
	Context     *InboundMessageRef  `json:"context,omitempty"`
}

// InboundMessageRef links a reply back to the message it answers.
type InboundMessageRef struct {
	ID              string `json:"id"`
	From            string `json:"from,omitempty"`
	ReferredProduct string `json:"referred_product,omitempty"`
}

// InboundContact is the sender profile Meta attaches alongside messages.
type InboundContact struct {
	Profile struct {
		Name string `json:"name"`
	} `json:"profile"`
	WaID string `json:"wa_id"`
}

// InboundMetadata identifies which of our phone numbers received the message.
type InboundMetadata struct {
	DisplayPhoneNumber string `json:"display_phone_number"`
	PhoneNumberID      string `json:"phone_number_id"`
}

// InboundChangeValue is the `value` object of a `messages` webhook change.
type InboundChangeValue struct {
	MessagingProduct string           `json:"messaging_product"`
	Metadata         InboundMetadata  `json:"metadata"`
	Contacts         []InboundContact `json:"contacts"`
	Messages         []InboundMessage `json:"messages"`
	Errors           []WebhookError   `json:"errors"`
}

// InboundChange is one field/value pair in a webhook entry.
type InboundChange struct {
	Field string             `json:"field"`
	Value InboundChangeValue `json:"value"`
}

// InboundEntry is one WhatsApp Business Account in a webhook delivery.
type InboundEntry struct {
	ID      string          `json:"id"`
	Changes []InboundChange `json:"changes"`
}

// WebhookEvent represents incoming WhatsApp Webhook payload from Meta.
type WebhookEvent struct {
	Object string         `json:"object"`
	Entry  []InboundEntry `json:"entry"`
}

// OAuthToken is the response of the code exchange. Embedded Signup returns a
// business token that expires roughly 60 days out; expires_in is in seconds and
// absent for tokens that do not expire.
type OAuthToken struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int64  `json:"expires_in"`
	Error       *struct {
		Message      string `json:"message"`
		Type         string `json:"type"`
		Code         int    `json:"code"`
		ErrorSubcode int    `json:"error_subcode"`
	} `json:"error,omitempty"`
}

// DebugTokenData reports what a token is actually authorised for.
type DebugTokenData struct {
	AppID               string   `json:"app_id"`
	Type                string   `json:"type"`
	Application         string   `json:"application"`
	DataAccessExpiresAt int64    `json:"data_access_expires_at"`
	ExpiresAt           int64    `json:"expires_at"`
	IsValid             bool     `json:"is_valid"`
	Scopes              []string `json:"scopes"`
	UserID              string   `json:"user_id"`
	Error               *struct {
		Message string `json:"message"`
		Code    int    `json:"code"`
	} `json:"error,omitempty"`
}

type DebugTokenResponse struct {
	Data DebugTokenData `json:"data"`
}

// Business is a Meta business portfolio that owns WhatsApp Business Accounts.
type Business struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// WhatsAppBusinessAccount is a WABA under a business portfolio.
type WhatsAppBusinessAccount struct {
	ID                       string `json:"id"`
	Name                     string `json:"name"`
	MessageTemplateNamespace string `json:"message_template_namespace"`
	PhoneNumber              string `json:"phone_number"`
}

// WhatsAppPhoneNumber is a sender number registered on a WABA.
type WhatsAppPhoneNumber struct {
	ID                     string `json:"id"`
	DisplayPhoneNumber     string `json:"display_phone_number"`
	VerifiedName           string `json:"verified_name"`
	QualityRating          string `json:"quality_rating"`
	CodeVerificationStatus string `json:"code_verification_status"`
}

// GraphList wraps the `data` envelope every Graph API list edge returns.
type GraphList[T any] struct {
	Data []T `json:"data"`
}

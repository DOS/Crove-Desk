package threads

// WebhookPayload is the incoming webhook payload pushed by Meta.
//
// Threads webhooks are delivered in the standard Meta envelope
// (object/entry/changes) or, per the Threads webhook documentation,
// in a topic/values envelope. Both shapes are supported.
type WebhookPayload struct {
	Object string         `json:"object,omitempty"`
	Entry  []Entry        `json:"entry,omitempty"`
	Topic  string         `json:"topic,omitempty"`
	Values *ValuesWrapper `json:"values,omitempty"`
}

// Entry is one entry of the standard Meta webhook envelope.
type Entry struct {
	ID      string   `json:"id,omitempty"`
	Time    int64    `json:"time,omitempty"`
	Changes []Change `json:"changes,omitempty"`
}

// Change is one field change of a Meta webhook entry.
type Change struct {
	Field string        `json:"field,omitempty"` // replies | mentions | publish | delete
	Value *WebhookValue `json:"value,omitempty"`
}

// ValuesWrapper is the values envelope of the topic-style payload.
type ValuesWrapper struct {
	Field string        `json:"field,omitempty"` // replies | mentions | publish | delete
	Value *WebhookValue `json:"value,omitempty"`
}

// WebhookValue carries the reply/post object of a webhook event.
type WebhookValue struct {
	Event     string   `json:"event,omitempty"` // published | ...
	ID        string   `json:"id,omitempty"`
	MediaID   string   `json:"media_id,omitempty"`
	Text      string   `json:"text,omitempty"`
	Username  string   `json:"username,omitempty"`
	MediaType string   `json:"media_type,omitempty"` // TEXT_POST | IMAGE | VIDEO ...
	Permalink string   `json:"permalink,omitempty"`
	Shortcode string   `json:"shortcode,omitempty"`
	Timestamp string   `json:"timestamp,omitempty"`
	RepliedTo *PostRef `json:"replied_to,omitempty"`
	RootPost  *PostRef `json:"root_post,omitempty"`
	OwnerID   string   `json:"owner_id,omitempty"`
}

// PostRef references another Threads media object.
type PostRef struct {
	ID       string `json:"id,omitempty"`
	OwnerID  string `json:"owner_id,omitempty"`
	Username string `json:"username,omitempty"`
}

// ReplyRef is the media id a reply targets.
type ReplyRef struct {
	ID string `json:"id"`
}

// CreateContainerRequest publishes a TEXT container via form parameters.
type CreateContainerRequest struct {
	ThreadsUserID string
	Text          string
	ReplyToID     string
}

// ContainerResponse is the response of the media container creation endpoint.
type ContainerResponse struct {
	ID string `json:"id,omitempty"`
}

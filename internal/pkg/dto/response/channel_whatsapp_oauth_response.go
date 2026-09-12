package response

// WhatsAppOAuthPhoneNumberResponse is one sender number registered on a WABA.
// PhoneNumberID is the value outbound messages are sent from.
type WhatsAppOAuthPhoneNumberResponse struct {
	PhoneNumberID          string `json:"phoneNumberId"`
	DisplayPhoneNumber     string `json:"displayPhoneNumber"`
	VerifiedName           string `json:"verifiedName"`
	QualityRating          string `json:"qualityRating"`
	CodeVerificationStatus string `json:"codeVerificationStatus"`
}

// WhatsAppOAuthAccountResponse is one WhatsApp Business Account the authorized
// Meta business portfolio owns, together with its sender numbers.
type WhatsAppOAuthAccountResponse struct {
	WabaID       string                             `json:"wabaId"`
	WabaName     string                             `json:"wabaName"`
	BusinessID   string                             `json:"businessId"`
	BusinessName string                             `json:"businessName"`
	PhoneNumbers []WhatsAppOAuthPhoneNumberResponse `json:"phoneNumbers"`
}

// WhatsAppOAuthConnectResponse reports what an authorization code was exchanged
// for. Discovery is best effort, so Accounts may be empty while the token is
// still usable; Warnings explains why in operator-facing terms.
type WhatsAppOAuthConnectResponse struct {
	// Connected is true when the credentials were persisted onto a channel.
	Connected bool  `json:"connected"`
	ChannelID int64 `json:"channelId,omitempty"`

	AccessToken string   `json:"accessToken"`
	TokenMasked string   `json:"tokenMasked"`
	TokenType   string   `json:"tokenType,omitempty"`
	ExpiresAt   string   `json:"expiresAt,omitempty"`
	Scopes      []string `json:"scopes,omitempty"`

	// PhoneNumberID and WabaID are the single obvious choice when discovery
	// found exactly one, so the caller can prefill without making the operator
	// pick from a list of one.
	PhoneNumberID string `json:"phoneNumberId,omitempty"`
	WabaID        string `json:"wabaId,omitempty"`

	Accounts []WhatsAppOAuthAccountResponse `json:"accounts"`
	Warnings []string                       `json:"warnings,omitempty"`
}

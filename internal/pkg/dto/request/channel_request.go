package request

type CreateChannelRequest struct {
	ChannelType           string `json:"channelType"`
	AIAgentID             int64  `json:"aiAgentId"`
	AIAgentRolloutPercent int    `json:"aiAgentRolloutPercent"`
	Name                  string `json:"name"`
	ConfigJSON            string `json:"configJson"`
	Status                int    `json:"status"`
	Remark                string `json:"remark"`
}

type UpdateChannelRequest struct {
	ID int64 `json:"id"`
	CreateChannelRequest
}

type UpdateChannelStatusRequest struct {
	ID     int64 `json:"id"`
	Status int   `json:"status"`
}

type RollbackChannelAIAgentRolloutRequest struct {
	ID int64 `json:"id"`
}

type DeleteChannelRequest struct {
	ID int64 `json:"id"`
}

type ResetChannelUserTokenSecretRequest struct {
	ID int64 `json:"id"`
}

type ChannelMessageOutboxActionRequest struct {
	ID int64 `json:"id"`
}

// WhatsAppOAuthCallbackRequest carries the authorization code Meta redirected
// back with. ChannelID is optional: when set, the exchanged credentials are
// persisted onto that existing WhatsApp channel; when empty they are only
// returned so the operator can finish creating one.
type WhatsAppOAuthCallbackRequest struct {
	Code        string `json:"code"`
	State       string `json:"state"`
	ChannelID   int64  `json:"channelId"`
	RedirectURI string `json:"redirectUri"`
	// PhoneNumberID and WabaID let the operator pick one of several discovered
	// sender numbers instead of accepting the first.
	PhoneNumberID string `json:"phoneNumberId"`
	WabaID        string `json:"wabaId"`
}

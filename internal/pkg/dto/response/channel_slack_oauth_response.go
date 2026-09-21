package response

// SlackOAuthConnectResponse reports what a Slack installation code was exchanged
// for. Slack returns the workspace identity and the bot token together, so a
// successful connect fills every field the channel form needs.
type SlackOAuthConnectResponse struct {
	// Connected is true when the credentials were persisted onto a channel.
	Connected bool  `json:"connected"`
	ChannelID int64 `json:"channelId,omitempty"`

	BotToken    string `json:"botToken"`
	TokenMasked string `json:"tokenMasked"`
	AppID       string `json:"appId,omitempty"`
	BotUserID   string `json:"botUserId,omitempty"`
	TeamID      string `json:"teamId,omitempty"`
	TeamName    string `json:"teamName,omitempty"`

	// DefaultChannelID is the channel Slack preselected during installation. It
	// is only present when the installation included an incoming webhook.
	DefaultChannelID string `json:"defaultChannelId,omitempty"`

	Scopes   []string `json:"scopes,omitempty"`
	Warnings []string `json:"warnings,omitempty"`
}

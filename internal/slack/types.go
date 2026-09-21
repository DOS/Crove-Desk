package slack

// SendMessageRequest represents payload for Slack chat.postMessage API.
type SendMessageRequest struct {
	Channel   string `json:"channel"`
	Text      string `json:"text"`
	ThreadTS  string `json:"thread_ts,omitempty"`
	ParseMode string `json:"parse,omitempty"`
}

// SendMessageResponse represents response from Slack Web API.
type SendMessageResponse struct {
	OK      bool   `json:"ok"`
	Channel string `json:"channel,omitempty"`
	TS      string `json:"ts,omitempty"`
	Error   string `json:"error,omitempty"`
}

// OAuthAccessResponse is the response of oauth.v2.access, the endpoint that
// exchanges an installation code for the credentials an app actually runs on.
//
// AccessToken is the bot token when TokenType is "bot", which is the normal case
// for a support app. IncomingWebhook is only populated when the installation
// included an incoming-webhook and picked a default channel.
type OAuthAccessResponse struct {
	OK          bool   `json:"ok"`
	Error       string `json:"error,omitempty"`
	AppID       string `json:"app_id,omitempty"`
	Scope       string `json:"scope,omitempty"`
	TokenType   string `json:"token_type,omitempty"`
	AccessToken string `json:"access_token,omitempty"`
	BotUserID   string `json:"bot_user_id,omitempty"`
	Team        struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"team"`
	Enterprise *struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"enterprise,omitempty"`
	IncomingWebhook *struct {
		ChannelID string `json:"channel_id"`
		Channel   string `json:"channel"`
		URL       string `json:"url"`
	} `json:"incoming_webhook,omitempty"`
}

// AuthTestResponse is the response of auth.test, used to confirm a token works
// and to read back the workspace it belongs to.
type AuthTestResponse struct {
	OK      bool   `json:"ok"`
	Error   string `json:"error,omitempty"`
	URL     string `json:"url,omitempty"`
	Team    string `json:"team,omitempty"`
	TeamID  string `json:"team_id,omitempty"`
	User    string `json:"user,omitempty"`
	UserID  string `json:"user_id,omitempty"`
	BotID   string `json:"bot_id,omitempty"`
	IsBot   bool   `json:"is_bot,omitempty"`
	AppID   string `json:"app_id,omitempty"`
	AppName string `json:"app_name,omitempty"`
}

// EventCallback represents incoming Slack Events API payload.
type EventCallback struct {
	Token     string `json:"token"`
	TeamID    string `json:"team_id"`
	APIAppID  string `json:"api_app_id"`
	Type      string `json:"type"`      // url_verification | event_callback
	Challenge string `json:"challenge"` // for url_verification
	Event     *struct {
		Type        string `json:"type"` // message | app_mention
		User        string `json:"user"`
		Text        string `json:"text"`
		TS          string `json:"ts"`
		ThreadTS    string `json:"thread_ts,omitempty"`
		Channel     string `json:"channel"`
		ChannelType string `json:"channel_type"` // im | channel | group
		BotID       string `json:"bot_id,omitempty"`
		Subtype     string `json:"subtype,omitempty"`
	} `json:"event,omitempty"`
}

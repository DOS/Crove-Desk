package dto

import "agent-desk/internal/pkg/enums"

type AuthPrincipal struct {
	UserID      int64
	Username    string
	Nickname    string
	Avatar      string
	UserType    enums.UserType
	Status      enums.Status
	Roles       []string
	Permissions []string
}

type WxWorkKFChannelConfig struct {
	OpenKfID string `json:"openKfId"`
}

type WebChannelConfig struct {
	Title           string `json:"title"`
	Subtitle        string `json:"subtitle"`
	ThemeColor      string `json:"themeColor"`
	Position        string `json:"position"`
	Width           string `json:"width"`
	UserTokenSecret string `json:"userTokenSecret,omitempty"`
}

type WechatMPChannelConfig struct {
	Title           string `json:"title"`
	Subtitle        string `json:"subtitle"`
	ThemeColor      string `json:"themeColor"`
	UserTokenSecret string `json:"userTokenSecret,omitempty"`
}

type TelegramChannelConfig struct {
	BotToken       string `json:"botToken"`
	BotUsername    string `json:"botUsername,omitempty"`
	WebhookSecret  string `json:"webhookSecret,omitempty"`
	WelcomeMessage string `json:"welcomeMessage,omitempty"`
}

type ZaloOAChannelConfig struct {
	AppID          string `json:"appId,omitempty"`
	OAID           string `json:"oaId,omitempty"`
	SecretKey      string `json:"secretKey,omitempty"`
	AccessToken    string `json:"accessToken"`
	RefreshToken   string `json:"refreshToken,omitempty"`
	WebhookSecret  string `json:"webhookSecret,omitempty"`
	WelcomeMessage string `json:"welcomeMessage,omitempty"`
}
type EmailChannelConfig struct {
	EmailAddress      string `json:"emailAddress"`                // e.g. help@dos.crove.io or support@company.com
	ForwardingAddress string `json:"forwardingAddress,omitempty"` // e.g. help@dos.crove.io
	SenderName        string `json:"senderName,omitempty"`        // e.g. Crove Desk Support
	Provider          string `json:"provider,omitempty"`          // default | smtp | brevo | sendgrid | resend | postmark | mailgun
	APIKey            string `json:"apiKey,omitempty"`            // Brevo / ESP API Key
	SMTPHost          string `json:"smtpHost,omitempty"`          // SMTP Server Host
	SMTPPort          int    `json:"smtpPort,omitempty"`          // SMTP Port (587/465)
	SMTPUser          string `json:"smtpUser,omitempty"`          // SMTP Username
	SMTPPassword      string `json:"smtpPassword,omitempty"`      // SMTP Password
	WebhookSecret     string `json:"webhookSecret,omitempty"`     // Inbound Webhook Secret
	WelcomeMessage    string `json:"welcomeMessage,omitempty"`    // Auto-responder / welcome message
}

type DiscordChannelConfig struct {
	GuildID        string `json:"guildId,omitempty"`
	GuildName      string `json:"guildName,omitempty"`
	ChannelScope   string `json:"channelScope,omitempty"` // all | dm_only
	BotToken       string `json:"botToken,omitempty"`     // Bot Token (BYOA / Enterprise)
	ApplicationID  string `json:"applicationId,omitempty"`
	PublicKey      string `json:"publicKey,omitempty"`
	WebhookSecret  string `json:"webhookSecret,omitempty"`
	WelcomeMessage string `json:"welcomeMessage,omitempty"`
}

type MessengerChannelConfig struct {
	PageID             string `json:"pageId,omitempty"`
	PageName           string `json:"pageName,omitempty"`
	PageAccessToken    string `json:"pageAccessToken,omitempty"`
	WebhookVerifyToken string `json:"webhookVerifyToken,omitempty"`
	AppSecret          string `json:"appSecret,omitempty"` // Meta App Secret
	WelcomeMessage     string `json:"welcomeMessage,omitempty"`
}

type InstagramChannelConfig struct {
	InstagramID        string `json:"instagramId,omitempty"`        // Instagram Business Account ID
	InstagramUsername  string `json:"instagramUsername,omitempty"`  // @username
	PageID             string `json:"pageId,omitempty"`             // Linked Facebook Page ID
	PageAccessToken    string `json:"pageAccessToken,omitempty"`    // Page Access Token
	WebhookVerifyToken string `json:"webhookVerifyToken,omitempty"` // Webhook verify token
	AppSecret          string `json:"appSecret,omitempty"`          // Meta App Secret
	WelcomeMessage     string `json:"welcomeMessage,omitempty"`
}

type WhatsAppChannelConfig struct {
	PhoneNumberID      string `json:"phoneNumberId,omitempty"`      // WhatsApp Business Phone Number ID
	WABAID             string `json:"wabaId,omitempty"`             // WhatsApp Business Account ID
	AccessToken        string `json:"accessToken,omitempty"`        // System User Access Token
	WebhookVerifyToken string `json:"webhookVerifyToken,omitempty"` // Webhook verification token
	AppSecret          string `json:"appSecret,omitempty"`          // Meta App Secret
	WelcomeMessage     string `json:"welcomeMessage,omitempty"`
}

type SlackChannelConfig struct {
	BotToken       string `json:"botToken,omitempty"`       // xoxb-... Bot Token
	SigningSecret  string `json:"signingSecret,omitempty"`  // Slack Signing Secret
	AppID          string `json:"appId,omitempty"`          // Slack App ID
	TeamID         string `json:"teamId,omitempty"`         // Slack Workspace Team ID
	TeamName       string `json:"teamName,omitempty"`       // Slack Workspace Name
	DefaultChannel string `json:"defaultChannel,omitempty"` // Default channel to post
	WelcomeMessage string `json:"welcomeMessage,omitempty"`
}

type XChannelConfig struct {
	BearerToken        string `json:"bearerToken,omitempty"`        // X API v2 Bearer Token
	APIKey             string `json:"apiKey,omitempty"`             // Consumer Key
	APISecretKey       string `json:"apiSecretKey,omitempty"`       // Consumer Secret
	AccessToken        string `json:"accessToken,omitempty"`        // Access Token
	AccessTokenSecret  string `json:"accessTokenSecret,omitempty"`  // Access Token Secret
	AccountID          string `json:"accountId,omitempty"`          // X Numeric User/Account ID
	Username           string `json:"username,omitempty"`           // @handle
	WebhookEnv         string `json:"webhookEnv,omitempty"`         // Webhook environment name
	WebhookCRCSecret   string `json:"webhookCRCSecret,omitempty"`   // CRC response secret
	WelcomeMessage     string `json:"welcomeMessage,omitempty"`
}

type TikTokChannelConfig struct {
	ClientKey          string `json:"clientKey,omitempty"`          // TikTok App Client Key
	ClientSecret       string `json:"clientSecret,omitempty"`       // TikTok App Client Secret
	AccessToken        string `json:"accessToken,omitempty"`        // Business User Access Token
	OpenID             string `json:"openId,omitempty"`             // TikTok Business Account OpenID
	Username           string `json:"username,omitempty"`           // @username
	WebhookVerifyToken string `json:"webhookVerifyToken,omitempty"` // Verification Token
	WelcomeMessage     string `json:"welcomeMessage,omitempty"`
}

type LineChannelConfig struct {
	ChannelID          string `json:"channelId,omitempty"`          // LINE Messaging Channel ID
	ChannelSecret      string `json:"channelSecret,omitempty"`      // Channel Secret for signature verification
	ChannelAccessToken string `json:"channelAccessToken,omitempty"` // Long-lived Channel Access Token
	WelcomeMessage     string `json:"welcomeMessage,omitempty"`
}

type ViberChannelConfig struct {
	AuthToken      string `json:"authToken,omitempty"`      // Viber Bot Authentication Token
	BotName        string `json:"botName,omitempty"`        // Sender Name
	AvatarURL      string `json:"avatarUrl,omitempty"`      // Sender Avatar URL
	WebhookSecret  string `json:"webhookSecret,omitempty"`  // Secret string in webhook event
	WelcomeMessage string `json:"welcomeMessage,omitempty"`
}

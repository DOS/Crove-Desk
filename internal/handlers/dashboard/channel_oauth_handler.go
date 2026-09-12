package dashboard

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"

	"agent-desk/internal/pkg/config"
	"agent-desk/internal/pkg/constants"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/pkg/httpx"
	"agent-desk/internal/pkg/httpx/params"
	"agent-desk/internal/pkg/i18nx"
	"agent-desk/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/mlogclub/simple/web"
)

// ChannelGetDiscordOAuthURL returns the 1-Click OAuth authorization URL for Discord.
func ChannelGetDiscordOAuthURL(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionChannelView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	clientID := ""
	if cfg := config.GetCurrent(); cfg != nil {
		clientID = strings.TrimSpace(cfg.Discord.ClientID)
	}
	if clientID == "" {
		clientID = strings.TrimSpace(os.Getenv("DISCORD_CLIENT_ID"))
	}
	if clientID == "" {
		clientID = strings.TrimSpace(ctx.Query("client_id"))
	}
	redirectURI := strings.TrimSpace(ctx.Query("redirect_uri"))

	if clientID == "" {
		// Provide guidance or sample client id
		clientID = "123456789012345678"
	}

	state := strings.TrimSpace(ctx.Query("state"))
	if state == "" {
		state = "crove_discord_connect"
	}

	authURL := fmt.Sprintf(
		"https://discord.com/oauth2/authorize?client_id=%s&permissions=19456&response_type=code&redirect_uri=%s&scope=bot+applications.commands&state=%s",
		url.QueryEscape(clientID),
		url.QueryEscape(redirectURI),
		url.QueryEscape(state),
	)

	httpx.WriteJSON(ctx, web.JsonData(gin.H{
		"authUrl":     authURL,
		"clientId":    clientID,
		"redirectUri": redirectURI,
	}))
}

// metaOAuthDialogURL is the Facebook Login authorization endpoint. The Graph API
// version is pinned so an authorization URL and the code exchange that follows it
// cannot drift onto different versions.
const metaOAuthDialogURL = "https://www.facebook.com/v21.0/dialog/oauth"

// Scopes each Meta product needs to send and receive support messages.
const (
	messengerOAuthScope = "pages_show_list,pages_messaging,pages_manage_metadata"
	instagramOAuthScope = "instagram_basic,instagram_manage_messages,pages_show_list,pages_manage_metadata"
	whatsAppOAuthScope  = "whatsapp_business_management,whatsapp_business_messaging"
)

// writeMetaOAuthURL builds an authorization URL for one Meta product.
//
// appID must already be resolved for that specific product: a deployment may
// register a separate Meta app per product, and a code issued by one app cannot
// be exchanged with another app's secret.
func writeMetaOAuthURL(ctx *gin.Context, appID, appIDEnvName, redirectURI, state, scope string) {
	appID = strings.TrimSpace(appID)
	redirectURI = strings.TrimSpace(redirectURI)

	// A fabricated app id would send the operator to a Meta error page that looks
	// like our bug, so an unconfigured deployment says so instead.
	if appID == "" {
		httpx.WriteJSON(ctx, errorsx.InvalidParamI18n("error.e0353", appIDEnvName))
		return
	}
	if redirectURI == "" {
		httpx.WriteJSON(ctx, errorsx.InvalidParamI18n("error.param.required", "redirect_uri"))
		return
	}
	if state = strings.TrimSpace(state); state == "" {
		state = "crove_meta_connect"
	}

	query := url.Values{}
	query.Set("client_id", appID)
	query.Set("redirect_uri", redirectURI)
	query.Set("state", state)
	query.Set("scope", scope)
	// response_type=code is what makes Meta redirect back with an authorization
	// code; without it the dialog returns a token fragment the server never sees.
	query.Set("response_type", "code")

	httpx.WriteJSON(ctx, web.JsonData(gin.H{
		"authUrl":     metaOAuthDialogURL + "?" + query.Encode(),
		"appId":       appID,
		"redirectUri": redirectURI,
	}))
}

// ChannelGetMessengerOAuthURL returns the 1-Click OAuth authorization URL for Meta Messenger.
func ChannelGetMessengerOAuthURL(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionChannelView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	appID := config.ResolveMessengerApp(ctx.Query("app_id"), "").AppID
	state := strings.TrimSpace(ctx.Query("state"))
	if state == "" {
		state = "crove_messenger_connect"
	}
	writeMetaOAuthURL(ctx, appID, "FACEBOOK_APP_ID", ctx.Query("redirect_uri"), state, messengerOAuthScope)
}

// ChannelGetInstagramOAuthURL returns the 1-Click OAuth authorization URL for Instagram Messaging.
func ChannelGetInstagramOAuthURL(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionChannelView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	appID := config.ResolveInstagramApp(ctx.Query("app_id"), "").AppID
	state := strings.TrimSpace(ctx.Query("state"))
	if state == "" {
		state = "crove_instagram_connect"
	}
	writeMetaOAuthURL(ctx, appID, "INSTAGRAM_APP_ID", ctx.Query("redirect_uri"), state, instagramOAuthScope)
}

// ChannelGetWhatsAppOAuthURL returns the 1-Click Embedded Signup / OAuth URL for WhatsApp Cloud API.
func ChannelGetWhatsAppOAuthURL(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionChannelView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	// An existing channel may belong to a different Meta app than the deployment
	// default, and the authorization code can only be exchanged by the app that
	// issued it, so the channel's own app id wins.
	channelAppID := ""
	if channelID, parseErr := strconv.ParseInt(strings.TrimSpace(ctx.Query("channel_id")), 10, 64); parseErr == nil && channelID > 0 {
		if channel := services.ChannelService.Get(channelID); channel != nil && channel.Status != enums.StatusDeleted {
			if cfg, cfgErr := services.ChannelService.ParseWhatsAppChannelConfig(channel.ConfigJSON); cfgErr == nil && cfg != nil {
				channelAppID = cfg.AppID
			}
		}
	}
	if channelAppID == "" {
		channelAppID = strings.TrimSpace(ctx.Query("app_id"))
	}

	appID := config.ResolveWhatsAppApp(channelAppID, "").AppID
	state := strings.TrimSpace(ctx.Query("state"))
	if state == "" {
		state = "crove_whatsapp_connect"
	}
	writeMetaOAuthURL(ctx, appID, "WHATSAPP_APP_ID", ctx.Query("redirect_uri"), state, whatsAppOAuthScope)
}

// ChannelPostWhatsAppOAuthCallback exchanges the authorization code Meta
// redirected back with for WhatsApp Cloud API credentials, reports the sender
// numbers that token can reach, and saves everything when channelId names an
// existing channel.
func ChannelPostWhatsAppOAuthCallback(ctx *gin.Context) {
	req := request.WhatsAppOAuthCallbackRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	// Saving onto an existing channel is an update; exchanging credentials for a
	// channel that does not exist yet is part of creating one.
	permission := constants.PermissionChannelCreate
	if req.ChannelID > 0 {
		permission = constants.PermissionChannelUpdate
	}
	operator, err := services.AuthService.RequirePermission(ctx, permission)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	result, err := services.WhatsAppOAuthService.Connect(req, i18nx.Locale(ctx), operator)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, result)
}

// ChannelGetSlackOAuthURL returns the 1-Click OAuth authorization URL for Slack Workspace Bot.
func ChannelGetSlackOAuthURL(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionChannelView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	clientID := strings.TrimSpace(os.Getenv("SLACK_CLIENT_ID"))
	if clientID == "" {
		clientID = strings.TrimSpace(ctx.Query("client_id"))
	}
	redirectURI := strings.TrimSpace(ctx.Query("redirect_uri"))

	if clientID == "" {
		clientID = "123456789012.1234567890123"
	}

	state := strings.TrimSpace(ctx.Query("state"))
	if state == "" {
		state = "crove_slack_connect"
	}

	authURL := fmt.Sprintf(
		"https://slack.com/oauth/v2/authorize?client_id=%s&scope=chat:write,channels:history,channels:read,im:history,im:read,im:write,app_mentions:read&redirect_uri=%s&state=%s",
		url.QueryEscape(clientID),
		url.QueryEscape(redirectURI),
		url.QueryEscape(state),
	)

	httpx.WriteJSON(ctx, web.JsonData(gin.H{
		"authUrl":     authURL,
		"clientId":    clientID,
		"redirectUri": redirectURI,
	}))
}

// ChannelGetXOAuthURL returns the 1-Click OAuth 2.0 authorization URL for X (Twitter) API v2.
func ChannelGetXOAuthURL(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionChannelView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	clientID := strings.TrimSpace(os.Getenv("X_CLIENT_ID"))
	if clientID == "" {
		clientID = strings.TrimSpace(os.Getenv("TWITTER_CLIENT_ID"))
	}
	if clientID == "" {
		clientID = strings.TrimSpace(ctx.Query("client_id"))
	}
	redirectURI := strings.TrimSpace(ctx.Query("redirect_uri"))

	if clientID == "" {
		clientID = "x_oauth_client_id_placeholder"
	}

	state := strings.TrimSpace(ctx.Query("state"))
	if state == "" {
		state = "crove_x_connect"
	}

	authURL := fmt.Sprintf(
		"https://twitter.com/i/oauth2/authorize?response_type=code&client_id=%s&redirect_uri=%s&scope=dm.read+dm.write+users.read+offline.access&state=%s&code_challenge=challenge&code_challenge_method=plain",
		url.QueryEscape(clientID),
		url.QueryEscape(redirectURI),
		url.QueryEscape(state),
	)

	httpx.WriteJSON(ctx, web.JsonData(gin.H{
		"authUrl":     authURL,
		"clientId":    clientID,
		"redirectUri": redirectURI,
	}))
}

// ChannelGetTikTokOAuthURL returns the 1-Click OAuth authorization URL for TikTok Business Messaging.
func ChannelGetTikTokOAuthURL(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionChannelView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	clientKey := strings.TrimSpace(os.Getenv("TIKTOK_CLIENT_KEY"))
	if clientKey == "" {
		clientKey = strings.TrimSpace(ctx.Query("client_key"))
	}
	redirectURI := strings.TrimSpace(ctx.Query("redirect_uri"))

	if clientKey == "" {
		clientKey = "tiktok_client_key_placeholder"
	}

	state := strings.TrimSpace(ctx.Query("state"))
	if state == "" {
		state = "crove_tiktok_connect"
	}

	authURL := fmt.Sprintf(
		"https://business-api.tiktok.com/portal/auth?app_id=%s&state=%s&redirect_uri=%s",
		url.QueryEscape(clientKey),
		url.QueryEscape(state),
		url.QueryEscape(redirectURI),
	)

	httpx.WriteJSON(ctx, web.JsonData(gin.H{
		"authUrl":     authURL,
		"clientKey":   clientKey,
		"redirectUri": redirectURI,
	}))
}

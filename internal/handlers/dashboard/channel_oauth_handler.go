package dashboard

import (
	"fmt"
	"net/url"
	"os"
	"strings"

	"agent-desk/internal/pkg/config"
	"agent-desk/internal/pkg/constants"
	"agent-desk/internal/pkg/httpx"
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

// ChannelGetMessengerOAuthURL returns the 1-Click OAuth authorization URL for Meta Messenger.
func ChannelGetMessengerOAuthURL(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionChannelView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	appID := ""
	if cfg := config.GetCurrent(); cfg != nil {
		appID = strings.TrimSpace(cfg.Messenger.AppID)
	}
	if appID == "" {
		appID = strings.TrimSpace(os.Getenv("META_APP_ID"))
	}
	if appID == "" {
		appID = strings.TrimSpace(os.Getenv("FB_APP_ID"))
	}
	if appID == "" {
		appID = strings.TrimSpace(ctx.Query("app_id"))
	}
	redirectURI := strings.TrimSpace(ctx.Query("redirect_uri"))

	if appID == "" {
		appID = "123456789012345"
	}

	state := strings.TrimSpace(ctx.Query("state"))
	if state == "" {
		state = "crove_messenger_connect"
	}

	authURL := fmt.Sprintf(
		"https://www.facebook.com/v21.0/dialog/oauth?client_id=%s&redirect_uri=%s&scope=pages_show_list,pages_messaging,pages_manage_metadata&state=%s",
		url.QueryEscape(appID),
		url.QueryEscape(redirectURI),
		url.QueryEscape(state),
	)

	httpx.WriteJSON(ctx, web.JsonData(gin.H{
		"authUrl":     authURL,
		"appId":       appID,
		"redirectUri": redirectURI,
	}))
}

// ChannelGetInstagramOAuthURL returns the 1-Click OAuth authorization URL for Instagram Messaging.
func ChannelGetInstagramOAuthURL(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionChannelView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	appID := ""
	if cfg := config.GetCurrent(); cfg != nil {
		appID = strings.TrimSpace(cfg.Messenger.AppID)
	}
	if appID == "" {
		appID = strings.TrimSpace(os.Getenv("META_APP_ID"))
	}
	if appID == "" {
		appID = strings.TrimSpace(os.Getenv("FB_APP_ID"))
	}
	if appID == "" {
		appID = strings.TrimSpace(ctx.Query("app_id"))
	}
	redirectURI := strings.TrimSpace(ctx.Query("redirect_uri"))

	if appID == "" {
		appID = "123456789012345"
	}

	state := strings.TrimSpace(ctx.Query("state"))
	if state == "" {
		state = "crove_instagram_connect"
	}

	authURL := fmt.Sprintf(
		"https://www.facebook.com/v21.0/dialog/oauth?client_id=%s&redirect_uri=%s&scope=instagram_basic,instagram_manage_messages,pages_show_list,pages_manage_metadata&state=%s",
		url.QueryEscape(appID),
		url.QueryEscape(redirectURI),
		url.QueryEscape(state),
	)

	httpx.WriteJSON(ctx, web.JsonData(gin.H{
		"authUrl":     authURL,
		"appId":       appID,
		"redirectUri": redirectURI,
	}))
}

// ChannelGetWhatsAppOAuthURL returns the 1-Click Embedded Signup / OAuth URL for WhatsApp Cloud API.
func ChannelGetWhatsAppOAuthURL(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionChannelView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	appID := ""
	if cfg := config.GetCurrent(); cfg != nil {
		appID = strings.TrimSpace(cfg.Messenger.AppID)
	}
	if appID == "" {
		appID = strings.TrimSpace(os.Getenv("META_APP_ID"))
	}
	if appID == "" {
		appID = strings.TrimSpace(ctx.Query("app_id"))
	}
	redirectURI := strings.TrimSpace(ctx.Query("redirect_uri"))

	if appID == "" {
		appID = "123456789012345"
	}

	state := strings.TrimSpace(ctx.Query("state"))
	if state == "" {
		state = "crove_whatsapp_connect"
	}

	authURL := fmt.Sprintf(
		"https://www.facebook.com/v21.0/dialog/oauth?client_id=%s&redirect_uri=%s&scope=whatsapp_business_management,whatsapp_business_messaging&state=%s",
		url.QueryEscape(appID),
		url.QueryEscape(redirectURI),
		url.QueryEscape(state),
	)

	httpx.WriteJSON(ctx, web.JsonData(gin.H{
		"authUrl":     authURL,
		"appId":       appID,
		"redirectUri": redirectURI,
	}))
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

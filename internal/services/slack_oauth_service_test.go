package services

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/config"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/slack"
)

// setSlackAppCredentials installs the deployment-wide Slack app credentials and
// restores whatever was configured before.
func setSlackAppCredentials(t *testing.T, clientID, clientSecret string) {
	t.Helper()
	previous := config.GetCurrent()
	cfg := &config.Config{}
	if previous != nil {
		*cfg = *previous
	}
	cfg.Slack.ClientID = clientID
	cfg.Slack.ClientSecret = clientSecret
	config.SetCurrent(cfg)
	t.Cleanup(func() { config.SetCurrent(previous) })
}

// stubSlackExchange replaces the code exchange with a canned result and returns a
// restore func.
func stubSlackExchange(t *testing.T, resp *slack.OAuthAccessResponse, err error) func() {
	t.Helper()
	previous := slackExchangeOAuthCode
	slackExchangeOAuthCode = func(_ context.Context, _, _, _, _, _ string) (*slack.OAuthAccessResponse, error) {
		return resp, err
	}
	return func() { slackExchangeOAuthCode = previous }
}

// stubSlackAuthTest points the Slack client at a local stub for auth.test and
// returns a restore func.
func stubSlackAuthTest(t *testing.T, status int, body string) func() {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/auth.test" {
			t.Errorf("unexpected slack path %q", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	previous := slackOAuthBaseURL
	slackOAuthBaseURL = server.URL
	return func() {
		slackOAuthBaseURL = previous
		server.Close()
	}
}

func seedSlackOAuthChannel(t *testing.T, channelType string) int64 {
	t.Helper()
	db := setupSlackTestDB(t)
	now := time.Now()

	agent := &models.AIAgent{
		Name:                "Support AI",
		Status:              enums.StatusOk,
		PublishedRevisionID: 1,
		AuditFields:         models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(agent).Error; err != nil {
		t.Fatalf("create ai agent: %v", err)
	}

	cfgBytes, err := json.Marshal(dto.SlackChannelConfig{
		SigningSecret: "existing_signing_secret",
		TeamID:        "T_OLD",
	})
	if err != nil {
		t.Fatalf("marshal channel config: %v", err)
	}
	channel := &models.Channel{
		ChannelType:           channelType,
		ChannelID:             "slack_oauth_channel",
		AIAgentID:             agent.ID,
		AIAgentRolloutPercent: 100,
		Name:                  "Slack OAuth Target",
		ConfigJSON:            string(cfgBytes),
		Status:                enums.StatusOk,
		AuditFields:           models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(channel).Error; err != nil {
		t.Fatalf("create channel: %v", err)
	}
	return channel.ID
}

func successfulSlackExchange() *slack.OAuthAccessResponse {
	resp := &slack.OAuthAccessResponse{
		OK:          true,
		AppID:       "A01234567",
		Scope:       "chat:write,channels:history,im:history,im:read",
		TokenType:   "bot",
		AccessToken: "xoxb-installed-workspace-token",
		BotUserID:   "U_BOT_001",
	}
	resp.Team.ID = "T_INSTALLED"
	resp.Team.Name = "Installed Workspace"
	resp.IncomingWebhook = &struct {
		ChannelID string `json:"channel_id"`
		Channel   string `json:"channel"`
		URL       string `json:"url"`
	}{ChannelID: "C_DEFAULT", Channel: "#support"}
	return resp
}

func TestSlackOAuthConnectPersistsWorkspace(t *testing.T) {
	channelID := seedSlackOAuthChannel(t, enums.ChannelTypeSlack)
	setSlackAppCredentials(t, "slack-client-id", "slack-client-secret")
	defer stubSlackExchange(t, successfulSlackExchange(), nil)()
	defer stubSlackAuthTest(t, http.StatusOK, `{"ok":true,"team":"Installed Workspace","team_id":"T_INSTALLED","app_id":"A01234567","bot_id":"B001","is_bot":true}`)()

	operator := &dto.AuthPrincipal{UserID: 7, Username: "joy"}
	result, err := SlackOAuthService.Connect(request.SlackOAuthCallbackRequest{
		Code:        "slack-install-code",
		ChannelID:   channelID,
		RedirectURI: "https://desk.example.com/dashboard/channels/oauth-callback",
	}, "en-US", operator)
	if err != nil {
		t.Fatalf("Connect failed: %v", err)
	}

	if !result.Connected {
		t.Errorf("Connected = false, want true")
	}
	if result.BotToken != "xoxb-installed-workspace-token" {
		t.Errorf("BotToken = %q", result.BotToken)
	}
	if result.TeamID != "T_INSTALLED" || result.TeamName != "Installed Workspace" {
		t.Errorf("team = %q/%q, want the installed workspace", result.TeamID, result.TeamName)
	}
	if result.DefaultChannelID != "C_DEFAULT" {
		t.Errorf("DefaultChannelID = %q, want C_DEFAULT", result.DefaultChannelID)
	}
	if strings.Contains(result.TokenMasked, "installed-workspace-token") {
		t.Errorf("TokenMasked = %q leaks the token", result.TokenMasked)
	}
	if len(result.Warnings) != 0 {
		t.Errorf("unexpected warnings: %v", result.Warnings)
	}

	saved := ChannelService.Get(channelID)
	cfg, err := ChannelService.ParseSlackChannelConfig(saved.ConfigJSON)
	if err != nil {
		t.Fatalf("parse saved config: %v", err)
	}
	if cfg.BotToken != "xoxb-installed-workspace-token" {
		t.Errorf("saved bot token = %q", cfg.BotToken)
	}
	if cfg.TeamID != "T_INSTALLED" {
		t.Errorf("saved team id = %q, want the installed workspace", cfg.TeamID)
	}
	// The signing secret was already set and has to survive, or inbound
	// verification breaks the moment the operator connects a workspace.
	if cfg.SigningSecret != "existing_signing_secret" {
		t.Errorf("signing secret = %q, want it preserved", cfg.SigningSecret)
	}
	if saved.UpdateUserName != "joy" {
		t.Errorf("update_user_name = %q, want the operator", saved.UpdateUserName)
	}
}

func TestSlackOAuthConnectRequiresAppCredentials(t *testing.T) {
	channelID := seedSlackOAuthChannel(t, enums.ChannelTypeSlack)
	setSlackAppCredentials(t, "", "")

	operator := &dto.AuthPrincipal{UserID: 7, Username: "joy"}
	_, err := SlackOAuthService.Connect(request.SlackOAuthCallbackRequest{
		Code:      "slack-install-code",
		ChannelID: channelID,
	}, "en-US", operator)
	if i18nErrorKey(t, err) != "error.slack.oauth.clientCredentialsMissing" {
		t.Fatalf("error = %v, want error.slack.oauth.clientCredentialsMissing", err)
	}

	saved := ChannelService.Get(channelID)
	cfg, parseErr := ChannelService.ParseSlackChannelConfig(saved.ConfigJSON)
	if parseErr != nil {
		t.Fatalf("parse config: %v", parseErr)
	}
	if cfg.TeamID != "T_OLD" {
		t.Errorf("the channel was modified: team id = %q", cfg.TeamID)
	}
}

func TestSlackOAuthConnectReportsSlackError(t *testing.T) {
	channelID := seedSlackOAuthChannel(t, enums.ChannelTypeSlack)
	setSlackAppCredentials(t, "slack-client-id", "slack-client-secret")

	// ExchangeOAuthCode turns Slack's ok:false envelope into an error, so that is
	// what the stub has to reproduce.
	defer stubSlackExchange(t, nil, errors.New("slack oauth error: invalid_grant"))()

	operator := &dto.AuthPrincipal{UserID: 7, Username: "joy"}
	_, err := SlackOAuthService.Connect(request.SlackOAuthCallbackRequest{
		Code:      "slack-install-code",
		ChannelID: channelID,
	}, "en-US", operator)
	if err == nil {
		t.Fatalf("expected an error when Slack rejects the code")
	}
	if i18nErrorKey(t, err) != "error.slack.oauth.exchangeFailed" {
		t.Errorf("error key = %q, want error.slack.oauth.exchangeFailed", i18nErrorKey(t, err))
	}
	if !strings.Contains(err.Error(), "invalid_grant") {
		t.Errorf("error = %v, want Slack's reason carried through", err)
	}

	saved := ChannelService.Get(channelID)
	cfg, parseErr := ChannelService.ParseSlackChannelConfig(saved.ConfigJSON)
	if parseErr != nil {
		t.Fatalf("parse config: %v", parseErr)
	}
	if cfg.BotToken != "" {
		t.Errorf("a failed exchange wrote a bot token: %q", cfg.BotToken)
	}
}

// A missing chat:write scope means the bot can receive but never reply, and a
// user token instead of a bot token means the install was done against the wrong
// identity. Both are operator mistakes Slack does not treat as errors, so they
// have to be surfaced as warnings rather than silently saved.
func TestSlackOAuthConnectWarnsAboutUnusableInstallation(t *testing.T) {
	channelID := seedSlackOAuthChannel(t, enums.ChannelTypeSlack)
	setSlackAppCredentials(t, "slack-client-id", "slack-client-secret")

	cases := []struct {
		name      string
		scope     string
		tokenType string
		wantIn    string
	}{
		{"missing chat:write", "channels:history,im:history", "bot", "chat:write"},
		{"user token instead of bot", "chat:write", "user", "user"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			resp := successfulSlackExchange()
			resp.Scope = tc.scope
			resp.TokenType = tc.tokenType
			defer stubSlackExchange(t, resp, nil)()
			defer stubSlackAuthTest(t, http.StatusOK, `{"ok":true,"team_id":"T_INSTALLED"}`)()

			operator := &dto.AuthPrincipal{UserID: 7, Username: "joy"}
			result, err := SlackOAuthService.Connect(request.SlackOAuthCallbackRequest{
				Code:      "slack-install-code",
				ChannelID: channelID,
			}, "en-US", operator)
			if err != nil {
				t.Fatalf("Connect failed: %v", err)
			}
			// Connecting still succeeds: the token is real and the operator may
			// intend to fix the scope afterwards.
			if !result.Connected {
				t.Errorf("Connected = false, want the credentials saved")
			}
			found := false
			for _, warning := range result.Warnings {
				if strings.Contains(warning, tc.wantIn) {
					found = true
				}
			}
			if !found {
				t.Errorf("warnings = %v, want one mentioning %q", result.Warnings, tc.wantIn)
			}
		})
	}
}

// auth.test failing must not discard a token Slack genuinely issued; it becomes a
// warning so the operator sees it without losing the installation.
func TestSlackOAuthConnectToleratesAuthTestFailure(t *testing.T) {
	channelID := seedSlackOAuthChannel(t, enums.ChannelTypeSlack)
	setSlackAppCredentials(t, "slack-client-id", "slack-client-secret")
	defer stubSlackExchange(t, successfulSlackExchange(), nil)()
	defer stubSlackAuthTest(t, http.StatusOK, `{"ok":false,"error":"account_inactive"}`)()

	operator := &dto.AuthPrincipal{UserID: 7, Username: "joy"}
	result, err := SlackOAuthService.Connect(request.SlackOAuthCallbackRequest{
		Code:      "slack-install-code",
		ChannelID: channelID,
	}, "en-US", operator)
	if err != nil {
		t.Fatalf("Connect failed: %v", err)
	}
	if !result.Connected {
		t.Errorf("Connected = false, want the token saved despite the failed check")
	}
	if len(result.Warnings) == 0 {
		t.Errorf("expected a warning explaining that auth.test failed")
	}
}

func TestSlackOAuthConnectRejectsNonSlackChannel(t *testing.T) {
	channelID := seedSlackOAuthChannel(t, enums.ChannelTypeTelegram)
	setSlackAppCredentials(t, "slack-client-id", "slack-client-secret")
	defer stubSlackExchange(t, successfulSlackExchange(), nil)()

	operator := &dto.AuthPrincipal{UserID: 7, Username: "joy"}
	_, err := SlackOAuthService.Connect(request.SlackOAuthCallbackRequest{
		Code:      "slack-install-code",
		ChannelID: channelID,
	}, "en-US", operator)
	if i18nErrorKey(t, err) != "error.e0250" {
		t.Fatalf("error = %v, want error.e0250", err)
	}
}

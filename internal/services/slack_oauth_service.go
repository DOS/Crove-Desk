package services

import (
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"time"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/config"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/dto/response"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/pkg/i18nx"
	"agent-desk/internal/slack"
)

var SlackOAuthService = newSlackOAuthService()

func newSlackOAuthService() *slackOAuthService {
	return &slackOAuthService{}
}

type slackOAuthService struct{}

// slackExchangeOAuthCode is a variable so tests can point the exchange at a local
// stub instead of Slack.
var slackExchangeOAuthCode = slack.ExchangeOAuthCode

// slackOAuthTimeout bounds the code exchange and the token check that follows it.
const slackOAuthTimeout = 30 * time.Second

// slackRequiredScope is the one scope without which the integration cannot work:
// an app that cannot post cannot answer a customer.
const slackRequiredScope = "chat:write"

// Connect exchanges a Slack installation code for the workspace's bot
// credentials and, when the operator is editing an existing channel, persists
// them onto it.
//
// Slack returns the bot token, the workspace id and name, and the preselected
// default channel in one response, so a successful connect fills every field the
// channel form needs and the operator does not have to copy anything out of the
// Slack admin UI.
func (s *slackOAuthService) Connect(req request.SlackOAuthCallbackRequest, locale string, operator *dto.AuthPrincipal) (*response.SlackOAuthConnectResponse, error) {
	if operator == nil {
		return nil, errorsx.UnauthorizedI18n("error.auth.expired")
	}
	code := strings.TrimSpace(req.Code)
	if code == "" {
		return nil, errorsx.InvalidParamI18n("error.param.required", "code")
	}

	channel, cfg, err := s.loadTargetChannel(req.ChannelID)
	if err != nil {
		return nil, err
	}

	// The Slack app is deployment-wide; only the resulting bot token belongs to a
	// workspace, so the client credentials never come from the channel.
	app := config.ResolveSlack("", "")
	if app.ClientID == "" || app.ClientSecret == "" {
		return nil, errorsx.InvalidParamI18n("error.slack.oauth.clientCredentialsMissing")
	}

	ctx, cancel := context.WithTimeout(context.Background(), slackOAuthTimeout)
	defer cancel()

	exchange, err := slackExchangeOAuthCode(ctx, slackOAuthBaseURL, app.ClientID, app.ClientSecret, code, req.RedirectURI)
	if err != nil {
		slog.Warn("slack oauth code exchange failed", "error", err)
		return nil, errorsx.InvalidParamI18n("error.slack.oauth.exchangeFailed", err.Error())
	}

	result := &response.SlackOAuthConnectResponse{
		BotToken:    strings.TrimSpace(exchange.AccessToken),
		TokenMasked: maskChannelToken(exchange.AccessToken),
		AppID:       strings.TrimSpace(exchange.AppID),
		BotUserID:   strings.TrimSpace(exchange.BotUserID),
		TeamID:      strings.TrimSpace(exchange.Team.ID),
		TeamName:    strings.TrimSpace(exchange.Team.Name),
		Scopes:      splitSlackScopes(exchange.Scope),
		Warnings:    []string{},
	}
	if exchange.IncomingWebhook != nil {
		result.DefaultChannelID = strings.TrimSpace(exchange.IncomingWebhook.ChannelID)
	}
	if strings.TrimSpace(exchange.TokenType) != "" && !strings.EqualFold(strings.TrimSpace(exchange.TokenType), "bot") {
		result.Warnings = append(result.Warnings,
			i18nx.TLocale(locale, "error.slack.oauth.tokenTypeUnexpected", exchange.TokenType))
	}
	if !containsSlackScope(result.Scopes, slackRequiredScope) {
		result.Warnings = append(result.Warnings,
			i18nx.TLocale(locale, "error.slack.oauth.scopeMissing", slackRequiredScope))
	}

	s.verifyToken(ctx, locale, result)

	if channel != nil {
		if err := s.persist(channel, cfg, result, operator); err != nil {
			return nil, err
		}
	}
	return result, nil
}

// slackOAuthBaseURL overrides the Slack API base for tests. Empty means the
// production endpoint.
var slackOAuthBaseURL = ""

// verifyToken calls auth.test with the token Slack just issued. A token that
// cannot authenticate would otherwise be saved and fail later on the first reply,
// which is much harder to diagnose than an error at connect time.
func (s *slackOAuthService) verifyToken(ctx context.Context, locale string, result *response.SlackOAuthConnectResponse) {
	client := slack.NewClient(result.BotToken)
	if slackOAuthBaseURL != "" {
		client.SetBaseURL(slackOAuthBaseURL)
	}
	auth, err := client.AuthTest(ctx)
	if err != nil {
		result.Warnings = append(result.Warnings,
			i18nx.TLocale(locale, "error.slack.oauth.authTestFailed", err.Error()))
		return
	}
	if result.TeamID == "" {
		result.TeamID = strings.TrimSpace(auth.TeamID)
	}
	if result.TeamName == "" {
		result.TeamName = strings.TrimSpace(auth.Team)
	}
	if result.AppID == "" {
		result.AppID = strings.TrimSpace(auth.AppID)
	}
}

func (s *slackOAuthService) loadTargetChannel(channelID int64) (*models.Channel, *dto.SlackChannelConfig, error) {
	cfg := &dto.SlackChannelConfig{}
	if channelID <= 0 {
		return nil, cfg, nil
	}
	channel := ChannelService.Get(channelID)
	if channel == nil || channel.Status == enums.StatusDeleted {
		return nil, nil, errorsx.InvalidParamI18n("error.e0208")
	}
	if strings.TrimSpace(channel.ChannelType) != enums.ChannelTypeSlack {
		return nil, nil, errorsx.InvalidParamI18n("error.e0250")
	}
	parsed, err := ChannelService.ParseSlackChannelConfig(channel.ConfigJSON)
	if err != nil {
		return nil, nil, errorsx.InvalidParamI18n("error.slack.configInvalid")
	}
	if parsed != nil {
		cfg = parsed
	}
	return channel, cfg, nil
}

// persist writes the installed workspace's credentials onto an existing Slack
// channel, preserving the signing secret and welcome message it already has.
func (s *slackOAuthService) persist(channel *models.Channel, cfg *dto.SlackChannelConfig, result *response.SlackOAuthConnectResponse, operator *dto.AuthPrincipal) error {
	if cfg == nil {
		cfg = &dto.SlackChannelConfig{}
	}

	cfg.BotToken = strings.TrimSpace(result.BotToken)
	if result.AppID != "" {
		cfg.AppID = result.AppID
	}
	if result.TeamID != "" {
		cfg.TeamID = result.TeamID
	}
	if result.TeamName != "" {
		cfg.TeamName = result.TeamName
	}
	if result.DefaultChannelID != "" && strings.TrimSpace(cfg.DefaultChannel) == "" {
		cfg.DefaultChannel = result.DefaultChannelID
	}

	configBytes, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	if err := ChannelService.Updates(channel.ID, map[string]any{
		"config_json":      string(configBytes),
		"update_user_id":   operator.UserID,
		"update_user_name": operator.Username,
		"updated_at":       time.Now(),
	}); err != nil {
		return err
	}

	result.Connected = true
	result.ChannelID = channel.ID
	slog.Info("slack workspace connected to channel",
		"channel", channel.ID,
		"team_id", cfg.TeamID,
		"team_name", cfg.TeamName,
		"operator", operator.Username,
	)
	return nil
}

func splitSlackScopes(scope string) []string {
	scopes := make([]string, 0, 8)
	for _, part := range strings.Split(strings.TrimSpace(scope), ",") {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			scopes = append(scopes, trimmed)
		}
	}
	return scopes
}

func containsSlackScope(scopes []string, wanted string) bool {
	for _, scope := range scopes {
		if strings.EqualFold(strings.TrimSpace(scope), wanted) {
			return true
		}
	}
	return false
}

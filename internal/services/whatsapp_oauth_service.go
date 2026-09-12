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
	"agent-desk/internal/whatsapp"
)

var WhatsAppOAuthService = newWhatsAppOAuthService()

func newWhatsAppOAuthService() *whatsappOAuthService {
	return &whatsappOAuthService{}
}

type whatsappOAuthService struct{}

// newWhatsAppOAuthClient builds the Graph API client for the connect flow. It is
// a variable so tests can point it at a local stub instead of Meta.
var newWhatsAppOAuthClient = func(accessToken string) *whatsapp.Client {
	return whatsapp.NewClient(accessToken)
}

const (
	// whatsappOAuthTimeout bounds the whole connect flow: one token exchange,
	// one token inspection and a bounded set of discovery calls.
	whatsappOAuthTimeout = 45 * time.Second
	// Discovery fan-out is capped so a business portfolio with many WABAs cannot
	// turn one operator click into a long tail of Graph API calls.
	whatsappOAuthMaxBusinesses = 5
	whatsappOAuthMaxAccounts   = 10
)

// Connect exchanges a Meta OAuth authorization code for WhatsApp Cloud API
// credentials, discovers the sender numbers the token can reach, and — when the
// operator is editing an existing channel — persists everything onto it.
//
// Discovery is deliberately best effort. A token obtained through Embedded
// Signup is often a business token that cannot list the business portfolio's
// accounts, and Meta answers that with an empty list or error code 200 rather
// than a hard failure. Failing the whole connect over it would throw away a
// perfectly usable access token, so partial results are reported in Warnings.
func (s *whatsappOAuthService) Connect(req request.WhatsAppOAuthCallbackRequest, locale string, operator *dto.AuthPrincipal) (*response.WhatsAppOAuthConnectResponse, error) {
	if operator == nil {
		return nil, errorsx.UnauthorizedI18n("error.auth.expired")
	}
	code := strings.TrimSpace(req.Code)
	if code == "" {
		return nil, errorsx.InvalidParamI18n("error.param.required", "code")
	}

	// Load the target channel first. Its own Meta app decides which app the
	// authorization code was issued for, and a code cannot be exchanged against a
	// different app, so the credentials have to be resolved per channel rather
	// than globally.
	channel, channelCfg, err := s.loadTargetChannel(req.ChannelID)
	if err != nil {
		return nil, err
	}

	creds := config.ResolveWhatsAppApp(channelCfg.AppID, channelCfg.AppSecret)
	if creds.AppID == "" || creds.AppSecret == "" {
		return nil, errorsx.InvalidParamI18n("error.e0351")
	}

	ctx, cancel := context.WithTimeout(context.Background(), whatsappOAuthTimeout)
	defer cancel()

	token, err := newWhatsAppOAuthClient("").ExchangeCodeForToken(ctx, creds.AppID, creds.AppSecret, code, req.RedirectURI)
	if err != nil {
		slog.Warn("whatsapp oauth code exchange failed", "app_id", creds.AppID, "error", err)
		return nil, errorsx.InvalidParamI18n("error.e0352", err.Error())
	}

	result := &response.WhatsAppOAuthConnectResponse{
		AccessToken: token.AccessToken,
		TokenMasked: maskWhatsAppToken(token.AccessToken),
		TokenType:   strings.TrimSpace(token.TokenType),
		Accounts:    []response.WhatsAppOAuthAccountResponse{},
	}

	s.inspectToken(ctx, token.AccessToken, locale, result)
	s.discoverAccounts(ctx, token.AccessToken, locale, result)
	s.applySingleCandidate(result)

	if channel != nil {
		if err := s.persist(channel, channelCfg, req, result, operator); err != nil {
			return nil, err
		}
	}
	return result, nil
}

// loadTargetChannel resolves the channel the credentials should be saved onto. A
// zero id means the operator is still creating one, which is not an error: the
// exchanged values are returned so the form can be filled in.
func (s *whatsappOAuthService) loadTargetChannel(channelID int64) (*models.Channel, *dto.WhatsAppChannelConfig, error) {
	cfg := &dto.WhatsAppChannelConfig{}
	if channelID <= 0 {
		return nil, cfg, nil
	}
	channel := ChannelService.Get(channelID)
	if channel == nil || channel.Status == enums.StatusDeleted {
		return nil, nil, errorsx.InvalidParamI18n("error.e0208")
	}
	if strings.TrimSpace(channel.ChannelType) != enums.ChannelTypeWhatsApp {
		return nil, nil, errorsx.InvalidParamI18n("error.e0250")
	}
	parsed, err := ChannelService.ParseWhatsAppChannelConfig(channel.ConfigJSON)
	if err != nil {
		return nil, nil, errorsx.InvalidParam("invalid whatsapp configuration")
	}
	if parsed != nil {
		cfg = parsed
	}
	return channel, cfg, nil
}

// inspectToken records expiry and granted scopes so the operator can see whether
// the authorization actually covers sending and receiving messages.
func (s *whatsappOAuthService) inspectToken(ctx context.Context, accessToken string, locale string, result *response.WhatsAppOAuthConnectResponse) {
	debug, err := newWhatsAppOAuthClient(accessToken).DebugToken(ctx, accessToken)
	if err != nil {
		result.Warnings = append(result.Warnings, i18nx.TLocale(locale, "error.whatsapp.oauth.tokenInspectFailed", err.Error()))
		return
	}
	if !debug.IsValid {
		result.Warnings = append(result.Warnings, i18nx.TLocale(locale, "error.whatsapp.oauth.tokenInvalid"))
	}
	if debug.ExpiresAt > 0 {
		result.ExpiresAt = time.Unix(debug.ExpiresAt, 0).Format(time.RFC3339)
	}
	result.Scopes = debug.Scopes
	for _, required := range []string{"whatsapp_business_messaging", "whatsapp_business_management"} {
		if !containsWhatsAppScope(debug.Scopes, required) {
			result.Warnings = append(result.Warnings, i18nx.TLocale(locale, "error.whatsapp.oauth.scopeMissing", required))
		}
	}
}

func containsWhatsAppScope(scopes []string, wanted string) bool {
	for _, scope := range scopes {
		if strings.EqualFold(strings.TrimSpace(scope), wanted) {
			return true
		}
	}
	return false
}

func (s *whatsappOAuthService) discoverAccounts(ctx context.Context, accessToken string, locale string, result *response.WhatsAppOAuthConnectResponse) {
	client := newWhatsAppOAuthClient(accessToken)

	businesses, err := client.ListBusinesses(ctx)
	if err != nil {
		result.Warnings = append(result.Warnings, i18nx.TLocale(locale, "error.whatsapp.oauth.businessesFailed", err.Error()))
		return
	}
	if len(businesses) == 0 {
		result.Warnings = append(result.Warnings, i18nx.TLocale(locale, "error.whatsapp.oauth.noBusinesses"))
		return
	}
	if len(businesses) > whatsappOAuthMaxBusinesses {
		businesses = businesses[:whatsappOAuthMaxBusinesses]
	}

	for _, business := range businesses {
		accounts, err := client.ListOwnedWhatsAppBusinessAccounts(ctx, business.ID)
		if err != nil {
			result.Warnings = append(result.Warnings, i18nx.TLocale(locale, "error.whatsapp.oauth.accountsFailed", business.ID, err.Error()))
			continue
		}
		if len(accounts) > whatsappOAuthMaxAccounts {
			accounts = accounts[:whatsappOAuthMaxAccounts]
		}
		for _, account := range accounts {
			entry := response.WhatsAppOAuthAccountResponse{
				WabaID:       strings.TrimSpace(account.ID),
				WabaName:     strings.TrimSpace(account.Name),
				BusinessID:   strings.TrimSpace(business.ID),
				BusinessName: strings.TrimSpace(business.Name),
				PhoneNumbers: []response.WhatsAppOAuthPhoneNumberResponse{},
			}
			numbers, err := client.ListPhoneNumbers(ctx, account.ID)
			if err != nil {
				result.Warnings = append(result.Warnings, i18nx.TLocale(locale, "error.whatsapp.oauth.phoneNumbersFailed", account.ID, err.Error()))
			}
			for _, number := range numbers {
				entry.PhoneNumbers = append(entry.PhoneNumbers, response.WhatsAppOAuthPhoneNumberResponse{
					PhoneNumberID:          strings.TrimSpace(number.ID),
					DisplayPhoneNumber:     strings.TrimSpace(number.DisplayPhoneNumber),
					VerifiedName:           strings.TrimSpace(number.VerifiedName),
					QualityRating:          strings.TrimSpace(number.QualityRating),
					CodeVerificationStatus: strings.TrimSpace(number.CodeVerificationStatus),
				})
			}
			result.Accounts = append(result.Accounts, entry)
		}
	}

	if len(result.Accounts) == 0 {
		result.Warnings = append(result.Warnings, i18nx.TLocale(locale, "error.whatsapp.oauth.noAccounts"))
	}
}

// applySingleCandidate preselects the obvious choice when discovery found
// exactly one sender number, so the operator is not asked to pick from a list
// of one.
func (s *whatsappOAuthService) applySingleCandidate(result *response.WhatsAppOAuthConnectResponse) {
	var (
		wabaID      string
		phoneNumber string
		candidates  int
	)
	for _, account := range result.Accounts {
		if wabaID == "" {
			wabaID = account.WabaID
		}
		for _, number := range account.PhoneNumbers {
			candidates++
			if phoneNumber == "" {
				phoneNumber = number.PhoneNumberID
			}
		}
	}
	if candidates == 1 {
		result.PhoneNumberID = phoneNumber
		result.WabaID = wabaID
	}
}

// persist writes the exchanged credentials onto an existing WhatsApp channel,
// preserving the webhook verify token and welcome message it already has.
func (s *whatsappOAuthService) persist(channel *models.Channel, cfg *dto.WhatsAppChannelConfig, req request.WhatsAppOAuthCallbackRequest, result *response.WhatsAppOAuthConnectResponse, operator *dto.AuthPrincipal) error {
	if cfg == nil {
		cfg = &dto.WhatsAppChannelConfig{}
	}

	cfg.AccessToken = strings.TrimSpace(result.AccessToken)
	if wabaID := s.pickWabaID(req, result); wabaID != "" {
		cfg.WABAID = wabaID
	}
	if phoneNumberID := s.pickPhoneNumberID(req, result, cfg.WABAID); phoneNumberID != "" {
		cfg.PhoneNumberID = phoneNumberID
	}
	// The app id and secret are deliberately not copied onto the channel here.
	// They resolve through the same channel -> product -> Messenger chain at
	// webhook time, so writing the resolved value would freeze a fallback in
	// place and keep winning after the deployment-level credential is corrected.

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
	slog.Info("whatsapp credentials connected to channel",
		"channel", channel.ID,
		"waba_id", cfg.WABAID,
		"phone_number_id", cfg.PhoneNumberID,
		"operator", operator.Username,
	)
	return nil
}

func (s *whatsappOAuthService) pickWabaID(req request.WhatsAppOAuthCallbackRequest, result *response.WhatsAppOAuthConnectResponse) string {
	if wabaID := strings.TrimSpace(req.WabaID); wabaID != "" {
		return wabaID
	}
	return strings.TrimSpace(result.WabaID)
}

// pickPhoneNumberID resolves the sender number to store. An explicit choice wins,
// then a single discovered candidate, then the only number under the selected
// WABA. Ambiguous cases are left untouched rather than guessed at, because
// sending from the wrong number is not recoverable.
func (s *whatsappOAuthService) pickPhoneNumberID(req request.WhatsAppOAuthCallbackRequest, result *response.WhatsAppOAuthConnectResponse, wabaID string) string {
	if phoneNumberID := strings.TrimSpace(req.PhoneNumberID); phoneNumberID != "" {
		return phoneNumberID
	}
	if result.PhoneNumberID != "" {
		return result.PhoneNumberID
	}
	wabaID = strings.TrimSpace(wabaID)
	if wabaID == "" {
		return ""
	}
	var found string
	count := 0
	for _, account := range result.Accounts {
		if account.WabaID != wabaID {
			continue
		}
		for _, number := range account.PhoneNumbers {
			count++
			if found == "" {
				found = number.PhoneNumberID
			}
		}
	}
	if count == 1 {
		return found
	}
	return ""
}

// maskWhatsAppToken keeps enough of a token to recognise it in a list without
// making the masked value usable.
func maskWhatsAppToken(token string) string {
	token = strings.TrimSpace(token)
	if len(token) <= 8 {
		return "********"
	}
	return token[:4] + "…" + token[len(token)-4:]
}

package services

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/dto/response"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/pkg/i18nx"
	"agent-desk/internal/repositories"

	"agent-desk/internal/pkg/httpx/params"

	"github.com/mlogclub/simple/common/strs"
	"github.com/mlogclub/simple/sqls"
)

var SystemConfigService = newSystemConfigService()

func newSystemConfigService() *systemConfigService {
	return &systemConfigService{}
}

type systemConfigService struct {
}

const (
	systemConfigGroupSupportCenter = "support"
	systemConfigKeySupportNavMenu  = "navigationMenu"
)

type configValidator interface {
	Validate(raw json.RawMessage) (json.RawMessage, []response.ConfigFieldError, error)
}

type systemConfigDefinition struct {
	GroupCode    string
	Key          string
	Title        string
	Description  string
	DefaultValue any
	Validator    configValidator
}

type SystemConfigValidationError struct {
	errors []response.ConfigFieldError
}

func (e *SystemConfigValidationError) Error() string {
	return e.Message(i18nx.DefaultLocale)
}

func (e *SystemConfigValidationError) Message(locale string) string {
	if len(e.errors) == 0 {
		return i18nx.Getf(locale, "error.supportConfig.validationFailed")
	}
	return fmt.Sprintf("%s: %s", i18nx.Getf(locale, "error.supportConfig.validationFailed"), e.errors[0].Message)
}

func (e *SystemConfigValidationError) FieldErrors() []response.ConfigFieldError {
	if e == nil {
		return nil
	}
	return e.errors
}

var systemConfigDefinitions = map[string]map[string]systemConfigDefinition{
	systemConfigGroupSupportCenter: {
		systemConfigKeySupportNavMenu: {
			GroupCode:    systemConfigGroupSupportCenter,
			Key:          systemConfigKeySupportNavMenu,
			Title:        "支持中心导航菜单",
			Description:  "支持中心公开页面顶部和移动端导航菜单",
			DefaultValue: defaultSupportNavigationMenu(),
			Validator:    supportNavigationMenuValidator{},
		},
	},
}

func (s *systemConfigService) Get(id int64) *models.SystemConfig {
	return repositories.SystemConfigRepository.Get(sqls.DB(), id)
}

func (s *systemConfigService) Take(where ...interface{}) *models.SystemConfig {
	return repositories.SystemConfigRepository.Take(sqls.DB(), where...)
}

func (s *systemConfigService) Find(cnd *sqls.Cnd) []models.SystemConfig {
	return repositories.SystemConfigRepository.Find(sqls.DB(), cnd)
}

func (s *systemConfigService) FindByGroupCode(groupCode string) []models.SystemConfig {
	return repositories.SystemConfigRepository.FindByGroupCode(sqls.DB(), groupCode)
}

func (s *systemConfigService) GetByGroupAndKey(groupCode, key string) *models.SystemConfig {
	return repositories.SystemConfigRepository.FindByGroupAndKey(sqls.DB(), groupCode, key)
}

func (s *systemConfigService) FindOne(cnd *sqls.Cnd) *models.SystemConfig {
	return repositories.SystemConfigRepository.FindOne(sqls.DB(), cnd)
}

func (s *systemConfigService) FindPageByParams(params *params.QueryParams) (list []models.SystemConfig, paging *sqls.Paging) {
	return repositories.SystemConfigRepository.FindPageByParams(sqls.DB(), params)
}

func (s *systemConfigService) FindPageByCnd(cnd *sqls.Cnd) (list []models.SystemConfig, paging *sqls.Paging) {
	return repositories.SystemConfigRepository.FindPageByCnd(sqls.DB(), cnd)
}

func (s *systemConfigService) Count(cnd *sqls.Cnd) int64 {
	return repositories.SystemConfigRepository.Count(sqls.DB(), cnd)
}

func (s *systemConfigService) Create(t *models.SystemConfig) error {
	return repositories.SystemConfigRepository.Create(sqls.DB(), t)
}

func (s *systemConfigService) Update(t *models.SystemConfig) error {
	return repositories.SystemConfigRepository.Update(sqls.DB(), t)
}

func (s *systemConfigService) Updates(id int64, columns map[string]interface{}) error {
	return repositories.SystemConfigRepository.Updates(sqls.DB(), id, columns)
}

func (s *systemConfigService) UpdateColumn(id int64, name string, value interface{}) error {
	return repositories.SystemConfigRepository.UpdateColumn(sqls.DB(), id, name, value)
}

func (s *systemConfigService) Delete(id int64) {
	repositories.SystemConfigRepository.Delete(sqls.DB(), id)
}

func (s *systemConfigService) GetPublicSupportConfig() response.PublicSupportConfigResponse {
	return response.PublicSupportConfigResponse{
		NavigationMenu: s.enabledSupportNavigationMenu(),
	}
}

func (s *systemConfigService) GetDashboardSupportConfig() response.DashboardSupportConfigResponse {
	return response.DashboardSupportConfigResponse{
		NavigationMenu: s.supportNavigationMenu(),
	}
}

func (s *systemConfigService) SaveSupportConfig(payload map[string]json.RawMessage, operator *dto.AuthPrincipal) (response.DashboardSupportConfigResponse, error) {
	if err := s.SaveGroupConfig(systemConfigGroupSupportCenter, payload, operator); err != nil {
		return response.DashboardSupportConfigResponse{}, err
	}
	return s.GetDashboardSupportConfig(), nil
}

func (s *systemConfigService) SaveGroupConfig(groupCode string, payload map[string]json.RawMessage, operator *dto.AuthPrincipal) error {
	definitions := systemConfigDefinitions[groupCode]
	if len(definitions) == 0 {
		return errorsx.InvalidParamI18n("error.supportConfig.groupUnsupported")
	}
	if len(payload) == 0 {
		return errorsx.InvalidParamI18n("error.supportConfig.emptyPayload")
	}

	values := make(map[string]json.RawMessage, len(payload))
	for key, raw := range payload {
		definition, ok := definitions[key]
		if !ok {
			return errorsx.InvalidParamI18n("error.supportConfig.keyUnsupported", key)
		}
		normalized := raw
		if definition.Validator != nil {
			next, fieldErrors, err := definition.Validator.Validate(raw)
			if err != nil {
				return err
			}
			if len(fieldErrors) > 0 {
				return &SystemConfigValidationError{errors: fieldErrors}
			}
			normalized = next
		}
		values[key] = normalized
	}

	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		now := time.Now()
		operatorID, operatorName := auditOperator(operator)
		for key, raw := range values {
			definition := definitions[key]
			existing := repositories.SystemConfigRepository.FindByGroupAndKey(ctx.Tx, groupCode, key)
			if existing == nil {
				item := &models.SystemConfig{
					ConfigKey:   key,
					ConfigValue: string(raw),
					GroupCode:   groupCode,
					Title:       definition.Title,
					Description: definition.Description,
					Status:      enums.StatusOk,
					AuditFields: models.AuditFields{
						CreatedAt:      now,
						UpdatedAt:      now,
						CreateUserID:   operatorID,
						CreateUserName: operatorName,
						UpdateUserID:   operatorID,
						UpdateUserName: operatorName,
					},
				}
				if err := repositories.SystemConfigRepository.Create(ctx.Tx, item); err != nil {
					return err
				}
				continue
			}
			columns := map[string]any{
				"config_value":     string(raw),
				"group_code":       groupCode,
				"title":            definition.Title,
				"description":      definition.Description,
				"status":           enums.StatusOk,
				"updated_at":       now,
				"update_user_id":   operatorID,
				"update_user_name": operatorName,
			}
			if err := repositories.SystemConfigRepository.Updates(ctx.Tx, existing.ID, columns); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *systemConfigService) UpdateSupportNavigationMenu(items []request.SupportNavigationMenuItemRequest, operator *dto.AuthPrincipal) ([]response.SupportNavigationMenuItemResponse, error) {
	raw, err := json.Marshal(items)
	if err != nil {
		return nil, err
	}
	_, err = s.SaveSupportConfig(map[string]json.RawMessage{
		systemConfigKeySupportNavMenu: raw,
	}, operator)
	if err != nil {
		return nil, err
	}
	return s.supportNavigationMenu(), nil
}

func (s *systemConfigService) enabledSupportNavigationMenu() []response.SupportNavigationMenuItemResponse {
	items := s.supportNavigationMenu()
	enabled := make([]response.SupportNavigationMenuItemResponse, 0, len(items))
	for _, item := range items {
		if item.Visible {
			item.Children = visibleSupportNavigationChildren(item.Children)
			enabled = append(enabled, item)
		}
	}
	if len(enabled) == 0 {
		return defaultSupportNavigationMenu()
	}
	return enabled
}

func (s *systemConfigService) supportNavigationMenu() []response.SupportNavigationMenuItemResponse {
	item := repositories.SystemConfigRepository.FindByGroupAndKey(sqls.DB(), systemConfigGroupSupportCenter, systemConfigKeySupportNavMenu)
	if item == nil || strings.TrimSpace(item.ConfigValue) == "" {
		return defaultSupportNavigationMenu()
	}
	var list []response.SupportNavigationMenuItemResponse
	if err := json.Unmarshal([]byte(item.ConfigValue), &list); err != nil {
		return defaultSupportNavigationMenu()
	}
	if len(list) == 0 {
		return defaultSupportNavigationMenu()
	}
	return sortSupportNavigationMenu(list)
}

type supportNavigationMenuValidator struct{}

func (supportNavigationMenuValidator) Validate(raw json.RawMessage) (json.RawMessage, []response.ConfigFieldError, error) {
	var input []request.SupportNavigationMenuItemRequest
	if err := json.Unmarshal(raw, &input); err != nil {
		return nil, []response.ConfigFieldError{configFieldError("", "invalid_json", "error.supportConfig.navigationInvalidJSON")}, nil
	}
	items, fieldErrors := normalizeSupportNavigationMenu(input)
	if len(fieldErrors) > 0 {
		return nil, fieldErrors, nil
	}
	normalized, err := json.Marshal(items)
	if err != nil {
		return nil, nil, err
	}
	return normalized, nil, nil
}

func normalizeSupportNavigationMenu(input []request.SupportNavigationMenuItemRequest) ([]response.SupportNavigationMenuItemResponse, []response.ConfigFieldError) {
	if len(input) == 0 {
		return nil, []response.ConfigFieldError{configFieldError("navigationMenu", "required", "error.supportConfig.navigationRequired")}
	}
	if len(input) > 20 {
		return nil, []response.ConfigFieldError{configFieldError("navigationMenu", "too_many", "error.supportConfig.navigationTooMany")}
	}
	seenIDs := make(map[string]int)
	items, visibleCount, fieldErrors := normalizeSupportNavigationItems(input, "navigationMenu", 1, seenIDs)
	if len(fieldErrors) > 0 {
		return nil, fieldErrors
	}
	if visibleCount == 0 {
		return nil, []response.ConfigFieldError{configFieldError("navigationMenu", "visible_required", "error.supportConfig.navigationVisibleRequired")}
	}
	return items, nil
}

func normalizeSupportNavigationItems(input []request.SupportNavigationMenuItemRequest, path string, depth int, seenIDs map[string]int) ([]response.SupportNavigationMenuItemResponse, int, []response.ConfigFieldError) {
	items := make([]response.SupportNavigationMenuItemResponse, 0, len(input))
	visibleCount := 0
	for idx, raw := range input {
		itemPath := fmt.Sprintf("%s[%d]", path, idx)
		title := strings.TrimSpace(raw.Title)
		if title == "" {
			return nil, 0, []response.ConfigFieldError{configFieldError(itemPath+".title", "required", "error.supportConfig.navigationTitleRequired")}
		}
		if len([]rune(title)) > 64 {
			return nil, 0, []response.ConfigFieldError{configFieldError(itemPath+".title", "too_long", "error.supportConfig.navigationTitleTooLong")}
		}
		link := strings.TrimSpace(raw.URL)
		if link == "" {
			return nil, 0, []response.ConfigFieldError{configFieldError(itemPath+".url", "required", "error.supportConfig.navigationURLRequired")}
		}
		if !isAllowedSupportNavigationURL(link) {
			return nil, 0, []response.ConfigFieldError{configFieldError(itemPath+".url", "invalid_url", "error.supportConfig.navigationURLInvalid")}
		}
		id := normalizeSupportNavigationMenuID(raw.ID)
		if id == "" {
			id = "nav-" + strings.ReplaceAll(strs.UUID(), "-", "")[:12]
		}
		if count := seenIDs[id]; count > 0 {
			id = id + "-" + strings.ReplaceAll(strs.UUID(), "-", "")[:6]
		}
		seenIDs[id]++
		visible := true
		if raw.Visible != nil {
			visible = *raw.Visible
		}
		children := []response.SupportNavigationMenuItemResponse(nil)
		if len(raw.Children) > 0 {
			if depth >= 2 {
				return nil, 0, []response.ConfigFieldError{configFieldError(itemPath+".children", "too_deep", "error.supportConfig.navigationTooDeep")}
			}
			if len(raw.Children) > 20 {
				return nil, 0, []response.ConfigFieldError{configFieldError(itemPath+".children", "too_many", "error.supportConfig.navigationChildrenTooMany")}
			}
			nextChildren, nextVisibleCount, fieldErrors := normalizeSupportNavigationItems(raw.Children, itemPath+".children", depth+1, seenIDs)
			if len(fieldErrors) > 0 {
				return nil, 0, fieldErrors
			}
			children = nextChildren
			if nextVisibleCount > 0 && visible {
				visibleCount += nextVisibleCount
			}
		}
		if visible {
			visibleCount++
		}
		items = append(items, response.SupportNavigationMenuItemResponse{
			ID:              id,
			Title:           title,
			URL:             link,
			OpenInNewWindow: raw.OpenInNewWindow,
			Visible:         visible,
			SortNo:          (idx + 1) * 10,
			Children:        children,
		})
	}
	return items, visibleCount, nil
}

func isAllowedSupportNavigationURL(value string) bool {
	if strings.HasPrefix(value, "/") {
		return !strings.HasPrefix(value, "//")
	}
	parsed, err := url.Parse(value)
	if err != nil {
		return false
	}
	return parsed.Scheme == "http" || parsed.Scheme == "https"
}

func normalizeSupportNavigationMenuID(value string) string {
	value = strings.TrimSpace(strings.ToLower(value))
	if value == "" {
		return ""
	}
	var builder strings.Builder
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			builder.WriteRune(r)
		}
	}
	return strings.Trim(builder.String(), "-_")
}

func sortSupportNavigationMenu(items []response.SupportNavigationMenuItemResponse) []response.SupportNavigationMenuItemResponse {
	ret := append([]response.SupportNavigationMenuItemResponse(nil), items...)
	for i := 0; i < len(ret)-1; i++ {
		for j := i + 1; j < len(ret); j++ {
			if ret[j].SortNo < ret[i].SortNo || (ret[j].SortNo == ret[i].SortNo && ret[j].ID < ret[i].ID) {
				ret[i], ret[j] = ret[j], ret[i]
			}
		}
	}
	return ret
}

func visibleSupportNavigationChildren(items []response.SupportNavigationMenuItemResponse) []response.SupportNavigationMenuItemResponse {
	if len(items) == 0 {
		return nil
	}
	visible := make([]response.SupportNavigationMenuItemResponse, 0, len(items))
	for _, item := range sortSupportNavigationMenu(items) {
		if item.Visible {
			visible = append(visible, item)
		}
	}
	return visible
}

func auditOperator(operator *dto.AuthPrincipal) (int64, string) {
	if operator == nil {
		return 0, "system"
	}
	name := operator.Nickname
	if name == "" {
		name = operator.Username
	}
	if name == "" {
		name = "system"
	}
	return operator.UserID, name
}

func configFieldError(path, code, key string) response.ConfigFieldError {
	return response.ConfigFieldError{
		Path:    path,
		Code:    code,
		Message: i18nx.Get(key),
	}
}

func defaultSupportNavigationMenu() []response.SupportNavigationMenuItemResponse {
	return []response.SupportNavigationMenuItemResponse{
		{ID: "home", Title: "首页", URL: "/support", SortNo: 10, Visible: true},
		{ID: "docs", Title: "文档", URL: "/support/docs", SortNo: 20, Visible: true},
		{ID: "community", Title: "社区", URL: "/support/community/posts", SortNo: 30, Visible: true},
	}
}

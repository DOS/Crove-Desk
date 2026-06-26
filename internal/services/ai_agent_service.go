package services

import (
	"encoding/json"
	"slices"
	"strings"
	"time"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/pkg/toolx"
	"agent-desk/internal/pkg/utils"
	"agent-desk/internal/repositories"

	"agent-desk/internal/pkg/httpx/params"

	"github.com/mlogclub/simple/sqls"
)

var AIAgentService = newAIAgentService()

func newAIAgentService() *aIAgentService {
	return &aIAgentService{}
}

type aIAgentService struct {
}

func (s *aIAgentService) Get(id int64) *models.AIAgent {
	if id <= 0 {
		return nil
	}
	return repositories.AIAgentRepository.Get(sqls.DB(), id)
}

func (s *aIAgentService) Take(where ...interface{}) *models.AIAgent {
	return repositories.AIAgentRepository.Take(sqls.DB(), where...)
}

func (s *aIAgentService) Find(cnd *sqls.Cnd) []models.AIAgent {
	return repositories.AIAgentRepository.Find(sqls.DB(), cnd)
}

func (s *aIAgentService) FindOne(cnd *sqls.Cnd) *models.AIAgent {
	return repositories.AIAgentRepository.FindOne(sqls.DB(), cnd)
}

func (s *aIAgentService) FindPageByParams(params *params.QueryParams) (list []models.AIAgent, paging *sqls.Paging) {
	return repositories.AIAgentRepository.FindPageByParams(sqls.DB(), params)
}

func (s *aIAgentService) FindPageByCnd(cnd *sqls.Cnd) (list []models.AIAgent, paging *sqls.Paging) {
	return repositories.AIAgentRepository.FindPageByCnd(sqls.DB(), cnd)
}

func (s *aIAgentService) Count(cnd *sqls.Cnd) int64 {
	return repositories.AIAgentRepository.Count(sqls.DB(), cnd)
}

func (s *aIAgentService) FindByIds(ids []int64) []models.AIAgent {
	return repositories.AIAgentRepository.FindByIds(sqls.DB(), ids)
}

func (s *aIAgentService) CreateAIAgent(req request.CreateAIAgentRequest, operator *dto.AuthPrincipal) (*models.AIAgent, error) {
	if operator == nil {
		return nil, errorsx.UnauthorizedI18n("error.auth.expired")
	}
	item, err := s.buildAIAgentModel(0, req)
	if err != nil {
		return nil, err
	}
	item.Status = enums.StatusOk
	item.SortNo = 0
	item.AuditFields = utils.BuildAuditFields(operator)
	if err := sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		if err := repositories.AIAgentRepository.Create(ctx.Tx, item); err != nil {
			return err
		}
		_, err := AIWorkflowService.createDefaultAgentWorkflow(ctx.Tx, item, operator)
		return err
	}); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *aIAgentService) UpdateAIAgent(req request.UpdateAIAgentRequest, operator *dto.AuthPrincipal) error {
	if operator == nil {
		return errorsx.UnauthorizedI18n("error.auth.expired")
	}
	if s.Get(req.ID) == nil {
		return errorsx.InvalidParamI18n("error.e0002")
	}
	item, err := s.buildAIAgentModel(req.ID, req.CreateAIAgentRequest)
	if err != nil {
		return err
	}
	return repositories.AIAgentRepository.Updates(sqls.DB(), req.ID, map[string]any{
		"name":                  item.Name,
		"description":           item.Description,
		"ai_config_id":          item.AIConfigID,
		"service_mode":          item.ServiceMode,
		"system_prompt":         item.SystemPrompt,
		"welcome_message":       item.WelcomeMessage,
		"reply_timeout_seconds": item.ReplyTimeoutSeconds,
		"team_ids":              item.TeamIDs,
		"handoff_mode":          item.HandoffMode,
		"fallback_mode":         item.FallbackMode,
		"fallback_message":      item.FallbackMessage,
		"knowledge_ids":         item.KnowledgeIDs,
		"skill_ids":             item.SkillIDs,
		"allowed_mcp_tools":     item.AllowedMCPTools,
		"update_user_id":        operator.UserID,
		"update_user_name":      operator.Username,
		"updated_at":            time.Now(),
	})
}

func (s *aIAgentService) DeleteAIAgent(id int64, operator *dto.AuthPrincipal) error {
	current := s.Get(id)
	if current == nil {
		return errorsx.InvalidParamI18n("error.e0002")
	}
	if ChannelService.Take("ai_agent_id = ?", id) != nil {
		return errorsx.ForbiddenI18n("error.e0185")
	}
	return repositories.AIAgentRepository.Updates(sqls.DB(), id, map[string]any{
		"status":           enums.StatusDeleted,
		"update_user_id":   operator.UserID,
		"update_user_name": operator.Username,
		"updated_at":       time.Now(),
	})
}

func (s *aIAgentService) buildAIAgentModel(id int64, req request.CreateAIAgentRequest) (*models.AIAgent, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, errorsx.InvalidParamI18n("error.e0005")
	}
	if exists := s.Take("name = ? AND id <> ?", name, id); exists != nil {
		return nil, errorsx.InvalidParamI18n("error.e0006")
	}
	if req.AIConfigID <= 0 {
		return nil, errorsx.InvalidParamI18n("error.e0010")
	}
	aiConfig := AIConfigService.Get(req.AIConfigID)
	if aiConfig == nil {
		return nil, errorsx.InvalidParamI18n("error.e0009")
	}
	if aiConfig.Status != enums.StatusOk {
		return nil, errorsx.InvalidParamI18n("error.e0011")
	}
	if !slices.Contains(enums.IMConversationServiceModeValues, req.ServiceMode) {
		return nil, errorsx.InvalidParamI18n("error.e0230")
	}
	teamIDs, err := s.normalizeTeamIDs(req.TeamIDs)
	if err != nil {
		return nil, err
	}

	if !slices.Contains(enums.AIAgentHandoffModeValues, enums.AIAgentHandoffMode(req.HandoffMode)) {
		return nil, errorsx.InvalidParamI18n("error.e0336")
	}
	if req.FallbackMode == 0 {
		req.FallbackMode = enums.AIAgentFallbackModeNoAnswer
	}
	if !slices.Contains(enums.AIAgentFallbackModeValues, enums.AIAgentFallbackMode(req.FallbackMode)) {
		return nil, errorsx.InvalidParamI18n("error.e0123")
	}
	if enums.AIAgentHandoffMode(req.HandoffMode) == enums.AIAgentHandoffModeDefaultTeamPool && len(teamIDs) == 0 {
		return nil, errorsx.InvalidParamI18n("error.e0347")
	}
	if req.ReplyTimeoutSeconds < 0 {
		return nil, errorsx.InvalidParamI18n("error.e0144")
	}

	knowledgeIDs, err := s.normalizeKnowledgeIDs(req.KnowledgeIDs)
	if err != nil {
		return nil, err
	}
	if len(knowledgeIDs) == 0 {
		return nil, errorsx.InvalidParamI18n("error.e0320")
	}
	skillIDs, err := s.normalizeSkillIDs(req.SkillIDs)
	if err != nil {
		return nil, err
	}
	directTools, err := s.normalizeDirectTools(req.DirectTools)
	if err != nil {
		return nil, err
	}
	directToolsJSON := ""
	if len(directTools) > 0 {
		buf, marshalErr := json.Marshal(directTools)
		if marshalErr != nil {
			return nil, errorsx.InvalidParamI18n("error.e0021")
		}
		directToolsJSON = string(buf)
	}
	return &models.AIAgent{
		Name:                name,
		Description:         strings.TrimSpace(req.Description),
		AIConfigID:          req.AIConfigID,
		ServiceMode:         req.ServiceMode,
		SystemPrompt:        strings.TrimSpace(req.SystemPrompt),
		WelcomeMessage:      strings.TrimSpace(req.WelcomeMessage),
		ReplyTimeoutSeconds: req.ReplyTimeoutSeconds,
		TeamIDs:             utils.JoinInt64s(teamIDs),
		HandoffMode:         req.HandoffMode,
		FallbackMode:        req.FallbackMode,
		FallbackMessage:     strings.TrimSpace(req.FallbackMessage),
		KnowledgeIDs:        utils.JoinInt64s(knowledgeIDs),
		SkillIDs:            utils.JoinInt64s(skillIDs),
		AllowedMCPTools:     directToolsJSON,
		WorkflowVersionID:   0,
	}, nil
}

func (s *aIAgentService) normalizeTeamIDs(input []int64) ([]int64, error) {
	ret := make([]int64, 0, len(input))
	seen := make(map[int64]struct{})
	for _, id := range input {
		if id <= 0 {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		team := AgentTeamService.Get(id)
		if team == nil || team.Status == enums.StatusDeleted {
			continue
		}
		// if team.Status != enums.StatusOk {
		// 	return nil, errorsx.InvalidParamI18n("error.e0173")
		// }
		seen[id] = struct{}{}
		ret = append(ret, id)
	}
	slices.Sort(ret)
	return ret, nil
}

func (s *aIAgentService) normalizeKnowledgeIDs(input []int64) ([]int64, error) {
	ret := make([]int64, 0, len(input))
	seen := make(map[int64]struct{})
	for _, id := range input {
		if id <= 0 {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		kb := KnowledgeBaseService.Get(id)
		if kb == nil || kb.Status == enums.StatusDeleted {
			continue
		}
		// if kb.Status != enums.StatusOk {
		// 	return nil, errorsx.InvalidParamI18n("error.e0285")
		// }
		seen[id] = struct{}{}
		ret = append(ret, id)
	}
	return ret, nil
}

func (s *aIAgentService) normalizeSkillIDs(input []int64) ([]int64, error) {
	ret := make([]int64, 0, len(input))
	seen := make(map[int64]struct{})
	for _, id := range input {
		if id <= 0 {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		skill := SkillDefinitionService.Get(id)
		if skill == nil || skill.Status == enums.StatusDeleted {
			continue
		}
		// if skill.Status != enums.StatusOk {
		// 	return nil, errorsx.InvalidParamI18n("error.e0056")
		// }
		seen[id] = struct{}{}
		ret = append(ret, id)
	}
	return ret, nil
}

func (s *aIAgentService) normalizeDirectTools(input []request.AIAgentMCPToolRequest) ([]request.AIAgentMCPToolRequest, error) {
	if len(input) == 0 {
		return nil, nil
	}
	ret := make([]request.AIAgentMCPToolRequest, 0, len(input))
	seen := make(map[string]struct{})
	for _, item := range input {
		normalized, err := toolx.NormalizeMCPToolRequest(item)
		if err != nil {
			return nil, err
		}
		if toolx.IsAutoInjectedToolCode(strings.TrimSpace(normalized.ToolCode)) {
			continue
		}
		if toolx.ResolveToolSourceType(normalized.ToolCode) != enums.ToolSourceTypeMCP {
			return nil, errorsx.InvalidParamI18n("error.e0020")
		}
		if err := ToolCatalogService.ValidateToolCode(normalized.ToolCode); err != nil {
			return nil, err
		}
		key := strings.TrimSpace(normalized.ToolCode)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		ret = append(ret, normalized)
	}
	return ret, nil
}

func (s *aIAgentService) UpdateSort(ids []int64) error {
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		for i, id := range ids {
			if err := repositories.AIAgentRepository.UpdateColumn(ctx.Tx, id, "sort_no", i+1); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *aIAgentService) UpdateStatus(id int64, status int, operator *dto.AuthPrincipal) error {
	if operator == nil {
		return errorsx.UnauthorizedI18n("error.auth.expired")
	}
	current := s.Get(id)
	if current == nil {
		return errorsx.InvalidParamI18n("error.e0002")
	}
	if status != int(enums.StatusOk) && status != int(enums.StatusDisabled) {
		return errorsx.InvalidParamI18n("error.e0254")
	}

	return repositories.AIAgentRepository.Updates(sqls.DB(), id, map[string]any{
		"status":           status,
		"update_user_id":   operator.UserID,
		"update_user_name": operator.Username,
		"updated_at":       time.Now(),
	})
}

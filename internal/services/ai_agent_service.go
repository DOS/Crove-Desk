package services

import (
	"encoding/json"
	"slices"
	"strings"
	"time"

	aitooling "agent-desk/internal/ai/tooling"
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
	"gorm.io/gorm"
)

var AIAgentService = newAIAgentService()

const defaultNewAutonomousRolloutPercent = 5

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
		bindings, err := s.replaceWorkflowBindings(ctx.Tx, item.ID, req.WorkflowBindings, operator)
		if err != nil {
			return err
		}
		return s.validateWorkflowBindingMode(ctx.Tx, item, bindings)
	}); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *aIAgentService) UpdateAIAgent(req request.UpdateAIAgentRequest, operator *dto.AuthPrincipal) error {
	if operator == nil {
		return errorsx.UnauthorizedI18n("error.auth.expired")
	}
	current := s.Get(req.ID)
	if current == nil {
		return errorsx.InvalidParamI18n("error.e0002")
	}
	item, err := s.buildAIAgentModel(req.ID, req.CreateAIAgentRequest)
	if err != nil {
		return err
	}
	columns := map[string]any{
		"name":                  item.Name,
		"description":           item.Description,
		"ai_config_id":          item.AIConfigID,
		"runtime_mode":          item.RuntimeMode,
		"max_steps":             item.MaxSteps,
		"context_window":        item.ContextWindow,
		"tool_policy":           item.ToolPolicy,
		"knowledge_policy":      item.KnowledgePolicy,
		"service_mode":          item.ServiceMode,
		"system_prompt":         item.SystemPrompt,
		"welcome_message":       item.WelcomeMessage,
		"reply_timeout_seconds": item.ReplyTimeoutSeconds,
		"rollout_percent":       item.RolloutPercent,
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
	}
	if item.RolloutPercent != current.RolloutPercent {
		columns["previous_rollout_percent"] = current.RolloutPercent
	}
	if current.RuntimeMode == enums.AIAgentRuntimeModeAutonomous || current.RuntimeMode == enums.AIAgentRuntimeModeHybrid || item.RuntimeMode == enums.AIAgentRuntimeModeAutonomous || item.RuntimeMode == enums.AIAgentRuntimeModeHybrid {
		// Draft edits must not silently change the already published autonomous or hybrid
		// behavior. The operator must explicitly publish the new revision.
		columns["published_revision_id"] = 0
	}
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		if err := repositories.AIAgentRepository.Updates(ctx.Tx, req.ID, columns); err != nil {
			return err
		}
		bindings, err := s.replaceWorkflowBindings(ctx.Tx, req.ID, req.WorkflowBindings, operator)
		if err != nil {
			return err
		}
		return s.validateWorkflowBindingMode(ctx.Tx, item, bindings)
	})
}

func (s *aIAgentService) validateWorkflowBindingMode(db *gorm.DB, agent *models.AIAgent, bindings []models.AIAgentWorkflowBinding) error {
	enabled := make([]models.AIAgentWorkflowBinding, 0, len(bindings))
	for _, binding := range bindings {
		if binding.Enabled {
			enabled = append(enabled, binding)
		}
	}
	if agent.RuntimeMode == enums.AIAgentRuntimeModeAutonomous {
		return nil
	}
	if len(enabled) == 0 {
		return errorsx.InvalidParam("workflow and hybrid agents require at least one enabled workflow")
	}
	if agent.RuntimeMode == enums.AIAgentRuntimeModeWorkflow && len(enabled) != 1 {
		return errorsx.InvalidParam("workflow agent requires exactly one enabled workflow")
	}
	return repositories.AIAgentRepository.Updates(db, agent.ID, map[string]any{"workflow_version_id": enabled[0].WorkflowVersionID})
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

// PublishAIAgent snapshots a non-workflow Agent before it can receive traffic.
func (s *aIAgentService) PublishAIAgent(id int64, operator *dto.AuthPrincipal) (*models.AgentRevision, error) {
	if operator == nil {
		return nil, errorsx.UnauthorizedI18n("error.auth.expired")
	}
	var revision *models.AgentRevision
	err := sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		agent := repositories.AIAgentRepository.Get(ctx.Tx, id)
		if agent == nil || agent.Status != enums.StatusOk {
			return errorsx.InvalidParamI18n("error.e0002")
		}
		if agent.RuntimeMode == enums.AIAgentRuntimeModeWorkflow {
			return errorsx.InvalidParam("workflow agents publish through their selected workflow version")
		}
		if err := s.validatePublishableAgent(ctx.Tx, agent); err != nil {
			return err
		}
		if agent.RuntimeMode == enums.AIAgentRuntimeModeHybrid && len(s.ListEnabledWorkflowBindings(ctx.Tx, agent.ID)) == 0 {
			return errorsx.InvalidParam("hybrid agent requires at least one published workflow")
		}
		var err error
		revision, err = AgentRevisionService.PublishSnapshot(ctx.Tx, agent, operator)
		if err != nil {
			return err
		}
		return repositories.AIAgentRepository.Updates(ctx.Tx, agent.ID, map[string]any{
			"published_revision_id": revision.ID,
			"update_user_id":        operator.UserID,
			"update_user_name":      operator.Username,
			"updated_at":            time.Now(),
		})
	})
	if err != nil {
		return nil, err
	}
	return revision, nil
}

func (s *aIAgentService) validatePublishableAgent(db *gorm.DB, agent *models.AIAgent) error {
	if agent == nil || agent.AIConfigID <= 0 {
		return errorsx.InvalidParam("ai agent model configuration is required before publishing")
	}
	config := repositories.AIConfigRepository.Get(db, agent.AIConfigID)
	if config == nil || config.Status != enums.StatusOk {
		return errorsx.InvalidParam("ai agent model configuration is unavailable")
	}
	if _, err := s.normalizeToolPolicy(agent.ToolPolicy); err != nil {
		return err
	}
	if strings.TrimSpace(agent.AllowedMCPTools) == "" {
		return nil
	}
	var directTools []request.AIAgentMCPToolRequest
	if err := json.Unmarshal([]byte(agent.AllowedMCPTools), &directTools); err != nil {
		return errorsx.InvalidParam("ai agent direct tools are invalid")
	}
	for _, item := range directTools {
		definition, err := aitooling.DefaultRegistry.Resolve(item.ToolCode)
		if err != nil || definition.InputSchema == nil {
			return errorsx.InvalidParam("ai agent direct tool definition is unavailable")
		}
		if definition.RequireConfirmation {
			return errorsx.InvalidParam("ai agent sensitive direct tools must be executed through a confirmed playbook")
		}
	}
	return nil
}

// RollbackAIAgent switches an Agent back to a previously published immutable
// revision. It never rewrites the historical snapshot itself.
func (s *aIAgentService) RollbackAIAgent(id, revisionID int64, operator *dto.AuthPrincipal) error {
	if operator == nil {
		return errorsx.UnauthorizedI18n("error.auth.expired")
	}
	if id <= 0 || revisionID <= 0 {
		return errorsx.InvalidParam("agent id and revision id are required")
	}
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		agent := repositories.AIAgentRepository.Get(ctx.Tx, id)
		if agent == nil || agent.Status != enums.StatusOk {
			return errorsx.InvalidParamI18n("error.e0002")
		}
		revision := repositories.AgentRevisionRepository.Get(ctx.Tx, revisionID)
		if revision == nil || revision.AgentID != agent.ID || revision.Status != enums.StatusOk {
			return errorsx.InvalidParam("agent revision does not exist")
		}
		updates := map[string]any{
			"published_revision_id": revision.ID,
			"update_user_id":        operator.UserID,
			"update_user_name":      operator.Username,
			"updated_at":            time.Now(),
		}
		return repositories.AIAgentRepository.Updates(ctx.Tx, agent.ID, updates)
	})
}

// RollbackAIAgentRollout restores the prior Agent rollout percentage and
// swaps it into history, allowing operators to undo and redo one rollout
// change without rewriting an immutable AgentRevision.
func (s *aIAgentService) RollbackAIAgentRollout(id int64, operator *dto.AuthPrincipal) error {
	if operator == nil {
		return errorsx.UnauthorizedI18n("error.auth.expired")
	}
	if id <= 0 {
		return errorsx.InvalidParam("agent id is required")
	}
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		agent := repositories.AIAgentRepository.Get(ctx.Tx, id)
		if agent == nil || agent.Status != enums.StatusOk {
			return errorsx.InvalidParamI18n("error.e0002")
		}
		if agent.PreviousRolloutPercent < 1 || agent.PreviousRolloutPercent > 100 {
			return errorsx.InvalidParam("agent rollout has no previous value to restore")
		}
		return repositories.AIAgentRepository.Updates(ctx.Tx, agent.ID, map[string]any{
			"rollout_percent":          agent.PreviousRolloutPercent,
			"previous_rollout_percent": agent.RolloutPercent,
			"update_user_id":           operator.UserID,
			"update_user_name":         operator.Username,
			"updated_at":               time.Now(),
		})
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
	if req.RuntimeMode == "" {
		req.RuntimeMode = enums.AIAgentRuntimeModeAutonomous
	}
	if !enums.IsValidAIAgentRuntimeMode(req.RuntimeMode) {
		return nil, errorsx.InvalidParam("invalid ai agent runtime mode")
	}
	if req.RuntimeMode != enums.AIAgentRuntimeModeWorkflow && req.RuntimeMode != enums.AIAgentRuntimeModeAutonomous && req.RuntimeMode != enums.AIAgentRuntimeModeHybrid {
		return nil, errorsx.InvalidParam("ai agent runtime mode is not available yet")
	}
	if req.MaxSteps == 0 {
		req.MaxSteps = 6
	}
	if req.MaxSteps < 1 || req.MaxSteps > 8 {
		return nil, errorsx.InvalidParam("ai agent max steps must be between 1 and 8")
	}
	if req.ContextWindow < 0 {
		return nil, errorsx.InvalidParam("ai agent context window must not be negative")
	}
	toolPolicy, err := s.normalizeToolPolicy(req.ToolPolicy)
	if err != nil {
		return nil, err
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
	if req.RolloutPercent == 0 {
		if req.RuntimeMode == enums.AIAgentRuntimeModeAutonomous || req.RuntimeMode == enums.AIAgentRuntimeModeHybrid {
			req.RolloutPercent = defaultNewAutonomousRolloutPercent
		} else {
			req.RolloutPercent = 100
		}
	}
	if req.RolloutPercent < 1 || req.RolloutPercent > 100 {
		return nil, errorsx.InvalidParam("ai agent rollout percent must be between 1 and 100")
	}

	skillIDs, err := s.normalizeSkillIDs(req.SkillIDs)
	if err != nil {
		return nil, err
	}
	knowledgeBaseIDs, err := s.normalizeKnowledgeBaseIDs(req.KnowledgeBaseIDs)
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
		RuntimeMode:         req.RuntimeMode,
		MaxSteps:            req.MaxSteps,
		ContextWindow:       req.ContextWindow,
		ToolPolicy:          toolPolicy,
		KnowledgePolicy:     strings.TrimSpace(req.KnowledgePolicy),
		ServiceMode:         req.ServiceMode,
		SystemPrompt:        strings.TrimSpace(req.SystemPrompt),
		WelcomeMessage:      strings.TrimSpace(req.WelcomeMessage),
		ReplyTimeoutSeconds: req.ReplyTimeoutSeconds,
		RolloutPercent:      req.RolloutPercent,
		TeamIDs:             utils.JoinInt64s(teamIDs),
		HandoffMode:         req.HandoffMode,
		FallbackMode:        req.FallbackMode,
		FallbackMessage:     strings.TrimSpace(req.FallbackMessage),
		KnowledgeIDs:        utils.JoinInt64s(knowledgeBaseIDs),
		SkillIDs:            utils.JoinInt64s(skillIDs),
		AllowedMCPTools:     directToolsJSON,
	}, nil
}

type normalizedAIAgentToolPolicy struct {
	MaxTotalCalls     int      `json:"maxTotalCalls,omitempty"`
	MaxArgumentBytes  int      `json:"maxArgumentBytes,omitempty"`
	AllowedRiskLevels []string `json:"allowedRiskLevels,omitempty"`
}

func (s *aIAgentService) normalizeToolPolicy(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", nil
	}
	policy := normalizedAIAgentToolPolicy{}
	if err := json.Unmarshal([]byte(raw), &policy); err != nil {
		return "", errorsx.InvalidParam("ai agent tool policy must be valid JSON")
	}
	if policy.MaxTotalCalls < 0 || policy.MaxTotalCalls > 8 {
		return "", errorsx.InvalidParam("ai agent tool policy maxTotalCalls must be between 1 and 8")
	}
	if policy.MaxArgumentBytes < 0 || policy.MaxArgumentBytes > 64*1024 {
		return "", errorsx.InvalidParam("ai agent tool policy maxArgumentBytes must be between 1 and 65536")
	}
	seen := make(map[string]struct{}, len(policy.AllowedRiskLevels))
	riskLevels := make([]string, 0, len(policy.AllowedRiskLevels))
	for _, level := range policy.AllowedRiskLevels {
		level = strings.ToLower(strings.TrimSpace(level))
		if level == "" {
			continue
		}
		if level != "read" && level != "write" && level != "sensitive" {
			return "", errorsx.InvalidParam("ai agent tool policy contains an invalid risk level")
		}
		if _, exists := seen[level]; exists {
			continue
		}
		seen[level] = struct{}{}
		riskLevels = append(riskLevels, level)
	}
	policy.AllowedRiskLevels = riskLevels
	data, err := json.Marshal(policy)
	if err != nil {
		return "", errorsx.InvalidParam("ai agent tool policy is invalid")
	}
	return string(data), nil
}

func (s *aIAgentService) normalizeKnowledgeBaseIDs(input []int64) ([]int64, error) {
	ret := make([]int64, 0, len(input))
	seen := make(map[int64]struct{})
	for _, id := range input {
		if id <= 0 {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		knowledgeBase := KnowledgeBaseService.Get(id)
		if knowledgeBase == nil || knowledgeBase.Status != enums.StatusOk {
			return nil, errorsx.InvalidParam("knowledge base is not available")
		}
		seen[id] = struct{}{}
		ret = append(ret, id)
	}
	slices.Sort(ret)
	return ret, nil
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
		if spec, registered := toolx.GetRegisteredToolSpec(normalized.ToolCode); registered {
			if !spec.DirectAccess || spec.AutoInjected || (spec.Code != toolx.BuiltinConversationContext.Code && spec.Code != toolx.BuiltinKnowledgeRetrieve.Code && spec.Code != toolx.GraphTriageServiceRequest.Code && spec.Code != toolx.GraphAnalyzeConversation.Code && spec.Code != toolx.GraphPrepareTicketDraft.Code) {
				return nil, errorsx.InvalidParamI18n("error.e0020")
			}
		} else {
			if toolx.ResolveToolSourceType(normalized.ToolCode) != enums.ToolSourceTypeMCP {
				return nil, errorsx.InvalidParamI18n("error.e0020")
			}
			if err := ToolCatalogService.ValidateToolCode(normalized.ToolCode); err != nil {
				return nil, err
			}
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

package services

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
	"time"

	"agent-desk/internal/ai/workflow/dsl"
	workflowregistry "agent-desk/internal/ai/workflow/registry"
	workflowvalidator "agent-desk/internal/ai/workflow/validator"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/pkg/httpx/params"
	"agent-desk/internal/pkg/utils"
	"agent-desk/internal/repositories"

	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

var AIWorkflowService = newAIWorkflowService()

func newAIWorkflowService() *aiWorkflowService {
	return &aiWorkflowService{
		registry: workflowregistry.DefaultRegistry(),
	}
}

type aiWorkflowService struct {
	registry *workflowregistry.Registry
}

type AIWorkflowRunAuditItem struct {
	Run      models.AIWorkflowRun
	Workflow *models.AIWorkflow
	Version  *models.AIWorkflowVersion
	Agent    *models.AIAgent
}

func (s *aiWorkflowService) Get(id int64) *models.AIWorkflow {
	if id <= 0 {
		return nil
	}
	return repositories.AIWorkflowRepository.Get(sqls.DB(), id)
}

func (s *aiWorkflowService) GetVersion(id int64) *models.AIWorkflowVersion {
	if id <= 0 {
		return nil
	}
	return repositories.AIWorkflowVersionRepository.Get(sqls.DB(), id)
}

func (s *aiWorkflowService) FindPageByCnd(cnd *sqls.Cnd) (list []models.AIWorkflow, paging *sqls.Paging) {
	return repositories.AIWorkflowRepository.FindPageByCnd(sqls.DB(), cnd)
}

func (s *aiWorkflowService) FindVersionPageByParams(params *params.QueryParams) (list []models.AIWorkflowVersion, paging *sqls.Paging) {
	return repositories.AIWorkflowVersionRepository.FindPageByParams(sqls.DB(), params)
}

func (s *aiWorkflowService) FindRunPageByCnd(cnd *sqls.Cnd) (list []models.AIWorkflowRun, paging *sqls.Paging) {
	return repositories.AIWorkflowRunRepository.FindPageByCnd(sqls.DB(), cnd)
}

func (s *aiWorkflowService) BuildRunAuditItems(list []models.AIWorkflowRun) []AIWorkflowRunAuditItem {
	ret := make([]AIWorkflowRunAuditItem, 0, len(list))
	if len(list) == 0 {
		return ret
	}
	workflowIDs := make([]int64, 0, len(list))
	versionIDs := make([]int64, 0, len(list))
	agentIDs := make([]int64, 0, len(list))
	for _, item := range list {
		workflowIDs = appendNonZeroInt64(workflowIDs, item.WorkflowID)
		versionIDs = appendNonZeroInt64(versionIDs, item.WorkflowVersionID)
		agentIDs = appendNonZeroInt64(agentIDs, item.AIAgentID)
	}
	var workflows []models.AIWorkflow
	if len(workflowIDs) > 0 {
		workflows = repositories.AIWorkflowRepository.Find(sqls.DB(), sqls.NewCnd().In("id", workflowIDs))
	}
	var versions []models.AIWorkflowVersion
	if len(versionIDs) > 0 {
		versions = repositories.AIWorkflowVersionRepository.Find(sqls.DB(), sqls.NewCnd().In("id", versionIDs))
	}
	var agents []models.AIAgent
	if len(agentIDs) > 0 {
		agents = repositories.AIAgentRepository.Find(sqls.DB(), sqls.NewCnd().In("id", agentIDs))
	}
	workflowByID := make(map[int64]*models.AIWorkflow, len(workflows))
	for i := range workflows {
		item := workflows[i]
		workflowByID[item.ID] = &item
	}
	versionByID := make(map[int64]*models.AIWorkflowVersion, len(versions))
	for i := range versions {
		item := versions[i]
		versionByID[item.ID] = &item
	}
	agentByID := make(map[int64]*models.AIAgent, len(agents))
	for i := range agents {
		item := agents[i]
		agentByID[item.ID] = &item
	}
	for _, run := range list {
		ret = append(ret, AIWorkflowRunAuditItem{
			Run:      run,
			Workflow: workflowByID[run.WorkflowID],
			Version:  versionByID[run.WorkflowVersionID],
			Agent:    agentByID[run.AIAgentID],
		})
	}
	return ret
}

func (s *aiWorkflowService) GetRunDetail(id int64) (*models.AIWorkflowRun, []models.AIWorkflowNodeRun) {
	if id <= 0 {
		return nil, nil
	}
	run := repositories.AIWorkflowRunRepository.Get(sqls.DB(), id)
	if run == nil {
		return nil, nil
	}
	nodes := repositories.AIWorkflowNodeRunRepository.Find(sqls.DB(), sqls.NewCnd().Eq("workflow_run_id", id).Asc("id"))
	return run, nodes
}

func appendNonZeroInt64(list []int64, value int64) []int64 {
	if value <= 0 {
		return list
	}
	for _, item := range list {
		if item == value {
			return list
		}
	}
	return append(list, value)
}

func (s *aiWorkflowService) GetByAgentID(agentID int64) *models.AIWorkflow {
	if agentID <= 0 {
		return nil
	}
	return repositories.AIWorkflowRepository.Take(sqls.DB(), "agent_id = ? AND status <> ?", agentID, enums.StatusDeleted)
}

func (s *aiWorkflowService) GetOrCreateAgentWorkflow(agentID int64, operator *dto.AuthPrincipal) (*models.AIWorkflow, error) {
	if operator == nil {
		return nil, errorsx.UnauthorizedI18n("error.auth.expired")
	}
	if agentID <= 0 {
		return nil, errorsx.InvalidParam("agent id is required")
	}
	if agent := AIAgentService.Get(agentID); agent == nil || agent.Status == enums.StatusDeleted {
		return nil, errorsx.InvalidParamI18n("error.e0002")
	}
	if item := s.GetByAgentID(agentID); item != nil {
		return item, nil
	}
	var item *models.AIWorkflow
	err := sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		if current := repositories.AIWorkflowRepository.Take(ctx.Tx, "agent_id = ? AND status <> ?", agentID, enums.StatusDeleted); current != nil {
			item = current
			return nil
		}
		agent := repositories.AIAgentRepository.Get(ctx.Tx, agentID)
		if agent == nil || agent.Status == enums.StatusDeleted {
			return errorsx.InvalidParamI18n("error.e0002")
		}
		created, err := s.createDefaultAgentWorkflow(ctx.Tx, agent, operator)
		if err != nil {
			return err
		}
		item = created
		return nil
	})
	if err != nil {
		return nil, err
	}
	return item, nil
}

func (s *aiWorkflowService) ListNodeSpecs() []workflowregistry.NodeSpec {
	return s.registry.List()
}

func (s *aiWorkflowService) DefaultAgentWorkflowDefinition() dsl.Definition {
	return defaultAgentWorkflowDefinition()
}

func (s *aiWorkflowService) ValidateDefinition(def dsl.Definition) workflowvalidator.Result {
	return workflowvalidator.ValidateDefinition(def, s.registry)
}

func (s *aiWorkflowService) CreateWorkflow(req request.CreateAIWorkflowRequest, operator *dto.AuthPrincipal) (*models.AIWorkflow, error) {
	return s.SaveAgentWorkflow(req, operator)
}

func (s *aiWorkflowService) SaveAgentWorkflow(req request.SaveAIWorkflowRequest, operator *dto.AuthPrincipal) (*models.AIWorkflow, error) {
	if operator == nil {
		return nil, errorsx.UnauthorizedI18n("error.auth.expired")
	}
	agent := AIAgentService.Get(req.AgentID)
	if agent == nil || agent.Status == enums.StatusDeleted {
		return nil, errorsx.InvalidParamI18n("error.e0002")
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = defaultAgentWorkflowName(agent.Name)
	}
	definition, err := marshalDefinition(req.Definition)
	if err != nil {
		return nil, err
	}
	current := s.GetByAgentID(req.AgentID)
	if current == nil {
		item := &models.AIWorkflow{
			Name:            name,
			Description:     strings.TrimSpace(req.Description),
			AgentID:         req.AgentID,
			Status:          enums.StatusOk,
			DraftDefinition: definition,
			AuditFields:     utils.BuildAuditFields(operator),
		}
		if err := repositories.AIWorkflowRepository.Create(sqls.DB(), item); err != nil {
			return nil, err
		}
		return item, nil
	}
	if err := repositories.AIWorkflowRepository.Updates(sqls.DB(), current.ID, map[string]interface{}{
		"name":             name,
		"description":      strings.TrimSpace(req.Description),
		"agent_id":         req.AgentID,
		"draft_definition": definition,
		"update_user_id":   operator.UserID,
		"update_user_name": operator.Username,
		"updated_at":       time.Now(),
	}); err != nil {
		return nil, err
	}
	return s.Get(current.ID), nil
}

func (s *aiWorkflowService) UpdateWorkflow(req request.UpdateAIWorkflowRequest, operator *dto.AuthPrincipal) error {
	if operator == nil {
		return errorsx.UnauthorizedI18n("error.auth.expired")
	}
	if s.Get(req.ID) == nil {
		return errorsx.InvalidParamI18n("error.e0002")
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return errorsx.InvalidParam("workflow name is required")
	}
	if req.AgentID <= 0 {
		return errorsx.InvalidParam("agent id is required")
	}
	definition, err := marshalDefinition(req.Definition)
	if err != nil {
		return err
	}
	return repositories.AIWorkflowRepository.Updates(sqls.DB(), req.ID, map[string]interface{}{
		"name":             name,
		"description":      strings.TrimSpace(req.Description),
		"agent_id":         req.AgentID,
		"draft_definition": definition,
		"update_user_id":   operator.UserID,
		"update_user_name": operator.Username,
		"updated_at":       time.Now(),
	})
}

func (s *aiWorkflowService) DeleteWorkflow(id int64, operator *dto.AuthPrincipal) error {
	if operator == nil {
		return errorsx.UnauthorizedI18n("error.auth.expired")
	}
	if s.Get(id) == nil {
		return errorsx.InvalidParamI18n("error.e0002")
	}
	return repositories.AIWorkflowRepository.Updates(sqls.DB(), id, map[string]interface{}{
		"status":           enums.StatusDeleted,
		"update_user_id":   operator.UserID,
		"update_user_name": operator.Username,
		"updated_at":       time.Now(),
	})
}

func (s *aiWorkflowService) PublishWorkflow(req request.PublishAIWorkflowRequest, operator *dto.AuthPrincipal) (*models.AIWorkflowVersion, error) {
	if req.AgentID > 0 {
		return s.PublishAgentWorkflow(req, operator)
	}
	if operator == nil {
		return nil, errorsx.UnauthorizedI18n("error.auth.expired")
	}
	workflow := s.Get(req.WorkflowID)
	if workflow == nil || workflow.Status == enums.StatusDeleted {
		return nil, errorsx.InvalidParamI18n("error.e0002")
	}
	result := s.ValidateDefinition(req.Definition)
	if !result.Valid {
		return nil, errorsx.InvalidParam("workflow definition is invalid")
	}
	definition, err := marshalDefinition(req.Definition)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	var version *models.AIWorkflowVersion
	err = sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		nextVersion := repositories.AIWorkflowVersionRepository.MaxVersionByWorkflowID(ctx.Tx, req.WorkflowID) + 1
		version = &models.AIWorkflowVersion{
			WorkflowID:      req.WorkflowID,
			Version:         nextVersion,
			Status:          enums.StatusOk,
			Definition:      definition,
			DefinitionHash:  hashDefinition(definition),
			PublishedAt:     &now,
			PublishedByID:   operator.UserID,
			PublishedByName: operator.Username,
			AuditFields:     utils.BuildAuditFields(operator),
		}
		if err := repositories.AIWorkflowVersionRepository.Create(ctx.Tx, version); err != nil {
			return err
		}
		return repositories.AIWorkflowRepository.Updates(ctx.Tx, req.WorkflowID, map[string]interface{}{
			"draft_definition":     definition,
			"published_version_id": version.ID,
			"update_user_id":       operator.UserID,
			"update_user_name":     operator.Username,
			"updated_at":           now,
		})
	})
	if err != nil {
		return nil, err
	}
	return version, nil
}

func (s *aiWorkflowService) PublishAgentWorkflow(req request.PublishAIWorkflowRequest, operator *dto.AuthPrincipal) (*models.AIWorkflowVersion, error) {
	if operator == nil {
		return nil, errorsx.UnauthorizedI18n("error.auth.expired")
	}
	workflow, err := s.GetOrCreateAgentWorkflow(req.AgentID, operator)
	if err != nil {
		return nil, err
	}
	req.WorkflowID = workflow.ID
	result := s.ValidateDefinition(req.Definition)
	if !result.Valid {
		return nil, errorsx.InvalidParam("workflow definition is invalid")
	}
	definition, err := marshalDefinition(req.Definition)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	var version *models.AIWorkflowVersion
	err = sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		current := repositories.AIWorkflowRepository.Get(ctx.Tx, workflow.ID)
		if current == nil || current.AgentID != req.AgentID || current.Status == enums.StatusDeleted {
			return errorsx.InvalidParamI18n("error.e0002")
		}
		nextVersion := repositories.AIWorkflowVersionRepository.MaxVersionByWorkflowID(ctx.Tx, current.ID) + 1
		version = &models.AIWorkflowVersion{
			WorkflowID:      current.ID,
			Version:         nextVersion,
			Status:          enums.StatusOk,
			Definition:      definition,
			DefinitionHash:  hashDefinition(definition),
			PublishedAt:     &now,
			PublishedByID:   operator.UserID,
			PublishedByName: operator.Username,
			AuditFields:     utils.BuildAuditFields(operator),
		}
		if err := repositories.AIWorkflowVersionRepository.Create(ctx.Tx, version); err != nil {
			return err
		}
		if err := repositories.AIWorkflowRepository.Updates(ctx.Tx, current.ID, map[string]interface{}{
			"draft_definition":     definition,
			"published_version_id": version.ID,
			"update_user_id":       operator.UserID,
			"update_user_name":     operator.Username,
			"updated_at":           now,
		}); err != nil {
			return err
		}
		return repositories.AIAgentRepository.Updates(ctx.Tx, req.AgentID, map[string]any{
			"workflow_version_id": version.ID,
			"update_user_id":      operator.UserID,
			"update_user_name":    operator.Username,
			"updated_at":          now,
		})
	})
	if err != nil {
		return nil, err
	}
	return version, nil
}

func (s *aiWorkflowService) createDefaultAgentWorkflow(db *gorm.DB, agent *models.AIAgent, operator *dto.AuthPrincipal) (*models.AIWorkflow, error) {
	definition, err := marshalDefinition(defaultAgentWorkflowDefinition())
	if err != nil {
		return nil, err
	}
	item := &models.AIWorkflow{
		Name:            defaultAgentWorkflowName(agent.Name),
		AgentID:         agent.ID,
		Status:          enums.StatusOk,
		DraftDefinition: definition,
		AuditFields:     utils.BuildAuditFields(operator),
	}
	if err := repositories.AIWorkflowRepository.Create(db, item); err != nil {
		return nil, err
	}
	return item, nil
}

func defaultAgentWorkflowDefinition() dsl.Definition {
	return dsl.Definition{
		SchemaVersion: dsl.SchemaVersion,
		Nodes: []dsl.Node{
			workflowNode("start_1", workflowregistry.NodeTypeStart, "开始", 180, 285.5, nil, nil),
			workflowNode("understanding_1", workflowregistry.NodeTypeConversationUnderstanding, "会话理解", 640, 285.5, workflowInputs("userMessage", "start_1", "userMessage"), nil),
			workflowNode("policy_1", workflowregistry.NodeTypeReplyPolicy, "回复策略", 1100, 285.5, map[string]dsl.Value{
				"userMessage":   dsl.RefValue("start_1", "userMessage"),
				"messageIntent": dsl.RefValue("understanding_1", "messageIntent"),
				"answerScope":   dsl.RefValue("understanding_1", "answerScope"),
				"riskSignals":   dsl.RefValue("understanding_1", "riskSignals"),
			}, nil),
			workflowNode("policy_route_1", workflowregistry.NodeTypeCondition, "策略分流", 1560, 125.5, nil, dsl.ConditionConfig{Branches: []dsl.ConditionBranch{
				workflowConditionBranch("handoff", "转人工", "handoff_1", "policy_1", "action", "eq", "handoff_to_human"),
				workflowConditionBranch("ticket", "创建工单", "draft_ticket_1", "policy_1", "action", "eq", "prepare_ticket"),
				workflowConditionBranch("knowledge", "知识库回复", "retrieve_1", "policy_1", "action", "eq", "retrieve_knowledge"),
				workflowConditionBranch("direct", "直接回复", "policy_reply_1", "policy_1", "action", "eq", "direct_reply"),
				workflowConditionBranch("clarify", "追问澄清", "policy_reply_1", "policy_1", "action", "eq", "clarify"),
				workflowConditionBranch("end_conversation", "结束语", "policy_reply_1", "policy_1", "action", "eq", "end_conversation"),
				{ID: "default", Name: "策略兜底", TargetNodeID: "policy_reply_1", Default: true},
			}}),
			workflowNode("handoff_1", workflowregistry.NodeTypeHandoffToHuman, "转人工", 2020, 0, workflowInputs("reason", "start_1", "userMessage"), nil),
			workflowNode("draft_ticket_1", workflowregistry.NodeTypePrepareTicketDraft, "整理工单草稿", 2020, 379, workflowInputs("issue", "start_1", "userMessage"), nil),
			workflowNode("ticket_confirm_prompt_1", workflowregistry.NodeTypeLLMReply, "建单确认文案", 2480, 379, workflowInputs("userMessage", "start_1", "userMessage"), map[string]any{"staticReply": "我已整理工单草稿。请回复“确认”创建工单，或回复“取消”放弃。"}),
			workflowNode("ticket_confirm_1", workflowregistry.NodeTypeHumanConfirm, "确认建单", 2940, 379, workflowInputs("prompt", "ticket_confirm_prompt_1", "replyText"), nil),
			workflowNode("ticket_confirm_route_1", workflowregistry.NodeTypeCondition, "建单确认分流", 3400, 329, nil, dsl.ConditionConfig{Branches: []dsl.ConditionBranch{
				workflowConditionBranch("confirmed", "已确认", "create_ticket_1", "ticket_confirm_1", "confirmed", "is_true", nil),
				{ID: "default", Name: "取消或未确认", TargetNodeID: "ticket_cancel_reply_1", Default: true},
			}}),
			workflowNode("create_ticket_1", workflowregistry.NodeTypeCreateTicket, "创建工单", 3860, 285.5, map[string]dsl.Value{
				"ticketDraft": dsl.RefValue("draft_ticket_1", "ticketDraft"),
				"confirmed":   dsl.RefValue("ticket_confirm_1", "confirmed"),
			}, nil),
			workflowNode("ticket_result_reply_1", workflowregistry.NodeTypeSendReply, "发送建单结果", 4320, 285.5, workflowInputs("replyText", "create_ticket_1", "message"), nil),
			workflowNode("ticket_cancel_reply_1", workflowregistry.NodeTypeLLMReply, "取消建单提示", 3860, 472.5, workflowInputs("userMessage", "start_1", "userMessage"), map[string]any{"staticReply": "已取消创建工单。你可以继续补充问题，我会继续帮你处理。"}),
			workflowNode("send_ticket_cancel_1", workflowregistry.NodeTypeSendReply, "发送取消提示", 4320, 472.5, workflowInputs("replyText", "ticket_cancel_reply_1", "replyText"), nil),
			workflowNode("policy_reply_1", workflowregistry.NodeTypeSendReply, "发送策略回复", 4320, 98.5, workflowInputs("replyText", "policy_1", "replyText"), nil),
			workflowNode("handoff_end_1", workflowregistry.NodeTypeEnd, "结束", 2480, 0, nil, nil),
			workflowNode("retrieve_1", workflowregistry.NodeTypeKnowledgeRetrieve, "知识检索", 2480, 753, workflowInputs("query", "start_1", "userMessage"), nil),
			workflowNode("answerability_1", workflowregistry.NodeTypeAnswerabilityGate, "可回答判断", 2940, 753, map[string]dsl.Value{
				"userMessage":    dsl.RefValue("start_1", "userMessage"),
				"knowledgeItems": dsl.RefValue("retrieve_1", "items"),
			}, nil),
			workflowNode("answerability_route_1", workflowregistry.NodeTypeCondition, "可回答分流", 3400, 703, nil, dsl.ConditionConfig{Branches: []dsl.ConditionBranch{
				workflowConditionBranch("answerable", "可以回答", "reply_1", "answerability_1", "answerability", "eq", "answerable"),
				{ID: "default", Name: "兜底追问", TargetNodeID: "fallback_reply_1", Default: true},
			}}),
			workflowNode("reply_1", workflowregistry.NodeTypeLLMReply, "AI 回复", 3860, 659.5, map[string]dsl.Value{
				"userMessage":    dsl.RefValue("start_1", "userMessage"),
				"knowledgeItems": dsl.RefValue("retrieve_1", "items"),
			}, nil),
			workflowNode("send_1", workflowregistry.NodeTypeSendReply, "发送回复", 4320, 659.5, workflowInputs("replyText", "reply_1", "replyText"), nil),
			workflowNode("fallback_reply_1", workflowregistry.NodeTypeLLMReply, "兜底追问", 3860, 846.5, map[string]dsl.Value{
				"userMessage":    dsl.RefValue("start_1", "userMessage"),
				"knowledgeItems": dsl.RefValue("retrieve_1", "items"),
			}, nil),
			workflowNode("send_fallback_1", workflowregistry.NodeTypeSendReply, "发送兜底", 4320, 846.5, workflowInputs("replyText", "fallback_reply_1", "replyText"), nil),
			workflowNode("end_1", workflowregistry.NodeTypeEnd, "结束", 4780, 472.5, nil, nil),
		},
		Edges: []dsl.Edge{
			workflowEdge("start_1", "understanding_1"),
			workflowEdge("understanding_1", "policy_1"),
			workflowEdge("policy_1", "policy_route_1"),
			workflowPortEdge("policy_route_1", "policy_reply_1", "direct"),
			workflowPortEdge("policy_route_1", "policy_reply_1", "clarify"),
			workflowPortEdge("policy_route_1", "policy_reply_1", "end_conversation"),
			workflowPortEdge("policy_route_1", "handoff_1", "handoff"),
			workflowPortEdge("policy_route_1", "draft_ticket_1", "ticket"),
			workflowPortEdge("policy_route_1", "retrieve_1", "knowledge"),
			workflowPortEdge("policy_route_1", "policy_reply_1", "default"),
			workflowEdge("policy_reply_1", "end_1"),
			workflowEdge("handoff_1", "handoff_end_1"),
			workflowEdge("draft_ticket_1", "ticket_confirm_prompt_1"),
			workflowEdge("ticket_confirm_prompt_1", "ticket_confirm_1"),
			workflowEdge("ticket_confirm_1", "ticket_confirm_route_1"),
			workflowPortEdge("ticket_confirm_route_1", "create_ticket_1", "confirmed"),
			workflowPortEdge("ticket_confirm_route_1", "ticket_cancel_reply_1", "default"),
			workflowEdge("create_ticket_1", "ticket_result_reply_1"),
			workflowEdge("ticket_result_reply_1", "end_1"),
			workflowEdge("ticket_cancel_reply_1", "send_ticket_cancel_1"),
			workflowEdge("send_ticket_cancel_1", "end_1"),
			workflowEdge("retrieve_1", "answerability_1"),
			workflowEdge("answerability_1", "answerability_route_1"),
			workflowPortEdge("answerability_route_1", "reply_1", "answerable"),
			workflowPortEdge("answerability_route_1", "fallback_reply_1", "default"),
			workflowEdge("reply_1", "send_1"),
			workflowEdge("send_1", "end_1"),
			workflowEdge("fallback_reply_1", "send_fallback_1"),
			workflowEdge("send_fallback_1", "end_1"),
		},
	}
}

func workflowNode(id string, nodeType string, title string, x float64, y float64, inputs map[string]dsl.Value, config any) dsl.Node {
	return dsl.Node{
		ID:   id,
		Type: nodeType,
		Meta: dsl.NodeMeta{Position: dsl.Position{X: x, Y: y}},
		Data: dsl.NodeData{
			Title:        title,
			Config:       mustMarshalWorkflowConfig(config),
			InputsValues: inputs,
		},
	}
}

func workflowInputs(name string, nodeID string, field string) map[string]dsl.Value {
	return map[string]dsl.Value{name: dsl.RefValue(nodeID, field)}
}

func workflowConditionBranch(id string, name string, targetNodeID string, nodeID string, field string, operator string, right any) dsl.ConditionBranch {
	return dsl.ConditionBranch{
		ID:           id,
		Name:         name,
		TargetNodeID: targetNodeID,
		Condition: &dsl.Condition{
			Left:     &dsl.Value{Type: dsl.ValueTypeRef, Content: []string{nodeID, field}},
			Operator: operator,
			Right:    right,
		},
	}
}

func workflowEdge(source string, target string) dsl.Edge {
	return dsl.Edge{SourceNodeID: source, TargetNodeID: target}
}

func workflowPortEdge(source string, target string, sourcePortID string) dsl.Edge {
	return dsl.Edge{SourceNodeID: source, TargetNodeID: target, SourcePortID: sourcePortID}
}

func mustMarshalWorkflowConfig(value any) json.RawMessage {
	if value == nil {
		return nil
	}
	raw, err := json.Marshal(value)
	if err != nil {
		panic(err)
	}
	return raw
}

func defaultAgentWorkflowName(agentName string) string {
	agentName = strings.TrimSpace(agentName)
	if agentName == "" {
		return "会话流程"
	}
	return agentName + " 会话流程"
}

func marshalDefinition(def dsl.Definition) (string, error) {
	buf, err := json.Marshal(def)
	if err != nil {
		return "", errorsx.InvalidParam("invalid workflow definition")
	}
	return string(buf), nil
}

func hashDefinition(definition string) string {
	sum := sha256.Sum256([]byte(definition))
	return hex.EncodeToString(sum[:])
}

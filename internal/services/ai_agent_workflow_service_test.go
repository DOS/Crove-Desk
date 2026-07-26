//go:build legacy

package services

import (
	"encoding/json"
	"strings"
	"testing"

	"agent-desk/internal/ai/workflow/dsl"
	workflowregistry "agent-desk/internal/ai/workflow/registry"
	workflowvalidator "agent-desk/internal/ai/workflow/validator"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/toolx"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

func TestAIAgentServiceCreatesWorkflowOnlyWhenRequested(t *testing.T) {
	setupAIAgentWorkflowTestDB(t)
	operator := aiAgentWorkflowTestOperator()
	aiConfigID := createAIAgentWorkflowTestConfig(t)

	item, err := AIAgentService.CreateAIAgent(request.CreateAIAgentRequest{
		Name:         "workflow agent",
		AIConfigID:   aiConfigID,
		RuntimeMode:  enums.AIAgentRuntimeModeWorkflow,
		ServiceMode:  enums.IMConversationServiceModeAIOnly,
		HandoffMode:  enums.AIAgentHandoffModeWaitPool,
		FallbackMode: enums.AIAgentFallbackModeNoAnswer,
	}, operator)
	if err != nil {
		t.Fatalf("CreateAIAgent() error = %v", err)
	}
	if item.RuntimeMode != enums.AIAgentRuntimeModeWorkflow {
		t.Fatalf("default runtime mode = %q, want %q", item.RuntimeMode, enums.AIAgentRuntimeModeWorkflow)
	}
	if item.MaxSteps != 6 {
		t.Fatalf("default max steps = %d, want 6", item.MaxSteps)
	}
	if item.RolloutPercent != 100 {
		t.Fatalf("workflow rollout default = %d, want 100", item.RolloutPercent)
	}

	workflow, err := AIWorkflowService.GetOrCreateAgentWorkflow(item.ID, operator)
	if err != nil {
		t.Fatalf("GetOrCreateAgentWorkflow() error = %v", err)
	}
	if workflow.AgentID != item.ID {
		t.Fatalf("expected workflow agent id %d, got %d", item.ID, workflow.AgentID)
	}
	if workflow.Name != item.Name+" 会话流程" {
		t.Fatalf("unexpected workflow name: %s", workflow.Name)
	}
	var stored dsl.Definition
	if err := json.Unmarshal([]byte(workflow.DraftDefinition), &stored); err != nil {
		t.Fatalf("unmarshal draft definition: %v", err)
	}
	if stored.SchemaVersion != dsl.SchemaVersion || nodeTypeByID(stored, "start_1") != workflowregistry.NodeTypeStart {
		t.Fatalf("expected default draft definition")
	}
	validation := workflowvalidator.ValidateDefinition(stored, workflowregistry.DefaultRegistry())
	if validation.Valid || !workflowValidationHasMessage(validation, "需要选择至少一个知识库") {
		t.Fatalf("expected default workflow to require node knowledge bases, got %#v", validation.Errors)
	}
	if nodeTypeByID(stored, "understanding_1") != workflowregistry.NodeTypeConversationUnderstanding {
		t.Fatalf("expected default workflow to include conversation understanding, got nodes: %#v", stored.Nodes)
	}
	if nodeTypeByID(stored, "policy_1") != workflowregistry.NodeTypeReplyPolicy {
		t.Fatalf("expected default workflow to include reply policy, got nodes: %#v", stored.Nodes)
	}
	if !workflowEdgeExists(stored, "start_1", "understanding_1") || !workflowEdgeExists(stored, "understanding_1", "policy_1") {
		t.Fatalf("expected default workflow to start with policy-first understanding flow, got edges: %#v", stored.Edges)
	}
	for _, nodeType := range []string{
		workflowregistry.NodeTypeConversationUnderstanding,
		workflowregistry.NodeTypeReplyPolicy,
		workflowregistry.NodeTypeHandoffToHuman,
		workflowregistry.NodeTypePrepareTicketDraft,
		workflowregistry.NodeTypeHumanConfirm,
		workflowregistry.NodeTypeCreateTicket,
		workflowregistry.NodeTypeKnowledgeRetrieve,
		workflowregistry.NodeTypeAnswerabilityGate,
		workflowregistry.NodeTypeLLMReply,
		workflowregistry.NodeTypeSendReply,
	} {
		if !workflowHasNodeType(stored, nodeType) {
			t.Fatalf("expected default workflow to include %s node: %#v", nodeType, stored.Nodes)
		}
	}
	assertConditionBranchToNodeType(t, stored, "policy_route_1", workflowregistry.NodeTypeSendReply, "eq", "direct_reply")
	assertConditionBranchToNodeID(t, stored, "policy_route_1", "handoff_confirm_prompt_1", "eq", "handoff_to_human")
	assertConditionBranchToNodeType(t, stored, "policy_route_1", workflowregistry.NodeTypePrepareTicketDraft, "eq", "prepare_ticket")
	assertConditionBranchToNodeID(t, stored, "ticket_draft_route_1", "ticket_confirm_prompt_1", "is_true", nil)
	assertDefaultBranchToNodeID(t, stored, "ticket_draft_route_1", "ticket_followup_reply_1")
	assertConditionBranchToNodeID(t, stored, "handoff_confirm_route_1", "handoff_1", "is_true", nil)
	assertDefaultBranchToNodeID(t, stored, "handoff_confirm_route_1", "handoff_cancel_reply_1")
	assertConditionBranchToNodeID(t, stored, "answerability_route_1", "reply_1", "eq", "answerable")
	assertDefaultBranchToNodeID(t, stored, "answerability_route_1", "fallback_reply_1")
	if !workflowEdgeExists(stored, "create_ticket_1", "ticket_result_reply_1") {
		t.Fatalf("expected create_ticket to flow into a customer-visible result reply")
	}
	assertConditionBranchesHavePortEdges(t, stored, "policy_route_1")
	assertConditionBranchesHavePortEdges(t, stored, "ticket_draft_route_1")
	assertConditionBranchesHavePortEdges(t, stored, "ticket_confirm_route_1")
	assertConditionBranchesHavePortEdges(t, stored, "handoff_confirm_route_1")
	assertConditionBranchesHavePortEdges(t, stored, "answerability_route_1")
	assertConditionBranchOrder(t, stored, "policy_route_1", []string{
		"handoff",
		"direct",
		"clarify",
		"end_conversation",
		"ticket",
		"knowledge",
		"default",
	})
	assertConditionPortEdgeOrder(t, stored, "policy_route_1", []string{
		"handoff",
		"direct",
		"clarify",
		"end_conversation",
		"ticket",
		"knowledge",
		"default",
	})
}

func TestAIAgentServiceDefaultsNewAutonomousAgentToSmallRollout(t *testing.T) {
	setupAIAgentWorkflowTestDB(t)
	item, err := AIAgentService.CreateAIAgent(request.CreateAIAgentRequest{
		Name: "small-rollout autonomous agent", AIConfigID: createAIAgentWorkflowTestConfig(t), RuntimeMode: enums.AIAgentRuntimeModeAutonomous,
		ServiceMode: enums.IMConversationServiceModeAIOnly, HandoffMode: enums.AIAgentHandoffModeWaitPool, FallbackMode: enums.AIAgentFallbackModeNoAnswer,
	}, aiAgentWorkflowTestOperator())
	if err != nil {
		t.Fatalf("CreateAIAgent: %v", err)
	}
	if item.RolloutPercent != defaultNewAutonomousRolloutPercent {
		t.Fatalf("autonomous rollout default = %d, want %d", item.RolloutPercent, defaultNewAutonomousRolloutPercent)
	}
}

func TestAIAgentServiceDefaultsToAutonomousWithoutWorkflow(t *testing.T) {
	setupAIAgentWorkflowTestDB(t)
	operator := aiAgentWorkflowTestOperator()
	item, err := AIAgentService.CreateAIAgent(request.CreateAIAgentRequest{
		Name: "default autonomous agent", AIConfigID: createAIAgentWorkflowTestConfig(t),
		ServiceMode: enums.IMConversationServiceModeAIOnly, HandoffMode: enums.AIAgentHandoffModeWaitPool, FallbackMode: enums.AIAgentFallbackModeNoAnswer,
	}, operator)
	if err != nil {
		t.Fatalf("CreateAIAgent() error = %v", err)
	}
	if item.RuntimeMode != enums.AIAgentRuntimeModeAutonomous {
		t.Fatalf("default runtime mode = %q, want %q", item.RuntimeMode, enums.AIAgentRuntimeModeAutonomous)
	}
	var workflowCount int64
	if err := sqls.DB().Model(&models.AIWorkflow{}).Where("agent_id = ?", item.ID).Count(&workflowCount).Error; err != nil {
		t.Fatalf("count workflows: %v", err)
	}
	if workflowCount != 0 {
		t.Fatalf("default autonomous agent created %d workflows", workflowCount)
	}
}

func TestAIAgentServiceCreatesWorkflowDraftForHybrid(t *testing.T) {
	setupAIAgentWorkflowTestDB(t)
	item, err := AIAgentService.CreateAIAgent(request.CreateAIAgentRequest{
		Name: "hybrid agent", AIConfigID: createAIAgentWorkflowTestConfig(t), RuntimeMode: enums.AIAgentRuntimeModeHybrid,
		ServiceMode: enums.IMConversationServiceModeAIOnly, HandoffMode: enums.AIAgentHandoffModeWaitPool, FallbackMode: enums.AIAgentFallbackModeNoAnswer,
	}, aiAgentWorkflowTestOperator())
	if err != nil {
		t.Fatalf("CreateAIAgent() error = %v", err)
	}
	var workflowCount int64
	if err := sqls.DB().Model(&models.AIWorkflow{}).Where("agent_id = ?", item.ID).Count(&workflowCount).Error; err != nil {
		t.Fatalf("count workflows: %v", err)
	}
	if workflowCount != 1 {
		t.Fatalf("hybrid agent created %d workflows, want 1", workflowCount)
	}
}

func TestAIAgentServiceNormalizesToolPolicy(t *testing.T) {
	policy, err := AIAgentService.normalizeToolPolicy(`{"maxTotalCalls":2,"maxArgumentBytes":1024,"allowedRiskLevels":["READ","read","write"]}`)
	if err != nil {
		t.Fatalf("normalizeToolPolicy: %v", err)
	}
	if !strings.Contains(policy, `"maxTotalCalls":2`) || !strings.Contains(policy, `"allowedRiskLevels":["read","write"]`) {
		t.Fatalf("unexpected normalized policy: %s", policy)
	}
	if _, err := AIAgentService.normalizeToolPolicy(`{"allowedRiskLevels":["sensitive"]}`); err == nil {
		t.Fatal("expected removed sensitive risk level to be rejected")
	}
	if _, err := AIAgentService.normalizeToolPolicy(`{"allowedRiskLevels":["admin"]}`); err == nil {
		t.Fatal("expected invalid risk level error")
	}
	if _, err := AIAgentService.normalizeToolPolicy(`not-json`); err == nil {
		t.Fatal("expected invalid JSON error")
	}
}

func TestAIAgentServiceRejectsNonMCPToolSelection(t *testing.T) {
	for _, toolCode := range []string{
		toolx.BuiltinConversationContext.Code,
		toolx.BuiltinKnowledgeRetrieve.Code,
		toolx.GraphPrepareTicketDraft.Code,
		toolx.GraphAnalyzeConversation.Code,
		toolx.GraphTriageServiceRequest.Code,
		toolx.GraphHandoffConversation.Code,
	} {
		if _, err := AIAgentService.normalizeMCPTools([]request.AIAgentMCPToolRequest{{ToolCode: toolCode}}); err == nil {
			t.Fatalf("expected non-MCP tool %q to be rejected", toolCode)
		}
	}
}

func TestAIAgentServiceRollsBackToOwnPublishedRevision(t *testing.T) {
	setupAIAgentWorkflowTestDB(t)
	db := sqls.DB()
	agent := &models.AIAgent{Name: "rollback-agent", Status: enums.StatusOk, RuntimeMode: enums.AIAgentRuntimeModeAutonomous}
	if err := db.Create(agent).Error; err != nil {
		t.Fatalf("create agent: %v", err)
	}
	revision := &models.AgentRevision{AgentID: agent.ID, Revision: 1, Status: enums.StatusOk}
	if err := db.Create(revision).Error; err != nil {
		t.Fatalf("create revision: %v", err)
	}
	if err := AIAgentService.RollbackAIAgent(agent.ID, revision.ID, aiAgentWorkflowTestOperator()); err != nil {
		t.Fatalf("RollbackAIAgent: %v", err)
	}
	if updated := AIAgentService.Get(agent.ID); updated == nil || updated.PublishedRevisionID != revision.ID {
		t.Fatalf("rollback did not bind revision: %#v", updated)
	}
	otherRevision := &models.AgentRevision{AgentID: agent.ID + 1, Revision: 1, Status: enums.StatusOk}
	if err := db.Create(otherRevision).Error; err != nil {
		t.Fatalf("create other revision: %v", err)
	}
	if err := AIAgentService.RollbackAIAgent(agent.ID, otherRevision.ID, aiAgentWorkflowTestOperator()); err == nil {
		t.Fatal("expected cross-agent revision rollback rejection")
	}
}

func TestAIAgentServiceRollsBackPreviousRolloutPercent(t *testing.T) {
	setupAIAgentWorkflowTestDB(t)
	agent := &models.AIAgent{
		Name:                   "rollout-agent",
		Status:                 enums.StatusOk,
		RuntimeMode:            enums.AIAgentRuntimeModeAutonomous,
		RolloutPercent:         20,
		PreviousRolloutPercent: 100,
	}
	if err := sqls.DB().Create(agent).Error; err != nil {
		t.Fatalf("create agent: %v", err)
	}
	operator := aiAgentWorkflowTestOperator()
	if err := AIAgentService.RollbackAIAgentRollout(agent.ID, operator); err != nil {
		t.Fatalf("RollbackAIAgentRollout: %v", err)
	}
	updated := AIAgentService.Get(agent.ID)
	if updated == nil || updated.RolloutPercent != 100 || updated.PreviousRolloutPercent != 20 {
		t.Fatalf("unexpected rollout rollback result: %#v", updated)
	}
	if err := AIAgentService.RollbackAIAgentRollout(agent.ID, operator); err != nil {
		t.Fatalf("second RollbackAIAgentRollout: %v", err)
	}
	updated = AIAgentService.Get(agent.ID)
	if updated == nil || updated.RolloutPercent != 20 || updated.PreviousRolloutPercent != 100 {
		t.Fatalf("unexpected rollout redo result: %#v", updated)
	}
	if err := sqls.DB().Model(&models.AIAgent{}).Where("id = ?", agent.ID).Update("previous_rollout_percent", 0).Error; err != nil {
		t.Fatalf("clear previous rollout: %v", err)
	}
	if err := AIAgentService.RollbackAIAgentRollout(agent.ID, operator); err == nil {
		t.Fatal("expected missing previous rollout to be rejected")
	}
}

func TestAIAgentServiceUpdateUnpublishesAutonomousAgent(t *testing.T) {
	setupAIAgentWorkflowTestDB(t)
	operator := aiAgentWorkflowTestOperator()
	agent, err := AIAgentService.CreateAIAgent(request.CreateAIAgentRequest{
		Name: "autonomous agent", AIConfigID: createAIAgentWorkflowTestConfig(t), RuntimeMode: enums.AIAgentRuntimeModeAutonomous,
		ServiceMode: enums.IMConversationServiceModeAIOnly, HandoffMode: enums.AIAgentHandoffModeWaitPool, FallbackMode: enums.AIAgentFallbackModeNoAnswer,
	}, operator)
	if err != nil {
		t.Fatalf("CreateAIAgent() error = %v", err)
	}
	if _, err := AIAgentService.PublishAIAgent(agent.ID, operator); err != nil {
		t.Fatalf("PublishAIAgent() error = %v", err)
	}
	if published := AIAgentService.Get(agent.ID); published == nil || published.PublishedRevisionID <= 0 {
		t.Fatalf("expected published autonomous agent, got %#v", published)
	}
	if err := AIAgentService.UpdateAIAgent(request.UpdateAIAgentRequest{ID: agent.ID, CreateAIAgentRequest: request.CreateAIAgentRequest{
		Name: agent.Name, Description: "changed draft", AIConfigID: agent.AIConfigID, RuntimeMode: enums.AIAgentRuntimeModeAutonomous,
		ServiceMode: enums.IMConversationServiceModeAIOnly, HandoffMode: enums.AIAgentHandoffModeWaitPool, FallbackMode: enums.AIAgentFallbackModeNoAnswer,
	}}, operator); err != nil {
		t.Fatalf("UpdateAIAgent() error = %v", err)
	}
	if updated := AIAgentService.Get(agent.ID); updated == nil || updated.PublishedRevisionID != 0 {
		t.Fatalf("expected autonomous update to clear published revision, got %#v", updated)
	}
}

func TestAIAgentServiceRejectsPublishWithUnavailableModelConfig(t *testing.T) {
	setupAIAgentWorkflowTestDB(t)
	operator := aiAgentWorkflowTestOperator()
	configID := createAIAgentWorkflowTestConfig(t)
	agent, err := AIAgentService.CreateAIAgent(request.CreateAIAgentRequest{
		Name: "unavailable model agent", AIConfigID: configID, RuntimeMode: enums.AIAgentRuntimeModeAutonomous,
		ServiceMode: enums.IMConversationServiceModeAIOnly, HandoffMode: enums.AIAgentHandoffModeWaitPool, FallbackMode: enums.AIAgentFallbackModeNoAnswer,
	}, operator)
	if err != nil {
		t.Fatalf("CreateAIAgent() error = %v", err)
	}
	if err := sqls.DB().Model(&models.AIConfig{}).Where("id = ?", configID).Update("status", enums.StatusDisabled).Error; err != nil {
		t.Fatalf("disable model config: %v", err)
	}
	if _, err := AIAgentService.PublishAIAgent(agent.ID, operator); err == nil {
		t.Fatal("expected unavailable model config to reject publishing")
	}
}

func TestAIAgentServiceAllowsPublishWithAdministratorSelectedMCPTool(t *testing.T) {
	setupAIAgentWorkflowTestDB(t)
	operator := aiAgentWorkflowTestOperator()
	agent, err := AIAgentService.CreateAIAgent(request.CreateAIAgentRequest{
		Name: "mcp tool agent", AIConfigID: createAIAgentWorkflowTestConfig(t), RuntimeMode: enums.AIAgentRuntimeModeAutonomous,
		ServiceMode: enums.IMConversationServiceModeAIOnly, HandoffMode: enums.AIAgentHandoffModeWaitPool, FallbackMode: enums.AIAgentFallbackModeNoAnswer,
	}, operator)
	if err != nil {
		t.Fatalf("CreateAIAgent() error = %v", err)
	}
	if err := sqls.DB().Model(&models.AIAgent{}).Where("id = ?", agent.ID).Update("allowed_mcp_tools", `[{"toolCode":"mcp/demo/write_order"}]`).Error; err != nil {
		t.Fatalf("set MCP tool: %v", err)
	}
	if _, err := AIAgentService.PublishAIAgent(agent.ID, operator); err != nil {
		t.Fatalf("expected administrator-selected MCP tool to be publishable, got %v", err)
	}
}

func TestAIWorkflowServiceDefaultAgentWorkflowDefinitionRequiresKnowledgeRetrieveConfiguration(t *testing.T) {
	definition := AIWorkflowService.DefaultAgentWorkflowDefinition()
	if definition.SchemaVersion != dsl.SchemaVersion || nodeTypeByID(definition, "start_1") != workflowregistry.NodeTypeStart {
		t.Fatalf("expected default workflow definition")
	}
	validation := workflowvalidator.ValidateDefinition(definition, workflowregistry.DefaultRegistry())
	if validation.Valid || !workflowValidationHasMessage(validation, "需要选择至少一个知识库") {
		t.Fatalf("expected default workflow definition to require node knowledge bases, got %#v", validation.Errors)
	}
	if nodeTypeByID(definition, "understanding_1") != workflowregistry.NodeTypeConversationUnderstanding {
		t.Fatalf("expected default workflow to include conversation understanding, got nodes: %#v", definition.Nodes)
	}
	if nodeTypeByID(definition, "policy_1") != workflowregistry.NodeTypeReplyPolicy {
		t.Fatalf("expected default workflow to include reply policy, got nodes: %#v", definition.Nodes)
	}
	if !workflowHasNodeType(definition, workflowregistry.NodeTypeHandoffToHuman) {
		t.Fatalf("expected default workflow to include human handoff node")
	}
	if !workflowHasNodeType(definition, workflowregistry.NodeTypeCreateTicket) {
		t.Fatalf("expected default workflow to include ticket creation node")
	}
	if nodeTypeByID(definition, "handoff_confirm_1") != workflowregistry.NodeTypeHumanConfirm {
		t.Fatalf("expected default workflow handoff path to include human confirmation")
	}
	handoff := workflowNodeByID(t, definition, "handoff_1")
	if nodeID, field, ok := handoff.Data.InputsValues["confirmed"].Ref(); !ok || nodeID != "handoff_confirm_1" || field != "confirmed" {
		t.Fatalf("expected handoff to use confirmation result, got %#v", handoff.Data.InputsValues["confirmed"])
	}
}

func TestAIWorkflowServiceDefaultAgentWorkflowTicketPromptIncludesDraftFields(t *testing.T) {
	definition := AIWorkflowService.DefaultAgentWorkflowDefinition()
	prompt := workflowNodeByID(t, definition, "ticket_confirm_prompt_1")
	if _, ok := prompt.Data.InputsValues["ticketTitle"]; !ok {
		t.Fatalf("expected ticket confirm prompt to map ticketTitle")
	}
	if _, ok := prompt.Data.InputsValues["ticketDescription"]; !ok {
		t.Fatalf("expected ticket confirm prompt to map ticketDescription")
	}
	config := map[string]any{}
	if err := json.Unmarshal(prompt.Data.Config, &config); err != nil {
		t.Fatalf("unmarshal prompt config: %v", err)
	}
	staticReply, _ := config["staticReply"].(string)
	if !strings.Contains(staticReply, "{{ticketTitle}}") || !strings.Contains(staticReply, "{{ticketDescription}}") {
		t.Fatalf("expected prompt template to include ticket title and description, got %q", staticReply)
	}
}

func TestAIWorkflowServiceDefaultAgentWorkflowLayoutDoesNotOverlap(t *testing.T) {
	definition := AIWorkflowService.DefaultAgentWorkflowDefinition()
	assertWorkflowLayoutDoesNotOverlap(t, definition)
}

func TestAIWorkflowServicePublishAgentWorkflowBindsAgentVersion(t *testing.T) {
	setupAIAgentWorkflowTestDB(t)
	operator := aiAgentWorkflowTestOperator()
	aiConfigID := createAIAgentWorkflowTestConfig(t)

	agent, err := AIAgentService.CreateAIAgent(request.CreateAIAgentRequest{
		Name:         "workflow agent without version",
		AIConfigID:   aiConfigID,
		ServiceMode:  enums.IMConversationServiceModeAIOnly,
		HandoffMode:  enums.AIAgentHandoffModeWaitPool,
		FallbackMode: enums.AIAgentFallbackModeNoAnswer,
	}, operator)
	if err != nil {
		t.Fatalf("CreateAIAgent() error = %v", err)
	}
	workflow, err := AIWorkflowService.SaveAgentWorkflow(request.SaveAIWorkflowRequest{
		AgentID:     agent.ID,
		Name:        "After sales flow",
		Description: "Support workflow",
		Definition:  validAIWorkflowDefinition(),
	}, operator)
	if err != nil {
		t.Fatalf("SaveAgentWorkflow() error = %v", err)
	}

	version, err := AIWorkflowService.PublishAgentWorkflow(request.PublishAIWorkflowRequest{
		AgentID:    agent.ID,
		Definition: validAIWorkflowDefinition(),
	}, operator)
	if err != nil {
		t.Fatalf("PublishAgentWorkflow() error = %v", err)
	}
	if version.WorkflowID != workflow.ID {
		t.Fatalf("expected version workflow id %d, got %d", workflow.ID, version.WorkflowID)
	}
	storedAgent := AIAgentService.Get(agent.ID)
	if storedAgent == nil {
		t.Fatalf("expected stored agent")
	}
	if storedAgent.WorkflowVersionID != version.ID {
		t.Fatalf("expected agent workflow version %d, got %d", version.ID, storedAgent.WorkflowVersionID)
	}
	if storedAgent.PublishedRevisionID <= 0 {
		t.Fatalf("expected published agent revision id, got %d", storedAgent.PublishedRevisionID)
	}
	var revision models.AgentRevision
	if err := sqls.DB().First(&revision, storedAgent.PublishedRevisionID).Error; err != nil {
		t.Fatalf("load agent revision: %v", err)
	}
	if revision.AgentID != agent.ID || revision.WorkflowVersionID != version.ID || revision.Revision != 1 || revision.DefinitionHash == "" {
		t.Fatalf("unexpected published agent revision: %#v", revision)
	}
	if !strings.Contains(revision.Definition, `"modelName":"gpt-test"`) || strings.Contains(revision.Definition, "revision-test-secret") {
		t.Fatalf("unexpected revision definition: %s", revision.Definition)
	}
}

func TestAIAgentServiceBindsPublishedWorkflowVersionIndependently(t *testing.T) {
	setupAIAgentWorkflowTestDB(t)
	operator := aiAgentWorkflowTestOperator()
	workflow, err := AIWorkflowService.CreateWorkflow(request.CreateAIWorkflowRequest{Name: "共享建单流程", Definition: validAIWorkflowDefinition()}, operator)
	if err != nil {
		t.Fatalf("CreateWorkflow() error = %v", err)
	}
	version, err := AIWorkflowService.PublishWorkflow(request.PublishAIWorkflowRequest{WorkflowID: workflow.ID, Definition: validAIWorkflowDefinition()}, operator)
	if err != nil {
		t.Fatalf("PublishWorkflow() error = %v", err)
	}
	agent, err := AIAgentService.CreateAIAgent(request.CreateAIAgentRequest{
		Name: "绑定共享工作流的 Agent", AIConfigID: createAIAgentWorkflowTestConfig(t), RuntimeMode: enums.AIAgentRuntimeModeHybrid,
		ServiceMode: enums.IMConversationServiceModeAIOnly, HandoffMode: enums.AIAgentHandoffModeWaitPool, FallbackMode: enums.AIAgentFallbackModeNoAnswer,
		WorkflowBindings: []request.AIAgentWorkflowBindingRequest{{WorkflowVersionID: version.ID, ToolName: "创建工单", TriggerInstruction: "用户要求创建工单", Enabled: true}},
	}, operator)
	if err != nil {
		t.Fatalf("CreateAIAgent() error = %v", err)
	}
	bindings := AIAgentService.ListWorkflowBindings(agent.ID)
	if len(bindings) != 1 || bindings[0].Binding.WorkflowVersionID != version.ID || bindings[0].Workflow == nil || bindings[0].Workflow.AgentID != 0 {
		t.Fatalf("unexpected independent workflow binding: %#v", bindings)
	}
	if _, err := AIAgentService.PublishAIAgent(agent.ID, operator); err != nil {
		t.Fatalf("PublishAIAgent() error = %v", err)
	}
	stored := AIAgentService.Get(agent.ID)
	snapshot, err := AgentRevisionService.ResolvePublishedSnapshot(*stored, *AIConfigService.Get(stored.AIConfigID))
	if err != nil || len(snapshot.WorkflowBindings) != 1 || snapshot.WorkflowBindings[0].WorkflowVersionID != version.ID {
		t.Fatalf("expected published workflow binding snapshot, snapshot=%#v err=%v", snapshot, err)
	}
}

func setupAIAgentWorkflowTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&models.AIAgent{}, &models.AIConfig{}, &models.KnowledgeBase{}, &models.AIWorkflow{}, &models.AIWorkflowVersion{}, &models.AIAgentWorkflowBinding{}, &models.AgentRevision{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
}

func createAIAgentWorkflowTestConfig(t *testing.T) int64 {
	t.Helper()
	item := &models.AIConfig{
		Name:      "workflow-test-config",
		Provider:  enums.AIProviderOpenAI,
		APIKey:    "revision-test-secret",
		ModelType: enums.AIModelTypeLLM,
		ModelName: "gpt-test",
		Status:    enums.StatusOk,
	}
	if err := sqls.DB().Create(item).Error; err != nil {
		t.Fatalf("create ai config: %v", err)
	}
	return item.ID
}

func createAIAgentWorkflowTestKnowledgeBase(t *testing.T) int64 {
	t.Helper()
	item := &models.KnowledgeBase{
		Name:          "workflow-test-kb",
		KnowledgeType: string(enums.KnowledgeBaseTypeFAQ),
		Status:        enums.StatusOk,
	}
	if err := sqls.DB().Create(item).Error; err != nil {
		t.Fatalf("create knowledge base: %v", err)
	}
	return item.ID
}

func createAIAgentWorkflowVersion(t *testing.T) int64 {
	t.Helper()
	workflow := &models.AIWorkflow{
		Name:    "workflow-test",
		AgentID: 1,
		Status:  enums.StatusOk,
	}
	if err := sqls.DB().Create(workflow).Error; err != nil {
		t.Fatalf("create workflow: %v", err)
	}
	version := &models.AIWorkflowVersion{
		WorkflowID: workflow.ID,
		Version:    1,
		Status:     enums.StatusOk,
	}
	if err := sqls.DB().Create(version).Error; err != nil {
		t.Fatalf("create workflow version: %v", err)
	}
	return version.ID
}

func aiAgentWorkflowTestOperator() *dto.AuthPrincipal {
	return &dto.AuthPrincipal{
		UserID:   1,
		Username: "agent-workflow-tester",
		Nickname: "agent-workflow-tester",
	}
}

func workflowHasNodeType(def dsl.Definition, nodeType string) bool {
	for _, node := range def.Nodes {
		if node.Type == nodeType {
			return true
		}
	}
	return false
}

func workflowValidationHasMessage(result workflowvalidator.Result, message string) bool {
	for _, item := range result.Errors {
		if strings.Contains(item.Message, message) {
			return true
		}
	}
	return false
}

func nodeTypeByID(def dsl.Definition, nodeID string) string {
	for _, node := range def.Nodes {
		if node.ID == nodeID {
			return node.Type
		}
	}
	return ""
}

func workflowNodeByID(t *testing.T, def dsl.Definition, nodeID string) dsl.Node {
	t.Helper()
	for _, node := range def.Nodes {
		if node.ID == nodeID {
			return node
		}
	}
	t.Fatalf("workflow node not found: %s", nodeID)
	return dsl.Node{}
}

func assertConditionBranchToNodeType(t *testing.T, def dsl.Definition, sourceID string, targetType string, operator string, right any) {
	t.Helper()
	nodeTypes := workflowNodeTypeMap(def)
	for _, branch := range conditionBranches(t, def, sourceID) {
		if nodeTypes[branch.TargetNodeID] != targetType || branch.Condition == nil {
			continue
		}
		if branch.Condition.Operator == operator && branch.Condition.Right == right {
			return
		}
	}
	t.Fatalf("expected %s condition branch from %s to %s with right=%v", operator, sourceID, targetType, right)
}

func assertConditionBranchToNodeID(t *testing.T, def dsl.Definition, sourceID string, targetID string, operator string, right any) {
	t.Helper()
	for _, branch := range conditionBranches(t, def, sourceID) {
		if branch.TargetNodeID != targetID || branch.Condition == nil {
			continue
		}
		if branch.Condition.Operator == operator && branch.Condition.Right == right {
			return
		}
	}
	t.Fatalf("expected %s condition branch from %s to %s with right=%v", operator, sourceID, targetID, right)
}

func assertDefaultBranchToNodeID(t *testing.T, def dsl.Definition, sourceID string, targetID string) {
	t.Helper()
	for _, branch := range conditionBranches(t, def, sourceID) {
		if branch.TargetNodeID == targetID && branch.Default {
			return
		}
	}
	t.Fatalf("expected default branch from %s to %s", sourceID, targetID)
}

func conditionBranches(t *testing.T, def dsl.Definition, nodeID string) []dsl.ConditionBranch {
	t.Helper()
	for _, node := range def.Nodes {
		if node.ID != nodeID {
			continue
		}
		var config dsl.ConditionConfig
		if err := json.Unmarshal(node.Data.Config, &config); err != nil {
			t.Fatalf("unmarshal condition config for %s: %v", nodeID, err)
		}
		return config.Branches
	}
	t.Fatalf("condition node not found: %s", nodeID)
	return nil
}

func assertConditionBranchesHavePortEdges(t *testing.T, def dsl.Definition, nodeID string) {
	t.Helper()
	for _, branch := range conditionBranches(t, def, nodeID) {
		if !workflowPortEdgeExists(def, nodeID, branch.TargetNodeID, branch.ID) {
			t.Fatalf("expected condition branch %s.%s to have port edge to %s", nodeID, branch.ID, branch.TargetNodeID)
		}
	}
}

func assertConditionBranchOrder(t *testing.T, def dsl.Definition, nodeID string, want []string) {
	t.Helper()
	branches := conditionBranches(t, def, nodeID)
	if len(branches) != len(want) {
		t.Fatalf("expected %s branch order %v, got %#v", nodeID, want, branches)
	}
	for index, branch := range branches {
		if branch.ID != want[index] {
			t.Fatalf("expected %s branch order %v, got branch %d = %s", nodeID, want, index, branch.ID)
		}
	}
}

func assertConditionPortEdgeOrder(t *testing.T, def dsl.Definition, nodeID string, want []string) {
	t.Helper()
	got := make([]string, 0, len(want))
	for _, edge := range def.Edges {
		if edge.SourceNodeID == nodeID {
			got = append(got, edge.SourcePortID)
		}
	}
	if len(got) != len(want) {
		t.Fatalf("expected %s port edge order %v, got %v", nodeID, want, got)
	}
	for index, sourcePortID := range got {
		if sourcePortID != want[index] {
			t.Fatalf("expected %s port edge order %v, got edge %d = %s", nodeID, want, index, sourcePortID)
		}
	}
}

func workflowPortEdgeExists(def dsl.Definition, sourceID string, targetID string, sourcePortID string) bool {
	for _, edge := range def.Edges {
		if edge.SourceNodeID == sourceID && edge.TargetNodeID == targetID && edge.SourcePortID == sourcePortID {
			return true
		}
	}
	return false
}

func workflowEdgeExists(def dsl.Definition, sourceID string, targetID string) bool {
	for _, edge := range def.Edges {
		if edge.SourceNodeID == sourceID && edge.TargetNodeID == targetID {
			return true
		}
	}
	return false
}

type workflowLayoutBox struct {
	NodeID string
	Left   float64
	Top    float64
	Right  float64
	Bottom float64
}

func assertWorkflowLayoutDoesNotOverlap(t *testing.T, def dsl.Definition) {
	t.Helper()
	boxes := make([]workflowLayoutBox, 0, len(def.Nodes))
	for _, node := range def.Nodes {
		width, height := defaultWorkflowNodeRenderSize(node.Type)
		boxes = append(boxes, workflowLayoutBox{
			NodeID: node.ID,
			Left:   node.Meta.Position.X,
			Top:    node.Meta.Position.Y,
			Right:  node.Meta.Position.X + width,
			Bottom: node.Meta.Position.Y + height,
		})
	}
	const minGap = 32.0
	for i := range boxes {
		for j := i + 1; j < len(boxes); j++ {
			if workflowBoxesOverlapWithGap(boxes[i], boxes[j], minGap) {
				t.Fatalf("default workflow nodes are too close or overlapping: %s=%+v %s=%+v", boxes[i].NodeID, boxes[i], boxes[j].NodeID, boxes[j])
			}
		}
	}
}

func defaultWorkflowNodeRenderSize(nodeType string) (float64, float64) {
	if nodeType == workflowregistry.NodeTypeCondition {
		return 160, 160
	}
	return 220, 128
}

func workflowBoxesOverlapWithGap(a workflowLayoutBox, b workflowLayoutBox, gap float64) bool {
	return a.Left < b.Right+gap && a.Right+gap > b.Left && a.Top < b.Bottom+gap && a.Bottom+gap > b.Top
}

func workflowNodeTypeMap(def dsl.Definition) map[string]string {
	ret := make(map[string]string, len(def.Nodes))
	for _, node := range def.Nodes {
		ret[node.ID] = node.Type
	}
	return ret
}

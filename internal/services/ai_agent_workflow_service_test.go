package services

import (
	"encoding/json"
	"testing"

	"agent-desk/internal/ai/workflow/dsl"
	workflowregistry "agent-desk/internal/ai/workflow/registry"
	workflowvalidator "agent-desk/internal/ai/workflow/validator"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/enums"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

func TestAIAgentServiceCreatesDefaultWorkflow(t *testing.T) {
	setupAIAgentWorkflowTestDB(t)
	operator := aiAgentWorkflowTestOperator()
	aiConfigID := createAIAgentWorkflowTestConfig(t)
	knowledgeID := createAIAgentWorkflowTestKnowledgeBase(t)

	item, err := AIAgentService.CreateAIAgent(request.CreateAIAgentRequest{
		Name:         "workflow agent",
		AIConfigID:   aiConfigID,
		ServiceMode:  enums.IMConversationServiceModeAIOnly,
		HandoffMode:  enums.AIAgentHandoffModeWaitPool,
		FallbackMode: enums.AIAgentFallbackModeNoAnswer,
		KnowledgeIDs: []int64{knowledgeID},
	}, operator)
	if err != nil {
		t.Fatalf("CreateAIAgent() error = %v", err)
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
	if !validation.Valid {
		t.Fatalf("expected default workflow to be valid, got %#v", validation.Errors)
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
	assertConditionBranchToNodeType(t, stored, "policy_route_1", workflowregistry.NodeTypeHandoffToHuman, "eq", "handoff_to_human")
	assertConditionBranchToNodeType(t, stored, "policy_route_1", workflowregistry.NodeTypePrepareTicketDraft, "eq", "prepare_ticket")
	assertConditionBranchToNodeID(t, stored, "answerability_route_1", "reply_1", "eq", "answerable")
	assertDefaultBranchToNodeID(t, stored, "answerability_route_1", "fallback_reply_1")
	if !workflowEdgeExists(stored, "create_ticket_1", "ticket_result_reply_1") {
		t.Fatalf("expected create_ticket to flow into a customer-visible result reply")
	}
	assertConditionBranchesHavePortEdges(t, stored, "policy_route_1")
	assertConditionBranchesHavePortEdges(t, stored, "ticket_confirm_route_1")
	assertConditionBranchesHavePortEdges(t, stored, "answerability_route_1")
}

func TestAIWorkflowServiceDefaultAgentWorkflowDefinitionIsValid(t *testing.T) {
	definition := AIWorkflowService.DefaultAgentWorkflowDefinition()
	if definition.SchemaVersion != dsl.SchemaVersion || nodeTypeByID(definition, "start_1") != workflowregistry.NodeTypeStart {
		t.Fatalf("expected default workflow definition")
	}
	validation := workflowvalidator.ValidateDefinition(definition, workflowregistry.DefaultRegistry())
	if !validation.Valid {
		t.Fatalf("expected default workflow definition to be valid, got %#v", validation.Errors)
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
}

func TestAIWorkflowServiceDefaultAgentWorkflowLayoutDoesNotOverlap(t *testing.T) {
	definition := AIWorkflowService.DefaultAgentWorkflowDefinition()
	assertWorkflowLayoutDoesNotOverlap(t, definition)
}

func TestAIWorkflowServicePublishAgentWorkflowBindsAgentVersion(t *testing.T) {
	setupAIAgentWorkflowTestDB(t)
	operator := aiAgentWorkflowTestOperator()
	aiConfigID := createAIAgentWorkflowTestConfig(t)
	knowledgeID := createAIAgentWorkflowTestKnowledgeBase(t)

	agent, err := AIAgentService.CreateAIAgent(request.CreateAIAgentRequest{
		Name:         "workflow agent without version",
		AIConfigID:   aiConfigID,
		ServiceMode:  enums.IMConversationServiceModeAIOnly,
		HandoffMode:  enums.AIAgentHandoffModeWaitPool,
		FallbackMode: enums.AIAgentFallbackModeNoAnswer,
		KnowledgeIDs: []int64{knowledgeID},
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
}

func setupAIAgentWorkflowTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&models.AIAgent{}, &models.AIConfig{}, &models.KnowledgeBase{}, &models.AIWorkflow{}, &models.AIWorkflowVersion{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
}

func createAIAgentWorkflowTestConfig(t *testing.T) int64 {
	t.Helper()
	item := &models.AIConfig{
		Name:      "workflow-test-config",
		Provider:  enums.AIProviderOpenAI,
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

func nodeTypeByID(def dsl.Definition, nodeID string) string {
	for _, node := range def.Nodes {
		if node.ID == nodeID {
			return node.Type
		}
	}
	return ""
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

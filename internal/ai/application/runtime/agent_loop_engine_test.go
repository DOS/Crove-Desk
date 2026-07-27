package runtime

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	ai "agent-desk/internal/ai"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/enums"
	svc "agent-desk/internal/services"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

func TestAgentLoopActivatesSkillInsideSameToolLoop(t *testing.T) {
	skill := models.SkillDefinition{
		ID: 7, Name: "退款说明", Instruction: "只根据退款政策回答。",
		ToolWhitelist: `["builtin/knowledge_retrieve"]`, Status: enums.StatusOk,
	}
	turn := agentLoopTurn{
		AllowedTools: []string{"skill/7"},
		ToolPolicy:   parseAgentLoopToolPolicy(""),
		Skills:       map[int64]models.SkillDefinition{skill.ID: skill},
	}
	state := agentLoopExecutionState{}
	var calls []svc.AgentLoopToolCallInput
	execute := NewAgentLoopEngine().toolSearchExecutor(RunInput{}, turn, &state, &calls)

	result, err := execute(context.Background(), ai.ToolCall{
		Name: "tool_search", Arguments: `{"toolCode":"skill/7","arguments":{}}`,
	})
	if err != nil {
		t.Fatalf("activate Skill: %v", err)
	}
	if state.SkillContext.SkillID() != skill.ID || !strings.Contains(result, skill.Instruction) {
		t.Fatalf("Skill was not activated in the Agent Loop: state=%#v result=%q", state, result)
	}
	if len(calls) != 1 || calls[0].ToolCode != "skill/7" || calls[0].Status != "completed" {
		t.Fatalf("unexpected Skill audit: %#v", calls)
	}
}

func TestAgentLoopInterruptsBeforeWriteMCPTool(t *testing.T) {
	configured, err := json.Marshal([]request.AIAgentMCPToolRequest{{
		ToolCode: "crm/update_customer", ServerCode: "crm", ToolName: "update_customer",
		Title: "更新客户", RiskLevel: "write", RequireConfirmation: true,
	}})
	if err != nil {
		t.Fatalf("marshal MCP configuration: %v", err)
	}
	runInput := RunInput{
		Conversation: models.Conversation{ID: 9},
		AIAgent:      models.AIAgent{AllowedMCPTools: string(configured)},
	}
	turn := agentLoopTurn{
		AllowedTools: []string{"crm/update_customer"},
		ToolPolicy:   parseAgentLoopToolPolicy(`{"allowedRiskLevels":["read","write"]}`),
	}
	state := agentLoopExecutionState{}
	var calls []svc.AgentLoopToolCallInput
	execute := NewAgentLoopEngine().toolSearchExecutor(runInput, turn, &state, &calls)

	_, err = execute(context.Background(), ai.ToolCall{
		Name: "tool_search", Arguments: `{"toolCode":"crm/update_customer","arguments":{"name":"Ada"}}`,
	})
	if err == nil {
		t.Fatal("expected write MCP Tool to interrupt")
	}
	if state.Interrupted == nil || !state.Interrupted.Interrupted || !strings.HasPrefix(state.Interrupted.CheckPointID, "tool:9:") {
		t.Fatalf("missing MCP confirmation checkpoint: %#v", state.Interrupted)
	}
	if len(calls) != 1 || calls[0].RiskLevel != "write" || !calls[0].RequireConfirm || calls[0].Status != "interrupted" {
		t.Fatalf("unexpected MCP safety audit: %#v", calls)
	}
}

func TestAgentLoopRejectsWriteMCPBeforeConfirmationWhenRiskIsNotAllowed(t *testing.T) {
	configured, _ := json.Marshal([]request.AIAgentMCPToolRequest{{
		ToolCode: "crm/update_customer", ServerCode: "crm", ToolName: "update_customer",
		Title: "更新客户", RiskLevel: "write", RequireConfirmation: true,
	}})
	runInput := RunInput{
		Conversation: models.Conversation{ID: 9},
		AIAgent:      models.AIAgent{AllowedMCPTools: string(configured)},
	}
	turn := agentLoopTurn{
		AllowedTools: []string{"crm/update_customer"},
		ToolPolicy:   parseAgentLoopToolPolicy(`{"allowedRiskLevels":["read"]}`),
	}
	state := agentLoopExecutionState{}
	var calls []svc.AgentLoopToolCallInput
	execute := NewAgentLoopEngine().toolSearchExecutor(runInput, turn, &state, &calls)

	_, err := execute(context.Background(), ai.ToolCall{
		Name: "tool_search", Arguments: `{"toolCode":"crm/update_customer","arguments":{"name":"Ada"}}`,
	})
	if err == nil || !strings.Contains(err.Error(), "risk level") {
		t.Fatalf("expected MCP risk policy rejection, got %v", err)
	}
	if state.Interrupted != nil || len(calls) != 1 || calls[0].Status != "failed" {
		t.Fatalf("disallowed MCP call should fail without a checkpoint: state=%#v calls=%#v", state, calls)
	}
}

func TestAgentLoopRejectsWorkflowWhenWriteRiskIsNotAllowed(t *testing.T) {
	turn := agentLoopTurn{
		AllowedTools: []string{"workflow/23"},
		ToolPolicy:   parseAgentLoopToolPolicy(`{"allowedRiskLevels":["read"]}`),
		Workflows: map[int64]svc.AgentRevisionWorkflowBinding{
			23: {WorkflowVersionID: 23, ToolName: "创建工单"},
		},
	}
	state := agentLoopExecutionState{}
	var calls []svc.AgentLoopToolCallInput
	execute := NewAgentLoopEngine().toolSearchExecutor(RunInput{}, turn, &state, &calls)

	_, err := execute(context.Background(), ai.ToolCall{
		Name: "tool_search", Arguments: `{"toolCode":"workflow/23","arguments":{}}`,
	})
	if err == nil || !strings.Contains(err.Error(), "risk level") {
		t.Fatalf("expected Workflow risk policy rejection, got %v", err)
	}
	if len(calls) != 1 || calls[0].Status != "failed" || calls[0].RiskLevel != "write" {
		t.Fatalf("unexpected Workflow policy audit: %#v", calls)
	}
}

func TestAgentLoopKnowledgeFallbackCanRequestHandoff(t *testing.T) {
	agent := models.AIAgent{
		KnowledgeIDs: "1", FallbackMode: enums.AIAgentFallbackModeHandoff,
		FallbackMessage: "我暂时无法核实，马上为你转人工。",
	}
	policy := evaluateAgentLoopResponsePolicy(agent, "", nil)
	prompt := buildAgentLoopSystemPrompt(agent, true, "", nil)
	if !policy.RequestHandoff || !strings.Contains(prompt, agent.FallbackMessage) {
		t.Fatalf("knowledge fallback was not applied: policy=%#v prompt=%q", policy, prompt)
	}
}

func TestAgentTurnPublishesAllConfiguredCapabilityKinds(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.SkillDefinition{}); err != nil {
		t.Fatalf("migrate Skill: %v", err)
	}
	sqls.SetDB(db)
	skill := models.SkillDefinition{Name: "订单查询", Description: "查询订单状态", Status: enums.StatusOk}
	if err := db.Create(&skill).Error; err != nil {
		t.Fatalf("create Skill: %v", err)
	}
	mcp, _ := json.Marshal([]request.AIAgentMCPToolRequest{{
		ToolCode: "crm/get_customer", ServerCode: "crm", ToolName: "get_customer",
		RiskLevel: "read",
	}})
	agent := models.AIAgent{SkillIDs: jsonInt64List(skill.ID), AllowedMCPTools: string(mcp)}
	snapshot := &svc.AgentRevisionSnapshot{
		Agent: agent,
		WorkflowBindings: []svc.AgentRevisionWorkflowBinding{{
			WorkflowVersionID: 23, ToolName: "创建工单", TriggerInstruction: "用户要求创建工单",
		}},
	}
	engine := NewAgentLoopEngine()
	engine.retrieve = nil
	engine.history = nil
	turn := engine.prepareTurn(context.Background(), RunInput{AIAgent: agent}, snapshot)

	for _, code := range []string{"skill/" + jsonInt64List(skill.ID), "workflow/23", "crm/get_customer"} {
		if !strings.Contains(turn.SystemPrompt, code) {
			t.Fatalf("capability %q missing from prompt:\n%s", code, turn.SystemPrompt)
		}
	}
}

func jsonInt64List(id int64) string {
	data, _ := json.Marshal([]int64{id})
	return strings.Trim(string(data), "[]")
}

package runtime

import (
	"context"
	"fmt"
	"strings"
	"testing"

	ai "agent-desk/internal/ai"
	"agent-desk/internal/ai/skills"
	aitooling "agent-desk/internal/ai/tooling"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/toolx"
	svc "agent-desk/internal/services"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestServiceDefaultsToWorkflowEngine(t *testing.T) {
	service := NewService()
	engine, err := service.registry.Resolve("")
	if err != nil {
		t.Fatalf("resolve default engine: %v", err)
	}
	if engine.Code() != EngineCodeWorkflow {
		t.Fatalf("expected default engine %q, got %q", EngineCodeWorkflow, engine.Code())
	}
}

func TestServiceDispatchesRequestedEngine(t *testing.T) {
	engine := &runtimeTestEngine{code: "test"}
	service := NewServiceWithRegistry(NewEngineRegistry(engine))
	summary, err := service.Run(context.Background(), RunInput{AIAgent: models.AIAgent{RuntimeMode: enums.AIAgentRuntimeMode(engine.code)}})
	if err != nil {
		t.Fatalf("run requested engine: %v", err)
	}
	if !engine.ran || summary == nil || summary.Status != "completed" {
		t.Fatalf("unexpected engine dispatch result: engine=%#v summary=%#v", engine, summary)
	}
}

func TestEngineContractKeepsLegacyRequestAliasesCompatible(t *testing.T) {
	var _ Engine = (*runtimeTestEngine)(nil)
	var input Request = RunInput{}
	var result Summary = RunResult{Status: "completed"}
	if input.Debug || result.Status != "completed" {
		t.Fatalf("unexpected compatibility values: input=%#v result=%#v", input, result)
	}
}

func TestServiceRejectsUnknownEngine(t *testing.T) {
	service := NewServiceWithRegistry(NewEngineRegistry())
	if _, err := service.Run(context.Background(), Request{AIAgent: models.AIAgent{RuntimeMode: "missing"}}); err == nil {
		t.Fatal("expected unknown engine error")
	}
}

func TestAutonomousEngineRecordsPublishedRevisionRun(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "t_", SingularTable: true}})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.AgentRevision{}, &models.AgentRun{}, &models.AgentStep{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
	revision := &models.AgentRevision{AgentID: 7, Revision: 1}
	if err := db.Create(revision).Error; err != nil {
		t.Fatalf("create revision: %v", err)
	}
	var receivedPrompt string
	engine := newAutonomousEngineWithChat(func(_ context.Context, _ models.AIConfig, _ string, prompt string) (*ai.ChatCompletionResult, error) {
		receivedPrompt = prompt
		return &ai.ChatCompletionResult{Content: "可以协助你处理这个问题。", ModelName: "test-model", PromptTokens: 8, CompletionTokens: 5}, nil
	})
	engine.retrieve = func(context.Context, models.AIAgent, string) (string, int, error) {
		return "退款需要先确认订单号。", 1, nil
	}
	summary, err := engine.Run(context.Background(), Request{
		Conversation: models.Conversation{ID: 1}, UserMessage: models.Message{ID: 2, Content: "需要帮助"},
		AIAgent: models.AIAgent{ID: 7, PublishedRevisionID: revision.ID, SystemPrompt: "保持专业", KnowledgeIDs: "21"}, AIConfig: models.AIConfig{ModelName: "test-model"},
	})
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	if summary == nil || summary.AgentRunID <= 0 || summary.ReplyText == "" {
		t.Fatalf("unexpected summary: %#v", summary)
	}
	var run models.AgentRun
	if err := db.First(&run, summary.AgentRunID).Error; err != nil {
		t.Fatalf("load agent run: %v", err)
	}
	if run.EngineCode != EngineCodeAutonomous || run.AgentRevisionID != revision.ID || run.Status != "completed" {
		t.Fatalf("unexpected agent run: %#v", run)
	}
	if run.PromptTokens != 8 || !strings.Contains(receivedPrompt, "Knowledge evidence") {
		t.Fatalf("expected knowledge evidence in prompt, got %q", receivedPrompt)
	}
	var steps []models.AgentStep
	if err := db.Where("agent_run_id = ?", run.ID).Find(&steps).Error; err != nil || len(steps) != 2 || steps[1].StepType != "knowledge" {
		t.Fatalf("expected model and knowledge steps, steps=%#v err=%v", steps, err)
	}
}

func TestAutonomousEngineRecordsRejectedReplyAsFailed(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "t_", SingularTable: true}})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.AgentRevision{}, &models.AgentRun{}, &models.AgentStep{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
	revision := &models.AgentRevision{AgentID: 15, Revision: 1}
	if err := db.Create(revision).Error; err != nil {
		t.Fatalf("create revision: %v", err)
	}
	engine := newAutonomousEngineWithChat(func(context.Context, models.AIConfig, string, string) (*ai.ChatCompletionResult, error) {
		return &ai.ChatCompletionResult{Content: "token=secret-value"}, nil
	})
	_, err = engine.Run(context.Background(), Request{UserMessage: models.Message{ID: 2, Content: "help"}, AIAgent: models.AIAgent{ID: 15, PublishedRevisionID: revision.ID}})
	if err == nil {
		t.Fatal("expected sensitive model reply to be rejected")
	}
	var run models.AgentRun
	if err := db.Last(&run).Error; err != nil || run.Status != "failed" || strings.Contains(run.ErrorMessage, "secret-value") {
		t.Fatalf("expected failed audit run, run=%#v err=%v", run, err)
	}
}

func TestAutonomousEngineBuildsBoundedConversationContext(t *testing.T) {
	engine := newAutonomousEngineWithChat(nil)
	engine.history = func(conversationID int64, limit int) []models.Message {
		if conversationID != 11 || limit != 3 {
			t.Fatalf("unexpected history query: conversation=%d limit=%d", conversationID, limit)
		}
		return []models.Message{
			{ID: 1, SenderType: "customer", MessageType: "text", Content: "之前的问题"},
			{ID: 2, SenderType: "ai", MessageType: "text", Content: "之前的答复"},
			{ID: 3, SenderType: "customer", MessageType: "text", Content: "当前问题"},
		}
	}
	prompt, count := engine.buildUserPrompt(Request{
		Conversation: models.Conversation{ID: 11}, UserMessage: models.Message{ID: 3, Content: "当前问题", MessageType: "text"},
		AIAgent: models.AIAgent{ContextWindow: 2},
	})
	if count != 2 || !strings.Contains(prompt, "Customer: 之前的问题") || !strings.Contains(prompt, "Assistant: 之前的答复") || strings.Count(prompt, "当前问题") != 1 {
		t.Fatalf("unexpected assembled prompt: %q", prompt)
	}
}

func TestAutonomousEngineBuildsCustomerContext(t *testing.T) {
	engine := newAutonomousEngineWithChat(nil)
	prompt, count := engine.buildUserPrompt(Request{
		Conversation: models.Conversation{CustomerName: "张三", LastMessageSummary: "已咨询退款条件"},
		UserMessage:  models.Message{Content: "我要申请退款", MessageType: "text"},
	})
	if count != 0 || !strings.Contains(prompt, "Customer: 张三") || !strings.Contains(prompt, "Recent summary: 已咨询退款条件") || !strings.Contains(prompt, "Current customer message:\n我要申请退款") {
		t.Fatalf("unexpected customer context: %q", prompt)
	}
}

func TestAutonomousEngineInjectsSelectedSkillAndRecordsRoute(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "t_", SingularTable: true}})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.AgentRevision{}, &models.AgentRun{}, &models.AgentStep{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
	revision := &models.AgentRevision{AgentID: 9, Revision: 1}
	if err := db.Create(revision).Error; err != nil {
		t.Fatalf("create revision: %v", err)
	}
	var systemPrompt string
	engine := newAutonomousEngineWithChat(func(_ context.Context, _ models.AIConfig, system, _ string) (*ai.ChatCompletionResult, error) {
		systemPrompt = system
		return &ai.ChatCompletionResult{Content: "我来协助处理退款。", ModelName: "test-model"}, nil
	})
	engine.skillSelect = func(context.Context, skills.RuntimeContext) (*skills.ExecutionResult, error) {
		return &skills.ExecutionResult{Plan: &skills.ExecutionPlan{
			Skill:       &models.SkillDefinition{ID: 70, Name: "退款处理", Instruction: "先核对订单信息。", Examples: `["我要退款"]`, ToolWhitelist: `["support/order_lookup"]`},
			MatchReason: "llm_route",
		}, Trace: &skills.ExecutionTrace{Status: "ok", MatchReason: "llm_route"}}, nil
	}
	summary, err := engine.Run(context.Background(), Request{
		Conversation: models.Conversation{ID: 1}, UserMessage: models.Message{ID: 2, Content: "我要退款"},
		AIAgent: models.AIAgent{ID: 9, PublishedRevisionID: revision.ID, SkillIDs: "70", SystemPrompt: "保持简洁"}, AIConfig: models.AIConfig{ModelName: "test-model"},
	})
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	if summary.PlannedSkillID != 70 || summary.PlannedSkillName != "退款处理" || summary.PlanReason != "llm_route" {
		t.Fatalf("unexpected skill summary: %#v", summary)
	}
	if !strings.Contains(systemPrompt, "先核对订单信息") || !strings.Contains(systemPrompt, "我要退款") {
		t.Fatalf("selected skill was not injected into system prompt: %q", systemPrompt)
	}
	var steps []models.AgentStep
	if err := db.Where("agent_run_id = ?", summary.AgentRunID).Find(&steps).Error; err != nil {
		t.Fatalf("load steps: %v", err)
	}
	if len(steps) != 2 || steps[1].StepType != "skill_route" || steps[1].StepCode != "skill_select" {
		t.Fatalf("expected model and skill route audit steps, got %#v", steps)
	}
}

func TestAutonomousEngineLetsModelHandleGreetingWithoutKnowledgeEvidence(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "t_", SingularTable: true}})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.AgentRevision{}, &models.AgentRun{}, &models.AgentStep{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
	revision := &models.AgentRevision{AgentID: 10, Revision: 1}
	if err := db.Create(revision).Error; err != nil {
		t.Fatalf("create revision: %v", err)
	}
	var systemPrompt string
	engine := newAutonomousEngineWithChat(func(_ context.Context, _ models.AIConfig, system, _ string) (*ai.ChatCompletionResult, error) {
		systemPrompt = system
		return &ai.ChatCompletionResult{Content: "你好，有什么可以帮你？", ModelName: "test-model"}, nil
	})
	engine.retrieve = func(context.Context, models.AIAgent, string) (string, int, error) {
		return "", 0, nil
	}
	summary, err := engine.Run(context.Background(), Request{
		Conversation: models.Conversation{ID: 1}, UserMessage: models.Message{ID: 2, Content: "你好"},
		AIAgent:  models.AIAgent{ID: 10, PublishedRevisionID: revision.ID, KnowledgeIDs: "100"},
		AIConfig: models.AIConfig{ModelName: "test-model"},
	})
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	if summary.ReplyText != "你好，有什么可以帮你？" {
		t.Fatalf("unexpected model reply: %#v", summary)
	}
	if !strings.Contains(systemPrompt, "answer greetings") || !strings.Contains(systemPrompt, "Knowledge retrieval found no supporting evidence") {
		t.Fatalf("missing no-evidence greeting instructions: %q", systemPrompt)
	}
	var steps []models.AgentStep
	if err := db.Where("agent_run_id = ?", summary.AgentRunID).Find(&steps).Error; err != nil {
		t.Fatalf("load steps: %v", err)
	}
	if len(steps) != 3 || steps[1].StepType != "knowledge" || steps[2].StepType != "policy" || steps[2].StepCode != "knowledge_evidence" || steps[2].Status != "advisory" || steps[2].OutputPreview != "evidence_required" {
		t.Fatalf("expected model, knowledge and policy steps, got %#v", steps)
	}
}

func TestAutonomousEngineInstructsModelNotToInventFactsWithoutKnowledgeEvidence(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "t_", SingularTable: true}})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.AgentRevision{}, &models.AgentRun{}, &models.AgentStep{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
	revision := &models.AgentRevision{AgentID: 13, Revision: 1}
	if err := db.Create(revision).Error; err != nil {
		t.Fatalf("create revision: %v", err)
	}
	var systemPrompt string
	engine := newAutonomousEngineWithChat(func(_ context.Context, _ models.AIConfig, system, _ string) (*ai.ChatCompletionResult, error) {
		systemPrompt = system
		return &ai.ChatCompletionResult{Content: "我暂时没有查到保修期限的准确依据。请提供产品型号，我再继续查询。", ModelName: "test-model"}, nil
	})
	engine.retrieve = func(context.Context, models.AIAgent, string) (string, int, error) {
		return "", 0, nil
	}
	summary, err := engine.Run(context.Background(), Request{
		Conversation: models.Conversation{ID: 1}, UserMessage: models.Message{ID: 2, Content: "保修多久"},
		AIAgent:  models.AIAgent{ID: 13, PublishedRevisionID: revision.ID, KnowledgeIDs: "100"},
		AIConfig: models.AIConfig{ModelName: "test-model"},
	})
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	if summary.ReplyText != "我暂时没有查到保修期限的准确依据。请提供产品型号，我再继续查询。" {
		t.Fatalf("unexpected model reply: %#v", summary)
	}
	if !strings.Contains(systemPrompt, "product facts, policies, pricing") || !strings.Contains(systemPrompt, "do not infer or invent an answer") {
		t.Fatalf("missing factual-answer evidence constraints: %q", systemPrompt)
	}
}

func TestAutonomousEngineDebugRunDoesNotExposeMCPTools(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "t_", SingularTable: true}})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.AgentRevision{}, &models.AgentRun{}, &models.AgentStep{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
	revision := &models.AgentRevision{AgentID: 11, Revision: 1}
	if err := db.Create(revision).Error; err != nil {
		t.Fatalf("create revision: %v", err)
	}
	engine := newAutonomousEngineWithChat(func(context.Context, models.AIConfig, string, string) (*ai.ChatCompletionResult, error) {
		return &ai.ChatCompletionResult{Content: "调试回复", ModelName: "test-model"}, nil
	})
	engine.toolChat = func(context.Context, models.AIConfig, string, string, []ai.ToolDefinition, int, ai.ToolCallExecutor) (*ai.ToolLoopResult, error) {
		t.Fatal("debug run must not enter tool calling loop")
		return nil, nil
	}
	summary, err := engine.Run(context.Background(), Request{
		Conversation: models.Conversation{ID: 1}, UserMessage: models.Message{ID: 2, Content: "查询订单"},
		AIAgent:  models.AIAgent{ID: 11, PublishedRevisionID: revision.ID, AllowedMCPTools: `[{"toolCode":"orders/lookup"}]`},
		AIConfig: models.AIConfig{ModelName: "test-model"}, Debug: true,
	})
	if err != nil || summary == nil || summary.ReplyText != "调试回复" {
		t.Fatalf("unexpected debug run result: summary=%#v err=%v", summary, err)
	}
}

func TestAutonomousEngineUsesPublishedRevisionSnapshot(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "t_", SingularTable: true}})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.AgentRevision{}, &models.AgentRun{}, &models.AgentStep{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
	revision := &models.AgentRevision{AgentID: 12, Revision: 1, Definition: `{"agent":{"name":"published","aiConfigId":5,"runtimeMode":"autonomous","maxSteps":4,"systemPrompt":"published instruction"},"model":{"configId":5,"provider":"openai","baseUrl":"https://published.example/v1","modelType":"llm","modelName":"published-model","timeoutMs":12000}}`}
	if err := db.Create(revision).Error; err != nil {
		t.Fatalf("create revision: %v", err)
	}
	var receivedSystem string
	var receivedConfig models.AIConfig
	engine := newAutonomousEngineWithChat(func(_ context.Context, config models.AIConfig, system, _ string) (*ai.ChatCompletionResult, error) {
		receivedSystem = system
		receivedConfig = config
		return &ai.ChatCompletionResult{Content: "published response", ModelName: config.ModelName}, nil
	})
	_, err = engine.Run(context.Background(), Request{
		Conversation: models.Conversation{ID: 1}, UserMessage: models.Message{ID: 2, Content: "hello"},
		AIAgent:  models.AIAgent{ID: 12, PublishedRevisionID: revision.ID, SystemPrompt: "draft instruction", AIConfigID: 5},
		AIConfig: models.AIConfig{ID: 5, APIKey: "rotated-key", ModelName: "draft-model"},
	})
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	if !strings.Contains(receivedSystem, "published instruction") || strings.Contains(receivedSystem, "draft instruction") {
		t.Fatalf("system prompt did not use published snapshot: %q", receivedSystem)
	}
	if receivedConfig.ModelName != "published-model" || receivedConfig.BaseURL != "https://published.example/v1" || receivedConfig.APIKey != "rotated-key" {
		t.Fatalf("model config did not use safe published snapshot: %#v", receivedConfig)
	}
}

func TestHybridEngineUsesBoundPlaybookAndRecordsGenericAudit(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "t_", SingularTable: true}})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.AgentRevision{}, &models.AIWorkflowVersion{}, &models.AgentRun{}, &models.AgentStep{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
	workflowVersion := &models.AIWorkflowVersion{WorkflowID: 21, Version: 1, Status: enums.StatusOk, Definition: `{"schemaVersion":2,"nodes":[{"id":"start_1","type":"start"},{"id":"end_1","type":"end"}],"edges":[{"sourceNodeID":"start_1","targetNodeID":"end_1"}]}`}
	if err := db.Create(workflowVersion).Error; err != nil {
		t.Fatalf("create workflow version: %v", err)
	}
	revision := &models.AgentRevision{AgentID: 14, Revision: 1, Status: enums.StatusOk, WorkflowVersionID: workflowVersion.ID, Definition: `{"agent":{"runtimeMode":"hybrid","systemPrompt":"published hybrid prompt","maxSteps":3},"workflowVersionId":1}`}
	if err := db.Create(revision).Error; err != nil {
		t.Fatalf("create revision: %v", err)
	}
	engine := NewHybridEngine()
	engine.chatWithTools = func(_ context.Context, _ models.AIConfig, system, _ string, definitions []ai.ToolDefinition, _ int, _ ai.ToolCallExecutor) (*ai.ToolLoopResult, error) {
		if !strings.Contains(system, "published hybrid prompt") || len(definitions) != 1 || definitions[0].Name != "run_playbook" {
			t.Fatalf("unexpected hybrid model context: system=%q definitions=%#v", system, definitions)
		}
		return &ai.ToolLoopResult{ChatCompletionResult: ai.ChatCompletionResult{Content: "这是自主回复。", ModelName: "test-model", PromptTokens: 5, CompletionTokens: 4}}, nil
	}
	summary, err := engine.Run(context.Background(), Request{
		UserMessage: models.Message{ID: 3, Content: "普通咨询"},
		AIAgent:     models.AIAgent{ID: 14, RuntimeMode: enums.AIAgentRuntimeModeHybrid, PublishedRevisionID: revision.ID, WorkflowVersionID: workflowVersion.ID},
		AIConfig:    models.AIConfig{ModelName: "test-model"},
	})
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	if summary == nil || summary.AgentRunID <= 0 || summary.WorkflowRunID != 0 || summary.ReplyText != "这是自主回复。" {
		t.Fatalf("unexpected hybrid summary: %#v", summary)
	}
	var run models.AgentRun
	if err := db.First(&run, summary.AgentRunID).Error; err != nil {
		t.Fatalf("load agent run: %v", err)
	}
	if run.EngineCode != "hybrid" || run.AgentRevisionID != revision.ID || run.Status != "completed" {
		t.Fatalf("unexpected hybrid audit: %#v", run)
	}
}

func TestHybridEngineRejectsPlaybookWhenToolPolicyDisallowsWrites(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "t_", SingularTable: true}})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.AgentRevision{}, &models.AIWorkflowVersion{}, &models.AgentRun{}, &models.AgentStep{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
	workflowVersion := &models.AIWorkflowVersion{WorkflowID: 22, Version: 1, Status: enums.StatusOk, Definition: `{"schemaVersion":2,"nodes":[{"id":"start_1","type":"start"},{"id":"end_1","type":"end"}],"edges":[{"sourceNodeID":"start_1","targetNodeID":"end_1"}]}`}
	if err := db.Create(workflowVersion).Error; err != nil {
		t.Fatalf("create workflow version: %v", err)
	}
	revision := &models.AgentRevision{AgentID: 15, Revision: 1, Status: enums.StatusOk, WorkflowVersionID: workflowVersion.ID, Definition: `{"agent":{"runtimeMode":"hybrid","systemPrompt":"published hybrid prompt","maxSteps":3,"toolPolicy":"{\"allowedRiskLevels\":[\"read\"]}"},"workflowVersionId":1}`}
	if err := db.Create(revision).Error; err != nil {
		t.Fatalf("create revision: %v", err)
	}
	engine := NewHybridEngine()
	engine.chatWithTools = func(ctx context.Context, _ models.AIConfig, _ string, _ string, _ []ai.ToolDefinition, _ int, execute ai.ToolCallExecutor) (*ai.ToolLoopResult, error) {
		_, err := execute(ctx, ai.ToolCall{Name: "run_playbook", Arguments: fmt.Sprintf(`{"workflowVersionId":%d}`, workflowVersion.ID)})
		return nil, err
	}
	_, err = engine.Run(context.Background(), Request{
		UserMessage: models.Message{ID: 4, Content: "请执行受控流程"},
		AIAgent:     models.AIAgent{ID: 15, RuntimeMode: enums.AIAgentRuntimeModeHybrid, PublishedRevisionID: revision.ID, WorkflowVersionID: workflowVersion.ID},
		AIConfig:    models.AIConfig{ModelName: "test-model"},
	})
	if err == nil || !strings.Contains(err.Error(), "tool risk level is not allowed") {
		t.Fatalf("expected tool policy rejection, got %v", err)
	}
}

func TestIntersectAutonomousToolCodesUsesSkillWhitelist(t *testing.T) {
	got := intersectAutonomousToolCodes([]string{"support/order_lookup", "support/create_ticket"}, []string{"support/order_lookup"})
	if len(got) != 1 || got[0] != "support/order_lookup" {
		t.Fatalf("intersection = %#v", got)
	}
}

func TestParseAutonomousToolPolicyAndPerToolCount(t *testing.T) {
	policy := parseAutonomousToolPolicy(`{"maxTotalCalls":2,"maxArgumentBytes":1024,"allowedRiskLevels":["read"]}`)
	if policy.MaxTotalCalls != 2 || policy.MaxArgumentBytes != 1024 || len(policy.AllowedRiskLevels) != 1 {
		t.Fatalf("unexpected policy: %#v", policy)
	}
	defaults := parseAutonomousToolPolicy(`{"maxTotalCalls":99,"maxArgumentBytes":999999}`)
	if defaults.MaxTotalCalls != 3 || defaults.MaxArgumentBytes != 32*1024 {
		t.Fatalf("invalid policy did not fall back to safe limits: %#v", defaults)
	}
	count := autonomousToolCallCount([]svc.EngineToolCallInput{{ToolCode: "orders/lookup"}, {ToolCode: "orders/other"}, {ToolCode: "orders/lookup"}}, "orders/lookup")
	if count != 2 {
		t.Fatalf("per-tool count = %d, want 2", count)
	}
}

func TestAutonomousKnowledgeEvidencePolicyIsAdvisory(t *testing.T) {
	policy := evaluateAutonomousResponsePolicy(models.AIAgent{KnowledgeIDs: "1", FallbackMode: enums.AIAgentFallbackModeHandoff}, "", nil)
	if policy.Enforced || policy.RequestHandoff || policy.Action != "evidence_required" || policy.Reason != "knowledge_evidence_missing" {
		t.Fatalf("unexpected knowledge evidence policy: %#v", policy)
	}
}

func TestAutonomousToolFailurePolicyRequestsHandoffOnlyWhenConfigured(t *testing.T) {
	handoff := autonomousToolFailurePolicy(models.AIAgent{FallbackMode: enums.AIAgentFallbackModeHandoff}, "tool_loop_error")
	if !handoff.Enforced || !handoff.RequestHandoff || handoff.Action != "handoff" {
		t.Fatalf("unexpected handoff policy: %#v", handoff)
	}
	clarify := autonomousToolFailurePolicy(models.AIAgent{FallbackMode: enums.AIAgentFallbackModeSuggestRetry}, "tool_loop_error")
	if !clarify.Enforced || clarify.RequestHandoff || clarify.Action != "clarify" {
		t.Fatalf("unexpected clarify policy: %#v", clarify)
	}
}

func TestAutonomousConversationContextToolUsesRegistryPolicy(t *testing.T) {
	definition, result, err := executeAutonomousReadTool(context.Background(), models.Conversation{CustomerName: "张三", LastMessageSummary: "咨询退款"}, models.AIAgent{}, toolx.BuiltinConversationContext.Code, nil, aitooling.Policy{
		AllowedToolCodes: []string{toolx.BuiltinConversationContext.Code}, AllowedRiskLevels: []string{aitooling.RiskLevelRead}, Confirmed: true,
	})
	if err != nil || definition.Code != toolx.BuiltinConversationContext.Code || !strings.Contains(result, `"customerName":"张三"`) {
		t.Fatalf("unexpected conversation context tool result: definition=%#v result=%q err=%v", definition, result, err)
	}
	_, _, err = executeAutonomousReadTool(context.Background(), models.Conversation{}, models.AIAgent{}, toolx.BuiltinConversationContext.Code, nil, aitooling.Policy{
		AllowedToolCodes: []string{toolx.BuiltinConversationContext.Code}, AllowedRiskLevels: []string{aitooling.RiskLevelWrite}, Confirmed: true,
	})
	if err == nil || !strings.Contains(err.Error(), "risk level") {
		t.Fatalf("expected read tool risk rejection, got %v", err)
	}
}

func TestAutonomousEngineExecutesAndAuditsConversationContextTool(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "t_", SingularTable: true}})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.AgentRevision{}, &models.AgentRun{}, &models.AgentStep{}, &models.AgentToolCall{}, &models.Message{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
	revision := &models.AgentRevision{AgentID: 13, Revision: 1}
	if err := db.Create(revision).Error; err != nil {
		t.Fatalf("create revision: %v", err)
	}
	if err := db.Create(&models.Message{ConversationID: 1, SenderType: "customer", MessageType: "text", Content: "上一轮问题"}).Error; err != nil {
		t.Fatalf("create prior message: %v", err)
	}
	engine := newAutonomousEngineWithChat(nil)
	engine.toolChat = func(ctx context.Context, _ models.AIConfig, _, _ string, _ []ai.ToolDefinition, _ int, execute ai.ToolCallExecutor) (*ai.ToolLoopResult, error) {
		output, err := execute(ctx, ai.ToolCall{ID: "call-1", Name: "tool_search", Arguments: `{"toolCode":"builtin/conversation_context","arguments":{}}`})
		if err != nil || !strings.Contains(output, `"customerName":"张三"`) || !strings.Contains(output, "上一轮问题") {
			t.Fatalf("execute tool: output=%q err=%v", output, err)
		}
		output, err = execute(ctx, ai.ToolCall{ID: "call-2", Name: "tool_search", Arguments: `{"toolCode":"graph/prepare_ticket_draft","arguments":{"issue":"重复扣费"}}`})
		if err != nil || !strings.Contains(output, `"title":"重复扣费"`) {
			t.Fatalf("execute ticket draft tool: output=%q err=%v", output, err)
		}
		output, err = execute(ctx, ai.ToolCall{ID: "call-3", Name: "tool_search", Arguments: `{"toolCode":"graph/analyze_conversation","arguments":{"observedIssue":"重复扣费","needTicket":true}}`})
		if err != nil || !strings.Contains(output, `"userIntent":"ticket_request"`) {
			t.Fatalf("execute conversation analysis tool: output=%q err=%v", output, err)
		}
		output, err = execute(ctx, ai.ToolCall{ID: "call-4", Name: "tool_search", Arguments: `{"toolCode":"graph/triage_service_request","arguments":{"observedIssue":"重复扣费","needTicket":true}}`})
		if err != nil || !strings.Contains(output, `"recommendedAction":"prepare_ticket"`) || !strings.Contains(output, `"ticketDraft"`) {
			t.Fatalf("execute service triage tool: output=%q err=%v", output, err)
		}
		return &ai.ToolLoopResult{ChatCompletionResult: ai.ChatCompletionResult{Content: "已查询到当前会话信息。", ModelName: "test-model"}}, nil
	}
	summary, err := engine.Run(context.Background(), Request{
		Conversation: models.Conversation{ID: 1, CustomerName: "张三", LastMessageSummary: "咨询退款"}, UserMessage: models.Message{ID: 2, Content: "请查一下当前会话"},
		AIAgent:  models.AIAgent{ID: 13, PublishedRevisionID: revision.ID, ToolPolicy: `{"maxTotalCalls":4}`, AllowedMCPTools: `[{"toolCode":"builtin/conversation_context"},{"toolCode":"graph/prepare_ticket_draft"},{"toolCode":"graph/analyze_conversation"},{"toolCode":"graph/triage_service_request"}]`},
		AIConfig: models.AIConfig{ModelName: "test-model"},
	})
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	_, _, calls := svc.AgentRunService.GetDetail(summary.AgentRunID)
	if len(calls) != 4 || calls[0].ToolCode != toolx.BuiltinConversationContext.Code || calls[1].ToolCode != toolx.GraphPrepareTicketDraft.Code || calls[2].ToolCode != toolx.GraphAnalyzeConversation.Code || calls[3].ToolCode != toolx.GraphTriageServiceRequest.Code || calls[3].Status != "completed" {
		t.Fatalf("unexpected tool audit: %#v", calls)
	}
}

func TestAutonomousEngineFallsBackAfterConsecutiveToolFailures(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "t_", SingularTable: true}})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.AgentRevision{}, &models.AgentRun{}, &models.AgentStep{}, &models.AgentToolCall{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
	revision := &models.AgentRevision{AgentID: 14, Revision: 1}
	if err := db.Create(revision).Error; err != nil {
		t.Fatalf("create revision: %v", err)
	}
	engine := newAutonomousEngineWithChat(nil)
	engine.toolChat = func(ctx context.Context, _ models.AIConfig, _, _ string, _ []ai.ToolDefinition, _ int, execute ai.ToolCallExecutor) (*ai.ToolLoopResult, error) {
		for _, callID := range []string{"call-1", "call-2"} {
			_, _ = execute(ctx, ai.ToolCall{ID: callID, Name: "tool_search", Arguments: `{"toolCode":"unknown/unsafe","arguments":{}}`})
		}
		return &ai.ToolLoopResult{ChatCompletionResult: ai.ChatCompletionResult{Content: "model reply should be replaced", ModelName: "test-model"}}, nil
	}
	summary, err := engine.Run(context.Background(), Request{
		Conversation: models.Conversation{ID: 1}, UserMessage: models.Message{ID: 2, Content: "查询订单"},
		AIAgent:  models.AIAgent{ID: 14, PublishedRevisionID: revision.ID, FallbackMode: enums.AIAgentFallbackModeHandoff, FallbackMessage: "查询暂不可用，正在转人工。", AllowedMCPTools: `[{"toolCode":"builtin/conversation_context"}]`},
		AIConfig: models.AIConfig{ModelName: "test-model"},
	})
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	if summary.ReplyText != "查询暂不可用，正在转人工。" || !summary.HandoffRequested {
		t.Fatalf("expected handoff fallback after tool failures, got %#v", summary)
	}
	_, steps, calls := svc.AgentRunService.GetDetail(summary.AgentRunID)
	if len(calls) != 2 || calls[0].Status != "failed" || calls[1].Status != "failed" {
		t.Fatalf("expected failed tool audits, got %#v", calls)
	}
	if len(steps) < 2 || steps[len(steps)-1].StepCode != "tool_failure" || steps[len(steps)-1].OutputPreview != "handoff" {
		t.Fatalf("expected tool failure policy audit, got %#v", steps)
	}
}

type runtimeTestEngine struct {
	code string
	ran  bool
}

func (e *runtimeTestEngine) Code() string {
	return e.code
}

func (e *runtimeTestEngine) Run(ctx context.Context, req RunInput) (*RunResult, error) {
	e.ran = true
	return &RunResult{Status: "completed"}, nil
}

func (e *runtimeTestEngine) Resume(ctx context.Context, req ResumeInput) (*RunResult, error) {
	return &RunResult{Status: "completed"}, nil
}

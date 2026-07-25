package runtime

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	workflowexecutor "agent-desk/internal/ai/runtime/workflow"
	"agent-desk/internal/ai/workflow/dsl"
	workflowregistry "agent-desk/internal/ai/workflow/registry"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	svc "agent-desk/internal/services"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestToWorkflowSummaryPreservesInterruptCheckpoint(t *testing.T) {
	summary := toWorkflowSummary(&workflowexecutor.Result{
		Status:         "interrupted",
		CheckPointID:   "workflow:1:2:confirm_1",
		CheckPointData: `{"confirmNodeId":"confirm_1"}`,
		Interrupted:    true,
		Interrupts: []workflowexecutor.InterruptSummary{
			{Type: "human_confirm", ID: "confirm_1", InfoPreview: `{"message":"请确认"}`},
		},
	}, "test-model", resolvedWorkflow{WorkflowID: 11, VersionID: 22}, 33, 44)

	if summary == nil || !summary.Interrupted {
		t.Fatalf("expected interrupted summary, got %#v", summary)
	}
	if summary.CheckPointID != "workflow:1:2:confirm_1" {
		t.Fatalf("unexpected checkpoint id: %q", summary.CheckPointID)
	}
	if summary.CheckPointData == "" {
		t.Fatalf("expected checkpoint data")
	}
	if summary.WorkflowID != 11 || summary.WorkflowVersionID != 22 || summary.WorkflowRunID != 33 {
		t.Fatalf("unexpected workflow identity: workflow=%d version=%d run=%d", summary.WorkflowID, summary.WorkflowVersionID, summary.WorkflowRunID)
	}
	if summary.AgentRunID != 44 {
		t.Fatalf("unexpected agent run id: %d", summary.AgentRunID)
	}
	if len(summary.Interrupts) != 1 || summary.Interrupts[0].ID != "confirm_1" {
		t.Fatalf("unexpected interrupts: %#v", summary.Interrupts)
	}
}

func TestPrepareWorkflowAgentDoesNotInjectWorkflowAppendix(t *testing.T) {
	db := setupWorkflowResumeTestDB(t)
	definitionJSON := mustMarshalDefinition(t, dsl.Definition{
		SchemaVersion: 2,
		Nodes: []dsl.Node{
			runtimeTestNode("start", workflowregistry.NodeTypeStart, "Start", nil, nil),
			runtimeTestNode("handoff", workflowregistry.NodeTypeHandoffToHuman, "Handoff", nil, nil),
		},
		Edges: []dsl.Edge{runtimeTestEdge("edge_start_handoff", "start", "handoff")},
	})
	version := models.AIWorkflowVersion{
		WorkflowID: 1,
		Version:    1,
		Status:     enums.StatusOk,
		Definition: definitionJSON,
	}
	if err := db.Create(&version).Error; err != nil {
		t.Fatalf("create workflow version: %v", err)
	}

	agent, _, err := prepareWorkflowAgent(models.AIAgent{
		ID:                1,
		SystemPrompt:      "保持简洁回答。",
		WorkflowVersionID: version.ID,
	})
	if err != nil {
		t.Fatalf("prepareWorkflowAgent() error = %v", err)
	}
	if agent.SystemPrompt != "保持简洁回答。" {
		t.Fatalf("expected system prompt to stay unchanged, got %q", agent.SystemPrompt)
	}
}

func TestServiceResumeUsesWorkflowCheckpointData(t *testing.T) {
	db := setupWorkflowResumeTestDB(t)
	def := runtimeHumanConfirmDefinition()
	definitionJSON := mustMarshalDefinition(t, def)
	version := models.AIWorkflowVersion{
		WorkflowID: 1,
		Version:    1,
		Status:     enums.StatusOk,
		Definition: definitionJSON,
	}
	if err := db.Create(&version).Error; err != nil {
		t.Fatalf("create workflow version: %v", err)
	}
	checkpointData := mustMarshalWorkflowCheckpoint(t, def)
	if err := db.Create(&models.ConversationInterrupt{
		ConversationID: 1,
		AIAgentID:      1,
		CheckPointID:   "workflow:1:2:confirm_1",
		RequestData:    checkpointData,
		Status:         "pending",
	}).Error; err != nil {
		t.Fatalf("create interrupt: %v", err)
	}

	summary, err := NewService().Resume(context.Background(), ResumeRequest{
		Conversation: models.Conversation{ID: 1},
		UserMessage:  models.Message{ID: 2, Content: "确认"},
		AIAgent: models.AIAgent{
			ID:                1,
			WorkflowVersionID: version.ID,
		},
		AIConfig:     models.AIConfig{ModelName: "test-model"},
		CheckPointID: "workflow:1:2:confirm_1",
		ResumeData: map[string]string{
			"confirm_1": "确认",
		},
	})
	if err != nil {
		t.Fatalf("resume workflow: %v", err)
	}
	if summary == nil || summary.Status != "completed" || summary.Interrupted {
		t.Fatalf("unexpected summary: %#v", summary)
	}
	if summary.WorkflowRunID <= 0 {
		t.Fatalf("expected workflow run id in resume summary")
	}
	if summary.AgentRunID <= 0 {
		t.Fatalf("expected generic agent run id in resume summary")
	}
	var run models.AIWorkflowRun
	if err := db.First(&run, summary.WorkflowRunID).Error; err != nil {
		t.Fatalf("find resume workflow run: %v", err)
	}
	if run.MessageID != 2 || run.Status != workflowRunStatusCompleted {
		t.Fatalf("unexpected resume workflow run: %#v", run)
	}
	var agentRun models.AgentRun
	if err := db.First(&agentRun, "workflow_run_id = ?", summary.WorkflowRunID).Error; err != nil {
		t.Fatalf("find generic agent run: %v", err)
	}
	if agentRun.EngineCode != EngineCodeWorkflow || agentRun.Status != "completed" {
		t.Fatalf("unexpected generic agent run: %#v", agentRun)
	}
	var stepCount int64
	if err := db.Model(&models.AgentStep{}).Where("agent_run_id = ?", agentRun.ID).Count(&stepCount).Error; err != nil {
		t.Fatalf("count generic agent steps: %v", err)
	}
	if stepCount != 1 {
		t.Fatalf("expected one generic agent step, got %d", stepCount)
	}
}

func TestHybridEngineResumeCompletesOriginalAgentRun(t *testing.T) {
	db := setupWorkflowResumeTestDB(t)
	def := runtimeHumanConfirmDefinition()
	version := models.AIWorkflowVersion{
		WorkflowID: 1,
		Version:    1,
		Status:     enums.StatusOk,
		Definition: mustMarshalDefinition(t, def),
	}
	if err := db.Create(&version).Error; err != nil {
		t.Fatalf("create workflow version: %v", err)
	}
	startedAt := time.Now()
	hybridRun := models.AgentRun{AIAgentID: 1, EngineCode: "hybrid", Status: "interrupted", StartedAt: startedAt, EndedAt: &startedAt, CreatedAt: startedAt, UpdatedAt: startedAt}
	if err := db.Create(&hybridRun).Error; err != nil {
		t.Fatalf("create interrupted hybrid run: %v", err)
	}
	interruptedRun := models.AIWorkflowRun{WorkflowID: version.WorkflowID, WorkflowVersionID: version.ID, ConversationID: 1, AIAgentID: 1, MessageID: 2, Status: workflowRunStatusInterrupted}
	if err := db.Create(&interruptedRun).Error; err != nil {
		t.Fatalf("create interrupted workflow run: %v", err)
	}
	const checkpointID = "workflow:1:2:confirm_1"
	if err := db.Create(&models.ConversationInterrupt{
		ConversationID: 1, AIAgentID: 1, AgentRunID: hybridRun.ID,
		CheckPointID: checkpointID, InterruptID: "confirm_1", InterruptType: "human_confirm",
		WorkflowRunID: interruptedRun.ID, WorkflowNodeID: "confirm_1", RequestData: mustMarshalWorkflowCheckpoint(t, def), Status: "pending",
	}).Error; err != nil {
		t.Fatalf("create interrupt: %v", err)
	}

	summary, err := NewHybridEngine().Resume(context.Background(), ResumeRequest{
		Conversation: models.Conversation{ID: 1}, UserMessage: models.Message{ID: 3, Content: "确认"},
		AIAgent:  models.AIAgent{ID: 1, RuntimeMode: enums.AIAgentRuntimeModeHybrid, WorkflowVersionID: version.ID},
		AIConfig: models.AIConfig{ModelName: "test-model"}, CheckPointID: checkpointID,
		ResumeData: map[string]string{"confirm_1": "确认"},
	})
	if err != nil {
		t.Fatalf("resume hybrid playbook: %v", err)
	}
	if summary == nil || summary.Status != "completed" || summary.AgentRunID != hybridRun.ID || summary.WorkflowRunID != interruptedRun.ID {
		t.Fatalf("unexpected hybrid resume summary: %#v", summary)
	}
	item, steps, _ := svc.AgentRunService.GetDetail(hybridRun.ID)
	if item == nil || item.Status != "completed" || len(steps) != 1 || steps[0].StepCode != "playbook_resume" || steps[0].WorkflowRunID != interruptedRun.ID {
		t.Fatalf("expected original hybrid run to receive resume audit, run=%#v steps=%#v", item, steps)
	}
}

func TestServiceResumeReusesInterruptedWorkflowRun(t *testing.T) {
	db := setupWorkflowResumeTestDB(t)
	def := runtimeHumanConfirmDefinition()
	version := models.AIWorkflowVersion{
		WorkflowID: 1,
		Version:    1,
		Status:     enums.StatusOk,
		Definition: mustMarshalDefinition(t, def),
	}
	if err := db.Create(&version).Error; err != nil {
		t.Fatalf("create workflow version: %v", err)
	}
	interruptedRun := models.AIWorkflowRun{
		WorkflowID:        version.WorkflowID,
		WorkflowVersionID: version.ID,
		ConversationID:    1,
		AIAgentID:         1,
		MessageID:         2,
		Status:            workflowRunStatusInterrupted,
		InterruptType:     "human_confirm",
		InterruptNodeID:   "confirm_1",
	}
	if err := db.Create(&interruptedRun).Error; err != nil {
		t.Fatalf("create interrupted workflow run: %v", err)
	}
	if err := db.Create(&models.ConversationInterrupt{
		ConversationID: 1,
		AIAgentID:      1,
		CheckPointID:   "workflow:1:2:confirm_1",
		InterruptID:    "confirm_1",
		InterruptType:  "human_confirm",
		WorkflowRunID:  interruptedRun.ID,
		WorkflowNodeID: "confirm_1",
		RequestData:    mustMarshalWorkflowCheckpoint(t, def),
		Status:         "pending",
	}).Error; err != nil {
		t.Fatalf("create interrupt: %v", err)
	}

	summary, err := NewService().Resume(context.Background(), ResumeRequest{
		Conversation: models.Conversation{ID: 1},
		UserMessage:  models.Message{ID: 3, Content: "确认"},
		AIAgent: models.AIAgent{
			ID:                1,
			WorkflowVersionID: version.ID,
		},
		AIConfig:     models.AIConfig{ModelName: "test-model"},
		CheckPointID: "workflow:1:2:confirm_1",
		ResumeData: map[string]string{
			"confirm_1": "确认",
		},
	})
	if err != nil {
		t.Fatalf("resume workflow: %v", err)
	}
	if summary.WorkflowRunID != interruptedRun.ID {
		t.Fatalf("expected resume to reuse workflow run %d, got %d", interruptedRun.ID, summary.WorkflowRunID)
	}
	var runCount int64
	if err := db.Model(&models.AIWorkflowRun{}).Count(&runCount).Error; err != nil {
		t.Fatalf("count workflow runs: %v", err)
	}
	if runCount != 1 {
		t.Fatalf("expected one workflow run after resume, got %d", runCount)
	}
	var updated models.AIWorkflowRun
	if err := db.First(&updated, interruptedRun.ID).Error; err != nil {
		t.Fatalf("find updated workflow run: %v", err)
	}
	if updated.Status != workflowRunStatusCompleted || updated.ErrorMessage != "" {
		t.Fatalf("unexpected updated workflow run: %#v", updated)
	}
	var nodeCount int64
	if err := db.Model(&models.AIWorkflowNodeRun{}).Where("workflow_run_id = ?", interruptedRun.ID).Count(&nodeCount).Error; err != nil {
		t.Fatalf("count node runs: %v", err)
	}
	if nodeCount == 0 {
		t.Fatalf("expected resumed node traces to be appended to original workflow run")
	}
}

func TestServiceRunWritesFailedWorkflowRun(t *testing.T) {
	db := setupWorkflowResumeTestDB(t)
	def := dsl.Definition{
		SchemaVersion: 2,
		Nodes: []dsl.Node{
			runtimeTestNode("start_1", workflowregistry.NodeTypeStart, "Start", nil, nil),
			runtimeTestNode("bad_1", "unsupported_node", "Bad", nil, nil),
		},
		Edges: []dsl.Edge{
			runtimeTestEdge("edge_start_bad", "start_1", "bad_1"),
		},
	}
	version := models.AIWorkflowVersion{
		WorkflowID: 9,
		Version:    1,
		Status:     enums.StatusOk,
		Definition: mustMarshalDefinition(t, def),
	}
	if err := db.Create(&version).Error; err != nil {
		t.Fatalf("create workflow version: %v", err)
	}

	_, err := NewService().Run(context.Background(), Request{
		Conversation: models.Conversation{ID: 10},
		UserMessage:  models.Message{ID: 20, Content: "hello"},
		AIAgent: models.AIAgent{
			ID:                30,
			WorkflowVersionID: version.ID,
		},
	})
	if err == nil {
		t.Fatalf("expected workflow run error")
	}
	var run models.AIWorkflowRun
	if err := db.First(&run, "workflow_version_id = ?", version.ID).Error; err != nil {
		t.Fatalf("find failed workflow run: %v", err)
	}
	if run.Status != workflowRunStatusFailed || !strings.Contains(run.ErrorMessage, "unsupported workflow node type") {
		t.Fatalf("unexpected failed workflow run: %#v", run)
	}
	var badNodeRun models.AIWorkflowNodeRun
	if err := db.First(&badNodeRun, "workflow_run_id = ? AND node_id = ?", run.ID, "bad_1").Error; err != nil {
		t.Fatalf("find failed node run: %v", err)
	}
	if badNodeRun.Status != workflowRunStatusFailed || badNodeRun.ErrorMessage == "" {
		t.Fatalf("unexpected failed node run: %#v", badNodeRun)
	}
	var agentRun models.AgentRun
	if err := db.First(&agentRun, "workflow_run_id = ?", run.ID).Error; err != nil {
		t.Fatalf("find generic failed agent run: %v", err)
	}
	if agentRun.Status != "failed" || !strings.Contains(agentRun.ErrorMessage, "unsupported workflow node type") {
		t.Fatalf("unexpected generic failed agent run: %#v", agentRun)
	}
}

func TestServiceRunWritesFailedWorkflowRunWhenVersionDisabled(t *testing.T) {
	db := setupWorkflowResumeTestDB(t)
	version := models.AIWorkflowVersion{
		WorkflowID: 9,
		Version:    1,
		Status:     enums.StatusDisabled,
		Definition: mustMarshalDefinition(t, runtimeHumanConfirmDefinition()),
	}
	if err := db.Create(&version).Error; err != nil {
		t.Fatalf("create disabled workflow version: %v", err)
	}

	_, err := NewService().Run(context.Background(), Request{
		Conversation: models.Conversation{ID: 10},
		UserMessage:  models.Message{ID: 20, Content: "hello"},
		AIAgent: models.AIAgent{
			ID:                30,
			WorkflowVersionID: version.ID,
		},
	})
	if err == nil {
		t.Fatalf("expected disabled workflow version error")
	}
	var run models.AIWorkflowRun
	if err := db.First(&run, "workflow_version_id = ?", version.ID).Error; err != nil {
		t.Fatalf("find prepare-stage failed workflow run: %v", err)
	}
	if run.WorkflowID != version.WorkflowID || run.ConversationID != 10 || run.AIAgentID != 30 || run.MessageID != 20 {
		t.Fatalf("unexpected prepare-stage failed workflow run identity: %#v", run)
	}
	if run.Status != workflowRunStatusFailed || !strings.Contains(run.ErrorMessage, "workflow version does not exist") {
		t.Fatalf("unexpected prepare-stage failed workflow run: %#v", run)
	}
	var nodeCount int64
	if err := db.Model(&models.AIWorkflowNodeRun{}).Where("workflow_run_id = ?", run.ID).Count(&nodeCount).Error; err != nil {
		t.Fatalf("count node runs: %v", err)
	}
	if nodeCount != 0 {
		t.Fatalf("expected no node runs for prepare-stage failure, got %d", nodeCount)
	}
}

func setupWorkflowResumeTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dbName := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open("file:"+dbName+"?mode=memory&cache=shared"), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{
			TablePrefix:   "t_",
			SingularTable: true,
		},
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	if err := db.AutoMigrate(
		&models.AIWorkflowVersion{},
		&models.AIWorkflowRun{},
		&models.AIWorkflowNodeRun{},
		&models.AgentRun{},
		&models.AgentStep{},
		&models.AgentRevision{},
		&models.ConversationInterrupt{},
	); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
	return db
}

func runtimeHumanConfirmDefinition() dsl.Definition {
	return dsl.Definition{
		SchemaVersion: 2,
		Nodes: []dsl.Node{
			runtimeTestNode("start_1", workflowregistry.NodeTypeStart, "Start", nil, nil),
			runtimeTestNode("prompt_1", workflowregistry.NodeTypeLLMReply, "Prompt", []byte(`{"staticReply":"请确认"}`), nil),
			runtimeTestNode("confirm_1", workflowregistry.NodeTypeHumanConfirm, "Confirm", nil, map[string]dsl.Value{
				"prompt": dsl.RefValue("prompt_1", "replyText"),
			}),
			runtimeTestNode("end_1", workflowregistry.NodeTypeEnd, "End", nil, nil),
		},
		Edges: []dsl.Edge{
			runtimeTestEdge("edge_start_prompt", "start_1", "prompt_1"),
			runtimeTestEdge("edge_prompt_confirm", "prompt_1", "confirm_1"),
			runtimeTestEdge("edge_confirm_end", "confirm_1", "end_1"),
		},
	}
}

func runtimeTestNode(id string, nodeType string, title string, config []byte, inputs map[string]dsl.Value) dsl.Node {
	return dsl.Node{
		ID:   id,
		Type: nodeType,
		Data: dsl.NodeData{
			Title:        title,
			Config:       config,
			InputsValues: inputs,
		},
	}
}

func runtimeTestEdge(id string, source string, target string) dsl.Edge {
	return dsl.Edge{SourceNodeID: source, TargetNodeID: target, SourcePortID: id}
}

func mustMarshalDefinition(t *testing.T, def dsl.Definition) string {
	t.Helper()
	buf, err := json.Marshal(def)
	if err != nil {
		t.Fatalf("marshal definition: %v", err)
	}
	return string(buf)
}

func mustMarshalWorkflowCheckpoint(t *testing.T, def dsl.Definition) string {
	t.Helper()
	buf, err := json.Marshal(struct {
		Definition    dsl.Definition            `json:"definition"`
		ConfirmNodeID string                    `json:"confirmNodeId"`
		Vars          map[string]map[string]any `json:"vars"`
	}{
		Definition:    def,
		ConfirmNodeID: "confirm_1",
		Vars: map[string]map[string]any{
			"start_1":  {"userMessage": "创建工单"},
			"prompt_1": {"replyText": "请确认"},
		},
	})
	if err != nil {
		t.Fatalf("marshal checkpoint: %v", err)
	}
	return string(buf)
}

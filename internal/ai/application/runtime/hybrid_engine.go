package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	ai "agent-desk/internal/ai"
	aitooling "agent-desk/internal/ai/tooling"
	"agent-desk/internal/ai/runtime/instruction"
	workflowregistry "agent-desk/internal/ai/workflow/registry"
	workflowvalidator "agent-desk/internal/ai/workflow/validator"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/pkg/utils"
	svc "agent-desk/internal/services"

	"github.com/mlogclub/simple/sqls"
)

const hybridPlaybookToolCode = "playbook/run"

// HybridEngine lets the model choose whether to enter the Agent's one bound
// deterministic Playbook. The Playbook itself is always run by WorkflowEngine.
type HybridEngine struct {
	chatWithTools func(context.Context, models.AIConfig, string, string, []ai.ToolDefinition, int, ai.ToolCallExecutor) (*ai.ToolLoopResult, error)
	autonomous    *AutonomousEngine
	workflow      *WorkflowEngine
}

func NewHybridEngine() *HybridEngine {
	return &HybridEngine{
		chatWithTools: ai.LLM.ChatWithTools,
		autonomous:    NewAutonomousEngine(),
		workflow:      NewWorkflowEngine(),
	}
}

func (e *HybridEngine) Code() string {
	return "hybrid"
}

func (e *HybridEngine) Run(ctx context.Context, req RunInput) (*RunResult, error) {
	startedAt := time.Now()
	req.UserMessage.Content = utils.BuildRuntimeMessageText(req.UserMessage.MessageType, req.UserMessage.Content)
	snapshot, err := svc.AgentRevisionService.ResolvePublishedSnapshot(req.AIAgent, req.AIConfig)
	if err != nil {
		return nil, err
	}
	req.AIAgent, req.AIConfig = snapshot.Agent, snapshot.AIConfig
	if req.AIAgent.WorkflowVersionID <= 0 {
		return nil, errorsx.InvalidParam("hybrid agent requires a published playbook workflow")
	}
	workflow, err := resolveAgentWorkflow(req.AIAgent)
	if err != nil {
		return nil, err
	}
	if result := workflowvalidator.ValidateDefinition(workflow.Definition, workflowregistry.DefaultRegistry()); !result.Valid {
		return nil, errorsx.InvalidParam("hybrid agent playbook validation failed")
	}

	skillContext := e.autonomous.selectSkill(ctx, req)
	knowledgeContext, retrieverCount, retrieveErr := e.autonomous.retrieveKnowledge(ctx, req.AIAgent, req.UserMessage.Content)
	responsePolicy := evaluateAutonomousResponsePolicy(req.AIAgent, knowledgeContext, retrieveErr)
	if responsePolicy.Enforced {
		return writeHybridResult(req, startedAt, &ai.ChatCompletionResult{Content: responsePolicy.ReplyText, ModelName: req.AIConfig.ModelName}, "", 0, retrieverCount, skillContext, nil, responsePolicy, nil)
	}
	systemPrompt := buildAutonomousSystemPrompt(req.AIAgent, len(utils.SplitInt64s(req.AIAgent.KnowledgeIDs)) > 0, knowledgeContext, retrieveErr)
	if skillInstruction := strings.TrimSpace(instruction.BuildSkillDocument(skillContext.Skill, nil)); skillInstruction != "" {
		systemPrompt += "\n\nSkill instructions:\n" + skillInstruction
	}
	systemPrompt += "\n\nWhen a deterministic process is required, use run_playbook. Do not call it for ordinary factual questions."
	userPrompt, historyCount := e.autonomous.buildUserPrompt(req)
	if knowledgeContext != "" {
		userPrompt += "\n\nKnowledge evidence:\n" + knowledgeContext
	}

	var playbookSummary *Summary
	toolCalls := make([]svc.EngineToolCallInput, 0, 1)
	toolPolicy := parseAutonomousToolPolicy(req.AIAgent.ToolPolicy)
	loop, err := e.chatWithTools(ctx, req.AIConfig, systemPrompt, userPrompt, []ai.ToolDefinition{hybridPlaybookToolDefinition(req.AIAgent.WorkflowVersionID)}, req.AIAgent.MaxSteps, func(ctx context.Context, call ai.ToolCall) (string, error) {
		if call.Name != "run_playbook" {
			return "", fmt.Errorf("unsupported hybrid tool: %s", call.Name)
		}
		if len(toolCalls) >= 1 {
			return "", fmt.Errorf("playbook call limit reached")
		}
		workflowVersionID, err := parseHybridPlaybookCall(call.Arguments)
		if err != nil {
			return "", err
		}
		if workflowVersionID != req.AIAgent.WorkflowVersionID {
			return "", fmt.Errorf("playbook is not allowed")
		}
		playbookDefinition := aitooling.Definition{Code: hybridPlaybookToolCode, Name: "run_playbook", RiskLevel: aitooling.RiskLevelWrite, RequireConfirmation: true, MaxCallsPerRun: 1}
		if err := aitooling.DefaultRegistry.Authorize(playbookDefinition, aitooling.Policy{
			AllowedRiskLevels: toolPolicy.AllowedRiskLevels,
			CallCount:         len(toolCalls),
			TotalCallCount:    len(toolCalls),
			MaxTotalCalls:     1,
			Confirmed:         true, // Workflow validation guarantees a human-confirm predecessor for high-risk nodes.
		}); err != nil {
			return "", err
		}
		callStartedAt := time.Now()
		playbookSummary, err = e.workflow.Run(ctx, req)
		toolRecord := svc.EngineToolCallInput{ToolCode: hybridPlaybookToolCode, RiskLevel: "write", RequireConfirm: true, ArgumentsPreview: call.Arguments, DurationMS: int(time.Since(callStartedAt).Milliseconds())}
		if err != nil {
			toolRecord.Status, toolRecord.ErrorMessage = "failed", err.Error()
			toolCalls = append(toolCalls, toolRecord)
			return "", err
		}
		toolRecord.Status = "completed"
		toolRecord.ResultPreview = fmt.Sprintf("workflowRunId=%d status=%s", playbookSummary.WorkflowRunID, playbookSummary.Status)
		toolCalls = append(toolCalls, toolRecord)
		data, _ := json.Marshal(map[string]any{"workflowRunId": playbookSummary.WorkflowRunID, "status": playbookSummary.Status, "replyText": playbookSummary.ReplyText, "interrupted": playbookSummary.Interrupted})
		return string(data), nil
	})
	if err != nil {
		_, _ = writeHybridAudit(req, startedAt, nil, userPrompt, historyCount, retrieverCount, skillContext, toolCalls, responsePolicy, false, err)
		return nil, err
	}
	if playbookSummary != nil && playbookSummary.Interrupted {
		runID, auditErr := writeHybridAudit(req, startedAt, &ai.ChatCompletionResult{Content: playbookSummary.ReplyText, ModelName: playbookSummary.ModelName, PromptTokens: playbookSummary.PromptTokens, CompletionTokens: playbookSummary.CompletionTokens}, userPrompt, historyCount, retrieverCount, skillContext, toolCalls, responsePolicy, true, nil)
		if auditErr != nil {
			return nil, auditErr
		}
		playbookSummary.AgentRunID = runID
		return playbookSummary, nil
	}
	if loop == nil || strings.TrimSpace(loop.Content) == "" {
		err = errorsx.InvalidParam("hybrid engine returned an empty reply")
		_, _ = writeHybridAudit(req, startedAt, nil, userPrompt, historyCount, retrieverCount, skillContext, toolCalls, responsePolicy, false, err)
		return nil, err
	}
	return writeHybridResult(req, startedAt, &loop.ChatCompletionResult, userPrompt, historyCount, retrieverCount, skillContext, playbookSummary, responsePolicy, toolCalls)
}

func (e *HybridEngine) Resume(ctx context.Context, req ResumeInput) (*RunResult, error) {
	interrupt := svc.ConversationInterruptService.GetByCheckPointID(req.CheckPointID)
	summary, err := e.workflow.Resume(ctx, req)
	if err != nil || summary == nil || interrupt == nil || interrupt.AgentRunID <= 0 {
		return summary, err
	}
	if err := sqls.WithTransaction(func(tx *sqls.TxContext) error {
		return svc.AgentRunService.RecordHybridPlaybookResume(tx.Tx, interrupt.AgentRunID, summary.WorkflowRunID, summary.Status, summary.ReplyText)
	}); err != nil {
		return nil, err
	}
	// The resumed WorkflowRun is a child audit artifact. Keep the original
	// Hybrid run as the summary run surfaced to the conversation caller.
	summary.AgentRunID = interrupt.AgentRunID
	return summary, nil
}

func hybridPlaybookToolDefinition(workflowVersionID int64) ai.ToolDefinition {
	return ai.ToolDefinition{Name: "run_playbook", Description: "Run the Agent's published deterministic Playbook when the customer needs a controlled business action.", Parameters: map[string]any{
		"type": "object", "properties": map[string]any{"workflowVersionId": map[string]any{"type": "integer", "description": "The bound Playbook version."}}, "required": []string{"workflowVersionId"},
	}}
}

func parseHybridPlaybookCall(raw string) (int64, error) {
	var input struct {
		WorkflowVersionID int64 `json:"workflowVersionId"`
	}
	if err := json.Unmarshal([]byte(raw), &input); err != nil || input.WorkflowVersionID <= 0 {
		return 0, errorsx.InvalidParam("invalid playbook call")
	}
	return input.WorkflowVersionID, nil
}

func writeHybridResult(req Request, startedAt time.Time, result *ai.ChatCompletionResult, inputPreview string, historyCount, retrieverCount int, skillContext autonomousSkillContext, playbook *Summary, responsePolicy autonomousResponsePolicy, toolCalls []svc.EngineToolCallInput) (*Summary, error) {
	runID, err := writeHybridAudit(req, startedAt, result, inputPreview, historyCount, retrieverCount, skillContext, toolCalls, responsePolicy, false, nil)
	if err != nil {
		return nil, err
	}
	return &Summary{Status: "completed", ReplyText: strings.TrimSpace(result.Content), ModelName: result.ModelName, PromptTokens: result.PromptTokens, CompletionTokens: result.CompletionTokens, HistoryMessageCount: historyCount, RetrieverCount: retrieverCount, AgentRunID: runID, WorkflowRunID: workflowRunIDFromSummary(playbook)}, nil
}

func writeHybridAudit(req Request, startedAt time.Time, result *ai.ChatCompletionResult, inputPreview string, historyCount, retrieverCount int, skillContext autonomousSkillContext, toolCalls []svc.EngineToolCallInput, responsePolicy autonomousResponsePolicy, interrupted bool, cause error) (int64, error) {
	endedAt := time.Now()
	status, errorMessage, outputPreview := "completed", "", ""
	promptTokens, completionTokens := 0, 0
	if interrupted {
		status = "interrupted"
	} else if cause != nil {
		status, errorMessage = "failed", cause.Error()
	} else if result != nil {
		outputPreview, promptTokens, completionTokens = strings.TrimSpace(result.Content), result.PromptTokens, result.CompletionTokens
	}
	steps := autonomousAdditionalSteps(req, retrieverCount, nil, skillContext, responsePolicy)
	for _, call := range toolCalls {
		if call.ToolCode == hybridPlaybookToolCode {
			steps = append(steps, svc.EngineStepInput{StepType: "playbook", StepCode: hybridPlaybookToolCode, WorkflowRunID: workflowRunIDFromToolResult(call.ResultPreview), Status: call.Status, InputPreview: call.ArgumentsPreview, OutputPreview: call.ResultPreview, ErrorMessage: call.ErrorMessage})
		}
	}
	var runID int64
	err := sqls.WithTransaction(func(tx *sqls.TxContext) error {
		var recordErr error
		runID, recordErr = svc.AgentRunService.RecordEngineRun(tx.Tx, svc.EngineAgentRunInput{ConversationID: req.Conversation.ID, AIAgentID: req.AIAgent.ID, AgentRevisionID: req.AIAgent.PublishedRevisionID, SourceMessageID: req.UserMessage.ID, EngineCode: "hybrid", Status: status, PromptTokens: promptTokens, CompletionTokens: completionTokens, StartedAt: startedAt, EndedAt: &endedAt, ErrorMessage: errorMessage, TraceData: `{"engine":"hybrid"}`, StepType: "model", StepCode: "chat_completion", StepInputPreview: inputPreview, StepOutputPreview: outputPreview, AdditionalSteps: steps, ToolCalls: toolCalls})
		return recordErr
	})
	return runID, err
}

func workflowRunIDFromSummary(summary *Summary) int64 {
	if summary == nil {
		return 0
	}
	return summary.WorkflowRunID
}

func workflowRunIDFromToolResult(value string) int64 {
	var id int64
	_, _ = fmt.Sscanf(value, "workflowRunId=%d", &id)
	return id
}

var _ Engine = (*HybridEngine)(nil)

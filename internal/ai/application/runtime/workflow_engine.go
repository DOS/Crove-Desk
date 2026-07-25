package runtime

import (
	"context"
	"strings"

	workflowexecutor "agent-desk/internal/ai/runtime/workflow"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/pkg/utils"
	"agent-desk/internal/repositories"

	"github.com/mlogclub/simple/sqls"
)

// WorkflowEngine preserves the existing FlowGram DSL execution path as the
// first Agent Runtime engine. It remains the compatibility default for agents
// created before autonomous and hybrid modes are available.
type WorkflowEngine struct{}

func NewWorkflowEngine() *WorkflowEngine {
	return &WorkflowEngine{}
}

func (e *WorkflowEngine) Code() string {
	return EngineCodeWorkflow
}

func (e *WorkflowEngine) Run(ctx context.Context, req RunInput) (*RunResult, error) {
	req.UserMessage.Content = utils.BuildRuntimeMessageText(req.UserMessage.MessageType, req.UserMessage.Content)
	aiAgent, workflow, err := prepareWorkflowAgent(req.AIAgent)
	if err != nil {
		_, _ = writeWorkflowPrepareFailedRun(req, err.Error())
		return nil, err
	}
	req.AIAgent = aiAgent
	workflowResult, err := workflowexecutor.NewExecutor().Execute(ctx, workflowexecutor.Input{
		Definition:   workflow.Definition,
		Conversation: req.Conversation,
		UserMessage:  req.UserMessage,
		AIAgent:      req.AIAgent,
		AIConfig:     req.AIConfig,
		Debug:        req.Debug,
	})
	if err != nil {
		if workflowResult != nil {
			_, _, _ = writeWorkflowRun(req, workflow, workflowResult, err.Error())
		}
		return nil, err
	}
	workflowRunID, agentRunID, err := writeWorkflowRun(req, workflow, workflowResult, "")
	if err != nil {
		return nil, err
	}
	return toWorkflowSummary(workflowResult, req.AIConfig.ModelName, workflow, workflowRunID, agentRunID), nil
}

func (e *WorkflowEngine) Resume(ctx context.Context, req ResumeInput) (*RunResult, error) {
	aiAgent, workflow, err := prepareWorkflowAgent(req.AIAgent)
	if err != nil {
		return nil, err
	}
	req.AIAgent = aiAgent
	interrupt := repositories.ConversationInterruptRepository.GetByCheckPointID(sqls.DB(), req.CheckPointID)
	if interrupt == nil {
		return nil, errorsx.InvalidParam("legacy checkpoint is not supported; please start a new workflow reply")
	}
	if strings.TrimSpace(interrupt.RequestData) == "" {
		if interrupt.WorkflowRunID > 0 || strings.HasPrefix(strings.TrimSpace(req.CheckPointID), "workflow:") {
			return nil, errorsx.InvalidParam("workflow checkpoint data is required")
		}
		return nil, errorsx.InvalidParam("legacy checkpoint is not supported; please start a new workflow reply")
	}
	workflowResult, err := workflowexecutor.NewExecutor().Resume(ctx, workflowexecutor.Input{
		Definition:   workflow.Definition,
		Conversation: req.Conversation,
		AIAgent:      req.AIAgent,
		AIConfig:     req.AIConfig,
		Debug:        req.Debug,
	}, interrupt.RequestData, firstWorkflowResumeText(req.ResumeData))
	if err != nil {
		if workflowResult != nil {
			_, _, _ = writeWorkflowRunWithExistingID(Request{
				Conversation: req.Conversation,
				UserMessage:  req.UserMessage,
				AIAgent:      req.AIAgent,
				AIConfig:     req.AIConfig,
			}, workflow, workflowResult, err.Error(), interrupt.WorkflowRunID)
		}
		return nil, err
	}
	workflowRunID, agentRunID, err := writeWorkflowRunWithExistingID(Request{
		Conversation: req.Conversation,
		UserMessage:  req.UserMessage,
		AIAgent:      req.AIAgent,
		AIConfig:     req.AIConfig,
	}, workflow, workflowResult, "", interrupt.WorkflowRunID)
	if err != nil {
		return nil, err
	}
	return toWorkflowSummary(workflowResult, req.AIConfig.ModelName, workflow, workflowRunID, agentRunID), nil
}

func firstWorkflowResumeText(data map[string]string) string {
	for _, value := range data {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

var _ Engine = (*WorkflowEngine)(nil)

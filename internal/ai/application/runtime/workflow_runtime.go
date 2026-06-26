package runtime

import (
	"encoding/json"

	"agent-desk/internal/ai/workflow/dsl"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/repositories"

	"github.com/mlogclub/simple/sqls"
)

type resolvedWorkflow struct {
	Definition dsl.Definition
	WorkflowID int64
	VersionID  int64
}

func resolveAgentWorkflow(aiAgent models.AIAgent) (resolvedWorkflow, error) {
	if aiAgent.WorkflowVersionID <= 0 {
		return resolvedWorkflow{}, errorsx.InvalidParam("AI Agent workflow is not published; publish a workflow version before enabling automatic replies")
	}
	version := repositories.AIWorkflowVersionRepository.Get(sqls.DB(), aiAgent.WorkflowVersionID)
	if version == nil || version.Status != enums.StatusOk {
		return resolvedWorkflow{}, errorsx.InvalidParam("workflow version does not exist")
	}
	var def dsl.Definition
	if err := json.Unmarshal([]byte(version.Definition), &def); err != nil {
		return resolvedWorkflow{}, errorsx.InvalidParam("workflow definition is invalid")
	}
	return resolvedWorkflow{
		Definition: def,
		WorkflowID: version.WorkflowID,
		VersionID:  version.ID,
	}, nil
}

func prepareWorkflowAgent(aiAgent models.AIAgent) (models.AIAgent, resolvedWorkflow, error) {
	workflow, err := resolveAgentWorkflow(aiAgent)
	if err != nil {
		return aiAgent, resolvedWorkflow{}, err
	}
	return aiAgent, workflow, nil
}

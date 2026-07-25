package einoexperiment

import (
	"context"
	"fmt"
	"strings"

	"agent-desk/internal/ai/mcps"
	runtimetooling "agent-desk/internal/ai/runtime/tooling"
	aitooling "agent-desk/internal/ai/tooling"
)

// MCPToolExecutor is the narrow execution boundary used by the Eino
// experiment. The production MCP executor remains responsible for dynamic
// registry resolution, policy enforcement, timeout, and transport lifecycle.
type MCPToolExecutor interface {
	Execute(context.Context, string, map[string]any, aitooling.Policy) (aitooling.Definition, *mcps.ToolCallResult, error)
}

// NewMCPToolHandler adapts a dynamically discovered MCP tool to GuardedTool.
// Callers must still configure GuardedTool.Definition and Policy so its
// pre-handler guard provides a deterministic rejection before MCP transport.
func NewMCPToolHandler(executor MCPToolExecutor, toolCode string, policy aitooling.Policy) ToolHandler {
	return func(ctx context.Context, arguments map[string]any) (string, error) {
		if executor == nil {
			return "", fmt.Errorf("eino experiment MCP executor is required")
		}
		definition, result, err := executor.Execute(ctx, strings.TrimSpace(toolCode), arguments, policy)
		if err != nil {
			return "", err
		}
		if definition.Code == "" {
			return "", fmt.Errorf("MCP executor returned an empty tool definition")
		}
		return runtimetooling.BuildReducedToolResultSummary(result), nil
	}
}

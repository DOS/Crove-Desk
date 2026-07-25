package einoexperiment

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	aitooling "agent-desk/internal/ai/tooling"

	einotool "github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/schema"
)

// ToolHandler is the adapter point from an approved Eino experiment tool to
// AgentDesk business services. Production handlers must still call services,
// never repositories.
type ToolHandler func(ctx context.Context, arguments map[string]any) (string, error)

// ToolTrace is emitted for every guarded invocation. A future Engine adapter
// can translate it into AgentRun tool-call audit records without coupling this
// experiment package to the service layer.
type ToolTrace struct {
	ToolCode  string
	Arguments map[string]any
	Status    string
	Result    string
	Err       error
	Duration  time.Duration
}

type ToolTraceHook func(ToolTrace)

// GuardedTool adapts an Eino InvokableTool to the shared ToolPolicyGuard. It is
// deliberately generic so Tool Registry semantics are checked before a tool
// handler is invoked.
type GuardedTool struct {
	InfoDefinition *schema.ToolInfo
	Definition     aitooling.Definition
	Policy         aitooling.Policy
	Handler        ToolHandler
	Trace          ToolTraceHook
}

var _ einotool.InvokableTool = (*GuardedTool)(nil)

func (t *GuardedTool) Info(context.Context) (*schema.ToolInfo, error) {
	if t == nil || t.InfoDefinition == nil {
		return nil, fmt.Errorf("eino experiment tool info is required")
	}
	return t.InfoDefinition, nil
}

func (t *GuardedTool) InvokableRun(ctx context.Context, argumentsInJSON string, _ ...einotool.Option) (string, error) {
	if t == nil || t.Handler == nil {
		return "", fmt.Errorf("eino experiment tool handler is required")
	}
	startedAt := time.Now()
	arguments := map[string]any{}
	if err := json.Unmarshal([]byte(argumentsInJSON), &arguments); err != nil {
		t.emitTrace(arguments, "failed", "", err, startedAt)
		return "", fmt.Errorf("decode tool arguments: %w", err)
	}
	if err := aitooling.DefaultPolicyGuard.Authorize(aitooling.Invocation{
		Definition: t.Definition,
		Arguments:  arguments,
		Policy:     t.Policy,
	}); err != nil {
		t.emitTrace(arguments, "failed", "", err, startedAt)
		return "", err
	}
	if t.Definition.TimeoutMS > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, time.Duration(t.Definition.TimeoutMS)*time.Millisecond)
		defer cancel()
	}
	result, err := t.Handler(ctx, arguments)
	status := "completed"
	if err != nil {
		status = "failed"
	}
	t.emitTrace(arguments, status, result, err, startedAt)
	return result, err
}

func (t *GuardedTool) emitTrace(arguments map[string]any, status, result string, err error, startedAt time.Time) {
	if t == nil || t.Trace == nil {
		return
	}
	t.Trace(ToolTrace{
		ToolCode: t.Definition.Code, Arguments: arguments, Status: status, Result: result, Err: err,
		Duration: time.Since(startedAt),
	})
}

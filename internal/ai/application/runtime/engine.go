package runtime

import (
	"context"
	"errors"
	"strings"

	"agent-desk/internal/pkg/errorsx"
)

const (
	EngineCodeWorkflow   = "workflow"
	EngineCodeAutonomous = "autonomous"
)

// Engine executes one Agent Runtime mode. Implementations must keep business
// mutations behind AgentDesk services and return a normalized RunResult.
type Engine interface {
	Code() string
	Run(ctx context.Context, req RunInput) (*RunResult, error)
	Resume(ctx context.Context, req ResumeInput) (*RunResult, error)
}

// EngineRegistry resolves the runtime implementation. Workflow is the default
// until Agent runtime modes are persisted on AIAgent in the next migration.
type EngineRegistry struct {
	engines map[string]Engine
}

func NewEngineRegistry(engines ...Engine) *EngineRegistry {
	registry := &EngineRegistry{engines: make(map[string]Engine, len(engines))}
	for _, engine := range engines {
		if engine == nil || strings.TrimSpace(engine.Code()) == "" {
			continue
		}
		registry.engines[strings.TrimSpace(engine.Code())] = engine
	}
	return registry
}

func NewDefaultEngineRegistry() *EngineRegistry {
	return NewEngineRegistry(NewWorkflowEngine(), NewAutonomousEngine(), NewHybridEngine())
}

func (r *EngineRegistry) Resolve(code string) (Engine, error) {
	if r == nil {
		return nil, errors.New("agent runtime engine registry is not configured")
	}
	code = strings.TrimSpace(code)
	if code == "" {
		code = EngineCodeWorkflow
	}
	engine := r.engines[code]
	if engine == nil {
		return nil, errorsx.InvalidParam("agent runtime engine does not exist")
	}
	return engine, nil
}

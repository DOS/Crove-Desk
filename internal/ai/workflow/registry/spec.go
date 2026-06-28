package registry

import "agent-desk/internal/ai/workflow/dsl"

type NodeRiskLevel string

const (
	NodeRiskLevelLow    NodeRiskLevel = "low"
	NodeRiskLevelMedium NodeRiskLevel = "medium"
	NodeRiskLevelHigh   NodeRiskLevel = "high"
)

type VariableType string

const (
	VariableTypeString       VariableType = "string"
	VariableTypeNumber       VariableType = "number"
	VariableTypeInteger      VariableType = "integer"
	VariableTypeBoolean      VariableType = "boolean"
	VariableTypeObject       VariableType = "object"
	VariableTypeStringArray  VariableType = "array<string>"
	VariableTypeIntegerArray VariableType = "array<int>"
	VariableTypeObjectArray  VariableType = "array<object>"
	VariableTypeAny          VariableType = "any"
)

type VariableSpec struct {
	Name         string                `json:"name"`
	Label        string                `json:"label,omitempty"`
	Type         VariableType          `json:"type"`
	Required     bool                  `json:"required,omitempty"`
	Description  string                `json:"description"`
	Operators    []string              `json:"operators,omitempty"`
	ValueOptions []VariableValueOption `json:"valueOptions,omitempty"`
}

type VariableValueOption struct {
	Value       any    `json:"value"`
	Label       string `json:"label"`
	Description string `json:"description,omitempty"`
}

type NodeSpec struct {
	Type                            string               `json:"type"`
	Title                           string               `json:"title"`
	Description                     string               `json:"description"`
	Icon                            string               `json:"icon"`
	RiskLevel                       NodeRiskLevel        `json:"riskLevel"`
	Interruptible                   bool                 `json:"interruptible"`
	RequiresConfirmationPredecessor bool                 `json:"requiresConfirmationPredecessor"`
	ConfigSchema                    any                  `json:"configSchema,omitempty"`
	InputSchema                     []VariableSpec       `json:"inputSchema,omitempty"`
	OutputSchema                    []VariableSpec       `json:"outputSchema,omitempty"`
	DefaultInputs                   map[string]dsl.Value `json:"defaultInputs,omitempty"`
}

type Registry struct {
	specsByType map[string]NodeSpec
	specs       []NodeSpec
}

func NewRegistry(specs ...NodeSpec) *Registry {
	ret := &Registry{
		specsByType: make(map[string]NodeSpec, len(specs)),
		specs:       make([]NodeSpec, 0, len(specs)),
	}
	for _, spec := range specs {
		if spec.Type == "" {
			continue
		}
		ret.specsByType[spec.Type] = spec
		ret.specs = append(ret.specs, spec)
	}
	return ret
}

func (r *Registry) Get(nodeType string) (NodeSpec, bool) {
	if r == nil {
		return NodeSpec{}, false
	}
	spec, ok := r.specsByType[nodeType]
	return spec, ok
}

func (r *Registry) List() []NodeSpec {
	if r == nil {
		return nil
	}
	return append([]NodeSpec(nil), r.specs...)
}

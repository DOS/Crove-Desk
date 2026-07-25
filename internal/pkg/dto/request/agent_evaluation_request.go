package request

type RunAgentEvaluationRequest struct {
	AIAgentID  int64                 `json:"aiAgentId"`
	EngineCode string                `json:"engineCode"`
	Cases      []AgentEvaluationCase `json:"cases"`
}

type AgentEvaluationCase struct {
	ID       string         `json:"id"`
	Category string         `json:"category"`
	Message  string         `json:"message"`
	History  []string       `json:"history,omitempty"`
	Expect   map[string]any `json:"expect,omitempty"`
}

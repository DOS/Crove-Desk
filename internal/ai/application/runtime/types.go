package runtime

import (
	"agent-desk/internal/models"
	"time"
)

// RunInput is the normalized, fully prepared input shared by all Engine
// implementations. Persistent adapters load this object before dispatching
// into the runtime.
type RunInput struct {
	Conversation models.Conversation
	UserMessage  models.Message
	AIAgent      models.AIAgent
	AIConfig     models.AIConfig
	CheckPointID string
	Debug        bool
}

// Request remains as a compatibility alias while callers move to RunInput.
type Request = RunInput

// ResumeInput extends the prepared input with an approved interrupt payload.
// It deliberately carries the same persisted context as RunInput so resume
// semantics are consistent across Workflow, Autonomous, and Hybrid engines.
type ResumeInput struct {
	Conversation models.Conversation
	UserMessage  models.Message
	AIAgent      models.AIAgent
	AIConfig     models.AIConfig
	CheckPointID string
	ResumeData   map[string]string
	Debug        bool
}

// ResumeRequest remains as a compatibility alias while callers move to ResumeInput.
type ResumeRequest = ResumeInput

type InterruptContextSummary struct {
	Type        string `json:"type,omitempty"`
	ID          string `json:"id"`
	InfoPreview string `json:"infoPreview,omitempty"`
}

// RunResult is the normalized result returned by every Engine. Engine-specific
// details are represented by optional fields rather than engine-specific DTOs.
type RunResult struct {
	RunID                 string
	Status                string
	ReplyText             string
	PlannedSkillID        int64
	PlannedSkillName      string
	PlanReason            string
	SkillRouteTrace       string
	SkillAllowedToolCodes []string
	ModelName             string
	PromptTokens          int
	CompletionTokens      int
	HistoryMessageCount   int
	RetrieverCount        int
	ToolCallCount         int
	ToolCodes             []string
	InvokedToolCodes      []string
	WorkflowID            int64
	WorkflowVersionID     int64
	WorkflowRunID         int64
	AgentRunID            int64
	WorkflowNodePath      []string
	CheckPointID          string
	CheckPointData        string
	Interrupted           bool
	HandoffRequested      bool
	Interrupts            []InterruptContextSummary
	TraceData             string
	ErrorMessage          string
}

// Summary remains as a compatibility alias while callers move to RunResult.
type Summary = RunResult

type StreamEventType string

const (
	StreamEventStarted   StreamEventType = "started"
	StreamEventStep      StreamEventType = "step"
	StreamEventOutput    StreamEventType = "output"
	StreamEventCompleted StreamEventType = "completed"
	StreamEventFailed    StreamEventType = "failed"
)

// StreamEvent is the transport-neutral event contract for future streaming
// endpoints. Engines may emit partial output, audit steps, or a terminal state
// without exposing engine-specific event payloads to callers.
type StreamEvent struct {
	Type       StreamEventType `json:"type"`
	RunID      string          `json:"runId,omitempty"`
	AgentRunID int64           `json:"agentRunId,omitempty"`
	StepCode   string          `json:"stepCode,omitempty"`
	Content    string          `json:"content,omitempty"`
	Error      string          `json:"error,omitempty"`
	OccurredAt time.Time       `json:"occurredAt"`
}

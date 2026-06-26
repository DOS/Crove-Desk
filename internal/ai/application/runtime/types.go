package runtime

import (
	"agent-desk/internal/models"
)

type Request struct {
	Conversation models.Conversation
	UserMessage  models.Message
	AIAgent      models.AIAgent
	AIConfig     models.AIConfig
	CheckPointID string
}

type ResumeRequest struct {
	Conversation models.Conversation
	UserMessage  models.Message
	AIAgent      models.AIAgent
	AIConfig     models.AIConfig
	CheckPointID string
	ResumeData   map[string]string
}

type InterruptContextSummary struct {
	Type        string `json:"type,omitempty"`
	ID          string `json:"id"`
	InfoPreview string `json:"infoPreview,omitempty"`
}

type Summary struct {
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
	WorkflowNodePath      []string
	CheckPointID          string
	CheckPointData        string
	Interrupted           bool
	Interrupts            []InterruptContextSummary
	TraceData             string
	ErrorMessage          string
}

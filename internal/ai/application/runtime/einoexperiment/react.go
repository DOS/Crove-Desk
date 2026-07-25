// Package einoexperiment contains an isolated Eino ReAct verification path.
// It must not be registered in the production Agent Engine registry.
package einoexperiment

import (
	"context"
	"fmt"
	"strings"
	"time"

	"agent-desk/internal/models"

	einoopenai "github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/flow/agent/react"
	"github.com/cloudwego/eino/schema"
)

// ReActConfig keeps the experiment dependency-injected. The caller owns model
// construction, connection reuse, and all production configuration decisions.
type ReActConfig struct {
	Model    model.ToolCallingChatModel
	Tools    []tool.BaseTool
	MaxSteps int
}

// NewOpenAICompatibleModel adapts an existing AgentDesk AI configuration to
// Eino's OpenAI-compatible chat model. It is intentionally not wired into any
// production Engine; the experiment owns the adoption decision.
func NewOpenAICompatibleModel(ctx context.Context, config models.AIConfig) (model.ToolCallingChatModel, error) {
	if strings.TrimSpace(config.APIKey) == "" || strings.TrimSpace(config.BaseURL) == "" || strings.TrimSpace(config.ModelName) == "" {
		return nil, fmt.Errorf("ai config base URL, API key, and model name are required")
	}
	modelConfig := &einoopenai.ChatModelConfig{
		APIKey:  strings.TrimSpace(config.APIKey),
		BaseURL: strings.TrimSpace(config.BaseURL),
		Model:   strings.TrimSpace(config.ModelName),
	}
	if config.TimeoutMS > 0 {
		modelConfig.Timeout = time.Duration(config.TimeoutMS) * time.Millisecond
	}
	if config.MaxOutputTokens > 0 {
		maxTokens := config.MaxOutputTokens
		modelConfig.MaxCompletionTokens = &maxTokens
	}
	return einoopenai.NewChatModel(ctx, modelConfig)
}

// NewReAct creates an Eino ReAct agent without registering it with AgentDesk's
// runtime. It is deliberately suitable only for technical verification.
func NewReAct(ctx context.Context, config ReActConfig) (*react.Agent, error) {
	if config.Model == nil {
		return nil, fmt.Errorf("eino experiment model is required")
	}
	maxSteps := config.MaxSteps
	if maxSteps <= 0 {
		maxSteps = 5
	}
	return react.NewAgent(ctx, &react.AgentConfig{
		ToolCallingModel: config.Model,
		ToolsConfig:      compose.ToolsNodeConfig{Tools: config.Tools},
		MaxStep:          maxSteps,
	})
}

// Run performs one non-streaming experiment. Context cancellation is passed
// directly to Eino and the injected model/tools.
func Run(ctx context.Context, config ReActConfig, input []*schema.Message) (*schema.Message, error) {
	agent, err := NewReAct(ctx, config)
	if err != nil {
		return nil, err
	}
	return agent.Generate(ctx, input)
}

// Stream performs one streaming experiment. The caller must close the returned
// reader after consuming it.
func Stream(ctx context.Context, config ReActConfig, input []*schema.Message) (*schema.StreamReader[*schema.Message], error) {
	agent, err := NewReAct(ctx, config)
	if err != nil {
		return nil, err
	}
	return agent.Stream(ctx, input)
}

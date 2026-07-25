package einoexperiment

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"agent-desk/internal/bootstrap"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/config"
	"agent-desk/internal/pkg/enums"

	einoopenai "github.com/cloudwego/eino-ext/components/model/openai"
	einomodel "github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

// TestRealOpenAICompatibleEndpoint is intentionally opt-in because it spends
// a small amount of configured model quota. It verifies the production-shaped
// OpenAI-compatible adapter without exposing credentials in test output.
func TestRealOpenAICompatibleEndpoint(t *testing.T) {
	if os.Getenv("EINO_EXPERIMENT_REAL") != "1" {
		t.Skip("set EINO_EXPERIMENT_REAL=1 to run against the configured endpoint")
	}
	configPath := strings.TrimSpace(os.Getenv("EINO_EXPERIMENT_CONFIG"))
	var err error
	if configPath == "" {
		configPath, err = findExperimentConfigPath()
		if err != nil {
			t.Fatal(err)
		}
	}
	workingDir, err := os.Getwd()
	if err != nil {
		t.Fatalf("get working directory: %v", err)
	}
	repoRoot := filepath.Dir(filepath.Dir(configPath))
	if err := os.Chdir(repoRoot); err != nil {
		t.Fatalf("change to config root: %v", err)
	}
	t.Cleanup(func() { _ = os.Chdir(workingDir) })
	cfg, err := config.Load(configPath)
	if err != nil {
		t.Fatalf("load config: %v", err)
	}
	db, err := bootstrap.InitDB(cfg.DB)
	if err != nil {
		t.Fatalf("open configured database: %v", err)
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}
	var aiConfig models.AIConfig
	if err := db.Where("model_type = ? AND status = ?", enums.AIModelTypeLLM, enums.StatusOk).Order("id").First(&aiConfig).Error; err != nil {
		t.Fatalf("load enabled LLM config: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(maxInt(aiConfig.TimeoutMS, 30000))*time.Millisecond)
	defer cancel()
	model, err := NewOpenAICompatibleModel(ctx, aiConfig)
	if err != nil {
		t.Fatalf("create Eino model adapter: %v", err)
	}
	input := []*schema.Message{schema.SystemMessage("You are a terse service assistant."), schema.UserMessage("Reply with exactly: OK")}
	startedAt := time.Now()
	result, err := Run(ctx, ReActConfig{Model: model, MaxSteps: 2}, input)
	if err != nil {
		t.Fatalf("Eino ReAct request: %v", err)
	}
	if result == nil || strings.TrimSpace(result.Content) == "" {
		t.Fatal("Eino endpoint returned an empty response")
	}
	if result.ResponseMeta == nil || result.ResponseMeta.Usage == nil {
		t.Fatal("Eino endpoint did not return token usage")
	}
	t.Logf("real endpoint verified: latency=%s promptTokens=%d completionTokens=%d", time.Since(startedAt).Round(time.Millisecond), result.ResponseMeta.Usage.PromptTokens, result.ResponseMeta.Usage.CompletionTokens)

	toolModel, err := model.WithTools([]*schema.ToolInfo{{
		Name: "eino_echo",
		Desc: "Echoes a short input. Always call this tool when asked to verify tool calling.",
		ParamsOneOf: schema.NewParamsOneOfByParams(map[string]*schema.ParameterInfo{
			"text": {Type: schema.String, Desc: "Short text to echo", Required: true},
		}),
	}})
	if err != nil {
		t.Fatalf("bind Eino tool: %v", err)
	}
	toolResult, err := toolModel.Generate(ctx, []*schema.Message{schema.UserMessage("Verify tool calling by invoking eino_echo with text OK.")},
		einomodel.WithToolChoice(schema.ToolChoiceForced, "eino_echo"),
		einoopenai.WithExtraFields(map[string]any{"enable_thinking": false}),
	)
	if err != nil {
		t.Fatalf("real endpoint tool call: %v", err)
	}
	if toolResult == nil || len(toolResult.ToolCalls) != 1 || toolResult.ToolCalls[0].Function.Name != "eino_echo" {
		t.Fatalf("expected one eino_echo tool call, got %#v", toolResult)
	}

	stream, err := model.Stream(ctx, []*schema.Message{schema.UserMessage("Reply with exactly: STREAM_OK")})
	if err != nil {
		t.Fatalf("real endpoint stream: %v", err)
	}
	// ConcatMessageStream consumes and closes the Eino reader. Do not close it
	// again here: v0.9.6 treats a second close as a panic.
	streamResult, err := schema.ConcatMessageStream(stream)
	if err != nil {
		t.Fatalf("concat real stream: %v", err)
	}
	if streamResult == nil || strings.TrimSpace(streamResult.Content) == "" {
		t.Fatal("Eino endpoint stream returned an empty response")
	}
	t.Logf("real endpoint tool and stream verified: toolCalls=%d streamChars=%d", len(toolResult.ToolCalls), len([]rune(streamResult.Content)))
}

func findExperimentConfigPath() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		candidate := filepath.Join(dir, "config", "config.yaml")
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", os.ErrNotExist
		}
		dir = parent
	}
}

func maxInt(value, fallback int) int {
	if value > 0 {
		return value
	}
	return fallback
}

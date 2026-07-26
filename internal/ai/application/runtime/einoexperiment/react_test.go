package einoexperiment

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	applicationruntime "agent-desk/internal/ai/application/runtime"
	"agent-desk/internal/ai/mcps"
	"agent-desk/internal/ai/runtime/graphs"
	aitooling "agent-desk/internal/ai/tooling"
	"agent-desk/internal/models"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/schema"
)

type scriptedToolCallingModel struct {
	responses []*schema.Message
	calls     int
	err       error
	block     bool
	lastInput []*schema.Message
}

type fakeMCPToolExecutor struct {
	toolCode  string
	arguments map[string]any
	policy    aitooling.Policy
	result    *mcps.ToolCallResult
	err       error
}

type concurrentToolCallingModel struct {
	calls atomic.Int32
}

var _ model.ToolCallingChatModel = (*concurrentToolCallingModel)(nil)

func (m *concurrentToolCallingModel) Generate(ctx context.Context, _ []*schema.Message, _ ...model.Option) (*schema.Message, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	m.calls.Add(1)
	return schema.AssistantMessage("并发调用完成。", nil), nil
}

func (m *concurrentToolCallingModel) Stream(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	message, err := m.Generate(ctx, input, opts...)
	if err != nil {
		return nil, err
	}
	return schema.StreamReaderFromArray([]*schema.Message{message}), nil
}

func (m *concurrentToolCallingModel) WithTools(_ []*schema.ToolInfo) (model.ToolCallingChatModel, error) {
	return m, nil
}

func (e *fakeMCPToolExecutor) Execute(_ context.Context, toolCode string, arguments map[string]any, policy aitooling.Policy) (aitooling.Definition, *mcps.ToolCallResult, error) {
	e.toolCode = toolCode
	e.arguments = arguments
	e.policy = policy
	return aitooling.Definition{Code: toolCode, RiskLevel: aitooling.RiskLevelRead}, e.result, e.err
}

var _ model.ToolCallingChatModel = (*scriptedToolCallingModel)(nil)

func (m *scriptedToolCallingModel) Generate(ctx context.Context, input []*schema.Message, _ ...model.Option) (*schema.Message, error) {
	m.lastInput = append([]*schema.Message(nil), input...)
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if m.block {
		<-ctx.Done()
		return nil, ctx.Err()
	}
	if m.err != nil {
		return nil, m.err
	}
	if m.calls >= len(m.responses) {
		return nil, errors.New("unexpected model call")
	}
	result := m.responses[m.calls]
	m.calls++
	return result, nil
}

func (m *scriptedToolCallingModel) Stream(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	message, err := m.Generate(ctx, input, opts...)
	if err != nil {
		return nil, err
	}
	return schema.StreamReaderFromArray([]*schema.Message{message}), nil
}

func (m *scriptedToolCallingModel) WithTools(_ []*schema.ToolInfo) (model.ToolCallingChatModel, error) {
	return m, nil
}

func TestRunExecutesGuardedToolThenReturnsFinalAnswer(t *testing.T) {
	called := false
	guardedTool := &GuardedTool{
		InfoDefinition: &schema.ToolInfo{Name: "customer_lookup", Desc: "Read customer data"},
		Definition:     aitooling.Definition{Code: "builtin/customer_lookup", RiskLevel: aitooling.RiskLevelRead},
		Policy:         aitooling.Policy{AllowedToolCodes: []string{"builtin/customer_lookup"}},
		Handler: func(_ context.Context, arguments map[string]any) (string, error) {
			called = arguments["customerId"] == "42"
			return "customer: Ada", nil
		},
	}
	model := &scriptedToolCallingModel{responses: []*schema.Message{
		schema.AssistantMessage("", []schema.ToolCall{{ID: "call-1", Type: "function", Function: schema.FunctionCall{Name: "customer_lookup", Arguments: `{"customerId":"42"}`}}}),
		schema.AssistantMessage("已找到客户资料。", nil),
	}}

	result, err := Run(context.Background(), ReActConfig{Model: model, Tools: []tool.BaseTool{guardedTool}, MaxSteps: 4}, []*schema.Message{schema.UserMessage("查询客户")})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if !called || result == nil || result.Content != "已找到客户资料。" || model.calls != 2 {
		t.Fatalf("unexpected ReAct result: called=%t result=%#v modelCalls=%d", called, result, model.calls)
	}
}

func TestRunInjectsProvidedConversationContext(t *testing.T) {
	model := &scriptedToolCallingModel{responses: []*schema.Message{schema.AssistantMessage("已理解上下文。", nil)}}
	input := []*schema.Message{
		schema.SystemMessage("你是客服助手，优先引用知识库。"),
		schema.UserMessage("我的订单状态如何？"),
	}
	if _, err := Run(context.Background(), ReActConfig{Model: model}, input); err != nil {
		t.Fatalf("Run: %v", err)
	}
	if len(model.lastInput) != len(input) || model.lastInput[0].Content != input[0].Content || model.lastInput[1].Content != input[1].Content {
		t.Fatalf("conversation context was not passed to model: %#v", model.lastInput)
	}
}

func TestNewOpenAICompatibleModelValidatesExistingAIConfig(t *testing.T) {
	if _, err := NewOpenAICompatibleModel(context.Background(), models.AIConfig{}); err == nil {
		t.Fatal("expected incomplete AI config error")
	}
	configured, err := NewOpenAICompatibleModel(context.Background(), models.AIConfig{
		BaseURL: "https://api.example.test/v1", APIKey: "test-key", ModelName: "test-model", TimeoutMS: 1200, MaxOutputTokens: 256,
	})
	if err != nil || configured == nil {
		t.Fatalf("expected OpenAI-compatible model adapter, model=%#v err=%v", configured, err)
	}
}

func TestGuardedToolRejectsDisallowedPolicyBeforeHandler(t *testing.T) {
	called := false
	guardedTool := &GuardedTool{
		InfoDefinition: &schema.ToolInfo{Name: "restricted_lookup", Desc: "Read restricted data"},
		Definition:     aitooling.Definition{Code: "builtin/restricted_lookup", RiskLevel: aitooling.RiskLevelRead},
		Policy:         aitooling.Policy{AllowedToolCodes: []string{"builtin/customer_lookup"}},
		Handler: func(context.Context, map[string]any) (string, error) {
			called = true
			return "unexpected", nil
		},
	}
	if _, err := guardedTool.InvokableRun(context.Background(), `{}`); err == nil {
		t.Fatal("expected policy rejection")
	}
	if called {
		t.Fatal("handler must not run after policy rejection")
	}
}

func TestRunPropagatesCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	model := &scriptedToolCallingModel{responses: []*schema.Message{schema.AssistantMessage("unused", nil)}}
	if _, err := Run(ctx, ReActConfig{Model: model}, []*schema.Message{schema.UserMessage("查询")}); !errors.Is(err, context.Canceled) {
		t.Fatalf("expected cancellation, got %v", err)
	}
}

func TestRunPropagatesDeadlineDuringModelCall(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	model := &scriptedToolCallingModel{block: true}
	if _, err := Run(ctx, ReActConfig{Model: model}, []*schema.Message{schema.UserMessage("查询")}); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected deadline propagation, got %v", err)
	}
}

func TestRunPropagatesModelFailure(t *testing.T) {
	modelErr := errors.New("model unavailable")
	model := &scriptedToolCallingModel{err: modelErr}
	if _, err := Run(context.Background(), ReActConfig{Model: model}, []*schema.Message{schema.UserMessage("查询")}); !errors.Is(err, modelErr) {
		t.Fatalf("expected model error propagation, got %v", err)
	}
}

func TestRunPropagatesToolFailure(t *testing.T) {
	toolErr := errors.New("customer service unavailable")
	guardedTool := &GuardedTool{
		InfoDefinition: &schema.ToolInfo{Name: "failing_lookup", Desc: "Read customer data"},
		Definition:     aitooling.Definition{Code: "builtin/failing_lookup", RiskLevel: aitooling.RiskLevelRead},
		Policy:         aitooling.Policy{AllowedToolCodes: []string{"builtin/failing_lookup"}},
		Handler: func(context.Context, map[string]any) (string, error) {
			return "", toolErr
		},
	}
	model := &scriptedToolCallingModel{responses: []*schema.Message{
		schema.AssistantMessage("", []schema.ToolCall{{ID: "call-1", Type: "function", Function: schema.FunctionCall{Name: "failing_lookup", Arguments: `{}`}}}),
	}}
	if _, err := Run(context.Background(), ReActConfig{Model: model, Tools: []tool.BaseTool{guardedTool}}, []*schema.Message{schema.UserMessage("查询")}); !errors.Is(err, toolErr) {
		t.Fatalf("expected tool error propagation, got %v", err)
	}
}

func TestGuardedToolEnforcesTimeout(t *testing.T) {
	guardedTool := &GuardedTool{
		InfoDefinition: &schema.ToolInfo{Name: "slow_lookup", Desc: "Read customer data"},
		Definition:     aitooling.Definition{Code: "builtin/slow_lookup", RiskLevel: aitooling.RiskLevelRead, TimeoutMS: 20},
		Policy:         aitooling.Policy{AllowedToolCodes: []string{"builtin/slow_lookup"}},
		Handler: func(ctx context.Context, _ map[string]any) (string, error) {
			<-ctx.Done()
			return "", ctx.Err()
		},
	}
	if _, err := guardedTool.InvokableRun(context.Background(), `{}`); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected tool timeout, got %v", err)
	}
}

func TestGuardedToolEmitsTraceForPolicyFailure(t *testing.T) {
	var trace ToolTrace
	guardedTool := &GuardedTool{
		InfoDefinition: &schema.ToolInfo{Name: "restricted_lookup", Desc: "Read restricted data"},
		Definition:     aitooling.Definition{Code: "builtin/restricted_lookup", RiskLevel: aitooling.RiskLevelRead},
		Policy:         aitooling.Policy{AllowedToolCodes: []string{"builtin/other_lookup"}},
		Handler: func(context.Context, map[string]any) (string, error) {
			return "unexpected", nil
		},
		Trace: func(item ToolTrace) { trace = item },
	}
	if _, err := guardedTool.InvokableRun(context.Background(), `{"customerId":"42"}`); err == nil {
		t.Fatal("expected policy rejection")
	}
	if trace.ToolCode != "builtin/restricted_lookup" || trace.Status != "failed" || trace.Err == nil || trace.Arguments["customerId"] != "42" || trace.Duration < 0 {
		t.Fatalf("unexpected trace: %#v", trace)
	}
}

func TestMCPToolHandlerUsesSharedExecutorAndReducesResult(t *testing.T) {
	executor := &fakeMCPToolExecutor{result: &mcps.ToolCallResult{Content: []mcps.ToolResultContent{{Type: "text", Text: "customer: Ada"}}}}
	policy := aitooling.Policy{AllowedToolCodes: []string{"crm/customer_lookup"}, Confirmed: true}
	handler := NewMCPToolHandler(executor, "crm/customer_lookup", policy)
	result, err := handler(context.Background(), map[string]any{"customerId": "42"})
	if err != nil || result != "customer: Ada" {
		t.Fatalf("unexpected MCP handler result=%q err=%v", result, err)
	}
	if executor.toolCode != "crm/customer_lookup" || executor.arguments["customerId"] != "42" || !executor.policy.Confirmed {
		t.Fatalf("unexpected MCP execution: %#v", executor)
	}
}

func TestRunStopsAtConfiguredMaxSteps(t *testing.T) {
	guardedTool := &GuardedTool{
		InfoDefinition: &schema.ToolInfo{Name: "loop_lookup", Desc: "Read loop data"},
		Definition:     aitooling.Definition{Code: "builtin/loop_lookup", RiskLevel: aitooling.RiskLevelRead},
		Policy:         aitooling.Policy{AllowedToolCodes: []string{"builtin/loop_lookup"}},
		Handler: func(context.Context, map[string]any) (string, error) {
			return "keep going", nil
		},
	}
	responses := make([]*schema.Message, 8)
	for i := range responses {
		responses[i] = schema.AssistantMessage("", []schema.ToolCall{{
			ID: "loop-call", Type: "function", Function: schema.FunctionCall{Name: "loop_lookup", Arguments: `{}`},
		}})
	}
	model := &scriptedToolCallingModel{responses: responses}
	if _, err := Run(context.Background(), ReActConfig{Model: model, Tools: []tool.BaseTool{guardedTool}, MaxSteps: 2}, []*schema.Message{schema.UserMessage("循环查询")}); err == nil {
		t.Fatal("expected configured maximum step limit to stop the loop")
	}
}

func TestStreamReturnsModelOutput(t *testing.T) {
	model := &scriptedToolCallingModel{responses: []*schema.Message{schema.AssistantMessage("流式回复", nil)}}
	stream, err := Stream(context.Background(), ReActConfig{Model: model}, []*schema.Message{schema.UserMessage("查询")})
	if err != nil {
		t.Fatalf("Stream: %v", err)
	}
	defer stream.Close()
	result, err := schema.ConcatMessageStream(stream)
	if err != nil {
		t.Fatalf("ConcatMessageStream: %v", err)
	}
	if result.Content != "流式回复" {
		t.Fatalf("unexpected stream result: %#v", result)
	}
}

func TestStreamPropagatesCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	model := &scriptedToolCallingModel{responses: []*schema.Message{schema.AssistantMessage("unused", nil)}}
	if _, err := Stream(ctx, ReActConfig{Model: model}, []*schema.Message{schema.UserMessage("查询")}); !errors.Is(err, context.Canceled) {
		t.Fatalf("expected stream cancellation, got %v", err)
	}
}

func TestRunSupportsConcurrentIndependentCalls(t *testing.T) {
	model := &concurrentToolCallingModel{}
	const workers = 16
	errs := make(chan error, workers)
	var group sync.WaitGroup
	for range workers {
		group.Add(1)
		go func() {
			defer group.Done()
			result, err := Run(context.Background(), ReActConfig{Model: model, MaxSteps: 3}, []*schema.Message{schema.UserMessage("并发查询")})
			if err != nil {
				errs <- err
				return
			}
			if result == nil || result.Content != "并发调用完成。" {
				errs <- errors.New("unexpected concurrent result")
			}
		}()
	}
	group.Wait()
	close(errs)
	for err := range errs {
		t.Fatal(err)
	}
	if model.calls.Load() != workers {
		t.Fatalf("model calls = %d, want %d", model.calls.Load(), workers)
	}
}

func TestConfirmationBridgeUsesGenericInterruptAndResumeContracts(t *testing.T) {
	input := applicationruntime.RunInput{
		Conversation: models.Conversation{ID: 11}, UserMessage: models.Message{ID: 22},
	}
	result, err := BuildConfirmationResult(input, ConfirmationRequest{
		InterruptID: "confirm_refund", ToolCode: "graph/create_ticket_with_confirmation", Prompt: "是否确认提交退款工单？",
		Arguments: map[string]any{"title": "退款申请"},
	})
	if err != nil {
		t.Fatalf("BuildConfirmationResult: %v", err)
	}
	if !result.Interrupted || result.Status != "interrupted" || result.CheckPointID == "" || len(result.Interrupts) != 1 || result.Interrupts[0].Type != confirmationInterruptType || result.Interrupts[0].ID != "confirm_refund" {
		t.Fatalf("unexpected confirmation result: %#v", result)
	}
	decision, checkpoint, err := ResumeConfirmation(result.CheckPointData, applicationruntime.ResumeInput{ResumeData: map[string]string{"confirm_refund": "确认"}})
	if err != nil || decision != string(graphs.ConfirmationDecisionConfirm) || checkpoint.ToolCode != "graph/create_ticket_with_confirmation" || checkpoint.Arguments["title"] != "退款申请" {
		t.Fatalf("unexpected resume bridge decision=%q checkpoint=%#v err=%v", decision, checkpoint, err)
	}
	decision, _, err = ResumeConfirmation(result.CheckPointData, applicationruntime.ResumeInput{ResumeData: map[string]string{"confirm_refund": "取消"}})
	if err != nil || decision != string(graphs.ConfirmationDecisionCancel) {
		t.Fatalf("unexpected cancellation decision=%q err=%v", decision, err)
	}
}

func BenchmarkRunWithInjectedModel(b *testing.B) {
	model := &concurrentToolCallingModel{}
	input := []*schema.Message{schema.SystemMessage("你是客服助手。"), schema.UserMessage("查询订单状态")}
	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		result, err := Run(context.Background(), ReActConfig{Model: model, MaxSteps: 3}, input)
		if err != nil || result == nil || result.Content == "" {
			b.Fatalf("Run result=%#v err=%v", result, err)
		}
	}
}

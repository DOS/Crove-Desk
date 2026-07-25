package runtime

import (
	"context"
	"strings"
	"testing"

	"agent-desk/internal/models"
)

func TestOfflineEvaluationRunnerUsesDebugIsolationAndExportsCSV(t *testing.T) {
	var received []RunInput
	runner := NewOfflineEvaluationRunner(func(_ context.Context, input RunInput) (*RunResult, error) {
		received = append(received, input)
		return &RunResult{ReplyText: "已根据知识库回答。"}, nil
	})
	report := runner.Run(context.Background(), "autonomous", models.AIAgent{ID: 12}, models.AIConfig{ID: 13}, []OfflineEvaluationCase{{ID: "faq", Category: "faq", Message: "保修期多久", History: []string{"客户：你好"}}})
	if report.Total != 1 || report.Passed != 1 || len(received) != 1 || !received[0].Debug || received[0].Conversation.ID != 0 || received[0].UserMessage.RequestID != "offline-eval:faq" {
		t.Fatalf("unexpected report or input: report=%#v input=%#v", report, received)
	}
	csv, err := report.CSV()
	if err != nil || !strings.Contains(csv, "caseId,category,engineCode") || !strings.Contains(csv, "faq,faq,autonomous,true") {
		t.Fatalf("unexpected csv=%q err=%v", csv, err)
	}
}

func TestOfflineEvaluationRunnerChecksConfirmationExpectation(t *testing.T) {
	runner := NewOfflineEvaluationRunner(func(context.Context, RunInput) (*RunResult, error) {
		return &RunResult{ReplyText: "已转人工"}, nil
	})
	report := runner.Run(context.Background(), "workflow", models.AIAgent{}, models.AIConfig{}, []OfflineEvaluationCase{{ID: "handoff", Expect: map[string]any{"requiresConfirmation": true}}})
	if report.Passed != 0 || report.Results[0].Finding != "confirmation_not_reached" {
		t.Fatalf("unexpected report: %#v", report)
	}
}

func TestOfflineEvaluationRunnerChecksWriteToolLimit(t *testing.T) {
	runner := NewOfflineEvaluationRunner(func(context.Context, RunInput) (*RunResult, error) {
		return &RunResult{ReplyText: "调试回复", InvokedToolCodes: []string{"graph/handoff_to_human"}}, nil
	})
	report := runner.Run(context.Background(), "hybrid", models.AIAgent{}, models.AIConfig{}, []OfflineEvaluationCase{{ID: "write", Expect: map[string]any{"maxWriteToolCalls": 0}}})
	if report.Passed != 0 || report.Results[0].Finding != "write_tool_limit_exceeded" {
		t.Fatalf("unexpected report: %#v", report)
	}
}

func TestServiceRunsOfflineEvaluationWithExplicitEngine(t *testing.T) {
	engine := &runtimeTestEngine{code: "evaluation"}
	service := NewServiceWithRegistry(NewEngineRegistry(engine))
	report, err := service.RunOfflineEvaluation(context.Background(), "evaluation", models.AIAgent{RuntimeMode: "workflow"}, models.AIConfig{}, []OfflineEvaluationCase{{ID: "case"}})
	if err != nil || !engine.ran || report.EngineCode != "evaluation" || report.Total != 1 {
		t.Fatalf("unexpected evaluation report=%#v engine=%#v err=%v", report, engine, err)
	}
}

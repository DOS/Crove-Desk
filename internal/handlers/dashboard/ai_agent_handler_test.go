package dashboard

import (
	"testing"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

func TestBuildAIAgentResponseExposesWorkflowPublishState(t *testing.T) {
	setupAIAgentHandlerTestDB(t)

	draft := buildAIAgentResponse(&models.AIAgent{})
	if draft.RuntimeMode != enums.AIAgentRuntimeModeWorkflow {
		t.Fatalf("draft.RuntimeMode = %q, want %q", draft.RuntimeMode, enums.AIAgentRuntimeModeWorkflow)
	}
	if draft.WorkflowPublished {
		t.Fatalf("draft.WorkflowPublished = true, want false")
	}
	if draft.WorkflowState != "draft" {
		t.Fatalf("draft.WorkflowState = %q, want draft", draft.WorkflowState)
	}
	if draft.WorkflowStateText == "" {
		t.Fatalf("expected draft workflow state text")
	}

	published := buildAIAgentResponse(&models.AIAgent{WorkflowVersionID: 12})
	if !published.WorkflowPublished {
		t.Fatalf("published.WorkflowPublished = false, want true")
	}
	if published.WorkflowState != "published" {
		t.Fatalf("published.WorkflowState = %q, want published", published.WorkflowState)
	}
	if published.WorkflowStateText == "" {
		t.Fatalf("expected published workflow state text")
	}

	rollout := buildAIAgentResponse(&models.AIAgent{RolloutPercent: 20, PreviousRolloutPercent: 100})
	if rollout.RolloutPercent != 20 || rollout.PreviousRolloutPercent != 100 {
		t.Fatalf("unexpected rollout response: %#v", rollout)
	}
}

func setupAIAgentHandlerTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sqlite db: %v", err)
	}
	t.Cleanup(func() {
		if err := sqlDB.Close(); err != nil {
			t.Fatalf("close sqlite db: %v", err)
		}
	})
	if err := db.AutoMigrate(
		&models.AIConfig{},
		&models.AgentTeam{},
		&models.KnowledgeBase{},
		&models.SkillDefinition{},
	); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
}

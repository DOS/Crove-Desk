package services

import (
	"encoding/json"
	"strings"
	"testing"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

func TestAgentRevisionServiceRestoresPublishedSnapshotAndKeepsAPIKey(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.AgentRevision{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
	definition := agentRevisionDefinition{
		Agent: agentRevisionAgent{
			Name: "published agent", AIConfigID: 8,
			MaxSteps: 5, ContextWindow: 9, SystemPrompt: "published instruction", KnowledgeIDs: "4", ReplyTimeoutSeconds: 90,
		},
		Model: agentRevisionModel{ConfigID: 8, Provider: string(enums.AIProviderOpenAI), BaseURL: "https://published.example/v1", ModelType: string(enums.AIModelTypeLLM), ModelName: "published-model", TimeoutMS: 12000},
	}
	data, err := json.Marshal(definition)
	if err != nil {
		t.Fatalf("marshal definition: %v", err)
	}
	revision := &models.AgentRevision{AgentID: 7, Revision: 1, Status: enums.StatusOk, Definition: string(data)}
	if err := db.Create(revision).Error; err != nil {
		t.Fatalf("create revision: %v", err)
	}
	snapshot, err := AgentRevisionService.ResolvePublishedSnapshot(models.AIAgent{ID: 7, PublishedRevisionID: revision.ID, SystemPrompt: "draft instruction"}, models.AIConfig{ID: 8, APIKey: "rotated-secret", ModelName: "draft-model"})
	if err != nil {
		t.Fatalf("ResolvePublishedSnapshot: %v", err)
	}
	if snapshot.Agent.SystemPrompt != "published instruction" || snapshot.Agent.MaxSteps != 5 || snapshot.Agent.ReplyTimeoutSeconds != 90 {
		t.Fatalf("agent snapshot not restored: %#v", snapshot.Agent)
	}
	if snapshot.AIConfig.ModelName != "published-model" || snapshot.AIConfig.BaseURL != "https://published.example/v1" || snapshot.AIConfig.APIKey != "rotated-secret" {
		t.Fatalf("model snapshot not restored safely: %#v", snapshot.AIConfig)
	}
}

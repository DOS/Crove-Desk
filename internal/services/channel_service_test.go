package services

import (
	"strings"
	"testing"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/enums"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestChannelServiceRejectsAgentWithoutPublishedWorkflow(t *testing.T) {
	db := setupChannelServiceTestDB(t)
	agent := createChannelServiceTestAgent(t, db, 0)

	_, err := ChannelService.CreateChannel(request.CreateChannelRequest{
		ChannelType: enums.ChannelTypeWeb,
		AIAgentID:   agent.ID,
		Name:        "官网客服",
		Status:      int(enums.StatusOk),
	}, channelServiceTestOperator())
	if err == nil {
		t.Fatalf("expected channel creation to reject unpublished ai agent")
	}
}

func TestChannelServiceAllowsAgentWithPublishedWorkflow(t *testing.T) {
	db := setupChannelServiceTestDB(t)
	agent := createChannelServiceTestAgent(t, db, 1001)

	item, err := ChannelService.CreateChannel(request.CreateChannelRequest{
		ChannelType: enums.ChannelTypeWeb,
		AIAgentID:   agent.ID,
		Name:        "官网客服",
		Status:      int(enums.StatusOk),
	}, channelServiceTestOperator())
	if err != nil {
		t.Fatalf("create channel: %v", err)
	}
	if item == nil || item.AIAgentID != agent.ID {
		t.Fatalf("unexpected channel: %#v", item)
	}
}

func TestChannelServiceStoresAIAgentRolloutPercent(t *testing.T) {
	db := setupChannelServiceTestDB(t)
	agent := createChannelServiceTestAgent(t, db, 1001)
	item, err := ChannelService.CreateChannel(request.CreateChannelRequest{
		ChannelType: enums.ChannelTypeWeb, AIAgentID: agent.ID, AIAgentRolloutPercent: 25,
		Name: "灰度渠道", Status: int(enums.StatusOk),
	}, channelServiceTestOperator())
	if err != nil || item == nil || item.AIAgentRolloutPercent != 25 {
		t.Fatalf("expected persisted rollout percent, item=%#v err=%v", item, err)
	}
	if _, err := ChannelService.CreateChannel(request.CreateChannelRequest{
		ChannelType: enums.ChannelTypeWeb, AIAgentID: agent.ID, AIAgentRolloutPercent: 101,
		Name: "错误灰度渠道", Status: int(enums.StatusOk),
	}, channelServiceTestOperator()); err == nil {
		t.Fatal("expected invalid rollout percent to be rejected")
	}
}

func TestChannelServiceRollsBackPreviousAIAgentRolloutPercent(t *testing.T) {
	db := setupChannelServiceTestDB(t)
	agent := createChannelServiceTestAgent(t, db, 1001)
	channel, err := ChannelService.CreateChannel(request.CreateChannelRequest{
		ChannelType: enums.ChannelTypeWeb, AIAgentID: agent.ID, AIAgentRolloutPercent: 20,
		Name: "渠道灰度回滚", Status: int(enums.StatusOk),
	}, channelServiceTestOperator())
	if err != nil {
		t.Fatalf("create channel: %v", err)
	}
	if err := db.Model(&models.Channel{}).Where("id = ?", channel.ID).Update("previous_ai_agent_rollout_percent", 100).Error; err != nil {
		t.Fatalf("set previous rollout: %v", err)
	}
	operator := channelServiceTestOperator()
	if err := ChannelService.RollbackChannelAIAgentRollout(channel.ID, operator); err != nil {
		t.Fatalf("RollbackChannelAIAgentRollout: %v", err)
	}
	updated := ChannelService.Get(channel.ID)
	if updated == nil || updated.AIAgentRolloutPercent != 100 || updated.PreviousAIAgentRolloutPercent != 20 {
		t.Fatalf("unexpected channel rollout rollback: %#v", updated)
	}
	if err := ChannelService.RollbackChannelAIAgentRollout(channel.ID, operator); err != nil {
		t.Fatalf("second RollbackChannelAIAgentRollout: %v", err)
	}
	updated = ChannelService.Get(channel.ID)
	if updated == nil || updated.AIAgentRolloutPercent != 20 || updated.PreviousAIAgentRolloutPercent != 100 {
		t.Fatalf("unexpected channel rollout redo: %#v", updated)
	}
}

func TestChannelServiceRejectsUnpublishedAutonomousRuntime(t *testing.T) {
	db := setupChannelServiceTestDB(t)
	agent := createChannelServiceTestAgent(t, db, 1001)
	if err := db.Model(&models.AIAgent{}).Where("id = ?", agent.ID).Update("runtime_mode", enums.AIAgentRuntimeModeAutonomous).Error; err != nil {
		t.Fatalf("set autonomous runtime mode: %v", err)
	}

	_, err := ChannelService.CreateChannel(request.CreateChannelRequest{
		ChannelType: enums.ChannelTypeWeb,
		AIAgentID:   agent.ID,
		Name:        "官网客服",
		Status:      int(enums.StatusOk),
	}, channelServiceTestOperator())
	if err == nil || !strings.Contains(err.Error(), "must be published") {
		t.Fatalf("expected unpublished autonomous runtime error, got %v", err)
	}
}

func TestChannelServiceAcceptsPublishedAutonomousRuntime(t *testing.T) {
	db := setupChannelServiceTestDB(t)
	agent := createChannelServiceTestAgent(t, db, 1001)
	revision := &models.AgentRevision{AgentID: agent.ID, Revision: 1, Status: enums.StatusOk}
	if err := db.Create(revision).Error; err != nil {
		t.Fatalf("create agent revision: %v", err)
	}
	if err := db.Model(&models.AIAgent{}).Where("id = ?", agent.ID).Updates(map[string]any{
		"runtime_mode":          enums.AIAgentRuntimeModeAutonomous,
		"published_revision_id": revision.ID,
	}).Error; err != nil {
		t.Fatalf("set autonomous runtime mode: %v", err)
	}
	item, err := ChannelService.CreateChannel(request.CreateChannelRequest{
		ChannelType: enums.ChannelTypeWeb, AIAgentID: agent.ID, Name: "自主客服", Status: int(enums.StatusOk),
	}, channelServiceTestOperator())
	if err != nil || item == nil {
		t.Fatalf("create channel for autonomous runtime: item=%#v err=%v", item, err)
	}
}

func TestChannelServiceRequiresBothHybridPublicationArtifacts(t *testing.T) {
	db := setupChannelServiceTestDB(t)
	agent := createChannelServiceTestAgent(t, db, 0)
	revision := &models.AgentRevision{AgentID: agent.ID, Revision: 1, Status: enums.StatusOk}
	if err := db.Create(revision).Error; err != nil {
		t.Fatalf("create agent revision: %v", err)
	}
	if err := db.Model(&models.AIAgent{}).Where("id = ?", agent.ID).Updates(map[string]any{
		"runtime_mode":          enums.AIAgentRuntimeModeHybrid,
		"published_revision_id": revision.ID,
	}).Error; err != nil {
		t.Fatalf("set hybrid runtime mode: %v", err)
	}
	_, err := ChannelService.CreateChannel(request.CreateChannelRequest{
		ChannelType: enums.ChannelTypeWeb, AIAgentID: agent.ID, Name: "混合客服", Status: int(enums.StatusOk),
	}, channelServiceTestOperator())
	if err == nil || !strings.Contains(err.Error(), "hybrid ai agent") {
		t.Fatalf("expected hybrid publication error, got %v", err)
	}
	if err := db.Model(&models.AIAgent{}).Where("id = ?", agent.ID).Update("workflow_version_id", 1001).Error; err != nil {
		t.Fatalf("set workflow version: %v", err)
	}
	item, err := ChannelService.CreateChannel(request.CreateChannelRequest{
		ChannelType: enums.ChannelTypeWeb, AIAgentID: agent.ID, Name: "混合客服已发布", Status: int(enums.StatusOk),
	}, channelServiceTestOperator())
	if err != nil || item == nil {
		t.Fatalf("create channel for hybrid runtime: item=%#v err=%v", item, err)
	}
}

func setupChannelServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dbName := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open("file:"+dbName+"?mode=memory&cache=shared"), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{
			TablePrefix:   "t_",
			SingularTable: true,
		},
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	if err := db.AutoMigrate(&models.AIAgent{}, &models.AgentRevision{}, &models.AIAgentWorkflowBinding{}, &models.Channel{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
	return db
}

func createChannelServiceTestAgent(t *testing.T, db *gorm.DB, workflowVersionID int64) models.AIAgent {
	t.Helper()
	item := models.AIAgent{
		Name:              "测试 AI",
		Status:            enums.StatusOk,
		WorkflowVersionID: workflowVersionID,
	}
	if err := db.Create(&item).Error; err != nil {
		t.Fatalf("create ai agent: %v", err)
	}
	return item
}

func channelServiceTestOperator() *dto.AuthPrincipal {
	return &dto.AuthPrincipal{UserID: 1, Username: "admin"}
}

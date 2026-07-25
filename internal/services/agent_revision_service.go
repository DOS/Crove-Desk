package services

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
	"time"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/pkg/utils"
	"agent-desk/internal/repositories"

	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

var AgentRevisionService = newAgentRevisionService()

func newAgentRevisionService() *agentRevisionService {
	return &agentRevisionService{}
}

type agentRevisionService struct{}

func (s *agentRevisionService) Get(id int64) *models.AgentRevision {
	if id <= 0 {
		return nil
	}
	return repositories.AgentRevisionRepository.Get(sqls.DB(), id)
}

func (s *agentRevisionService) FindByAgentID(agentID int64) []models.AgentRevision {
	return repositories.AgentRevisionRepository.FindByAgentID(sqls.DB(), agentID)
}

type agentRevisionDefinition struct {
	Agent              agentRevisionAgent `json:"agent"`
	Model              agentRevisionModel `json:"model"`
	WorkflowVersionID  int64              `json:"workflowVersionId"`
	WorkflowDefinition string             `json:"workflowDefinition"`
}

// agentRevisionModel deliberately excludes APIKey. A revision must capture
// reproducible routing/model parameters without duplicating credentials.
type agentRevisionModel struct {
	ConfigID         int64  `json:"configId"`
	Provider         string `json:"provider"`
	BaseURL          string `json:"baseUrl"`
	ModelType        string `json:"modelType"`
	ModelName        string `json:"modelName"`
	MaxContextTokens int    `json:"maxContextTokens"`
	MaxOutputTokens  int    `json:"maxOutputTokens"`
	TimeoutMS        int    `json:"timeoutMs"`
	MaxRetryCount    int    `json:"maxRetryCount"`
}

type agentRevisionAgent struct {
	Name                string `json:"name"`
	Description         string `json:"description"`
	AIConfigID          int64  `json:"aiConfigId"`
	RuntimeMode         string `json:"runtimeMode"`
	MaxSteps            int    `json:"maxSteps"`
	ContextWindow       int    `json:"contextWindow"`
	ToolPolicy          string `json:"toolPolicy"`
	KnowledgePolicy     string `json:"knowledgePolicy"`
	ServiceMode         int    `json:"serviceMode"`
	SystemPrompt        string `json:"systemPrompt"`
	WelcomeMessage      string `json:"welcomeMessage"`
	ReplyTimeoutSeconds int    `json:"replyTimeoutSeconds"`
	TeamIDs             string `json:"teamIds"`
	HandoffMode         int    `json:"handoffMode"`
	FallbackMode        int    `json:"fallbackMode"`
	FallbackMessage     string `json:"fallbackMessage"`
	KnowledgeIDs        string `json:"knowledgeIds"`
	SkillIDs            string `json:"skillIds"`
	AllowedMCPTools     string `json:"allowedMcpTools"`
}

// AgentRevisionSnapshot is the immutable runtime configuration restored from
// a published revision. Model credentials deliberately remain on the current
// AIConfig so credential rotation does not require republishing every Agent.
type AgentRevisionSnapshot struct {
	Revision models.AgentRevision
	Agent    models.AIAgent
	AIConfig models.AIConfig
}

// ResolvePublishedSnapshot restores a published Agent revision for runtime
// execution. Empty legacy definitions retain the current fields so historical
// records created before snapshot hydration remain executable.
func (s *agentRevisionService) ResolvePublishedSnapshot(agent models.AIAgent, config models.AIConfig) (*AgentRevisionSnapshot, error) {
	if agent.PublishedRevisionID <= 0 {
		return nil, errorsx.InvalidParam("autonomous agent is not published")
	}
	revision := repositories.AgentRevisionRepository.Get(sqls.DB(), agent.PublishedRevisionID)
	if revision == nil || revision.AgentID != agent.ID || revision.Status != enums.StatusOk {
		return nil, errorsx.InvalidParam("autonomous agent published revision does not exist")
	}
	snapshot := &AgentRevisionSnapshot{Revision: *revision, Agent: agent, AIConfig: config}
	if strings.TrimSpace(revision.Definition) == "" {
		return snapshot, nil
	}
	definition := agentRevisionDefinition{}
	if err := json.Unmarshal([]byte(revision.Definition), &definition); err != nil {
		return nil, errorsx.InvalidParam("autonomous agent published revision is invalid")
	}
	if definition.Agent.AIConfigID > 0 && definition.Agent.AIConfigID != config.ID {
		return nil, errorsx.InvalidParam("published agent model config no longer matches")
	}
	applyRevisionAgentSnapshot(&snapshot.Agent, definition.Agent)
	if definition.WorkflowVersionID > 0 {
		snapshot.Agent.WorkflowVersionID = definition.WorkflowVersionID
	}
	applyRevisionModelSnapshot(&snapshot.AIConfig, definition.Model)
	return snapshot, nil
}

func applyRevisionAgentSnapshot(agent *models.AIAgent, definition agentRevisionAgent) {
	if agent == nil {
		return
	}
	agent.Name = definition.Name
	agent.Description = definition.Description
	agent.AIConfigID = definition.AIConfigID
	agent.RuntimeMode = enums.AIAgentRuntimeMode(definition.RuntimeMode)
	agent.MaxSteps = definition.MaxSteps
	agent.ContextWindow = definition.ContextWindow
	agent.ToolPolicy = definition.ToolPolicy
	agent.KnowledgePolicy = definition.KnowledgePolicy
	agent.ServiceMode = enums.IMConversationServiceMode(definition.ServiceMode)
	agent.SystemPrompt = definition.SystemPrompt
	agent.WelcomeMessage = definition.WelcomeMessage
	agent.ReplyTimeoutSeconds = definition.ReplyTimeoutSeconds
	agent.TeamIDs = definition.TeamIDs
	agent.HandoffMode = enums.AIAgentHandoffMode(definition.HandoffMode)
	agent.FallbackMode = enums.AIAgentFallbackMode(definition.FallbackMode)
	agent.FallbackMessage = definition.FallbackMessage
	agent.KnowledgeIDs = definition.KnowledgeIDs
	agent.SkillIDs = definition.SkillIDs
	agent.AllowedMCPTools = definition.AllowedMCPTools
}

func applyRevisionModelSnapshot(config *models.AIConfig, definition agentRevisionModel) {
	if config == nil || definition.ConfigID <= 0 {
		return
	}
	config.Provider = enums.AIProvider(definition.Provider)
	config.BaseURL = definition.BaseURL
	config.ModelType = enums.AIModelType(definition.ModelType)
	config.ModelName = definition.ModelName
	config.MaxContextTokens = definition.MaxContextTokens
	config.MaxOutputTokens = definition.MaxOutputTokens
	config.TimeoutMS = definition.TimeoutMS
	config.MaxRetryCount = definition.MaxRetryCount
}

// PublishWorkflowSnapshot keeps the Agent settings and its referenced
// workflow definition together as an immutable, reproducible revision.
func (s *agentRevisionService) PublishWorkflowSnapshot(db *gorm.DB, agent *models.AIAgent, version *models.AIWorkflowVersion, operator *dto.AuthPrincipal) (*models.AgentRevision, error) {
	return s.publishSnapshot(db, agent, version, operator)
}

func (s *agentRevisionService) PublishSnapshot(db *gorm.DB, agent *models.AIAgent, operator *dto.AuthPrincipal) (*models.AgentRevision, error) {
	return s.publishSnapshot(db, agent, nil, operator)
}

func (s *agentRevisionService) publishSnapshot(db *gorm.DB, agent *models.AIAgent, version *models.AIWorkflowVersion, operator *dto.AuthPrincipal) (*models.AgentRevision, error) {
	model := agentRevisionModel{ConfigID: agent.AIConfigID}
	if config := repositories.AIConfigRepository.Get(db, agent.AIConfigID); config != nil {
		model = agentRevisionModel{
			ConfigID: config.ID, Provider: string(config.Provider), BaseURL: config.BaseURL, ModelType: string(config.ModelType),
			ModelName: config.ModelName, MaxContextTokens: config.MaxContextTokens, MaxOutputTokens: config.MaxOutputTokens,
			TimeoutMS: config.TimeoutMS, MaxRetryCount: config.MaxRetryCount,
		}
	}
	workflowVersionID := int64(0)
	workflowDefinition := ""
	if version != nil {
		workflowVersionID = version.ID
		workflowDefinition = version.Definition
	}
	definition := agentRevisionDefinition{
		Agent: agentRevisionAgent{
			Name: agent.Name, Description: agent.Description, AIConfigID: agent.AIConfigID,
			RuntimeMode: string(agent.RuntimeMode), MaxSteps: agent.MaxSteps, ContextWindow: agent.ContextWindow,
			ToolPolicy: agent.ToolPolicy, KnowledgePolicy: agent.KnowledgePolicy, ServiceMode: int(agent.ServiceMode), SystemPrompt: agent.SystemPrompt,
			WelcomeMessage: agent.WelcomeMessage, ReplyTimeoutSeconds: agent.ReplyTimeoutSeconds, TeamIDs: agent.TeamIDs, HandoffMode: int(agent.HandoffMode),
			FallbackMode: int(agent.FallbackMode), FallbackMessage: agent.FallbackMessage, KnowledgeIDs: agent.KnowledgeIDs,
			SkillIDs: agent.SkillIDs, AllowedMCPTools: agent.AllowedMCPTools,
		},
		Model:              model,
		WorkflowVersionID:  workflowVersionID,
		WorkflowDefinition: workflowDefinition,
	}
	data, err := json.Marshal(definition)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	hash := sha256.Sum256(data)
	item := &models.AgentRevision{
		AgentID: agent.ID, Revision: repositories.AgentRevisionRepository.MaxRevisionByAgentID(db, agent.ID) + 1,
		WorkflowVersionID: workflowVersionID, Status: enums.StatusOk, Definition: string(data), DefinitionHash: hex.EncodeToString(hash[:]),
		PublishedAt: &now, PublishedByID: operator.UserID, PublishedByName: operator.Username, AuditFields: utils.BuildAuditFields(operator),
	}
	if err := repositories.AgentRevisionRepository.Create(db, item); err != nil {
		return nil, err
	}
	return item, nil
}

package runtime

import (
	"context"
	"strings"

	"agent-desk/internal/ai/runtime/instruction"
	"agent-desk/internal/pkg/utils"
)

// autonomousTurn is the prepared context for an autonomous or hybrid model
// turn. It keeps context assembly separate from engine-specific execution and
// auditing.
type autonomousTurn struct {
	SkillContext      autonomousSkillContext
	RetrieverCount    int
	RetrieveErr       error
	ResponsePolicy    autonomousResponsePolicy
	SystemPrompt      string
	UserPrompt        string
	HistoryCount      int
	AgentAllowedTools []string
	AllowedTools      []string
	ToolPolicy        autonomousToolPolicy
}

func (e *AutonomousEngine) prepareTurn(ctx context.Context, req Request) autonomousTurn {
	skillContext := e.selectSkill(ctx, req)
	knowledgeContext, retrieverCount, retrieveErr := e.retrieveKnowledge(ctx, req.AIAgent, req.UserMessage.Content)
	responsePolicy := evaluateAutonomousResponsePolicy(req.AIAgent, knowledgeContext, retrieveErr)
	systemPrompt := buildAutonomousSystemPrompt(req.AIAgent, len(utils.SplitInt64s(req.AIAgent.KnowledgeIDs)) > 0, knowledgeContext, retrieveErr)
	if skillInstruction := strings.TrimSpace(instruction.BuildSkillDocument(skillContext.Skill, nil)); skillInstruction != "" {
		systemPrompt += "\n\nSkill instructions:\n" + skillInstruction
	}
	userPrompt, historyCount := e.buildUserPrompt(req)
	if knowledgeContext != "" {
		userPrompt += "\n\nKnowledge evidence:\n" + knowledgeContext
	}
	agentAllowedTools := autonomousAllowedMCPToolCodes(req.AIAgent.AllowedMCPTools)
	allowedTools := agentAllowedTools
	if skillContext.Skill != nil {
		allowedTools = intersectAutonomousToolCodes(agentAllowedTools, skillContext.AllowedToolCodes)
	}
	if req.Debug {
		// Dashboard debug runs may inspect model and retrieval behavior but must
		// not invoke direct MCP tools against production integrations.
		allowedTools = nil
	}
	return autonomousTurn{
		SkillContext:      skillContext,
		RetrieverCount:    retrieverCount,
		RetrieveErr:       retrieveErr,
		ResponsePolicy:    responsePolicy,
		SystemPrompt:      systemPrompt,
		UserPrompt:        userPrompt,
		HistoryCount:      historyCount,
		AgentAllowedTools: agentAllowedTools,
		AllowedTools:      allowedTools,
		ToolPolicy:        parseAutonomousToolPolicy(req.AIAgent.ToolPolicy),
	}
}

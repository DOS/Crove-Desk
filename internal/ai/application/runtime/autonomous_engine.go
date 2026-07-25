package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	ai "agent-desk/internal/ai"
	"agent-desk/internal/ai/runtime/instruction"
	"agent-desk/internal/ai/runtime/readtools"
	"agent-desk/internal/ai/runtime/retrievers"
	runtimetooling "agent-desk/internal/ai/runtime/tooling"
	"agent-desk/internal/ai/skills"
	aitooling "agent-desk/internal/ai/tooling"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/pkg/toolx"
	"agent-desk/internal/pkg/utils"
	svc "agent-desk/internal/services"

	"github.com/mlogclub/simple/sqls"
)

// AutonomousEngine is the low-risk, no-flow runtime. It uses bounded model
// turns and exposes configured MCP tools only through the shared Tool Registry.
type AutonomousEngine struct {
	chat        func(context.Context, models.AIConfig, string, string) (*ai.ChatCompletionResult, error)
	history     func(int64, int) []models.Message
	retrieve    func(context.Context, models.AIAgent, string) (string, int, error)
	skillSelect func(context.Context, skills.RuntimeContext) (*skills.ExecutionResult, error)
	toolChat    func(context.Context, models.AIConfig, string, string, []ai.ToolDefinition, int, ai.ToolCallExecutor) (*ai.ToolLoopResult, error)
}

func NewAutonomousEngine() *AutonomousEngine {
	return &AutonomousEngine{
		chat: ai.LLM.ChatWithConfig,
		history: func(conversationID int64, limit int) []models.Message {
			items, _, _ := svc.MessageService.FindByConversationIDCursor(conversationID, 0, limit, "", "")
			return items
		},
		retrieve:    retrieveAutonomousKnowledge,
		skillSelect: skills.RuntimeService.Select,
		toolChat:    ai.LLM.ChatWithTools,
	}
}

func newAutonomousEngineWithChat(chat func(context.Context, models.AIConfig, string, string) (*ai.ChatCompletionResult, error)) *AutonomousEngine {
	return &AutonomousEngine{chat: chat}
}

func (e *AutonomousEngine) Code() string {
	return EngineCodeAutonomous
}

func (e *AutonomousEngine) Run(ctx context.Context, req RunInput) (*RunResult, error) {
	startedAt := time.Now()
	req.UserMessage.Content = utils.BuildRuntimeMessageText(req.UserMessage.MessageType, req.UserMessage.Content)
	snapshot, err := svc.AgentRevisionService.ResolvePublishedSnapshot(req.AIAgent, req.AIConfig)
	if err != nil {
		_, _ = writeAutonomousRun(req, startedAt, nil, "", 0, 0, nil, autonomousSkillContext{}, autonomousResponsePolicy{}, nil, err)
		return nil, err
	}
	req.AIAgent = snapshot.Agent
	req.AIConfig = snapshot.AIConfig
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
	var toolCalls []svc.EngineToolCallInput
	var result *ai.ChatCompletionResult
	agentAllowedTools := autonomousAllowedMCPToolCodes(req.AIAgent.AllowedMCPTools)
	toolPolicy := parseAutonomousToolPolicy(req.AIAgent.ToolPolicy)
	allowedTools := agentAllowedTools
	if skillContext.Skill != nil {
		allowedTools = intersectAutonomousToolCodes(agentAllowedTools, skillContext.AllowedToolCodes)
	}
	if req.Debug {
		// Dashboard debug runs may inspect model and retrieval behavior but must
		// not invoke direct MCP tools against production integrations.
		allowedTools = nil
	}
	if responsePolicy.Enforced {
		result = &ai.ChatCompletionResult{Content: responsePolicy.ReplyText, ModelName: req.AIConfig.ModelName}
	} else if len(allowedTools) > 0 && e.toolChat != nil {
		loopResult, loopErr := e.toolChat(ctx, req.AIConfig, systemPrompt, userPrompt, []ai.ToolDefinition{autonomousToolSearchDefinition()}, req.AIAgent.MaxSteps, e.toolSearchExecutor(req.Conversation, req.AIAgent, agentAllowedTools, skillContext.AllowedToolCodes, toolPolicy, &toolCalls))
		if loopErr != nil {
			if len(toolCalls) == 0 {
				err := loopErr
				_, _ = writeAutonomousRun(req, startedAt, nil, userPrompt, historyCount, retrieverCount, retrieveErr, skillContext, responsePolicy, toolCalls, err)
				return nil, err
			}
			responsePolicy = autonomousToolFailurePolicy(req.AIAgent, "tool_loop_error")
			result = &ai.ChatCompletionResult{Content: responsePolicy.ReplyText, ModelName: req.AIConfig.ModelName}
		}
		if result == nil && loopResult != nil {
			result = &loopResult.ChatCompletionResult
		}
		if autonomousHasConsecutiveToolFailures(toolCalls, 2) {
			responsePolicy = autonomousToolFailurePolicy(req.AIAgent, "tool_consecutive_failures")
			result = &ai.ChatCompletionResult{Content: responsePolicy.ReplyText, ModelName: req.AIConfig.ModelName}
		}
	} else {
		result, err = e.chat(ctx, req.AIConfig, systemPrompt, userPrompt)
	}
	if err != nil {
		_, _ = writeAutonomousRun(req, startedAt, nil, userPrompt, historyCount, retrieverCount, retrieveErr, skillContext, responsePolicy, toolCalls, err)
		return nil, err
	}
	if result == nil || strings.TrimSpace(result.Content) == "" {
		err = errorsx.InvalidParam("autonomous engine returned an empty reply")
		_, _ = writeAutonomousRun(req, startedAt, nil, userPrompt, historyCount, retrieverCount, retrieveErr, skillContext, responsePolicy, toolCalls, err)
		return nil, err
	}
	result.Content, err = aitooling.NormalizeCustomerReply(result.Content)
	if err != nil {
		_, _ = writeAutonomousRun(req, startedAt, nil, userPrompt, historyCount, retrieverCount, retrieveErr, skillContext, responsePolicy, toolCalls, err)
		return nil, err
	}
	runID, recordErr := writeAutonomousRun(req, startedAt, result, userPrompt, historyCount, retrieverCount, retrieveErr, skillContext, responsePolicy, toolCalls, nil)
	if recordErr != nil {
		return nil, recordErr
	}
	trace, _ := json.Marshal(map[string]any{
		"engine":               EngineCodeAutonomous,
		"mode":                 autonomousExecutionMode(allowedTools),
		"historyMessageCount":  historyCount,
		"retrieverCount":       retrieverCount,
		"skillID":              skillContext.SkillID(),
		"skillRouteError":      skillContext.ErrorMessage,
		"responsePolicyAction": responsePolicy.Action,
		"debug":                req.Debug,
	})
	return &Summary{
		Status:                "completed",
		ReplyText:             strings.TrimSpace(result.Content),
		ModelName:             result.ModelName,
		PromptTokens:          result.PromptTokens,
		CompletionTokens:      result.CompletionTokens,
		HistoryMessageCount:   historyCount,
		RetrieverCount:        retrieverCount,
		PlannedSkillID:        skillContext.SkillID(),
		PlannedSkillName:      skillContext.SkillName(),
		PlanReason:            skillContext.MatchReason,
		SkillRouteTrace:       skillContext.TraceData,
		SkillAllowedToolCodes: append([]string(nil), skillContext.AllowedToolCodes...),
		AgentRunID:            runID,
		HandoffRequested:      responsePolicy.RequestHandoff && !req.Debug,
		TraceData:             string(trace),
	}, nil
}

func (e *AutonomousEngine) buildUserPrompt(req Request) (string, int) {
	limit := req.AIAgent.ContextWindow
	if limit <= 0 {
		limit = 12
	}
	if limit > 20 {
		limit = 20
	}
	items := []models.Message(nil)
	if e.history != nil && req.Conversation.ID > 0 {
		// The triggering customer message is already persisted in most reply
		// paths. Fetch one extra item so it does not consume history capacity.
		items = e.history(req.Conversation.ID, limit+1)
	}
	lines := make([]string, 0, len(items)+2)
	for _, item := range items {
		if item.ID == req.UserMessage.ID || strings.TrimSpace(item.Content) == "" {
			continue
		}
		role := autonomousMessageRole(item)
		if role == "" {
			continue
		}
		lines = append(lines, role+": "+utils.BuildRuntimeMessageText(item.MessageType, item.Content))
	}
	if len(lines) > limit {
		lines = lines[len(lines)-limit:]
	}
	current := strings.TrimSpace(req.UserMessage.Content)
	customerContext := buildAutonomousCustomerContext(req.Conversation)
	if len(lines) == 0 && customerContext == "" {
		return current, 0
	}
	parts := make([]string, 0, 3)
	if customerContext != "" {
		parts = append(parts, "Customer context:\n"+customerContext)
	}
	if len(lines) > 0 {
		parts = append(parts, "Conversation history:\n"+strings.Join(lines, "\n"))
	}
	parts = append(parts, "Current customer message:\n"+current)
	return strings.Join(parts, "\n\n"), len(lines)
}

func buildAutonomousCustomerContext(conversation models.Conversation) string {
	parts := make([]string, 0, 2)
	if name := strings.TrimSpace(conversation.CustomerName); name != "" {
		parts = append(parts, "Customer: "+name)
	}
	if summary := strings.TrimSpace(conversation.LastMessageSummary); summary != "" {
		parts = append(parts, "Recent summary: "+summary)
	}
	return strings.Join(parts, "\n")
}

func autonomousMessageRole(message models.Message) string {
	switch message.SenderType {
	case "customer":
		return "Customer"
	case "ai", "agent":
		return "Assistant"
	default:
		return ""
	}
}

func (e *AutonomousEngine) Resume(ctx context.Context, req ResumeInput) (*RunResult, error) {
	return nil, errorsx.InvalidParam("autonomous agent has no resumable checkpoint")
}

func (e *AutonomousEngine) retrieveKnowledge(ctx context.Context, agent models.AIAgent, query string) (string, int, error) {
	if e.retrieve == nil || len(utils.SplitInt64s(agent.KnowledgeIDs)) == 0 {
		return "", 0, nil
	}
	return e.retrieve(ctx, agent, query)
}

type autonomousSkillContext struct {
	Skill            *models.SkillDefinition
	MatchReason      string
	TraceData        string
	ErrorMessage     string
	AllowedToolCodes []string
}

type autonomousResponsePolicy struct {
	Enforced       bool
	Action         string
	Reason         string
	ReplyText      string
	RequestHandoff bool
}

func evaluateAutonomousResponsePolicy(agent models.AIAgent, knowledgeContext string, retrieveErr error) autonomousResponsePolicy {
	if len(utils.SplitInt64s(agent.KnowledgeIDs)) == 0 || strings.TrimSpace(knowledgeContext) != "" && retrieveErr == nil {
		return autonomousResponsePolicy{}
	}
	if retrieveErr != nil {
		return autonomousKnowledgeFallbackPolicy(agent, "knowledge_retrieve_error")
	}
	return autonomousKnowledgeFallbackPolicy(agent, "knowledge_evidence_missing")
}

func autonomousKnowledgeFallbackPolicy(agent models.AIAgent, reason string) autonomousResponsePolicy {
	if agent.FallbackMode == enums.AIAgentFallbackModeHandoff {
		return autonomousResponsePolicy{
			Enforced: true, Action: "handoff", Reason: reason, RequestHandoff: true,
			ReplyText: autonomousKnowledgeFallbackReply(agent),
		}
	}
	return autonomousResponsePolicy{
		Enforced: true, Action: "clarify", Reason: reason,
		ReplyText: autonomousKnowledgeFallbackReply(agent),
	}
}

func autonomousToolFailurePolicy(agent models.AIAgent, reason string) autonomousResponsePolicy {
	if agent.FallbackMode == enums.AIAgentFallbackModeHandoff {
		return autonomousResponsePolicy{
			Enforced: true, Action: "handoff", Reason: reason, RequestHandoff: true,
			ReplyText: autonomousToolFailureReply(agent),
		}
	}
	return autonomousResponsePolicy{
		Enforced: true, Action: "clarify", Reason: reason,
		ReplyText: autonomousToolFailureReply(agent),
	}
}

func autonomousToolFailureReply(agent models.AIAgent) string {
	if reply := strings.TrimSpace(agent.FallbackMessage); reply != "" {
		return reply
	}
	if agent.FallbackMode == enums.AIAgentFallbackModeHandoff {
		return "暂时无法完成所需查询，正在为你转接人工客服。"
	}
	return "暂时无法完成所需查询，请补充更具体的信息后再试一次。"
}

func autonomousHasConsecutiveToolFailures(calls []svc.EngineToolCallInput, minimum int) bool {
	if minimum <= 0 {
		return false
	}
	failures := 0
	for index := len(calls) - 1; index >= 0; index-- {
		if calls[index].Status != "failed" {
			break
		}
		failures++
	}
	return failures >= minimum
}

func autonomousKnowledgeFallbackReply(agent models.AIAgent) string {
	if reply := strings.TrimSpace(agent.FallbackMessage); reply != "" {
		return reply
	}
	if agent.FallbackMode == 0 || agent.FallbackMode == enums.AIAgentFallbackModeSuggestRetry {
		return "当前知识库里没有找到足够明确的信息，你可以换个更具体的问法再试一次。"
	}
	if agent.FallbackMode == enums.AIAgentFallbackModeHandoff {
		return "当前知识库没有足够明确的信息，正在为你转接人工客服。"
	}
	return "当前知识库暂无明确信息。"
}

func (c autonomousSkillContext) SkillID() int64 {
	if c.Skill == nil {
		return 0
	}
	return c.Skill.ID
}

func (c autonomousSkillContext) SkillName() string {
	if c.Skill == nil {
		return ""
	}
	return strings.TrimSpace(c.Skill.Name)
}

func (e *AutonomousEngine) selectSkill(ctx context.Context, req Request) autonomousSkillContext {
	if e.skillSelect == nil || len(utils.SplitInt64s(req.AIAgent.SkillIDs)) == 0 {
		return autonomousSkillContext{}
	}
	result, err := e.skillSelect(ctx, skills.RuntimeContext{
		AIAgent: req.AIAgent, AIConfig: req.AIConfig, UserMessage: req.UserMessage.Content, ConversationID: req.Conversation.ID,
	})
	ret := autonomousSkillContext{}
	if err != nil {
		ret.ErrorMessage = err.Error()
		return ret
	}
	if result == nil || result.Plan == nil {
		return ret
	}
	ret.Skill = result.Plan.Skill
	ret.MatchReason = strings.TrimSpace(result.Plan.MatchReason)
	if result.Trace != nil {
		data, _ := json.Marshal(result.Trace)
		ret.TraceData = string(data)
	}
	if ret.Skill != nil {
		ret.AllowedToolCodes = parseSkillToolWhitelist(ret.Skill.ToolWhitelist)
	}
	return ret
}

func parseSkillToolWhitelist(raw string) []string {
	var items []string
	if json.Unmarshal([]byte(strings.TrimSpace(raw)), &items) != nil {
		return nil
	}
	ret := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		item = toolx.NormalizeToolCodeAlias(strings.TrimSpace(item))
		if item == "" {
			continue
		}
		if _, exists := seen[item]; exists {
			continue
		}
		seen[item] = struct{}{}
		ret = append(ret, item)
	}
	return ret
}

func intersectAutonomousToolCodes(agentAllowed, skillAllowed []string) []string {
	if len(agentAllowed) == 0 || len(skillAllowed) == 0 {
		return nil
	}
	allowed := make(map[string]struct{}, len(skillAllowed))
	for _, item := range skillAllowed {
		allowed[toolx.NormalizeToolCodeAlias(strings.TrimSpace(item))] = struct{}{}
	}
	ret := make([]string, 0, len(agentAllowed))
	for _, item := range agentAllowed {
		item = toolx.NormalizeToolCodeAlias(strings.TrimSpace(item))
		if _, ok := allowed[item]; ok {
			ret = append(ret, item)
		}
	}
	return ret
}

type autonomousDirectTool struct {
	ToolCode string `json:"toolCode"`
}

type autonomousToolSearchRequest struct {
	ToolCode  string         `json:"toolCode"`
	Arguments map[string]any `json:"arguments"`
}

type autonomousToolPolicy struct {
	MaxTotalCalls     int      `json:"maxTotalCalls"`
	MaxArgumentBytes  int      `json:"maxArgumentBytes"`
	AllowedRiskLevels []string `json:"allowedRiskLevels"`
}

func parseAutonomousToolPolicy(raw string) autonomousToolPolicy {
	policy := autonomousToolPolicy{MaxTotalCalls: 3, MaxArgumentBytes: 32 * 1024}
	if json.Unmarshal([]byte(strings.TrimSpace(raw)), &policy) != nil {
		return policy
	}
	if policy.MaxTotalCalls <= 0 || policy.MaxTotalCalls > 8 {
		policy.MaxTotalCalls = 3
	}
	if policy.MaxArgumentBytes <= 0 || policy.MaxArgumentBytes > 64*1024 {
		policy.MaxArgumentBytes = 32 * 1024
	}
	return policy
}

func autonomousAllowedMCPToolCodes(raw string) []string {
	var items []autonomousDirectTool
	if json.Unmarshal([]byte(strings.TrimSpace(raw)), &items) != nil {
		return nil
	}
	ret := make([]string, 0, len(items))
	for _, item := range items {
		if code := strings.TrimSpace(item.ToolCode); code != "" {
			ret = append(ret, code)
		}
	}
	return ret
}

func autonomousToolSearchDefinition() ai.ToolDefinition {
	return ai.ToolDefinition{
		Name:        "tool_search",
		Description: "Use a configured read-only tool only when it is needed to answer the customer. Pass the exact allowed toolCode and an arguments object.",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"toolCode":  map[string]any{"type": "string"},
				"arguments": map[string]any{"type": "object"},
			},
			"required": []string{"toolCode", "arguments"},
		},
	}
}

func (e *AutonomousEngine) toolSearchExecutor(conversation models.Conversation, agent models.AIAgent, allowedCodes, skillAllowedCodes []string, toolPolicy autonomousToolPolicy, records *[]svc.EngineToolCallInput) ai.ToolCallExecutor {
	return func(ctx context.Context, call ai.ToolCall) (string, error) {
		startedAt := time.Now()
		if call.Name != "tool_search" {
			return "", fmt.Errorf("unsupported autonomous tool: %s", call.Name)
		}
		var req autonomousToolSearchRequest
		if err := json.Unmarshal([]byte(call.Arguments), &req); err != nil {
			return "", fmt.Errorf("invalid tool_search arguments: %w", err)
		}
		policy := aitooling.Policy{
			AllowedToolCodes: allowedCodes, SkillAllowedToolCodes: skillAllowedCodes, AllowedRiskLevels: toolPolicy.AllowedRiskLevels,
			CallCount:        autonomousToolCallCount(*records, req.ToolCode),
			TotalCallCount:   len(*records),
			MaxTotalCalls:    toolPolicy.MaxTotalCalls,
			MaxArgumentBytes: toolPolicy.MaxArgumentBytes,
			Confirmed:        true, // The Agent's persisted allow-list is the administrator approval boundary.
		}
		definition, resultPreview, err := executeAutonomousReadTool(ctx, conversation, agent, strings.TrimSpace(req.ToolCode), req.Arguments, policy)
		if err != nil && definition.Code == "" {
			mcpDefinition, result, mcpErr := aitooling.DefaultMCPExecutor.Execute(ctx, strings.TrimSpace(req.ToolCode), req.Arguments, policy)
			definition, err = mcpDefinition, mcpErr
			resultPreview = runtimetooling.BuildReducedToolResultSummary(result)
		}
		durationMS := int(time.Since(startedAt).Milliseconds())
		record := svc.EngineToolCallInput{
			ToolCode: strings.TrimSpace(req.ToolCode), Status: "completed", ArgumentsPreview: aitooling.SanitizePreview(call.Arguments), DurationMS: durationMS,
		}
		if definition.Code != "" {
			record.ToolCode = definition.Code
			record.RiskLevel = definition.RiskLevel
			record.RequireConfirm = definition.RequireConfirmation
		}
		if err != nil {
			record.Status = "failed"
			record.ErrorMessage = err.Error()
			*records = append(*records, record)
			return "", err
		}
		record.ResultPreview = aitooling.SanitizePreview(resultPreview)
		*records = append(*records, record)
		return record.ResultPreview, nil
	}
}

func executeAutonomousReadTool(ctx context.Context, conversation models.Conversation, agent models.AIAgent, toolCode string, arguments map[string]any, policy aitooling.Policy) (aitooling.Definition, string, error) {
	toolCode = toolx.NormalizeToolCodeAlias(strings.TrimSpace(toolCode))
	if toolCode != toolx.BuiltinConversationContext.Code && toolCode != toolx.BuiltinKnowledgeRetrieve.Code && toolCode != toolx.GraphTriageServiceRequest.Code && toolCode != toolx.GraphAnalyzeConversation.Code && toolCode != toolx.GraphPrepareTicketDraft.Code {
		return aitooling.Definition{}, "", fmt.Errorf("tool is not a built-in read tool")
	}
	if toolCode == toolx.GraphTriageServiceRequest.Code || toolCode == toolx.GraphAnalyzeConversation.Code || toolCode == toolx.GraphPrepareTicketDraft.Code {
		return readtools.ExecuteGraphTool(ctx, conversation, toolCode, arguments, policy)
	}
	definition, err := aitooling.DefaultRegistry.Resolve(toolCode)
	if err != nil {
		return aitooling.Definition{}, "", err
	}
	if err := aitooling.DefaultRegistry.Authorize(definition, policy); err != nil {
		return definition, "", err
	}
	if definition.TimeoutMS > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, time.Duration(definition.TimeoutMS)*time.Millisecond)
		defer cancel()
	}
	if toolCode == toolx.BuiltinKnowledgeRetrieve.Code {
		query, _ := arguments["query"].(string)
		contextText, count, err := retrieveAutonomousKnowledge(ctx, agent, query)
		if err != nil {
			return definition, "", err
		}
		result, err := json.Marshal(map[string]any{"query": strings.TrimSpace(query), "resultCount": count, "context": contextText})
		return definition, string(result), err
	}
	result, err := json.Marshal(map[string]any{
		"conversationId":     conversation.ID,
		"customerName":       strings.TrimSpace(conversation.CustomerName),
		"lastMessageSummary": strings.TrimSpace(conversation.LastMessageSummary),
		"currentAssigneeId":  conversation.CurrentAssigneeID,
		"recentMessages":     autonomousToolConversationMessages(conversation.ID),
	})
	if err != nil {
		return definition, "", err
	}
	return definition, string(result), nil
}

func autonomousToolConversationMessages(conversationID int64) []map[string]string {
	if conversationID <= 0 {
		return []map[string]string{}
	}
	items, _, _ := svc.MessageService.FindByConversationIDCursor(conversationID, 0, 6, "", "")
	ret := make([]map[string]string, 0, len(items))
	for _, item := range items {
		role := autonomousMessageRole(item)
		content := strings.TrimSpace(utils.BuildRuntimeMessageText(item.MessageType, item.Content))
		if role == "" || content == "" {
			continue
		}
		if runes := []rune(content); len(runes) > 240 {
			content = string(runes[:240]) + "..."
		}
		ret = append(ret, map[string]string{"role": role, "content": content})
	}
	return ret
}

func autonomousToolCallCount(records []svc.EngineToolCallInput, toolCode string) int {
	toolCode = toolx.NormalizeToolCodeAlias(strings.TrimSpace(toolCode))
	count := 0
	for _, item := range records {
		if toolx.NormalizeToolCodeAlias(strings.TrimSpace(item.ToolCode)) == toolCode {
			count++
		}
	}
	return count
}

func retrieveAutonomousKnowledge(ctx context.Context, agent models.AIAgent, query string) (string, int, error) {
	retrieved, err := retrievers.NewKnowledgeRetriever(agent, utils.SplitInt64s(agent.KnowledgeIDs)).RetrieveContext(ctx, query)
	if err != nil {
		return "", 0, err
	}
	if retrieved == nil {
		return "", 0, nil
	}
	return strings.TrimSpace(retrieved.ContextText), len(retrieved.ContextResults), nil
}

func buildAutonomousSystemPrompt(agent models.AIAgent, hasKnowledgeBase bool, knowledgeContext string, retrieveErr error) string {
	prompt := strings.TrimSpace(agent.SystemPrompt)
	if prompt == "" {
		prompt = "You are a customer service assistant. Answer accurately, ask for clarification when evidence is insufficient, and do not invent facts."
	}
	if hasKnowledgeBase && strings.TrimSpace(knowledgeContext) == "" {
		prompt += "\n\nNo supporting knowledge was retrieved. Do not invent an answer; ask a focused clarification question or offer human handoff."
	}
	if retrieveErr != nil {
		prompt += "\n\nKnowledge retrieval is temporarily unavailable. Do not claim to have verified any policy or factual detail."
	}
	return prompt
}

func writeAutonomousRun(req Request, startedAt time.Time, result *ai.ChatCompletionResult, inputPreview string, historyCount int, retrieverCount int, retrieveErr error, skillContext autonomousSkillContext, responsePolicy autonomousResponsePolicy, toolCalls []svc.EngineToolCallInput, cause error) (int64, error) {
	endedAt := time.Now()
	status := "completed"
	errorMessage := ""
	outputPreview := ""
	promptTokens := 0
	completionTokens := 0
	if cause != nil {
		status = "failed"
		errorMessage = cause.Error()
	} else if result != nil {
		outputPreview = strings.TrimSpace(result.Content)
		promptTokens = result.PromptTokens
		completionTokens = result.CompletionTokens
	}
	trace, _ := json.Marshal(map[string]any{"engine": EngineCodeAutonomous, "mode": autonomousExecutionMode(autonomousAllowedMCPToolCodes(req.AIAgent.AllowedMCPTools)), "status": status, "historyMessageCount": historyCount, "retrieverCount": retrieverCount})
	var runID int64
	err := sqls.WithTransaction(func(tx *sqls.TxContext) error {
		var recordErr error
		runID, recordErr = svc.AgentRunService.RecordEngineRun(tx.Tx, svc.EngineAgentRunInput{
			ConversationID: req.Conversation.ID, AIAgentID: req.AIAgent.ID, AgentRevisionID: req.AIAgent.PublishedRevisionID,
			SourceMessageID: req.UserMessage.ID, EngineCode: EngineCodeAutonomous, Status: status,
			PromptTokens: promptTokens, CompletionTokens: completionTokens, StartedAt: startedAt, EndedAt: &endedAt,
			ErrorMessage: errorMessage, TraceData: string(trace), StepType: "model", StepCode: "chat_completion",
			StepInputPreview: strings.TrimSpace(inputPreview), StepOutputPreview: outputPreview,
			AdditionalSteps: autonomousAdditionalSteps(req, retrieverCount, retrieveErr, skillContext, responsePolicy),
			ToolCalls:       toolCalls,
		})
		return recordErr
	})
	return runID, err
}

func autonomousExecutionMode(allowedTools []string) string {
	if len(allowedTools) > 0 {
		return "tool_calling_loop"
	}
	return "single_model_turn"
}

func autonomousAdditionalSteps(req Request, retrieverCount int, retrieveErr error, skillContext autonomousSkillContext, responsePolicy autonomousResponsePolicy) []svc.EngineStepInput {
	steps := make([]svc.EngineStepInput, 0, 3)
	if len(utils.SplitInt64s(req.AIAgent.SkillIDs)) > 0 {
		status := "completed"
		if skillContext.ErrorMessage != "" {
			status = "failed"
		}
		steps = append(steps, svc.EngineStepInput{
			StepType: "skill_route", StepCode: "skill_select", Status: status,
			InputPreview: strings.TrimSpace(req.UserMessage.Content), OutputPreview: "selected skill: " + skillContext.SkillName(),
			ErrorMessage: skillContext.ErrorMessage,
		})
	}
	if len(utils.SplitInt64s(req.AIAgent.KnowledgeIDs)) > 0 {
		status := "completed"
		errorMessage := ""
		if retrieveErr != nil {
			status = "failed"
			errorMessage = retrieveErr.Error()
		}
		steps = append(steps, svc.EngineStepInput{
			StepType: "knowledge", StepCode: "knowledge_retrieve", Status: status,
			InputPreview: strings.TrimSpace(req.UserMessage.Content), OutputPreview: "retrieved context items: " + strconv.Itoa(retrieverCount), ErrorMessage: errorMessage,
		})
	}
	if responsePolicy.Enforced {
		policyCode := "knowledge_evidence"
		if strings.HasPrefix(responsePolicy.Reason, "tool_") {
			policyCode = "tool_failure"
		}
		steps = append(steps, svc.EngineStepInput{
			StepType: "policy", StepCode: policyCode, Status: "completed",
			InputPreview: responsePolicy.Reason, OutputPreview: responsePolicy.Action,
		})
	}
	return steps
}

var _ Engine = (*AutonomousEngine)(nil)

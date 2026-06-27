package registry

import "agent-desk/internal/ai/workflow/dsl"

const (
	NodeTypeStart                     = "start"
	NodeTypeConversationUnderstanding = "conversation_understanding"
	NodeTypeReplyPolicy               = "reply_policy"
	NodeTypeKnowledgeRetrieve         = "knowledge_retrieve"
	NodeTypeAnswerabilityGate         = "answerability_gate"
	NodeTypeLLMReply                  = "llm_reply"
	NodeTypeCondition                 = "condition"
	NodeTypeAnalyzeConversation       = "analyze_conversation"
	NodeTypePrepareTicketDraft        = "prepare_ticket_draft"
	NodeTypeHumanConfirm              = "human_confirm"
	NodeTypeCreateTicket              = "create_ticket"
	NodeTypeHandoffToHuman            = "handoff_to_human"
	NodeTypeSendReply                 = "send_reply"
	NodeTypeEnd                       = "end"
)

func DefaultRegistry() *Registry {
	return NewRegistry(
		NodeSpec{
			Type:        NodeTypeStart,
			Title:       "Start",
			Description: "Conversation workflow entry.",
			RiskLevel:   NodeRiskLevelLow,
			OutputSchema: []VariableSpec{
				output("conversationId", VariableTypeInteger, "Conversation ID."),
				output("messageId", VariableTypeInteger, "Current user message ID."),
				output("aiAgentId", VariableTypeInteger, "AI Agent ID."),
				output("userMessage", VariableTypeString, "Current user message content."),
				output("knowledgeBaseIds", VariableTypeIntegerArray, "Knowledge bases bound to the AI Agent."),
			},
		},
		NodeSpec{
			Type:        NodeTypeConversationUnderstanding,
			Title:       "Conversation Understanding",
			Description: "Classify customer message intent and answer scope before retrieval.",
			RiskLevel:   NodeRiskLevelLow,
			InputSchema: []VariableSpec{
				requiredInput("userMessage", VariableTypeString, "Current user message content."),
			},
			OutputSchema: []VariableSpec{
				output("normalizedMessage", VariableTypeString, "Normalized customer message."),
				enumOutput("messageIntent", "消息意图", "Detected customer message intent.", []VariableValueOption{
					valueOption("unknown", "未知意图", "系统暂时无法判断客户意图。"),
					valueOption("greeting", "打招呼", "客户在问候或开始对话。"),
					valueOption("thanks", "表达感谢", "客户在表示感谢。"),
					valueOption("end_conversation", "结束会话", "客户表示问题已处理或准备结束。"),
					valueOption("confirmation", "确认操作", "客户对上一步操作进行确认。"),
					valueOption("handoff_request", "要求人工", "客户明确要求转人工处理。"),
					valueOption("complaint", "投诉升级", "客户表达投诉、举报、起诉等升级风险。"),
					valueOption("ticket_request", "要求建单", "客户希望创建或跟进工单。"),
					valueOption("ambiguous_question", "问题不明确", "客户问题缺少必要上下文，需要追问。"),
					valueOption("business_question", "业务问题", "客户问题适合进入知识库检索。"),
				}),
				enumOutput("answerScope", "回复策略", "Recommended answer scope.", []VariableValueOption{
					valueOption("direct_reply", "直接回复客户", "无需检索知识库或转人工，可以直接生成回复。"),
					valueOption("needs_clarification", "追问补充信息", "当前信息不足，需要客户补充。"),
					valueOption("needs_handoff", "转人工处理", "需要人工客服介入。"),
					valueOption("needs_ticket", "创建工单", "需要进入工单处理流程。"),
					valueOption("needs_knowledge", "检索知识库", "需要先检索知识库再回答。"),
				}),
				output("confidence", VariableTypeNumber, "Classifier confidence."),
				output("riskSignals", VariableTypeStringArray, "Detected risk signals."),
				output("reason", VariableTypeString, "Decision reason."),
			},
			DefaultInputs: map[string]dsl.VariableSelector{
				"userMessage": {NodeID: "start_1", Field: "userMessage"},
			},
		},
		NodeSpec{
			Type:        NodeTypeReplyPolicy,
			Title:       "Reply Policy",
			Description: "Decide the next customer-service action from understanding output and agent policy.",
			RiskLevel:   NodeRiskLevelLow,
			InputSchema: []VariableSpec{
				requiredInput("messageIntent", VariableTypeString, "Detected customer message intent."),
				requiredInput("answerScope", VariableTypeString, "Recommended answer scope."),
				optionalInput("userMessage", VariableTypeString, "Current user message content."),
				optionalInput("riskSignals", VariableTypeStringArray, "Detected risk signals."),
				optionalInput("answerability", VariableTypeString, "Knowledge answerability decision."),
			},
			OutputSchema: []VariableSpec{
				enumOutput("action", "处理策略", "Selected policy action.", []VariableValueOption{
					valueOption("direct_reply", "直接回复客户", "直接发送策略节点生成的回复。"),
					valueOption("clarify", "追问补充信息", "先让客户补充必要信息。"),
					valueOption("end_conversation", "结束会话", "发送结束语并结束本轮处理。"),
					valueOption("handoff_to_human", "转人工", "进入人工接待流程。"),
					valueOption("prepare_ticket", "创建工单", "整理工单草稿并等待确认。"),
					valueOption("retrieve_knowledge", "检索知识库", "进入知识检索和 AI 回复流程。"),
					valueOption("knowledge_fallback", "知识库兜底", "知识库结果不足，发送兜底回复。"),
				}),
				output("replyText", VariableTypeString, "Customer-visible reply text when the policy can answer directly."),
				output("reason", VariableTypeString, "Policy decision reason."),
				output("requiresFlow", VariableTypeBoolean, "Whether the decision should continue into workflow actions."),
				enumOutput("targetFlow", "目标流程", "Suggested target flow.", []VariableValueOption{
					valueOption("handoff_to_human", "转人工流程", "继续执行转人工节点。"),
					valueOption("prepare_ticket", "工单流程", "继续执行工单草稿和确认节点。"),
					valueOption("knowledge", "知识库流程", "继续执行知识检索节点。"),
				}),
				enumOutput("finalReplySource", "回复来源", "Source category for the final reply.", []VariableValueOption{
					valueOption("direct_reply", "策略直接回复", "由回复策略节点直接生成回复。"),
					valueOption("clarification", "追问回复", "用于追问客户补充信息。"),
					valueOption("handoff_notice", "转人工提示", "用于提示客户已进入人工处理。"),
					valueOption("ticket_result", "工单结果", "用于提示建单结果。"),
					valueOption("knowledge_answer", "知识库回答", "用于发送基于知识库生成的回复。"),
					valueOption("knowledge_fallback", "知识库兜底", "用于知识库信息不足时的兜底回复。"),
				}),
			},
		},
		NodeSpec{
			Type:        NodeTypeKnowledgeRetrieve,
			Title:       "Knowledge Retrieve",
			Description: "Retrieve knowledge for the current user message.",
			RiskLevel:   NodeRiskLevelLow,
			InputSchema: []VariableSpec{
				requiredInput("query", VariableTypeString, "Search query."),
			},
			OutputSchema: []VariableSpec{
				output("items", VariableTypeObjectArray, "Retrieved knowledge items."),
				output("summary", VariableTypeString, "Short retrieval summary."),
			},
			DefaultInputs: map[string]dsl.VariableSelector{
				"query": {NodeID: "start_1", Field: "userMessage"},
			},
		},
		NodeSpec{
			Type:        NodeTypeAnswerabilityGate,
			Title:       "Answerability Gate",
			Description: "Decide whether retrieved knowledge is enough to answer.",
			RiskLevel:   NodeRiskLevelLow,
			InputSchema: []VariableSpec{
				requiredInput("userMessage", VariableTypeString, "Current user message content."),
				requiredInput("knowledgeItems", VariableTypeObjectArray, "Retrieved knowledge items."),
			},
			OutputSchema: []VariableSpec{
				enumOutput("answerability", "可回答性", "Answerability decision.", []VariableValueOption{
					valueOption("answerable", "可以回答", "检索结果足够支撑回答。"),
					valueOption("unanswerable", "无法回答", "检索结果不足，应该走兜底或追问。"),
				}),
				output("reason", VariableTypeString, "Decision reason."),
			},
		},
		NodeSpec{
			Type:        NodeTypeLLMReply,
			Title:       "LLM Reply",
			Description: "Generate a reply or structured analysis with the configured model.",
			RiskLevel:   NodeRiskLevelMedium,
			InputSchema: []VariableSpec{
				requiredInput("userMessage", VariableTypeString, "Current user message content."),
				optionalInput("knowledgeItems", VariableTypeObjectArray, "Retrieved knowledge items."),
			},
			OutputSchema: []VariableSpec{
				output("replyText", VariableTypeString, "Generated reply text."),
			},
		},
		NodeSpec{
			Type:        NodeTypeCondition,
			Title:       "Condition",
			Description: "Route by controlled workflow variables.",
			RiskLevel:   NodeRiskLevelLow,
			OutputSchema: []VariableSpec{
				output("matched", VariableTypeBoolean, "Whether the condition matched."),
			},
		},
		NodeSpec{
			Type:        NodeTypeAnalyzeConversation,
			Title:       "Analyze Conversation",
			Description: "Analyze intent, risk, and recommended next action.",
			RiskLevel:   NodeRiskLevelLow,
			InputSchema: []VariableSpec{
				requiredInput("userMessage", VariableTypeString, "Current user message content."),
			},
			OutputSchema: []VariableSpec{
				output("intent", VariableTypeString, "Detected user intent."),
				output("riskLevel", VariableTypeString, "Detected risk level."),
				output("needTicket", VariableTypeBoolean, "Whether a ticket is recommended."),
				output("needHumanHandoff", VariableTypeBoolean, "Whether human handoff is recommended."),
			},
		},
		NodeSpec{
			Type:        NodeTypePrepareTicketDraft,
			Title:       "Prepare Ticket Draft",
			Description: "Build a ticket draft from conversation context.",
			RiskLevel:   NodeRiskLevelMedium,
			InputSchema: []VariableSpec{
				requiredInput("issue", VariableTypeString, "Issue summary."),
			},
			OutputSchema: []VariableSpec{
				output("ticketDraft", VariableTypeObject, "Draft ticket payload."),
			},
		},
		NodeSpec{
			Type:          NodeTypeHumanConfirm,
			Title:         "Human Confirm",
			Description:   "Interrupt and wait for explicit user confirmation.",
			RiskLevel:     NodeRiskLevelMedium,
			Interruptible: true,
			InputSchema: []VariableSpec{
				requiredInput("prompt", VariableTypeString, "Confirmation prompt."),
			},
			OutputSchema: []VariableSpec{
				output("confirmed", VariableTypeBoolean, "Whether the user confirmed."),
				output("responseText", VariableTypeString, "Confirmation response text."),
			},
		},
		NodeSpec{
			Type:                            NodeTypeCreateTicket,
			Title:                           "Create Ticket",
			Description:                     "Create a ticket from a confirmed draft.",
			RiskLevel:                       NodeRiskLevelHigh,
			RequiresConfirmationPredecessor: true,
			InputSchema: []VariableSpec{
				requiredInput("ticketDraft", VariableTypeObject, "Confirmed draft ticket payload."),
				requiredInput("confirmed", VariableTypeBoolean, "Confirmation result."),
			},
			OutputSchema: []VariableSpec{
				output("ticketId", VariableTypeInteger, "Created ticket ID."),
				output("ticketNo", VariableTypeString, "Created ticket number."),
				output("created", VariableTypeBoolean, "Whether the ticket was created."),
				output("message", VariableTypeString, "Customer-visible ticket creation result."),
			},
		},
		NodeSpec{
			Type:        NodeTypeHandoffToHuman,
			Title:       "Handoff To Human",
			Description: "Transfer the conversation to human support.",
			RiskLevel:   NodeRiskLevelHigh,
			InputSchema: []VariableSpec{
				requiredInput("reason", VariableTypeString, "Handoff reason."),
				optionalInput("confirmed", VariableTypeBoolean, "Confirmation result."),
			},
			OutputSchema: []VariableSpec{
				output("handoffId", VariableTypeInteger, "Handoff operation ID."),
				output("reason", VariableTypeString, "Handoff reason."),
				enumOutput("decision", "转人工结果", "Handoff dispatch decision.", []VariableValueOption{
					valueOption("assigned", "已分配客服", "已成功分配给人工客服。"),
					valueOption("team_pool", "团队队列等待", "暂未分配到客服，进入团队等待队列。"),
					valueOption("global_pool", "全局队列等待", "非服务时间或无可用团队，进入全局等待队列。"),
					valueOption("off_hours", "非服务时间", "当前不在人工客服服务时间内。"),
					valueOption("cancelled", "已取消转人工", "由于未确认或条件不满足，未执行转人工。"),
				}),
				output("teamId", VariableTypeInteger, "Assigned or pending team ID."),
				output("assigneeId", VariableTypeInteger, "Assigned agent user ID."),
				output("message", VariableTypeString, "Customer-visible handoff notice."),
			},
		},
		NodeSpec{
			Type:        NodeTypeSendReply,
			Title:       "Send Reply",
			Description: "Return or commit customer-visible reply text.",
			RiskLevel:   NodeRiskLevelLow,
			InputSchema: []VariableSpec{
				requiredInput("replyText", VariableTypeString, "Customer-visible reply text."),
			},
			OutputSchema: []VariableSpec{
				output("sent", VariableTypeBoolean, "Whether the reply was sent."),
				output("replyMessageId", VariableTypeInteger, "Reply message ID."),
			},
		},
		NodeSpec{
			Type:        NodeTypeEnd,
			Title:       "End",
			Description: "End workflow execution.",
			RiskLevel:   NodeRiskLevelLow,
			OutputSchema: []VariableSpec{
				output("status", VariableTypeString, "Workflow terminal status."),
			},
		},
	)
}

func requiredInput(name string, variableType VariableType, description string) VariableSpec {
	return VariableSpec{Name: name, Type: variableType, Required: true, Description: description}
}

func optionalInput(name string, variableType VariableType, description string) VariableSpec {
	return VariableSpec{Name: name, Type: variableType, Description: description}
}

func output(name string, variableType VariableType, description string) VariableSpec {
	return VariableSpec{Name: name, Type: variableType, Description: description}
}

func enumOutput(name string, label string, description string, options []VariableValueOption) VariableSpec {
	return VariableSpec{
		Name:         name,
		Label:        label,
		Type:         VariableTypeString,
		Description:  description,
		Operators:    []string{"eq", "neq"},
		ValueOptions: options,
	}
}

func valueOption(value any, label string, description string) VariableValueOption {
	return VariableValueOption{Value: value, Label: label, Description: description}
}

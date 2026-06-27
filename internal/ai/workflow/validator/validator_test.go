package validator_test

import (
	"encoding/json"
	"strings"
	"testing"

	"agent-desk/internal/ai/workflow/dsl"
	"agent-desk/internal/ai/workflow/registry"
	"agent-desk/internal/ai/workflow/validator"
)

func TestValidateDefinitionAcceptsMinimalConversationFlow(t *testing.T) {
	result := validator.ValidateDefinition(minimalDefinition(), registry.DefaultRegistry())

	if !result.Valid {
		t.Fatalf("expected valid definition, got errors: %#v", result.Errors)
	}
}

func TestValidateDefinitionRejectsMissingStart(t *testing.T) {
	def := minimalDefinition()
	def.Nodes = []dsl.Node{
		{ID: "reply_1", Type: "send_reply", Config: json.RawMessage(`{"text":"hello"}`)},
		{ID: "end_1", Type: "end"},
	}

	result := validator.ValidateDefinition(def, registry.DefaultRegistry())

	if result.Valid {
		t.Fatalf("expected missing start to be invalid")
	}
	if !hasValidationMessage(result, "exactly one start node") {
		t.Fatalf("expected start error, got %#v", result.Errors)
	}
}

func TestValidateDefinitionRejectsUnknownNodeType(t *testing.T) {
	def := minimalDefinition()
	def.Nodes = append(def.Nodes, dsl.Node{ID: "unknown_1", Type: "unknown_node"})
	def.Edges = append(def.Edges, dsl.Edge{ID: "e3", Source: "reply_1", Target: "unknown_1"})

	result := validator.ValidateDefinition(def, registry.DefaultRegistry())

	if result.Valid {
		t.Fatalf("expected unknown node type to be invalid")
	}
	if !hasValidationMessage(result, "unknown node type") {
		t.Fatalf("expected unknown-node error, got %#v", result.Errors)
	}
}

func TestValidateDefinitionRejectsUnguardedCreateTicket(t *testing.T) {
	def := dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start_1",
		Nodes: []dsl.Node{
			{ID: "start_1", Type: "start"},
			{ID: "draft_1", Type: "prepare_ticket_draft"},
			{ID: "create_1", Type: "create_ticket"},
			{ID: "end_1", Type: "end"},
		},
		Edges: []dsl.Edge{
			{ID: "e1", Source: "start_1", Target: "draft_1"},
			{ID: "e2", Source: "draft_1", Target: "create_1"},
			{ID: "e3", Source: "create_1", Target: "end_1"},
		},
	}

	result := validator.ValidateDefinition(def, registry.DefaultRegistry())

	if result.Valid {
		t.Fatalf("expected unguarded create_ticket to be invalid")
	}
	if !hasValidationMessage(result, "requires human_confirm") {
		t.Fatalf("expected confirmation guard error, got %#v", result.Errors)
	}
}

func TestValidateDefinitionAcceptsConfirmedCreateTicket(t *testing.T) {
	def := dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start_1",
		Nodes: []dsl.Node{
			{ID: "start_1", Type: "start"},
			{ID: "draft_1", Type: "prepare_ticket_draft", Inputs: map[string]dsl.VariableSelector{
				"issue": {NodeID: "start_1", Field: "userMessage"},
			}},
			{ID: "confirm_1", Type: "human_confirm", Inputs: map[string]dsl.VariableSelector{
				"prompt": {NodeID: "start_1", Field: "userMessage"},
			}},
			{ID: "create_1", Type: "create_ticket", Inputs: map[string]dsl.VariableSelector{
				"ticketDraft": {NodeID: "draft_1", Field: "ticketDraft"},
				"confirmed":   {NodeID: "confirm_1", Field: "confirmed"},
			}},
			{ID: "end_1", Type: "end"},
		},
		Edges: []dsl.Edge{
			{ID: "e1", Source: "start_1", Target: "draft_1"},
			{ID: "e2", Source: "draft_1", Target: "confirm_1"},
			{ID: "e3", Source: "confirm_1", Target: "create_1"},
			{ID: "e4", Source: "create_1", Target: "end_1"},
		},
	}

	result := validator.ValidateDefinition(def, registry.DefaultRegistry())

	if !result.Valid {
		t.Fatalf("expected confirmed create_ticket to be valid, got %#v", result.Errors)
	}
}

func TestValidateDefinitionAcceptsDirectHandoffToHuman(t *testing.T) {
	def := dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start_1",
		Nodes: []dsl.Node{
			{ID: "start_1", Type: "start"},
			{ID: "handoff_1", Type: "handoff_to_human", Inputs: map[string]dsl.VariableSelector{
				"reason": {NodeID: "start_1", Field: "userMessage"},
			}},
			{ID: "end_1", Type: "end"},
		},
		Edges: []dsl.Edge{
			{ID: "e1", Source: "start_1", Target: "handoff_1"},
			{ID: "e2", Source: "handoff_1", Target: "end_1"},
		},
	}

	result := validator.ValidateDefinition(def, registry.DefaultRegistry())

	if !result.Valid {
		t.Fatalf("expected direct handoff_to_human to be valid, got %#v", result.Errors)
	}
}

func TestValidateDefinitionRejectsConfirmedInputFromNonConfirmNode(t *testing.T) {
	def := dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start_1",
		Nodes: []dsl.Node{
			{ID: "start_1", Type: "start"},
			{ID: "analysis_1", Type: "analyze_conversation", Inputs: map[string]dsl.VariableSelector{
				"userMessage": {NodeID: "start_1", Field: "userMessage"},
			}},
			{ID: "draft_1", Type: "prepare_ticket_draft", Inputs: map[string]dsl.VariableSelector{
				"issue": {NodeID: "start_1", Field: "userMessage"},
			}},
			{ID: "confirm_1", Type: "human_confirm", Inputs: map[string]dsl.VariableSelector{
				"prompt": {NodeID: "start_1", Field: "userMessage"},
			}},
			{ID: "create_1", Type: "create_ticket", Inputs: map[string]dsl.VariableSelector{
				"ticketDraft": {NodeID: "draft_1", Field: "ticketDraft"},
				"confirmed":   {NodeID: "analysis_1", Field: "needTicket"},
			}},
			{ID: "end_1", Type: "end"},
		},
		Edges: []dsl.Edge{
			{ID: "e1", Source: "start_1", Target: "analysis_1"},
			{ID: "e2", Source: "analysis_1", Target: "draft_1"},
			{ID: "e3", Source: "draft_1", Target: "confirm_1"},
			{ID: "e4", Source: "confirm_1", Target: "create_1"},
			{ID: "e5", Source: "create_1", Target: "end_1"},
		},
	}

	result := validator.ValidateDefinition(def, registry.DefaultRegistry())

	if result.Valid {
		t.Fatalf("expected confirmed input from non-confirm node to be invalid")
	}
	if !hasValidationMessage(result, "confirmed input must come from human_confirm.confirmed") {
		t.Fatalf("expected confirmed-source error, got %#v", result.Errors)
	}
}

func TestValidateDefinitionRejectsMissingRequiredInputMapping(t *testing.T) {
	def := minimalDefinition()
	def.Nodes[1].Inputs = nil

	result := validator.ValidateDefinition(def, registry.DefaultRegistry())

	if result.Valid {
		t.Fatalf("expected missing required input mapping to be invalid")
	}
	if !hasValidationMessage(result, "required input mapping is missing") {
		t.Fatalf("expected required-input error, got %#v", result.Errors)
	}
}

func TestValidateDefinitionRejectsUnknownInputSourceNode(t *testing.T) {
	def := mappedReplyDefinition()
	def.Nodes[1].Inputs["replyText"] = dsl.VariableSelector{NodeID: "missing_1", Field: "replyText"}

	result := validator.ValidateDefinition(def, registry.DefaultRegistry())

	if result.Valid {
		t.Fatalf("expected unknown input source node to be invalid")
	}
	if !hasValidationMessage(result, "input source node does not exist") {
		t.Fatalf("expected source-node error, got %#v", result.Errors)
	}
}

func TestValidateDefinitionRejectsUnknownInputSourceField(t *testing.T) {
	def := mappedReplyDefinition()
	def.Nodes[1].Inputs["replyText"] = dsl.VariableSelector{NodeID: "start_1", Field: "missing"}

	result := validator.ValidateDefinition(def, registry.DefaultRegistry())

	if result.Valid {
		t.Fatalf("expected unknown input source field to be invalid")
	}
	if !hasValidationMessage(result, "input source field does not exist") {
		t.Fatalf("expected source-field error, got %#v", result.Errors)
	}
}

func TestValidateDefinitionRejectsIncompatibleInputType(t *testing.T) {
	def := mappedReplyDefinition()
	def.Nodes[1].Inputs["replyText"] = dsl.VariableSelector{NodeID: "start_1", Field: "conversationId"}

	result := validator.ValidateDefinition(def, registry.DefaultRegistry())

	if result.Valid {
		t.Fatalf("expected incompatible input type to be invalid")
	}
	if !hasValidationMessage(result, "input type mismatch") {
		t.Fatalf("expected type-mismatch error, got %#v", result.Errors)
	}
}

func TestValidateDefinitionAcceptsMappedKnowledgeFlow(t *testing.T) {
	def := dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start_1",
		Nodes: []dsl.Node{
			{ID: "start_1", Type: "start"},
			{ID: "retrieve_1", Type: "knowledge_retrieve", Inputs: map[string]dsl.VariableSelector{
				"query": {NodeID: "start_1", Field: "userMessage"},
			}},
			{ID: "reply_1", Type: "send_reply", Inputs: map[string]dsl.VariableSelector{
				"replyText": {NodeID: "start_1", Field: "userMessage"},
			}},
			{ID: "end_1", Type: "end"},
		},
		Edges: []dsl.Edge{
			{ID: "e1", Source: "start_1", Target: "retrieve_1"},
			{ID: "e2", Source: "retrieve_1", Target: "reply_1"},
			{ID: "e3", Source: "reply_1", Target: "end_1"},
		},
	}

	result := validator.ValidateDefinition(def, registry.DefaultRegistry())

	if !result.Valid {
		t.Fatalf("expected mapped knowledge flow to be valid, got %#v", result.Errors)
	}
}

func TestValidateDefinitionRejectsUnknownConditionOperator(t *testing.T) {
	def := conditionDefinition()
	var config dsl.ConditionConfig
	if err := json.Unmarshal(def.Nodes[1].Config, &config); err != nil {
		t.Fatalf("unmarshal condition config: %v", err)
	}
	config.Branches[0].Condition.Operator = "regex"
	raw, err := json.Marshal(config)
	if err != nil {
		t.Fatalf("marshal condition config: %v", err)
	}
	def.Nodes[1].Config = raw

	result := validator.ValidateDefinition(def, registry.DefaultRegistry())

	if result.Valid {
		t.Fatalf("expected unknown condition operator to be invalid")
	}
	if !hasValidationMessage(result, "unsupported condition operator") {
		t.Fatalf("expected condition operator error, got %#v", result.Errors)
	}
}

func TestValidateDefinitionRejectsUnknownConditionVariable(t *testing.T) {
	def := conditionDefinition()
	var config dsl.ConditionConfig
	if err := json.Unmarshal(def.Nodes[1].Config, &config); err != nil {
		t.Fatalf("unmarshal condition config: %v", err)
	}
	config.Branches[0].Condition.Left.Field = "missing"
	raw, err := json.Marshal(config)
	if err != nil {
		t.Fatalf("marshal condition config: %v", err)
	}
	def.Nodes[1].Config = raw

	result := validator.ValidateDefinition(def, registry.DefaultRegistry())

	if result.Valid {
		t.Fatalf("expected unknown condition variable to be invalid")
	}
	if !hasValidationMessage(result, "condition source field does not exist") {
		t.Fatalf("expected condition variable error, got %#v", result.Errors)
	}
}

func TestValidateDefinitionRejectsInvalidConditionEnumValue(t *testing.T) {
	def := policyConditionDefinition("unknown_action")

	result := validator.ValidateDefinition(def, registry.DefaultRegistry())

	if result.Valid {
		t.Fatalf("expected invalid enum condition value to be rejected")
	}
	if !hasValidationMessage(result, "condition comparison value is not allowed") {
		t.Fatalf("expected condition enum value error, got %#v", result.Errors)
	}
}

func TestValidateDefinitionRejectsConditionDefaultBranchBeforeLast(t *testing.T) {
	def := conditionDefinition()
	var config dsl.ConditionConfig
	if err := json.Unmarshal(def.Nodes[1].Config, &config); err != nil {
		t.Fatalf("unmarshal condition config: %v", err)
	}
	config.Branches[0], config.Branches[1] = config.Branches[1], config.Branches[0]
	raw, err := json.Marshal(config)
	if err != nil {
		t.Fatalf("marshal condition config: %v", err)
	}
	def.Nodes[1].Config = raw

	result := validator.ValidateDefinition(def, registry.DefaultRegistry())

	if result.Valid {
		t.Fatalf("expected default branch before last to be invalid")
	}
	if !hasValidationMessage(result, "default condition branch must be last") {
		t.Fatalf("expected default branch order error, got %#v", result.Errors)
	}
}

func minimalDefinition() dsl.Definition {
	return dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start_1",
		Nodes: []dsl.Node{
			{ID: "start_1", Type: "start"},
			{ID: "reply_1", Type: "send_reply", Config: json.RawMessage(`{"text":"hello"}`), Inputs: map[string]dsl.VariableSelector{
				"replyText": {NodeID: "start_1", Field: "userMessage"},
			}},
			{ID: "end_1", Type: "end"},
		},
		Edges: []dsl.Edge{
			{ID: "e1", Source: "start_1", Target: "reply_1"},
			{ID: "e2", Source: "reply_1", Target: "end_1"},
		},
	}
}

func policyConditionDefinition(action any) dsl.Definition {
	conditionConfig, _ := json.Marshal(dsl.ConditionConfig{
		Branches: []dsl.ConditionBranch{
			{
				ID:           "direct",
				Name:         "Direct",
				TargetNodeID: "end_1",
				Condition: &dsl.Condition{
					Left:     &dsl.VariableSelector{NodeID: "policy_1", Field: "action"},
					Operator: "eq",
					Right:    action,
				},
			},
			{
				ID:           "default",
				Name:         "Default",
				TargetNodeID: "end_1",
				Default:      true,
			},
		},
	})
	return dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start_1",
		Nodes: []dsl.Node{
			{ID: "start_1", Type: "start"},
			{ID: "understanding_1", Type: "conversation_understanding", Inputs: map[string]dsl.VariableSelector{
				"userMessage": {NodeID: "start_1", Field: "userMessage"},
			}},
			{ID: "policy_1", Type: "reply_policy", Inputs: map[string]dsl.VariableSelector{
				"messageIntent": {NodeID: "understanding_1", Field: "messageIntent"},
				"answerScope":   {NodeID: "understanding_1", Field: "answerScope"},
			}},
			{ID: "condition_1", Type: "condition", Config: conditionConfig},
			{ID: "end_1", Type: "end"},
		},
		Edges: []dsl.Edge{
			{ID: "e1", Source: "start_1", Target: "understanding_1"},
			{ID: "e2", Source: "understanding_1", Target: "policy_1"},
			{ID: "e3", Source: "policy_1", Target: "condition_1"},
			{ID: "e4", Source: "condition_1", Target: "end_1"},
			{ID: "e5", Source: "condition_1", Target: "end_1"},
		},
	}
}

func mappedReplyDefinition() dsl.Definition {
	def := minimalDefinition()
	def.Nodes[1].Inputs = map[string]dsl.VariableSelector{
		"replyText": {NodeID: "start_1", Field: "userMessage"},
	}
	return def
}

func conditionDefinition() dsl.Definition {
	conditionConfig, _ := json.Marshal(dsl.ConditionConfig{
		Branches: []dsl.ConditionBranch{
			{
				ID:           "hello",
				Name:         "Hello",
				TargetNodeID: "end_1",
				Condition: &dsl.Condition{
					Left:     &dsl.VariableSelector{NodeID: "start_1", Field: "userMessage"},
					Operator: "eq",
					Right:    "hello",
				},
			},
			{
				ID:           "default",
				Name:         "Default",
				TargetNodeID: "end_1",
				Default:      true,
			},
		},
	})
	return dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start_1",
		Nodes: []dsl.Node{
			{ID: "start_1", Type: "start"},
			{ID: "condition_1", Type: "condition", Config: conditionConfig},
			{ID: "end_1", Type: "end"},
		},
		Edges: []dsl.Edge{
			{ID: "e1", Source: "start_1", Target: "condition_1"},
			{ID: "e2", Source: "condition_1", Target: "end_1"},
			{ID: "e3", Source: "condition_1", Target: "end_1"},
		},
	}
}

func hasValidationMessage(result validator.Result, want string) bool {
	for _, item := range result.Errors {
		if strings.Contains(item.Message, want) {
			return true
		}
	}
	return false
}

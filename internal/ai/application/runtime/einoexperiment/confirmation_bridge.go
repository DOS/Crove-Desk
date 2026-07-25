package einoexperiment

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	applicationruntime "agent-desk/internal/ai/application/runtime"
	"agent-desk/internal/ai/runtime/graphs"
)

const confirmationInterruptType = "human_confirm"

// ConfirmationRequest represents a high-risk Eino tool action that must pause
// at AgentDesk's existing conversation-interrupt boundary.
type ConfirmationRequest struct {
	InterruptID string
	ToolCode    string
	Prompt      string
	Arguments   map[string]any
}

type confirmationCheckpoint struct {
	Version     int            `json:"version"`
	Engine      string         `json:"engine"`
	InterruptID string         `json:"interruptId"`
	ToolCode    string         `json:"toolCode"`
	Arguments   map[string]any `json:"arguments"`
}

// BuildConfirmationResult returns the generic interrupted result consumed by
// replyInterruptService. That service persists ConversationInterrupt from the
// result, so this package remains independent of database writes.
func BuildConfirmationResult(input applicationruntime.RunInput, request ConfirmationRequest) (*applicationruntime.RunResult, error) {
	interruptID := strings.TrimSpace(request.InterruptID)
	if interruptID == "" {
		interruptID = "eino_confirm"
	}
	toolCode := strings.TrimSpace(request.ToolCode)
	if toolCode == "" {
		return nil, fmt.Errorf("confirmation tool code is required")
	}
	prompt := strings.TrimSpace(request.Prompt)
	if prompt == "" {
		return nil, fmt.Errorf("confirmation prompt is required")
	}
	checkpointData, err := json.Marshal(confirmationCheckpoint{
		Version: 1, Engine: "eino", InterruptID: interruptID, ToolCode: toolCode, Arguments: cloneConfirmationArguments(request.Arguments),
	})
	if err != nil {
		return nil, fmt.Errorf("encode Eino confirmation checkpoint: %w", err)
	}
	return &applicationruntime.RunResult{
		Status:         "interrupted",
		Interrupted:    true,
		CheckPointID:   confirmationCheckpointID(input, interruptID, toolCode, checkpointData),
		CheckPointData: string(checkpointData),
		Interrupts: []applicationruntime.InterruptContextSummary{{
			Type: confirmationInterruptType, ID: interruptID, InfoPreview: string(mustMarshalConfirmationPrompt(prompt)),
		}},
	}, nil
}

// ResumeConfirmation reads the generic ResumeInput populated by the existing
// AgentApplicationService and validates that it belongs to this checkpoint.
func ResumeConfirmation(checkPointData string, input applicationruntime.ResumeInput) (string, confirmationCheckpoint, error) {
	checkpoint := confirmationCheckpoint{}
	if err := json.Unmarshal([]byte(strings.TrimSpace(checkPointData)), &checkpoint); err != nil {
		return "", checkpoint, fmt.Errorf("decode Eino confirmation checkpoint: %w", err)
	}
	if checkpoint.Version != 1 || checkpoint.Engine != "eino" || strings.TrimSpace(checkpoint.InterruptID) == "" || strings.TrimSpace(checkpoint.ToolCode) == "" {
		return "", checkpoint, fmt.Errorf("invalid Eino confirmation checkpoint")
	}
	decision := graphs.ParseConfirmationDecision(strings.TrimSpace(input.ResumeData[checkpoint.InterruptID]))
	if decision == "" {
		return "", checkpoint, fmt.Errorf("Eino confirmation decision is required")
	}
	return string(decision), checkpoint, nil
}

func confirmationCheckpointID(input applicationruntime.RunInput, interruptID, toolCode string, data []byte) string {
	digest := sha256.Sum256(append([]byte(strings.TrimSpace(toolCode)+":"+strings.TrimSpace(interruptID)+":"), data...))
	return fmt.Sprintf("eino:%d:%d:%s", input.Conversation.ID, input.UserMessage.ID, hex.EncodeToString(digest[:8]))
}

func cloneConfirmationArguments(input map[string]any) map[string]any {
	if len(input) == 0 {
		return map[string]any{}
	}
	ret := make(map[string]any, len(input))
	for key, value := range input {
		ret[key] = value
	}
	return ret
}

func mustMarshalConfirmationPrompt(prompt string) []byte {
	data, _ := json.Marshal(map[string]string{"message": prompt})
	return data
}

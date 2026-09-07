package third

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	"agent-desk/internal/services"

	"github.com/gin-gonic/gin"
)

// ViberPostWebhook receives incoming callbacks from Viber.
//
// For a conversation_started callback with a welcome message configured,
// the welcome message JSON is written to the response body as required
// by the Viber API.
func ViberPostWebhook(ctx *gin.Context) {
	channelID := strings.TrimSpace(ctx.Param("channel_id"))
	if channelID == "" {
		channelID = strings.TrimSpace(ctx.Query("channel_id"))
	}

	signature := ctx.GetHeader("X-Viber-Content-Signature")

	bodyBytes, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "failed to read body"})
		return
	}
	ctx.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	responseBody, err := services.ViberInboundService.HandleWebhook(ctx.Request.Context(), channelID, signature, bodyBytes)
	if err != nil {
		ctx.JSON(http.StatusOK, gin.H{"ok": false, "error": err.Error()})
		return
	}

	if responseBody != "" {
		ctx.Data(http.StatusOK, "application/json", []byte(responseBody))
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"ok": true})
}

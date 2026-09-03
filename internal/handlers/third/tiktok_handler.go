package third

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	"agent-desk/internal/services"

	"github.com/gin-gonic/gin"
)

// TikTokGetWebhook handles TikTok webhook verification if required.
func TikTokGetWebhook(ctx *gin.Context) {
	challenge := strings.TrimSpace(ctx.Query("challenge"))
	if challenge != "" {
		ctx.String(http.StatusOK, challenge)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"ok": true})
}

// TikTokPostWebhook receives incoming Direct Message events from TikTok Business Messaging.
func TikTokPostWebhook(ctx *gin.Context) {
	channelID := strings.TrimSpace(ctx.Param("channel_id"))
	if channelID == "" {
		channelID = strings.TrimSpace(ctx.Query("channel_id"))
	}

	verifyTokenHeader := ctx.GetHeader("X-Tiktok-Verify-Token")
	if verifyTokenHeader == "" {
		verifyTokenHeader = ctx.GetHeader("X-Webhook-Verify-Token")
	}

	bodyBytes, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "failed to read body"})
		return
	}
	ctx.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	if err := services.TikTokInboundService.HandleWebhook(ctx.Request.Context(), channelID, verifyTokenHeader, bodyBytes); err != nil {
		ctx.JSON(http.StatusOK, gin.H{"ok": false, "error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"ok": true, "message": "EVENT_RECEIVED"})
}

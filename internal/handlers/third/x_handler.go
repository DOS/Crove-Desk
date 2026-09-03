package third

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	"agent-desk/internal/services"

	"github.com/gin-gonic/gin"
)

// XGetWebhook handles X (Twitter) Account Activity API CRC (Challenge-Response Check).
func XGetWebhook(ctx *gin.Context) {
	crcToken := strings.TrimSpace(ctx.Query("crc_token"))
	channelID := strings.TrimSpace(ctx.Param("channel_id"))
	if channelID == "" {
		channelID = strings.TrimSpace(ctx.Query("channel_id"))
	}

	responseToken, err := services.XInboundService.HandleCRC(channelID, crcToken)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"response_token": responseToken})
}

// XPostWebhook receives incoming Direct Message events from X Account Activity API.
func XPostWebhook(ctx *gin.Context) {
	channelID := strings.TrimSpace(ctx.Param("channel_id"))
	if channelID == "" {
		channelID = strings.TrimSpace(ctx.Query("channel_id"))
	}

	sigHeader := ctx.GetHeader("x-twitter-webhooks-signature")
	if sigHeader == "" {
		sigHeader = ctx.GetHeader("X-Twitter-Webhooks-Signature")
	}

	bodyBytes, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "failed to read body"})
		return
	}
	ctx.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	if err := services.XInboundService.HandleWebhook(ctx.Request.Context(), channelID, sigHeader, bodyBytes); err != nil {
		ctx.JSON(http.StatusOK, gin.H{"ok": false, "error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"ok": true})
}

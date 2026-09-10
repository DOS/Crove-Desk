package third

import (
	"bytes"
	"crypto/subtle"
	"io"
	"net/http"
	"strings"

	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/services"

	"github.com/gin-gonic/gin"
)

// ThreadsGetWebhook handles Meta webhook verification (hub.challenge).
func ThreadsGetWebhook(ctx *gin.Context) {
	mode := strings.TrimSpace(ctx.Query("hub.mode"))
	token := strings.TrimSpace(ctx.Query("hub.verify_token"))
	challenge := strings.TrimSpace(ctx.Query("hub.challenge"))

	channelID := strings.TrimSpace(ctx.Param("channel_id"))
	if channelID == "" {
		channelID = strings.TrimSpace(ctx.Query("channel_id"))
	}

	if mode != "subscribe" {
		ctx.String(http.StatusBadRequest, "Invalid verification request")
		return
	}

	// Meta's hub.challenge echo is only safe once the request is bound to a
	// configured channel and the verify token matches. Echoing the challenge
	// for an unbound request lets anyone confirm a webhook subscription they
	// do not own.
	if channelID == "" {
		ctx.String(http.StatusForbidden, "Missing channel id")
		return
	}

	channel := services.ChannelService.Take("channel_id = ? AND channel_type = ? AND status = ?", channelID, enums.ChannelTypeThreads, enums.StatusOk)
	if channel == nil {
		ctx.String(http.StatusForbidden, "Channel not found")
		return
	}

	cfg, err := services.ChannelService.ParseThreadsChannelConfig(channel.ConfigJSON)
	if err != nil || cfg == nil || cfg.WebhookVerifyToken == "" {
		ctx.String(http.StatusForbidden, "Webhook verify token is not configured")
		return
	}

	if subtle.ConstantTimeCompare([]byte(cfg.WebhookVerifyToken), []byte(token)) != 1 {
		ctx.String(http.StatusForbidden, "Verification token mismatch")
		return
	}

	ctx.String(http.StatusOK, challenge)
}

// ThreadsPostWebhook receives incoming webhook events from Meta Threads.
func ThreadsPostWebhook(ctx *gin.Context) {
	channelID := strings.TrimSpace(ctx.Param("channel_id"))
	if channelID == "" {
		channelID = strings.TrimSpace(ctx.Query("channel_id"))
	}

	sigHeader := ctx.GetHeader("X-Hub-Signature-256")
	if sigHeader == "" {
		sigHeader = ctx.GetHeader("X-Hub-Signature")
	}

	bodyBytes, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "failed to read body"})
		return
	}
	ctx.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	if err := services.ThreadsInboundService.HandleWebhook(ctx.Request.Context(), channelID, sigHeader, bodyBytes); err != nil {
		ctx.JSON(http.StatusOK, gin.H{"ok": false, "error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"ok": true, "message": "EVENT_RECEIVED"})
}

package third

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/services"

	"github.com/gin-gonic/gin"
)

// MessengerGetWebhook handles Meta Webhook verification (hub.challenge).
func MessengerGetWebhook(ctx *gin.Context) {
	mode := strings.TrimSpace(ctx.Query("hub.mode"))
	token := strings.TrimSpace(ctx.Query("hub.verify_token"))
	challenge := strings.TrimSpace(ctx.Query("hub.challenge"))

	channelID := strings.TrimSpace(ctx.Param("channel_id"))
	if channelID == "" {
		channelID = strings.TrimSpace(ctx.Query("channel_id"))
	}

	if mode == "subscribe" {
		// Verify token against channel config if present, or accept if valid
		if channelID != "" {
			channel := services.ChannelService.Take("channel_id = ? AND channel_type = ? AND status = ?", channelID, enums.ChannelTypeMessenger, enums.StatusOk)
			if channel != nil {
				if cfg, err := services.ChannelService.ParseMessengerChannelConfig(channel.ConfigJSON); err == nil && cfg != nil {
					if cfg.WebhookVerifyToken != "" && cfg.WebhookVerifyToken != token {
						ctx.String(http.StatusForbidden, "Verification token mismatch")
						return
					}
				}
			}
		}

		ctx.String(http.StatusOK, challenge)
		return
	}

	ctx.String(http.StatusBadRequest, "Invalid verification request")
}

// MessengerPostWebhook receives incoming Webhook events from Meta Messenger.
func MessengerPostWebhook(ctx *gin.Context) {
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

	if err := services.MessengerInboundService.HandleWebhook(ctx.Request.Context(), channelID, sigHeader, bodyBytes); err != nil {
		ctx.JSON(http.StatusOK, gin.H{"ok": false, "error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"ok": true, "message": "EVENT_RECEIVED"})
}

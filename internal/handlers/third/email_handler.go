package third

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	"agent-desk/internal/services"

	"github.com/gin-gonic/gin"
)

// EmailPostWebhook receives incoming inbound email webhook events from Brevo, SendGrid, Postmark or SMTP forwarders.
func EmailPostWebhook(ctx *gin.Context) {
	channelID := strings.TrimSpace(ctx.Param("channel_id"))
	if channelID == "" {
		channelID = strings.TrimSpace(ctx.Query("channel_id"))
	}

	secretHeader := ctx.GetHeader("X-Webhook-Secret")
	if secretHeader == "" {
		secretHeader = ctx.GetHeader("X-Brevo-Webhook-Secret")
	}
	if secretHeader == "" {
		secretHeader = ctx.Query("secret")
	}

	bodyBytes, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "failed to read body"})
		return
	}
	ctx.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	if err := services.EmailInboundService.HandleWebhook(ctx.Request.Context(), channelID, secretHeader, bodyBytes); err != nil {
		ctx.JSON(http.StatusOK, gin.H{"ok": false, "error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"ok": true, "message": "email processed"})
}

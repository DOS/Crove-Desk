package api

import (
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/httpx"
	"agent-desk/internal/pkg/httpx/params"
	"agent-desk/internal/services"
	"bytes"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

func DOSOrgSyncWebhook(ctx *gin.Context) {
	bodyBytes, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}
	ctx.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	signature := ctx.GetHeader("X-DOS-Signature")
	if !services.WebhookSyncService.VerifySignature(bodyBytes, signature) {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
		return
	}

	req := request.DOSOrgSyncWebhookRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	if err := services.WebhookSyncService.HandleDOSOrgSync(req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	httpx.WriteJSON(ctx, gin.H{"success": true})
}

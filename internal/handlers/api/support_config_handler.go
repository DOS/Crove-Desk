package api

import (
	"agent-desk/internal/pkg/httpx"
	"agent-desk/internal/services"

	"github.com/gin-gonic/gin"
)

func SupportConfigGetConfig(ctx *gin.Context) {
	httpx.WriteJSON(ctx, services.SystemConfigService.GetPublicSupportConfig())
}

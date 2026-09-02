package migration

import (
	"fmt"
	"strings"
	"time"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/repositories"

	"github.com/mlogclub/simple/sqls"
)

func init() {
	register(11, "auto provision default agent team and agent profiles", func() error {
		return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
			team := repositories.AgentTeamRepository.FindOne(ctx.Tx, sqls.NewCnd().Eq("status", enums.StatusOk).Asc("id"))
			if team == nil || team.ID <= 0 {
				team = &models.AgentTeam{
					Name:        "Support Team",
					Status:      enums.StatusOk,
					Description: "Default Support Team",
					AuditFields: models.AuditFields{
						CreatedAt:      time.Now(),
						UpdatedAt:      time.Now(),
						CreateUserName: "migration",
						UpdateUserName: "migration",
					},
				}
				if err := repositories.AgentTeamRepository.Create(ctx.Tx, team); err != nil {
					return err
				}
			}

			var users []models.User
			if err := ctx.Tx.Where("deleted_at IS NULL").Find(&users).Error; err != nil {
				return err
			}

			for _, user := range users {
				existing := repositories.AgentProfileRepository.FindOne(ctx.Tx, sqls.NewCnd().Eq("user_id", user.ID))
				if existing != nil && existing.ID > 0 {
					continue
				}

				displayName := strings.TrimSpace(user.Nickname)
				if displayName == "" {
					displayName = strings.TrimSpace(user.Username)
				}
				if displayName == "" {
					displayName = fmt.Sprintf("Agent #%d", user.ID)
				}

				agentCode := fmt.Sprintf("A%04d", user.ID)
				if codeExist := repositories.AgentProfileRepository.FindOne(ctx.Tx, sqls.NewCnd().Eq("agent_code", agentCode)); codeExist != nil {
					agentCode = fmt.Sprintf("A%d%d", user.ID, time.Now().Unix()%1000)
				}

				profile := &models.AgentProfile{
					UserID:                user.ID,
					TeamID:                team.ID,
					AgentCode:             agentCode,
					DisplayName:           displayName,
					Avatar:                strings.TrimSpace(user.Avatar),
					ServiceStatus:         enums.ServiceStatusIdle,
					MaxConcurrentCount:    5,
					PriorityLevel:         0,
					AutoAssignEnabled:     true,
					ReceiveOfflineMessage: false,
					Status:                enums.StatusOk,
					AuditFields: models.AuditFields{
						CreatedAt:      time.Now(),
						UpdatedAt:      time.Now(),
						CreateUserID:   user.ID,
						CreateUserName: user.Username,
						UpdateUserID:   user.ID,
						UpdateUserName: user.Username,
					},
				}

				if err := repositories.AgentProfileRepository.Create(ctx.Tx, profile); err != nil {
					return err
				}
			}

			return nil
		})
	})
}

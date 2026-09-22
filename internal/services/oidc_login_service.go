package services

import (
	"agent-desk/internal/models"
	"agent-desk/internal/oidcclient"
	"agent-desk/internal/pkg/config"
	"agent-desk/internal/pkg/constants"
	"agent-desk/internal/pkg/dto/response"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/repositories"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

var OIDCLoginService = newOIDCLoginService()

type oidcLoginService struct {
}

type oidcLoginProfile = oidcclient.Profile
type oidcLoginProfileOrg = oidcclient.OrganizationClaim
type oidcLoginProfileTeam = oidcclient.TeamClaim

func newOIDCLoginService() *oidcLoginService {
	return &oidcLoginService{}
}

func (s *oidcLoginService) BuildOIDCLoginURL(next string) (string, error) {
	return oidcclient.BuildAuthCodeURL(next)
}

func (s *oidcLoginService) LoginByOIDC(ctx context.Context, code, state string, authCfg config.AuthConfig, clientIP, userAgent string) (string, string, error) {
	next, verifier, err := oidcclient.ParseState(state)
	if err != nil {
		return "", "", err
	}
	profile, err := oidcclient.ExchangeCode(ctx, code, verifier)
	if err != nil {
		return "", "", err
	}
	loginResp, err := s.loginWithOIDCProfile(profile, authCfg, clientIP, userAgent, IsSupportPortalNext(next))
	if err != nil {
		return "", "", err
	}
	ticket, err := oidcclient.IssueLoginTicket(loginResp)
	if err != nil {
		return "", "", err
	}
	return ticket, next, nil
}

func (s *oidcLoginService) ExchangeOIDCLoginTicket(ticket string) (*response.LoginResponse, error) {
	return oidcclient.ConsumeLoginTicket(ticket)
}

// NextFromState recovers the sanitized redirect target carried by a signed
// OIDC state. Handlers use it after a failed round-trip so an IdP error
// bounces back to the login surface that started the flow. It returns an
// empty string when the state is missing, expired, or fails verification.
func (s *oidcLoginService) NextFromState(state string) string {
	next, _, err := oidcclient.ParseState(state)
	if err != nil {
		return ""
	}
	return next
}

// IsSupportPortalNext reports whether the OIDC round-trip started from the
// customer support portal rather than the staff dashboard. The portal always
// targets /support/* paths (see getSupportLoginDestination), so the signed
// state's next path identifies the entry surface without extra parameters.
// Portal-origin logins provision customer-type users without staff roles;
// only the staff surface (/dashboard/login) grants staff access. Handlers
// also use it to route failed round-trips back to the originating surface.
func IsSupportPortalNext(next string) bool {
	next = strings.TrimSpace(next)
	return next == "/support" || strings.HasPrefix(next, "/support/")
}

func (s *oidcLoginService) loginWithOIDCProfile(profile *oidcLoginProfile, authCfg config.AuthConfig, clientIP, userAgent string, portalOrigin bool) (*response.LoginResponse, error) {
	if profile == nil || strings.TrimSpace(profile.Subject) == "" {
		return nil, errorsx.BusinessErrorI18n(2, "error.oidc.profileMissing")
	}

	var ret *response.LoginResponse
	err := sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		var (
			identity = repositories.UserIdentityRepository.GetBy(ctx.Tx, enums.ThirdProviderOIDC, "", profile.Subject)
			user     *models.User
			err      error
		)
		if identity == nil {
			user, identity, err = s.createOIDCUser(ctx, profile, portalOrigin)
			if err != nil {
				return err
			}
		} else {
			if identity.Status != enums.StatusOk {
				return errorsx.BusinessErrorI18n(3, "error.oidc.bindingDisabled")
			}
			user = repositories.UserRepository.Get(ctx.Tx, identity.UserID)
			if user == nil {
				return errorsx.BusinessErrorI18n(4, "error.oidc.boundUserMissing")
			}
		}

		if user.Status != enums.StatusOk {
			return errorsx.UnauthorizedI18n("error.e0200")
		}

		userUpdates := map[string]any{
			"nickname":         s.resolveOIDCNickname(user.Nickname, profile),
			"avatar":           s.resolveOIDCAvatar(user.Avatar, profile),
			"last_login_at":    time.Now(),
			"last_login_ip":    clientIP,
			"update_user_id":   user.ID,
			"update_user_name": user.Username,
			"updated_at":       time.Now(),
		}
		if (user.Email == nil || *user.Email == "") && profile.Email != "" {
			if email := s.availableEmail(ctx.Tx, profile.Email); email != nil {
				userUpdates["email"] = *email
			}
		}

		if err = repositories.UserRepository.Updates(ctx.Tx, user.ID, userUpdates); err != nil {
			return err
		}

		// Staff provisioning (roles, org/team sync, agent profile) runs only
		// for staff-surface logins. A customer signing in through the support
		// portal must never receive a staff seat: the dashboard middleware
		// rejects non-employee users, and that type is set at creation only.
		if !portalOrigin {
			s.ensureDefaultOIDCRole(ctx.Tx, user)
			s.ensureBreakGlassAdminRole(ctx.Tx, authCfg, user, profile)
			s.syncOIDCUserOrganizations(ctx.Tx, user, profile)
			s.syncOIDCUserTeams(ctx.Tx, user, profile)
			_, _ = AgentProfileService.EnsureAgentProfileForUser(ctx.Tx, user)
		}

		if err = repositories.UserIdentityRepository.Updates(ctx.Tx, identity.ID, map[string]any{
			"provider_name":    enums.GetThirdProviderLabel(enums.ThirdProviderOIDC),
			"raw_profile":      profile.RawProfile,
			"last_auth_at":     time.Now(),
			"status":           enums.StatusOk,
			"update_user_id":   user.ID,
			"update_user_name": user.Username,
			"updated_at":       time.Now(),
		}); err != nil {
			return err
		}

		ret, err = AuthService.issueTokens(ctx, user, clientIP, userAgent, authCfg)
		return err
	})
	if err != nil {
		return nil, err
	}
	return ret, nil
}

func (s *oidcLoginService) createOIDCUser(ctx *sqls.TxContext, profile *oidcLoginProfile, portalOrigin bool) (*models.User, *models.UserIdentity, error) {
	now := time.Now()
	email := s.availableEmail(ctx.Tx, profile.Email)
	username := s.availableUsername(ctx.Tx, profile)

	userType := enums.UserTypeEmployee
	if portalOrigin {
		userType = enums.UserTypeUser
	}

	user := &models.User{
		Username:     username,
		Nickname:     s.resolveOIDCNickname("", profile),
		Avatar:       s.resolveOIDCAvatar("", profile),
		Email:        email,
		Password:     "",
		PasswordSalt: "",
		UserType:     userType,
		Status:       enums.StatusOk,
		AuditFields: models.AuditFields{
			CreatedAt:      now,
			CreateUserID:   0,
			CreateUserName: enums.GetThirdProviderLabel(enums.ThirdProviderOIDC),
			UpdatedAt:      now,
			UpdateUserID:   0,
			UpdateUserName: enums.GetThirdProviderLabel(enums.ThirdProviderOIDC),
		},
	}
	if err := repositories.UserRepository.Create(ctx.Tx, user); err != nil {
		return nil, nil, err
	}

	identity := &models.UserIdentity{
		UserID:         user.ID,
		Provider:       enums.ThirdProviderOIDC,
		ProviderUserID: strings.TrimSpace(profile.Subject),
		ProviderCorpID: "",
		ProviderName:   enums.GetThirdProviderLabel(enums.ThirdProviderOIDC),
		RawProfile:     profile.RawProfile,
		Status:         enums.StatusOk,
		LastAuthAt:     &now,
		AuditFields: models.AuditFields{
			CreatedAt:      now,
			CreateUserID:   user.ID,
			CreateUserName: user.Username,
			UpdatedAt:      now,
			UpdateUserID:   user.ID,
			UpdateUserName: user.Username,
		},
	}
	if err := repositories.UserIdentityRepository.Create(ctx.Tx, identity); err != nil {
		return nil, nil, err
	}
	if !portalOrigin {
		s.ensureDefaultOIDCRole(ctx.Tx, user)
	}
	return user, identity, nil
}

func (s *oidcLoginService) availableEmail(tx *gorm.DB, email string) *string {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" || repositories.UserRepository.GetByEmail(tx, email) != nil {
		return nil
	}
	return &email
}

func (s *oidcLoginService) availableUsername(tx *gorm.DB, profile *oidcLoginProfile) string {
	for _, candidate := range []string{
		profile.PreferredUsername,
		strings.Split(strings.TrimSpace(profile.Email), "@")[0],
	} {
		username := normalizeOIDCUsername(candidate)
		if username != "" && repositories.UserRepository.GetByUsername(tx, username) == nil {
			return username
		}
	}
	base := "oidc_" + shortSubjectHash(profile.Subject)
	if repositories.UserRepository.GetByUsername(tx, base) == nil {
		return base
	}
	for i := 1; i < 100; i++ {
		username := base + "_" + strconv.Itoa(i)
		if repositories.UserRepository.GetByUsername(tx, username) == nil {
			return username
		}
	}
	return base + "_" + shortSubjectHash(time.Now().String())
}

func (s *oidcLoginService) resolveOIDCNickname(current string, profile *oidcLoginProfile) string {
	if profile != nil {
		for _, candidate := range []string{profile.Name, profile.PreferredUsername, profile.Email, profile.Subject} {
			if candidate = strings.TrimSpace(candidate); candidate != "" {
				return candidate
			}
		}
	}
	return strings.TrimSpace(current)
}

func (s *oidcLoginService) resolveOIDCAvatar(current string, profile *oidcLoginProfile) string {
	if profile != nil {
		if picture := strings.TrimSpace(profile.Picture); picture != "" {
			return picture
		}
	}
	return strings.TrimSpace(current)
}

func normalizeOIDCUsername(value string) string {
	value = strings.TrimSpace(strings.ToLower(value))
	var b strings.Builder
	for _, r := range value {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' || r == '-' || r == '.' {
			b.WriteRune(r)
		}
	}
	ret := strings.Trim(b.String(), "._-")
	if len(ret) > 100 {
		ret = ret[:100]
	}
	return ret
}

func shortSubjectHash(subject string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(subject)))
	return hex.EncodeToString(sum[:])[:16]
}

// ensureDefaultOIDCRole gives a first-time OIDC user the lowest staff role.
// Administrative roles are only derived from explicit DOS ID organization or
// team claims (see syncOIDCUserOrganizations / syncOIDCUserTeams); a missing
// or empty claim set must never escalate to admin.

func (s *oidcLoginService) ensureDefaultOIDCRole(tx *gorm.DB, user *models.User) {
	if user == nil || user.ID <= 0 {
		return
	}
	existingRole := repositories.UserRoleRepository.FindOne(tx, sqls.NewCnd().Eq("user_id", user.ID))
	if existingRole != nil {
		return
	}
	defaultRole := repositories.RoleRepository.GetByCode(tx, constants.RoleCodeCsUser)
	if defaultRole == nil {
		return
	}
	now := time.Now()
	_ = repositories.UserRoleRepository.Create(tx, &models.UserRole{
		UserID: user.ID,
		RoleID: defaultRole.ID,
		AuditFields: models.AuditFields{
			CreatedAt:      now,
			CreateUserID:   user.ID,
			CreateUserName: user.Username,
			UpdatedAt:      now,
			UpdateUserID:   user.ID,
			UpdateUserName: user.Username,
		},
	})
}

func (s *oidcLoginService) syncOIDCUserOrganizations(tx *gorm.DB, user *models.User, profile *oidcLoginProfile) {
	if user == nil || user.ID <= 0 {
		return
	}
	now := time.Now()
	var activeOrgID int64 = user.ActiveOrgID

	if len(profile.Organizations) > 0 {
		for _, orgClaim := range profile.Organizations {
			orgCode := strings.TrimSpace(orgClaim.ID)
			if orgCode == "" {
				continue
			}
			orgName := strings.TrimSpace(orgClaim.Name)
			if orgName == "" {
				orgName = orgCode
			}
			role := strings.ToUpper(strings.TrimSpace(orgClaim.Role))
			if role == "" {
				role = "MEMBER"
			}

			// Organization ADMIN/OWNER claims are the only OIDC path to the
			// Desk admin role; plain members keep the default staff role.
			if role == "ADMIN" || role == "OWNER" {
				s.ensureOrganisationAdminRole(tx, user)
			}

			org := repositories.OrganizationRepository.GetByCode(tx, orgCode)
			if org == nil {
				org = &models.Organization{
					Code:   orgCode,
					Name:   orgName,
					Plan:   "free",
					Status: enums.StatusOk,
					AuditFields: models.AuditFields{
						CreatedAt:      now,
						CreateUserID:   user.ID,
						CreateUserName: user.Username,
						UpdatedAt:      now,
						UpdateUserID:   user.ID,
						UpdateUserName: user.Username,
					},
				}
				if err := repositories.OrganizationRepository.Create(tx, org); err != nil {
					continue
				}
			} else if orgName != "" && org.Name != orgName {
				_ = repositories.OrganizationRepository.UpdateColumn(tx, org.ID, "name", orgName)
			}

			member := repositories.OrganizationMemberRepository.GetByOrgAndUser(tx, org.ID, user.ID)
			if member == nil {
				member = &models.OrganizationMember{
					OrganizationID: org.ID,
					UserID:         user.ID,
					Role:           role,
					Status:         enums.StatusOk,
					AuditFields: models.AuditFields{
						CreatedAt:      now,
						CreateUserID:   user.ID,
						CreateUserName: user.Username,
						UpdatedAt:      now,
						UpdateUserID:   user.ID,
						UpdateUserName: user.Username,
					},
				}
				_ = repositories.OrganizationMemberRepository.Create(tx, member)
			} else if member.Role != role || member.Status != enums.StatusOk {
				_ = repositories.OrganizationMemberRepository.Updates(tx, member.ID, map[string]any{
					"role":             role,
					"status":           enums.StatusOk,
					"update_user_id":   user.ID,
					"update_user_name": user.Username,
					"updated_at":       now,
				})
			}

			if activeOrgID == 0 || (profile.ActiveOrgID != "" && (profile.ActiveOrgID == orgCode || profile.ActiveOrgID == orgClaim.Slug)) {
				activeOrgID = org.ID
			}
		}
	} else {
		existingMemberships := repositories.OrganizationMemberRepository.Find(tx, sqls.NewCnd().Eq("user_id", user.ID).Eq("status", enums.StatusOk))
		if len(existingMemberships) == 0 {
			defaultOrgCode := "org_" + shortSubjectHash(profile.Subject)
			defaultOrgName := s.resolveOIDCNickname(user.Nickname, profile) + "'s Workspace"
			org := repositories.OrganizationRepository.GetByCode(tx, defaultOrgCode)
			if org == nil {
				org = &models.Organization{
					Code:   defaultOrgCode,
					Name:   defaultOrgName,
					Plan:   "free",
					Status: enums.StatusOk,
					AuditFields: models.AuditFields{
						CreatedAt:      now,
						CreateUserID:   user.ID,
						CreateUserName: user.Username,
						UpdatedAt:      now,
						UpdateUserID:   user.ID,
						UpdateUserName: user.Username,
					},
				}
				_ = repositories.OrganizationRepository.Create(tx, org)
			}
			if org.ID > 0 {
				_ = repositories.OrganizationMemberRepository.Create(tx, &models.OrganizationMember{
					OrganizationID: org.ID,
					UserID:         user.ID,
					Role:           "OWNER",
					Status:         enums.StatusOk,
					AuditFields: models.AuditFields{
						CreatedAt:      now,
						CreateUserID:   user.ID,
						CreateUserName: user.Username,
						UpdatedAt:      now,
						UpdateUserID:   user.ID,
						UpdateUserName: user.Username,
					},
				})
				activeOrgID = org.ID
			}
		} else if activeOrgID == 0 {
			activeOrgID = existingMemberships[0].OrganizationID
		}
	}

	if activeOrgID > 0 && user.ActiveOrgID != activeOrgID {
		user.ActiveOrgID = activeOrgID
		_ = repositories.UserRepository.UpdateColumn(tx, user.ID, "active_org_id", activeOrgID)
	}
}

func (s *oidcLoginService) syncOIDCUserTeams(tx *gorm.DB, user *models.User, profile *oidcLoginProfile) {
	if user == nil || user.ID <= 0 || profile == nil {
		return
	}
	now := time.Now()

	agentProfile, _ := AgentProfileService.EnsureAgentProfileForUser(tx, user)
	if agentProfile == nil {
		return
	}

	var targetTeamID int64 = 0
	var isTeamLead bool = false

	if len(profile.Teams) > 0 {
		for _, teamClaim := range profile.Teams {
			teamName := strings.TrimSpace(teamClaim.Name)
			if teamName == "" {
				teamName = strings.TrimSpace(teamClaim.Slug)
			}
			if teamName == "" {
				teamName = "Customer Support"
			}
			slug := strings.TrimSpace(teamClaim.Slug)
			role := strings.ToUpper(strings.TrimSpace(teamClaim.Role))

			team := repositories.AgentTeamRepository.FindOne(tx, sqls.NewCnd().
				Where("name = ? OR description = ?", teamName, slug).
				Eq("status", enums.StatusOk))
			if team == nil {
				team = &models.AgentTeam{
					Name:         teamName,
					Description:  slug,
					LeaderUserID: 0,
					Status:       enums.StatusOk,
					AuditFields: models.AuditFields{
						CreatedAt:      now,
						CreateUserID:   user.ID,
						CreateUserName: user.Username,
						UpdatedAt:      now,
						UpdateUserID:   user.ID,
						UpdateUserName: user.Username,
					},
				}
				if err := repositories.AgentTeamRepository.Create(tx, team); err != nil {
					continue
				}
			}

			if role == "LEAD" || role == "ADMIN" || role == "OWNER" {
				isTeamLead = true
				if team.LeaderUserID == 0 || team.LeaderUserID == user.ID {
					_ = repositories.AgentTeamRepository.UpdateColumn(tx, team.ID, "leader_user_id", user.ID)
				}
			}

			if targetTeamID == 0 || slug == "customer-support" || strings.Contains(strings.ToLower(slug), "support") || strings.Contains(strings.ToLower(teamName), "support") {
				targetTeamID = team.ID
			}
		}
	}

	if targetTeamID > 0 && agentProfile.TeamID != targetTeamID {
		profileUpdates := map[string]any{
			"team_id":          targetTeamID,
			"update_user_id":   user.ID,
			"update_user_name": user.Username,
			"updated_at":       now,
		}
		if isTeamLead {
			profileUpdates["priority_level"] = 10
		}
		_ = repositories.AgentProfileRepository.Updates(tx, agentProfile.ID, profileUpdates)
	}

	if isTeamLead {
		s.ensureTeamLeaderRole(tx, user)
	}
}

// ensureBreakGlassAdminRole elevates an allowlisted break-glass admin to the
// admin role on OIDC login. This is what gives a fresh SSO-only deployment
// (where the default-password bootstrap admin is not seeded) its first
// administrator, and it lets the allowlist owner recover while the IdP is up.
// The claim may have just been backfilled in this transaction, so the profile
// email is checked alongside the stored one.
func (s *oidcLoginService) ensureBreakGlassAdminRole(tx *gorm.DB, authCfg config.AuthConfig, user *models.User, profile *oidcLoginProfile) {
	if user == nil || user.ID <= 0 {
		return
	}
	email := ""
	if user.Email != nil {
		email = *user.Email
	}
	if !authCfg.IsBreakGlassEmail(email) && (profile == nil || !authCfg.IsBreakGlassEmail(profile.Email)) {
		return
	}
	s.ensureOrganisationAdminRole(tx, user)
}

// ensureTeamLeaderRole grants the support team leader role to users whose
// DOS ID team claims mark them as LEAD. It deliberately does not grant the
// admin role: administrative access comes from organization ADMIN/OWNER
// claims only (see ensureOrganisationAdminRole).
func (s *oidcLoginService) ensureTeamLeaderRole(tx *gorm.DB, user *models.User) {
	if user == nil || user.ID <= 0 {
		return
	}
	leaderRole := repositories.RoleRepository.GetByCode(tx, constants.RoleCodeCsTeamLeader)
	if leaderRole == nil {
		return
	}
	existing := repositories.UserRoleRepository.FindOne(tx, sqls.NewCnd().Eq("user_id", user.ID).Eq("role_id", leaderRole.ID))
	if existing == nil {
		now := time.Now()
		_ = repositories.UserRoleRepository.Create(tx, &models.UserRole{
			UserID: user.ID,
			RoleID: leaderRole.ID,
			AuditFields: models.AuditFields{
				CreatedAt:      now,
				CreateUserID:   user.ID,
				CreateUserName: user.Username,
				UpdatedAt:      now,
				UpdateUserID:   user.ID,
				UpdateUserName: user.Username,
			},
		})
	}
}

// ensureOrganisationAdminRole grants the admin role, falling back to the
// super admin role code when the admin role is missing. Callers derive the
// trigger: an organization ADMIN/OWNER claim
// (syncOIDCUserOrganizations) or the break-glass allowlist
// (ensureBreakGlassAdminRole).
func (s *oidcLoginService) ensureOrganisationAdminRole(tx *gorm.DB, user *models.User) {
	if user == nil || user.ID <= 0 {
		return
	}
	adminRole := repositories.RoleRepository.GetByCode(tx, constants.RoleCodeAdmin)
	if adminRole == nil {
		adminRole = repositories.RoleRepository.GetByCode(tx, constants.RoleCodeSuperAdmin)
	}
	if adminRole == nil {
		return
	}
	existing := repositories.UserRoleRepository.FindOne(tx, sqls.NewCnd().Eq("user_id", user.ID).Eq("role_id", adminRole.ID))
	if existing == nil {
		now := time.Now()
		_ = repositories.UserRoleRepository.Create(tx, &models.UserRole{
			UserID: user.ID,
			RoleID: adminRole.ID,
			AuditFields: models.AuditFields{
				CreatedAt:      now,
				CreateUserID:   user.ID,
				CreateUserName: user.Username,
				UpdatedAt:      now,
				UpdateUserID:   user.ID,
				UpdateUserName: user.Username,
			},
		})
	}
}

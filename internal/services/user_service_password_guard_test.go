package services

import (
	"testing"
	"time"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/config"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"

	"gorm.io/gorm"
)

func createPasswordGuardTestUser(t *testing.T, db *gorm.DB, username string, email *string) *models.User {
	t.Helper()
	now := time.Now()
	user := &models.User{
		Username: username,
		Nickname: username,
		Email:    email,
		Status:   enums.StatusOk,
		AuditFields: models.AuditFields{
			CreatedAt: now,
			UpdatedAt: now,
		},
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create password guard test user: %v", err)
	}
	return user
}

func ssoOnlyAuthConfig(allowlist string) config.AuthConfig {
	disabled := false
	return config.AuthConfig{
		PasswordLoginEnabled: &disabled,
		BreakGlassEmails:     allowlist,
		TokenTTLHours:        2,
	}
}

// In SSO-only mode a local password exists solely for break-glass principals.
// Everyone else must be refused, otherwise password resets plant dormant
// credentials that come alive the moment password login is re-enabled.
func TestChangeOwnPasswordRejectedInSSOOnlyModeForNonBreakGlassUser(t *testing.T) {
	db := setupAuthServiceTestDB(t)
	email := "staff@dos.ai"
	user := createPasswordGuardTestUser(t, db, "staffuser", &email)

	err := UserService.ChangeOwnPassword("fresh-password", &dto.AuthPrincipal{
		UserID:   user.ID,
		Username: user.Username,
	}, ssoOnlyAuthConfig("joy@dos.ai"))
	if !hasCode(err, errorsx.CodeAuthForbidden) {
		t.Fatalf("expected forbidden error for non-break-glass user, got %v", err)
	}

	var reloaded models.User
	if err := db.Take(&reloaded, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("reload user: %v", err)
	}
	if reloaded.Password != user.Password {
		t.Fatal("password must stay unchanged when the guard rejects the change")
	}
}

// The emailless seeded bootstrap admin can never satisfy the email-only
// allowlist, so its password can no longer be rotated in SSO-only mode.
func TestChangeOwnPasswordRejectedInSSOOnlyModeForEmaillessUser(t *testing.T) {
	db := setupAuthServiceTestDB(t)
	user := createPasswordGuardTestUser(t, db, "admin", nil)

	err := UserService.ChangeOwnPassword("fresh-password", &dto.AuthPrincipal{
		UserID:   user.ID,
		Username: user.Username,
	}, ssoOnlyAuthConfig("joy@dos.ai"))
	if !hasCode(err, errorsx.CodeAuthForbidden) {
		t.Fatalf("expected forbidden error for emailless user, got %v", err)
	}
}

func TestChangeOwnPasswordAllowedForBreakGlassUserInSSOOnlyMode(t *testing.T) {
	db := setupAuthServiceTestDB(t)
	email := "joy@dos.ai"
	user := createPasswordGuardTestUser(t, db, "joy", &email)

	if err := UserService.ChangeOwnPassword("fresh-password", &dto.AuthPrincipal{
		UserID:   user.ID,
		Username: user.Username,
	}, ssoOnlyAuthConfig("joy@dos.ai")); err != nil {
		t.Fatalf("allowlisted admin must keep the break-glass password path: %v", err)
	}

	var reloaded models.User
	if err := db.Take(&reloaded, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("reload user: %v", err)
	}
	if reloaded.Password == user.Password || reloaded.Password == "" {
		t.Fatal("password must be updated for the allowlisted break-glass user")
	}
}

// With password login enabled (mixed mode) the guard must not interfere.
func TestChangeOwnPasswordUnaffectedInMixedMode(t *testing.T) {
	db := setupAuthServiceTestDB(t)
	email := "staff@dos.ai"
	user := createPasswordGuardTestUser(t, db, "staffuser", &email)

	if err := UserService.ChangeOwnPassword("fresh-password", &dto.AuthPrincipal{
		UserID:   user.ID,
		Username: user.Username,
	}, config.AuthConfig{TokenTTLHours: 2}); err != nil {
		t.Fatalf("mixed mode password change must keep working: %v", err)
	}
}

// The admin-driven reset endpoint goes through the same choke point: in
// SSO-only mode only break-glass targets may receive a local password.
func TestResetPasswordRejectedInSSOOnlyModeForNonBreakGlassTarget(t *testing.T) {
	db := setupAuthServiceTestDB(t)
	targetEmail := "staff@dos.ai"
	target := createPasswordGuardTestUser(t, db, "target", &targetEmail)
	operator := createPasswordGuardTestUser(t, db, "operator", nil)

	_, err := UserService.ResetPassword(target.ID, &dto.AuthPrincipal{
		UserID:   operator.ID,
		Username: operator.Username,
	}, ssoOnlyAuthConfig("joy@dos.ai"))
	if !hasCode(err, errorsx.CodeAuthForbidden) {
		t.Fatalf("expected forbidden error for non-break-glass reset target, got %v", err)
	}

	var reloaded models.User
	if err := db.Take(&reloaded, "id = ?", target.ID).Error; err != nil {
		t.Fatalf("reload target: %v", err)
	}
	if reloaded.Password != target.Password {
		t.Fatal("target password must stay unchanged when the guard rejects the reset")
	}
}

func TestResetPasswordAllowedInSSOOnlyModeForBreakGlassTarget(t *testing.T) {
	db := setupAuthServiceTestDB(t)
	targetEmail := "joy@dos.ai"
	target := createPasswordGuardTestUser(t, db, "target", &targetEmail)
	operator := createPasswordGuardTestUser(t, db, "operator", nil)

	password, err := UserService.ResetPassword(target.ID, &dto.AuthPrincipal{
		UserID:   operator.ID,
		Username: operator.Username,
	}, ssoOnlyAuthConfig("joy@dos.ai"))
	if err != nil {
		t.Fatalf("reset for a break-glass target must succeed: %v", err)
	}
	if password == "" {
		t.Fatal("expected a generated password to be returned")
	}
}

package services

import (
	"testing"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/config"
)

func TestIsBreakGlassUserMatchesAllowlistAgainstEmail(t *testing.T) {
	email := "joy@dos.ai"
	cfg := config.AuthConfig{BreakGlassEmails: "joy@dos.ai"}

	if !isBreakGlassUser(cfg, &models.User{Username: "joy", Email: &email}) {
		t.Fatal("allowlisted email must pass the break-glass check")
	}
}

// The allowlist is email-only: usernames are never matched, so putting the
// seeded bootstrap admin's username on the list cannot reopen the known
// default-password account.
func TestIsBreakGlassUserNeverMatchesUsernames(t *testing.T) {
	cfg := config.AuthConfig{BreakGlassEmails: "admin,ops-admin"}

	if isBreakGlassUser(cfg, &models.User{Username: "admin"}) {
		t.Fatal("username-only match must not pass the break-glass check")
	}
	if isBreakGlassUser(cfg, &models.User{Username: "ops-admin"}) {
		t.Fatal("username-only match must not pass the break-glass check")
	}
}

func TestIsBreakGlassUserRejectsNonAllowlistedAndNil(t *testing.T) {
	email := "someone@dos.ai"
	cfg := config.AuthConfig{BreakGlassEmails: "joy@dos.ai"}

	if isBreakGlassUser(cfg, nil) {
		t.Fatal("nil user must not pass the break-glass check")
	}
	if isBreakGlassUser(cfg, &models.User{Username: "someone", Email: &email}) {
		t.Fatal("non-allowlisted user must not pass the break-glass check")
	}
}

// The bootstrap admin is seeded without an email; the known default-password
// account must never qualify for the break-glass door.
func TestIsBreakGlassUserNeverMatchesEmaillessBootstrapAdmin(t *testing.T) {
	cfg := config.AuthConfig{BreakGlassEmails: "joy@dos.ai"}

	if isBreakGlassUser(cfg, &models.User{Username: "admin"}) {
		t.Fatal("the emailless bootstrap admin must not pass the break-glass check")
	}
}

func TestIsBreakGlassUserWithEmptyAllowlist(t *testing.T) {
	email := "joy@dos.ai"
	cfg := config.AuthConfig{}

	if isBreakGlassUser(cfg, &models.User{Username: "joy", Email: &email}) {
		t.Fatal("empty allowlist must reject every user")
	}
}

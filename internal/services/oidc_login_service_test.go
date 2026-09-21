package services

import (
	"strings"
	"testing"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/config"
	"agent-desk/internal/pkg/enums"
)

func TestOIDCLoginAutoCreatesSystemUser(t *testing.T) {
	db := setupAuthServiceTestDB(t)
	svc := newOIDCLoginService()

	ret, err := svc.loginWithOIDCProfile(&oidcLoginProfile{
		Subject:           "sub-123",
		Email:             "ada@example.com",
		PreferredUsername: "ada",
		Name:              "Ada Lovelace",
		Picture:           "https://example.com/ada.png",
		RawProfile:        `{"sub":"sub-123"}`,
	}, config.AuthConfig{TokenTTLHours: 2}, "127.0.0.1", "go-test", false)
	if err != nil {
		t.Fatalf("loginWithOIDCProfile() error = %v", err)
	}
	if ret == nil || !strings.HasPrefix(ret.AccessToken, "ak_") {
		t.Fatalf("expected ak_ access token, got %+v", ret)
	}

	var user models.User
	if err := db.Take(&user, "username = ?", "ada").Error; err != nil {
		t.Fatalf("expected OIDC user to be created: %v", err)
	}
	if user.Nickname != "Ada Lovelace" || user.Avatar != "https://example.com/ada.png" {
		t.Fatalf("unexpected created user profile: %+v", user)
	}
	if user.Email == nil || *user.Email != "ada@example.com" {
		t.Fatalf("expected email to be stored, got %+v", user.Email)
	}
	if user.Password != "" {
		t.Fatalf("expected OIDC-created user password to be empty, got %q", user.Password)
	}

	var identity models.UserIdentity
	if err := db.Take(&identity, "provider = ? AND provider_user_id = ?", enums.ThirdProviderOIDC, "sub-123").Error; err != nil {
		t.Fatalf("expected OIDC identity to be created: %v", err)
	}
	if identity.UserID != user.ID || identity.ProviderName != "OIDC" || identity.Status != enums.StatusOk {
		t.Fatalf("unexpected OIDC identity: %+v", identity)
	}

	var sessions []models.LoginSession
	if err := db.Find(&sessions).Error; err != nil {
		t.Fatalf("query login sessions: %v", err)
	}
	if len(sessions) != 1 || sessions[0].UserID != user.ID || sessions[0].Token != ret.AccessToken {
		t.Fatalf("unexpected login sessions: %+v", sessions)
	}
}

func TestOIDCLoginReusesExistingIdentity(t *testing.T) {
	db := setupAuthServiceTestDB(t)
	user := createAuthTestUser(t, db, "existing", "secret")
	if err := db.Create(&models.UserIdentity{
		UserID:         user.ID,
		Provider:       enums.ThirdProviderOIDC,
		ProviderUserID: "sub-123",
		ProviderName:   "OIDC",
		Status:         enums.StatusOk,
	}).Error; err != nil {
		t.Fatalf("seed OIDC identity: %v", err)
	}

	ret, err := newOIDCLoginService().loginWithOIDCProfile(&oidcLoginProfile{
		Subject:           "sub-123",
		PreferredUsername: "ignored",
		Name:              "Updated Name",
		Picture:           "https://example.com/updated.png",
		RawProfile:        `{"sub":"sub-123"}`,
	}, config.AuthConfig{TokenTTLHours: 2}, "127.0.0.1", "go-test", false)
	if err != nil {
		t.Fatalf("loginWithOIDCProfile() error = %v", err)
	}
	if ret == nil || ret.User == nil || ret.User.ID != user.ID {
		t.Fatalf("expected existing user login response, got %+v", ret)
	}

	var count int64
	if err := db.Model(&models.User{}).Count(&count).Error; err != nil {
		t.Fatalf("count users: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected existing identity to reuse user, got %d users", count)
	}
}

func TestOIDCLoginSyncsOrganizationsAndTeams(t *testing.T) {
	db := setupAuthServiceTestDB(t)
	svc := newOIDCLoginService()

	profile := &oidcLoginProfile{
		Subject:           "7a3562bb-f529-45e0-bdfa-b73ca55ce8c8",
		Email:             "agent@acme.com",
		PreferredUsername: "janedoe",
		Name:              "Jane Doe",
		Picture:           "https://avatar.dos.me/jane.png",
		ActiveOrgID:       "org_987654321",
		Organizations: []oidcLoginProfileOrg{
			{
				ID:   "org_987654321",
				Name: "Acme Corporation",
				Slug: "acme",
				Role: "ADMIN",
			},
		},
		Teams: []oidcLoginProfileTeam{
			{
				ID:    "team_11223344",
				OrgID: "org_987654321",
				Name:  "Customer Support",
				Slug:  "customer-support",
				Role:  "LEAD",
			},
			{
				ID:    "team_55667788",
				OrgID: "org_987654321",
				Name:  "Sales & Outreach",
				Slug:  "sales-outreach",
				Role:  "MEMBER",
			},
		},
		RawProfile: `{"sub":"7a3562bb-f529-45e0-bdfa-b73ca55ce8c8"}`,
	}

	ret, err := svc.loginWithOIDCProfile(profile, config.AuthConfig{TokenTTLHours: 2}, "127.0.0.1", "go-test", false)
	if err != nil {
		t.Fatalf("loginWithOIDCProfile() error = %v", err)
	}
	if ret == nil {
		t.Fatalf("expected non-nil login response")
	}

	// Verify User created and mapped to Active Org
	var user models.User
	if err := db.Take(&user, "username = ?", "janedoe").Error; err != nil {
		t.Fatalf("expected user created: %v", err)
	}

	var org models.Organization
	if err := db.Take(&org, "code = ?", "org_987654321").Error; err != nil {
		t.Fatalf("expected organization created: %v", err)
	}
	if user.ActiveOrgID != org.ID {
		t.Fatalf("expected active org id %d, got %d", org.ID, user.ActiveOrgID)
	}

	// Verify AgentTeam created for Customer Support
	var team models.AgentTeam
	if err := db.Take(&team, "name = ?", "Customer Support").Error; err != nil {
		t.Fatalf("expected Customer Support team created: %v", err)
	}
	if team.LeaderUserID != user.ID {
		t.Fatalf("expected user to be team lead, got leader_user_id = %d", team.LeaderUserID)
	}

	// Verify AgentProfile mapped to Customer Support team with Lead priority
	var agentProfile models.AgentProfile
	if err := db.Take(&agentProfile, "user_id = ?", user.ID).Error; err != nil {
		t.Fatalf("expected agent profile created: %v", err)
	}
	if agentProfile.TeamID != team.ID {
		t.Fatalf("expected agent profile mapped to team %d, got %d", team.ID, agentProfile.TeamID)
	}
	if agentProfile.PriorityLevel != 10 {
		t.Fatalf("expected priority level 10 for LEAD, got %d", agentProfile.PriorityLevel)
	}
}

// A first-time OIDC login from the support portal must provision a
// customer-type user with no staff role, no agent profile, and no
// organization/team provisioning: the dashboard middleware rejects
// non-employee users, so the portal door cannot open the staff surface.
func TestOIDCLoginPortalOriginCreatesCustomerUserWithoutStaffProvisioning(t *testing.T) {
	db := setupAuthServiceTestDB(t)
	svc := newOIDCLoginService()

	ret, err := svc.loginWithOIDCProfile(&oidcLoginProfile{
		Subject:           "customer-sub-1",
		Email:             "customer@example.com",
		PreferredUsername: "portalcustomer",
		Name:              "Portal Customer",
		RawProfile:        `{"sub":"customer-sub-1"}`,
	}, config.AuthConfig{TokenTTLHours: 2}, "127.0.0.1", "go-test", true)
	if err != nil {
		t.Fatalf("loginWithOIDCProfile() error = %v", err)
	}
	if ret == nil || !strings.HasPrefix(ret.AccessToken, "ak_") {
		t.Fatalf("expected ak_ access token, got %+v", ret)
	}

	var user models.User
	if err := db.Take(&user, "username = ?", "portalcustomer").Error; err != nil {
		t.Fatalf("expected portal customer user to be created: %v", err)
	}
	if user.UserType != enums.UserTypeUser {
		t.Fatalf("portal-origin user type = %q, want customer (%q)", user.UserType, enums.UserTypeUser)
	}

	var roleCount int64
	if err := db.Model(&models.UserRole{}).Where("user_id = ?", user.ID).Count(&roleCount).Error; err != nil {
		t.Fatalf("count user roles: %v", err)
	}
	if roleCount != 0 {
		t.Fatalf("portal-origin user must not receive staff roles, got %d", roleCount)
	}

	var orgCount int64
	if err := db.Model(&models.Organization{}).Count(&orgCount).Error; err != nil {
		t.Fatalf("count organizations: %v", err)
	}
	if orgCount != 0 {
		t.Fatalf("portal-origin login must not provision organizations, got %d", orgCount)
	}

	var profileCount int64
	if err := db.Model(&models.AgentProfile{}).Where("user_id = ?", user.ID).Count(&profileCount).Error; err != nil {
		t.Fatalf("count agent profiles: %v", err)
	}
	if profileCount != 0 {
		t.Fatalf("portal-origin user must not receive an agent profile, got %d", profileCount)
	}
}

// Even an allowlisted break-glass admin must stay a role-less customer when
// entering through the support portal: the allowlist elevates on the staff
// surface only.
func TestOIDCLoginPortalOriginIgnoresBreakGlassAllowlist(t *testing.T) {
	db := setupAuthServiceTestDB(t)
	svc := newOIDCLoginService()

	ret, err := svc.loginWithOIDCProfile(&oidcLoginProfile{
		Subject:           "admin-sub-1",
		Email:             "joy@dos.ai",
		PreferredUsername: "joy",
		Name:              "Joy",
		RawProfile:        `{"sub":"admin-sub-1"}`,
	}, config.AuthConfig{TokenTTLHours: 2, BreakGlassEmails: "joy@dos.ai"}, "127.0.0.1", "go-test", true)
	if err != nil {
		t.Fatalf("loginWithOIDCProfile() error = %v", err)
	}
	if ret == nil {
		t.Fatalf("expected non-nil login response")
	}

	var user models.User
	if err := db.Take(&user, "username = ?", "joy").Error; err != nil {
		t.Fatalf("expected portal user to be created: %v", err)
	}
	if user.UserType != enums.UserTypeUser {
		t.Fatalf("portal-origin admin email user type = %q, want customer", user.UserType)
	}

	var roleCount int64
	if err := db.Model(&models.UserRole{}).Where("user_id = ?", user.ID).Count(&roleCount).Error; err != nil {
		t.Fatalf("count user roles: %v", err)
	}
	if roleCount != 0 {
		t.Fatalf("break-glass allowlist must not elevate on the portal surface, got %d roles", roleCount)
	}
}

func TestIsSupportPortalNext(t *testing.T) {
	cases := []struct {
		next     string
		expected bool
	}{
		{next: "/support/community", expected: true},
		{next: "/support", expected: true},
		{next: " /support/tickets ", expected: true},
		{next: "/dashboard", expected: false},
		{next: "", expected: false},
		{next: "/supportevil", expected: false},
	}

	for _, tc := range cases {
		if got := IsSupportPortalNext(tc.next); got != tc.expected {
			t.Fatalf("isSupportPortalNext(%q) = %v, want %v", tc.next, got, tc.expected)
		}
	}
}

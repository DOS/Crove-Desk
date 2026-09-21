package config

import (
	"reflect"
	"testing"
)

func boolPtr(v bool) *bool {
	return &v
}

func TestAuthConfigBreakGlassEmailList(t *testing.T) {
	cases := []struct {
		name     string
		raw      string
		expected []string
	}{
		{name: "empty", raw: "", expected: []string{}},
		{name: "blank only", raw: " , ,", expected: []string{}},
		{name: "trims and lowercases", raw: " Joy@Dos.AI , admin@crove.com ", expected: []string{"joy@dos.ai", "admin@crove.com"}},
		{name: "single email", raw: "joy@dos.ai", expected: []string{"joy@dos.ai"}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := AuthConfig{BreakGlassEmails: tc.raw}

			if got := cfg.BreakGlassEmailList(); !reflect.DeepEqual(got, tc.expected) {
				t.Fatalf("BreakGlassEmailList(%q) = %v, want %v", tc.raw, got, tc.expected)
			}

			if got := cfg.HasBreakGlassEmails(); got != (len(tc.expected) > 0) {
				t.Fatalf("HasBreakGlassEmails(%q) = %v, want %v", tc.raw, got, len(tc.expected) > 0)
			}
		})
	}
}

func TestAuthConfigIsBreakGlassEmail(t *testing.T) {
	cfg := AuthConfig{BreakGlassEmails: "Joy@Dos.AI,ops@crove.com"}

	cases := []struct {
		email    string
		expected bool
	}{
		{email: "joy@dos.ai", expected: true},
		{email: "  JOY@DOS.AI  ", expected: true},
		{email: "OPS@crove.com", expected: true},
		{email: "someone@dos.ai", expected: false},
		{email: "", expected: false},
		{email: "   ", expected: false},
	}

	for _, tc := range cases {
		if got := cfg.IsBreakGlassEmail(tc.email); got != tc.expected {
			t.Fatalf("IsBreakGlassEmail(%q) = %v, want %v", tc.email, got, tc.expected)
		}
	}
}

func TestAuthConfigIsBreakGlassLoginEnabled(t *testing.T) {
	allowlist := "joy@dos.ai"

	// Password login enabled: the door is irrelevant.
	enabled := AuthConfig{PasswordLoginEnabled: boolPtr(true), BreakGlassEmails: allowlist}
	if enabled.IsBreakGlassLoginEnabled() {
		t.Fatal("break-glass must not be armed while password login is enabled")
	}

	// Disabled with no allowlist: nothing is armed.
	disabledNoList := AuthConfig{PasswordLoginEnabled: boolPtr(false)}
	if disabledNoList.IsBreakGlassLoginEnabled() {
		t.Fatal("break-glass must not be armed without an allowlist")
	}

	// Disabled with an allowlist: the break-glass door is armed.
	armed := AuthConfig{PasswordLoginEnabled: boolPtr(false), BreakGlassEmails: allowlist}
	if !armed.IsBreakGlassLoginEnabled() {
		t.Fatal("break-glass must be armed when password login is disabled and an allowlist exists")
	}

	// Default (unset) password login stays enabled.
	defaultCfg := AuthConfig{BreakGlassEmails: allowlist}
	if defaultCfg.IsBreakGlassLoginEnabled() {
		t.Fatal("unset passwordLoginEnabled must keep password login enabled")
	}
}

package api

import (
	"net/url"
	"testing"
)

// A failed OIDC round-trip must bounce back to the login surface that started
// it: the support portal for /support/* targets, the staff dashboard
// otherwise. Routing a portal failure to the staff page would strand the
// customer there, and retrying from that page would provision them as an
// employee instead of a customer.
func TestOIDCLoginErrorRedirectTargetsOriginSurface(t *testing.T) {
	const plainMessage = "sign-in failed"
	cases := []struct {
		name    string
		next    string
		message string
		portal  bool
	}{
		{name: "staff target", next: "/dashboard", message: plainMessage},
		{name: "empty next falls back to staff", next: "", message: plainMessage},
		{name: "portal path", next: "/support/community", message: plainMessage, portal: true},
		{name: "portal root", next: "/support", message: plainMessage, portal: true},
		{name: "padded portal path", next: " /support/tickets", message: plainMessage, portal: true},
		{name: "portal lookalike is not portal", next: "/supportevil", message: plainMessage},
		{name: "untrusted next is never reflected", next: "https://evil.example", message: plainMessage},
		{name: "message is escaped", next: "/support", message: "boom & breakdown", portal: true},
	}

	for _, tc := range cases {
		loginPath := "/dashboard/login"
		if tc.portal {
			loginPath = "/support/login"
		}
		expected := loginPath + "?oidcError=" + url.QueryEscape(tc.message)
		if got := oidcLoginErrorRedirect(tc.next, tc.message); got != expected {
			t.Fatalf("%s: oidcLoginErrorRedirect(%q) = %q, want %q", tc.name, tc.next, got, expected)
		}
	}
}

package builders

import (
	"strings"
	"testing"
	"unicode/utf8"

	"agent-desk/internal/pkg/enums"
)

func TestDisplayExternalIDKeepsChannelIdentifiersReadable(t *testing.T) {
	cases := []struct {
		source enums.ExternalSource
		id     string
	}{
		{enums.ExternalSourceTelegram, "tg_12345678"},
		{enums.ExternalSourceEmail, "john@acme.com"},
		{enums.ExternalSourceWhatsApp, "+84901234567"},
		{enums.ExternalSourceMessenger, "10203040506"},
		{enums.ExternalSourceUser, "user-42"},
		{enums.ExternalSourceTwentyCRM, "crm-person-9"},
	}
	for _, tc := range cases {
		if got := displayExternalID(tc.source, tc.id); got != tc.id {
			t.Errorf("displayExternalID(%q, %q) = %q, a channel identifier must stay readable", tc.source, tc.id, got)
		}
	}
}

func TestDisplayExternalIDMasksTheGuestCredential(t *testing.T) {
	id := "guest_2f1c9a4e-6b7d-4c88-9a01-5d3e7f2b6c40"
	got := displayExternalID(enums.ExternalSourceGuest, id)

	if want := "****6c40"; got != want {
		t.Fatalf("displayExternalID() = %q want %q", got, want)
	}
	if strings.Contains(got, "2f1c9a4e") {
		t.Fatalf("displayExternalID() = %q leaks the identifying part of the guest id", got)
	}
}

func TestDisplayExternalIDKeepsGuestsDistinguishable(t *testing.T) {
	first := displayExternalID(enums.ExternalSourceGuest, "guest_2f1c9a4e-6b7d-4c88-9a01-5d3e7f2b6c40")
	second := displayExternalID(enums.ExternalSourceGuest, "guest_9b8a7c6d-5e4f-4a32-8b10-c7d6e5f4a321")
	if first == second {
		t.Fatalf("two different guests both masked to %q, so agents can no longer tell them apart", first)
	}
}

func TestDisplayExternalIDMasksShortGuestIDsEntirely(t *testing.T) {
	// A short identifier means an integrating site chose something guessable,
	// which is exactly the case the redaction exists for: a visible tail would
	// give away too large a fraction of it.
	for _, id := range []string{"", "7", "abc", "user-1234", "john@acme.co"} {
		got := displayExternalID(enums.ExternalSourceGuest, id)
		if want := strings.Repeat("*", len([]rune(id))); got != want {
			t.Errorf("displayExternalID(guest, %q) = %q want %q", id, got, want)
		}
	}
}

func TestDisplayExternalIDDoesNotSplitMultibyteRunes(t *testing.T) {
	id := "khách-hàng-" + strings.Repeat("ệ", 20)
	got := displayExternalID(enums.ExternalSourceGuest, id)

	if !utf8.ValidString(got) {
		t.Fatalf("displayExternalID() = %q is not valid UTF-8", got)
	}
	if !strings.HasSuffix(got, strings.Repeat("ệ", 4)) {
		t.Errorf("displayExternalID() = %q, expected four whole runes as the tail", got)
	}
}

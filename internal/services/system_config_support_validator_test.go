package services

import (
	"encoding/json"
	"testing"

	"agent-desk/internal/pkg/i18nx"
)

func TestSystemConfigValidationErrorLocalizesFieldErrors(t *testing.T) {
	_, fieldErrors, err := supportNavigationMenuValidator{}.Validate(json.RawMessage(`not-json`))
	if err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
	validationErr := &SystemConfigValidationError{errors: fieldErrors}

	if got := validationErr.Message(i18nx.LocaleEnUS); got != "Config validation failed: Navigation menu config must be a valid JSON array" {
		t.Fatalf("Message(en-US) = %q", got)
	}
	localized := validationErr.FieldErrorsLocale(i18nx.LocaleEnUS)
	if len(localized) != 1 {
		t.Fatalf("FieldErrorsLocale() length = %d, want 1", len(localized))
	}
	if localized[0].Message != "Navigation menu config must be a valid JSON array" {
		t.Fatalf("localized message = %q", localized[0].Message)
	}
	if localized[0].MessageKey != "error.supportConfig.navigationInvalidJSON" {
		t.Fatalf("message key = %q", localized[0].MessageKey)
	}
}

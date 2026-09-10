package enums

import (
	"testing"
)

func TestChannelAndExternalSourceEnums(t *testing.T) {
	if ChannelTypeDiscord != "discord" {
		t.Fatalf("expected ChannelTypeDiscord to be 'discord', got %s", ChannelTypeDiscord)
	}
	if ChannelTypeMessenger != "messenger" {
		t.Fatalf("expected ChannelTypeMessenger to be 'messenger', got %s", ChannelTypeMessenger)
	}
	if ExternalSourceDiscord != "discord" {
		t.Fatalf("expected ExternalSourceDiscord to be 'discord', got %s", ExternalSourceDiscord)
	}
	if ExternalSourceMessenger != "messenger" {
		t.Fatalf("expected ExternalSourceMessenger to be 'messenger', got %s", ExternalSourceMessenger)
	}
}

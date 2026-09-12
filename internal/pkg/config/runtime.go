package config

import "strings"

var current *Config

func SetCurrent(cfg *Config) {
	current = cfg
}

func GetCurrent() *Config {
	return current
}

func Current() Config {
	if current == nil {
		panic("config not initialized")
	}
	return *current
}

// The resolvers below return the channel-level values unchanged when no
// configuration has been loaded, so callers on webhook paths do not have to
// nil-check before authenticating a delivery.

// ResolveMessengerApp resolves the Meta app credentials for Facebook Messenger.
func ResolveMessengerApp(channelAppID, channelAppSecret string) MetaAppCredentials {
	if current == nil {
		return unresolvedMetaApp(channelAppID, channelAppSecret)
	}
	return current.MessengerApp(channelAppID, channelAppSecret)
}

// ResolveInstagramApp resolves the Meta app credentials for Instagram Direct.
func ResolveInstagramApp(channelAppID, channelAppSecret string) MetaAppCredentials {
	if current == nil {
		return unresolvedMetaApp(channelAppID, channelAppSecret)
	}
	return current.InstagramApp(channelAppID, channelAppSecret)
}

// ResolveWhatsAppApp resolves the Meta app credentials for the WhatsApp Cloud API.
func ResolveWhatsAppApp(channelAppID, channelAppSecret string) MetaAppCredentials {
	if current == nil {
		return unresolvedMetaApp(channelAppID, channelAppSecret)
	}
	return current.WhatsAppApp(channelAppID, channelAppSecret)
}

func unresolvedMetaApp(channelAppID, channelAppSecret string) MetaAppCredentials {
	return MetaAppCredentials{
		AppID:     strings.TrimSpace(channelAppID),
		AppSecret: strings.TrimSpace(channelAppSecret),
	}
}

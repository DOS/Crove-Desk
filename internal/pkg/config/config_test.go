package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadReadsCORSAllowedOrigins(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	content := []byte(`server:
  port: 8083
  cors:
    allowedOrigins:
      - https://console.example.com
      - http://localhost:3000
`)
	if err := os.WriteFile(path, content, 0600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	got := cfg.Server.CORS.AllowedOrigins
	want := []string{"https://console.example.com", "http://localhost:3000"}
	if len(got) != len(want) {
		t.Fatalf("len(AllowedOrigins)=%d want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("AllowedOrigins[%d]=%q want %q", i, got[i], want[i])
		}
	}
}

func TestLoadOverridesValuesFromEnvironment(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	content := []byte(`server:
  port: 8083
db:
  type: sqlite
  dsn: file:./data/app.db?_busy_timeout=5000
storage:
  local:
    baseUrl: /storage
mcp:
  servers:
    system:
      endpoint: http://127.0.0.1:8083/api/mcp
`)
	if err := os.WriteFile(path, content, 0600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
	t.Setenv("ENV_FILE", os.DevNull)
	t.Setenv("AGENT_DESK_ENV_FILE", os.DevNull)
	t.Setenv("DB_TYPE", "sqlite")
	t.Setenv("DB_DSN", "mysql-dsn")
	t.Setenv("STORAGE_LOCAL_BASEURL", "/files")
	t.Setenv("AGENT_DESK_SERVER_PORT", "8090")
	t.Setenv("AGENT_DESK_DB_DSN", "mysql-dsn")
	t.Setenv("AGENT_DESK_STORAGE_LOCAL_BASEURL", "/files")
	t.Setenv("AGENT_DESK_MCP_SERVERS_SYSTEM_ENDPOINT", "http://127.0.0.1:8090/api/mcp")

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Server.Port != 8090 {
		t.Fatalf("Server.Port=%d want 8090", cfg.Server.Port)
	}
	if cfg.DB.Type != "sqlite" {
		t.Fatalf("DB.Type=%q want sqlite", cfg.DB.Type)
	}
	if cfg.DB.DSN != "mysql-dsn" {
		t.Fatalf("DB.DSN=%q want mysql-dsn", cfg.DB.DSN)
	}
	if cfg.Storage.Local.BaseURL != "/files" {
		t.Fatalf("Storage.Local.BaseURL=%q want /files", cfg.Storage.Local.BaseURL)
	}
	if cfg.MCP.Servers["system"].Endpoint != "http://127.0.0.1:8090/api/mcp" {
		t.Fatalf("MCP system endpoint=%q", cfg.MCP.Servers["system"].Endpoint)
	}
}

func TestLoadFromDotEnvAndStandardEnvAliases(t *testing.T) {
	tempDir := t.TempDir()
	envPath := filepath.Join(tempDir, ".env")
	envContent := []byte(`PORT=9090
COMPANY_NAME=CustomDesk
COMPANY_LOGO_URL=/custom-logo.svg
DATABASE_URL=postgres://user:pass@localhost:5432/mydb?sslmode=disable
PASSWORD_LOGIN_ENABLED=false
JWT_SECRET=super-secret-key-12345
QDRANT_HOST=10.0.0.5
QDRANT_PORT=6334
OPENAI_API_KEY=sk-test-openai-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_LLM_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSION=1536
OIDC_ENABLED=true
OIDC_ISSUER=https://auth.example.com
OIDC_CLIENT_ID=client-123
OIDC_CLIENT_SECRET=secret-456
OIDC_REDIRECT_URL=https://desk.example.com/api/auth/oidc_callback
ORG_SYNC_SECRET=webhook-secret-789
EMAIL_PROVIDER=brevo
EMAIL_FROM=help@example.com
EMAIL_FROM_NAME=Helpdesk Team
BREVO_API_KEY=xkeysib-test-123
EMAIL_INBOUND_SECRET=inbound-secret-456
DISCORD_CLIENT_ID=discord-app-123
DISCORD_BOT_TOKEN=discord-bot-token-xyz
META_APP_ID=meta-app-999
META_APP_SECRET=meta-app-secret-888
MESSENGER_VERIFY_TOKEN=meta-verify-token-777
`)
	if err := os.WriteFile(envPath, envContent, 0600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	t.Setenv("ENV_FILE", envPath)

	cfg, err := Load("")
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Server.Port != 9090 {
		t.Fatalf("Server.Port=%d want 9090", cfg.Server.Port)
	}
	if cfg.Server.CompanyName != "CustomDesk" {
		t.Fatalf("Server.CompanyName=%q want CustomDesk", cfg.Server.CompanyName)
	}
	if cfg.Server.CompanyLogoURL != "/custom-logo.svg" {
		t.Fatalf("Server.CompanyLogoURL=%q want /custom-logo.svg", cfg.Server.CompanyLogoURL)
	}
	if cfg.DB.Type != "postgres" {
		t.Fatalf("DB.Type=%q want postgres", cfg.DB.Type)
	}
	if cfg.DB.DSN != "postgres://user:pass@localhost:5432/mydb?sslmode=disable" {
		t.Fatalf("DB.DSN=%q", cfg.DB.DSN)
	}
	if cfg.Auth.IsPasswordLoginEnabled() {
		t.Fatalf("expected PasswordLoginEnabled to be false")
	}
	if cfg.CustomerSession.Secret != "super-secret-key-12345" {
		t.Fatalf("CustomerSession.Secret=%q", cfg.CustomerSession.Secret)
	}
	if cfg.VectorDB.Qdrant.Host != "10.0.0.5" {
		t.Fatalf("Qdrant.Host=%q", cfg.VectorDB.Qdrant.Host)
	}
	if cfg.VectorDB.Qdrant.GrpcPort != 6334 {
		t.Fatalf("Qdrant.GrpcPort=%d", cfg.VectorDB.Qdrant.GrpcPort)
	}
	if cfg.AI.APIKey != "sk-test-openai-key" {
		t.Fatalf("AI.APIKey=%q", cfg.AI.APIKey)
	}
	if cfg.AI.BaseURL != "https://api.openai.com/v1" {
		t.Fatalf("AI.BaseURL=%q", cfg.AI.BaseURL)
	}
	if cfg.AI.LLMModel != "gpt-4o" {
		t.Fatalf("AI.LLMModel=%q", cfg.AI.LLMModel)
	}
	if cfg.AI.EmbeddingModel != "text-embedding-3-small" {
		t.Fatalf("AI.EmbeddingModel=%q", cfg.AI.EmbeddingModel)
	}
	if cfg.AI.EmbeddingDimension != 1536 {
		t.Fatalf("AI.EmbeddingDimension=%d", cfg.AI.EmbeddingDimension)
	}
	if !cfg.OIDC.Enabled {
		t.Fatalf("expected OIDC.Enabled=true")
	}
	if cfg.OIDC.Issuer != "https://auth.example.com" {
		t.Fatalf("OIDC.Issuer=%q", cfg.OIDC.Issuer)
	}
	if cfg.OIDC.ClientID != "client-123" {
		t.Fatalf("OIDC.ClientID=%q", cfg.OIDC.ClientID)
	}
	if cfg.OIDC.ClientSecret != "secret-456" {
		t.Fatalf("OIDC.ClientSecret=%q", cfg.OIDC.ClientSecret)
	}
	if cfg.OIDC.RedirectURL != "https://desk.example.com/api/auth/oidc_callback" {
		t.Fatalf("OIDC.RedirectURL=%q", cfg.OIDC.RedirectURL)
	}
	if cfg.Webhook.OrgSyncSecret != "webhook-secret-789" {
		t.Fatalf("Webhook.OrgSyncSecret=%q", cfg.Webhook.OrgSyncSecret)
	}
	if cfg.Email.Provider != "brevo" {
		t.Fatalf("Email.Provider=%q want brevo", cfg.Email.Provider)
	}
	if cfg.Email.FromAddress != "help@example.com" {
		t.Fatalf("Email.FromAddress=%q want help@example.com", cfg.Email.FromAddress)
	}
	if cfg.Email.FromName != "Helpdesk Team" {
		t.Fatalf("Email.FromName=%q want Helpdesk Team", cfg.Email.FromName)
	}
	if cfg.Email.APIKey != "xkeysib-test-123" {
		t.Fatalf("Email.APIKey=%q want xkeysib-test-123", cfg.Email.APIKey)
	}
	if cfg.Email.InboundSecret != "inbound-secret-456" {
		t.Fatalf("Email.InboundSecret=%q want inbound-secret-456", cfg.Email.InboundSecret)
	}
	if cfg.Discord.ClientID != "discord-app-123" {
		t.Fatalf("Discord.ClientID=%q want discord-app-123", cfg.Discord.ClientID)
	}
	if cfg.Discord.BotToken != "discord-bot-token-xyz" {
		t.Fatalf("Discord.BotToken=%q want discord-bot-token-xyz", cfg.Discord.BotToken)
	}
	if cfg.Messenger.AppID != "meta-app-999" {
		t.Fatalf("Messenger.AppID=%q want meta-app-999", cfg.Messenger.AppID)
	}
	if cfg.Messenger.AppSecret != "meta-app-secret-888" {
		t.Fatalf("Messenger.AppSecret=%q want meta-app-secret-888", cfg.Messenger.AppSecret)
	}
	if cfg.Messenger.VerifyToken != "meta-verify-token-777" {
		t.Fatalf("Messenger.VerifyToken=%q want meta-verify-token-777", cfg.Messenger.VerifyToken)
	}
}

// TestLoadPrefersPrefixedAliasOverLegacyEnv pins that the documented
// AGENT_DESK_* spelling beats every legacy alias when both are set. That holds
// because Load enables AutomaticEnv together with SetEnvPrefix("AGENT_DESK"), so
// viper resolves "server.port" to AGENT_DESK_SERVER_PORT before it ever consults
// the BindEnv alias list - the order inside bindEnvironmentAliases is not what
// guarantees it. The existing override test sets both spellings to the same value
// and so cannot tell the mechanisms apart; this one makes them conflict. It
// matters because every legacy name is also a plausible ambient variable in a
// container or a shell profile, and DATABASE_URL winning would silently point
// the process at a different database.
func TestLoadPrefersPrefixedAliasOverLegacyEnv(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	content := []byte(`server:
  port: 8083
db:
  dsn: yaml-dsn
storage:
  local:
    baseUrl: /storage
`)
	if err := os.WriteFile(path, content, 0600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	t.Setenv("ENV_FILE", os.DevNull)
	t.Setenv("AGENT_DESK_ENV_FILE", os.DevNull)
	t.Setenv("PORT", "9999")
	t.Setenv("AGENT_DESK_SERVER_PORT", "8090")
	t.Setenv("SERVER_PORT", "9998")
	t.Setenv("DATABASE_URL", "legacy-dsn")
	t.Setenv("DB_DSN", "legacy-dsn-2")
	t.Setenv("AGENT_DESK_DB_DSN", "prefixed-dsn")
	t.Setenv("STORAGE_LOCAL_BASE_URL", "/legacy")
	t.Setenv("AGENT_DESK_STORAGE_LOCAL_BASEURL", "/prefixed")

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Server.Port != 8090 {
		t.Errorf("Server.Port=%d want 8090, AGENT_DESK_SERVER_PORT must beat PORT and SERVER_PORT", cfg.Server.Port)
	}
	if cfg.DB.DSN != "prefixed-dsn" {
		t.Errorf("DB.DSN=%q want prefixed-dsn, AGENT_DESK_DB_DSN must beat DATABASE_URL and DB_DSN", cfg.DB.DSN)
	}
	if cfg.Storage.Local.BaseURL != "/prefixed" {
		t.Errorf("Storage.Local.BaseURL=%q want /prefixed", cfg.Storage.Local.BaseURL)
	}
}

// TestLoadFallsBackToLegacyEnvWhenPrefixedAliasUnset keeps the alias list honest
// in the other direction: the documented deployment files set only the legacy
// names, so those must still apply when no prefixed alias is present, and still
// override the YAML file as viper intends.
func TestLoadFallsBackToLegacyEnvWhenPrefixedAliasUnset(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	content := []byte(`server:
  port: 8083
db:
  dsn: yaml-dsn
`)
	if err := os.WriteFile(path, content, 0600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	t.Setenv("ENV_FILE", os.DevNull)
	t.Setenv("AGENT_DESK_ENV_FILE", os.DevNull)
	t.Setenv("PORT", "9999")
	t.Setenv("DATABASE_URL", "legacy-dsn")

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Server.Port != 9999 {
		t.Errorf("Server.Port=%d want 9999, PORT must still apply when AGENT_DESK_SERVER_PORT is unset", cfg.Server.Port)
	}
	if cfg.DB.DSN != "legacy-dsn" {
		t.Errorf("DB.DSN=%q want legacy-dsn", cfg.DB.DSN)
	}
}

// metaAppEnvVars are every variable that can supply a Meta app credential. Each
// phase of the test sets exactly the ones it means to, so the rest have to be
// cleared or a value left over from an earlier phase would look like a fallback.
var metaAppEnvVars = []string{
	"AGENT_DESK_MESSENGER_APPID", "AGENT_DESK_MESSENGER_APPSECRET",
	"AGENT_DESK_INSTAGRAM_APPID", "AGENT_DESK_INSTAGRAM_APPSECRET",
	"AGENT_DESK_WHATSAPP_APPID", "AGENT_DESK_WHATSAPP_APPSECRET",
	"FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET",
	"INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET",
	"WHATSAPP_APP_ID", "WHATSAPP_APP_SECRET",
	"META_APP_ID", "META_APP_SECRET", "FB_APP_ID", "FB_APP_SECRET",
	"MESSENGER_APP_ID", "MESSENGER_APP_SECRET",
}

func loadMetaConfig(t *testing.T) Config {
	t.Helper()
	t.Setenv("ENV_FILE", os.DevNull)
	t.Setenv("AGENT_DESK_ENV_FILE", os.DevNull)
	for _, name := range metaAppEnvVars {
		t.Setenv(name, "")
	}
	t.Setenv("FACEBOOK_APP_ID", "app-messenger")
	t.Setenv("FACEBOOK_APP_SECRET", "secret-messenger")
	t.Setenv("INSTAGRAM_APP_ID", "app-instagram")
	t.Setenv("INSTAGRAM_APP_SECRET", "secret-instagram")
	t.Setenv("WHATSAPP_APP_ID", "app-whatsapp")
	t.Setenv("WHATSAPP_APP_SECRET", "secret-whatsapp")

	cfg, err := Load(filepath.Join(t.TempDir(), "absent-config.yaml"))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	return *cfg
}

// A deployment that registered one Meta app per product has more than one app
// secret. Each product must verify its own webhooks with its own secret; sharing
// one variable silently breaks whichever product it does not belong to.
func TestMetaAppCredentialsResolvePerProduct(t *testing.T) {
	cfg := loadMetaConfig(t)

	messenger := cfg.MessengerApp("", "")
	if messenger.AppID != "app-messenger" || messenger.AppSecret != "secret-messenger" {
		t.Errorf("MessengerApp() = %+v, want the Facebook app credentials", messenger)
	}

	instagram := cfg.InstagramApp("", "")
	if instagram.AppID != "app-instagram" || instagram.AppSecret != "secret-instagram" {
		t.Errorf("InstagramApp() = %+v, want the Instagram app credentials", instagram)
	}

	whatsApp := cfg.WhatsAppApp("", "")
	if whatsApp.AppID != "app-whatsapp" || whatsApp.AppSecret != "secret-whatsapp" {
		t.Errorf("WhatsAppApp() = %+v, want the WhatsApp app credentials", whatsApp)
	}

	if whatsApp.AppSecret == messenger.AppSecret {
		t.Errorf("WhatsApp inherited the Messenger app secret; a two-app deployment would reject every WhatsApp webhook")
	}
}

// A channel can belong to a Meta app that is not the deployment default, so its
// own credentials have to win over the environment.
func TestMetaAppCredentialsPreferChannelValues(t *testing.T) {
	cfg := loadMetaConfig(t)

	creds := cfg.WhatsAppApp("app-channel", "secret-channel")
	if creds.AppID != "app-channel" || creds.AppSecret != "secret-channel" {
		t.Errorf("WhatsAppApp() = %+v, want the channel-level credentials", creds)
	}

	// A channel that sets only one of the two still inherits the other.
	partial := cfg.WhatsAppApp("", "secret-channel")
	if partial.AppID != "app-whatsapp" {
		t.Errorf("WhatsAppApp() app id = %q, want app-whatsapp", partial.AppID)
	}
	if partial.AppSecret != "secret-channel" {
		t.Errorf("WhatsAppApp() app secret = %q, want secret-channel", partial.AppSecret)
	}
}

// A single-app deployment sets only the shared Meta variables. Every product has
// to keep resolving to them, or upgrading would break a working installation.
func TestMetaAppCredentialsFallBackToSharedMessengerApp(t *testing.T) {
	t.Setenv("ENV_FILE", os.DevNull)
	t.Setenv("AGENT_DESK_ENV_FILE", os.DevNull)
	for _, name := range metaAppEnvVars {
		t.Setenv(name, "")
	}
	t.Setenv("META_APP_ID", "app-shared")
	t.Setenv("META_APP_SECRET", "secret-shared")

	cfg, err := Load(filepath.Join(t.TempDir(), "absent-config.yaml"))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	for name, creds := range map[string]MetaAppCredentials{
		"MessengerApp": cfg.MessengerApp("", ""),
		"InstagramApp": cfg.InstagramApp("", ""),
		"WhatsAppApp":  cfg.WhatsAppApp("", ""),
	} {
		if creds.AppID != "app-shared" || creds.AppSecret != "secret-shared" {
			t.Errorf("%s() = %+v, want the shared META_APP_* credentials", name, creds)
		}
	}
}

// The resolvers are called on webhook paths where configuration may not have been
// loaded yet. They must return the channel-level values instead of panicking.
func TestResolveMetaAppWithoutLoadedConfig(t *testing.T) {
	previous := current
	current = nil
	defer func() { current = previous }()

	creds := ResolveWhatsAppApp("app-channel", "secret-channel")
	if creds.AppID != "app-channel" || creds.AppSecret != "secret-channel" {
		t.Errorf("ResolveWhatsAppApp() = %+v, want the channel-level credentials", creds)
	}
}

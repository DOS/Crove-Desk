package config

import (
	"agent-desk/internal/pkg/enums"
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/viper"
	"github.com/subosito/gotenv"
)

type Config struct {
	Language        string                `yaml:"language"`
	Server          ServerConfig          `yaml:"server"`
	DB              DBConfig              `yaml:"db"`
	Logger          LoggerConfig          `yaml:"logger"`
	Auth            AuthConfig            `yaml:"auth"`
	Storage         StorageConfig         `yaml:"storage"`
	VectorDB        VectorDBConfig        `yaml:"vectorDB"`
	AI              AIConfig              `yaml:"ai"`
	MCP             MCPConfig             `yaml:"mcp"`
	WxWork          WxWorkConfig          `yaml:"wxWork"`
	OIDC            OIDCConfig            `yaml:"oidc"`
	CustomerSession CustomerSessionConfig `yaml:"customerSession"`
	Webhook         WebhookConfig         `yaml:"webhook"`
	Email           EmailConfig           `yaml:"email"`
	Discord         DiscordConfig         `yaml:"discord"`
	Messenger       MessengerConfig       `yaml:"messenger"`
}

func (c Config) LanguageOrDefault() string {
	switch strings.ToLower(strings.TrimSpace(c.Language)) {
	case "zh", "zh-cn", "zh_cn", "zh-hans":
		return "zh-CN"
	case "en", "en-us", "en_us":
		return "en-US"
	default:
		return "zh-CN"
	}
}

type WxWorkNotifyConfig struct {
	Enabled                bool    `yaml:"enabled"`
	ToUsers                []int64 `yaml:"toUsers"`
	Safe                   bool    `yaml:"safe"`
	EnableDuplicateCheck   bool    `yaml:"enableDuplicateCheck"`
	DuplicateCheckInterval int     `yaml:"duplicateCheckInterval"`
}

type ServerConfig struct {
	Port              int        `yaml:"port"`
	PublicURL         string     `yaml:"publicUrl"`
	CompanyName       string     `yaml:"companyName"`
	CompanyLogoURL    string     `yaml:"companyLogoUrl"`
	CompanyFaviconURL string     `yaml:"companyFaviconUrl"`
	CORS              CORSConfig `yaml:"cors"`
}

func (s ServerConfig) Address() string {
	if s.Port <= 0 {
		return ":8080"
	}
	return fmt.Sprintf(":%d", s.Port)
}

func (s ServerConfig) GetPublicBaseURL(oidcRedirectURL string) string {
	if strings.TrimSpace(s.PublicURL) != "" {
		return strings.TrimRight(strings.TrimSpace(s.PublicURL), "/")
	}
	if strings.TrimSpace(oidcRedirectURL) != "" {
		if u, err := url.Parse(strings.TrimSpace(oidcRedirectURL)); err == nil && u.Scheme != "" && u.Host != "" {
			return fmt.Sprintf("%s://%s", u.Scheme, u.Host)
		}
	}
	return ""
}

type CORSConfig struct {
	// AllowedOrigins 是允许浏览器跨域访问的 Origin 白名单，必须包含协议和域名。
	// 留空表示不允许跨域请求；同源请求通常不会携带 Origin，不受影响。
	AllowedOrigins []string `yaml:"allowedOrigins"`
}

type DBConfig struct {
	Type                   string `yaml:"type"`
	DSN                    string `yaml:"dsn"`
	MaxIdleConns           int    `yaml:"maxIdleConns"`
	MaxOpenConns           int    `yaml:"maxOpenConns"`
	ConnMaxIdleTimeSeconds int    `yaml:"connMaxIdleTimeSeconds"`
	ConnMaxLifetimeSeconds int    `yaml:"connMaxLifetimeSeconds"`
}

type LoggerConfig struct {
	Level     string `yaml:"level"`
	Format    string `yaml:"format"`
	AddSource bool   `yaml:"addSource"`
}

type AuthConfig struct {
	PasswordLoginEnabled *bool `yaml:"passwordLoginEnabled"`
	TokenTTLHours        int   `yaml:"tokenTTLHours"`
	MaxFailedAttempts    int   `yaml:"maxFailedAttempts"`
	CredentialLockMinute int   `yaml:"credentialLockMinute"`
}

func (a AuthConfig) IsPasswordLoginEnabled() bool {
	if a.PasswordLoginEnabled == nil {
		return true
	}
	return *a.PasswordLoginEnabled
}

type CustomerSessionConfig struct {
	Secret                  string `yaml:"secret"`
	TTLMinutes              int    `yaml:"ttlMinutes"`
	RefreshThresholdMinutes int    `yaml:"refreshThresholdMinutes"`
}

func (c CustomerSessionConfig) TTL() int {
	if c.TTLMinutes <= 0 {
		return 120
	}
	return c.TTLMinutes
}

func (c CustomerSessionConfig) RefreshThreshold() int {
	if c.RefreshThresholdMinutes <= 0 {
		return 30
	}
	return c.RefreshThresholdMinutes
}

type StorageConfig struct {
	Default         enums.AssetProvider `yaml:"default"`
	MaxUploadSizeMB int64               `yaml:"maxUploadSizeMB"`
	Local           LocalStorageConfig  `yaml:"local"`
	OSS             OSSStorageConfig    `yaml:"oss"`
}

func (s StorageConfig) MaxUploadSizeBytes() int64 {
	if s.MaxUploadSizeMB <= 0 {
		return 5 << 20
	}
	return s.MaxUploadSizeMB << 20
}

func (s StorageConfig) MaxRequestBodySizeBytes() int64 {
	limit := s.MaxUploadSizeBytes()
	return limit + (1 << 20)
}

type LocalStorageConfig struct {
	Root    string `yaml:"root"`
	BaseURL string `yaml:"baseUrl"`
}

type OSSStorageConfig struct {
	Endpoint        string `yaml:"endpoint"`
	Bucket          string `yaml:"bucket"`
	AccessKeyID     string `yaml:"accessKeyId"`
	AccessKeySecret string `yaml:"accessKeySecret"`
	BaseURL         string `yaml:"baseUrl"`
	Private         bool   `yaml:"private"`
	SignedURLExpire int    `yaml:"signedUrlExpireSeconds"`
}

type VectorDBConfig struct {
	Type    string                `yaml:"type"`
	Qdrant  QdrantVectorDBConfig  `yaml:"qdrant"`
	LanceDB LanceDBVectorDBConfig `yaml:"lancedb"`
}

type AIConfig struct {
	Provider           string `yaml:"provider"`
	BaseURL            string `yaml:"baseUrl"`
	APIKey             string `yaml:"apiKey"`
	LLMModel           string `yaml:"llmModel"`
	EmbeddingModel     string `yaml:"embeddingModel"`
	EmbeddingDimension int    `yaml:"embeddingDimension"`
	TimeoutMS          int    `yaml:"timeoutMs"`
	MaxRetryCount      int    `yaml:"maxRetryCount"`
}

type QdrantVectorDBConfig struct {
	Host     string `yaml:"host"`
	GrpcPort int    `yaml:"grpcPort"`
	APIKey   string `yaml:"apiKey"`
	UseTLS   bool   `yaml:"useTls"`
}

type LanceDBVectorDBConfig struct {
	Path string `yaml:"path"`
}

type MCPConfig struct {
	Enabled bool                       `yaml:"enabled"`
	Servers map[string]MCPServerConfig `yaml:"servers"`
}

type MCPServerConfig struct {
	Enabled   bool              `yaml:"enabled"`
	Endpoint  string            `yaml:"endpoint"`
	TimeoutMS int               `yaml:"timeoutMs"`
	Headers   map[string]string `yaml:"headers"`
}

type OIDCConfig struct {
	Enabled      bool     `yaml:"enabled"`
	Issuer       string   `yaml:"issuer"`
	ClientID     string   `yaml:"clientId"`
	ClientSecret string   `yaml:"clientSecret"`
	AuthStyle    string   `yaml:"authStyle"`
	RedirectURL  string   `yaml:"redirectUrl"`
	StateSecret  string   `yaml:"stateSecret"`
	Scopes       []string `yaml:"scopes"`
}

// WxWorkConfig 定义企业微信接入配置。
//
// 当前主要用于后台管理台的企业微信登录流程：
// 1. /api/auth/wxwork/login 生成企业微信授权地址
// 2. 企业微信回调到 OAuthRedirect
// 3. 后端通过 code 换取企业成员身份并完成系统登录
//
// 其中 OAuthRedirect、CorpID、CorpSecret、AgentID 为登录流程核心配置。
type WxWorkConfig struct {
	// Enabled 表示是否启用企业微信登录能力。
	// false 时不会初始化企业微信 SDK，相关登录接口不可用。
	Enabled bool `yaml:"enabled"`
	// CorpID 为企业微信公司 ID，例如 wwxxxxxxxxxxxxxxxx。
	CorpID string `yaml:"corpId"`
	// CorpSecret 为企业微信应用 Secret，用于换取 access_token。
	CorpSecret string `yaml:"corpSecret"`
	// AgentID 为企业微信自建应用 AgentID。
	AgentID string `yaml:"agentId"`
	// OAuthRedirect 为企业微信网页授权回调地址。
	// 必须填写完整 URL，且通常指向后端接口 /api/auth/wxwork/callback。
	OAuthRedirect string `yaml:"oauthRedirect"`
	// StateSecret 为登录 state 的签名密钥，用于防止篡改和重放。
	// 建议填写独立随机字符串；留空时业务代码会退回使用 CorpSecret。
	StateSecret string `yaml:"stateSecret"`
	// RSAPrivateKey 为企业微信回调解密私钥。
	// 当前登录流程未使用，保留给消息回调等场景。
	RSAPrivateKey string `yaml:"rsaPrivateKey"`
	// Token 为企业微信回调 Token。
	// 当前登录流程未使用，保留给消息回调等场景。
	Token string `yaml:"token"`
	// EncodingAESKey 为企业微信消息加解密密钥。
	// 当前登录流程未使用，保留给消息回调等场景。
	EncodingAESKey string `yaml:"encodingAESKey"`
	// Notify 为企业微信应用消息通知配置。
	Notify WxWorkNotifyConfig `yaml:"notify"`
}

type WebhookConfig struct {
	OrgSyncSecret    string `yaml:"orgSyncSecret"`
	DOSOrgSyncSecret string `yaml:"dosOrgSyncSecret"`
	OutboundURL      string `yaml:"outboundUrl"`
}

type EmailConfig struct {
	Provider      string `yaml:"provider"`
	FromAddress   string `yaml:"fromAddress"`
	FromName      string `yaml:"fromName"`
	APIKey        string `yaml:"apiKey"`
	SMTPHost      string `yaml:"smtpHost"`
	SMTPPort      int    `yaml:"smtpPort"`
	SMTPUser      string `yaml:"smtpUser"`
	SMTPPassword  string `yaml:"smtpPassword"`
	SMTPUseTLS    bool   `yaml:"smtpUseTls"`
	InboundSecret string `yaml:"inboundSecret"`
}

type DiscordConfig struct {
	ClientID     string `yaml:"clientId"`
	ClientSecret string `yaml:"clientSecret"`
	BotToken     string `yaml:"botToken"`
	PublicKey    string `yaml:"publicKey"`
}

type MessengerConfig struct {
	AppID       string `yaml:"appId"`
	AppSecret   string `yaml:"appSecret"`
	VerifyToken string `yaml:"verifyToken"`
}

func Load(path string) (*Config, error) {
	loadDotEnv(path)

	v := viper.New()
	bindConfigDefaults(v)

	if strings.TrimSpace(path) != "" {
		v.SetConfigFile(path)
		v.SetConfigType("yaml")
	}

	v.SetEnvPrefix("AGENT_DESK")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()
	bindEnvironmentAliases(v)

	if strings.TrimSpace(path) != "" {
		if err := v.ReadInConfig(); err != nil {
			var configFileNotFoundError viper.ConfigFileNotFoundError
			if !os.IsNotExist(err) && !errors.As(err, &configFileNotFoundError) {
				return nil, err
			}
		}
	}

	cfg := &Config{}
	if err := v.Unmarshal(cfg); err != nil {
		return nil, err
	}
	normalizeLoadedConfig(cfg)
	return cfg, nil
}

func loadDotEnv(configPath string) {
	if envFile := os.Getenv("AGENT_DESK_ENV_FILE"); envFile != "" {
		_ = gotenv.OverLoad(envFile)
		return
	}
	if envFile := os.Getenv("ENV_FILE"); envFile != "" {
		_ = gotenv.OverLoad(envFile)
		return
	}
	_ = gotenv.OverLoad(".env")
	_ = gotenv.OverLoad("../.env")
	_ = gotenv.OverLoad("../../.env")
	if configPath != "" {
		dir := filepath.Dir(configPath)
		if dir != "." && dir != "" {
			_ = gotenv.OverLoad(filepath.Join(dir, ".env"))
			_ = gotenv.OverLoad(filepath.Join(dir, "..", ".env"))
		}
	}
}

func bindConfigDefaults(v *viper.Viper) {
	v.SetDefault("language", "zh-CN")
	v.SetDefault("server.port", 8083)
	v.SetDefault("server.publicUrl", "")
	v.SetDefault("server.companyName", "")
	v.SetDefault("server.companyLogoUrl", "")
	v.SetDefault("server.companyFaviconUrl", "")
	v.SetDefault("server.cors.allowedOrigins", []string{})
	v.SetDefault("db.type", "sqlite")
	v.SetDefault("db.dsn", "file:./data/app.db?_busy_timeout=5000")
	v.SetDefault("db.maxIdleConns", 5)
	v.SetDefault("db.maxOpenConns", 20)
	v.SetDefault("db.connMaxIdleTimeSeconds", 300)
	v.SetDefault("db.connMaxLifetimeSeconds", 1800)
	v.SetDefault("logger.level", "info")
	v.SetDefault("logger.format", "text")
	v.SetDefault("logger.addSource", false)
	v.SetDefault("auth.tokenTTLHours", 12)
	v.SetDefault("auth.maxFailedAttempts", 5)
	v.SetDefault("auth.credentialLockMinute", 15)
	v.SetDefault("customerSession.ttlMinutes", 120)
	v.SetDefault("customerSession.refreshThresholdMinutes", 30)
	v.SetDefault("storage.default", "local")
	v.SetDefault("storage.maxUploadSizeMB", 20)
	v.SetDefault("storage.local.root", "data/storage")
	v.SetDefault("storage.local.baseUrl", "/storage")
	v.SetDefault("vectorDB.type", "qdrant")
	v.SetDefault("vectorDB.qdrant.host", "127.0.0.1")
	v.SetDefault("vectorDB.qdrant.grpcPort", 6334)
	v.SetDefault("ai.provider", "openai")
	v.SetDefault("ai.baseUrl", "https://api.openai.com/v1")
	v.SetDefault("ai.apiKey", "")
	v.SetDefault("ai.llmModel", "gpt-4o-mini")
	v.SetDefault("ai.embeddingModel", "text-embedding-3-small")
	v.SetDefault("ai.embeddingDimension", 1536)
	v.SetDefault("ai.timeoutMs", 30000)
	v.SetDefault("ai.maxRetryCount", 1)
	v.SetDefault("mcp.enabled", true)
	v.SetDefault("email.provider", "smtp")
	v.SetDefault("email.fromAddress", "")
	v.SetDefault("email.fromName", "")
	v.SetDefault("email.apiKey", "")
	v.SetDefault("email.smtpHost", "")
	v.SetDefault("email.smtpPort", 587)
	v.SetDefault("email.smtpUser", "")
	v.SetDefault("email.smtpPassword", "")
	v.SetDefault("email.smtpUseTls", false)
	v.SetDefault("email.inboundSecret", "")
	v.SetDefault("discord.clientId", "")
	v.SetDefault("discord.clientSecret", "")
	v.SetDefault("discord.botToken", "")
	v.SetDefault("discord.publicKey", "")
	v.SetDefault("messenger.appId", "")
	v.SetDefault("messenger.appSecret", "")
	v.SetDefault("messenger.verifyToken", "")
}

func bindEnvironmentAliases(v *viper.Viper) {
	// Each key lists the environment variables that may supply it. viper checks
	// the AGENT_DESK_* spelling first regardless of this order, because
	// AutomaticEnv combined with SetEnvPrefix("AGENT_DESK") resolves
	// "server.port" to AGENT_DESK_SERVER_PORT before the alias list is consulted;
	// the order below only decides precedence among the legacy spellings.
	// Keeping the prefixed name first documents that intent and stays correct if
	// AutomaticEnv is ever dropped.
	_ = v.BindEnv("server.port", "AGENT_DESK_SERVER_PORT", "PORT", "SERVER_PORT")
	_ = v.BindEnv("server.publicUrl", "AGENT_DESK_SERVER_PUBLICURL", "PUBLIC_URL", "APP_URL", "SERVER_PUBLIC_URL", "BASE_URL", "DESK_BASE_URL")
	_ = v.BindEnv("server.companyName", "AGENT_DESK_SERVER_COMPANYNAME", "COMPANY_NAME", "NEXT_PUBLIC_COMPANY_NAME", "BRAND_NAME", "BRAND_COMPANY_NAME")
	_ = v.BindEnv("server.companyLogoUrl", "AGENT_DESK_SERVER_COMPANYLOGOURL", "COMPANY_LOGO_URL", "NEXT_PUBLIC_COMPANY_LOGO_URL", "BRAND_LOGO_URL")
	_ = v.BindEnv("server.companyFaviconUrl", "AGENT_DESK_SERVER_COMPANYFAVICONURL", "COMPANY_FAVICON_URL", "NEXT_PUBLIC_COMPANY_FAVICON_URL", "BRAND_FAVICON_URL", "FAVICON_URL")
	_ = v.BindEnv("db.type", "AGENT_DESK_DB_TYPE", "DATABASE_TYPE", "DB_TYPE")
	_ = v.BindEnv("db.dsn", "AGENT_DESK_DB_DSN", "DATABASE_URL", "DB_DSN")
	_ = v.BindEnv("auth.passwordLoginEnabled", "AGENT_DESK_AUTH_PASSWORDLOGINENABLED", "PASSWORD_LOGIN_ENABLED")
	_ = v.BindEnv("auth.tokenTTLHours", "AGENT_DESK_AUTH_TOKENTTLHOURS", "AUTH_TOKEN_TTL_HOURS")
	_ = v.BindEnv("customerSession.secret", "AGENT_DESK_CUSTOMERSESSION_SECRET", "CUSTOMER_SESSION_SECRET", "SESSION_SECRET", "JWT_SECRET")
	_ = v.BindEnv("storage.default", "AGENT_DESK_STORAGE_DEFAULT", "STORAGE_DEFAULT", "STORAGE_TYPE")
	_ = v.BindEnv("storage.local.root", "AGENT_DESK_STORAGE_LOCAL_ROOT", "STORAGE_LOCAL_ROOT")
	_ = v.BindEnv("storage.local.baseUrl", "AGENT_DESK_STORAGE_LOCAL_BASEURL", "STORAGE_LOCAL_BASE_URL")
	_ = v.BindEnv("vectorDB.type", "AGENT_DESK_VECTORDB_TYPE", "VECTOR_DB_TYPE")
	_ = v.BindEnv("vectorDB.qdrant.host", "AGENT_DESK_VECTORDB_QDRANT_HOST", "QDRANT_HOST")
	_ = v.BindEnv("vectorDB.qdrant.grpcPort", "AGENT_DESK_VECTORDB_QDRANT_GRPCPORT", "QDRANT_GRPC_PORT", "QDRANT_PORT")
	_ = v.BindEnv("vectorDB.qdrant.apiKey", "AGENT_DESK_VECTORDB_QDRANT_APIKEY", "QDRANT_API_KEY")
	_ = v.BindEnv("ai.provider", "AGENT_DESK_AI_PROVIDER", "AI_PROVIDER", "OPENAI_PROVIDER")
	_ = v.BindEnv("ai.baseUrl", "AGENT_DESK_AI_BASEURL", "AI_BASE_URL", "OPENAI_BASE_URL", "OPENAI_API_BASE", "DOS_AI_BASE_URL")
	_ = v.BindEnv("ai.apiKey", "AGENT_DESK_AI_APIKEY", "AI_API_KEY", "OPENAI_API_KEY", "DOS_AI_API_KEY", "CROVE_OPENAI_API_KEY")
	_ = v.BindEnv("ai.llmModel", "AGENT_DESK_AI_LLMMODEL", "AI_LLM_MODEL", "OPENAI_LLM_MODEL", "OPENAI_MODEL", "LLM_MODEL", "DOS_AI_LLM_MODEL")
	_ = v.BindEnv("ai.embeddingModel", "AGENT_DESK_AI_EMBEDDINGMODEL", "AI_EMBEDDING_MODEL", "OPENAI_EMBEDDING_MODEL", "EMBEDDING_MODEL", "DOS_AI_EMBEDDING_MODEL")
	_ = v.BindEnv("ai.embeddingDimension", "AGENT_DESK_AI_EMBEDDINGDIMENSION", "AI_EMBEDDING_DIMENSION", "OPENAI_EMBEDDING_DIMENSION", "EMBEDDING_DIMENSION", "DOS_AI_EMBEDDING_DIMENSION")
	_ = v.BindEnv("ai.timeoutMs", "AGENT_DESK_AI_TIMEOUTMS", "AI_TIMEOUT_MS", "OPENAI_TIMEOUT_MS")
	_ = v.BindEnv("ai.maxRetryCount", "AGENT_DESK_AI_MAXRETRYCOUNT", "AI_MAX_RETRY_COUNT")
	_ = v.BindEnv("oidc.enabled", "AGENT_DESK_OIDC_ENABLED", "OIDC_ENABLED")
	_ = v.BindEnv("oidc.issuer", "AGENT_DESK_OIDC_ISSUER", "OIDC_ISSUER")
	_ = v.BindEnv("oidc.clientId", "AGENT_DESK_OIDC_CLIENTID", "OIDC_CLIENT_ID", "CUSTOM_OAUTH_CLIENT_ID")
	_ = v.BindEnv("oidc.clientSecret", "AGENT_DESK_OIDC_CLIENTSECRET", "OIDC_CLIENT_SECRET", "CUSTOM_OAUTH_CLIENT_SECRET")
	_ = v.BindEnv("oidc.authStyle", "AGENT_DESK_OIDC_AUTHSTYLE", "OIDC_AUTH_STYLE", "CUSTOM_OAUTH_AUTH_STYLE")
	_ = v.BindEnv("oidc.redirectUrl", "AGENT_DESK_OIDC_REDIRECTURL", "OIDC_REDIRECT_URL", "CUSTOM_OAUTH_REDIRECT_URI")
	_ = v.BindEnv("webhook.orgSyncSecret", "AGENT_DESK_WEBHOOK_ORGSYNCSECRET", "ORG_SYNC_SECRET", "WEBHOOK_SECRET")
	_ = v.BindEnv("webhook.outboundUrl", "AGENT_DESK_WEBHOOK_OUTBOUNDURL", "ORG_SYNC_OUTBOUND_URL", "DOS_ORG_SYNC_URL", "WEBHOOK_OUTBOUND_URL")
	_ = v.BindEnv("mcp.enabled", "AGENT_DESK_MCP_ENABLED", "MCP_ENABLED")
	_ = v.BindEnv("email.provider", "AGENT_DESK_EMAIL_PROVIDER", "EMAIL_PROVIDER")
	_ = v.BindEnv("email.fromAddress", "AGENT_DESK_EMAIL_FROMADDRESS", "EMAIL_FROM", "EMAIL_FROM_ADDRESS", "SUPPORT_EMAIL")
	_ = v.BindEnv("email.fromName", "AGENT_DESK_EMAIL_FROMNAME", "EMAIL_FROM_NAME", "EMAIL_SENDER_NAME", "SUPPORT_SENDER_NAME")
	_ = v.BindEnv("email.apiKey", "AGENT_DESK_EMAIL_APIKEY", "EMAIL_API_KEY", "BREVO_API_KEY", "CROVE_BREVO_API_KEY", "SENDGRID_API_KEY", "RESEND_API_KEY", "POSTMARK_API_KEY", "MAILGUN_API_KEY")
	_ = v.BindEnv("email.smtpHost", "AGENT_DESK_EMAIL_SMTPHOST", "SMTP_HOST", "EMAIL_SMTP_HOST")
	_ = v.BindEnv("email.smtpPort", "AGENT_DESK_EMAIL_SMTPPORT", "SMTP_PORT", "EMAIL_SMTP_PORT")
	_ = v.BindEnv("email.smtpUser", "AGENT_DESK_EMAIL_SMTPUSER", "SMTP_USER", "EMAIL_SMTP_USER", "CROVE_SMTP_USER")
	_ = v.BindEnv("email.smtpPassword", "AGENT_DESK_EMAIL_SMTPPASSWORD", "SMTP_PASSWORD", "SMTP_PASS", "EMAIL_SMTP_PASSWORD", "CROVE_SMTP_PASSWORD")
	_ = v.BindEnv("email.smtpUseTls", "AGENT_DESK_EMAIL_SMTPUSETLS", "SMTP_USE_TLS", "SMTP_SSL")
	_ = v.BindEnv("email.inboundSecret", "AGENT_DESK_EMAIL_INBOUNDSECRET", "EMAIL_INBOUND_SECRET", "EMAIL_WEBHOOK_SECRET")
	_ = v.BindEnv("discord.clientId", "AGENT_DESK_DISCORD_CLIENTID", "DISCORD_CLIENT_ID")
	_ = v.BindEnv("discord.clientSecret", "AGENT_DESK_DISCORD_CLIENTSECRET", "DISCORD_CLIENT_SECRET")
	_ = v.BindEnv("discord.botToken", "AGENT_DESK_DISCORD_BOTTOKEN", "DISCORD_BOT_TOKEN")
	_ = v.BindEnv("discord.publicKey", "AGENT_DESK_DISCORD_PUBLICKEY", "DISCORD_PUBLIC_KEY")
	_ = v.BindEnv("messenger.appId", "AGENT_DESK_MESSENGER_APPID", "META_APP_ID", "FB_APP_ID", "MESSENGER_APP_ID")
	_ = v.BindEnv("messenger.appSecret", "AGENT_DESK_MESSENGER_APPSECRET", "META_APP_SECRET", "FB_APP_SECRET", "MESSENGER_APP_SECRET")
	_ = v.BindEnv("messenger.verifyToken", "AGENT_DESK_MESSENGER_VERIFYTOKEN", "MESSENGER_VERIFY_TOKEN", "META_VERIFY_TOKEN", "FB_VERIFY_TOKEN")
}

func normalizeLoadedConfig(cfg *Config) {
	if cfg == nil {
		return
	}
	inferredDBType := ""
	if cfg.DB.Type == "sqlite" && (strings.HasPrefix(cfg.DB.DSN, "postgres://") || strings.HasPrefix(cfg.DB.DSN, "postgresql://")) {
		cfg.DB.Type = "postgres"
		inferredDBType = "postgres"
	} else if cfg.DB.Type == "sqlite" && strings.Contains(cfg.DB.DSN, "@tcp(") {
		cfg.DB.Type = "mysql"
		inferredDBType = "mysql"
	}
	if inferredDBType != "" {
		// db.type was left at its sqlite default and the engine was inferred from
		// the DSN instead. A stray DATABASE_URL in the environment is enough to
		// point the whole application at a different database, so say so out loud.
		slog.Info("database engine inferred from dsn",
			"dbType", inferredDBType,
			"reason", "db.type was left at its sqlite default while db.dsn names another engine",
		)
	}

	if cfg.MCP.Servers == nil {
		cfg.MCP.Servers = make(map[string]MCPServerConfig)
	}
	if _, ok := cfg.MCP.Servers["system"]; !ok {
		port := cfg.Server.Port
		if port <= 0 {
			port = 8083
		}
		cfg.MCP.Servers["system"] = MCPServerConfig{
			Enabled:   true,
			Endpoint:  fmt.Sprintf("http://127.0.0.1:%d/api/mcp", port),
			TimeoutMS: 15000,
		}
	}

	crmEndpoint := strings.TrimSpace(os.Getenv("MCP_CRM_ENDPOINT"))
	if crmEndpoint == "" {
		crmEndpoint = strings.TrimSpace(os.Getenv("CROVE_CRM_MCP_ENDPOINT"))
	}
	if crmEndpoint == "" {
		crmEndpoint = strings.TrimSpace(os.Getenv("TWENTY_CRM_MCP_ENDPOINT"))
	}
	if crmEndpoint != "" {
		apiKey := strings.TrimSpace(os.Getenv("MCP_CRM_API_KEY"))
		if apiKey == "" {
			apiKey = strings.TrimSpace(os.Getenv("CROVE_CRM_API_KEY"))
		}
		if apiKey == "" {
			apiKey = strings.TrimSpace(os.Getenv("TWENTY_CRM_API_KEY"))
		}
		headers := map[string]string{}
		if apiKey != "" {
			headers["Authorization"] = "Bearer " + apiKey
		}
		crmServerConfig := MCPServerConfig{
			Enabled:   true,
			Endpoint:  crmEndpoint,
			TimeoutMS: 15000,
			Headers:   headers,
		}
		cfg.MCP.Servers["twenty_crm"] = crmServerConfig
		cfg.MCP.Servers["crove_crm"] = crmServerConfig
	}
}

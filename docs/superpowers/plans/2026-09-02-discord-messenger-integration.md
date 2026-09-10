# Discord & Facebook Messenger Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tích hợp hai kênh giao tiếp Discord và Facebook Messenger vào Crove Desk (AgentDesk) hỗ trợ 1-Click OAuth connection, Inbound Webhooks ingestion, Identity mapping, và Asynchronous Outbox delivery theo chuẩn Multi-tenant SaaS.

**Architecture:** Sử dụng kiến trúc module độc lập cho API Client (`internal/discord`, `internal/messenger`), Inbound Services phân giải danh tính (`ExternalSourceDiscord`, `ExternalSourceMessenger`), Outbox Services gửi tin nhắn bất đồng bộ qua cron và goroutine, cùng các Webhook/OAuth endpoints trên Gin HTTP server và giao diện quản trị Channels trên Next.js App Router.

**Tech Stack:** Go 1.26, Gin, GORM, Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, shadcn/Base UI, i18n.

## Global Constraints
- Tuân thủ quy ước AGENTS.md: Không sửa thủ công file generated, chạy `task enums` để cập nhật TypeScript enums.
- Sử dụng `log/slog` cho logging và `any` thay vì `interface{}` trong Go code mới.
- Hỗ trợ đầy đủ 3 ngôn ngữ: `en-US.json`, `vi-VN.json`, `zh-CN.json`.
- Tất cả database queries tuân thủ SQLite và PostgreSQL/MySQL compatibility.

---

### Task 1: Backend Enums, DTOs & Generated Frontend Enums

**Files:**
- Modify: `internal/pkg/enums/wxwork_kf.go`
- Modify: `internal/pkg/enums/external_identity.go`
- Modify: `internal/pkg/dto/channel_dto.go`
- Modify: `web/lib/generated/enums.ts` (via generator command)

**Interfaces:**
- Consumes: Enums package
- Produces: `enums.ChannelTypeDiscord`, `enums.ChannelTypeMessenger`, `enums.ExternalSourceDiscord`, `enums.ExternalSourceMessenger`, `dto.DiscordChannelConfig`, `dto.MessengerChannelConfig`

- [ ] **Step 1: Write test for new enums and DTO parsing**

Create `internal/pkg/enums/channel_enums_test.go`:
```go
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/pkg/enums -run TestChannelAndExternalSourceEnums`
Expected: FAIL (constants not defined)

- [ ] **Step 3: Update enums and DTOs**

In `internal/pkg/enums/wxwork_kf.go`:
```go
const (
	ChannelTypeWeb       = "web"
	ChannelTypeWechatMP  = "wechat_mp"
	ChannelTypeWxWorkKF  = "wxwork_kf"
	ChannelTypeTelegram  = "telegram"
	ChannelTypeZaloOA    = "zalo_oa"
	ChannelTypeEmail     = "email"
	ChannelTypeDiscord   = "discord"
	ChannelTypeMessenger = "messenger"
)
```

In `internal/pkg/enums/external_identity.go`:
```go
const (
	ExternalSourceGuest     ExternalSource = "guest"      // 访客
	ExternalSourceWxWorkKF  ExternalSource = "wxwork_kf"  // 企业微信客服
	ExternalSourceUser      ExternalSource = "user"       // 用户信息
	ExternalSourceTwentyCRM ExternalSource = "twenty_crm" // Twenty CRM
	ExternalSourceTelegram  ExternalSource = "telegram"   // Telegram Bot
	ExternalSourceZaloOA    ExternalSource = "zalo_oa"    // Zalo Official Account
	ExternalSourceEmail     ExternalSource = "email"      // Email
	ExternalSourceDiscord   ExternalSource = "discord"    // Discord
	ExternalSourceMessenger ExternalSource = "messenger"  // Facebook Messenger
)
```

In `internal/pkg/dto/channel_dto.go`, add:
```go
type DiscordChannelConfig struct {
	GuildID       string `json:"guildId,omitempty"`
	GuildName     string `json:"guildName,omitempty"`
	ChannelScope  string `json:"channelScope,omitempty"` // all | dm_only
	BotToken      string `json:"botToken,omitempty"`      // Bot Token
	ApplicationID string `json:"applicationId,omitempty"`
	WebhookSecret string `json:"webhookSecret,omitempty"`
}

type MessengerChannelConfig struct {
	PageID             string `json:"pageId,omitempty"`
	PageName           string `json:"pageName,omitempty"`
	PageAccessToken    string `json:"pageAccessToken,omitempty"`
	WebhookVerifyToken string `json:"webhookVerifyToken,omitempty"`
	AppSecret          string `json:"appSecret,omitempty"`
}
```

- [ ] **Step 4: Run test and update generated enums**

Run: `go test ./internal/pkg/enums -run TestChannelAndExternalSourceEnums`
Run: `go run ./cmd/enums/generator.go` (or `task enums`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/pkg/enums internal/pkg/dto web/lib/generated/enums.ts
git commit -m "feat(enums): add discord and messenger channel and identity enums"
```

---

### Task 2: Discord & Meta Messenger API Clients

**Files:**
- Create: `internal/discord/types.go`
- Create: `internal/discord/client.go`
- Create: `internal/discord/client_test.go`
- Create: `internal/messenger/types.go`
- Create: `internal/messenger/client.go`
- Create: `internal/messenger/client_test.go`

**Interfaces:**
- Consumes: Standard HTTP client
- Produces: `discord.Client` (`SendMessage`, `CreateDMChannel`), `messenger.Client` (`SendTextMessage`, `SubscribeAppToPage`, `GetPageInfo`)

- [ ] **Step 1: Write tests for Discord & Messenger clients**

`internal/discord/client_test.go`:
```go
package discord

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDiscordSendMessage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bot test_token" {
			t.Errorf("expected Bot test_token, got %s", r.Header.Get("Authorization"))
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"id":"123456","channel_id":"789","content":"hello"}`))
	}))
	defer server.Close()

	client := NewClient("test_token")
	client.baseURL = server.URL

	resp, err := client.SendMessage(context.Background(), "789", "hello")
	if err != nil {
		t.Fatalf("SendMessage failed: %v", err)
	}
	if resp.ID != "123456" {
		t.Errorf("expected ID 123456, got %s", resp.ID)
	}
}
```

`internal/messenger/client_test.go`:
```go
package messenger

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMessengerSendMessage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"recipient_id":"psid_123","message_id":"mid_456"}`))
	}))
	defer server.Close()

	client := NewClient("page_token")
	client.baseURL = server.URL

	resp, err := client.SendTextMessage(context.Background(), "psid_123", "hello")
	if err != nil {
		t.Fatalf("SendTextMessage failed: %v", err)
	}
	if resp.MessageID != "mid_456" {
		t.Errorf("expected MessageID mid_456, got %s", resp.MessageID)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./internal/discord ./internal/messenger -v`
Expected: FAIL (packages not found)

- [ ] **Step 3: Implement Discord & Messenger clients**

Implement `internal/discord/types.go`, `internal/discord/client.go`, `internal/messenger/types.go`, and `internal/messenger/client.go`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./internal/discord ./internal/messenger -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/discord internal/messenger
git commit -m "feat(integrations): add discord and messenger rest api clients"
```

---

### Task 3: Channel Service Parsing & Inbound Processing Services

**Files:**
- Modify: `internal/services/channel_service.go`
- Create: `internal/services/discord_inbound_service.go`
- Create: `internal/services/discord_inbound_service_test.go`
- Create: `internal/services/messenger_inbound_service.go`
- Create: `internal/services/messenger_inbound_service_test.go`

**Interfaces:**
- Consumes: `ChannelService`, `ConversationService`, `MessageService`
- Produces: `services.DiscordInboundService.HandleWebhook`, `services.MessengerInboundService.HandleWebhook`

- [ ] **Step 1: Write tests for Inbound services**

Create unit tests verifying webhook parsing, signature verification, external customer identity mapping, and conversation creation.

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./internal/services -run "TestDiscordInbound|TestMessengerInbound" -v`
Expected: FAIL

- [ ] **Step 3: Implement Channel Config Parsing & Inbound Services**

- Add `ParseDiscordChannelConfig` and `ParseMessengerChannelConfig` in `ChannelService`.
- Implement `DiscordInboundService` and `MessengerInboundService` handling incoming webhook payloads, mapping `ExternalUser` and triggering `MessageService.SendCustomerMessage`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./internal/services -run "TestDiscordInbound|TestMessengerInbound" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/services/channel_service.go internal/services/discord_inbound_service* internal/services/messenger_inbound_service*
git commit -m "feat(services): implement discord and messenger inbound services"
```

---

### Task 4: Outbox Queues & Outbound Delivery Services

**Files:**
- Create: `internal/services/discord_outbound_service.go`
- Create: `internal/services/messenger_outbound_service.go`
- Modify: `internal/services/channel_message_outbox_service.go`
- Modify: `internal/services/message_service.go`
- Modify: `internal/services/cronx/cron.go`

**Interfaces:**
- Consumes: `ChannelMessageOutboxService`, `discord.Client`, `messenger.Client`
- Produces: `services.DiscordOutboundService.DispatchPendingOutbox()`, `services.MessengerOutboundService.DispatchPendingOutbox()`

- [ ] **Step 1: Write unit tests for Outbox enqueue and dispatch**

Create tests verifying `EnqueueDiscordMessage` and `EnqueueMessengerMessage` properly serialize payloads and update status upon dispatch.

- [ ] **Step 2: Implement Outbound Services & Outbox Integration**

- Implement `DiscordOutboundService` and `MessengerOutboundService` with retries and exponential backoff.
- Hook into `MessageService.Create` and `cronx/cron.go` (@every 5s loop).

- [ ] **Step 3: Run tests to verify they pass**

Run: `go test ./internal/services -run "TestDiscordOutbound|TestMessengerOutbound" -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add internal/services/discord_outbound_service.go internal/services/messenger_outbound_service.go internal/services/channel_message_outbox_service.go internal/services/message_service.go internal/services/cronx/cron.go
git commit -m "feat(outbox): implement async discord and messenger outbound delivery services"
```

---

### Task 5: HTTP Third Webhooks & OAuth Handlers & Routes

**Files:**
- Create: `internal/handlers/third/discord_handler.go`
- Create: `internal/handlers/third/messenger_handler.go`
- Create: `internal/handlers/dashboard/channel_oauth_handler.go`
- Modify: `internal/bootstrap/routes.go`
- Modify: `internal/bootstrap/server.go`

**Interfaces:**
- Consumes: Inbound services, Gin routes
- Produces:
  - `POST /api/third/discord/webhook`
  - `GET /api/third/messenger/webhook` (hub.challenge)
  - `POST /api/third/messenger/webhook`
  - `GET /api/dashboard/channel/discord/oauth/authorize` & `callback`
  - `GET /api/dashboard/channel/messenger/oauth/authorize` & `callback`

- [ ] **Step 1: Write handler tests**

Create tests for Discord and Messenger webhook endpoints and OAuth authorize URL generation.

- [ ] **Step 2: Implement handlers & register routes**

Implement third handlers and OAuth handlers, mount them under `registerThirdDiscordRoutes`, `registerThirdMessengerRoutes`, and dashboard channel routes.

- [ ] **Step 3: Run handler tests**

Run: `go test ./internal/handlers/... -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add internal/handlers internal/bootstrap
git commit -m "feat(api): add discord and messenger webhook and oauth endpoints"
```

---

### Task 6: Frontend Dashboard Channels UI & i18n Translations

**Files:**
- Modify: `web/app/(dashboard)/dashboard/channels/page.tsx`
- Modify: `web/app/(dashboard)/dashboard/channels/_components/edit.tsx`
- Modify: `web/lib/api/admin.ts`
- Modify: `web/messages/en-US.json`
- Modify: `web/messages/vi-VN.json`
- Modify: `web/messages/zh-CN.json`

**Interfaces:**
- Consumes: Channel API, i18n
- Produces: Channels list filter/icons and edit modal with OAuth Connect buttons and channel status.

- [ ] **Step 1: Add translation keys in en-US, vi-VN, zh-CN**

Add all matching keys for Discord and Messenger channel configuration, OAuth connect buttons, and descriptions.

- [ ] **Step 2: Update Channels Page & Edit Component**

- Add Discord and Facebook Messenger icons in channel list.
- Add form fields and 1-Click "Connect Discord" / "Connect Messenger" button handlers with OAuth redirect.

- [ ] **Step 3: Run TypeScript check & Lint**

Run: `pnpm --filter web typecheck` and `pnpm --filter web lint`
Expected: PASS with 0 errors

- [ ] **Step 4: Commit**

```bash
git add web/app web/lib web/messages
git commit -m "feat(ui): add discord and messenger channel support to dashboard with oauth connect"
```

---

### Task 7: Full Verification & E2E Verification

**Files:**
- Test all components across Go backend and Next.js frontend

- [ ] **Step 1: Run complete backend tests**
Run: `go test ./...`
Expected: PASS

- [ ] **Step 2: Run frontend build and typecheck**
Run: `cd web && pnpm build`
Expected: PASS

- [ ] **Step 3: Commit all changes**
```bash
git add .
git commit -m "feat(channels): complete discord and facebook messenger omnichannel integration"
```

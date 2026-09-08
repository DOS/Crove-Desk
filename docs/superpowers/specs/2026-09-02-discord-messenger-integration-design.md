# Thiết Kế Kỹ Thuật: Tích Hợp Kênh Discord & Facebook Messenger (SaaS Multi-Tenant)
> **Crove Desk Feature Specification & Architectural Blueprint**  
> *Ngày tạo: 02/09/2026*  
> *Trạng thái: Proposed / Spec In-Review*

---

## 1. Mục tiêu & Tổng quan (Executive Summary)

### 1.1. Bối cảnh
Crove Desk (AgentDesk) là nền tảng **Omnichannel Conversational Support** đa khách thuê (Multi-tenant B2B SaaS). Tiếp nối các kênh hỗ trợ đã có (Web Widget, WeCom, Telegram, Zalo OA, Email), hệ thống cần mở rộng tích hợp hai kênh giao tiếp phổ biến nhất toàn cầu:
1. **Discord**: Dành cho các cộng đồng Web3, Gaming, Developer Tools, SaaS Tech Support.
2. **Facebook Messenger**: Dành cho các doanh nghiệp E-commerce, B2C, D2C, và Dịch vụ khách hàng qua Meta Fanpage.

### 1.2. Trải nghiệm kết nối chuẩn SaaS (Standard 1-Click OAuth)
* **Người dùng (Tenant Admin)** không cần phải tự tạo Bot hay App phức tạp trên Developer Portal. Chỉ cần bấm nút **"Connect Discord"** hoặc **"Connect Facebook Messenger"**, ủy quyền qua giao diện OAuth tiêu chuẩn (giống như Crisp, Intercom, Zendesk), hệ thống sẽ tự động liên kết Server/Fanpage vào Organization tương ứng.
* **Gói Doanh nghiệp (Enterprise Tier - BYOA - Bring Your Own App)**: Đưa vào danh sách Backlog phát triển sau cho phép khách hàng tự điền Bot Token / Custom Meta App nếu có nhu cầu White-label.

---

## 2. Kiến trúc Luồng Kết nối OAuth (1-Click OAuth Connection)

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CROVE DESK 1-CLICK OAUTH FLOW                                  │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                   │
│  [Tenant Admin] ──(1) Click "Connect Discord"──► [Crove Desk Dashboard]                           │
│                                                           │ (2) Tạo OAuth State & Redirect        │
│                                                           ▼                                       │
│                                              [Discord / Meta OAuth2 Page]                         │
│                                                           │                                       │
│  [Tenant Admin] ──(3) Chọn Server / Fanpage & Cấp quyền ──┘                                       │
│                                                           │ (4) Callback kèm Auth Code            │
│                                                           ▼                                       │
│                                              [Crove Desk Backend API]                             │
│                                                           │                                       │
│  • Trao đổi Auth Code lấy Access Token / Bot Add Info     │                                       │
│  • Discord: Lưu Guild ID, Guild Name, Permissions         │                                       │
│  • Messenger: Gọi Graph API lấy Page Token & Subscribe App│                                       │
│  • Khởi tạo Channel trong Organization (Status = OK)      │                                       │
│                                                           ▼                                       │
│  [Tenant Admin] ◄──(5) Redirect về Dashboard (Connected) ─┘                                       │
│                                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Discord OAuth2 Flow
* **Platform System Configuration (Env Variables):**
  * `DISCORD_CLIENT_ID`: Client ID của Crove Desk Discord App.
  * `DISCORD_CLIENT_SECRET`: Client Secret.
  * `DISCORD_BOT_TOKEN`: Global Bot Token dùng chung cho hạ tầng SaaS của Crove Desk.
* **Quy trình kết nối:**
  1. Frontend gọi `GET /api/dashboard/channel/discord/oauth/authorize`: Backend sinh `state` (mã hóa `org_id`, `user_id`, `timestamp` ký HMAC) và trả về URL:
     ```
     https://discord.com/oauth2/authorize?client_id={DISCORD_CLIENT_ID}&permissions=19456&response_type=code&redirect_uri={REDIRECT_URI}&scope=bot+applications.commands&state={STATE}
     ```
  2. Người dùng chọn Discord Server (Guild) và chấp thuận thêm Crove Desk Bot vào server.
  3. Discord chuyển hướng về Callback URL `GET /api/dashboard/channel/discord/oauth/callback?code={CODE}&guild_id={GUILD_ID}&state={STATE}`.
  4. Backend xác thực state, lưu `guild_id`, `guild_name` vào cấu hình Channel và liên kết với AI Agent mặc định.

### 2.2. Facebook Messenger OAuth Flow
* **Platform System Configuration (Env Variables):**
  * `META_APP_ID`: App ID của Crove Desk trên Meta for Developers.
  * `META_APP_SECRET`: App Secret của Meta App.
* **Quy trình kết nối:**
  1. Frontend gọi `GET /api/dashboard/channel/messenger/oauth/authorize`: Backend sinh URL Facebook Login:
     ```
     https://www.facebook.com/v21.0/dialog/oauth?client_id={META_APP_ID}&redirect_uri={REDIRECT_URI}&scope=pages_show_list,pages_messaging,pages_manage_metadata&state={STATE}
     ```
  2. Tenant Admin chọn các Fanpage muốn kết nối.
  3. Callback `GET /api/dashboard/channel/messenger/oauth/callback?code={CODE}&state={STATE}`:
     - Backend đổi code lấy User Access Token dài hạn.
     - Lấy danh sách Pages (`GET /me/accounts`) $\rightarrow$ Lấy `page_id`, `page_name`, `access_token` cho từng Fanpage.
     - Tự động gọi API đăng ký Webhook Fanpage: `POST /{page_id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token={page_access_token}`.
     - Tạo bản ghi Channel tương ứng cho Fanpage.

---

## 3. Kiến trúc Xử lý Inbound (Inbound Ingestion & Identity Resolution)

```
                       INBOUND WEBHOOK PROCESSING PIPELINE

   [ Discord Webhook / Gateway ]                   [ Meta Messenger Webhook ]
                 │                                               │
                 ▼                                               ▼
   POST /api/third/discord/webhook               POST /api/third/messenger/webhook
                 │                                               │
       [ Chữ ký Ed25519 / Secret ]                     [ Chữ ký X-Hub-Signature-256 ]
                 │                                               │
                 ▼                                               ▼
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │                     UNIVERSAL IDENTITY & CHANNEL RESOLVER                   │
   │  • Discord: Guild ID / DM Channel ID -> Tìm t_channel (type: discord)       │
   │  • Messenger: recipient.id (Page ID) -> Tìm t_channel (type: messenger)     │
   │  • Customer Identity:                                                       │
   │    - Discord: ExternalSource="discord", ExternalID=discord_user_id          │
   │    - Messenger: ExternalSource="messenger", ExternalID=psid (Page-Scoped ID)│
   └──────────────────────────────────────┬──────────────────────────────────────┘
                                          │
                                          ▼
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │                        CONVERSATION & MESSAGE ENGINE                        │
   │  1. ConversationService.Create(externalUser, channelID, aiAgentID)          │
   │  2. MessageService.SendCustomerMessage(...)                                 │
   │  3. Realtime Push (WebSocket) tới Workbench                                 │
   │  4. Kích hoạt AI Agent Auto-Reply Loop (nếu có cấu hình AI)                 │
   └─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1. Discord Inbound
* **Payload cấu trúc:**
  * Sender ID: `author.id`, Display Name: `author.global_name` hoặc `author.username`.
  * Context: `guild_id` (nếu là Server message) hoặc `channel_id` (nếu là Direct Message).
* **Identity Mapping:**
  * `ExternalSource`: `enums.ExternalSourceDiscord` (`"discord"`).
  * `ExternalID`: `author.id`.
  * `ExternalName`: `author.global_name` (fallback `author.username`).

### 3.2. Facebook Messenger Inbound
* **Webhook Handlers:**
  * `GET /api/third/messenger/webhook`: Trả về `hub.challenge` khi `hub.verify_token` khớp cấu hình.
  * `POST /api/third/messenger/webhook`: Nhận payload JSON `entry[].messaging[]`.
* **Payload cấu trúc:**
  * Sender: `messaging.sender.id` (PSID - Page Scoped User ID).
  * Recipient: `messaging.recipient.id` (Page ID $\rightarrow$ Khóa để map với `t_channel`).
  * Message: `messaging.message.text` / attachments (ảnh, audio, file).
* **Identity Mapping:**
  * `ExternalSource`: `enums.ExternalSourceMessenger` (`"messenger"`).
  * `ExternalID`: `psid`.
  * `ExternalName`: `Facebook User {psid}` (có thể enrich qua Graph API nếu có quyền).

---

## 4. Kiến trúc Xử lý Outbound (Async Outbox Queue Engine)

Hệ thống tuân thủ nghiêm ngặt cơ chế **Asynchronous Outbox Queue** của Crove Desk:

```
  [ Agent Reply trên Workbench ]  HOẶC  [ AI Agent sinh câu trả lời ]
                                │
                                ▼
                   MessageService.Create(...)
                                │
                                ▼
       ┌─────────────────────────────────────────────────┐
       │     ChannelMessageOutboxService.Enqueue...      │
       │  • EnqueueDiscordMessage(...)                   │
       │  • EnqueueMessengerMessage(...)                 │
       └────────────────────────┬────────────────────────┘
                                │ (Ghi DB: send_status = 'pending')
                                ▼
       ┌─────────────────────────────────────────────────┐
       │           ASYNC OUTBOX WORKER & CRON            │
       │  • Trigger tức thì qua Goroutine                │
       │  • Backup quét định kỳ @every 5s                │
       │  • Tối đa 5 lần retry (Exponential Backoff)     │
       └────────────────────────┬────────────────────────┘
                                │
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
     [ DiscordOutboundService ]    [ MessengerOutboundService ]
                 │                             │
                 ▼                             ▼
       Discord REST API v10            Meta Graph API v21.0
  POST /channels/{id}/messages       POST /v21.0/me/messages
```

### 4.1. `DiscordOutboundService`
* Sử dụng Bot Token (`DISCORD_BOT_TOKEN` từ hệ thống hoặc `bot_token` của kênh).
* Gọi Discord REST API: `POST https://discord.com/api/v10/channels/{channel_id}/messages`.
* Hỗ trợ tạo DM channel nếu là chat 1-1: `POST https://discord.com/api/v10/users/@me/channels` với `recipient_id`.

### 4.2. `MessengerOutboundService`
* Lấy `page_access_token` từ cấu hình kênh (`channel.config_json`).
* Gọi Meta Send API:
  ```http
  POST https://graph.facebook.com/v21.0/me/messages?access_token={PAGE_ACCESS_TOKEN}
  Content-Type: application/json

  {
    "recipient": { "id": "{PSID}" },
    "message": { "text": "{MESSAGE_CONTENT}" },
    "messaging_type": "RESPONSE"
  }
  ```

---

## 5. Cấu trúc Dữ liệu & Thay đổi Mã nguồn (Technical Changes)

### 5.1. Backend Enums & Models
1. **`internal/pkg/enums/wxwork_kf.go` (Channel Types):**
   ```go
   ChannelTypeDiscord   = "discord"
   ChannelTypeMessenger = "messenger"
   ```
2. **`internal/pkg/enums/external_identity.go` (External Sources):**
   ```go
   ExternalSourceDiscord   ExternalSource = "discord"
   ExternalSourceMessenger ExternalSource = "messenger"
   ```
3. **Channel Configurations DTO (`internal/pkg/dto/channel_dto.go`):**
   ```go
   type DiscordChannelConfig struct {
       GuildID       string `json:"guildId,omitempty"`
       GuildName     string `json:"guildName,omitempty"`
       ChannelScope  string `json:"channelScope,omitempty"` // all | dm_only
       BotToken      string `json:"botToken,omitempty"`      // For Enterprise BYOA
       ApplicationID string `json:"applicationId,omitempty"`
       WebhookSecret string `json:"webhookSecret,omitempty"`
   }

   type MessengerChannelConfig struct {
       PageID             string `json:"pageId,omitempty"`
       PageName           string `json:"pageName,omitempty"`
       PageAccessToken    string `json:"pageAccessToken,omitempty"`
       WebhookVerifyToken string `json:"webhookVerifyToken,omitempty"`
       AppSecret          string `json:"appSecret,omitempty"` // For Enterprise BYOA
   }
   ```

### 5.2. New Backend Services & Handlers
* `internal/discord/client.go`: Client REST API giao tiếp với Discord v10.
* `internal/messenger/client.go`: Client Graph API giao tiếp với Meta Messenger v21.0.
* `internal/services/discord_inbound_service.go` & `discord_outbound_service.go`.
* `internal/services/messenger_inbound_service.go` & `messenger_outbound_service.go`.
* `internal/handlers/third/discord_handler.go` & `messenger_handler.go`.
* `internal/handlers/dashboard/channel_oauth_handler.go` (OAuth Connect/Callback cho Discord & Messenger).

### 5.3. Frontend Updates
* **Generated Enums**: Chạy `task enums` cập nhật `web/lib/generated/enums.ts`.
* **Channels List (`web/app/(dashboard)/dashboard/channels/page.tsx`)**:
  * Thêm biểu tượng và bộ lọc cho Discord và Facebook Messenger.
* **Channels Edit Dialog (`web/app/(dashboard)/dashboard/channels/_components/edit.tsx`)**:
  * Thêm tab cấu hình và nút "Connect Discord" / "Connect Messenger" (1-Click OAuth).
  * Hiển thị thông tin sau kết nối: Tên Server / Fanpage, Webhook Status.
* **Đa ngôn ngữ (`web/messages/*.json`)**:
  * Bổ sung đầy đủ nhãn, tooltip và hướng dẫn tiếng Anh, tiếng Việt, tiếng Trung.

---

## 6. Danh mục Công việc Phát triển Sau (Future / Enterprise Backlog)

- [ ] **Enterprise Custom Bot / App (BYOA - Bring Your Own App)**: Cho phép khách hàng gói Enterprise nhập trực tiếp Custom Discord Bot Token hoặc Custom Meta App ID/Secret riêng để hoàn toàn White-label thương hiệu.
- [ ] **Rich Media Support**: Mở rộng gửi nhận ảnh, video, sticker, file đính kèm đa phương tiện cho Discord và Messenger.
- [ ] **Interactive Buttons & Quick Replies**: Hỗ trợ Message Components (Buttons/Select Menus trên Discord, Generic Templates / Quick Replies trên Messenger).

# Kiến Trúc Tái Cấu Trúc Hỗ Trợ Đa Kênh Hợp Nhất (Omnichannel Conversational Support Architecture)
> **Crove Desk Architecture Blueprint & Technical Specification**  
> *Phiên bản: 2.0 (Tháng 9/2026)*  
> *Mục tiêu: Chuyển đổi từ mô hình Ticket truyền thống (Zendesk 1.0) sang Mô hình Conversational Support hiện đại (Intercom, Crisp, Front, Kustomer) kết hợp hệ thống Email Domain đa khách thuê (Multi-tenant).*

---

## 1. Bối cảnh & Động lực Tái cấu trúc (Executive Summary)

### 1.1. Vấn đề của mô hình cũ (Legacy Ticket Silo)
Trong kiến trúc ban đầu của AgentDesk (và các hệ thống Helpdesk cổ điển như Zendesk 1.0), hệ thống chia tách hai thực thể hoàn toàn độc lập:
1. **Conversations (`t_conversation`, `t_message`)**: Dành cho chat thời gian thực (Web Widget, WeCom, Telegram, Zalo).
2. **Tickets (`t_ticket`, `t_ticket_progress`)**: Dành cho phiếu hỗ trợ tĩnh (Form, Email), lưu tiêu đề, mô tả tĩnh và cập nhật tiến độ thủ công.

**Hậu quả:**
* **Trải nghiệm nhân viên bị phân mảnh:** Nhân viên hỗ trợ phải nhảy qua lại giữa `/workbench` (chat) và `/workbench/tickets` (ticket).
* **Đứt gãy ngữ cảnh (Context Fragmentation):** Khi tạo Ticket từ một phiên chat, ngữ cảnh bị đóng băng tại thời điểm tạo. Khách nhắn tiếp thì chat vẫn chạy mà ticket không cập nhật tự động.
* **Trùng lặp dữ liệu & logic vận hành:** Cả 2 bảng đều có `customer_id`, `assignee_id`, `team_id`, `status`, `priority`, `tags` $\rightarrow$ sinh ra logic phân công (routing), thống kê báo cáo và phân quyền bị trùng lặp gấp đôi.

### 1.2. Xu hướng chuẩn hóa toàn cầu: "A Conversation IS the Ticket"
Tất cả các nền tảng Customer Support hàng đầu hiện nay (**Intercom, Crisp, Front, Kustomer, Zendesk Messaging**) đều đã chuyển dịch hoàn toàn sang **Conversational Support Model**:
* Mọi tương tác của khách hàng (Web Chat, Email, Telegram, Zalo OA, WhatsApp, Messenger) đều là **một luồng Hội thoại (Conversation)**.
* **Hội thoại mang đầy đủ thuộc tính quản trị của Ticket:** Trạng thái xử lý (Status), Độ ưu tiên (Priority), Hạn cam kết dịch vụ (SLA), Nhân viên/Nhóm tiếp nhận (Assignee/Team), Ghi chú nội bộ (Internal Notes), Nhãn phân loại (Tags) và Dữ liệu CRM liên kết.

---

## 2. Mô hình Kiến trúc Tổng thể (Target Architecture)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                           CROVE DESK OMNICHANNEL CONVERSATION PLATFORM                   │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                 INGRESS CHANNELS LAYER                                   │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌─────────────┐ │
│  │  Web Widget   │ │ Email Channel │ │ Telegram Bot  │ │   Zalo OA     │ │  WeCom /... │ │
│  │ (SDK & Ws)    │ │(Cloudflare/ESP│ │ (Bot Webhook) │ │ (CS Webhook)  │ │ (Callbacks) │ │
│  └───────┬───────┘ └───────┬───────┘ └───────┬───────┘ └───────┬───────┘ └──────┬──────┘ │
├──────────┼─────────────────┼─────────────────┼─────────────────┼────────────────┼────────┤
│          ▼                 ▼                 ▼                 ▼                ▼        │
│ ┌──────────────────────────────────────────────────────────────────────────────────────┐ │
│ │                     UNIVERSAL INBOUND ROUTER & IDENTITY RESOLVER                     │ │
│ │  • Tenant/Org Resolution (<slug>.on.crove.email / Custom Domain / Channel ID)        │ │
│ │  • Smart Conversation Threading (In-Reply-To, Message-ID, Subject #ID, Timeout)      │ │
│ │  • Customer 360 & CRM Mirror Mapping (t_customer, t_company from Twenty CRM)         │ │
│ └──────────────────────────────────┬───────────────────────────────────────────────────┘ │
├────────────────────────────────────┼─────────────────────────────────────────────────────┤
│                                    ▼                                                     │
│ ┌──────────────────────────────────────────────────────────────────────────────────────┐ │
│ │                      UNIFIED CONVERSATION ENGINE (CORE DATA MODEL)                   │ │
│ │  • Model: t_conversation (Replaces t_ticket)                                         │ │
│ │    - Issue Lifecycle: unassigned -> open -> waiting -> snoozed -> resolved -> closed│ │
│ │    - SLA Tracking: first_response_due_at, resolution_due_at, sla_policy_id          │ │
│ │    - Omnichannel Metadata: channel_type, priority, tags, custom_attributes           │ │
│ │  • Timeline: t_message                                                               │ │
│ │    - Types: customer_msg, agent_reply, ai_reply, internal_note, activity_log         │ │
│ └──────────────────┬───────────────────────────────────────────────┬───────────────────┘ │
├────────────────────┼───────────────────────────────────────────────┼─────────────────────┤
│                    ▼                                               ▼                     │
│ ┌───────────────────────────────────────┐ ┌────────────────────────────────────────────┐ │
│ │      AI AGENT RUNTIME & MCP LAYER     │ │      UNIFIED WORKBENCH AGENT INBOX         │ │
│ │  • RAG Knowledge Base Retrieval       │ │  • 3-Pane Layout: Views - Timeline - 360°  │ │
│ │  • Auto-Triage, Tagging & Intent      │ │  • Switcher: Public Reply <-> Private Note │ │
│ │  • Tier-2 MCP Tools (Twenty CRM Deal) │ │  • SLA Counters, Quick Macros, Realtime Ws │ │
│ └───────────────────────────────────────┘ └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Kiến trúc Email Domain Đa khách thuê (Multi-tenant Email Architecture)

Lấy cảm hứng từ cơ chế chuẩn của **Crisp (`<slug>.on.crisp.email`)** và **Intercom (`<workspace>.intercom-mail.com`)**, Crove Desk cung cấp 2 tầng cấu hình Email cho mọi Organization:

```
                                  EMAIL INBOUND FLOW
                                  
  Khách hàng gửi mail              Cloudflare Email Routing Worker         Crove Desk Core
 ───────────────────────► [ MX: mail.crove.com ] ───────────────────────► [ POST /api/third/email/webhook ]
                             (Wildcard Rule: *@on.crove.email)
                                    │
                                    ├─► Phân tích to: help@acme.on.crove.email
                                    ├─► Trích xuất Org Slug = "acme"
                                    ├─► Tìm Tenant "acme" & gán Channel tương ứng
                                    └─► Đẩy JSON đã chuẩn hóa vào Webhook
```

### 3.1. Phân tích Chuẩn Công nghiệp: So sánh Mô hình Intercom, Crisp & Help Scout

| Tiêu chí | Mô hình Intercom | Mô hình Crisp | Mô hình Đề xuất của Crove Desk |
|---|---|---|---|
| **Định dạng Forwarding** | `<inbox_token>@<org_slug>-<hash>.intercom-mail.com`<br/>*(Ví dụ: `iaz4gsvh@dos-b52d1b089de1.intercom-mail.com`)* | `<org_slug>.on.crisp.email`<br/>*(Ví dụ: `doschain.on.crisp.email`)* | **`<inbox_token>@<org_slug>.crove-mail.com`**<br/>*(hoặc `help@<org_slug>.on.crove.email`)* |
| **Bảo mật & Tránh Spam** | Rất cao (Random token `iaz4gsvh` chống đoán mò hòm thư) | Trung bình (Dựa trên slug cố định) | **Rất cao** (Tự sinh token 8 ký tự cho mỗi Inbox) |
| **Đa hòm thư / Kênh** | Hỗ trợ nhiều Inbound Address cho 1 Workspace (`sales`, `support`, `billing`) | 1 Inbox chính / Workspace | **Hỗ trợ không giới hạn Inboxes** cho mỗi Organization |
| **Tách biệt Tên miền** | Dùng riêng `intercom-mail.com` (tránh xung đột DNS app chính) | Dùng riêng `on.crisp.email` | Dùng riêng **`crove-mail.com`** hoặc **`on.crove.email`** |
| **Quy trình Xác thực Forwarding (Gmail / Outlook)** | Tự động hứng email chứa mã OTP / Link xác minh vào Inbox Unassigned | Tự động hứng vào Inbox | **Tự động chuyển tiếp mã OTP / Link xác nhận vào Unassigned Inbox**, kèm nút probe test "Verify automatic forwarding" |

### 3.2. Cấu hình Tầng 1: Basic Domain (Auto-Forwarding - Zero-Config 100%)
Mỗi Kênh Email khi khởi tạo trong một Organization sẽ được cấp phát ngay một **Forwarding Address chuyên dụng**:
* **Cú pháp:** `[inbox_token]@[org_slug].crove-mail.com` (Ví dụ: `sup8k2q1@tingee.crove-mail.com`).
* **Quy trình kích hoạt 2 bước (Chuẩn UX Intercom):**
  1. **Bước 1: Copy địa chỉ chuyển tiếp vào Gmail / Outlook:**
     - Admin vào phần cài đặt chuyển tiếp (*Automatic Forwarding*) trên hộp thư doanh nghiệp (ví dụ: `support@tingee.com`).
     - Dán địa chỉ `sup8k2q1@tingee.crove-mail.com` làm địa chỉ nhận chuyển tiếp.
     - *Lưu ý:* Gmail/Outlook sẽ gửi 1 email xác thực có chứa mã số hoặc link xác nhận. Email này sẽ tự động xuất hiện ngay trên Crove Desk Workbench tại mục **Unassigned Inbox** để nhân viên bấm xác nhận một cách tiện lợi.
  2. **Bước 2: Xác nhận hoạt động (Verify Automatic Forwarding):**
     - Bấm nút **Verify automatic forwarding** trên giao diện Crove Desk.
     - Hệ thống tự động gửi 1 email kiểm thử và chuyển trạng thái kênh sang **Connected / Active** kèm badge xanh.

### 3.3. Cấu hình Tầng 2: Custom Domain (Thương hiệu riêng của Doanh nghiệp)
Dành cho các Doanh nghiệp muốn gửi/nhận email trực tiếp dưới tên miền phụ của chính họ (ví dụ `emails.acme.com` hoặc `support.acme.com`):
* **Bản ghi DNS yêu cầu Tenant cấu hình:**
  * `MX`: Trỏ về `mail.crove.com` (Cloudflare Email Routing) với độ ưu tiên `10`.
  * `TXT (SPF)`: `v=spf1 include:_spf.crove.email ~all`.
  * `CNAME / TXT (DKIM)`: `crove._domainkey.acme.com` để xác thực chữ ký chống Spam/Phishing.
* **Giao diện Dashboard:**
  * Cung cấp bảng DNS Records trực quan kèm nút Copy 1 chạm.
  * Tự động kiểm tra DNS (`Verify Domain Setup`) và cảnh báo nếu bản ghi chưa kích hoạt hoặc bị cấu hình sai.

### 3.4. Cơ chế Gửi đi (Outbound Delivery)
1. **Shared Delivery (Mặc định):** Sử dụng hạ tầng gửi tập trung của Crove Desk (qua Brevo / AWS SES) với Sender `ACME Support <help@acme.crove-mail.com>` và `Reply-To: support@acme.com`.
2. **BYOK (Bring Your Own Key):** Cho phép Tenant tự cấu hình SMTP riêng hoặc API Key riêng (SendGrid, Postmark, Resend, Mailgun, Brevo) ngay trong trang **Settings > Channels > Email Delivery**.

---

## 4. Tái cấu trúc Data Model: Sáp nhập Ticket vào Conversation

### 4.1. Bảng `t_conversation` mở rộng (Thay thế hoàn toàn `t_ticket`)

```sql
-- Cập nhật cấu trúc bảng t_conversation trên PostgreSQL schema desk
ALTER TABLE desk.t_conversation
  ADD COLUMN IF NOT EXISTS subject VARCHAR(255) DEFAULT '',            -- Tiêu đề vấn đề (hữu ích cho Email & Formal Tickets)
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal',       -- urgent | high | normal | low
  ADD COLUMN IF NOT EXISTS sla_policy_id BIGINT DEFAULT 0,              -- SLA Policy áp dụng
  ADD COLUMN IF NOT EXISTS sla_status VARCHAR(20) DEFAULT 'normal',     -- normal | warning | breached
  ADD COLUMN IF NOT EXISTS first_response_due_at TIMESTAMP WITH TIME ZONE, -- Hạn chót phản hồi đầu tiên (SLA)
  ADD COLUMN IF NOT EXISTS resolution_due_at TIMESTAMP WITH TIME ZONE,     -- Hạn chót giải quyết hội thoại (SLA)
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,           -- Thời điểm giải quyết
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE,             -- Thời điểm đóng hội thoại
  ADD COLUMN IF NOT EXISTS custom_attributes JSONB DEFAULT '{}'::jsonb,   -- Thuộc tính mở rộng (Deal ID, Subscription tier...)
  ADD COLUMN IF NOT EXISTS source_metadata JSONB DEFAULT '{}'::jsonb;     -- Metadata kênh (Email Message-ID, Telegram Chat ID...)

-- Đảm bảo chỉ mục tối ưu cho Inbox Queries (< 2ms)
CREATE INDEX IF NOT EXISTS idx_conv_org_status_priority ON desk.t_conversation(status, priority, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_sla_due ON desk.t_conversation(sla_status, first_response_due_at, resolution_due_at);
```

### 4.2. Vòng đời Trạng thái Hội thoại (Unified Conversation Lifecycle)

```
                       ┌─────────────────────────────────────┐
                       │  NEW INBOUND MESSAGE / EMAIL / CHAT │
                       └──────────────────┬──────────────────┘
                                          │
                                          ▼
                             ┌────────────────────────┐
                             │ status = "unassigned"  │ ◄─── (Khách mới gửi / Chưa ai nhận)
                             └────────────┬───────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
     ┌────────────────────────┐                      ┌────────────────────────┐
     │  status = "ai_serving" │                      │    status = "open"     │
     │  (AI Agent đang xử lý) │                      │ (Agent đã nhận xử lý)  │
     └────────────┬───────────┘                      └────────────┬───────────┘
                  │ (Handoff / Escalation)                        │
                  └───────────────────────┬───────────────────────┘
                                          │
                                          ▼
                             ┌────────────────────────┐
                             │  status = "waiting"    │ ◄─── (Đã gửi phản hồi, đợi khách trả lời)
                             └────────────┬───────────┘
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  │ (Khách phản hồi)      │ (Đã xong việc)        │ (Tạm hoãn)
                  ▼                       ▼                       ▼
     ┌────────────────────────┐ ┌───────────────────┐ ┌──────────────────────┐
     │    status = "open"     │ │status = "resolved"│ │  status = "snoozed"  │
     └────────────────────────┘ └─────────┬─────────┘ └──────────────────────┘
                                          │ (Tự động sau 7 ngày / Manual)
                                          ▼
                                ┌───────────────────┐
                                │ status = "closed" │
                                └───────────────────┘
```

### 4.3. Bảng `t_message`: Hỗ trợ Ghi chú nội bộ (Private Internal Notes)

```sql
-- Thêm sender_type = 'note' để nhân viên trao đổi nội bộ ngay trên luồng chat
-- Note này chỉ hiển thị cho Agent trong Dashboard, KHÔNG BAO GIỜ gửi ra ngoài cho khách hàng (Web/Email/Telegram).
```

* **`sender_type` Enum:**
  * `customer`: Khách hàng gửi vào.
  * `agent`: Nhân viên gửi phản hồi cho khách.
  * `ai`: AI Agent tự động trả lời khách.
  * `note`: **Ghi chú nội bộ (Private Team Note)** giữa các nhân viên / AI tư vấn nội bộ.
  * `system`: Nhật ký hệ thống (phân công, đổi độ ưu tiên, gắn tag, kích hoạt workflow).

---

## 5. Thuật toán Ghép nối Hội thoại Thông minh (Smart Conversation Threading)

Khi có một tin nhắn hoặc email gửi đến từ bất kỳ kênh nào, Inbound Router xử lý theo thứ tự ưu tiên:

```
 1. Kiểm tra Header Threading (Email):
    ├─ In-Reply-To header có khớp với Message-ID nào trong DB không?
    └─ References header có chứa Message-ID gốc của cuộc hội thoại nào không?
    ──► CÓ: Ghép ngay vào Conversation ID tương ứng.

 2. Kiểm tra Tiêu đề Subject (Email / Form):
    ├─ Regex tìm mã Ticket/Hội thoại: `(?i)\[#(?:Ticket\s*#?)?(\d+)\]`
    └─ Nếu tìm thấy ID hợp lệ và cuộc hội thoại chưa bị Đóng (closed)
    ──► CÓ: Ghép ngay vào Conversation ID đó.

 3. Kiểm tra Phiên Chat đang hoạt động (Chat Channels: Web, Telegram, Zalo):
    ├─ Khách hàng (CustomerID) có cuộc hội thoại nào đang ở trạng thái (unassigned, open, waiting) trên Channel này không?
    ──► CÓ: Ghép vào phiên hội thoại đang mở gần nhất.

 4. Trường hợp không khớp (Fall-through):
    └─ Tạo một Conversation mới $\rightarrow$ Kích hoạt AI Welcome Message / AI Agent Loop.
```

---

## 6. Thiết kế Trải nghiệm Người dùng: Unified Workbench

Loại bỏ hoàn toàn tab riêng "Tickets" tại thanh bên điều hướng trái. Giao diện `/workbench` trở thành trung tâm duy nhất:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [Crove Desk Logo]                                                          (🔔) [Avatar Joy • OWNER]   │
├──────────────┬──────────────────────────────────────────┬──────────────────────────────────────────────┤
│ INBOX VIEWS  │ CONVERSATION LIST                        │ CONVERSATION TIMELINE & CUSTOMER 360         │
├──────────────┼──────────────────────────────────────────┼──────────────────────────────────────────────┤
│ 📥 All (12)  │ [Email] Anh Le • Tingee Corp   10:30 AM  │ 👤 Anh Le (CEO • Tingee Corp)                │
│ 👤 Mine (3)  │ [Re: [#102] Báo giá gói Enterprise]     │ 📧 joy@tingee.com | 📱 +84901234567          │
│ ⏳ Waiting(5)│ Chào đội ngũ hỗ trợ, chúng tôi muốn...   │ 🏢 Company: Tingee Corp (Tier: Enterprise)   │
│ ⚡ SLA Alert │                                          │ 🔗 CRM: Deal $12,000 (Stage: Proposal)       │
│ 🤖 AI Handled│ [Telegram] @johndoe            09:45 AM  │ ──────────────────────────────────────────── │
│ ──────────── │ Hỏi về tính năng tích hợp Twenty CRM...  │ 🏷️ Priority: [ High ▼ ]   Status: [ Open ▼ ] │
│ CHANNELS     │                                          │ 🏷️ Assignee: [ Joy Le ▼ ] Team: [ Sales ▼ ]   │
│ 🌐 Web (4)   │ [Web Chat] Guest_8bfa5d        08:15 AM  │ ──────────────────────────────────────────── │
│ 📧 Email (5) │ Hướng dẫn cấu hình SSO OIDC...           │ [ 💬 Customer Reply ]  [ 🔒 Internal Note ]   │
│ ✈️ Telegram(2)│                                          │ ──────────────────────────────────────────── │
│ 💬 Zalo (1)  │                                          │ 👤 Khách: Chào team, cho mình xin báo giá?   │
│ ──────────── │                                          │ 🤖 AI: Chào anh, em gửi bảng giá chi tiết... │
│ 📁 Tags      │                                          │ 🔒 Note (Joy): Đã sync Deal qua Twenty CRM.  │
│ 🏷️ Billing   │                                          │ ──────────────────────────────────────────── │
│ 🏷️ Bug       │                                          │ [ Nhập nội dung phản hồi / Gõ @gọi đồng đội]│
│ 🏷️ Feature   │                                          │ [ Gửi phản hồi (Ctrl+Enter) ]                │
└──────────────┴──────────────────────────────────────────┴──────────────────────────────────────────────┘
```

### Các tính năng cốt lõi trên màn hình Unified Workbench:
1. **Chuyển đổi 1 chạm giữa "Reply Khách" và "Ghi chú Nội bộ":** Nhân viên có thể note trao đổi riêng tư (màu vàng nhạt) mà khách không thấy.
2. **Side-by-side CRM Context (Tầng 1):** Toàn bộ dữ liệu Công ty, Khách hàng, Deal từ Twenty CRM hiển thị tức thì bên panel phải (< 5ms).
3. **Gọi Tool AI / MCP Actions (Tầng 2):** Nút hành động nhanh "Tạo Deal CRM", "Giao Task CRM", "Nâng hạn mức" ngay trong panel hội thoại.
4. **Bộ lọc SLA & Deadline:** Đếm ngược thời gian còn lại trước khi vi phạm cam kết phản hồi.

---

## 7. Lộ trình Triển khai Kỹ thuật (Implementation Roadmap)

| Giai đoạn | Hạng mục công việc | Output kỹ thuật & File tác động |
|---|---|---|
| **Pha 1: Data Model & Migrations** | Mở rộng `t_conversation` (subject, priority, sla, custom_attributes), hỗ trợ `sender_type = note` trên `t_message`. Viết migration idempotent cho cả PostgreSQL và SQLite. | `internal/models/models.go`<br/>`internal/migration/000011_unify_tickets_into_conversations.go` |
| **Pha 2: Backend Core Services** | Nâng cấp `ConversationService` quản lý full lifecycle (Priority, SLA, Internal Notes). Cập nhật Inbound Router hỗ trợ Smart Threading. | `internal/services/conversation_service.go`<br/>`internal/services/email_inbound_service.go`<br/>`internal/services/message_service.go` |
| **Pha 3: Email Domain & Multi-tenant Router** | Hỗ trợ cấu hình `Basic domain` (`<slug>.on.crove.email`) và `Custom domain`. Triển khai Cloudflare Worker Gateway. | `scripts/cloudflare-email-worker/`<br/>`internal/services/channel_service.go` |
| **Pha 4: Unified Workbench UI** | Sáp nhập UI: Xóa tab Tickets rời, tích hợp Quick Views (All, Mine, Waiting, Snoozed, Channels), bộ soạn thảo Reply/Note tab, và Customer 360 panel. | `web/app/(dashboard)/workbench/`<br/>`web/components/workbench-rail.tsx`<br/>`web/components/workbench/*` |
| **Pha 5: Upstream Contribution & Testing** | Viết trọn bộ Unit Tests & E2E Tests, cập nhật song ngữ `en-US`, `vi-VN`, `zh-CN`, chuẩn bị tài liệu RFC và tạo PR hoàn chỉnh lên `huabeitech/agent-desk`. | `internal/services/*_test.go`<br/>`web/messages/*.json` |

---

## 8. Kết luận

Mô hình **Omnichannel Conversational Support** kết hợp **Hạ tầng Email Domain đa khách thuê** là bước đi chuẩn hóa cao cấp nhất, đưa Crove Desk thoát khỏi tư duy Helpdesk thế hệ cũ để cạnh tranh sòng phẳng với các SaaS hàng đầu thế giới như Intercom và Crisp, đồng thời tối ưu hóa 100% năng lực tự động hóa của AI Agent.

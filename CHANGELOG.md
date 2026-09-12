# Changelog

All notable changes to the **Crove Desk** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Security

- **WhatsApp webhook signature verification now fails closed.** A delivery is
  rejected unless its `X-Hub-Signature-256` verifies against a configured Meta
  App Secret. Previously a missing secret, a missing header, or a header without
  the `sha256=` prefix all passed, so anyone who learned a webhook URL could write
  into a customer conversation, trigger AI replies and burn paid message quota.
  Rejections now return `401` without echoing the reason. **Breaking for
  deployments that never set `WHATSAPP_APP_SECRET` or a per-channel `appSecret`:
  the WhatsApp webhook stops accepting messages until one is configured.**
- **Each Meta product now resolves its own app credentials.** Messenger, Instagram
  and WhatsApp all read a single `META_APP_SECRET`, which cannot work for a
  deployment that registered a separate Meta app per product: one variable holds
  one secret, and a signature verified against the wrong app's secret always
  fails. Credentials now resolve channel-level first, then the product's own
  `FACEBOOK_APP_*` / `INSTAGRAM_APP_*` / `WHATSAPP_APP_*`, then the shared
  Messenger values, so a single-app deployment keeps working unchanged. The
  WhatsApp OAuth exchange previously sent the Messenger app id and secret for a
  code issued by the WhatsApp app, which Meta rejects outright.
- `ChannelGetWhatsAppOAuthURL`, `ChannelGetMessengerOAuthURL` and
  `ChannelGetInstagramOAuthURL` no longer fall back to a fabricated app id, which
  sent operators to a Meta error page that looked like an application bug, and now
  report which variable to set. The authorization URL includes
  `response_type=code`; without it Meta returns a token fragment the server never
  sees.
- The Channels dialog advertised `/api/third/whatsapp/webhook` as the webhook URL,
  but verification requires a bound channel id, so the documented URL always
  failed. It now shows the real per-channel URL with a copy action.

### Added

- WhatsApp inbound media is stored instead of dropped. Images, documents, audio,
  voice notes, videos and stickers are resolved through the Media API, downloaded
  server-side under a size cap, and uploaded as assets, so they render in the
  workbench and reach the AI agent. When a download or the upload policy rejects a
  file, the message degrades to text with the caption rather than disappearing.
- WhatsApp inbound location, shared contact cards, button and list replies, and
  emoji reactions now become readable messages. Unsupported types are recorded
  with their type name instead of being silently discarded.
- WhatsApp Embedded Signup / OAuth connect:
  `POST /api/dashboard/channel/whatsapp_oauth_callback` exchanges the
  authorization code for an access token, inspects it with `debug_token`,
  discovers the reachable WABAs and sender numbers, and saves the credentials onto
  the target channel while preserving its existing webhook verify token. The
  Channels dialog opens Meta in a popup and prefills the form from the result.
- The WhatsApp channel form gains Meta App ID and Meta App Secret fields. The
  backend already read a per-channel `appSecret` but no field existed to set one,
  so a channel belonging to a second Meta app could only be configured by editing
  the database.
- Focused tests for signature rejection, structured inbound types, media storage,
  media-failure fallback, the OAuth connect flow including discovery failure, and
  per-product Meta credential resolution.

### Changed

- Both READMEs are rewritten for Crove Desk: fork attribution and the upstream
  sync model, the 16 channel adapters, the public support portal, PostgreSQL
  support, the actual compose topology, and the real task list. Documentation
  links now point at `docs/` in this repository instead of the upstream site.
- In-app brand strings in `en-US` and `zh-CN` now read `Crove Desk`; `vi-VN`
  already did. The widget SDK's public `AgentDesk*` globals are unchanged, because
  renaming them would break every site that has already integrated it.
- `.env.example` groups the Meta variables per product — `FACEBOOK_APP_*`,
  `INSTAGRAM_APP_*`, `WHATSAPP_APP_*` — matching the naming already used by Crove
  Post, and keeps `META_APP_*` documented as a Messenger-only legacy alias. The
  three `WHATSAPP_*` names it listed before were never read by anything; they are
  real bindings now.
- The product backlog marks the WhatsApp integration as shipped, with the
  template-message and delivery-receipt gaps listed explicitly.

### Known issues

- An inbound WhatsApp document's caption is dropped when the sender also supplied
  a file name, because `normalizeMessageContent` replaces an attachment message's
  content with the stored asset name. Preserving both needs a change to that shared
  code path, which affects every channel.
- WhatsApp outbound still has no template message support, so business-initiated
  conversations outside the 24-hour customer service window are not possible, and
  the webhook `statuses` field is not consumed, so delivery and read receipts are
  not reflected.
- Messenger and Instagram webhook verification is still conditional: it only runs
  when an app secret is configured *and* a signature header arrived, and
  `verifyMessengerSignature` returns `true` for a header without the `sha256=`
  prefix. WhatsApp was closed in this release; the same fix for those two was
  deliberately held back because it would start rejecting live traffic on any
  deployment whose secret is not yet correct, and that needs to be sequenced
  against the credential split above.
- `pnpm lint` fails on pre-existing `react-hooks/set-state-in-effect` and
  ref-access errors across the dashboard. The WhatsApp files added here are
  lint-clean.

---

## [1.7.0-crove.1] - 2026-09-10

Release tags now follow the upstream `huabeitech/agent-desk` 1.x line instead of
this fork's earlier 0.x internal numbering, which is why this entry succeeds
`[0.3.0]` despite the jump. The `-crove.N` suffix is deliberate:
`.github/workflows/sync-upstream.yml` skips a sync entirely when this fork already
holds a tag of the same name, so an unqualified `v1.7.0` would silently break
future upstream syncs.

### Security

- **Unrestricted file upload to same-origin script execution is closed.** Uploads
  are validated against a browser-active extension and media-type block list, the
  payload is sniffed instead of trusting the client-declared `Content-Type`,
  client filenames are reduced to a safe basename within the 255-character column,
  and the stored extension comes from an explicit MIME table with an inert `.bin`
  fallback. Local assets are served with `X-Content-Type-Options: nosniff` and
  forced to download unless they are previewable media, which also neutralises
  document types already sitting in an existing storage root. Contributed upstream
  as [huabeitech/agent-desk#40](https://github.com/huabeitech/agent-desk/pull/40).
- **Privilege escalation closed** in password reset, role assignment and role
  permission assignment: `super_admin` targets and `IsSystem` roles can no longer
  be touched by an operator who is not themselves a super admin.
- **WebSocket authorization** now requires the same `conversation.view` permission
  the REST conversation endpoints gate with, closing a read bypass for full
  message content.
- **Webhook verification hardened** for Threads, Messenger, WhatsApp and
  Instagram: strict `hub.mode` handling, channel lookup before token comparison,
  and constant-time comparison.
- **Guest session credentials no longer reach the dashboard.** Guest external ids
  are masked in the customer identity response, keeping only enough to tell two
  identities apart. Real channel identifiers stay readable, because
  `externalUserFromClaims` only accepts `user` and `guest` sources and so they
  cannot be replayed through the guest session path.
- **Hardcoded API key fallback removed** from the AI agent loop live test, and the
  key itself was rotated at the provider.
- **Configuration precedence fixed**: `AGENT_DESK_*` aliases are bound first, so
  ambient legacy variables such as `PORT` and `DATABASE_URL` can no longer
  silently override documented configuration.

### Added

- Omnichannel adapters for Telegram, Zalo OA, Discord, Facebook Messenger,
  Instagram Direct, WhatsApp Business Cloud API, Slack, X, TikTok, LINE, Viber and
  Meta Threads, plus a native email channel with multi-provider outbound delivery
  and inbound parsing.
- Customer merge dialog and backend API for combining omnichannel profiles, with
  connected-channel badges on the customer list and detail views.
- Private internal notes on conversations, and a single-select assignee picker
  with quick take-it and unassign.
- Multi-tenant inbound forwarding addresses as `help@<slug>.crove.io`, with
  direct-domain and plus-addressing routing.
- Cloudflare Email Routing inbound forwarder worker template.

### Changed

- Upstream `huabeitech/agent-desk` fully merged; `upstream/main` is now an
  ancestor of `dev`.
- Dependencies upgraded across the Go modules and the web workspace, reducing
  Dependabot alerts on the default branch from 162 to 34. `pnpm.overrides` is
  declared in both `package.json` (pnpm 10, used by CI) and `pnpm-workspace.yaml`
  (pnpm 12), because pnpm 12 no longer reads the `pnpm` field in `package.json`.
- `mime.ExtensionsByType` is no longer used to derive stored file extensions. It
  consults the Windows registry, so the same MIME type resolved to a different
  extension on a development machine than in production.
- The private `docs` git submodule was removed and `docs/` is versioned directly.

### Fixed

- `pnpm install` no longer exits 1 with `ERR_PNPM_IGNORED_BUILDS`; the unfilled
  scaffold placeholders in `web/pnpm-workspace.yaml` are real booleans now.
- 282 localization strings restored per locale, and the duplicate `workflowRun`
  block removed from `en-US.json` and `zh-CN.json` that made `JSON.parse` discard
  21 keys. Five namespaces referenced by code were absent from the message files
  altogether, so call sites rendered raw keys — including the support config page
  heading, the entire AI Workflow Runs filter bar and its eight column headers,
  and a `window.confirm()` in the public comment list. English and Chinese strings
  were recovered verbatim from upstream commit `72039b90`; Vietnamese was newly
  authored.
- Outbox dispatch: `ListPending` now honours `next_retry_at` and orders by it, so
  a backlog of not-yet-due retries no longer starves newer sends, and X and TikTok
  were added to the cron drain.
- The Viber client checks the HTTP status before decoding a response body.
- SMTP dialing uses `net.JoinHostPort`, fixing IPv6 address formatting.
- Broken `var(--font-inter)` references replaced with the defined
  `--font-geist-sans`, and a stale `applyBranding` call removed from the i18n
  provider.
- Migration versions renumbered so this fork's "sync support and organization
  permissions" migration no longer collides with upstream's "repair bootstrap
  admin user type" at version 10.

### Known issues

- Admin password reset still returns the new plaintext password in the response
  body. That is an intentional feature with a dedicated dialog, so removing it
  requires a replacement flow first.
- Guest identity is still bearer-style: holding a guest external id is enough to
  exchange it for a session. Widget-generated ids are 122-bit random, but an
  integrating site that passes a predictable `externalId` takes that risk on
  itself.
- 135 pre-existing Vietnamese strings in the public support namespace are still
  English. They resolve, so no raw keys render, but Vietnamese visitors see
  English copy.
- `ci.yml` only triggers on `pull_request`, so a push straight to `dev` builds and
  ships the beta image without running any test.

`docs/CROVE_DESK_AUDIT.html` tracks all of the above by stable ID with evidence
and verification status.

---

## [0.3.0] - 2026-08-26

### Added
- **2-Tier Hybrid Architecture**: Implemented local database mirroring for `Company` and `Customer` entities alongside deep Agentic Tool Calling via MCP.
- **Bi-directional Webhook Synchronization**: Added support for event-driven synchronization (`company.created`, `company.updated`, `customer.created`, `customer.updated`, `organization.created`, `organization.member.added`) with HMAC-SHA256 signature verification.
- **Twenty CRM MCP Integration**: Added support for connecting Crove Desk AI Agent to Twenty CRM MCP server (`twenty_crm.get_subscription_status`, `twenty_crm.create_opportunity`, `twenty_crm.create_task`).
- **Vietnamese Language Support (`vi-VN`)**: Added complete Vietnamese localization files and implemented `LanguageToggle` component in navigation header and user menu.
- **AI Agent Loop Live Test Suite**: Added comprehensive live integration tests for Answerability Gate, Knowledge Base context grounding, and function calling tool loops.

### Changed
- **Typography & Font Resolution**: Replaced broken Geist/Times New Roman font fallback with Tailwind CSS v4 `@theme inline` mapping to Inter font with Latin and Vietnamese character subsets.
- **Sidebar Font Sizing**: Refined dashboard navigation sidebar font size to compact 13.5px / 13px for improved scannability and professional desktop density.
- **System Architecture Documentation**: Updated `docs/ARCHITECTURE.md` with 2-Tier Hybrid Architecture diagrams and webhook event specifications.

---

## [0.2.0] - 2026-08-25

### Added
- **OpenAI-Compatible AI Configuration**: Supported configuring LLM and Embedding models via `.env` environment variables (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_LLM_MODEL`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_EMBEDDING_DIMENSION`).
- **DOS.AI Provider Integration**: Configured live support for DOS.AI (`dos-ai` LLM model and `qwen3-embedding-4b` 2560-dim embedding model).
- **Automated AI Bootstrap & Sync**: Implemented `InitAI` startup hook to automatically seed and synchronize default AI model configurations into PostgreSQL.
- **Default Crove Desk Knowledge Base**: Added auto-seeding of official Crove Desk Knowledge Base and 7 core FAQ entries with background vector indexing in Qdrant.
- **Dynamic Company Branding**: Added `COMPANY_NAME` and `COMPANY_LOGO_URL` configuration exposed via `/api/config` and applied to Login, Workspace Switcher, Legal document pages, and Support Center header.
- **OAuth 2.1 with PKCE S256**: Implemented secure OIDC authorization code exchange with PKCE code challenge and verifier.
- **Password Login Toggle**: Added `PASSWORD_LOGIN_ENABLED` setting to enforce SSO-only login flows.

### Fixed
- Fixed Next.js static export SPA routing for `/dashboard/` trailing slashes.
- Fixed embedded locale file path resolution on Windows environments.

---

## [0.1.0] - 2026-08-22

### Added
- **Repository Initialization**: Forked from `huabeitech/agent-desk` to `DOS/Crove-Desk`.
- **PostgreSQL Database Support**: Added PostgreSQL driver (`gorm.io/driver/postgres`) and normalized GORM model schema types for cross-database compatibility (PostgreSQL, MySQL, SQLite).
- **Supabase Integration**: Connected to Supabase `dos.me` PostgreSQL database under schema `desk` with Session Pooler.
- **Multi-tenant Organization Architecture**: Added `Organization` and `OrganizationMember` models with JIT workspace provisioning upon OIDC login.
- **Production Deployment**: Configured `docker-compose.prod.yml`, Qdrant Vector DB, and Cloudflare Tunnel routing for `desk.crove.com` on GCP VM `crove-server`.

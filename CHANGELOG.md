# Changelog

All notable changes to the **Crove Desk** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

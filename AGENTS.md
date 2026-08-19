# AGENTS.md

This file defines the mandatory working agreement for AI agents in this repository. It is intentionally based on the current codebase rather than historical conventions.

## 1. Scope and Priorities

- These rules apply to the repository root and every subdirectory.
- Explicit user instructions take precedence over this file. Mention any deliberate deviation in the final summary.
- Inspect the relevant implementation before editing. Reuse current helpers, component APIs, generated-code workflows, and neighboring patterns instead of relying on memory.
- Keep changes narrowly scoped. Preserve unrelated and user-owned worktree changes, including staged changes.
- A review, investigation, or diagnosis request is read-only unless the user also asks for implementation.

## 2. Current Architecture

The repository contains three application areas:

- Go server: `cmd/server` and `internal/*`
- Next.js application: `web/*`
- Embedded workflow editor: `flowgram-editor/*`, built into `web/public/flowgram-editor`

The main stack is:

- Go 1.26, Gin, GORM, `github.com/mlogclub/simple`
- SQLite and MySQL
- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, shadcn/Base UI
- `pnpm` for both frontend projects
- Optional LanceDB builds through CGO; Qdrant is also supported by the application

Important entry points:

- Server assembly and middleware: `internal/bootstrap/server.go`
- Explicit API routes: `internal/bootstrap/routes.go`
- Model registration: `internal/models/models.go`
- Schema/data migration startup: `internal/bootstrap/migration.go`
- CRUD generator: `cmd/generator/generator.go`
- Frontend enum generator: `cmd/enums/generator.go`
- Frontend API client: `web/lib/api/client.ts`
- Frontend i18n: `web/i18n/*` and `web/messages/*`
- Dashboard shared components: `web/components/dashboard/*`
- Project commands: `Taskfile.yml`

## 3. General Change Rules

- Read the actual type, function, or component signature before using it.
- Prefer the highest-level existing abstraction that fits the requirement. Do not duplicate query state, pagination, auth refresh, localization, or dashboard CRUD behavior.
- Do not edit generated artifacts by hand. Change their source and run the corresponding generator/build command.
- Do not add a second implementation style when the repository already has a shared path for the same concern.
- Use `log/slog` for new Go logging and structured key-value fields for relevant context.
- New Go code uses `any`, not `interface{}`. Existing generated or legacy code does not need unrelated cleanup.
- Secrets, tokens, credentials, and private customer data must never be committed or printed in logs/tests.

## 4. Go Backend

### 4.1 Layer Ownership

The normal dependency and data flow is:

`models -> repositories -> services -> handlers -> builders/response DTOs`

- `internal/models`: entity fields, GORM mappings, associations, and schema metadata only.
- `internal/repositories`: GORM/SQL access, conditions, ordering, pagination, locks, and persistence details.
- `internal/services`: business validation, state changes, authorization-independent domain rules, aggregation, transactions, and event orchestration.
- `internal/handlers/{api,dashboard,third}`: HTTP parameter parsing, authentication/permission checks, service calls, and response writing.
- `internal/builders`: pure model/aggregate-to-response mapping. Builders must not query the database.
- `internal/pkg/dto/request` and `internal/pkg/dto/response`: external request/response contracts.

Mandatory boundaries:

- Handlers must not call repositories or issue GORM queries directly.
- Models and repositories must not contain HTTP, permission, or cross-resource workflow logic.
- GORM models must not be returned directly from an API. Map them to response DTOs/builders.
- A service may return models internally, but public response shape remains owned by builders/DTOs.
- Put reusable SQL in repositories. A genuinely one-off aggregate query may stay near its domain service only when extraction would make ownership less clear.

### 4.2 Database and Transactions

- Repository methods that participate in transactions accept `db *gorm.DB`; call them with `sqls.DB()` outside a transaction and `ctx.Tx` inside one.
- Services own transaction boundaries through `sqls.WithTransaction`.
- Use a transaction for atomic multi-write workflows and consistency-sensitive read-modify-write operations.
- Do not add a transaction around a single independent SQL write.
- Every database operation inside a transaction must use the same `ctx.Tx`; never escape to `sqls.DB()` mid-transaction.
- Use `sqls.Cnd`/`sqls.NewCnd()` and repository methods for ordinary filtering and pagination.
- Preserve SQLite and MySQL compatibility. Avoid dialect-specific SQL unless both dialects are explicitly implemented and tested.
- Use portable column types and `int64` primary/foreign identifiers. Keep time handling compatible with MySQL `parseTime=True`.

### 4.3 Models, Generation, and Migrations

- Register persistent models in `internal/models/models.go` so startup `AutoMigrate(models.Models...)` includes them.
- New tables, columns, indexes, and compatible constraints are normally applied by GORM `AutoMigrate` in `internal/bootstrap/migration.go`.
- Use `internal/migration/*` only for versioned, idempotent data migration/backfill/repair work. Its version must increase monotonically.
- When a model uses the standard generated repository/service surface, register it in `cmd/generator/generator.go` and run `task generator`.
- Treat generator output as mechanical infrastructure. Put business-specific methods in handwritten files and do not manually patch generated CRUD output.
- Backend/frontend shared enums are defined in `internal/pkg/enums`, annotated using the existing enum pattern, and generated with `task enums` into `web/lib/generated/enums.ts`.
- Never create a handwritten frontend duplicate of a generated backend enum.

### 4.4 HTTP APIs

- All routes are explicit in `internal/bootstrap/routes.go`; handler names do not create endpoints.
- Public/product APIs live under `/api/*`, authenticated management APIs under `/api/dashboard/*`, callbacks under `/api/third/*`, and WebSockets under `/api/ws/*`.
- Add a resource-specific `register...Routes` function or extend the existing one, then mount it from `addRouter` under the correct group.
- Follow the existing resource contract: detail commonly uses `GET /:id`, list uses `/list`, writes use explicit POST actions such as `/create`, `/update`, `/delete`, and domain actions retain their established snake_case path names.
- Do not introduce `/api/v1`, automatic routing assumptions, or unnecessary deeply nested resource paths.
- Handler names mirror the registered method and path, for example `XxxGetBy`, `XxxAnyList`, and `XxxPostCreate`.
- Parse JSON/form/query/path values with `internal/pkg/httpx/params` and `internal/pkg/httpx` helpers.
- Dashboard permission checks use `services.AuthService.RequirePermission` or the established permission helper before domain work.
- Write responses through `httpx.WriteJSON`; preserve the shared `JsonResult` contract.
- Paginated responses use `web.PageResult` with `data.results` and `data.page`.
- Convert not-found, validation, permission, and persistence failures into stable application errors. Never expose raw SQL errors to clients.

### 4.5 Backend Internationalization

- Any new or changed user-visible backend error must support every backend locale, currently `zh-CN` and `en-US`.
- Add matching keys to both `internal/pkg/i18nx/locales/zh-CN.yml` and `internal/pkg/i18nx/locales/en-US.yml` in the same change.
- Services should return localized application errors through the `errorsx.*I18n` helpers.
- Handlers that need an immediate localized response use `httpx.JsonErrorMsg(ctx, key, args...)`; other request-context translation uses `i18nx.T`.
- Do not hard-code Chinese or English error sentences in handlers/services when the text can reach a user.
- Keep format arguments equivalent across locales and cover new reusable/error-format behavior with focused tests.

## 5. Frontend

### 5.1 Component and Data Boundaries

- Application routes live under `web/app`; reusable business components live under `web/components`; route-private components live in the route's `_components` directory.
- Reuse `web/components/ui/*` primitives. Do not edit these shadcn base components for a feature-specific requirement.
- Use the current Base UI/shadcn component API as implemented in the repository; do not assume APIs such as Radix `asChild` exist.
- Use `@/*` imports for code within `web`.
- Client components must declare `"use client"` when they use state, effects, browser APIs, or client-only hooks.
- Keep resource APIs in `web/lib/api/*` and route all normal requests through `web/lib/api/client.ts`.
- Pages, business components, and stores must not implement their own `JsonResult` parsing, auth header handling, token refresh, or login-expiry cleanup.
- Direct `fetch` is reserved for unsupported transports such as third-party calls, binary transfers, SSE, and WebSocket handshakes; explain the exception in code.
- Prefer `OptionCombobox` for standard dropdowns rather than adding shadcn Select-based business controls.
- Format displayed timestamps with `formatDateTime` from `web/lib/utils.ts` unless the product explicitly requires a different representation.

### 5.2 Dashboard Pages

Before building a dashboard page, inspect `web/components/dashboard/crud`, `web/components/dashboard/list`, and `web/components/dashboard-page.tsx`.

Use this order of preference:

1. `DashboardCrudPage` for standard create/read/update/delete resources.
2. `DashboardListPage` for read-only or custom-content paginated resources.
3. `useDashboardPagedList` when layout is bespoke but list query/filter/pagination lifecycle is standard.
4. `DashboardPage`, `DashboardToolbar`, `DashboardTableShell`, and related low-level primitives only for interactions that cannot fit the higher-level components.

Rules:

- Do not copy a resource page to recreate standard filters, query/reset/refresh actions, pagination, loading/empty states, confirmations, row actions, or dialogs.
- Configure `DashboardCrudPage` through its filters, columns, labels, service callbacks, row actions, sorting, and form/dialog extension points before adding page-local infrastructure.
- Use its schema-driven `DashboardCrudFormDialog` when supported. A genuinely custom form may live in `_components` and should normally use `react-hook-form`, `zod`, and `Field`.
- Configure `DashboardListPage` with columns or `renderContent`, and use `renderToolbarActions` for resource-specific actions.
- Business API knowledge stays in the page/service module; generic dashboard components must not import a resource-specific API.
- A change to `web/components/dashboard/*` must be generic, backward-compatible, and useful beyond one page. Otherwise keep it local to the feature.

### 5.3 Frontend Internationalization

- Every frontend feature and modification must work in all `SUPPORTED_LOCALES`, currently `zh-CN` and `en-US`.
- Add every new key to both `web/messages/zh-CN.json` and `web/messages/en-US.json` in the same change, preserving matching structure.
- React pages/components use `useI18n()`; locale-aware formatting/mapping may also use `useAppLocale()`.
- Non-React code uses `translateCurrentMessage()` or `translateMessage()` from `web/i18n/messages.ts`.
- Do not hard-code user-visible copy in JSX/TSX, toast messages, dialogs, confirmations, placeholders, validation, empty/loading/error states, tooltips, accessibility labels, or client-side fallback errors.
- Product names, protocol literals, user content, and raw business data do not need translation unless the UI already provides a display-name mapping.
- Dashboard labels supplied to shared CRUD/list components must come from translation keys.
- Centralize localized display names for backend identifiers/enums in a reusable `web/lib/*-i18n.ts` helper instead of duplicating locale switches across pages.
- Preserve the same placeholders in every locale and interpolate with `t(key, values)`; do not assemble sentences by concatenating translated fragments.
- Locale configuration belongs to `AppI18nProvider` and `web/i18n/config.ts`; features must not introduce separate locale detection or state.

### 5.4 Generated and Embedded Frontend Assets

- `web/lib/generated/enums.ts` is generated by `task enums`; do not edit it manually.
- `web/public/sdk/agent-desk-sdk.min.js` is generated from the SDK source. When SDK source changes, run `cd web && pnpm build:sdk` and its focused SDK tests.
- `web/public/flowgram-editor` is produced from `flowgram-editor`; edit the source project, not the generated public output.
- When changing `flowgram-editor`, use its own `pnpm` scripts and ensure the embedding build still succeeds.
- The Next.js application is statically exported/embedded into the Go binary. Avoid runtime-only Next.js features that conflict with the current export and embedding model.

## 6. Testing and Validation

Validation must match the changed surface. Do not claim checks that were not run.

- Go formatting: run `gofmt` on every changed `.go` file.
- Go behavior: add focused tests for changed business rules, transactions, security boundaries, parsing, and reusable helpers; run the narrow package tests first, then `go test ./...` when practical.
- Frontend TypeScript: run `cd web && pnpm typecheck` for frontend changes.
- Frontend lint: run `cd web && pnpm lint` for broader component/page changes or when lint-sensitive code changed.
- Frontend logic: run relevant `node --test ...` files when changing utilities, i18n mappings, generated SDK behavior, or other modules with focused tests.
- Workflow editor: run the relevant `flowgram-editor` lint/build commands for changes in that project.
- Generation: after model CRUD or shared enum changes, run the corresponding `task generator` or `task enums` and review generated diffs.
- Build: use `task build` when changes affect frontend embedding, build configuration, generated public assets, or release assembly.
- Browser verification is expected for meaningful visual or interaction changes when a runnable environment is available; state explicitly when it was not performed.
- Documentation-only changes require at least `git diff --check` and verification that every referenced path/command exists.

## 7. Completion Checklist

Before handing off a change, confirm the applicable items:

- The implementation follows current layer/component ownership and does not create reverse dependencies.
- Transactions cover exactly the operations that must be atomic, and all transactional DB calls use the same `ctx.Tx`.
- API routes are explicitly registered and responses preserve `JsonResult`/`PageResult` contracts.
- Models, migrations, queries, and tests remain compatible with SQLite and MySQL.
- Backend and frontend user-visible text is complete in both Chinese and English.
- Dashboard pages reuse the highest-level suitable component under `web/components/dashboard/*`.
- Generated files were regenerated from their source and were not manually edited.
- Relevant tests/typechecks/lint/build/browser checks were run, and any validation limitation is reported.
- `git diff --check` passes and unrelated worktree changes remain untouched.

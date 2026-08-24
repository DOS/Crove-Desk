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

### 5.4 Commercial-Grade UI and Interaction

This is a commercial product, not a prototype or component demo. UI work is complete only when it is visually coherent, interaction-complete, responsive, localized, and credible with real production data.

#### Visual Quality

- Follow the existing design language, spacing scale, typography, radius, color tokens, and component variants. A new feature must look native to the product rather than like a pasted template.
- In support platform UI, if rounded corners are needed, use `rounded-md` consistently.
- Support platform components should not add `shadow`.
- Establish a clear hierarchy: page title/primary action, filters or context, main content, and secondary information. Do not make every region a card or every action visually prominent.
- Prefer restrained, purposeful styling. Avoid decorative gradients, oversized hero text, excessive shadows, glass effects, emoji icons, random accent colors, and ornamental copy unless the product context explicitly calls for them.
- Use Lucide icons consistently. Choose icons by meaning, keep icon size and stroke weight aligned with neighboring controls, and never use icons as decoration without communicative value.
- Keep spacing and alignment deliberate at every breakpoint. Labels, inputs, table columns, action groups, dialog footers, and empty states must align cleanly without ad hoc offsets.
- Design for realistic content, not ideal sample text. Verify long names, multiline content, large counts, missing optional fields, and mixed Chinese/English values. Use wrapping, truncation, tooltips, or scroll containers intentionally.
- Preserve information density appropriate to an operations dashboard. Do not waste large areas on decoration, but do not compress controls until scanning and clicking become difficult.

#### Interaction Completeness

- Every asynchronous action must have an immediate and unambiguous state: pending/loading, success, failure, and retry or recovery when appropriate.
- Prevent duplicate submissions. Disable or lock the initiating control while a mutation is pending and show action-specific progress text or a spinner without causing layout shift.
- Keep feedback close to the action. Use inline validation for field problems, contextual error states for failed content, and toast notifications for completed background or page-level actions.
- Never silently discard user input. Warn before closing, navigating away, resetting, or switching context when there are meaningful unsaved changes.
- Destructive, irreversible, security-sensitive, or broad-impact operations require confirmation that clearly names the object and consequence. Do not use a generic “Are you sure?” message.
- Confirmation is not a substitute for good defaults: routine reversible actions should remain efficient and should not be interrupted by unnecessary modal prompts.
- After create/update/delete operations, keep list state coherent: refresh affected data, preserve useful filters/page position when possible, close dialogs only on success, and prevent stale selections or detail panels.
- Buttons and menu items must use precise verbs describing the result. Avoid vague labels such as “OK”, “Submit”, or “Process” when a specific action name is available.
- Preserve keyboard behavior and focus flow: Enter submits only where expected, Escape closes dismissible overlays, focus moves into dialogs and returns to the trigger, and destructive actions are not the accidental default.
- Interactive rows, icons, badges, and text links must look interactive only when they are interactive. Do not rely on hover-only discoverability for essential actions.

#### Forms and Dialogs

- Use the smallest suitable interaction container: inline editing for simple local changes, a dialog for focused tasks, and a full page/workbench for complex or multi-step workflows.
- Dialogs need a clear title, concise context when necessary, stable body layout, and a consistent footer with secondary action before primary action. Long content must scroll inside the dialog without pushing actions off-screen.
- Forms must have visible labels, appropriate controls, useful defaults, required/optional semantics, and examples or help text only where they reduce ambiguity.
- Validate at the right time: do not show errors before the user has interacted, clear stale errors after correction, and map backend validation failures to the relevant field when possible.
- Preserve entered values after failed submission. Do not reset or close a form until the server confirms success.
- Dependent fields must clearly reflect disabled/loading/empty states. When one field invalidates another, update it predictably and explain the dependency when it is not obvious.
- Configuration and high-impact forms should not expose a permanently editable surface when a deliberate edit mode improves safety. Saving sensitive configuration requires explicit user intent and appropriate confirmation.

#### Lists, Tables, and Operational Screens

- Use the shared Dashboard CRUD/list system and maintain consistent toolbar, filter, pagination, loading, empty, and action placement across resources.
- Filters must distinguish draft values from applied query state. Query, reset, refresh, pagination, and URL/state behavior should be predictable and must not unexpectedly erase one another.
- Tables must remain scannable: align comparable values, keep action columns stable, use badges sparingly for status, avoid dense multiline cells when a detail view is more appropriate, and provide horizontal overflow on narrow screens.
- Empty states must distinguish “no data exists” from “no results match the current filters” and offer the most relevant next action when the user can resolve the state.
- Loading states should preserve layout. Prefer skeletons for content whose shape is known and compact spinners for localized actions; avoid replacing an entire stable page with a centered spinner.
- Error states must explain what failed in user terms and provide retry when retry is meaningful. Never leave a blank table or empty panel after a request failure.
- Bulk actions must show selection count, affected scope, eligibility, and partial-failure results. Clear selection when it is no longer valid.

#### Responsive and Accessibility Requirements

- Every changed screen must work at desktop and narrow/mobile widths. Do not treat horizontal clipping, overlapping controls, wrapped action chaos, or off-screen dialog buttons as acceptable.
- Responsive behavior must preserve task priority: primary actions remain reachable, secondary actions may move into menus, filters may stack or collapse, and tables may scroll without hiding row identity/actions.
- Use semantic controls and accessible names. Icon-only buttons require localized accessible labels and tooltips where the meaning is not universally obvious.
- Maintain visible focus states, logical tab order, sufficient target sizes, and adequate text/background contrast. Do not encode status or errors using color alone.
- Respect reduced-motion preferences. Animations should explain state or continuity, remain subtle, and never delay work.

#### Product Copy and Data Credibility

- Copy must sound like a finished product: concise, specific, consistent, and action-oriented. Do not expose implementation jargon, placeholder prose, “TODO”, mock labels, debug wording, or developer instructions to users.
- Do not ship fake statistics, sample records, disabled-looking placeholder buttons, decorative charts without meaning, or interactions that only log to the console.
- Distinguish unavailable features from empty data. If a capability is not implemented, do not render a control that pretends it is functional.
- User-visible names, statuses, permissions, dates, and errors must use the established formatting and i18n mappings rather than raw backend identifiers.

#### UI Verification

- For meaningful UI changes, inspect the finished screen in a real browser at representative desktop and narrow widths. Source review and typecheck alone are not sufficient visual validation.
- Exercise the complete interaction, including initial load, populated state, empty/filtered state, validation failure, server failure when practical, pending/disabled behavior, success, cancel/close, and refresh.
- Check both `zh-CN` and `en-US`; verify that translated copy does not overflow, truncate critical meaning, or break control alignment.
- Before handoff, remove temporary data, debug UI, console output, test-only shortcuts, and visual artifacts introduced during verification.
- When browser verification cannot be performed, state that limitation explicitly; do not describe the UI as visually verified.

### 5.5 Generated and Embedded Frontend Assets

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
- UI changes meet the commercial-grade standard: complete states, precise feedback, safe mutations, responsive layout, accessible controls, credible copy/data, and no demo-only behavior.
- Generated files were regenerated from their source and were not manually edited.
- Relevant tests/typechecks/lint/build/browser checks were run, and any validation limitation is reported.
- `git diff --check` passes and unrelated worktree changes remain untouched.

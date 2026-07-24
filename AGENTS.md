# AGENTS.md

This file defines mandatory development rules for AI Agents in this project. Unless the user explicitly requests a deviation, these rules must be followed.

## 1. Basic Principles

- Scope: the repository root and all subdirectories
- Priority: explicit user instructions > this file > default implementation habits
- If these rules conflict with the user's request: follow the user's request first, and note the deviation in the change summary

## 2. Fixed Technology Stack

- Backend: `Golang` + `Gin` + `GORM` + `github.com/mlogclub/simple`
- Database: must be compatible with both `SQLite` and `MySQL`
- Frontend: `Next.js(App Router)` + `React` + `shadcn/ui` + `Tailwind CSS`
- Frontend package manager: `pnpm`

## 3. Directory Conventions

```text
.
├── cmd/
│   ├── server/
│   ├── migration/
│   └── generator/
├── internal/
│   ├── bootstrap/
│   ├── builders/
│   ├── handlers/
│   │   ├── api/
│   │   ├── dashboard/
│   │   └── third/
│   ├── middleware/
│   ├── migration/
│   ├── models/
│   ├── repositories/
│   ├── services/
│   └── pkg/
│       ├── config/
│       ├── dto/
│       ├── enums/
│       ├── errorsx/
│       ├── httpx/
│       ├── logx/
│       └── utils/
├── web/
└── docs/
```

## 4. Backend Layering

The backend must follow one-way dependencies: `models -> repositories -> services -> handlers`

- `models`: only define entities and table mappings
- `repositories`: only encapsulate data access
- `services`: handle business rules, transaction orchestration, and aggregation logic
- `handlers`: only parse parameters, check permissions, call services, and wrap responses

Forbidden:

- Handlers directly calling repositories
- Returning GORM models directly to the frontend
- Writing business orchestration in models or repositories

## 4.1 Full Layer Flow (`models -> repositories -> services -> handlers -> builders`)

This section is an executable refinement of the layering rules: each layer must do only what belongs to that layer. Data should flow around DTOs, GORM details should be concentrated in repositories, transaction boundaries should be concentrated in services, and response assembly should be concentrated in builders/handlers.

### 4.1.1 Dependency Direction (Required)

Only the following one-way dependencies are allowed:

- `models` -> must not depend on any business layer
- `repositories` -> may depend on `models` and base libraries (`gorm`/`simple/sqls`)
- `services` -> may depend on `repositories`, `models`, and `enums/errorsx/utils`; responsible for transactions and business orchestration
- `builders` -> may depend on `models` and `dto/response`; if necessary, may depend on a small number of `services` to supplement display fields, but aggregation in the service layer is preferred
- `handlers` -> may depend on `services`, `builders`, `pkg/dto/request`, `pkg/httpx/params`, and `pkg/httpx` response wrappers

Reverse dependencies are forbidden:

- `repositories` must not depend on `services/handlers/builders`
- `models` must not depend on `repositories/services/handlers/builders`
- `handlers` must not depend on `repositories` (they must go through services)

### 4.1.2 Data Shape and Flow (Recommended Standard)

A typical CRUD/business action data flow:

1. The **handler** reads parameters (`query/body/form/path`), performs permission checks, and calls the **service**
2. The **service** executes business rules (validation, idempotency, state machines, aggregation), starts a transaction when needed, and calls the **repository**
3. The **repository** only performs data reads/writes (`CRUD + queries`) and returns `models` or necessary aggregate structures
4. **builders** map `models`/aggregate results into `response DTO`
5. The **handler** returns `httpx.WriteJSON(...)`

Strong constraints:

- **Handler inputs use request DTOs**
- **Handler outputs use response DTOs**
- **Models must not be returned directly to the frontend**

### 4.1.3 Per-Layer Allow/Forbid Checklist

#### models (Entity Layer)

- **Allowed**
  - Field definitions, table names, index/constraint tags, associations (GORM tags)
  - Lightweight constants/enum field types (prefer `internal/pkg/enums`)
- **Forbidden**
  - Business methods (for example, rule checks such as `CanDispatch()` belong in services)
  - DB access, transactions, complex calculations

#### repositories (Data Access Layer)

- **Allowed**
  - CRUD: `Get/Take/Find/FindOne/FindPageBy.../Create/Update/Updates/UpdateColumn/Delete`
  - Reusable query-related methods: `FindByUserID`, `CountByStatus`, `FindActiveBy...`
  - Anything that is a data-access detail belongs here (SQL conditions, sorting, pagination, locks)
- **Forbidden**
  - Business orchestration (cross-table workflows, state transitions, event publishing, etc.)
  - Permission checks or login-state checks
  - Directly assembling response DTOs (DTO mapping belongs in builders/handlers)

Repository best practices:

- **Prefer unified primary-key read/write methods**: `Get/Updates/Delete`, avoiding repeated `id = ?` logic in services
- **Prefer query conditions through `sqls.Cnd` / `sqls.NewCnd()`**
- **Repository method signatures should consistently accept `db *gorm.DB`** (supporting both `sqls.DB()` and `ctx.Tx`)

#### services (Business Layer)

- **Allowed**
  - Business rules: parameter normalization, cross-entity validation, state machines, idempotency, concurrency semantics
  - Aggregation: combining results from multiple repositories when needed
  - Transaction orchestration: `sqls.WithTransaction(func(ctx *sqls.TxContext) error { ... })`
  - Domain-object preparation before calling builders (when builders stay cleaner as pure mappers)
- **Forbidden**
  - Handler responsibilities: parameter parsing, HTTP details, response wrapping
  - Repository responsibilities: scattered GORM queries (unless it is a one-off complex SQL query that is not worth extracting)

Service best practices:

- **Open transactions only where atomicity is required**, and ensure every DB operation inside the transaction uses `ctx.Tx`
- **Call repositories from services**; do not mix repository usage with direct GORM calls in a way that splits style and ownership

#### builders (Output Construction Layer)

Purpose: convert `models` (or service aggregate results) into `response DTO`, avoiding repetitive mapping boilerplate in handlers.

- **Allowed**
  - Pure `Model -> ResponseDTO` mapping
  - Time formatting and enum label filling when needed
  - Batch builders: `BuildXxxList([]models.Xxx) []response.Xxx`
- **Forbidden**
  - DB access (builders should not query the database)
  - Permission checks, transactions, complex business processes

Recommended builder form:

- Location: `internal/builders/*_builder.go`
- Methods: `BuildXxx(item *models.Xxx) *response.Xxx` / `BuildXxxList(list []models.Xxx) []response.Xxx`

#### handlers (API Layer)

- **Allowed**
  - Parameter parsing: `params.ReadJSON/ReadForm/NewPagedSqlCnd/GetInt64...`
  - Permissions: `AuthService.GetAuthPrincipal/RequirePermission/HasPermission`
  - Calling services, calling builders, and wrapping with `httpx.WriteJSON`
- **Forbidden**
  - Direct repository calls
  - Directly returning models
  - Writing business orchestration inside handlers (for example, "write A, then write B")

### 4.1.4 Transaction Best Practices

Transaction boundaries should be decided by the service layer. Principles:

- **A transaction is required** (`sqls.WithTransaction`) for:
  - Multiple write SQL statements (for example, updating the main table and writing a log/event/relation table)
  - Read-modify-write flows that require consistency (must not break under concurrency)
  - Writes across multiple repositories that must be atomic
- **A transaction is not required** for:
  - A single write SQL statement (one `Create/Updates/UpdateColumn/Delete`)
  - A single write SQL statement plus pure calculation/parameter cleanup

Rules inside a transaction:

- Inside a transaction, all DB calls must use `ctx.Tx` (pass `ctx.Tx` as the repository method's `db` argument)
- Do not mix in `sqls.DB()` inside a transaction (it escapes the transaction)

### 4.1.5 Standard Endpoint Skeleton (Example)

```go
// Handler: parameters/permissions/response
func XxxUpdate(ctx *gin.Context) {
  operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionXxxUpdate)
  if err != nil {
    httpx.WriteJSON(ctx, err)
    return
  }
  req := request.UpdateXxxRequest{}
  if err := params.ReadJSON(ctx, &req); err != nil {
    httpx.WriteJSON(ctx, err)
    return
  }
  if err := services.XxxService.UpdateXxx(req, operator); err != nil {
    httpx.WriteJSON(ctx, err)
    return
  }
  httpx.WriteJSON(ctx, nil)
}
```

```go
// Service: business rules + transaction orchestration + repository calls
func (s *xxxService) UpdateXxx(req request.UpdateXxxRequest, operator *dto.AuthPrincipal) error {
  current := repositories.XxxRepository.Get(sqls.DB(), req.ID)
  if current == nil {
    return errorsx.InvalidParam("object does not exist")
  }
  // Single write SQL statement: no transaction required
  return repositories.XxxRepository.Updates(sqls.DB(), req.ID, map[string]any{
    "name": strings.TrimSpace(req.Name),
    "update_user_id": operator.UserID,
    "update_user_name": operator.Username,
    "updated_at": time.Now(),
  })
}
```

```go
// Builder: Model -> ResponseDTO
func BuildXxx(item *models.Xxx) *response.Xxx {
  if item == nil {
    return nil
  }
  return &response.Xxx{
    id: item.ID,
    // ...
  }
}
```

## 5. `simple` Usage Conventions

- Prefer `sqls.Cnd` for query conditions
- Prefer `internal/pkg/httpx/params` for parameter binding
- Use `internal/pkg/httpx.WriteJSON` for all HTTP responses
- Write transaction boundaries must follow **4.1.4 Transaction Best Practices** (avoid slogan-style rules such as "always open a transaction even for a single write SQL statement")

## 6. Database Compatibility Rules

- Use compatible field types: `varchar`, `text`, `int`, `bigint`, `datetime`
- Primary keys must consistently use `int64`
- Avoid database-private syntax and dialect-specific features
- Keep time storage and parsing strategies consistent; MySQL must use `parseTime=True`

## 7. Code Generation and Migration

### 7.1 Code Generation

- Entry point: `cmd/generator/generator.go`
- Command: `task generator`
- Generation library: `github.com/mlogclub/codegen`
- Registration method: `codegen.GetGenerateStruct(&models.XXX{})`
- Generated files should be placed in the `generated` directory and named `*_gen.go`
- Generated code is only responsible for basic CRUD; business logic must be written manually in services/handlers

Standard process:

1. Define or modify the model
2. Register it in the generator
3. Run `task generator`
4. Add business logic in the handwritten layers
5. Run tests and self-checks

### 7.2 Migration

- DDL changes do not go through `internal/migration/runner.go` by default
- New tables, table changes, and index changes are handled uniformly through `sqls.DB().AutoMigrate(models.Models...)`
- `internal/migration/runner.go` is only for DML: initial data, backfills, repairs, remapping, etc.
- Migrations must be idempotent, and `version` must increase monotonically
- Execution order: run `AutoMigrate` first, then `migration.Migrate(...)`

## 8. API Conventions

### 8.1 DTOs and Responses

- Separate DTOs: define `request` and `response` separately
- JSON fields must consistently use `camelCase`
- Do not leak underlying SQL errors directly
- Error code ranges:
  - `1000-1999` parameter errors
  - `2000-2999` business errors
  - `3000-3999` authentication/authorization errors
  - `5000-5999` system errors

### 8.2 Path Layers

- `/api/dashboard/*`: business dashboard APIs
- `/api/third/*`: third-party platform callback/call APIs
- `/api/*`: open APIs

Do not add version prefixes such as `/api/v1`.

### 8.3 Dashboard API Style

- Prefer flat resource paths, such as `/api/dashboard/project`
- Prefer `/list`, `/create`, `/update`, and `/delete` for list/create/update/delete
- Prefer passing query conditions through `query` or `body`
- Avoid path params except for detail endpoints
- Detail endpoints may use `GET /api/dashboard/project/{id}`
- Prefer filtering subordinate resources through ordinary parameters such as `projectId` and `episodeId`; deep nested routes are discouraged

### 8.4 Route Registration

- The Gin engine is created uniformly in `internal/bootstrap/server.go`, and middleware is also registered there in order
- Routes should be split into grouping functions in `internal/bootstrap/routes.go` and `internal/bootstrap/*_routes.go`
- Business dashboard routes are registered through `dashboardGroup := app.Group("/api/dashboard", middleware.AuthMiddleware)`
- Open APIs should be organized under `/api/*` groups by domain, and third-party callbacks under `/api/third/*`
- Inside groups, mount handlers explicitly through `group.GET/POST/PUT/DELETE/Any(...)`
- Do not create a separate top-level `app.Group("/api/dashboard/xxx")` for each resource
- Authentication and authorization middleware should preferably be mounted at the `/api/dashboard` or `/api/admin` layer

### 8.5 Gin Explicit Route Rules

This project uses explicit Gin routes and does not use framework automatic routing. Handler method names are only for code organization; final URLs are determined by the paths registered in `internal/bootstrap/*_routes.go`.

- Route mounting example:

```go
func registerDashboardQuickReplyRoutes(group *gin.RouterGroup) {
  group.GET("/:id", dashboard.QuickReplyGetBy)
  group.Any("/list", dashboard.QuickReplyList)
  group.POST("/create", dashboard.QuickReplyPostCreate)
  group.POST("/update", dashboard.QuickReplyPostUpdate)
  group.POST("/delete", dashboard.QuickReplyPostDelete)
}
```

- With the registration above, the resource base path is determined by the outer `dashboardGroup.Group("/quick-reply")`; the final full paths are `/api/dashboard/quick-reply/list`, `/api/dashboard/quick-reply/{id}`, etc.
- Handler names should keep the existing readable prefixes: `XxxList`, `XxxGetBy`, `XxxPostCreate`, `XxxPostUpdate`, `XxxPostDelete`
- Handler names do not create routes; before adding an endpoint, the corresponding `register...Routes` function must be modified
- The HTTP method must be determined by the Gin registration method:
  - List queries: prefer `group.Any("/list", XxxList)`, used by the frontend as `GET /list`
  - Detail queries: prefer `group.GET("/:id", XxxGetBy)`
  - Write APIs: consistently use `group.POST("/create|/update|/delete", XxxPost...)`
  - Business actions: use explicit paths, such as `group.POST("/send_message", ConversationPostSend_message)`
- Path params should be used only for detail endpoints or strong path-semantics scenarios; ordinary filters should continue using query/body

Common correct mappings in the current project:

- `registerDashboardUserRoutes(dashboardGroup.Group("/user"))`
  - `group.GET("/:id", dashboard.UserGetBy)` -> `GET /api/dashboard/user/{id}`
  - `group.Any("/list", dashboard.UserList)` -> `ANY /api/dashboard/user/list`
  - `group.POST("/create", dashboard.UserPostCreate)` -> `POST /api/dashboard/user/create`
  - `group.POST("/update", dashboard.UserPostUpdate)` -> `POST /api/dashboard/user/update`
  - `group.POST("/delete", dashboard.UserPostDelete)` -> `POST /api/dashboard/user/delete`
- `registerDashboardConversationRoutes(dashboardGroup.Group("/conversation"))`
  - `group.GET("/:id", dashboard.ConversationGetBy)` -> `GET /api/dashboard/conversation/{id}`
  - `group.Any("/list", dashboard.ConversationList)` -> `ANY /api/dashboard/conversation/list`
  - `group.Any("/message/list", dashboard.ConversationMessage_list)` -> `ANY /api/dashboard/conversation/message/list`
  - `group.POST("/send_message", dashboard.ConversationPostSend_message)` -> `POST /api/dashboard/conversation/send_message`

Easy mistakes:

- Do not assume adding an `XxxList` method automatically creates a `/list` route; it must be explicitly registered in the routes file
- Do not register detail endpoints as `/detail`; the current convention is `GET /:id`
- Do not casually add deeply nested routes; subordinate resources should preferably be filtered by ordinary parameters such as `projectId` and `conversationId`
- If an API contract requires an underscore path, write the underscore path directly in the Gin route, for example `group.POST("/send_message", ...)`
- Before adding a handler method, first write the corresponding Gin route registration and confirm that the final URL matches the frontend contract

### 8.6 Handler Conventions

- One handler file per resource, located at `internal/handlers/{api|dashboard|third}/*_handler.go`
- Handler functions should use the uniform form: `func XxxPostCreate(ctx *gin.Context)`
- Recommended method names:
  - `XxxList(ctx *gin.Context)`
  - `XxxGetBy(ctx *gin.Context)`
  - `XxxPostCreate(ctx *gin.Context)`
  - `XxxPostUpdate(ctx *gin.Context)`
  - `XxxPostDelete(ctx *gin.Context)`
  - Business actions may extend this pattern with names such as `XxxPostTest(ctx *gin.Context)` or `XxxPostGenerate(ctx *gin.Context)`

- Requirements for paginated `List` endpoints:
  - Use `params.NewPagedSqlCnd(...)`
  - Declare each filter field explicitly through `params.QueryFilter`
  - Prefer default sorting with `.Desc("id")`; special sorting requires an explicit reason
  - Prefer `FindPageByCnd(...)` in the service layer
  - Perform DTO mapping in the handler layer; do not return model lists directly

- Paginated responses must use:

```go
httpx.WriteJSON(ctx, &web.PageResult{Results: results, Page: paging})
```

- Paginated `data` structure must be:
  - `data.results`
  - `data.page.page`
  - `data.page.limit`
  - `data.page.total`

- Detail endpoints should preferably return `httpx.WriteJSON(ctx, dto)`
- Delete endpoints should preferably return `httpx.WriteJSON(ctx, nil)`
- JSON bodies should preferably be read with `params.ReadJSON`
- Form parameters should preferably be read with `params.ReadForm`
- Single parameters may be retrieved with `params.GetInt64`, `params.GetInt64Arr`, `params.Get`, etc.
- Pagination and query parameters should preferably use `params.NewPagedSqlCnd`
- Authenticated users should be retrieved through `services.AuthService.GetAuthPrincipal(ctx)` or `RequirePermission(ctx, ...)`
- Permission checks should consistently use `services.AuthService.HasPermission(...)` or `RequirePermission(...)`
- Authentication/authorization failures should consistently return `httpx.WriteJSON(ctx, err)`
- Errors such as `gorm.ErrRecordNotFound` should be converted into clear business messages
- When returning backend data, logic that converts data into response DTOs may be placed under `internal/builders`

### 8.7 Enum Definitions

- System constants should be defined uniformly under `/internal/pkg/enums`
- Model statuses should preferably use `Status` from `/internal/pkg/enums/enums.go`; only add a new status enum when it does not meet the requirement
- Enums shared by backend and frontend must follow [docs/design/specs/backend-frontend-enum-ast-spec.md](docs/design/specs/backend-frontend-enum-ast-spec.md)
- Shared backend/frontend enums may only be defined in the backend; the frontend must generate results with `task enums`, and handwritten duplicate business enums are forbidden

## 9. Go Code Standards

- Logs must consistently use the standard library `log/slog`
- New logs must not introduce other logging libraries
- Log fields should preferably use structured key-value pairs
- New Go code must consistently use `any`; do not add new `interface{}`
- Run `gofmt` after modifying Go code

## 10. Frontend Standards

### 10.1 Project Facts

- Frontend directory: `web`
- Framework: `Next.js 16` + App Router
- Page directory: `web/app/*`
- Component directory: `web/components/*`
- shadcn/ui base component directory: `web/components/ui/*`
- Utility directories: `web/lib/*`, `web/hooks/*`
- Alias: `@/*`
- Style entry: `web/app/globals.css`
- shadcn config: `web/components.json`

### 10.2 Components and Pages

- Prefer base components from `shadcn/ui`
- If an existing `shadcn/ui` component covers the use case, do not duplicate an equivalent base component
- If missing base components such as `dialog`, `textarea`, or `select` are truly needed for business logic, install them according to the standard process instead of hand-writing substitutes
- Do not modify `web/components/ui/*`
- Business components should live in `web/components/*` or the corresponding business directory
- API calls must be uniformly encapsulated in the service layer; do not scatter raw `fetch` calls in pages
- Frontend business APIs must be called through service methods under `web/lib/api/*`; raw `fetch` must not be used directly in `page.tsx`, business components, or stores
- `web/lib/api/client.ts` is the default request entry point; new business APIs should preferably reuse `request()` instead of implementing another request client
- When the backend returns the unified `JsonResult`, the frontend must handle `success`, `errorCode`, `message`, and `data` consistently; success must not be determined only by HTTP status
- Business code must not parse `JsonResult.data`, assemble generic error handling, or hand-write auth-refresh logic by itself; these concerns must be centralized in the common request wrapper
- Requests that require login state must reuse the unified wrapper with auth headers, `3000/3002` token refresh, and login-expiration cleanup; do not handle these separately at the page layer
- Direct use of low-level `fetch` is allowed only for third-party external services, binary downloads, SSE/streaming responses, WebSocket handshakes, or other cases not yet supported by the unified wrapper; such usage must include a code comment explaining the reason

### 10.3 shadcn Usage Process

- First confirm that `web/components.json` exists; if it exists, do not run `init` again
- Commands must be run from the `web` directory
- Dependencies must be installed with `pnpm`
- Prefer adding new base components with:
  - `cd web && pnpm dlx shadcn@latest add button`
  - `cd web && pnpm dlx shadcn@latest add button dialog form table`

### 10.4 Next.js Conventions

- Prefer App Router
- Add `"use client"` explicitly when client state or side effects are required
- Pages and layouts should follow the `layout.tsx` and `page.tsx` conventions
- Checks should preferably reuse existing scripts: `dev`, `build`, `start`, `lint`, `format`, `typecheck`

### 10.5 Enum Management

- All frontend enums should be defined uniformly in `web/lib/enums.ts`
- Enums are defined by the backend; frontend enums are generated with `task enums`

### 10.6 Dashboard List and Form Baseline

- Dashboard CRUD pages should preferably follow: `docs/design/specs/frontend-list-form-best-practice.md`
- Baseline example: `web/app/dashboard/quick-replies`
- Default to a two-layer structure: `page.tsx` manages the list and state, `_components/edit.tsx` manages the dialog form
- Forms should default to: `react-hook-form` + `zod` + `web/components/ui/field.tsx`
- API calls should stay in the page layer or service layer; form components should not call APIs directly
- After adding or modifying dashboard list/form pages, the AI Agent must first self-check compliance with that document, then run `cd web && pnpm typecheck`

### 10.7 Other Frontend Standards

- All frontend display times must be formatted as `yyyy-MM-dd HH:mm:ss`; preferably use `formatDateTime` from `web/lib/utils.ts`
- Dropdown components should not use the shadcn `select` component; use the shadcn `combobox` component instead. The project has a general dropdown wrapper at `web/components/option-combobox.tsx`; use it where possible.
- If data is used inside a component, the component should load it itself as much as possible instead of receiving it from outside. Preserve component independence.

## 11. Pre-Commit Checklist

After each change, at minimum confirm:

1. There are no cross-layer calls or reverse dependencies
2. Write operations have clear transaction boundaries
3. Responses still follow the unified `JsonResult` structure
4. Compatibility with both SQLite and MySQL is preserved
5. Necessary tests were added, at least covering core service paths
6. `gofmt` was run for Go changes
7. Frontend changes passed at least `pnpm lint` or `pnpm typecheck` from the `web` directory

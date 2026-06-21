# M58 AdminPanel Frontend Route-Nav Taskbook

Date: 2026-06-21

Status: PASS_TASKBOOK_ONLY_NO_FRONTEND_CHANGE

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M31_ADMINPANEL_PERSISTENT_PACKAGE_GATE_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M55_ADMINPANEL_PRODUCTION_SMOKE_FRONTEND_DECISION_TASKBOOK_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M57_ADMINPANEL_PRODUCTION_SERVER_SMOKE_RECEIPT_20260621.md`
- `AdminPanel-Vue/src/app/routes/manifest.ts`
- `AdminPanel-Vue/src/app/routes/components.ts`
- `AdminPanel-Vue/src/router/index.ts`
- `AdminPanel-Vue/src/stores/app.ts`
- `modules/adminExtensionRegistry.js`
- `modules/adminExtensionRuntimeMount.js`
- `A:/AGENTS_OS_Workspace/runtime/VCPToolBox-JENN-Extensions/AdminExtensions/JennAdminStatus/admin-extension-manifest.json`

## 1. Scope

M58 is taskbook-only. It defines the gate for a later frontend route/nav implementation.

M58 does not:

```text
modify AdminPanel-Vue/src/**
modify AdminPanel-Vue/dist/**
run AdminPanel build
start AdminPanel frontend dev server
start production server
modify config.env
modify server.js
modify routes/adminPanelRoutes.js
modify backend Admin extension runtime
enable dynamic external Vue imports
call providers
write bridge/live external state
read LocalState/private content
read/checksum .agent_board/**
open upstream PR
```

## 2. Current Frontend Shape

Observed source-only shape:

```text
AdminPanel-Vue/src/app/routes/manifest.ts
  owns AppRouteId union
  owns AppRouteMeta fields
  owns APP_ROUTE_MANIFEST
  owns buildSidebarNavItems()

AdminPanel-Vue/src/app/routes/components.ts
  owns APP_ROUTE_COMPONENTS static route id -> Vue dynamic import map

AdminPanel-Vue/src/router/index.ts
  maps APP_ROUTE_MANIFEST entries into child routes

AdminPanel-Vue/src/stores/app.ts
  initializes navItems from buildSidebarNavItems()
```

Current frontend registration model:

```text
static core frontend route manifest
static core frontend component import map
sidebar nav derived from static manifest
no dynamic external Vue import path
```

Backend runtime state after M57:

```text
M57 production-server smoke PASS
GET /admin_api/jenn-admin-status/status = 200
response extensionId = jenn.admin.status
response mode = read-only
POST/PUT/PATCH/DELETE = 404
frontend route/nav enabled = no
AdminPanel build/dist modified = no
```

## 3. Metadata Source

The reviewed metadata source for the frontend candidate is the external Admin extension manifest:

```text
A:/AGENTS_OS_Workspace/runtime/VCPToolBox-JENN-Extensions/AdminExtensions/JennAdminStatus/admin-extension-manifest.json
```

Candidate frontend metadata:

```text
extensionId = jenn.admin.status
routeId = jenn-admin-status-view
routeName = JennAdminStatusView
path = /jenn-admin-status
title = Jenn Admin Status
icon = monitor_heart
navGroup = toolsPlugins
component = frontend/views/JennAdminStatusView.vue
showInSidebar = true
requiresAuth = true
```

Metadata rules:

```text
source manifest must be checksum-covered by external MANIFEST.sha256
source package path-risk scan must be 0
route path must not collide with existing APP_ROUTE_MANIFEST paths
routeName must not collide with existing APP_ROUTE_MANIFEST route names
route id used in core frontend must be kebab-case and unique
navGroup must be one of existing AppRouteGroup values
requiresAuth must remain true
showInSidebar may be true only after backend M57 PASS evidence exists
```

Current core backend registry parses external frontend routes, but `adminExtensionRuntimeMount` intentionally ignores frontend routes:

```text
frontendRouteCountIgnored = plan.frontendRoutes.length
dynamic external Vue import = not implemented
```

M58 keeps that behavior. It does not turn backend discovery into frontend readiness.

## 4. Display Boundary

Future frontend entry may display only reviewed, non-sensitive Admin extension status information:

```text
page title: Jenn Admin Status
extension id: jenn.admin.status
backend route status from GET /admin_api/jenn-admin-status/status
mode: read-only
write capability: disabled
route mount path: /admin_api/jenn-admin-status/status
last local proof: M57 production-server smoke PASS
```

Future frontend entry must not display:

```text
config.env values
AdminUsername
AdminPassword
raw Authorization headers
API keys
provider tokens
database URLs
webhook URLs
LocalState/private paths or content
.agent_board paths or content
DebugLog/log file content
raw server startup logs
external package absolute paths unless explicitly redacted
```

Allowed runtime request from the page:

```text
GET /admin_api/jenn-admin-status/status
```

Forbidden runtime requests from the page:

```text
POST /admin_api/jenn-admin-status/status
PUT /admin_api/jenn-admin-status/status
PATCH /admin_api/jenn-admin-status/status
DELETE /admin_api/jenn-admin-status/status
provider calls
bridge/live external writes
LocalState/private reads
```

## 5. Chosen Frontend Strategy

M58 selects this future M59 strategy:

```text
static reviewed route/nav registration in core AdminPanel frontend
static reviewed component import from AdminPanel-Vue/src/views/**
no browser filesystem reads
no dynamic import from external package paths
no remote metadata fetch for route construction
```

Reason:

```text
The current AdminPanel frontend is static-manifest based.
Static reviewed copy is easier to typecheck, lint, diff, and rollback.
Dynamic external Vue imports would cross a larger runtime and bundler boundary and need a separate design gate.
```

Blocked strategies:

```text
dynamic external Vue import from VCPToolBox-JENN-Extensions
runtime mutation of APP_ROUTE_MANIFEST from backend metadata
browser-side read of external package files
AdminPanel build/dist generation in the same gate
```

If a later plan wants dynamic frontend extension loading, it must create a separate milestone after M59 with its own threat model, bundler design, metadata endpoint, auth boundary, tests, and rollback.

## 6. Future M59 Allowed Files

M59 may touch only these core frontend source files unless the taskbook is explicitly amended first:

```text
AdminPanel-Vue/src/app/routes/manifest.ts
AdminPanel-Vue/src/app/routes/components.ts
AdminPanel-Vue/src/views/JennAdminStatusView.vue
```

M59 may add narrow tests only under:

```text
AdminPanel-Vue/tests/**
```

M59 must not touch:

```text
AdminPanel-Vue/dist/**
AdminPanel-Vue/package.json
AdminPanel-Vue/package-lock.json
AdminPanel-Vue/vite.config.*
AdminPanel-Vue/src/router/index.ts
AdminPanel-Vue/src/stores/app.ts
AdminPanel-Vue/src/layouts/**
AdminPanel-Vue/src/components/layout/**
server.js
routes/adminPanelRoutes.js
config.env
modules/adminExtensionRegistry.js
modules/adminExtensionRuntimeMount.js
```

If M59 appears to require any forbidden file, stop and write a `PLAN_CHANGE` before editing.

## 7. Future M59 Candidate Patch Shape

Candidate route metadata copied into core frontend:

```text
AppRouteId += "jenn-admin-status"
APP_ROUTE_MANIFEST += {
  id: "jenn-admin-status",
  routeName: "JennAdminStatusView",
  path: "/jenn-admin-status",
  title: "Jenn Admin Status",
  icon: "monitor_heart",
  requiresAuth: true,
  navGroup: "toolsPlugins",
  showInSidebar: true
}
APP_ROUTE_COMPONENTS["jenn-admin-status"] = () => import("@/views/JennAdminStatusView.vue")
```

Candidate view behavior:

```text
static page shell may be copied from reviewed external component
live status fetch may use GET /admin_api/jenn-admin-status/status only
write controls must not exist
secret/env/auth/log values must not be rendered
error states must be generic and redacted
```

The page must remain operator-facing and minimal. It is a route/nav proof, not a full AdminPanel extension marketplace or dynamic loader.

## 8. Future M59 Preflight

Before any frontend source edit, M59 must verify:

```text
git status --short --branch
git status --short --ignored config.env AdminPanel-Vue/dist server.js routes/adminPanelRoutes.js DebugLog logs cache state image
node scripts/run-adminpanel-real-config-unlock-decision-gate-harness.js
M57 receipt exists and records GET 200 / write 404 / cleanup PASS
external Admin extension manifest exists
external MANIFEST.sha256 covers JennAdminStatus package
external package path-risk scan remains 0
```

M59 must stop if:

```text
tracked worktree has unrelated changes
AdminPanel-Vue/dist/** is modified
routeName or path collision exists
external manifest checksum cannot be verified
view source contains secret/env/auth/log/path leaks
dynamic import from external package appears necessary
build/dist output appears necessary
backend route no longer passes M53/M57-style validation
```

## 9. Future M59 Validation

M59 validation candidates:

```powershell
rg -n "jenn-admin-status|JennAdminStatusView|monitor_heart" AdminPanel-Vue/src/app/routes/manifest.ts AdminPanel-Vue/src/app/routes/components.ts AdminPanel-Vue/src/views/JennAdminStatusView.vue
rg -n "[ \t]+$" AdminPanel-Vue/src/app/routes/manifest.ts AdminPanel-Vue/src/app/routes/components.ts AdminPanel-Vue/src/views/JennAdminStatusView.vue
npm run lint --prefix AdminPanel-Vue
```

Optional typecheck, only if local dependencies are available and it does not run build/dist:

```powershell
AdminPanel-Vue/node_modules/.bin/vue-tsc --noEmit
```

Forbidden validation in M59:

```powershell
npm run build --prefix AdminPanel-Vue
npm run build:no-type-check --prefix AdminPanel-Vue
npm run preview --prefix AdminPanel-Vue
npm run dev --prefix AdminPanel-Vue
```

Reason:

```text
build and preview/dev server are separate runtime/build gates
AdminPanel-Vue/dist/** must remain untouched in M59
```

## 10. Future M59 Receipt Fields

M59 receipt must include:

```text
FRONTEND_ROUTE_NAV_IMPLEMENTED=yes
FRONTEND_METADATA_SOURCE=external-admin-extension-manifest-reviewed-static-copy
FRONTEND_DYNAMIC_EXTERNAL_IMPORT_EXECUTED=no
FRONTEND_RUNTIME_METADATA_FETCH_FOR_ROUTE_CONSTRUCTION=no
ADMIN_BACKEND_ROUTE_GET_STATUS=200 or inherited-from-M57
ADMIN_BACKEND_ROUTE_WRITE_STATUS_CODES=POST:404,PUT:404,PATCH:404,DELETE:404 or inherited-from-M57
ADMINPANEL_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
CONFIG_ENV_VALUES_PRINTED=no
ADMIN_AUTH_VALUES_PRINTED=no
SERVER_JS_MODIFIED=no
ROUTES_ADMIN_PANEL_MODIFIED=no
PROVIDER_CALL_EXECUTED=no
BRIDGE_LIVE_WRITE_EXECUTED=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
UPSTREAM_PR_OPENED=no
```

## 11. Rollback

Future M59 frontend rollback:

```text
remove "jenn-admin-status" from AppRouteId
remove the APP_ROUTE_MANIFEST entry
remove APP_ROUTE_COMPONENTS["jenn-admin-status"]
remove AdminPanel-Vue/src/views/JennAdminStatusView.vue
remove any narrow tests added by M59
```

Rollback must not:

```text
delete AdminPanel-Vue/dist/**
modify config.env
remove M54 AdminPanel backend-readonly keys
remove AgentOverrides keys
delete external AdminExtensions package content
touch LocalState/private or .agent_board/**
```

## 12. M58 Validation

M58 validation is docs-only:

```powershell
rg -n "PASS_TASKBOOK_ONLY_NO_FRONTEND_CHANGE|M59|FRONTEND_ROUTE_NAV_IMPLEMENTED|FRONTEND_DYNAMIC_EXTERNAL_IMPORT_EXECUTED|ADMINPANEL_BUILD_RUN|ADMINPANEL_DIST_MODIFIED|UPSTREAM_PR_OPENED" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M58_ADMINPANEL_FRONTEND_ROUTE_NAV_TASKBOOK_20260621.md
rg -n "[ \t]+$" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M58_ADMINPANEL_FRONTEND_ROUTE_NAV_TASKBOOK_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
git diff --check
```

M58 result:

```text
FRONTEND_ROUTE_NAV_IMPLEMENTED=no
FRONTEND_DYNAMIC_EXTERNAL_IMPORT_EXECUTED=no
ADMINPANEL_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
CONFIG_ENV_MODIFIED=no
SERVER_STARTED=no
PRODUCTION_SERVER_STARTED=no
SERVER_JS_MODIFIED=no
ROUTES_ADMIN_PANEL_MODIFIED=no
UPSTREAM_PR_OPENED=no
```

## 13. Next Gate

```text
NEXT_GATE=M59_ADMINPANEL_FRONTEND_ROUTE_NAV_STATIC_IMPLEMENTATION_GATE
```

M59 is allowed only after the operator explicitly asks to implement the frontend route/nav gate. M58 itself does not authorize frontend edits.

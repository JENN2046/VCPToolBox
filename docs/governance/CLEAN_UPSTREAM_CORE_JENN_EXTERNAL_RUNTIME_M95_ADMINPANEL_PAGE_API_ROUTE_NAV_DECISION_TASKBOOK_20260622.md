# M95 AdminPanel Page/API Route-Nav Decision Taskbook

Date: 2026-06-22

Status: PASS_TASKBOOK_ONLY_NO_FRONTEND_RUNTIME

Decision: `KEEP_CORE_STATIC_FALLBACK_AND_DEFER_DYNAMIC_FRONTEND_RUNTIME`

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M90_ADMINPANEL_PAGE_API_EXTENSIONIZATION_TASKBOOK_20260622.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M93_ADMINPANEL_PAGE_API_REVIEWED_CONTENT_COPY_FIRST_RECEIPT_20260622.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M94_ADMINPANEL_PAGE_API_DEFAULT_OFF_METADATA_REGISTRY_GATE_20260622.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M58_ADMINPANEL_FRONTEND_ROUTE_NAV_TASKBOOK_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M59_ADMINPANEL_FRONTEND_ROUTE_NAV_STATIC_IMPLEMENTATION_RECEIPT_20260621.md`

## 1. Scope

M95 is a decision/taskbook gate only.

M95 does not:

```text
modify AdminPanel-Vue/src/**
modify AdminPanel-Vue/dist/**
connect metadata registry to production route/nav
enable dynamic external Vue import
import or execute external AdminExtensions Vue/API content
write real .env or config.env
start production server
run AdminPanel build/dev/preview
call provider, OAuth, bridge, live write, sync, publish, or deployment endpoints
read LocalState/private/operator data
read/checksum .agent_board/**
remove, stub, untrack, or delete core fallback content
open upstream PR
```

## 2. Current Route/Nav Reality

M95 treats repository reality as the starting point.

The five M93 page/API candidates already have core static frontend fallback entries:

```text
AdminPanel-Vue/src/app/routes/manifest.ts
AdminPanel-Vue/src/app/routes/components.ts
AdminPanel-Vue/src/views/AiImageAgents.vue
AdminPanel-Vue/src/views/ChannelHubManager.vue
AdminPanel-Vue/src/views/CodexImagegenRelay.vue
AdminPanel-Vue/src/views/CodexMemoryMonitor.vue
AdminPanel-Vue/src/views/OAuthAuthCenter.vue
```

Observed static route/component ids:

```text
ai-image-agents
channel-hub-manager
codex-imagegen-relay
codex-memory-monitor
oauth-auth-center
```

Observed external metadata route ids:

```text
ai-image-agents
channel-hub
codex-imagegen-relay
codex-memory-monitor
oauth-auth-center
```

Known route id alignment issue:

```text
AdminExtensions/ChannelHub metadata routeId = channel-hub
core static fallback route id/path = channel-hub-manager / /channel-hub-manager
```

M95 does not rename either side. Future M96 must treat this as an explicit mapping or closeout decision before any metadata-backed route/nav display is implemented.

M93 copied reviewed source content into external `AdminExtensions/`, but explicitly did not remove or weaken these core fallback files.

M94 added default-off metadata-only discovery for the copied packages:

```text
buildAdminExtensionMetadataRegistry()
default-off result: 0 packages / 0 route labels
scoped metadata flag result: 5 packages / 5 route labels
runtimeEnabled=false
dynamicVueImport=false
raw component/API refs hidden
```

Therefore M95 does not need to make the pages "visible" in core. They are already statically present. The unresolved decision is whether external package metadata should influence AdminPanel route/nav behavior.

## 3. Decision Matrix

| Option | Decision | Reason |
| --- | --- | --- |
| Keep current core static fallback and close this gate as taskbook-only | SELECTED | Lowest risk; preserves current AdminPanel behavior and keeps external package metadata non-executable. |
| Add a future static read-only metadata surface | ALLOWED_NEXT_GATE | Useful for operator review if separately implemented; must display labels/status only and use the existing core frontend source model. |
| Connect M94 metadata registry directly to production route/nav | DEFERRED | Would convert metadata discovery into runtime UI behavior and needs a separate implementation/validation gate. |
| Dynamically import external Vue/API from `AdminExtensions/` | BLOCKED | Crosses bundler, path, auth, and execution boundaries; not authorized by M90-M95. |
| Remove/stub/untrack old core views or route entries | BLOCKED | Explicitly outside the copy-first route and requires a later deletion/stub decision package. |

## 4. Future M96 Static Metadata Surface Gate

M95 selects this narrow future path if work continues:

```text
M96_ADMINPANEL_PAGE_API_STATIC_METADATA_ROUTE_NAV_SURFACE_GATE
```

Future M96 may implement a static, read-only AdminPanel surface only if it stays within this model:

```text
source model: static core frontend source
data model: sanitized M94 metadata labels/status only
execution model: no external Vue/API execution
runtime model: default-off unless scoped/local metadata flag is explicitly used
route-id model: metadata route ids must be mapped to existing core static ids before display; no automatic route creation from metadata
```

Allowed display fields:

```text
extensionId
displayName
sanitized description
sourcePackage
copyFirstContentIncluded
reviewRequired
reviewCompleted
plannedFrontendRouteCount
allowlisted
metadataRegistered
routeId
routeName
title
navGroup
showInSidebar
requiresAuth
contentCopied
componentRefPresent boolean
apiModuleRefPresent boolean
runtimeEnabled=false
dynamicVueImport=false
```

Forbidden display fields:

```text
raw componentRef
raw apiModuleRef
absolute external package paths
config.env values
.env values
AdminUsername
AdminPassword
Authorization headers
API keys
tokens
secrets
OAuth client secrets
provider credentials
database URLs
webhook URLs
LocalState/private paths or content
.agent_board paths or content
DebugLog/log file content
raw server startup logs
```

Future M96 allowed core files, if implementation is explicitly opened:

```text
AdminPanel-Vue/src/app/routes/manifest.ts
AdminPanel-Vue/src/app/routes/components.ts
AdminPanel-Vue/src/views/**
AdminPanel-Vue/src/api/**
```

Future M96 must not touch:

```text
AdminPanel-Vue/dist/**
AdminPanel-Vue/package.json
AdminPanel-Vue/package-lock.json
AdminPanel-Vue/vite.config.*
server.js
routes/adminPanelRoutes.js
modules/adminExtensionRuntimeMount.js
config.env
.env
external AdminExtensions package content
LocalState/private/**
.agent_board/**
```

If M96 appears to require a forbidden file, it must stop and write a plan-change receipt before editing.

M96 must also stop if:

```text
metadata route id and core route id differ and no explicit reviewed mapping exists
metadata path would create a new frontend path instead of describing an existing static fallback
route/nav implementation would require removing, renaming, or replacing core fallback routes
```

## 5. Runtime Stop Lines

M95 keeps these stop lines active for all later route/nav work:

```text
metadata discovery success is not runtime registration success
copy-first success is not dynamic frontend execution permission
core static fallback must remain until a separate deletion/stub decision package
provider/OAuth/action buttons remain blocked without a runtime action gate
AdminPanel build/dist remains blocked without an artifact gate
real config.env writes require explicit current-turn authorization
production server smoke requires explicit current-turn authorization
dynamic external Vue runtime requires a separate threat model and implementation gate
```

OAuth/Auth specific guard:

```text
OAuthAuthCenter may display reviewed status labels only.
It must not display raw tokens, client secrets, bearer headers, provider keys, or credential values.
It must not expose login, poll, remove account, set default, provider enable/disable, or upstream smoke actions without a separate runtime-action gate.
```

## 6. Future M96 Validation Requirements

Minimum future validation if M96 changes frontend source:

```powershell
git status --short
rg -n "AdminExtensions|buildAdminExtensionMetadataRegistry|dynamicVueImport|componentRef|apiModuleRef" AdminPanel-Vue/src
rg -n "[ \t]+$" AdminPanel-Vue/src/app/routes/manifest.ts AdminPanel-Vue/src/app/routes/components.ts AdminPanel-Vue/src/views
rg -n "config\.env|AdminUsername|AdminPassword|Authorization|API[_ -]?Key|token|secret|LocalState|\.agent_board|DebugLog|provider|bridge|POST|PUT|PATCH|DELETE|import\(\s*['\"]A:|VCPToolBox-JENN-Extensions" AdminPanel-Vue/src
git diff --check -- AdminPanel-Vue/src
```

Targeted frontend validation may run only if it does not write `dist/**`:

```powershell
.\node_modules\.bin\eslint.cmd <touched frontend files>
.\node_modules\.bin\vue-tsc.cmd --noEmit --pretty false
```

Forbidden M96 validation unless separately authorized:

```powershell
npm run build --prefix AdminPanel-Vue
npm run build:no-type-check --prefix AdminPanel-Vue
npm run dev --prefix AdminPanel-Vue
npm run preview --prefix AdminPanel-Vue
production server startup
provider/OAuth/bridge/live external write smoke
```

Required future M96 receipt fields:

```text
FRONTEND_ROUTE_NAV_DYNAMIC_RUNTIME_ENABLED=no
FRONTEND_EXTERNAL_VUE_IMPORT_EXECUTED=no
FRONTEND_EXTERNAL_API_EXECUTED=no
CORE_STATIC_FALLBACK_REMOVED=no
ADMINPANEL_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
REAL_CONFIG_ENV_WRITTEN=no
PRODUCTION_SERVER_STARTED=no
PROVIDER_OR_OAUTH_ACTION_CALLED=no
BRIDGE_OR_LIVE_WRITE_CALLED=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
UPSTREAM_PR_OPENED=no
```

## 7. Rollback

M95 rollback is docs-only:

```text
git revert <M95 core commit>
```

Future M96 rollback, if implemented later, must be scoped to the specific route/nav metadata surface files changed by M96. It must not delete external packages, modify real config, remove AdminPanel route fallbacks, or touch `dist/**`.

## 8. M95 Validation

M95 validation is docs-only:

```text
git diff --check
changed-path risk scan
secret-shape scan over M95/tracker docs
```

M95 intentionally did not run frontend build, frontend dev server, production server, provider/OAuth actions, bridge writes, or live external writes.

## 9. Result

```text
M95_ADMINPANEL_PAGE_API_ROUTE_NAV_DECISION_TASKBOOK_PASS=yes
NEXT_GATE=M96_ADMINPANEL_PAGE_API_STATIC_METADATA_ROUTE_NAV_SURFACE_GATE_OR_CLOSEOUT_DECISION
```

M95 preserves the current static core AdminPanel route/nav model and keeps external AdminExtensions metadata non-executable. Dynamic frontend runtime remains deferred.

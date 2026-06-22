# M96-PRE AdminPanel Page/API Route-Id Mapping Closeout Decision

Date: 2026-06-22

Status: PASS_DECISION_ONLY_NO_M96_ENTRY

Decision: `SELECT_CLOSEOUT_NO_STATIC_METADATA_SURFACE_NOW`

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M95_ADMINPANEL_PAGE_API_ROUTE_NAV_DECISION_TASKBOOK_20260622.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M94_ADMINPANEL_PAGE_API_DEFAULT_OFF_METADATA_REGISTRY_GATE_20260622.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M93_ADMINPANEL_PAGE_API_REVIEWED_CONTENT_COPY_FIRST_RECEIPT_20260622.md`

## 1. Scope

M96-PRE is a narrow decision gate before entering M96.

M96-PRE does not:

```text
modify AdminPanel-Vue/src/**
modify AdminPanel-Vue/dist/**
modify external AdminExtensions package content
modify real .env or config.env
enable VCP_ADMIN_EXTENSION_METADATA_REGISTRY_ENABLED in real config
connect metadata registry to production route/nav
enable dynamic external Vue import
import or execute external AdminExtensions Vue/API content
start production server
run AdminPanel build/dev/preview
call provider, OAuth, bridge, live write, sync, publish, or deployment endpoints
read LocalState/private/operator data
read/checksum .agent_board/**
remove, stub, untrack, or delete core fallback content
open upstream PR
```

## 2. Decision Inputs

M95 established that the five M93 page/API candidates already have core static fallback route/component entries:

```text
AdminPanel-Vue/src/app/routes/manifest.ts
AdminPanel-Vue/src/app/routes/components.ts
AdminPanel-Vue/src/views/AiImageAgents.vue
AdminPanel-Vue/src/views/ChannelHubManager.vue
AdminPanel-Vue/src/views/CodexImagegenRelay.vue
AdminPanel-Vue/src/views/CodexMemoryMonitor.vue
AdminPanel-Vue/src/views/OAuthAuthCenter.vue
```

M94 already validates external package metadata in default-off form:

```text
default-off: 0 packages / 0 route labels
scoped metadata flag: 5 packages / 5 route labels
runtimeEnabled=false
dynamicVueImport=false
raw component/API refs hidden
```

Therefore a new AdminPanel static metadata surface would not make missing pages visible. It would only add another review/status surface for metadata that is already covered by M94 tests and M95 documentation.

## 3. ChannelHub Route-Id Mapping

Observed mismatch:

```text
external package: AdminExtensions/ChannelHub/admin-extension-manifest.json
external metadata routeId: channel-hub
external routeName: ChannelHubManager

core static fallback route id: channel-hub-manager
core static fallback path: /channel-hub-manager
core routeName: ChannelHubManager
```

M96-PRE handles this by recording an explicit non-runtime mapping:

| External extension | External metadata routeId | Core route id | Core path | Decision |
| --- | --- | --- | --- | --- |
| `jenn.admin.channel-hub` | `channel-hub` | `channel-hub-manager` | `/channel-hub-manager` | `MAP_METADATA_TO_EXISTING_CORE_FALLBACK_IF_EVER_DISPLAYED` |

Mapping rules:

```text
metadata routeId is a package label, not authority to create a frontend route
core static fallback route id/path remain canonical for current AdminPanel UI
no manifest rewrite in M96-PRE
no core route rename in M96-PRE
no automatic route creation from metadata
```

If a future gate reopens metadata-backed display, it must either:

```text
use the reviewed mapping table above for display only
or create a separate external manifest alignment gate before implementation
```

It must not silently treat `channel-hub` as a new route.

## 4. Surface vs Closeout Decision

| Option | Decision | Reason |
| --- | --- | --- |
| Write a static read-only metadata surface now | DEFERRED | Adds frontend/API surface without unlocking missing behavior; would require extra route/nav UI, data plumbing, and validation while dynamic runtime remains blocked. |
| Direct closeout for the AdminPanel page/API route/nav lane | SELECTED | Current core static fallback pages are already present; M93 copied external content; M94 validates metadata-only registry; M95 records runtime stop lines; ChannelHub mapping is now explicit. |
| Dynamic external Vue/API runtime | BLOCKED | Still requires a separate threat model and implementation gate; not needed for current closeout. |
| Rename core or external ChannelHub route ids now | BLOCKED | Not necessary for closeout and could create route/path churn. |

Selected next gate:

```text
M96_ADMINPANEL_PAGE_API_ROUTE_NAV_CLOSEOUT_RECEIPT
```

M96 should be docs-only unless the user explicitly changes scope. It should record that AdminPanel page/API route/nav externalization is complete for the current Jenn fork local route at package + metadata-registry level, while dynamic frontend runtime and core fallback removal remain future gates.

## 5. M96 Closeout Requirements

M96 closeout receipt should confirm:

```text
core static fallback routes remain present
external AdminExtensions copied content remains checksum-covered
M94 metadata registry remains default-off
ChannelHub route-id mapping is recorded
static metadata surface implementation skipped now
dynamic external Vue/API runtime skipped now
real config env write skipped now
AdminPanel build/dist skipped now
production server skipped now
provider/OAuth/bridge/live-write actions skipped now
LocalState/private/.agent_board skipped now
upstream PR skipped now
```

M96 must not mark these as complete:

```text
dynamic frontend runtime
runtime execution of external Vue/API
core fallback deletion/stub/untrack
production deployment
upstream PR readiness
LocalState/private migration
provider/OAuth action enablement
```

## 6. Rollback

M96-PRE rollback is docs-only:

```text
git revert <M96-PRE core commit>
```

Rollback must not:

```text
delete external AdminExtensions content
modify core route/nav source
modify real config.env or .env
touch AdminPanel-Vue/dist/**
touch LocalState/private or .agent_board/**
```

## 7. Validation

M96-PRE validation is docs-only:

```text
git diff --check
changed-path risk scan
secret-shape scan over M96-PRE/tracker docs
```

No frontend build, frontend dev server, production server, provider/OAuth action, bridge write, live external write, or private data read is required or allowed for this gate.

## 8. Result

```text
M96_PRE_ADMINPANEL_PAGE_API_ROUTE_ID_MAPPING_CLOSEOUT_DECISION_PASS=yes
M96_ENTERED=no
NEXT_GATE=M96_ADMINPANEL_PAGE_API_ROUTE_NAV_CLOSEOUT_RECEIPT
STATIC_METADATA_SURFACE_NOW=no
CHANNEL_HUB_MAPPING_HANDLED=yes
DYNAMIC_FRONTEND_RUNTIME_ENABLED=no
```

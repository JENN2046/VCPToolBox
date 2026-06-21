# M47 AdminPanel Default-Off Runtime Registration Taskbook

Date: 2026-06-21

Status: TASKBOOK_READY_NO_ADMIN_RUNTIME_CHANGE

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M21_ADMINPANEL_EXTENSION_MANIFEST_TASKBOOK_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M22_ADMINPANEL_EXTENSION_SHADOW_VALIDATION_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M31_ADMINPANEL_PERSISTENT_PACKAGE_GATE_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M46_NEXT_RUNTIME_LANE_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`

## 1. Purpose

M47 defines the future AdminPanel default-off runtime registration route.

M47 is taskbook-only. It does not implement, activate, or test live runtime registration.

This taskbook answers:

```text
What must be true before AdminPanel can load reviewed external AdminExtensions at runtime while remaining default-off, read-only by default, and reversible?
```

## 2. Current Evidence

Current source observations:

```text
routes/adminPanelRoutes.js builds adminApiRouter and mounts built-in routes under /admin_api.
server.js applies adminAuth before mounting /admin_api routes.
AdminPanel-Vue/src/app/routes/manifest.ts uses static APP_ROUTE_MANIFEST.
AdminPanel-Vue/src/app/routes/components.ts uses static component imports.
AdminPanel-Vue/src/stores/app.ts builds navItems from the static manifest.
```

Current package evidence:

```text
external AdminExtensions/JennAdminStatus exists.
admin-extension-manifest.json parses.
manifest defaultEnabled is false.
backend route count is 1.
backend route method is GET.
backend route writeCapable is false.
frontend route metadata exists.
target path risk count is 0.
runtime registration reference count is 0.
```

Current decision evidence from M46:

```text
ADMINPANEL_CANDIDATE_STATUS=DEFERRED
ADMINPANEL_AUTO_UNLOCKABLE=no
ADMINPANEL_PACKAGE_PRESENT=yes
ADMINPANEL_PACKAGE_RECEIPT_PASS=yes
ADMINPANEL_PACKAGE_PATH_RISK_COUNT=0
ADMINPANEL_RUNTIME_LOADER_REF_COUNT=0
ADMINPANEL_BLOCKERS=no_core_runtime_loader,requires_default_off_registration_design,real_env_not_enabled
```

## 3. Non-Goals

M47 does not:

```text
modify config.env
write VCP_ADMIN_EXTENSION_DIRS
write a new AdminPanel env key
modify routes/adminPanelRoutes.js
modify server.js
modify AdminPanel-Vue files
modify AdminPanel-Vue/dist/**
run AdminPanel production build
start production server
register a real external AdminPanel route
mount a real external AdminPanel router
load external Vue files in the browser
read LocalState/private/operator data
read or checksum .agent_board/**
call providers
write to bridges
open upstream PR
```

## 4. Runtime Contract

Future runtime registration must use a split contract:

```text
VCP_ADMIN_EXTENSION_ALLOWED_ROOTS
VCP_ADMIN_EXTENSION_DIRS
VCP_ADMIN_EXTENSION_ALLOWLIST
```

Rules:

```text
VCP_ADMIN_EXTENSION_ALLOWED_ROOTS defines approved parent roots.
VCP_ADMIN_EXTENSION_DIRS defines candidate extension directories.
VCP_ADMIN_EXTENSION_ALLOWLIST defines exact extensionIds allowed to register.
If any required key is unset, runtime registration is off.
If the allowlist does not include an extensionId, that extension is discovered only and not registered.
Manifest defaultEnabled=false remains required even when allowlisted.
Discovery success is not runtime registration proof.
```

The existing M21 `VCP_ADMIN_EXTENSION_DIRS` idea is therefore narrowed for future runtime work: dirs alone are not enough. A root allowlist and exact extension allowlist are required before mounting anything.

## 5. First Implementation Boundary

The first future implementation should be backend-only and read-only.

Allowed first implementation candidate:

```text
M48 AdminPanel backend read-only default-off registry
```

Allowed M48 scope:

```text
pure Admin extension root resolver
pure manifest validator
pure registration plan builder
local test-only Express app proving default-off no registration
local test-only Express app proving env-on + allowlist mounts only reviewed GET read-only route
rollback test proving env-off returns to no external route
```

M48 must not:

```text
modify real config.env
start production server
run AdminPanel build
register frontend runtime routes
load external Vue components
register write-capable routes
mount routes outside /admin_api
bypass adminAuth
```

## 6. Frontend Boundary

Frontend runtime registration remains deferred after M47.

Reason:

```text
The current AdminPanel frontend uses static APP_ROUTE_MANIFEST and static APP_ROUTE_COMPONENTS imports.
External Vue files under AdminExtensions are package content, but they are not browser-loadable runtime components in the current built app.
```

Future frontend options require a separate taskbook before implementation:

```text
static build-time inclusion from reviewed package content
web-component or bundled asset lane with explicit CSP and asset integrity
metadata-only nav entry that links to an already compiled core view
```

Until a separate frontend taskbook passes:

```text
AdminPanel frontend route registration: deferred
sidebar injection: deferred
dynamic external Vue import: blocked
AdminPanel-Vue/dist changes: blocked
production build: blocked
```

## 7. Manifest Registration Rules

A future backend registry may only consider manifests that pass all of these checks:

```text
schemaVersion === 1
extensionId is exact-match allowlisted
defaultEnabled === false
all paths are relative
no path escapes with ..
no symlink traversal
mountPath is namespaced and collision-free
backend route methods are explicit
backend route writeCapable is false for the first gate
backend route requiresAuth is true
permissions.externalWrites === false
permissions.providerCalls === false
permissions.bridgeCalls === false
no LocalState/private/.agent_board/cache/log/output/image/db/vector paths
checksum manifest contains and matches all package files
```

For M48, only this existing package may be used as the reviewed candidate:

```text
AdminExtensions/JennAdminStatus
extensionId: jenn.admin.status
routeId: jenn-admin-status
method: GET
writeCapable: false
```

## 8. Backend Mount Rules

Future backend route mounting must satisfy:

```text
external routes mount only under /admin_api after adminAuth
external mount path must not shadow existing built-in admin routes
external module path must resolve under the extension root
external module must export a function returning an Express router or handler
external module receives a narrow sanitized context
external module does not receive apiKey, provider credentials, pluginManager, bridge objects, raw env, or LocalState paths
write-capable methods are blocked in the first gate
```

Required collision checks:

```text
existing built-in admin route prefixes
extension routeIds
extension mountPaths
frontend routeNames and paths, even though frontend registration remains deferred
```

## 9. Validation Plan

M48 validation must include:

```text
node --check for any new registry/resolver modules
default-off test: all env keys unset, no external route mounted
dirs-only test: VCP_ADMIN_EXTENSION_DIRS set without allowed roots/allowlist, no route mounted
allowlist-missing test: roots/dirs set but extensionId absent, no route mounted
env-on local test: scoped process env only, reviewed extension route mounted in local Express app
auth-boundary assertion: route is under /admin_api and assumes existing adminAuth boundary
GET read-only assertion: reviewed status route returns expected dry payload
write-block assertion: POST/PUT/PATCH/DELETE are not mounted
hash unchanged assertion for core and external package files
rollback assertion: clearing scoped env returns to no external route
```

M48 may use a local temporary HTTP test server. It must not start the production server.

## 10. Stop Conditions

Stop and mark BLOCK if future implementation requires:

```text
editing real config.env
enabling VCP_ADMIN_EXTENSION_DIRS in real env
mounting external routes without allowed roots and exact allowlist
registering frontend runtime routes
dynamic browser import from external package path
running AdminPanel production build
writing AdminPanel dist
passing apiKey/secrets/provider clients/bridge handles into extension modules
registering write-capable routes
reading LocalState/private/operator data
reading or checksumming .agent_board/**
provider call
bridge live write
production service startup
upstream PR
```

## 11. Future Milestones

Recommended next steps:

```text
M48: AdminPanel backend read-only default-off registry implementation gate
M49: AdminPanel backend registry shadow validation + rollback drill
M50: AdminPanel runtime-on local smoke with scoped env only, still no real config.env write
M51: AdminPanel frontend route/nav taskbook, if still needed
```

No M47 statement authorizes M48 implementation automatically beyond the future task's own gate, and no future milestone may write real env without explicit current-turn authorization.

## 12. Rollback

Rollback M47 by reverting:

```text
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M47_ADMINPANEL_DEFAULT_OFF_RUNTIME_REGISTRATION_TASKBOOK_20260621.md
M47 tracker updates
```

No runtime rollback is required because M47 does not modify runtime code, env, package content, or external state.

## 13. Safety Confirmations

```text
config.env modified: no
VCP_ADMIN_EXTENSION_DIRS written: no
AdminPanel backend route modified: no
AdminPanel frontend route manifest modified: no
AdminPanel build run: no
AdminPanel dist modified: no
Admin extension package modified: no
runtime AdminPanel extension registration executed: no
production server started: no
provider call executed: no
bridge live write executed: no
LocalState/private content read: no
.agent_board/** read or checksummed: no
upstream PR opened: no
```

## 14. Validation

M47 validation is documentation-only:

```powershell
rg -n "TASKBOOK_READY_NO_ADMIN_RUNTIME_CHANGE|VCP_ADMIN_EXTENSION_ALLOWED_ROOTS|VCP_ADMIN_EXTENSION_DIRS|VCP_ADMIN_EXTENSION_ALLOWLIST|M48 AdminPanel backend read-only default-off registry|Frontend runtime registration remains deferred|config.env modified: no|runtime AdminPanel extension registration executed: no|upstream PR opened: no" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M47_ADMINPANEL_DEFAULT_OFF_RUNTIME_REGISTRATION_TASKBOOK_20260621.md
git diff --check
git status --short --branch
```

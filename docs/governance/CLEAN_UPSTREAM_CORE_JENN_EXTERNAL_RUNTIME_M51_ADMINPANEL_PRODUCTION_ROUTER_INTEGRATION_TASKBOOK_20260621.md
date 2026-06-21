# M51 AdminPanel Production-Router Integration Taskbook

Date: 2026-06-21

Status: TASKBOOK_READY_NO_PRODUCTION_ROUTER_CHANGE

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M47_ADMINPANEL_DEFAULT_OFF_RUNTIME_REGISTRATION_TASKBOOK_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M48_ADMINPANEL_BACKEND_DEFAULT_OFF_REGISTRY_GATE_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M49_ADMINPANEL_BACKEND_REGISTRY_SHADOW_ROLLBACK_DRILL_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M50_ADMINPANEL_RUNTIME_ON_LOCAL_SMOKE_SCOPED_ENV_RECEIPT_20260621.md`
- `modules/adminExtensionRegistry.js`
- `routes/adminPanelRoutes.js`
- `server.js`

## 1. Scope

M51 is taskbook-only. It defines the next backend production-router integration gate for reviewed AdminPanel backend extensions.

M51 must not:

```text
modify server.js
modify routes/adminPanelRoutes.js
modify modules/adminExtensionRegistry.js
write real config.env
set real Admin extension env keys
start the production server
mount external routes in production runtime
register AdminPanel frontend route/nav
run AdminPanel build
write AdminPanel-Vue/dist/**
call providers
write bridge/live external state
read LocalState/private content
read/checksum .agent_board/**
open upstream PR
```

## 2. Plan Change

Earlier M47 notes listed:

```text
M51: AdminPanel frontend route/nav taskbook, if still needed
```

Current route is revised after M48-M50 backend evidence:

```text
M51: AdminPanel production-router integration taskbook
M52: possible backend production-router integration implementation gate
frontend route/nav taskbook: still deferred, no milestone number assigned here
```

Reason:

```text
M48-M50 proved backend registry, rollback, and scoped process.env local smoke.
The next risk is backend production-router integration shape, not frontend navigation.
Frontend route/nav registration still needs a separate taskbook after backend integration is proven safe.
```

This plan change does not change scoring for completed M47-M50 evidence.

## 3. Current Backend Shape

Observed backend routing shape:

```text
routes/adminPanelRoutes.js exports a function that builds adminApiRouter.
routes/adminPanelRoutes.js mounts built-in Admin modules on that adminApiRouter.
server.js constructs adminPanelRoutes by calling routes/adminPanelRoutes.js.
server.js later calls pluginManager.initializeServices(app, adminPanelRoutes, __dirname).
server.js later mounts app.use('/admin_api', adminPanelRoutes).
M47 recorded that adminAuth is applied before /admin_api routes.
```

Relevant existing production files:

```text
server.js
routes/adminPanelRoutes.js
```

M51 does not modify either file.

## 4. Preconditions For Future M52

Before any production-router implementation gate can start, all must be true:

```text
M48 PASS
M49 PASS
M50 PASS
worktree clean
real config.env not modified by the gate
Admin extension env keys absent from real config.env unless separately authorized
AdminPanel frontend remains deferred
external Admin package remains reviewed and checksum-clean
```

Future M52 must stop if:

```text
M48/M49/M50 rerun fails
real config.env already contains Admin extension keys without an explicit receipt
server.js changes appear necessary
frontend route/nav changes appear necessary
AdminPanel build appears necessary
the route would mount outside /admin_api
the route would bypass adminAuth
any write-capable method is required
any provider/bridge/LocalState/private behavior is required
```

## 5. Future M52 Allowed Scope

M52 may implement only a default-off backend production-router integration with test evidence.

Allowed future files:

```text
modules/adminExtensionRuntimeMount.js
tests/admin-extension-runtime-mount.test.js
scripts/run-adminpanel-production-router-integration-scoped-env-harness.js
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M52_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_RECEIPT_20260621.md
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
```

Potentially allowed only inside M52 after tests are in place:

```text
routes/adminPanelRoutes.js
```

M52 should avoid modifying `server.js`. If `server.js` modification appears necessary, M52 must stop and create a new taskbook instead.

## 6. Future M52 Required Design

The production-router integration should be split into two layers:

```text
adminExtensionRegistry:
  pure resolver / manifest validator / registration plan builder

adminExtensionRuntimeMount:
  accepts an existing Express Router and a validated plan
  mounts registered backend routes under their manifest mountPath
  returns a summary without reading secrets or mutating env
```

Required default behavior:

```text
real env absent => no external routes mounted
dirs-only env => no external routes mounted
allowlist-missing env => no external routes mounted
scoped env in harness => exactly reviewed read-only route mounted
rollback/unset scoped env => route unavailable again
```

Required route constraints:

```text
mount only under the existing /admin_api router shape
mount path must remain /jenn-admin-status for the reviewed package
full local path may be /admin_api/jenn-admin-status/status in tests
methods must remain GET-only
write methods must return 404 or another explicit blocked status
requiresAuth must remain true in manifest validation
the integration must not create its own unauthenticated app-level bypass
```

## 7. Future M52 Validation Matrix

M52 validation must include:

```text
node --check modules/adminExtensionRegistry.js
node --check modules/adminExtensionRuntimeMount.js
node --check tests/admin-extension-runtime-mount.test.js
node --check scripts/run-adminpanel-production-router-integration-scoped-env-harness.js
node --test tests/admin-extension-registry.test.js tests/admin-extension-runtime-mount.test.js
node scripts/run-adminpanel-backend-default-off-registry-gate-harness.js
node scripts/run-adminpanel-backend-registry-shadow-rollback-drill-harness.js
node scripts/run-adminpanel-runtime-on-local-smoke-scoped-env-harness.js
node scripts/run-adminpanel-production-router-integration-scoped-env-harness.js
git diff --check
```

The future M52 harness must prove:

```text
CONFIG_ENV_VALUES_PRINTED=no
CONFIG_ENV_FILE_MODIFIED=no
REAL_ENV_VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_SET=no unless separately authorized
REAL_ENV_VCP_ADMIN_EXTENSION_DIRS_SET=no unless separately authorized
REAL_ENV_VCP_ADMIN_EXTENSION_ALLOWLIST_SET=no unless separately authorized
DEFAULT_OFF_REGISTERED_ROUTE_COUNT=0
SCOPED_ENV_REGISTERED_ROUTE_COUNT=1
SCOPED_ENV_GET_STATUS=200
WRITE_METHOD_STATUS_CODES=404,404,404,404 or explicit blocked statuses
ROLLBACK_GET_STATUS=404
CORE_ADMIN_RUNTIME_HASH_UNCHANGED=no only if routes/adminPanelRoutes.js is the reviewed implementation target
SERVER_JS_HASH_UNCHANGED=yes
ADMINPANEL_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
FRONTEND_RUNTIME_REGISTRATION_EXECUTED=no
PRODUCTION_SERVER_STARTED=no
UPSTREAM_PR_OPENED=no
```

If M52 intentionally changes `routes/adminPanelRoutes.js`, the receipt must list the before/after hash and explain the exact mount point. `server.js` must remain unchanged.

## 8. Future M52 Rollback

Rollback must be simple:

```text
unset scoped env in tests
do not write real config.env
revert the M52 commit
```

Because M52 should remain default-off, reverting the commit should remove the integration without requiring data migration or cleanup.

## 9. Deferred Items

Deferred after M51:

```text
real config.env Admin extension key application
production server smoke
AdminPanel frontend route/nav registration
AdminPanel build/dist
stable operation window for AdminPanel runtime
upstream PR
```

None of these are authorized by M51.

## 10. M51 Validation

M51 validation is docs-only:

```powershell
rg -n "TASKBOOK_READY_NO_PRODUCTION_ROUTER_CHANGE|M52|server.js|routes/adminPanelRoutes.js|config.env|frontend route/nav|PRODUCTION_SERVER_STARTED=no|UPSTREAM_PR_OPENED=no" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M51_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_TASKBOOK_20260621.md
rg -n "[ \t]+$" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M51_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_TASKBOOK_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
git diff --check
```

M51 result:

```text
taskbook created: yes
PRODUCTION_ROUTER_MODIFIED=no
SERVER_JS_MODIFIED=no
ADMIN_PANEL_ROUTES_MODIFIED=no
CONFIG_ENV_MODIFIED=no
FRONTEND_RUNTIME_REGISTRATION_EXECUTED=no
ADMINPANEL_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
PRODUCTION_SERVER_STARTED=no
UPSTREAM_PR_OPENED=no
```

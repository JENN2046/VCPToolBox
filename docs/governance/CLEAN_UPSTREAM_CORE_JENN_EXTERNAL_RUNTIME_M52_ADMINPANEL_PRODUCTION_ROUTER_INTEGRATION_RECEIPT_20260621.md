# M52 AdminPanel Production-Router Integration Receipt

Date: 2026-06-21

Status: PASS

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related taskbook:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M51_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_TASKBOOK_20260621.md`

## 1. Scope

M52 implements the test-first, default-off backend production-router integration for reviewed AdminPanel backend extensions.

M52 changed:

```text
modules/adminExtensionRuntimeMount.js
tests/admin-extension-runtime-mount.test.js
routes/adminPanelRoutes.js
scripts/run-adminpanel-production-router-integration-scoped-env-harness.js
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M52_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_RECEIPT_20260621.md
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
```

M52 did not change:

```text
server.js
config.env
AdminPanel-Vue/dist/**
AdminPanel frontend route/nav
provider runtime
bridge runtime
LocalState/private lanes
.agent_board/**
upstream PR state
```

## 2. Implementation

Backend integration now has two layers:

```text
adminExtensionRegistry:
  pure resolver / manifest validator / plan builder

adminExtensionRuntimeMount:
  accepts an existing Express adminApiRouter and a validated plan
  mounts reviewed read-only backend routes
  returns a non-secret runtime summary
```

`routes/adminPanelRoutes.js` now calls `buildAndMountAdminExtensionRoutes(adminApiRouter, { projectRoot })` before returning the existing `adminApiRouter`.

Default behavior remains closed:

```text
real Admin extension env absent => no external route mounted
dirs-only / invalid env => no external route mounted
scoped env in harness => reviewed read-only route mounted
rollback / unset scoped env => route unavailable again
```

Reviewed mount point:

```text
manifest mountPath: /jenn-admin-status
local full path under existing admin API shape: /admin_api/jenn-admin-status/status
methods: GET only
write methods: 404 in validation
requiresAuth: true in manifest/plan
```

`routes/adminPanelRoutes.js` reviewed Git blob:

```text
before: 0b624cd48dc945d2a783e64d107bc96e2f6508d3
after:  68da24890d2814c06bf516d783938bd1e64333c3
diff:   28 insertions, 0 deletions
```

`server.js` was not modified; `git diff -- server.js` produced no diff, and the M52 harness reported `SERVER_JS_HASH_UNCHANGED=yes`.

## 3. Validation

Commands run:

```powershell
node --check modules/adminExtensionRuntimeMount.js
node --check tests/admin-extension-runtime-mount.test.js
node --check routes/adminPanelRoutes.js
node --check scripts/run-adminpanel-production-router-integration-scoped-env-harness.js
node --test tests/admin-extension-registry.test.js tests/admin-extension-runtime-mount.test.js
node scripts/run-adminpanel-backend-default-off-registry-gate-harness.js
node scripts/run-adminpanel-backend-registry-shadow-rollback-drill-harness.js
node scripts/run-adminpanel-runtime-on-local-smoke-scoped-env-harness.js
node scripts/run-adminpanel-production-router-integration-scoped-env-harness.js
```

Results:

```text
Admin extension registry/runtime mount tests: 8 pass / 0 fail
M48_ADMINPANEL_BACKEND_DEFAULT_OFF_REGISTRY_GATE_PASS
M49_ADMINPANEL_BACKEND_REGISTRY_SHADOW_ROLLBACK_DRILL_PASS
M50_ADMINPANEL_RUNTIME_ON_LOCAL_SMOKE_SCOPED_ENV_PASS
M52_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_SCOPED_ENV_PASS
BLOCK_REASONS=none
```

Key M52 harness evidence:

```text
CONFIG_ENV_VALUES_PRINTED=no
REAL_ENV_VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_SET=no
REAL_ENV_VCP_ADMIN_EXTENSION_DIRS_SET=no
REAL_ENV_VCP_ADMIN_EXTENSION_ALLOWLIST_SET=no
ADMIN_PANEL_ROUTES_MODULE_USED=yes
DEFAULT_OFF_RUNTIME_ENABLED=no
DEFAULT_OFF_MOUNTED_ROUTE_COUNT=0
DEFAULT_OFF_GET_STATUS=404
SCOPED_ENV_RUNTIME_ENABLED=yes
SCOPED_ENV_MOUNTED_ROUTE_COUNT=1
SCOPED_ENV_GET_STATUS=200
WRITE_METHOD_STATUS_CODES=404,404,404,404
ROLLBACK_PROCESS_ENV_RESTORED=yes
ROLLBACK_RUNTIME_ENABLED=no
ROLLBACK_MOUNTED_ROUTE_COUNT=0
ROLLBACK_GET_STATUS=404
CONFIG_ENV_FILE_MODIFIED=no
SERVER_JS_HASH_UNCHANGED=yes
ADMIN_PANEL_ROUTES_HASH_UNCHANGED_DURING_HARNESS=yes
EXTERNAL_ADMIN_PACKAGE_HASH_UNCHANGED=yes
PRODUCTION_SERVER_STARTED=no
ADMINPANEL_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
FRONTEND_RUNTIME_REGISTRATION_EXECUTED=no
PROVIDER_CALL_EXECUTED=no
BRIDGE_LIVE_WRITE_EXECUTED=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
UPSTREAM_PR_OPENED=no
```

## 4. Decision

M52 is complete for backend production-router integration:

```text
ADMINPANEL_BACKEND_PRODUCTION_ROUTER_INTEGRATION=PASS
DEFAULT_OFF_BY_REAL_CONFIG=yes
SCOPED_ENV_ONLY_VALIDATION=yes
REAL_CONFIG_ENV_MODIFIED=no
SERVER_JS_MODIFIED=no
FRONTEND_RUNTIME_DEFERRED=yes
PRODUCTION_SERVER_SMOKE_DEFERRED=yes
```

## 5. Rollback

Rollback remains simple:

```text
unset scoped process.env in harness
do not write real config.env
revert the M52 commit
```

Because the integration is default-off without real Admin extension env keys, reverting the M52 commit removes the backend mount path without data migration or runtime state cleanup.

## 6. Deferred

Still deferred after M52:

```text
real config.env Admin extension key application
production server smoke
AdminPanel frontend route/nav registration
AdminPanel build/dist
stable operation window for AdminPanel runtime
provider/bridge/LocalState/private lanes
upstream PR
```

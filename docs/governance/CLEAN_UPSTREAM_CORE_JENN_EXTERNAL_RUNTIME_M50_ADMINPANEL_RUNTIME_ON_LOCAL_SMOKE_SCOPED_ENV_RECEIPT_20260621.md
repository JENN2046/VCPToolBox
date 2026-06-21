# M50 AdminPanel Runtime-On Local Smoke Scoped Env Receipt

Date: 2026-06-21

Status: PASS_ADMINPANEL_RUNTIME_ON_LOCAL_SMOKE_SCOPED_ENV

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M47_ADMINPANEL_DEFAULT_OFF_RUNTIME_REGISTRATION_TASKBOOK_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M48_ADMINPANEL_BACKEND_DEFAULT_OFF_REGISTRY_GATE_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M49_ADMINPANEL_BACKEND_REGISTRY_SHADOW_ROLLBACK_DRILL_RECEIPT_20260621.md`
- `modules/adminExtensionRegistry.js`
- `tests/admin-extension-registry.test.js`
- `scripts/run-adminpanel-backend-default-off-registry-gate-harness.js`
- `scripts/run-adminpanel-backend-registry-shadow-rollback-drill-harness.js`
- `scripts/run-adminpanel-runtime-on-local-smoke-scoped-env-harness.js`

## 1. Scope

M50 validates a scoped local runtime-on smoke without writing real configuration or integrating production runtime.

Included:

```text
use temporary process.env scoped Admin extension keys
call buildAdminExtensionPlan through its default process.env path
mount reviewed backend route in a local test-only /admin_api shaped app
verify default-off route is unavailable
verify scoped runtime-on GET route is available
verify write methods stay blocked
restore process.env and verify rollback route is unavailable
hash unchanged checks for config.env, core Admin runtime files, and external Admin package files
```

Excluded:

```text
real config.env write
production server startup
production AdminPanel route registration
routes/adminPanelRoutes.js modification
server.js modification
AdminPanel frontend route/nav registration
dynamic external Vue import
AdminPanel build
AdminPanel dist writes
provider call
bridge live write
LocalState/private read
.agent_board/** read/checksum
upstream PR
```

## 2. Files

Core files added:

```text
scripts/run-adminpanel-runtime-on-local-smoke-scoped-env-harness.js
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M50_ADMINPANEL_RUNTIME_ON_LOCAL_SMOKE_SCOPED_ENV_RECEIPT_20260621.md
```

Core files updated:

```text
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
```

Core files intentionally not modified:

```text
server.js
routes/adminPanelRoutes.js
AdminPanel-Vue/src/app/routes/manifest.ts
AdminPanel-Vue/src/app/routes/components.ts
AdminPanel-Vue/src/stores/app.ts
AdminPanel-Vue/dist/**
config.env
```

## 3. Commands

```powershell
node --check scripts/run-adminpanel-runtime-on-local-smoke-scoped-env-harness.js
node --check modules/adminExtensionRegistry.js
node --check tests/admin-extension-registry.test.js
node --check scripts/run-adminpanel-backend-default-off-registry-gate-harness.js
node --check scripts/run-adminpanel-backend-registry-shadow-rollback-drill-harness.js
node --test tests/admin-extension-registry.test.js
node scripts/run-adminpanel-backend-default-off-registry-gate-harness.js
node scripts/run-adminpanel-backend-registry-shadow-rollback-drill-harness.js
node scripts/run-adminpanel-runtime-on-local-smoke-scoped-env-harness.js
```

## 4. Test Evidence

Unit test result:

```text
tests 5
pass 5
fail 0
```

M48 rerun result:

```text
M48_ADMINPANEL_BACKEND_DEFAULT_OFF_REGISTRY_GATE_PASS
BLOCK_REASONS=none
```

M49 rerun result:

```text
M49_ADMINPANEL_BACKEND_REGISTRY_SHADOW_ROLLBACK_DRILL_PASS
BLOCK_REASONS=none
```

M50 harness result:

```text
M50_ADMINPANEL_RUNTIME_ON_LOCAL_SMOKE_SCOPED_ENV
CONFIG_ENV_EXISTS=yes
CONFIG_ENV_VALUES_PRINTED=no
CONFIG_ENV_SHA256=6072970be0a36124c865d914b048ce1946ef24370cc5958adf7ad7fac9085223
REAL_ENV_VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_SET=no
INITIAL_PROCESS_ENV_VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_SET=no
REAL_ENV_VCP_ADMIN_EXTENSION_DIRS_SET=no
INITIAL_PROCESS_ENV_VCP_ADMIN_EXTENSION_DIRS_SET=no
REAL_ENV_VCP_ADMIN_EXTENSION_ALLOWLIST_SET=no
INITIAL_PROCESS_ENV_VCP_ADMIN_EXTENSION_ALLOWLIST_SET=no
BUILD_PLAN_ENV_SOURCE=process.env
DEFAULT_OFF_RUNTIME_ENABLED=no
DEFAULT_OFF_REGISTERED_ROUTE_COUNT=0
DEFAULT_OFF_GET_STATUS=404
SCOPED_PROCESS_ENV_APPLIED=yes
RUNTIME_ON_RUNTIME_ENABLED=yes
RUNTIME_ON_DISCOVERED_COUNT=1
RUNTIME_ON_REGISTERED_ROUTE_COUNT=1
RUNTIME_ON_FRONTEND_REGISTERED_ROUTE_COUNT=0
RUNTIME_ON_FRONTEND_METADATA_COUNT=1
RUNTIME_ON_DIAGNOSTIC_CODES=none
LOCAL_PRODUCTION_SHAPE_ADMIN_API_PREFIX=/admin_api
LOCAL_PRODUCTION_SHAPE_MOUNTED_ROUTE_COUNT=1
LOCAL_PRODUCTION_SHAPE_MOUNTED_FULL_PATHS=/admin_api/jenn-admin-status
RUNTIME_ON_GET_STATUS=200
RUNTIME_ON_BODY_OK=yes
RUNTIME_ON_BODY_EXTENSION_ID=jenn.admin.status
RUNTIME_ON_BODY_MODE=read-only
RUNTIME_ON_WRITE_METHOD_STATUS_CODES=404,404,404,404
AUTH_PROBE_HIT_COUNT=5
ROUTE_UNDER_ADMIN_API=yes
BYPASS_ADMIN_AUTH=no
ROLLBACK_PROCESS_ENV_RESTORED=yes
ROLLBACK_RUNTIME_ENABLED=no
ROLLBACK_REGISTERED_ROUTE_COUNT=0
ROLLBACK_GET_STATUS=404
SCOPED_PROCESS_ENV_WAS_TEMPORARY=yes
CONFIG_ENV_FILE_MODIFIED=no
CORE_ADMIN_RUNTIME_HASH_UNCHANGED=yes
EXTERNAL_ADMIN_PACKAGE_HASH_UNCHANGED=yes
PROCESS_ENV_FINAL_UNCHANGED=yes
LOCAL_HTTP_TEST_SERVER_STARTED=yes
PRODUCTION_SERVER_STARTED=no
ADMINPANEL_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
PRODUCTION_ADMIN_REGISTRATION_EXECUTED=no
LOCAL_RUNTIME_ON_SMOKE_EXECUTED=yes
FRONTEND_RUNTIME_REGISTRATION_EXECUTED=no
DYNAMIC_EXTERNAL_VUE_IMPORT_EXECUTED=no
PLUGIN_EXECUTION_ATTEMPTED=no
PROVIDER_CALL_EXECUTED=no
BRIDGE_LIVE_WRITE_EXECUTED=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
UPSTREAM_PR_OPENED=no
M50_ADMINPANEL_RUNTIME_ON_LOCAL_SMOKE_SCOPED_ENV_PASS
BLOCK_REASONS=none
```

## 5. Decision

```text
M50 result: PASS
scoped process.env runtime-on smoke: pass
rollback after process.env restore: pass
real config.env write: no
production runtime registration: not executed
frontend runtime registration: deferred
AdminPanel build/dist: not run / not modified
```

M50 proves that the backend registry can read scoped Admin extension runtime keys from `process.env` in a local test-only process, mount the reviewed read-only route under an `/admin_api` shaped local app, and return to default-off behavior after restoring process env.

M50 does not prove:

```text
production AdminPanel runtime registration
real config.env activation
frontend runtime route/nav registration
deployment readiness
stable operation window
upstream readiness
```

## 6. Stop Position

Stop here before:

```text
writing real config.env Admin extension keys
modifying server.js or routes/adminPanelRoutes.js
starting production server
running AdminPanel build
registering frontend runtime route/nav
opening upstream PR
```

Recommended next gate, only after a separate decision:

```text
M51 AdminPanel production-router integration taskbook
```

M51 should be taskbook-first and must not directly modify real env or frontend runtime.

## 7. Rollback

Rollback M50 by reverting the commit that adds:

```text
scripts/run-adminpanel-runtime-on-local-smoke-scoped-env-harness.js
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M50_ADMINPANEL_RUNTIME_ON_LOCAL_SMOKE_SCOPED_ENV_RECEIPT_20260621.md
M50 tracker updates
```

No runtime rollback is required because M50 does not integrate the registry into production AdminPanel routing and does not modify real env.

# M54 AdminPanel Real-Config Apply And Rollback Drill Receipt

Date: 2026-06-21

Status: PASS_REAL_CONFIG_APPLIED_BACKEND_READONLY

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M52_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M53_ADMINPANEL_REAL_CONFIG_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`
- `scripts/run-adminpanel-real-config-apply-rollback-drill-harness.js`
- `scripts/run-adminpanel-real-config-unlock-decision-gate-harness.js`
- `scripts/run-adminpanel-production-router-integration-scoped-env-harness.js`

## 1. Authorization

User explicitly authorized writing the three selected AdminPanel real-config keys:

```text
VCP_ADMIN_EXTENSION_ALLOWED_ROOTS
VCP_ADMIN_EXTENSION_DIRS
VCP_ADMIN_EXTENSION_ALLOWLIST
```

M54 applied only those three AdminPanel backend-readonly keys.

M54 did not modify:

```text
VCP_AGENT_ALLOWED_ROOTS
VCP_AGENT_OVERRIDE_DIRS
VCP_AGENT_DIRS
provider keys
bridge keys
PhotoStudio keys
LocalState/private keys
frontend route/nav keys
```

## 2. Scope

M54 scope:

```text
write exact three AdminPanel keys to real config.env
do not print config values
validate post-apply backend route through local test server only
temporarily remove the three keys for rollback drill
restore the three keys and confirm final hash restored
```

M54 did not:

```text
commit config.env
start production server
run AdminPanel build
modify AdminPanel-Vue/dist/**
enable AdminPanel frontend runtime route/nav
execute provider call
execute bridge live write
read LocalState/private content
read/checksum .agent_board/**
open upstream PR
```

## 3. Apply Evidence

Apply command used an inline Node updater that printed only hashes and counts.

Result:

```text
M54_ADMIN_CONFIG_APPLY
CONFIG_ENV_VALUES_PRINTED=no
CONFIG_ENV_SHA256_BEFORE=6072970be0a36124c865d914b048ce1946ef24370cc5958adf7ad7fac9085223
CONFIG_ENV_SHA256_AFTER=908cf54b61878606946b6f0d14544a488ff24b87f17b78c04e9cab6d8ace97d3
CONFIG_ENV_HASH_CHANGED=yes
ADMIN_KEYS_BEFORE_TOTAL=0
ADMIN_KEYS_AFTER_TOTAL=3
ADMIN_KEYS_AFTER_EXACTLY_ONCE=yes
M54_ADMIN_CONFIG_APPLY_PASS
```

`config.env` is ignored and was not staged or committed.

## 4. Post-Apply Validation

M53 post-apply validation:

```text
GATE_MODE=post-apply-validation
REAL_ENV_ADMIN_KEYS_SET_COUNT=3
REAL_ENV_ALLOWED_AGENT_RUNTIME_KEYS_SET_COUNT=2
REAL_ENV_BLOCKED_RUNTIME_KEYS_SET_COUNT=0
REAL_ENV_ADMIN_RUNTIME_ENABLED=yes
REAL_ENV_ADMIN_REGISTERED_ROUTE_COUNT=1
REAL_ENV_ADMIN_DIAGNOSTIC_CODES=none
CANDIDATE_MOUNT_PATH=/jenn-admin-status
CANDIDATE_ROUTE_METHODS=GET
CANDIDATE_ROUTE_REQUIRES_AUTH=yes
CANDIDATE_ROUTE_WRITE_CAPABLE=no
M53_ADMINPANEL_REAL_CONFIG_UNLOCK_DECISION_GATE_PASS
```

M52 post-apply production-router validation:

```text
GATE_MODE=post-apply-validation
REAL_ENV_ADMIN_KEYS_SET_COUNT=3
REAL_CONFIG_RUNTIME_ENABLED=yes
REAL_CONFIG_ATTEMPTED_ROUTE_COUNT=1
REAL_CONFIG_MOUNTED_ROUTE_COUNT=1
REAL_CONFIG_FRONTEND_ROUTE_COUNT_IGNORED=1
REAL_CONFIG_MOUNTED_FULL_PATHS=/admin_api/jenn-admin-status
REAL_CONFIG_GET_STATUS=200
REAL_CONFIG_WRITE_METHOD_STATUS_CODES=404,404,404,404
SERVER_JS_HASH_UNCHANGED=yes
ADMIN_PANEL_ROUTES_HASH_UNCHANGED_DURING_HARNESS=yes
M52_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_SCOPED_ENV_PASS
```

M48-M50 were updated to treat exactly three real AdminPanel keys as the authorized post-apply state while still blocking partial AdminPanel env. They now pass in post-apply-compatible mode.

## 5. Rollback Drill

Command:

```powershell
node scripts/run-adminpanel-real-config-apply-rollback-drill-harness.js
```

Result:

```text
M54_ADMINPANEL_REAL_CONFIG_APPLY_ROLLBACK_DRILL
CONFIG_ENV_VALUES_PRINTED=no
APPLIED_ADMIN_KEYS_SET_COUNT=3
APPLIED_ALLOWED_AGENT_RUNTIME_KEYS_SET_COUNT=2
APPLIED_BLOCKED_RUNTIME_KEYS_SET_COUNT=0
APPLIED_RUNTIME_ENABLED=yes
APPLIED_MOUNTED_ROUTE_COUNT=1
APPLIED_MOUNTED_FULL_PATHS=/admin_api/jenn-admin-status
APPLIED_GET_STATUS=200
APPLIED_WRITE_METHOD_STATUS_CODES=404,404,404,404
ROLLBACK_REMOVED_ADMIN_KEYS_SET_COUNT=0
ROLLBACK_REMOVED_ALLOWED_AGENT_RUNTIME_KEYS_SET_COUNT=2
ROLLBACK_REMOVED_BLOCKED_RUNTIME_KEYS_SET_COUNT=0
ROLLBACK_REMOVED_RUNTIME_ENABLED=no
ROLLBACK_REMOVED_MOUNTED_ROUTE_COUNT=0
ROLLBACK_REMOVED_GET_STATUS=404
RESTORED_ADMIN_KEYS_SET_COUNT=3
RESTORED_ALLOWED_AGENT_RUNTIME_KEYS_SET_COUNT=2
RESTORED_BLOCKED_RUNTIME_KEYS_SET_COUNT=0
RESTORED_RUNTIME_ENABLED=yes
RESTORED_MOUNTED_ROUTE_COUNT=1
RESTORED_GET_STATUS=200
RESTORED_WRITE_METHOD_STATUS_CODES=404,404,404,404
FINAL_CONFIG_ENV_HASH_RESTORED=yes
PRODUCTION_SERVER_STARTED=no
ADMINPANEL_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
FRONTEND_RUNTIME_REGISTRATION_EXECUTED=no
PROVIDER_CALL_EXECUTED=no
BRIDGE_LIVE_WRITE_EXECUTED=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
UPSTREAM_PR_OPENED=no
M54_ADMINPANEL_REAL_CONFIG_APPLY_ROLLBACK_DRILL_PASS
BLOCK_REASONS=none
```

## 6. Validation Commands

Commands run:

```powershell
node --check scripts/run-adminpanel-backend-default-off-registry-gate-harness.js
node --check scripts/run-adminpanel-backend-registry-shadow-rollback-drill-harness.js
node --check scripts/run-adminpanel-runtime-on-local-smoke-scoped-env-harness.js
node --check scripts/run-adminpanel-production-router-integration-scoped-env-harness.js
node --check scripts/run-adminpanel-real-config-apply-rollback-drill-harness.js
node scripts/run-adminpanel-backend-default-off-registry-gate-harness.js
node scripts/run-adminpanel-backend-registry-shadow-rollback-drill-harness.js
node scripts/run-adminpanel-runtime-on-local-smoke-scoped-env-harness.js
node scripts/run-adminpanel-production-router-integration-scoped-env-harness.js
node scripts/run-adminpanel-real-config-unlock-decision-gate-harness.js
node scripts/run-adminpanel-real-config-apply-rollback-drill-harness.js
node --test tests/admin-extension-registry.test.js tests/admin-extension-runtime-mount.test.js
```

Results:

```text
M48_ADMINPANEL_BACKEND_DEFAULT_OFF_REGISTRY_GATE_PASS
M49_ADMINPANEL_BACKEND_REGISTRY_SHADOW_ROLLBACK_DRILL_PASS
M50_ADMINPANEL_RUNTIME_ON_LOCAL_SMOKE_SCOPED_ENV_PASS
M52_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_SCOPED_ENV_PASS
M53_ADMINPANEL_REAL_CONFIG_UNLOCK_DECISION_GATE_PASS
M54_ADMINPANEL_REAL_CONFIG_APPLY_ROLLBACK_DRILL_PASS
AdminPanel registry/runtime tests: 8 pass / 0 fail
```

## 7. Current State

Current local runtime state:

```text
AgentOverrides real-config lane: enabled from M41
AdminPanel backend-readonly real-config lane: enabled by M54
AdminPanel frontend runtime: disabled
AdminPanel production server smoke: not run
AdminPanel build/dist: not run / not modified
Provider/bridge/LocalState/private lanes: disabled
```

## 8. Rollback

Rollback M54 local runtime state:

```text
remove VCP_ADMIN_EXTENSION_ALLOWED_ROOTS
remove VCP_ADMIN_EXTENSION_DIRS
remove VCP_ADMIN_EXTENSION_ALLOWLIST
rerun M53 and M54 validation
```

Rollback governance evidence:

```text
revert the commit that adds this receipt, the M54 harness, and tracker updates
```

Do not remove AgentOverrides keys when rolling back only M54.

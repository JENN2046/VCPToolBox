# M55 AdminPanel Production-Server Smoke / Frontend Route-Nav Decision Taskbook

Date: 2026-06-21

Status: PASS_DECISION_TASKBOOK_NO_SERVER_START

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M52_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M53_ADMINPANEL_REAL_CONFIG_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M54_ADMINPANEL_REAL_CONFIG_APPLY_ROLLBACK_DRILL_RECEIPT_20260621.md`
- `routes/adminPanelRoutes.js`
- `server.js`
- `AdminPanel-Vue/src/app/routes/manifest.ts`
- `AdminPanel-Vue/src/app/routes/components.ts`
- `AdminPanel-Vue/src/stores/app.ts`

## 1. Scope

M55 is a decision taskbook only.

M55 does not:

```text
start production server
start AdminPanel frontend server
modify server.js
modify routes/adminPanelRoutes.js
modify config.env
modify AdminPanel-Vue/src/**
modify AdminPanel-Vue/dist/**
run AdminPanel build
enable frontend runtime route/nav
call providers
write bridge/live external state
read LocalState/private content
read/checksum .agent_board/**
open upstream PR
```

## 2. Current State

AdminPanel backend-readonly lane after M54:

```text
real config.env AdminPanel keys: enabled
M52 post-apply production-router harness: PASS
M53 post-apply real-config unlock harness: PASS
M54 apply + rollback drill: PASS
backend route under local /admin_api shape: GET 200
write methods: 404,404,404,404
frontend runtime route/nav: disabled
production server smoke: not run
AdminPanel build/dist: not run / not modified
```

Frontend route structure observed:

```text
AdminPanel-Vue/src/app/routes/manifest.ts
  static AppRouteId union
  static APP_ROUTE_MANIFEST
  static sidebar nav builder

AdminPanel-Vue/src/app/routes/components.ts
  static route id -> dynamic import map

AdminPanel-Vue/src/stores/app.ts
  navItems initialized from buildSidebarNavItems()
```

Backend production route shape observed:

```text
server.js loads config.env
server.js creates adminPanelRoutes from routes/adminPanelRoutes.js
server.js applies Admin auth around /admin_api and /AdminPanel
server.js mounts app.use('/admin_api', adminPanelRoutes)
routes/adminPanelRoutes.js now mounts Admin extension routes through adminExtensionRuntimeMount
```

## 3. Decision

Chosen next sequence:

```text
M56: AdminPanel production-server smoke taskbook only
M57: AdminPanel production-server smoke implementation gate only if separately authorized
M58: AdminPanel frontend route/nav taskbook after backend production-server smoke decision/evidence
```

Reason:

```text
The backend route is already enabled in real config and validated in local test-server harnesses.
Before exposing a frontend entry, the safer next proof is to define exactly how a production-server smoke would be constrained, observed, and rolled back.
Frontend route/nav should not be wired until the production-server smoke boundary is explicit, because frontend navigation would make the feature visible to operators.
```

M55 does not authorize M57 actual server startup. M56 must be taskbook-only unless the user explicitly asks to start the production server in a later gate.

## 4. Option Matrix

| Option | Result | Why |
| --- | --- | --- |
| Production-server smoke taskbook next | SELECTED | Defines exact startup/port/auth/log/rollback rules before any actual server start. |
| Actual production-server smoke immediately | REJECTED_FOR_M55 | Starting `server.js` is a runtime side effect and must have a dedicated gate. |
| Frontend route/nav taskbook next | DEFERRED | Useful, but should follow backend production-server smoke planning/evidence. |
| Frontend route/nav implementation immediately | REJECTED_FOR_M55 | Would expose navigation and touch frontend runtime before the server-smoke boundary is settled. |
| AdminPanel build/dist | DEFERRED | Build artifacts and `dist/**` are release-like outputs; separate gate required. |

## 5. Future M56 Taskbook Requirements

M56 should define, without starting the server:

```text
exact command or npm script candidate
expected port and collision behavior
how to avoid duplicate long-running production processes
which env keys are allowed to be active
redacted config/env proof only
Admin auth boundary expectations
target endpoint: /admin_api/jenn-admin-status/status
allowed request methods: GET only
write method expectation: 404 or explicit blocked status
startup timeout and cleanup procedure
log capture path without printing secrets
provider/bridge/live-write/LocalState/private/.agent_board prohibitions
rollback: stop process and remove AdminPanel three config keys only if rolling back M54
```

M56 must stop if:

```text
production server startup would require new env secrets
Admin auth credentials are missing or would need to be printed
provider calls, bridge writes, LocalState/private reads, or external writes appear unavoidable
server.js changes appear necessary
frontend route/nav changes appear necessary
AdminPanel build appears necessary
another production server is already running and cannot be safely distinguished
```

## 6. Future M57 Actual Smoke Requirements

M57 may start the production server only after explicit current-turn authorization.

Minimum M57 evidence:

```text
PRODUCTION_SERVER_STARTED=yes
SERVER_PROCESS_CLEANED_UP=yes
CONFIG_ENV_VALUES_PRINTED=no
ADMIN_BACKEND_ROUTE_GET_STATUS=200 or documented auth-gated status with reason
ADMIN_BACKEND_ROUTE_WRITE_STATUS_CODES=404,404,404,404 or explicit blocked statuses
FRONTEND_RUNTIME_REGISTRATION_EXECUTED=no
ADMINPANEL_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
PROVIDER_CALL_EXECUTED=no
BRIDGE_LIVE_WRITE_EXECUTED=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
UPSTREAM_PR_OPENED=no
```

If production server smoke cannot be safely run, M57 must be `BLOCK` with a reason and no fallback that weakens the safety boundary.

## 7. Future M58 Frontend Taskbook Requirements

M58 should be taskbook-only unless explicitly expanded later.

It must define:

```text
whether external frontend route metadata is copied into core static manifest or loaded dynamically
whether dynamic external Vue imports are allowed or still blocked
route id / routeName / path naming rules
sidebar group placement
component source and checksum requirements
typecheck/build command candidates
rollback by removing route manifest/component map entries
no AdminPanel-Vue/dist/** commit unless a separate build/release gate authorizes it
```

M58 must not treat backend route registration as frontend readiness.

## 8. M55 Validation

M55 validation is docs-only:

```powershell
rg -n "PASS_DECISION_TASKBOOK_NO_SERVER_START|M56|M57|M58|PRODUCTION_SERVER_STARTED|FRONTEND_RUNTIME_REGISTRATION_EXECUTED|ADMINPANEL_BUILD_RUN|UPSTREAM_PR_OPENED" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M55_ADMINPANEL_PRODUCTION_SMOKE_FRONTEND_DECISION_TASKBOOK_20260621.md
rg -n "[ \t]+$" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M55_ADMINPANEL_PRODUCTION_SMOKE_FRONTEND_DECISION_TASKBOOK_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
git diff --check
```

M55 result:

```text
PRODUCTION_SERVER_STARTED=no
FRONTEND_RUNTIME_REGISTRATION_EXECUTED=no
ADMINPANEL_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
CONFIG_ENV_MODIFIED=no
SERVER_JS_MODIFIED=no
UPSTREAM_PR_OPENED=no
```

## 9. Rollback

Rollback M55 by reverting the governance commit that adds:

```text
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M55_ADMINPANEL_PRODUCTION_SMOKE_FRONTEND_DECISION_TASKBOOK_20260621.md
tracker M55/S76 updates
```

M55 does not change runtime state, so no `config.env` rollback is required.

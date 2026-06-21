# M56 AdminPanel Production-Server Smoke Taskbook

Date: 2026-06-21

Status: TASKBOOK_READY_NO_SERVER_START

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M54_ADMINPANEL_REAL_CONFIG_APPLY_ROLLBACK_DRILL_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M55_ADMINPANEL_PRODUCTION_SMOKE_FRONTEND_DECISION_TASKBOOK_20260621.md`
- `scripts/run-adminpanel-real-config-unlock-decision-gate-harness.js`
- `scripts/run-adminpanel-real-config-apply-rollback-drill-harness.js`
- `scripts/run-adminpanel-production-router-integration-scoped-env-harness.js`
- `server.js`
- `package.json`

## 1. Scope

M56 is taskbook-only. It defines how a later M57 production-server smoke may be run safely.

M56 does not:

```text
start production server
start AdminPanel frontend server
modify config.env
modify server.js
modify routes/adminPanelRoutes.js
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

## 2. Current Runtime State

M54 already enabled the AdminPanel backend-readonly lane in real `config.env`:

```text
VCP_ADMIN_EXTENSION_ALLOWED_ROOTS: present
VCP_ADMIN_EXTENSION_DIRS: present
VCP_ADMIN_EXTENSION_ALLOWLIST: present
```

Values must not be printed. Current verification command:

```powershell
node scripts/run-adminpanel-real-config-unlock-decision-gate-harness.js
```

Expected redacted evidence:

```text
CONFIG_ENV_VALUES_PRINTED=no
GATE_MODE=post-apply-validation
REAL_ENV_ADMIN_KEYS_SET_COUNT=3
REAL_ENV_ADMIN_RUNTIME_ENABLED=yes
REAL_ENV_ADMIN_REGISTERED_ROUTE_COUNT=1
M53_ADMINPANEL_REAL_CONFIG_UNLOCK_DECISION_GATE_PASS
```

## 3. Production Shape Observed

Observed from source only:

```text
package.json has "start": "node server.js"
server.js loads config.env
server.js defines adminAuth for /admin_api and /AdminPanel
server.js creates adminPanelRoutes through routes/adminPanelRoutes.js
server.js mounts app.use('/admin_api', adminPanelRoutes)
server.js listens through app.listen(port)
```

Relevant source observations:

```text
adminAuth rejects Admin/API requests if AdminUsername/AdminPassword are absent.
/AdminPanel is redirected to ADMIN_PORT = port + 1.
/admin_api remains mounted in the main server.
routes/adminPanelRoutes.js already mounts the reviewed Admin extension backend route when real AdminPanel env keys are present.
```

M56 does not prove actual production server runtime. It only defines the safe proof plan for M57.

## 4. M57 Candidate Command

M57 may use one of these commands only after explicit current-turn authorization:

```powershell
npm start
```

Equivalent explicit command:

```powershell
node server.js
```

M57 should prefer a controlled child process started by a harness rather than a manually launched terminal process, because the harness can:

```text
capture PID
capture startup output with redaction
enforce startup timeout
probe HTTP endpoint
terminate the child process
confirm cleanup
```

M57 must not use:

```powershell
npm run start:all
npm run start:admin
npm run build:admin
```

Reason:

```text
start:all would also start adminServer.js.
start:admin is the separate frontend/admin process, not the backend route smoke.
build:admin installs/builds frontend and may modify AdminPanel-Vue/dist/**.
```

## 5. M57 Preflight Requirements

Before starting the server, M57 must run read-only preflight:

```text
git status --short --branch
git status --short --ignored config.env AdminPanel-Vue/dist server.js routes/adminPanelRoutes.js
node scripts/run-adminpanel-real-config-unlock-decision-gate-harness.js
```

Required preflight state:

```text
worktree clean except ignored config.env
config.env values printed: no
AdminPanel real-config keys set count: 3
AdminPanel runtime enabled: yes
AdminPanel registered route count: 1
blocked runtime keys set count: 0
server.js unchanged in git
routes/adminPanelRoutes.js unchanged in git
AdminPanel-Vue/dist/** not modified
```

M57 must stop if:

```text
real config.env is missing
AdminPanel three-key config is partial
AdminUsername/AdminPassword are absent and the smoke requires authenticated 200
checking Admin auth would require printing credentials
another production server is already running on the target port and cannot be safely distinguished
provider calls, bridge writes, LocalState/private reads, or external writes appear unavoidable
server.js changes appear necessary
frontend route/nav changes appear necessary
AdminPanel build appears necessary
```

## 6. M57 Port And Process Rules

M57 must document:

```text
target port source, redacted if loaded from config.env
whether the port is free before startup
child process PID
startup timeout
cleanup method
post-cleanup process check
```

Allowed cleanup:

```text
terminate only the child process created by the M57 harness
close child process stdin/stdout/stderr handles
wait for child exit
```

Forbidden cleanup:

```text
kill unrelated node.exe processes
kill by broad process name
force delete files
modify config.env during cleanup
```

## 7. M57 HTTP Probe Rules

Target endpoint:

```text
/admin_api/jenn-admin-status/status
```

Required request set:

```text
GET
POST
PUT
PATCH
DELETE
```

Expected results:

```text
GET: 200 if authenticated safely, or documented auth-gated status if credentials are not used
POST/PUT/PATCH/DELETE: 404 or explicit blocked status
```

Authentication handling:

```text
do not print AdminUsername
do not print AdminPassword
do not store credentials in receipt
if Basic auth is used, generate request header in memory only
record only status codes and redacted mode
```

If M57 cannot safely authenticate without exposing credentials, it may accept an auth-gated proof:

```text
GET returns 401/403/503 with documented reason
server process started and cleaned up
M52/M53/M54 local non-production harnesses still prove the route body behavior
```

But if credentials are available and can be used without printing, the preferred evidence is:

```text
GET 200
response extensionId=jenn.admin.status
response mode=read-only
write methods blocked
```

## 8. M57 Log Rules

M57 may capture only redacted startup lines:

```text
server started / listening line
Admin extension registration summary if present
error code names without secret values
```

M57 must not print:

```text
config.env values
AdminUsername
AdminPassword
API keys
provider tokens
database URLs
webhook URLs
raw request authorization headers
```

If logs contain unknown sensitive-looking data, M57 must redact or omit the line and record:

```text
LOG_LINE_REDACTED=yes
```

## 9. M57 Required Receipt Fields

Future M57 receipt must include:

```text
PRODUCTION_SERVER_STARTED=yes
SERVER_PROCESS_PID_RECORDED=yes
SERVER_PROCESS_CLEANED_UP=yes
CONFIG_ENV_VALUES_PRINTED=no
ADMIN_AUTH_VALUES_PRINTED=no
TARGET_PORT_REDACTED_OR_SAFE=yes
ADMIN_BACKEND_ROUTE_GET_STATUS=<status>
ADMIN_BACKEND_ROUTE_WRITE_STATUS_CODES=<statuses>
FRONTEND_RUNTIME_REGISTRATION_EXECUTED=no
ADMINPANEL_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
SERVER_JS_MODIFIED=no
ROUTES_ADMIN_PANEL_MODIFIED=no
PROVIDER_CALL_EXECUTED=no
BRIDGE_LIVE_WRITE_EXECUTED=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
UPSTREAM_PR_OPENED=no
```

## 10. M57 Rollback

Runtime rollback:

```text
terminate only the child process started by M57
confirm target port is no longer held by that child
leave real config.env unchanged unless explicitly rolling back M54
```

Config rollback, only if intentionally rolling back M54:

```text
remove VCP_ADMIN_EXTENSION_ALLOWED_ROOTS
remove VCP_ADMIN_EXTENSION_DIRS
remove VCP_ADMIN_EXTENSION_ALLOWLIST
rerun M53/M54 validation
```

M57 must not remove AgentOverrides keys when rolling back only AdminPanel.

## 11. M56 Validation

M56 validation is docs-only:

```powershell
rg -n "TASKBOOK_READY_NO_SERVER_START|M57|PRODUCTION_SERVER_STARTED|SERVER_PROCESS_CLEANED_UP|CONFIG_ENV_VALUES_PRINTED|ADMINPANEL_BUILD_RUN|UPSTREAM_PR_OPENED" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M56_ADMINPANEL_PRODUCTION_SERVER_SMOKE_TASKBOOK_20260621.md
rg -n "[ \t]+$" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M56_ADMINPANEL_PRODUCTION_SERVER_SMOKE_TASKBOOK_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
git diff --check
```

M56 result:

```text
PRODUCTION_SERVER_STARTED=no
SERVER_PROCESS_CLEANED_UP=not-applicable
CONFIG_ENV_MODIFIED=no
CONFIG_ENV_VALUES_PRINTED=no
SERVER_JS_MODIFIED=no
ROUTES_ADMIN_PANEL_MODIFIED=no
FRONTEND_RUNTIME_REGISTRATION_EXECUTED=no
ADMINPANEL_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
UPSTREAM_PR_OPENED=no
```

## 12. Rollback

Rollback M56 by reverting the governance commit that adds:

```text
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M56_ADMINPANEL_PRODUCTION_SERVER_SMOKE_TASKBOOK_20260621.md
tracker M56/S77 updates
```

M56 does not change runtime state, so no `config.env` rollback is required.

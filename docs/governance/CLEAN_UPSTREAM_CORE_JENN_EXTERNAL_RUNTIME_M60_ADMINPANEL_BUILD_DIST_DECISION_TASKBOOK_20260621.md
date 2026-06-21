# M60 AdminPanel Build / Dist Decision Taskbook

Date: 2026-06-21

Status: PASS_DECISION_TASKBOOK_NO_BUILD_NO_DIST

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M58_ADMINPANEL_FRONTEND_ROUTE_NAV_TASKBOOK_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M59_ADMINPANEL_FRONTEND_ROUTE_NAV_STATIC_IMPLEMENTATION_RECEIPT_20260621.md`
- `AdminPanel-Vue/package.json`
- `AdminPanel-Vue/src/app/routes/manifest.ts`
- `AdminPanel-Vue/src/app/routes/components.ts`
- `AdminPanel-Vue/src/views/JennAdminStatusView.vue`

## 1. Scope

M60 is a decision taskbook only. It defines when and how AdminPanel build, dist handling, and visual/browser smoke may happen.

M60 does not:

```text
run npm run build --prefix AdminPanel-Vue
run npm run build:no-type-check --prefix AdminPanel-Vue
run npm run dev --prefix AdminPanel-Vue
run npm run preview --prefix AdminPanel-Vue
modify AdminPanel-Vue/dist/**
modify AdminPanel-Vue/src/**
modify config.env
start production server
start AdminPanel frontend server
modify server.js
modify routes/adminPanelRoutes.js
call providers
write bridge/live external state
read LocalState/private content
read/checksum .agent_board/**
open upstream PR
```

## 2. Current State

M59 source route/nav state:

```text
FRONTEND_ROUTE_NAV_IMPLEMENTED=yes
route id=jenn-admin-status
routeName=JennAdminStatusView
path=/jenn-admin-status
component=AdminPanel-Vue/src/views/JennAdminStatusView.vue
FRONTEND_DYNAMIC_EXTERNAL_IMPORT_EXECUTED=no
ADMINPANEL_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
```

M59 validation state:

```text
TARGETED_ESLINT_TOUCHED_FILES_PASS=yes
VUE_TSC_NO_EMIT_PASS=yes
FULL_FRONTEND_LINT_PASS=no
FULL_FRONTEND_LINT_BLOCKED_BY_EXISTING_TYPOGRAPHY_BASELINE=yes
M59_NEW_FILE_IN_TYPOGRAPHY_FAILURE_LIST=no
```

Available AdminPanel scripts:

```text
npm run dev --prefix AdminPanel-Vue
npm run build --prefix AdminPanel-Vue
npm run build:no-type-check --prefix AdminPanel-Vue
npm run preview --prefix AdminPanel-Vue
npm run test --prefix AdminPanel-Vue
npm run lint --prefix AdminPanel-Vue
npm run lint:typography --prefix AdminPanel-Vue
```

Build script shape:

```text
build = vue-tsc && vite build
build:no-type-check = vite build
```

## 3. Decision

M60 decision:

```text
DO_NOT_RUN_BUILD_YET=yes
DO_NOT_MODIFY_DIST_YET=yes
NEXT_SAFE_GATE=M61_ADMINPANEL_NO_BUILD_ROUTE_SOURCE_VALIDATION_RECEIPT
BUILD_DIST_GATE_REQUIRES_SEPARATE_CURRENT_TURN_AUTHORIZATION=yes
```

Reason:

```text
M59 already proved source-level route/nav typing through targeted ESLint and vue-tsc --noEmit.
Running Vite build would create or rewrite AdminPanel-Vue/dist/**, which is a release-like artifact.
The full frontend lint command is still blocked by pre-existing typography baseline issues in unrelated files.
The next reversible step is a no-build route/source validation gate, not a build artifact gate.
```

This does not mean build is permanently blocked. It means build/dist needs a separate gate with explicit artifact policy.

## 4. Build / Dist Authorization Gate

Before any later milestone may run an AdminPanel build, that milestone must state:

```text
which command will run
expected output directory
whether AdminPanel-Vue/dist/** is allowed to change
whether dist changes will be committed or discarded
how dist diff will be reviewed
how generated hashes/chunks will be handled
rollback method
whether browser visual smoke is required before commit
whether production server is required or forbidden
```

Allowed future build commands only after that gate:

```powershell
npm run build --prefix AdminPanel-Vue
```

Possible future dry build command, only if the gate explicitly sets a temporary outDir:

```powershell
npx vite build --outDir <workspace-temp-dir> --emptyOutDir
```

M60 does not authorize either command.

Forbidden without a later explicit build gate:

```powershell
npm run build --prefix AdminPanel-Vue
npm run build:no-type-check --prefix AdminPanel-Vue
npm run preview --prefix AdminPanel-Vue
npm run dev --prefix AdminPanel-Vue
```

## 5. Dist Policy

Current policy:

```text
AdminPanel-Vue/dist/** preserved by default
no blanket dist ignore
no dist deletion
no dist regeneration
no dist commit in M60
```

Future dist commit gate must include:

```text
before/after git status for AdminPanel-Vue/dist/**
build command output summary
dist file count delta
dist file name hash/chunk delta
source map policy
asset size summary
rollback command or revert plan
reason why dist should be committed now
```

Future no-commit build gate must include:

```text
temp build output outside AdminPanel-Vue/dist/**
cleanup confirmation
no tracked dist change
no ignored runtime/private path copied into temp output
```

## 6. Visual / Browser Smoke Policy

Future browser smoke may be useful, but must be separated from M60.

A later browser smoke gate must state:

```text
frontend serve command
backend dependency shape
whether production server is already running or forbidden
admin auth handling
URL to open
viewport sizes
expected visible nav label
expected route component content
screenshot policy
cleanup method
no secret screenshots
```

If browser smoke needs credentials:

```text
do not print AdminUsername
do not print AdminPassword
do not store raw auth headers
do not save screenshots containing secret values
```

M60 does not start a browser, dev server, preview server, or production server.

## 7. Existing Lint Baseline Gap

M59 observed:

```text
npm run lint --prefix AdminPanel-Vue => failed
failure cause: existing typography baseline in unrelated files
M59 new file no longer appears in the typography failure list after fix
```

Future choices:

| Option | Status | Notes |
| --- | --- | --- |
| Fix full typography baseline now | DEFERRED | Broad frontend hygiene patch across many unrelated files; not required for M59 route/nav proof. |
| Add narrow touched-file lint gate | SELECTED_FOR_M59 | Already passed for `manifest.ts`, `components.ts`, and `JennAdminStatusView.vue`. |
| Run build despite lint baseline | BLOCKED_BY_M60 | Build/dist requires separate authorization and artifact policy. |
| Treat full lint failure as M59 failure | REJECTED | M59 targeted checks and `vue-tsc --noEmit` passed; full lint gap is pre-existing and documented. |

If the operator wants full lint green before any build, create a separate typography baseline cleanup milestone before the build gate.

## 8. Future M61 No-Build Route Source Validation

M60 selects M61 as the next safe auto-eligible gate:

```text
M61_ADMINPANEL_NO_BUILD_ROUTE_SOURCE_VALIDATION_RECEIPT
```

M61 may run:

```powershell
rg -n "jenn-admin-status|JennAdminStatusView|monitor_heart" AdminPanel-Vue/src/app/routes/manifest.ts AdminPanel-Vue/src/app/routes/components.ts AdminPanel-Vue/src/views/JennAdminStatusView.vue
.\node_modules\.bin\eslint.cmd src/app/routes/manifest.ts src/app/routes/components.ts src/views/JennAdminStatusView.vue
.\node_modules\.bin\vue-tsc.cmd --noEmit --pretty false
node scripts/run-adminpanel-real-config-unlock-decision-gate-harness.js
git diff --check
```

M61 must not run:

```powershell
npm run build --prefix AdminPanel-Vue
npm run build:no-type-check --prefix AdminPanel-Vue
npm run dev --prefix AdminPanel-Vue
npm run preview --prefix AdminPanel-Vue
```

M61 expected receipt fields:

```text
NO_BUILD_ROUTE_SOURCE_VALIDATION_PASS=yes
FRONTEND_ROUTE_NAV_IMPLEMENTED=yes
TARGETED_ESLINT_TOUCHED_FILES_PASS=yes
VUE_TSC_NO_EMIT_PASS=yes
ADMINPANEL_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
PRODUCTION_SERVER_STARTED=no
FRONTEND_DEV_OR_PREVIEW_SERVER_STARTED=no
CONFIG_ENV_VALUES_PRINTED=no
DYNAMIC_EXTERNAL_VUE_IMPORT_EXECUTED=no
UPSTREAM_PR_OPENED=no
```

## 9. Future Build Gate Stop Conditions

Any future build/dist gate must stop before running build if:

```text
tracked worktree has unrelated changes
AdminPanel-Vue/dist/** is already modified
full lint baseline policy is undecided
dist commit policy is undecided
build command would write outside approved output directory
credentials or secret values would be printed
production server startup is required but not explicitly authorized
browser smoke would capture secret-bearing content
```

## 10. M60 Validation

M60 validation is docs-only:

```powershell
rg -n "PASS_DECISION_TASKBOOK_NO_BUILD_NO_DIST|DO_NOT_RUN_BUILD_YET|DO_NOT_MODIFY_DIST_YET|M61|ADMINPANEL_BUILD_RUN|ADMINPANEL_DIST_MODIFIED|UPSTREAM_PR_OPENED" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M60_ADMINPANEL_BUILD_DIST_DECISION_TASKBOOK_20260621.md
rg -n "[ \t]+$" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M60_ADMINPANEL_BUILD_DIST_DECISION_TASKBOOK_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
git diff --check
```

M60 result:

```text
ADMINPANEL_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
FRONTEND_DEV_OR_PREVIEW_SERVER_STARTED=no
PRODUCTION_SERVER_STARTED=no
CONFIG_ENV_MODIFIED=no
SERVER_JS_MODIFIED=no
ROUTES_ADMIN_PANEL_MODIFIED=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
UPSTREAM_PR_OPENED=no
```

## 11. Rollback

Rollback M60 by reverting the governance commit that adds:

```text
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M60_ADMINPANEL_BUILD_DIST_DECISION_TASKBOOK_20260621.md
tracker M60/S81 updates
```

No runtime, build, dist, or config rollback is required because M60 is docs-only.

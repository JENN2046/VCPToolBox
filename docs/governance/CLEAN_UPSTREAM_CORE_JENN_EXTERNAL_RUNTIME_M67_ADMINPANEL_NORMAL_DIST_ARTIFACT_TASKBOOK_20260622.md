# M67 AdminPanel Normal Dist Artifact Taskbook

Date: 2026-06-22

Status: PASS_TASKBOOK_ONLY_NO_BUILD_NO_DIST

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M60_ADMINPANEL_BUILD_DIST_DECISION_TASKBOOK_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M64_ADMINPANEL_TEMP_OUTDIR_DRY_BUILD_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M66_ADMINPANEL_BROWSER_VISUAL_SMOKE_RECEIPT_20260621.md`

## 1. Scope

M67 defines the future normal `AdminPanel-Vue/dist/**` artifact gate.

M67 does not:

```text
run npm run build --prefix AdminPanel-Vue
run npm run build:no-type-check --prefix AdminPanel-Vue
run npm run dev --prefix AdminPanel-Vue
run npm run preview --prefix AdminPanel-Vue
start production server
modify AdminPanel-Vue/dist/**
modify AdminPanel-Vue/src/**
modify package files
modify config.env
call provider APIs
write bridge/live external state
read LocalState/private content
read/checksum .agent_board/**
open upstream PR
```

## 2. Decision

M66 proved the reviewed route can render from a temporary build.

Next gate:

```text
NEXT_GATE=M68_ADMINPANEL_NORMAL_DIST_ARTIFACT_BUILD_GATE
M68_REQUIRES_EXPLICIT_CURRENT_TURN_AUTHORIZATION=yes
NORMAL_DIST_ARTIFACT_MAY_TOUCH_ADMINPANEL_DIST_ONLY=yes
PRODUCTION_SERVER_REQUIRED=no
BROWSER_SMOKE_ALREADY_AVAILABLE_FROM_M66=yes
```

M68 may run only the normal typed build command:

```powershell
npm run build --prefix AdminPanel-Vue
```

Do not use `build:no-type-check` for the normal artifact gate unless a later taskbook records a new decision and blocker.

## 3. M68 Preflight

M68 must stop before build if any of these are true:

```text
worktree is dirty outside the planned docs/dist artifact scope
AdminPanel-Vue/src has uncommitted changes
AdminPanel-Vue/package.json or package-lock.json has uncommitted changes
AdminPanel-Vue/dist has unrelated uncommitted changes
config.env has staged or tracked changes
.tmp visual/build output still exists
the operator has not explicitly authorized M68 actual build in the current turn
```

Required pre-build evidence:

```powershell
git status --short -- AdminPanel-Vue/src AdminPanel-Vue/dist AdminPanel-Vue/package.json AdminPanel-Vue/package-lock.json config.env
git diff --name-status -- AdminPanel-Vue/src AdminPanel-Vue/dist AdminPanel-Vue/package.json AdminPanel-Vue/package-lock.json
git ls-files AdminPanel-Vue/dist
```

Record before build:

```text
DIST_TRACKED_FILE_COUNT_PRE
DIST_TRACKED_AGGREGATE_SHA256_PRE
DIST_ALL_FILE_COUNT_PRE
DIST_ALL_TOTAL_BYTES_PRE
```

## 4. M68 Build Command

Allowed command:

```powershell
npm run build --prefix AdminPanel-Vue
```

Forbidden in M68:

```powershell
npm run build:no-type-check --prefix AdminPanel-Vue
npm run dev --prefix AdminPanel-Vue
npm run preview --prefix AdminPanel-Vue
node server.js
```

M68 build output summary must record:

```text
BUILD_EXIT_CODE
VUE_TSC_PHASE_PASS
VITE_BUILD_PHASE_PASS
TRANSFORMED_MODULES
BUILD_DURATION
```

## 5. Dist Artifact Review

After build, M68 must inspect only `AdminPanel-Vue/dist/**` artifact impact:

```powershell
git status --short -- AdminPanel-Vue/dist AdminPanel-Vue/src AdminPanel-Vue/package.json AdminPanel-Vue/package-lock.json
git diff --name-status -- AdminPanel-Vue/dist
git diff --stat -- AdminPanel-Vue/dist
```

Required artifact evidence:

```text
DIST_TRACKED_FILE_COUNT_POST
DIST_TRACKED_AGGREGATE_SHA256_POST
DIST_ALL_FILE_COUNT_POST
DIST_ALL_TOTAL_BYTES_POST
DIST_ADDED_FILES
DIST_MODIFIED_FILES
DIST_DELETED_FILES
DIST_RENAMED_OR_HASH_CHUNK_DELTA
SOURCE_OR_PACKAGE_CHANGED=no
```

If the build changes anything outside `AdminPanel-Vue/dist/**`, M68 must stop and report BLOCK.

## 6. Path-Risk Scan

M68 must run a paths-only scan on generated `AdminPanel-Vue/dist/**` paths.

Required pattern:

```powershell
git ls-files --others --modified --cached --exclude-standard -- AdminPanel-Vue/dist |
  rg -i "(^|[\\/])(config\.env|LocalState|\.agent_board|DebugLog|logs|state|cache|image)([\\/]|$)|secret|token|credential|auth"
```

Review rules:

```text
OAuth/Auth frontend route asset names may be false positives.
config.env, LocalState, .agent_board, DebugLog, logs, state, cache, image private roots are blockers.
secret/token/credential path hits are blockers unless clearly false positive and reviewed.
Do not read file contents looking for secrets in M68 unless a path-risk hit requires a separate approved inspection.
```

## 7. Commit Policy

If M68 passes all gates:

```text
M68_MAY_STAGE_ADMINPANEL_DIST=yes
M68_MAY_STAGE_M68_RECEIPT_AND_TRACKER=yes
M68_MAY_COMMIT_AND_PUSH_TO_JENN_FORK=yes
UPSTREAM_PR_OPENED=no
```

M68 must stage only:

```text
AdminPanel-Vue/dist/**
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M68_ADMINPANEL_NORMAL_DIST_ARTIFACT_RECEIPT_20260622.md
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
```

M68 must not stage:

```text
config.env
.env
AdminPanel-Vue/src/**
AdminPanel-Vue/package.json
AdminPanel-Vue/package-lock.json
DebugLog/**
logs/**
state/**
cache/**
image/**
.tmp/**
LocalState/**
.agent_board/**
```

## 8. Rollback

Before commit:

```text
If M68 fails after build, stop and report exact dist changes.
Do not silently delete or restore dist files unless the cleanup target list is exact and under AdminPanel-Vue/dist.
```

After commit:

```text
Rollback is revert the M68 dist artifact commit.
Do not delete core source or untrack dist broadly.
```

## 9. Stop Conditions

M68 must stop if:

```text
build fails
vue-tsc fails
dist diff includes unexpected private/runtime paths
source/package files changed
config.env changed or would be staged
path-risk scan finds a real private root or secret/token/credential path
browser/static/prod server would be needed to explain the artifact diff
normal dist artifact review cannot be summarized clearly
```

## 10. M67 Validation

M67 validation is docs-only:

```text
TASKBOOK_ONLY=yes
BUILD_EXECUTED=no
DIST_MODIFIED=no
PRODUCTION_SERVER_STARTED=no
CONFIG_ENV_MODIFIED=no
UPSTREAM_PR_OPENED=no
```

Expected next action:

```text
Review M67, then explicitly authorize M68 actual normal dist artifact build if ready.
```

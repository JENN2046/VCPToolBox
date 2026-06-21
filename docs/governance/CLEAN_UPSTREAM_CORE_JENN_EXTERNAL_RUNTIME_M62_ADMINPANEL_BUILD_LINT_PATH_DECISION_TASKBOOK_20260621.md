# M62 AdminPanel Build / Lint Path Decision Taskbook

Date: 2026-06-21

Status: PASS_DECISION_TASKBOOK_NO_BUILD_NO_LINT_CLEANUP

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M59_ADMINPANEL_FRONTEND_ROUTE_NAV_STATIC_IMPLEMENTATION_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M60_ADMINPANEL_BUILD_DIST_DECISION_TASKBOOK_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M61_ADMINPANEL_NO_BUILD_ROUTE_SOURCE_VALIDATION_RECEIPT_20260621.md`
- `AdminPanel-Vue/package.json`

## 1. Scope

M62 is a decision taskbook only. It decides how to move past the M59/M61 source-level frontend proof without silently crossing build/dist or broad lint cleanup boundaries.

M62 does not:

```text
run npm run build --prefix AdminPanel-Vue
run npm run build:no-type-check --prefix AdminPanel-Vue
run npm run dev --prefix AdminPanel-Vue
run npm run preview --prefix AdminPanel-Vue
run npm run lint:fix --prefix AdminPanel-Vue
modify AdminPanel-Vue/src/**
modify AdminPanel-Vue/dist/**
modify package.json or lockfiles
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

## 2. Current Evidence

M59 source implementation:

```text
FRONTEND_ROUTE_NAV_IMPLEMENTED=yes
TARGETED_ESLINT_TOUCHED_FILES_PASS=yes
VUE_TSC_NO_EMIT_PASS=yes
ADMINPANEL_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
FULL_FRONTEND_LINT_PASS=no
FULL_FRONTEND_LINT_BLOCKED_BY_EXISTING_TYPOGRAPHY_BASELINE=yes
```

M61 no-build validation:

```text
NO_BUILD_ROUTE_SOURCE_VALIDATION_PASS=yes
TARGETED_ESLINT_TOUCHED_FILES_PASS=yes
VUE_TSC_NO_EMIT_PASS=yes
SECRET_ENV_AUTH_LOG_PRIVATE_DISPLAY_RISK_FOUND=no
ADMINPANEL_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
PRODUCTION_SERVER_STARTED=no
FRONTEND_DEV_OR_PREVIEW_SERVER_STARTED=no
```

Known constraint:

```text
AdminPanel-Vue/dist/** is preserved by default
no blanket dist ignore
normal Vite build may create or rewrite dist artifacts
full lint currently fails on pre-existing typography baseline outside M59 touched files
```

## 3. Options

| Option | Decision | Why |
| --- | --- | --- |
| Fix full typography baseline now | DEFERRED | Broad frontend hygiene change across unrelated files; useful but larger than AdminPanel route/nav gate. |
| Run temp outDir dry build now | BLOCKED_FOR_M62 | Still a build execution; M60 requires a separate explicit build gate and output/cleanup policy. |
| Run normal build and commit dist | BLOCKED_FOR_M62 | Would modify release-like artifacts under `AdminPanel-Vue/dist/**`; needs explicit dist artifact policy. |
| Skip build forever | REJECTED | Source route is validated, but build/browser proof may still be needed before operator-facing release. |
| Create next explicit build/lint authorization gate | SELECTED | Keeps speed while preserving the build/dist and broad-lint boundaries. |

## 4. Decision

M62 selects:

```text
NEXT_GATE=M63_ADMINPANEL_TEMP_OUTDIR_DRY_BUILD_AUTHORIZATION_TASKBOOK
```

M63 should be taskbook-only unless the operator explicitly authorizes a build command in the same turn.

M63 must choose one of:

```text
temp outDir dry build with cleanup, no AdminPanel-Vue/dist change
full typography baseline cleanup taskbook before any build
normal dist build gate with explicit dist commit/discard policy
```

M62 does not authorize any of those executions. It only records the path decision.

## 5. Temp OutDir Dry Build Gate Requirements

If later authorized, a temp outDir dry build gate must define:

```text
exact Vite command
temporary output directory inside workspace
cleanup method
confirmation that AdminPanel-Vue/dist/** remains unchanged
confirmation that package files and lockfiles remain unchanged
asset count and error summary
whether source maps are generated
whether any output path contains private/runtime content
rollback plan
```

Candidate command shape, not authorized by M62:

```powershell
npx vite build --outDir <workspace-temp-dir> --emptyOutDir
```

The future gate must not use a temp directory under:

```text
LocalState/**
.agent_board/**
DebugLog/**
logs/**
state/**
cache/**
image/**
AdminPanel-Vue/dist/**
```

## 6. Typography Baseline Cleanup Gate Requirements

If the operator chooses full lint cleanup first, create a separate milestone because it is broad.

That gate must:

```text
inventory existing typography failures
touch only the files required by typography guard
replace fixed font sizes with existing semantic tokens
avoid unrelated style refactors
run npm run lint:typography --prefix AdminPanel-Vue
run targeted follow-up checks
record before/after failure count
```

It must not:

```text
run lint:fix across the whole frontend
change visual layouts beyond typography token substitutions
run build/dist
touch config.env
```

## 7. Normal Dist Build Gate Requirements

If the operator chooses normal build, create a separate build artifact gate.

That gate must:

```text
state exact command: npm run build --prefix AdminPanel-Vue
record pre-build dist status
record post-build dist status
summarize dist file count and size delta
decide commit vs discard before running build
run browser/visual smoke only if separately authorized
avoid printing secrets
provide rollback by reverting or discarding generated dist changes
```

M62 does not authorize normal build or dist commit.

## 8. Stop Boundary

Automatic progression may continue through docs-only gates and no-build validation gates.

Automatic progression must stop before:

```text
running any build command
starting dev or preview server
starting production server
modifying AdminPanel-Vue/dist/**
running broad lint:fix
performing broad typography cleanup across unrelated files
opening upstream PR
```

Current stop reason after M62:

```text
next meaningful non-doc action is build execution or broad lint cleanup
both need explicit current-turn authorization
```

## 9. M62 Validation

M62 validation is docs-only:

```powershell
rg -n "PASS_DECISION_TASKBOOK_NO_BUILD_NO_LINT_CLEANUP|NEXT_GATE|M63|ADMINPANEL_BUILD_RUN|ADMINPANEL_DIST_MODIFIED|UPSTREAM_PR_OPENED|Stop Boundary" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M62_ADMINPANEL_BUILD_LINT_PATH_DECISION_TASKBOOK_20260621.md
rg -n "[ \t]+$" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M62_ADMINPANEL_BUILD_LINT_PATH_DECISION_TASKBOOK_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
git diff --check
```

M62 result:

```text
ADMINPANEL_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
FRONTEND_DEV_OR_PREVIEW_SERVER_STARTED=no
PRODUCTION_SERVER_STARTED=no
BROAD_LINT_FIX_RUN=no
TYPOGRAPHY_BASELINE_CLEANUP_EXECUTED=no
CONFIG_ENV_MODIFIED=no
UPSTREAM_PR_OPENED=no
```

## 10. Rollback

Rollback M62 by reverting the governance commit that adds:

```text
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M62_ADMINPANEL_BUILD_LINT_PATH_DECISION_TASKBOOK_20260621.md
tracker M62/S83 updates
```

No source, runtime, build, dist, or config rollback is required because M62 is docs-only.

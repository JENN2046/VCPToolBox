# M63 AdminPanel Temp OutDir Dry Build Authorization Taskbook

Date: 2026-06-21

Status: PASS_AUTHORIZATION_TASKBOOK_NO_BUILD_EXECUTED

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M60_ADMINPANEL_BUILD_DIST_DECISION_TASKBOOK_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M61_ADMINPANEL_NO_BUILD_ROUTE_SOURCE_VALIDATION_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M62_ADMINPANEL_BUILD_LINT_PATH_DECISION_TASKBOOK_20260621.md`
- `AdminPanel-Vue/package.json`
- `AdminPanel-Vue/vite.config.ts`

## 1. Scope

M63 is a taskbook-only authorization gate. It defines the exact future temp outDir dry-build command, the allowed temporary output path, the cleanup target, the no-dist proof, and the stop boundary.

M63 does not execute the build.

M63 does not:

```text
run vite build
run npm run build --prefix AdminPanel-Vue
run npm run build:no-type-check --prefix AdminPanel-Vue
run npm run dev --prefix AdminPanel-Vue
run npm run preview --prefix AdminPanel-Vue
modify AdminPanel-Vue/src/**
modify AdminPanel-Vue/dist/**
modify AdminPanel-Vue/package.json
modify AdminPanel-Vue/package-lock.json
modify config.env
start production server
start AdminPanel frontend server
call providers
write bridge/live external state
read LocalState/private content
read/checksum .agent_board/**
open upstream PR
```

## 2. Build Command To Authorize Later

Future actual dry-build execution must use the local Vite binary directly, with an explicit temp outDir override. It must not use the package `build` script because that script targets the configured production build path unless every output option is reviewed first.

Exact future command, not authorized by M63:

```powershell
& { Push-Location "A:\AGENTS_OS_Workspace\runtime\VCPToolBox\AdminPanel-Vue"; $env:ANALYZE = "false"; .\node_modules\.bin\vite.cmd build --mode production --outDir "..\.tmp\m63-adminpanel-dry-build\dist" --emptyOutDir; $code = $LASTEXITCODE; Pop-Location; exit $code }
```

Expected workdir during Vite execution:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\AdminPanel-Vue
```

Allowed temporary output directory:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\.tmp\m63-adminpanel-dry-build\dist
```

Cleanup target after inspection:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\.tmp\m63-adminpanel-dry-build
```

Cleanup is not authorized by M63. A future execution gate must verify the resolved cleanup target is inside:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\.tmp\
```

and is exactly the M63 run directory before any recursive cleanup is considered.

## 3. Forbidden Output Targets

The future dry build must not write to:

```text
AdminPanel-Vue/dist/**
LocalState/**
.agent_board/**
DebugLog/**
logs/**
state/**
cache/**
image/**
Plugin/**
Agent/**
AgentOverrides/**
VCPToolBox-JENN-Extensions/**
```

The future dry build must stop before execution if the chosen outDir resolves to any forbidden path or outside the workspace.

## 4. Preflight Required Before Future Execution

Future execution must record these checks before running the build command:

```powershell
git status --short -- AdminPanel-Vue/dist AdminPanel-Vue/src AdminPanel-Vue/package.json AdminPanel-Vue/package-lock.json
git diff --name-only -- AdminPanel-Vue/dist AdminPanel-Vue/src AdminPanel-Vue/package.json AdminPanel-Vue/package-lock.json
Test-Path "A:\AGENTS_OS_Workspace\runtime\VCPToolBox\.tmp\m63-adminpanel-dry-build"
```

Required preflight result:

```text
ADMINPANEL_DIST_PRE_STATUS_CLEAN=yes
ADMINPANEL_SRC_PRE_STATUS_CLEAN=yes
PACKAGE_FILES_PRE_STATUS_CLEAN=yes
TEMP_OUTDIR_PRE_EXISTS=no or explicitly reviewed stale temp directory
```

If stale temp output exists, the future gate must stop and decide whether to inspect or clean it. M63 does not authorize cleanup.

## 5. No-Dist Proof Required After Future Execution

Future execution must prove `AdminPanel-Vue/dist/**` did not change:

```powershell
git status --short -- AdminPanel-Vue/dist
git diff --name-only -- AdminPanel-Vue/dist
git diff --stat -- AdminPanel-Vue/dist
```

Required result:

```text
ADMINPANEL_DIST_STATUS_AFTER_BUILD_CLEAN=yes
ADMINPANEL_DIST_DIFF_AFTER_BUILD_EMPTY=yes
ADMINPANEL_DIST_MODIFIED=no
```

The future gate must also prove source and package files stayed unchanged:

```powershell
git status --short -- AdminPanel-Vue/src AdminPanel-Vue/package.json AdminPanel-Vue/package-lock.json
git diff --name-only -- AdminPanel-Vue/src AdminPanel-Vue/package.json AdminPanel-Vue/package-lock.json
```

Required result:

```text
ADMINPANEL_SRC_MODIFIED=no
ADMINPANEL_PACKAGE_FILES_MODIFIED=no
```

## 6. Temp Output Evidence Required After Future Execution

Future execution must inspect only generated temp output paths and counts:

```powershell
Test-Path "A:\AGENTS_OS_Workspace\runtime\VCPToolBox\.tmp\m63-adminpanel-dry-build\dist\index.html"
Get-ChildItem -LiteralPath "A:\AGENTS_OS_Workspace\runtime\VCPToolBox\.tmp\m63-adminpanel-dry-build\dist" -Recurse -File | Measure-Object
Get-ChildItem -LiteralPath "A:\AGENTS_OS_Workspace\runtime\VCPToolBox\.tmp\m63-adminpanel-dry-build\dist" -Recurse -File | Select-Object -ExpandProperty FullName | rg "config\.env|LocalState|\.agent_board|DebugLog|logs|state|cache|image|secret|token|credential|auth"
```

Required result:

```text
TEMP_DIST_INDEX_EXISTS=yes
TEMP_DIST_FILE_COUNT_RECORDED=yes
TEMP_OUTPUT_PRIVATE_PATH_RISK_FOUND=no
```

The path-risk scan is paths-only. It must not read LocalState/private content or `.agent_board/**`.

## 7. Cleanup Policy

Future cleanup may target only:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\.tmp\m63-adminpanel-dry-build
```

Cleanup must not target:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\AdminPanel-Vue\dist
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\AdminPanel-Vue
A:\AGENTS_OS_Workspace\runtime\VCPToolBox
any path outside A:\AGENTS_OS_Workspace\runtime\VCPToolBox\.tmp\
```

Because cleanup is destructive, a future gate must state the exact resolved path, confirm it is inside the allowed cleanup root, and record the cleanup result. M63 itself does not run cleanup.

## 8. Authorization Boundary

Future actual dry-build execution requires explicit current-turn authorization.

Acceptable authorization must name the action plainly, for example:

```text
授权执行 M64 AdminPanel temp outDir dry build
```

Generic continuation phrases are not enough:

```text
继续
自动推进
go ahead
do it
```

Those phrases may continue docs-only planning, but they do not authorize build execution or recursive cleanup.

## 9. Stop Conditions

Future execution must stop before running the build if:

```text
the operator has not explicitly authorized M64 actual temp outDir dry build
AdminPanel-Vue/dist has pre-existing uncommitted changes
AdminPanel-Vue/src has unrelated uncommitted changes
package or lock files have uncommitted changes
the temp outDir resolves under AdminPanel-Vue/dist
the temp outDir resolves outside the workspace
the temp outDir resolves under LocalState, .agent_board, DebugLog, logs, state, cache, image, Plugin, Agent, or AgentOverrides
cleanup would require deleting anything except the exact M63 temp run directory
the build command attempts to start dev, preview, or production server
the build command attempts provider, bridge, live external write, or secret access
```

Future execution must stop after the build and before cleanup if:

```text
AdminPanel-Vue/dist changed
AdminPanel-Vue/src changed
package files changed
temp output paths contain private/runtime path risk
cleanup target cannot be resolved safely
```

## 10. M63 Validation

M63 validation is docs-only:

```powershell
rg -n "PASS_AUTHORIZATION_TASKBOOK_NO_BUILD_EXECUTED|vite.cmd build|m63-adminpanel-dry-build|ADMINPANEL_DIST_MODIFIED|Authorization Boundary|Stop Conditions|M64" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M63_ADMINPANEL_TEMP_OUTDIR_DRY_BUILD_AUTHORIZATION_TASKBOOK_20260621.md
rg -n "[ \t]+$" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M63_ADMINPANEL_TEMP_OUTDIR_DRY_BUILD_AUTHORIZATION_TASKBOOK_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
git diff --check
```

M63 result:

```text
ADMINPANEL_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
FRONTEND_DEV_OR_PREVIEW_SERVER_STARTED=no
PRODUCTION_SERVER_STARTED=no
TEMP_OUTDIR_CREATED=no
TEMP_OUTDIR_CLEANUP_RUN=no
CONFIG_ENV_MODIFIED=no
UPSTREAM_PR_OPENED=no
```

## 11. Rollback

Rollback M63 by reverting the governance commit that adds:

```text
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M63_ADMINPANEL_TEMP_OUTDIR_DRY_BUILD_AUTHORIZATION_TASKBOOK_20260621.md
tracker M63/S84 updates
```

No source, runtime, build, dist, temp output, or config rollback is required because M63 is docs-only.

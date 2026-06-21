# M65 AdminPanel Browser Visual Smoke Taskbook

Date: 2026-06-21

Status: PASS_TASKBOOK_ONLY_NO_BROWSER_NO_SERVER

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M58_ADMINPANEL_FRONTEND_ROUTE_NAV_TASKBOOK_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M59_ADMINPANEL_FRONTEND_ROUTE_NAV_STATIC_IMPLEMENTATION_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M63_ADMINPANEL_TEMP_OUTDIR_DRY_BUILD_AUTHORIZATION_TASKBOOK_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M64_ADMINPANEL_TEMP_OUTDIR_DRY_BUILD_RECEIPT_20260621.md`

## 1. Scope

M65 defines the browser visual smoke gate for the reviewed static AdminPanel route/nav entry.

M65 is taskbook-only.

M65 does not:

```text
run Vite build
run npm run build --prefix AdminPanel-Vue
run npm run dev --prefix AdminPanel-Vue
run npm run preview --prefix AdminPanel-Vue
start production server
start a static file server
open a browser
run Playwright
modify AdminPanel-Vue/src/**
modify AdminPanel-Vue/dist/**
modify config.env
read LocalState/private content
read/checksum .agent_board/**
call providers
write bridge/live external state
open upstream PR
```

## 2. Decision

M65 selects browser visual smoke before normal `AdminPanel-Vue/dist/**` artifact gate.

Reason:

```text
M64 proved the current source can build into a temporary outDir without modifying tracked dist.
The next useful risk reduction is confirming that the reviewed route/nav page renders in a browser-like runtime.
Normal release artifact build can remain deferred until the visual smoke confirms the user-facing page shape.
```

Selected next gate:

```text
NEXT_GATE=M66_ADMINPANEL_BROWSER_VISUAL_SMOKE_EXECUTION_GATE
```

M66 must still require explicit current-turn authorization before starting a local static server or browser.

## 3. Target Page

Reviewed route:

```text
route id: jenn-admin-status
route path: /jenn-admin-status
router base: /AdminPanel/
visual target URL path: /AdminPanel/jenn-admin-status
source view: AdminPanel-Vue/src/views/JennAdminStatusView.vue
source route manifest: AdminPanel-Vue/src/app/routes/manifest.ts
source component map: AdminPanel-Vue/src/app/routes/components.ts
```

Expected visible text / UI anchors:

```text
Jenn Admin Status
Reviewed AdminPanel extension route, registered as a static frontend entry.
jenn.admin.status
/admin_api/jenn-admin-status/status
Backend route
Runtime mode
read-only
```

Expected icon:

```text
monitor_heart
```

## 4. Preferred M66 Execution Shape

M66 should use the same temporary build principle as M64, but with a distinct run directory:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\.tmp\m65-adminpanel-visual-smoke\dist
```

Preferred future sequence:

```text
1. Preflight Git status for AdminPanel-Vue/dist, AdminPanel-Vue/src, package files, and .tmp/m65-adminpanel-visual-smoke.
2. Run an authorized Vite temp outDir build into .tmp/m65-adminpanel-visual-smoke/dist.
3. Run the corrected case-insensitive/bracket-pattern path-risk scan on the temp dist paths.
4. Start a local read-only static file server rooted at .tmp/m65-adminpanel-visual-smoke/dist.
5. Open only the local visual target URL in a browser automation tool.
6. Capture desktop and mobile screenshots.
7. Verify route text anchors and no obvious blank/404/misroute state.
8. Stop the static server by PID.
9. Clean only .tmp/m65-adminpanel-visual-smoke after resolving the exact path.
10. Prove AdminPanel-Vue/dist, source, package files, config.env, and runtime private paths remained unchanged.
```

M66 should not use `npm run dev`, `npm run preview`, or `node server.js` unless a later taskbook explicitly changes this decision.

## 5. Future Browser Checks

Future M66 browser checks should include:

```text
DESKTOP_VIEWPORT=1365x900
MOBILE_VIEWPORT=390x844
TARGET_PATH=/AdminPanel/jenn-admin-status
PAGE_NOT_BLANK=yes
ROUTE_NOT_404=yes
JENN_ADMIN_STATUS_TEXT_VISIBLE=yes
MONITOR_HEART_ICON_VISIBLE=yes
NO_SECRET_ENV_AUTH_VALUE_VISIBLE=yes
NO_LOCALSTATE_PRIVATE_TEXT_VISIBLE=yes
NO_AGENT_BOARD_TEXT_VISIBLE=yes
```

The future check must not require live backend data. The page is a static status surface and can be validated without calling `/admin_api/jenn-admin-status/status`.

## 6. Screenshot Policy

Future screenshots may be saved only under:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\.tmp\m65-adminpanel-visual-smoke\screenshots
```

They must be cleaned after metadata is recorded unless the operator explicitly asks to keep screenshot artifacts.

Receipt evidence should record only:

```text
screenshot file names
viewport sizes
image dimensions
basic nonblank / text-visible result
cleanup result
```

Do not commit screenshots unless a later explicit artifact policy authorizes it.

## 7. Stop Conditions

Future M66 must stop before execution if:

```text
there is no explicit current-turn authorization for browser visual smoke execution
AdminPanel-Vue/dist has uncommitted changes
AdminPanel-Vue/src has unrelated uncommitted changes
package files have uncommitted changes
the temporary output or screenshot directory resolves outside workspace .tmp
the static server would serve repository root or AdminPanel-Vue/dist
the browser target is not localhost/127.0.0.1
the flow would require real provider calls, bridge writes, LocalState/private reads, or .agent_board reads
```

Future M66 must stop after execution and before cleanup if:

```text
AdminPanel-Vue/dist changed
AdminPanel-Vue/src changed
package files changed
config.env changed
the static server PID cannot be identified
cleanup target cannot be resolved exactly under .tmp/m65-adminpanel-visual-smoke
```

## 8. M65 Validation

M65 validation is docs-only:

```powershell
rg -n "PASS_TASKBOOK_ONLY_NO_BROWSER_NO_SERVER|NEXT_GATE|M66|m65-adminpanel-visual-smoke|/AdminPanel/jenn-admin-status|NO_SECRET_ENV_AUTH_VALUE_VISIBLE|Stop Conditions" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M65_ADMINPANEL_BROWSER_VISUAL_SMOKE_TASKBOOK_20260621.md
rg -n "[ \t]+$" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M64_ADMINPANEL_TEMP_OUTDIR_DRY_BUILD_RECEIPT_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M65_ADMINPANEL_BROWSER_VISUAL_SMOKE_TASKBOOK_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
git diff --check
```

M65 result:

```text
BROWSER_VISUAL_SMOKE_TASKBOOK_READY=yes
BROWSER_OPENED=no
STATIC_SERVER_STARTED=no
VITE_BUILD_RUN=no
ADMINPANEL_DIST_MODIFIED=no
SCREENSHOTS_CREATED=no
CONFIG_ENV_MODIFIED=no
UPSTREAM_PR_OPENED=no
```

## 9. Rollback

Rollback M65 by reverting the governance commit that adds:

```text
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M65_ADMINPANEL_BROWSER_VISUAL_SMOKE_TASKBOOK_20260621.md
M64 evidence-fix receipt wording
tracker M65/S86 updates
```

No runtime, browser, build, dist, temp output, screenshot, or config rollback is required because M65 is docs-only.

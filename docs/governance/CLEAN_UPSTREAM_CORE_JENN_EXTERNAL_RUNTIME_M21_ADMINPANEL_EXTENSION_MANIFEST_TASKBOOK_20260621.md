# M21 AdminPanel Extension Manifest Taskbook

Date: 2026-06-21

Status: TASKBOOK_READY_NO_ADMIN_RUNTIME_CHANGE

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Source contract:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M5_AGENT_LOCALSTATE_ADMIN_CONTRACTS_20260621.md`

## 1. Purpose

M21 defines the manifest route for future AdminPanel extensions.

This taskbook does not create an AdminPanel extension package, modify `routes/adminPanelRoutes.js`, modify `AdminPanel-Vue`, register routes, run frontend builds, deploy, or enable runtime behavior.

## 2. Current AdminPanel Observations

Read-only source inspection:

```text
routes/adminPanelRoutes.js
AdminPanel-Vue/src/app/routes/manifest.ts
AdminPanel-Vue/src/app/routes/base.ts
AdminPanel-Vue/src/components/layout/Sidebar.vue
AdminPanel-Vue/package.json
```

Observed backend pattern:

```text
routes/adminPanelRoutes.js creates adminApiRouter.
Existing backend admin modules live under routes/admin/*.js.
Most modules are mounted flat with mount("/", "<moduleName>").
Admin APIs are exposed under /admin_api by the server mounting layer.
```

Observed frontend pattern:

```text
APP_ROUTE_MANIFEST declares route metadata.
buildSidebarNavItems() derives sidebar navigation from the route manifest.
Sidebar.vue renders appStore.navItems and plugin-derived pinned/search entries.
AdminPanel build script is npm run build under AdminPanel-Vue.
```

## 3. Future Env Contract

Future AdminPanel extension discovery may use:

```text
VCP_ADMIN_EXTENSION_DIRS
```

Rules:

- If unset, current AdminPanel behavior remains unchanged.
- Extension directories require an explicit allowed root contract before runtime registration.
- Extension discovery must be separate from route/API/sidebar registration.
- Registration must be default-off until a reviewed manifest and validation pass.
- LocalState, `.agent_board/**`, plugin runtime roots, Agent roots, and private state roots must not be AdminPanel extension roots.

## 4. Proposed External Package Shape

Future package shape:

```text
AdminExtensions/
  <ExtensionName>/
    admin-extension-manifest.json
    README.AGENTS_OS.md
    backend/
      routes/
    frontend/
      routes/
      views/
      menu/
    tests/
```

M21 does not create this shape. M22 may create a fixture/skeleton only after this taskbook passes.

## 5. Manifest Schema Draft

`admin-extension-manifest.json` should be JSON and contain only metadata and relative paths:

```json
{
  "schemaVersion": 1,
  "extensionId": "jenn.example.admin-extension",
  "displayName": "Jenn Example Admin Extension",
  "description": "Reviewed AdminPanel extension fixture.",
  "defaultEnabled": false,
  "backend": {
    "routes": [
      {
        "routeId": "jenn-example-status",
        "mountPath": "/jenn-example",
        "module": "backend/routes/status.js",
        "methods": ["GET"],
        "requiresAuth": true,
        "writeCapable": false
      }
    ]
  },
  "frontend": {
    "routes": [
      {
        "routeId": "jenn-example-view",
        "routeName": "JennExampleView",
        "path": "/jenn-example",
        "title": "Jenn Example",
        "icon": "extension",
        "navGroup": "toolsPlugins",
        "component": "frontend/views/JennExampleView.vue",
        "showInSidebar": true,
        "requiresAuth": true
      }
    ]
  },
  "permissions": {
    "adminApi": ["read:jenn-example-status"],
    "externalWrites": false,
    "providerCalls": false,
    "bridgeCalls": false
  }
}
```

## 6. Manifest Rules

Required:

- `extensionId` must be stable, unique, and exact-match scoped.
- `defaultEnabled` must be `false`.
- all paths must be relative to the extension root;
- no `..` path escapes;
- `mountPath` must be under a reviewed Admin extension namespace;
- route ids and menu ids must be unique;
- backend routes must declare methods and write capability;
- frontend routes must declare auth and sidebar behavior;
- external write / provider / bridge capabilities must be explicit and default false.

Forbidden:

- absolute local paths;
- `.env`, `config.env`, tokens, credentials, auth material, or provider config;
- LocalState, `.agent_board/**`, cache, logs, outputs, DB/vector stores, image outputs, private/operator data;
- route registration that bypasses current auth;
- default-enabled extension activation;
- production build/deploy as validation for M21;
- broad wildcard extension discovery or registration.

## 7. M22 Fixture / Shadow Validation Plan

M22 may create a fixture/skeleton package only if:

```text
M21 is PASS
core worktree is clean or accounted
fixture target is inside reviewed external package root
manifest paths are relative and do not escape root
paths-only risk scan is clean
no real AdminPanel route is registered
no production build/deploy is run
no provider/bridge/live external write is executed
```

M22 validation should be fixture-only:

- parse manifest JSON;
- validate schema-required fields;
- reject path escapes;
- reject blocked LocalState / `.agent_board/**` / secret/runtime paths;
- optionally run static frontend fixture validation without modifying `AdminPanel-Vue`;
- verify rollback by removing or ignoring the fixture package, not by changing core AdminPanel.

## 8. Stop Conditions

Stop and mark BLOCK if future work requires:

- modifying `routes/adminPanelRoutes.js` before manifest schema and fixture validation pass;
- modifying `AdminPanel-Vue/src/app/routes/manifest.ts` before an extension registration contract exists;
- running `npm run build` as production validation;
- writing AdminPanel dist artifacts;
- registering a real route in core;
- bypassing admin auth;
- reading LocalState/private/operator data;
- touching `.agent_board/**`;
- modifying `.env`, secrets, tokens, credentials, or auth material;
- provider calls, bridge calls, live external writes, deploys, or releases.

## 9. Rollback

M21 rollback:

```text
revert this taskbook and the tracker M21/S42 update
```

Future M22 rollback:

```text
remove only reviewed fixture/skeleton files after verifying the target path is inside the approved AdminExtensions fixture root
do not modify core AdminPanel routes or frontend route manifest as rollback
do not delete LocalState, .agent_board/**, secrets, runtime data, or dist artifacts
```

## 10. Safety Confirmations

```text
AdminPanel backend route modified: no
AdminPanel frontend route manifest modified: no
AdminPanel build run: no
AdminPanel dist modified: no
Admin extension package created: no
Real VCP_ADMIN_EXTENSION_DIRS activated: no
LocalState content read/copied: no
.agent_board content read/copied/checksummed/migrated: no
Provider call executed: no
Bridge call executed: no
Production deploy/service startup executed: no
Live external write executed: no
Upstream PR opened: no
```

## 11. Validation

M21 validation is documentation-only:

```powershell
git diff --check
rg -n "TASKBOOK_READY_NO_ADMIN_RUNTIME_CHANGE|VCP_ADMIN_EXTENSION_DIRS|admin-extension-manifest\\.json|defaultEnabled|M22 Fixture|AdminPanel build run: no|Real VCP_ADMIN_EXTENSION_DIRS activated: no|Upstream PR opened: no" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M21_ADMINPANEL_EXTENSION_MANIFEST_TASKBOOK_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
git status --short --branch
```

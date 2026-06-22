# M90 AdminPanel Page / API Extensionization Taskbook

Date: 2026-06-22

Status: TASKBOOK_PASS_NO_IMPLEMENTATION

Parent gap matrix: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M86_EXTRACTION_GAP_MATRIX_20260622.md`

Parent validation: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M89_PLUGIN_SHADOW_DEFAULT_OFF_VALIDATION_RECEIPT_20260622.md`

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Purpose

M90 opens the AdminPanel page/API extensionization lane after M89 proves the plugin package wave remains default-off.

This is a taskbook-only gate. It defines the next safe steps for moving the original planned AdminPanel page/API content toward the external package model.

M90 does not copy AdminPanel source, implement dynamic frontend loading, modify build artifacts, start production server, or write real config.

## 2. Naming Decision

The original extraction architecture plan names:

```text
AdminPanelExtensions/
```

Current Jenn external package and existing contracts use:

```text
AdminExtensions/
VCP_ADMIN_EXTENSION_DIRS
```

M90 decision:

```text
ADMIN_EXTENSION_PACKAGE_DIR=AdminExtensions/
ADMIN_EXTENSION_ENV_KEY=VCP_ADMIN_EXTENSION_DIRS
ADMINPANEL_EXTENSIONS_ALIAS_NOW=no
```

Reason:

- M31 already created a persistent package under `AdminExtensions/JennAdminStatus/`;
- M48-M70 already validated AdminPanel backend/frontend/default-off/artifact gates against the current `AdminExtensions/` contract;
- renaming or aliasing would be a separate migration decision and is not required for the next low-risk page/API extensionization lane.

## 3. Candidate Source Files

The M90 candidate set is the original planned AdminPanel page/API list from `01-extraction-architecture-plan.md` and M86.

Views:

```text
AdminPanel-Vue/src/views/AiImageAgents.vue
AdminPanel-Vue/src/views/ChannelHubManager.vue
AdminPanel-Vue/src/views/CodexImagegenRelay.vue
AdminPanel-Vue/src/views/CodexMemoryMonitor.vue
AdminPanel-Vue/src/views/OAuthAuthCenter.vue
```

API modules:

```text
AdminPanel-Vue/src/api/aiImageAgents.ts
AdminPanel-Vue/src/api/channelHub.ts
AdminPanel-Vue/src/api/codexImagegenRelay.ts
AdminPanel-Vue/src/api/codexMemory.ts
AdminPanel-Vue/src/api/oauthAuth.ts
```

Core patch keep-list stays in core:

```text
AdminPanel-Vue/src/api/index.ts
AdminPanel-Vue/src/app/routes/manifest.ts
AdminPanel-Vue/src/app/routes/components.ts
```

The keep-list may later become a small loader/registry patch, but M90 does not modify it.

## 4. Target Package Shape

Future external page/API package candidates should use one package per functional page group:

```text
AdminExtensions/AiImageAgents/
  admin-extension-manifest.json
  frontend/views/AiImageAgents.vue
  frontend/api/aiImageAgents.ts

AdminExtensions/ChannelHub/
  admin-extension-manifest.json
  frontend/views/ChannelHubManager.vue
  frontend/api/channelHub.ts

AdminExtensions/CodexImagegenRelay/
  admin-extension-manifest.json
  frontend/views/CodexImagegenRelay.vue
  frontend/api/codexImagegenRelay.ts

AdminExtensions/CodexMemoryMonitor/
  admin-extension-manifest.json
  frontend/views/CodexMemoryMonitor.vue
  frontend/api/codexMemory.ts

AdminExtensions/OAuthAuthCenter/
  admin-extension-manifest.json
  frontend/views/OAuthAuthCenter.vue
  frontend/api/oauthAuth.ts
```

Each manifest must be metadata only until a later runtime gate. It may include:

```text
id
displayName
description
frontend.view
frontend.api
routeName
menuGroup
defaultEnabled=false
sourcePackage=AdminExtensions
```

It must not include:

```text
secret values
tokens
provider keys
OAuth client secrets
absolute private paths
runtime write targets
live endpoint credentials
```

## 5. Allowed And Forbidden Frontend Surface

Allowed in future copy-first package content:

- Vue component source for the five candidate pages;
- TypeScript API wrapper source for the five paired modules;
- readonly metadata needed for menus, route labels, icon names, and route names;
- sanitized placeholder strings that already exist in the core source.

Forbidden in this lane:

- `AdminPanel-Vue/dist/**` build artifact changes unless a later artifact gate explicitly authorizes them;
- dynamic import from arbitrary external absolute paths;
- displaying secret, token, password, credential, OAuth secret, provider key, or raw auth material;
- writing external AdminPanel content from Admin UI;
- reading LocalState/private/operator/project data;
- calling real providers, bridges, live writes, sync, publish, or deployment endpoints;
- modifying production server startup behavior.

## 6. Execution Order

M91: source path scan and package skeleton decision.

- Confirm the ten candidate source files still exist.
- Run paths-only secret-risk scan over candidate paths and target package names.
- Confirm no `dist/**`, LocalState/private, `.agent_board/**`, env, token, credential, generated output, DB/vector/cache/log path is in scope.
- Decide exact future copy groups and any group that must be blocked or split.
- No content copy.

M92: external target skeleton.

- Create empty metadata-only package skeletons in external `AdminExtensions/`.
- Add README and `admin-extension-manifest.json` placeholders only.
- Regenerate external manifest checksum.
- No copied Vue/API source yet.
- No runtime/env enablement.

M93: reviewed content copy-first.

- Copy only M91-approved view/API source into the M92 skeletons.
- Run target path-risk scan, manifest checksum verification, and source-display secret scan.
- No dynamic runtime loader.
- No core deletion/stub/untrack.

M94: default-off metadata registry taskbook or implementation gate.

- If M93 passes, decide whether to expose package metadata to existing AdminPanel route/nav through a default-off registry.
- Metadata-only means route labels and package status only; no external Vue execution from disk.
- Real `config.env` write still requires separate explicit authorization.

M95+: runtime or artifact gates, only if separately authorized.

- Dynamic frontend extension runtime, production build/dist artifact updates, production server smoke, and real config persistent enablement remain future gates.

## 7. Validation Required Per Future Gate

Minimum validation for M91:

```text
git status --short
candidate source existence check
candidate source paths-only risk scan
target package paths-only risk scan
no dist/private/env/auth path proof
```

Minimum validation for M92:

```text
external git status --short
target skeleton path-risk scan
manifest checksum regenerate and verify
git diff --check
```

Minimum validation for M93:

```text
external target path-risk scan
external manifest checksum verify
display/auth/token/secret field scan over copied source
git diff --check
targeted AdminPanel source checks only if core source changed
```

Build, browser visual smoke, production server smoke, and normal `dist/**` updates are not part of M91-M93.

## 8. Rollback

Future rollback must be simple and scoped:

- M91 rollback: revert taskbook/decision docs only.
- M92 rollback: revert external skeleton commit and regenerated manifest.
- M93 rollback: revert external content copy commit and regenerated manifest.
- M94 rollback: remove scoped env or default-off registry change by reverting its narrow commit.

Rollback must not delete LocalState/private data, `.agent_board/**`, real config files, or core AdminPanel fallback files.

## 9. Stop Conditions

Stop before implementation if any candidate file path or target path matches:

```text
.env
config.env
LocalState
.agent_board
state
cache
log
image output
database
sqlite
vector store
AdminPanel-Vue/dist
```

Treat these content or path keyword hits as `REVIEW_REQUIRED` first, and then `BLOCK` unless the receipt explains why the hit is a known AdminPanel surface name rather than value-bearing secret material:

```text
secret
token
credential
password
auth
oauth
provider key
```

`OAuthAuthCenter.vue` and `oauthAuth.ts` are named source candidates, so their `auth/oauth` path hits are expected review items, not automatic PASS. M91/M93 must still block them if source review finds a value-bearing secret/token credential, real provider key, raw OAuth secret, or private operator data.

Stop before runtime if the next step would require dynamic external Vue execution, production router changes, production server startup, real `config.env` writes, build artifact updates, or external live writes without a separate gate and explicit authorization.

## 10. M90 Decision

M90 is PASS as a taskbook-only gate.

Next safe action:

```text
M91_ADMINPANEL_PAGE_API_SOURCE_SCAN_AND_SKELETON_DECISION
```

M91 should only perform source path scan, target skeleton decision, and blocker classification. It must not copy page/API content or enable runtime.

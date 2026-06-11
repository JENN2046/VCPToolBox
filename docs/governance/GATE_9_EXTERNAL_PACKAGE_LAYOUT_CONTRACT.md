# Gate 9 External Package Layout Contract

**Status:** Gate 9 Slice 001 docs-only contract.
**Date:** 2026-06-12
**Scope:** external Jenn package layout boundary for future reviewed implementation.

This document formalizes the external package layout contract for the next phase of the
upstream-compatible Jenn adapter layer. It does not create external packages, move plugins, enable
new loaders, run Plugin Store installs, or change runtime behavior.

## Purpose

Gate 9 defines the package boundary for future Jenn-specific extension extraction after:

- Gate 6 sealed Jenn AI image fixture and native delegate binding data splits.
- Gate 7 sealed native Doubao metadata defaults split.
- Gate 8 sealed the Jenn adapter root contract around `VCP_PLUGIN_DIRS`,
  `VCP_PLUGIN_ALLOWED_ROOTS`, and `VCP_PLUGIN_INSTALL_DIR`.

The contract keeps core VCPToolBox thin and stable while making future Jenn packages reviewable,
default-off, allowlist-gated, and reversible.

## Scope

This contract covers the intended layout and boundaries for:

- `VCPToolBox-JENN-Extensions`
- `VCPToolBox-JENN-LocalState`

It classifies current repository surfaces into core runtime, future external plugin runtime assets,
local private state, generated artifacts, and governance docs. It is a planning checkpoint only.

## External Package Boundary

`VCPToolBox-JENN-Extensions` and `VCPToolBox-JENN-LocalState` are separate concepts:

- `VCPToolBox-JENN-Extensions` is for executable Jenn plugin/runtime assets only.
- `VCPToolBox-JENN-LocalState` is for private operator state only and must not be treated as plugin
  code by default.

The existence of either package name must not grant runtime permission. Future runtime use must
still require explicit `VCP_PLUGIN_DIRS` and `VCP_PLUGIN_ALLOWED_ROOTS` configuration, and future
Plugin Store external install use must still require `VCP_PLUGIN_INSTALL_DIR` to match a current
allowlisted external legacy root.

## VCPToolBox-JENN-Extensions Proposed Contract

Purpose:

- Host executable Jenn-specific legacy plugin folders that remain compatible with the existing
  `Plugin/<pluginName>/plugin-manifest.json` shape.
- Provide non-secret examples, package docs, and package-local tests or fixtures for future review.

Suggested layout:

```text
VCPToolBox-JENN-Extensions/
  README.md
  docs/
  Plugin/
    <JennPluginName>/
      plugin-manifest.json
      ...
  tests/
    fixtures/
  env-examples/
```

Rules:

- Plugin folders must remain self-contained legacy plugin assets.
- Real `config.env`, `.env`, tokens, cookies, API keys, auth codes, local databases, logs, caches,
  and operator data must not be committed.
- External plugin-specific `config.env` loading remains suppressed by the current external root
  contract unless a later approved slice changes that behavior.
- External duplicate plugin names must not override core plugin names.
- Any future package smoke test should use a temporary fixture root and must not migrate real
  plugins.

## VCPToolBox-JENN-LocalState Proposed Contract

Purpose:

- Hold private local/operator state outside core source control after a future state-specific
  review.
- Separate local state from executable plugin code.

Suggested layout:

```text
VCPToolBox-JENN-LocalState/
  README.local.example.md
  config/
  data/
  logs/
  cache/
  exports/
  backups/
  receipts/
```

Rules:

- This package is not a plugin root by default.
- It must not be included in `VCP_PLUGIN_DIRS` as part of the first implementation slice.
- It should be gitignored/private by default.
- No live state, secrets, generated images, SQLite/vector stores, logs, or operator data may be
  copied without a separate LocalState inventory, backup, dry-run, and rollback plan.

## Classification Table

| Class | Examples | Target | First-slice stance |
| --- | --- | --- | --- |
| Core runtime | `Plugin.js`, `server.js`, `routes/admin/plugins.js`, `routes/admin/pluginStore.js`, `modules/pluginRootResolver.js`, root `package.json` | Core repo | Keep in core |
| External plugin runtime assets | `Plugin/PhotoStudio*`, `Plugin/AIGent*`, `Plugin/CodexMemoryBridge`, `Plugin/ImageAutoRegister`, `Plugin/ImageRatingManager` | `VCPToolBox-JENN-Extensions/Plugin/` later | Candidate only |
| Local private state | real `config.env`, `.env`, plugin private config, logs, cache, SQLite/vector stores, generated images, operator data | `VCPToolBox-JENN-LocalState/` later | Do not move |
| Generated artifacts | `ToolConfigs/dynamic_tool_catalog.json`, `ToolConfigs/dynamic_tool_categories.json`, debug logs, generated reports | Deferred | Separate rebuild/compatibility policy required |
| Governance docs | `docs/governance/*`, migration receipts, layout specs | Core docs now; package docs later | Docs-only |

## Candidate Future Migrations

Low-to-medium risk candidates after a dedicated migration design:

- `Plugin/PhotoStudio*` family as photography workflow plugin assets.
- `Plugin/AIGent*` family as AI image agent plugin assets.
- `Plugin/ImageAutoRegister`.
- `Plugin/ImageRatingManager`.
- `Plugin/CodexMemoryBridge`, only after a Codex memory boundary review.

Higher-risk or deferred candidates:

- `Plugin/DingTalkCLI` and `Plugin/DingTalkTable`, because they are connected to live-service write
  boundaries and gray-stage behavior.
- Generated `ToolConfigs/*`, because relocation may require controlled catalog rebuilds.
- `plugins/custom/shared/photo_studio_data`, because shared Photo Studio data needs a LocalState
  policy before movement.

## Items To Keep In Core For Now

- `Plugin.js`
- `server.js`
- `routes/admin/plugins.js`
- `routes/admin/pluginStore.js`
- `modules/pluginRootResolver.js`
- `scripts/check-prod-baseline.js`
- test suites that guard plugin root behavior
- root `package.json`
- Admin UI and Plugin Store behavior
- `plugins/registry.json` and current modern plugin registry behavior
- governance documents that define and guard the transition

Core keeps the resolver, watcher, Admin, Store, install, redaction, containment, and duplicate-name
contracts until a later task explicitly changes them.

## Explicit Non-Goals

- No external package creation.
- No plugin migration.
- No file moves.
- No `Plugin.js` behavior change.
- No `server.js` behavior change.
- No Admin route behavior change.
- No Plugin Store behavior change.
- No `modules/pluginRootResolver.js` change.
- No env, config, or secret movement.
- No real install or uninstall.
- No `npm install` for plugins.
- No release, deploy, publish, or push action.

## First Implementation Slice Recommendation

The next safe slice should be one of:

- **Gate 9 Slice 002 baseline/doc guard:** add read-only guards that confirm this contract remains
  represented and that LocalState is not treated as plugin code by default.
- **Gate 10 no-op fixture external package smoke test:** create only a temporary test fixture that
  models an external package root and proves resolver discovery without creating or migrating a real
  `VCPToolBox-JENN-Extensions` package.

Do not start with a real package skeleton unless Commander explicitly opens an external package
creation task. A docs/baseline guard slice is the smallest next step.

## Required Future Validation Tests

Before any real external package implementation, tests should prove:

- External plugin roots remain default-off when `VCP_PLUGIN_DIRS` is unset.
- `VCP_PLUGIN_DIRS` entries still require `VCP_PLUGIN_ALLOWED_ROOTS`.
- Unsafe roots such as repo root, `.git`, and `node_modules` remain denied.
- `legacyLoadRoots` remains core-first.
- A duplicate external plugin name cannot override a core plugin.
- A no-op external fixture manifest is discoverable without executing plugin code.
- `VCP_PLUGIN_INSTALL_DIR` must match a current allowlisted external legacy root.
- `VCPToolBox-JENN-LocalState` is not scanned as plugin code unless explicitly configured and
  allowlisted.
- Real `config.env`, `.env`, logs, caches, generated images, SQLite/vector stores, and operator data
  are excluded from migration fixtures.

## Plugin Store Live Install Isolation Policy

Plugin Store live install remains out of scope until separately reviewed.

Future Plugin Store work must keep these boundaries:

- No live install or uninstall in a layout/documentation slice.
- No external install target unless `VCP_PLUGIN_INSTALL_DIR` matches a current allowlisted external
  legacy root.
- No external install overwrite of a same-name core plugin.
- `npm install` lifecycle scripts remain disabled by default unless separately confirmed by the
  existing Plugin Store policy.
- Live install tests must use isolated temporary directories and mocked network/archive inputs unless
  Commander explicitly authorizes live behavior.

## Remaining Risks

- No real external package exists yet.
- The contract is not exercised by a real Jenn extension package.
- Plugin Store live install behavior remains unexercised for this Gate 9 slice.
- External process plugins remain trusted local child processes, not an untrusted sandbox.
- DingTalk and Codex memory surfaces may involve live-service, credential, or operator-state
  boundaries.
- Generated tool catalogs may require explicit rebuild and compatibility policy after real
  relocation.

## Boundary Confirmation

This Gate 9 Slice 001 contract confirms:

- `VCPToolBox-JENN-Extensions` is for future executable Jenn plugin/runtime assets only.
- `VCPToolBox-JENN-LocalState` is for private operator state only.
- LocalState must not be treated as plugin code by default.
- Plugin Store live install remains out of scope until separately reviewed.
- Core runtime, resolver, Admin, Store, env/config/secrets, and tests remain unchanged by this
  docs-only checkpoint.

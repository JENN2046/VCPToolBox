# Gate 11 External Package Skeleton RFC

**Status:** Gate 11 documentation-only RFC.
**Date:** 2026-06-12
**Scope:** future Jenn external package skeleton, without package creation or migration.

This RFC defines the intended skeleton for future Jenn external package work. It does not create
`VCPToolBox-JENN-Extensions`, create `VCPToolBox-JENN-LocalState`, migrate plugins, enable external
roots, run Plugin Store installs, or change runtime behavior.

## Purpose

Gate 11 prepares a reviewable package skeleton for future upstream-compatible Jenn adapter work
after:

- Gate 8 locked the resolver-level external root contract.
- Gate 9 defined and guarded the external package layout contract.
- Gate 10 proved the corrected nested `Plugin/` discovery layout with a temp-only no-op fixture.

The next real implementation must still be opened as a separate reviewed slice. This RFC is only a
planning checkpoint.

## Scope

This RFC covers the proposed skeleton and rules for:

- `VCPToolBox-JENN-Extensions/`
- `VCPToolBox-JENN-Extensions/Plugin/`
- `VCPToolBox-JENN-LocalState/`

It intentionally does not cover live plugin migration, Plugin Store live install behavior, runtime
discovery changes, release packaging, or deployment.

## External Package Skeleton

`VCPToolBox-JENN-Extensions/` is the managed external package root. Its first real version should be
small, reviewable, and source-only unless a later slice explicitly authorizes fixtures or migrated
plugins.

Proposed skeleton:

```text
VCPToolBox-JENN-Extensions/
  README.AGENTS_OS.md
  Plugin/
    README.AGENTS_OS.md
    <future-plugin>/
      plugin-manifest.json
      index.js or server entry
      README.AGENTS_OS.md
  docs/
    README.AGENTS_OS.md
  receipts/
    README.AGENTS_OS.md
```

Contract notes:

- `VCPToolBox-JENN-Extensions/` is the managed external package root.
- `VCPToolBox-JENN-Extensions/Plugin/` is the legacy plugin discovery root.
- Plugin folders under `Plugin/` must remain self-contained legacy plugin assets.
- Plugin code must not assume repo-relative Jenn paths.
- Plugin code must not require `A:\agent-image-lab`, repository-local operator paths, or other
  machine-specific roots.
- No external plugin may override a core plugin name.
- External roots remain default-off until explicitly configured and allowlisted.
- Runtime discovery remains unchanged.

## Local State Skeleton

`VCPToolBox-JENN-LocalState/` is private local state. It must not be treated as plugin code by
default and must not be included in `VCP_PLUGIN_DIRS` during the first package skeleton work.

Proposed skeleton:

```text
VCPToolBox-JENN-LocalState/
  README.AGENTS_OS.md
  logs/
  cache/
  outputs/
  secrets/
  receipts/
```

Contract notes:

- LocalState is for private operator state only.
- LocalState must not be a plugin root by default.
- Secrets, logs, cache, generated images, receipts, and operator state must not live inside plugin
  package source unless explicitly classified in a future reviewed slice.
- Live secrets must not be committed.
- LocalState inventory, backup, dry-run, and rollback policy must be reviewed before any real state
  movement.

## Env Mapping

The recommended nested package layout requires runtime discovery to point at the `Plugin/`
subdirectory, not the package root:

```text
VCP_PLUGIN_ALLOWED_ROOTS=<path>/VCPToolBox-JENN-Extensions
VCP_PLUGIN_DIRS=<path>/VCPToolBox-JENN-Extensions/Plugin
VCP_PLUGIN_INSTALL_DIR=<path>/VCPToolBox-JENN-Extensions/Plugin
```

The following mapping is incompatible with the recommended nested `Plugin/` layout unless legacy
discovery changes in a future separately reviewed runtime patch:

```text
VCP_PLUGIN_DIRS=<path>/VCPToolBox-JENN-Extensions
```

Reason: current legacy discovery scans only immediate children of each configured
`VCP_PLUGIN_DIRS` root for `plugin-manifest.json`. It does not recursively scan
`VCPToolBox-JENN-Extensions/Plugin/<plugin>/plugin-manifest.json` when the configured root is
`VCPToolBox-JENN-Extensions/`.

## Contract Rules

- `VCPToolBox-JENN-Extensions` is the managed external package root.
- `VCPToolBox-JENN-Extensions/Plugin` is the legacy plugin discovery root.
- `VCPToolBox-JENN-LocalState` is private local state, not a plugin root by default.
- Plugin code must not assume repo-relative Jenn paths.
- Secrets, logs, cache, generated images, receipts, and operator state must not live inside plugin
  package source unless explicitly classified.
- No external plugin may override core plugin names.
- External roots remain default-off.
- Runtime discovery remains unchanged.
- Plugin Store live install remains out of scope until separately reviewed.
- External plugin `config.env` behavior remains unchanged.

## Migration Status

This RFC states clearly:

- This RFC does not create the real package.
- This RFC does not migrate any plugin.
- This RFC does not enable external roots.
- This RFC does not alter Plugin Store behavior.
- This RFC does not authorize install or uninstall into live roots.
- This RFC does not authorize runtime behavior changes.
- This RFC does not authorize release, deploy, npm publish, or branch protection bypass.

## Future First Slice Options

The first implementation slice after this RFC should remain narrow. Acceptable candidates are:

- A docs-only skeleton review in a separate external repository or staging area.
- A no-op package skeleton created outside this core repository after explicit approval.
- A baseline/doc guard for this RFC if Commander wants the RFC to become a sealed invariant.

The first implementation slice should not migrate real plugins, copy private state, install
packages, run Plugin Store live installs, or alter `Plugin.js`.

## Required Future Validation

Before any real package skeleton or migration work, validation should prove:

- External roots remain default-off without `VCP_PLUGIN_DIRS`.
- `VCP_PLUGIN_DIRS` remains gated by `VCP_PLUGIN_ALLOWED_ROOTS`.
- `VCP_PLUGIN_DIRS` points to `VCPToolBox-JENN-Extensions/Plugin` for the nested layout.
- `VCP_PLUGIN_INSTALL_DIR` matches the allowlisted external legacy root before external install use.
- Direct `VCP_PLUGIN_DIRS=<path>/VCPToolBox-JENN-Extensions` does not discover nested plugins unless
  runtime discovery is explicitly changed.
- LocalState is not scanned as plugin code by default.
- Duplicate external plugin names cannot override core plugin names.
- Fixtures contain no real secrets, logs, cache, generated images, receipts, or operator state.

## Explicit Non-Goals

- No real `VCPToolBox-JENN-Extensions` creation.
- No real `VCPToolBox-JENN-LocalState` creation.
- No plugin migration.
- No file moves.
- No Plugin Store live install or uninstall.
- No plugin execution.
- No `Plugin.js` behavior change.
- No `modules/pluginRootResolver.js` behavior change.
- No `server.js` or Admin route change.
- No `package.json` change.
- No env, config, or secret change.
- No release, deploy, or npm publish.

## Remaining Risks

- A real external package still does not exist.
- Plugin Store live install behavior is still not exercised against a real external package.
- Future plugin code may still contain repo-relative assumptions until audited.
- Local private state still needs a separate inventory and handling plan.
- External process plugins remain trusted local child processes, not an untrusted sandbox.

## Boundary Confirmation

This Gate 11 RFC confirms:

- It is a documentation-only checkpoint.
- It creates no external package.
- It creates no local state package.
- It migrates no plugin.
- It changes no runtime behavior.
- It does not enable external roots.
- It does not authorize live install or uninstall.
- It keeps Gate 10's corrected nested `Plugin/` discovery contract intact.

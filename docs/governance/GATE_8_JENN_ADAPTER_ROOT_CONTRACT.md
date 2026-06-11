# Gate 8 Jenn Adapter Root Contract

**Status:** Gate 8 Slice 001 checkpoint only.
**Date:** 2026-06-11
**Scope:** resolver-level contract hardening for future Jenn adapter roots.

This document records the current root-resolution contract that must remain stable before any
upstream-compatible Jenn adapter package work starts. It does not create or authorize an external
adapter package, plugin migration, live install, release, deploy, or runtime behavior expansion.

## Purpose

Gate 8 Slice 001 locks the existing adapter root contract around:

- `VCP_PLUGIN_DIRS`
- `VCP_PLUGIN_ALLOWED_ROOTS`
- `VCP_PLUGIN_INSTALL_DIR`
- external legacy plugin roots
- core-first load order
- duplicate plugin name behavior
- unsafe root rejection
- default-off external root behavior

The future adapter root names are:

- `VCPToolBox-JENN-Extensions`
- `VCPToolBox-JENN-LocalState`

These names are contract placeholders in this slice. The directories are not created by this
checkpoint.

## Current Resolver Contract

- Core legacy plugins remain rooted at `Plugin/`.
- Core modern plugins remain rooted at `plugins/`.
- External legacy roots are disabled unless `VCP_PLUGIN_DIRS` is configured.
- `VCP_PLUGIN_DIRS` entries require `VCP_PLUGIN_ALLOWED_ROOTS`.
- External roots must not resolve to the repository root.
- External roots must not resolve inside `.git`.
- External roots must not resolve inside `node_modules`.
- `legacyLoadRoots` remains core-first: `core:legacy` before external roots.
- `watchRoots` includes core legacy, core modern, and allowlisted external legacy roots.
- External plugin `config.env` is not loaded through external root discovery.
- Duplicate plugin names do not let an external plugin override an existing core plugin.
- `VCP_PLUGIN_INSTALL_DIR` defaults to core `Plugin/` when unset.
- `VCP_PLUGIN_INSTALL_DIR` is treated as external only when it matches a current allowlisted
  external legacy root.

## Explicit Non-Goals

- No `Plugin.js` scan or watcher behavior change.
- No `server.js` startup behavior change.
- No Admin plugin write behavior change.
- No Plugin Store behavior expansion.
- No real plugin install or uninstall.
- No `npm install` for plugins.
- No external adapter package creation.
- No plugin migration.
- No env, config, or secret changes.
- No release, deploy, or publish action.

## Remaining Risks

- The external adapter package has not been created.
- The resolver contract is locked by tests but not yet exercised by a real Jenn extension package.
- Plugin Store live install behavior remains unexercised in this slice.
- External process plugins are trusted local child processes, not an untrusted sandbox.

## Future Implementation Boundary

Any future adapter layer implementation should start from a separate commander-approved task book.
The next slice may consume this resolver contract, but it must keep these boundaries:

- start default-off
- keep external roots allowlist-gated
- avoid same-process external runtime enablement
- avoid real install or migration unless explicitly authorized
- keep `VCPToolBox-JENN-Extensions` and `VCPToolBox-JENN-LocalState` outside core source until the
  external package phase is explicitly opened

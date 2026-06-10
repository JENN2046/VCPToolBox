# P3-C External Ecosystem Inventory Helper

Date: 2026-06-10
Branch: codex/p3-external-ecosystem-inventory-helper
Mode: path-only helper

## Scope

P3-C adds a local path-only inventory helper for the Jenn external ecosystem
contract defined in P3-B.

The helper classifies repository paths into conservative migration buckets:

- `keep_core`
- `externalizable`
- `deferred`
- `blocked`
- `docs_only`
- `unknown`

This package does not move, copy, delete, stub, replace, install, uninstall, or
load anything.

## Helper

Added helper:

```text
scripts/p3-external-ecosystem-inventory.js
```

The helper:

- walks directory entries by path and file name;
- does not read file contents;
- does not read real `.env`, `config.env`, or `Plugin/**/config.env` contents;
- emits JSON evidence with relative paths only;
- marks runtime/private/secret-like paths as `blocked`;
- marks loader or migration surfaces that need later design as `deferred`;
- keeps P3 core adapter files in `keep_core`.

Example dry command:

```powershell
node scripts/p3-external-ecosystem-inventory.js --summary
```

## Safety Rules

Blocked path classes include:

- real `.env` and `config.env` files;
- plugin `config.env` files;
- runtime/cache/state/log/image/operator data roots;
- SQLite, vector, and private memory store paths;
- key material and secret-like path names.

`externalizable` means "candidate for later review", not permission to move.

`deferred` means a later design gate is required before implementation.

## Future Use

P3-C can support later gates by producing path-only evidence before any content
migration:

- P4 AdminPanel extension-loader design;
- P5 Agent external directory loader;
- P6 LocalState/runtime data inventory;
- P7 selected plugin copy-first dry-run migration.

## Validation Boundary

Validation uses static checks and fixture tests only.

No service startup, Plugin Store install/upload/uninstall, real migration,
secret read, release, deploy, push, or npm publish is performed in P3-C.

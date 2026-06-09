# P1 Admin External Plugin Management

Date: 2026-06-09
Branch: codex/p1-admin-external-plugin-management

## Scope

P1 only supports Admin backend management for allowlisted external legacy plugins.

Supported Admin backend behavior:

- List loaded core plugins.
- List loaded external legacy plugins discovered through P0 allowlisted roots.
- List disabled core legacy plugins via `plugin-manifest.json.block`.
- List disabled allowlisted external legacy plugins via `plugin-manifest.json.block`.
- Toggle allowlisted external legacy manifests between `plugin-manifest.json` and `plugin-manifest.json.block`.
- Edit allowlisted external legacy plugin manifest `description`.

## Boundaries

- External roots come only from the P0 `PluginRootResolver` allowlisted snapshot.
- `VCP_PLUGIN_DIRS` entries are not Admin-managed unless `VCP_PLUGIN_ALLOWED_ROOTS` allows them.
- Core plugin names keep priority when an external plugin uses the same name.
- Duplicate plugin names are reported as sanitized Admin diagnostics without full local paths.
- Plugin Store external install dir is deferred to P2.
- AdminPanel extension loader is deferred to P4.
- Direct/resident plugin reload policy is not expanded in P1.

## Config Policy

- External `config.env` editing remains deferred and returns `403` with `external_config_deferred`.
- Core `config.env` save keeps the blank-save guard: an existing non-empty `config.env` cannot be overwritten with blank content unless `confirmBlankConfigEnv=true`.
- Admin list and detail responses must not return raw `config.env` content.
- Admin responses must not return `pluginSpecificEnvConfig`.

## Secret Safety

- P1 does not read or return real secrets.
- P1 only inspects `config.env` metadata with `stat` for redacted status.
- Manifest responses sanitize local paths to `[core]/...`, `[external]/...`, or another non-absolute source label.
- `pluginRootId` values are non-path identifiers.

## Deferred

- P2: Plugin Store external install directory behavior.
- P4: AdminPanel extension loader behavior.
- External plugin-specific `config.env` editing.
- Any production enablement, deploy, release, or publish workflow.

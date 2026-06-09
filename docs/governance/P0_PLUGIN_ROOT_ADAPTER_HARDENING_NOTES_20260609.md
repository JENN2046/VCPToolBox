# P0 Plugin Root Adapter Hardening Notes

Date: 2026-06-09
Branch: codex/p0-plugin-root-adapter-hardening

## Scope

P0 only supports secret-safe external discovery/load skeleton.

External plugin-specific config.env loading is intentionally disabled by default.

Runtime enablement belongs to a later allowlisted policy.

## Boundaries

- `VCP_PLUGIN_DIRS` is diagnostic-only unless `VCP_PLUGIN_ALLOWED_ROOTS` explicitly allowlists the external root.
- External plugin root identifiers are non-path IDs such as `external:1`.
- Admin plugin listing must not return raw `config.env` content or `pluginSpecificEnvConfig`.
- Admin external plugin config editing is deferred in P0.
- Plugin Store external install, AdminPanel extension loading, and broader runtime enablement are out of scope for P0.

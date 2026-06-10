# H1 Runtime External Plugin Registration Gate

Date: 2026-06-10
Mode: narrow backend runtime hardening

## Purpose

This patch separates external plugin root discovery from external plugin runtime
registration. An allowlisted `VCP_PLUGIN_DIRS` root can still be discovered, but
external plugin code is not registered into `PluginManager` unless it matches an
explicit runtime allow policy.

## Scope

Changed files:

- `Plugin.js`
- `tests/plugin-external-runtime-registration-gate.test.js`
- `docs/governance/H1_RUNTIME_EXTERNAL_PLUGIN_REGISTRATION_GATE_20260610.md`

No Plugin Store backend, Admin backend, AdminPanel, server startup, release,
deploy, npm publish, or real external plugin execution is part of this patch.

## Runtime Registration Contract

External legacy plugins are discovered through the existing P0/P1 resolver
contract:

- `VCP_PLUGIN_DIRS` names candidate external legacy roots.
- `VCP_PLUGIN_ALLOWED_ROOTS` must allowlist those roots before they enter the
  runtime root snapshot.
- Discovery remains path/manifest based.

Runtime registration now has a second gate:

```text
VCP_EXTERNAL_PLUGIN_ALLOWLIST=PluginName@/reviewed/source/root
```

Rules:

- Core plugins remain unchanged.
- External plugins without a matching `PluginName@sourceRoot` policy are
  discovered but not registered.
- Name-only, path-only, wildcard, dot-only, or filesystem-root policy entries do
  not grant runtime registration.
- External same-name plugins cannot override already registered core plugins.
- Rejected external plugins do not enter `plugins`, `serviceModules`, or
  `messagePreprocessors`.
- Rejection logs use plugin name, root id, sanitized display label, and a reason
  code. They do not print raw absolute paths or env/config contents.

## Non-Sandbox Statement

`VCP_EXTERNAL_PLUGIN_ALLOWLIST` means operator-reviewed trusted runtime code. It
does not sandbox JavaScript direct modules, stdio commands, shell execution, or
plugin process environment. A future runtime env sandbox can further reduce
secret exposure for explicitly allowed stdio/static external plugins.

## Tests

Targeted tests cover:

- external discovery does not imply runtime registration;
- explicit `PluginName@sourceRoot` policy allows matching external stdio
  registration;
- name-only and path-only policies remain blocked;
- external same-name plugins cannot override existing core registrations;
- blocked external direct plugins are not `require()` loaded;
- core plugin registration behavior remains unchanged.

The tests use temporary fixture paths and do not run real Plugin Store
install/upload/uninstall or real external plugin execution.

## Deferred

- Runtime environment sandbox for explicitly allowed external stdio/static
  plugins.
- Full external direct-plugin sandboxing.
- AdminPanel UI for runtime allow policies.
- Plugin Store changes.
- Agent or LocalState external loaders.

## Closeout Checklist

- [x] External root discovery remains separate from runtime registration.
- [x] Core registration behavior remains unchanged.
- [x] External runtime registration is fail-closed without explicit policy.
- [x] Direct external plugin code is not loaded when blocked.
- [x] No real env/config file content is read or returned by this patch.
- [x] No release, deploy, or npm publish performed.

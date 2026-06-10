# H1 Admin Command Description Managed Target

Date: 2026-06-10

Status: hardening implementation

## 1. Purpose

H1 blocking #2 hardens the Admin command-description write endpoint so it no
longer derives its manifest target from an unmanaged core `Plugin/` scan.

The endpoint now resolves the write target through the Admin managed plugin
catalog before editing command descriptions.

## 2. Scope

Changed files:

- `routes/admin/plugins.js`
- `tests/admin-plugin-command-description-target.test.js`
- `docs/governance/H1_ADMIN_COMMAND_DESCRIPTION_MANAGED_TARGET_20260610.md`

No Plugin Store route, AdminPanel UI, Plugin loader, server startup, release,
deploy, npm publish, or real API probe was changed or executed.

## 3. Managed Target Contract

`POST /plugins/:pluginName/commands/:commandIdentifier/description` now:

- builds the Admin catalog with `buildAdminPluginCatalog(pluginManager)`;
- resolves by `pluginName` plus optional `pluginRootId` / `rootId` and
  `pluginSource`;
- rejects duplicate managed targets with `409 ambiguous_admin_plugin_target`;
- returns only sanitized target candidates;
- requires `isWritableLegacyRecord(target)`;
- requires `assertManagedManifestRecord(target)` before reading or writing the
  manifest;
- updates only the selected command description;
- preserves command matching by `commandIdentifier` or `command`;
- reloads plugins only after a successful write.

## 4. Duplicate Policy

If more than one distinct managed target matches a plugin name, pluginName-only
requests fail closed with `409`.

The response may include sanitized candidates:

- `pluginRootId`
- `pluginSource`
- `enabled`
- `loaded`
- `displayPath`

Absolute local paths are not returned.

## 5. External Policy

External command-description editing remains deferred in this patch.

An explicit external target returns:

```json
{
  "code": "external_command_description_deferred",
  "status": "deferred"
}
```

No external manifest is modified by H1 blocking #2.

## 6. Core Compatibility

Core legacy plugin command-description editing remains supported when the target
is unambiguous or explicitly selected.

Existing command matching behavior is preserved:

- `cmd.commandIdentifier === commandIdentifier`
- `cmd.command === commandIdentifier`

## 7. Security Notes

This patch does not:

- treat description text as an executable target;
- accept unmanaged shell, path, or freeform command targets;
- infer external roots;
- widen Plugin Store install behavior;
- read or write `config.env`;
- read or print real `.env`, `config.env`, or `Plugin/**/config.env` contents;
- expose manifest absolute paths in Admin responses.

## 8. Tests

Added targeted tests verify:

- core-only command description edits still write the core manifest;
- duplicate core/external targets without criteria return `409` and write
  nothing;
- explicit core target writes only the core manifest;
- explicit external target returns deferred `403` and writes nothing;
- a loaded target outside the managed root is rejected by managed manifest
  assertion;
- rejection responses do not leak absolute local paths.

Tests use temporary plugin roots and do not start a server or run real API
probes.

## 9. Non-Goals

H1 blocking #2 does not:

- implement external command-description editing;
- add a duplicate target selector UI;
- modify Plugin Store external install logic;
- modify AdminPanel;
- modify `Plugin.js`;
- change runtime plugin dispatch;
- migrate plugins or runtime data.

## 10. Closeout Checklist

- [x] Command-description endpoint uses managed catalog resolution.
- [x] Duplicate managed targets fail closed.
- [x] Explicit core target remains writable.
- [x] Explicit external target remains deferred.
- [x] Managed manifest assertion protects the write path.
- [x] No real secrets are read or returned.
- [x] No real server/API probe is performed.

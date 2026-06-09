# P2-C Plugin Store UI/API Polish

Date: 2026-06-09
Branch: codex/p2-plugin-store-ui-api-polish

## Scope

P2-C-B is a minimal AdminPanel Plugin Store UI/API typing polish.

The backend P2-B Plugin Store external install root policy remains the source of truth for safety.

## Changes

API typing:

- `PluginStoreItem` accepts installed source/root/display metadata from P2-B.
- `PluginStoreListResponse` accepts install mode and diagnostics metadata.
- Plugin uninstall accepts optional `installedSource` and `installedRootId`.
- Plugin uninstall response typing includes ambiguity metadata.

UI display:

- Installed plugins can show Core or External source badges.
- Installed plugins can show backend-sanitized display path labels.
- Duplicate/conflict metadata can show a short conflict badge.
- Ambiguous uninstall errors show a clearer operator message.

## Safety

- UI only displays backend-provided `installedDisplayPath`.
- UI does not construct or infer local filesystem paths.
- UI hides path-like absolute strings defensively.
- UI redacts credential URLs and token-like values in displayed errors and logs.
- UI does not select or infer install roots.

## Deferred

- Complex duplicate target selector.
- Full conflict management UI.
- Install root picker.
- AdminPanel extension loader.
- External `config.env` editor.
- Real Plugin Store install/upload/uninstall probes.

## Validation Boundary

No release, deploy, npm publish, backend install, uninstall, upload, or service/API probe is performed in P2-C-B.

# P2 Plugin Store External Install Dir

Date: 2026-06-09
Branch: codex/p2-plugin-store-external-install-dir

## Scope

P2 supports backend-only Plugin Store installation into a governed external legacy plugin root.

This phase does not change AdminPanel-Vue views, Plugin.js dispatch, server.js, release, deploy, or publish behavior.

## Hybrid Install Root Policy

Plugin Store uses a hybrid install root policy.

Legacy mode:

- Trigger: `VCP_PLUGIN_INSTALL_DIR` is unset or blank.
- Behavior: preserve upstream Plugin Store compatibility and install into core `Plugin/`.
- `VCP_PLUGIN_ALLOWED_ROOTS` alone never causes Plugin Store to guess an external install root.

External mode:

- Trigger: `VCP_PLUGIN_INSTALL_DIR` is set.
- The install root must resolve inside `VCP_PLUGIN_ALLOWED_ROOTS`.
- The install root must exactly match a current allowlisted external legacy root from `VCP_PLUGIN_DIRS`.
- Invalid external install root configuration fails closed.
- External mode never falls back to core `Plugin/`.

## Core Protection

External install mode must not overwrite core plugins.

- If core `Plugin/<name>` already exists, external install is rejected even when `force=true`.
- Core plugin names keep priority when installed status is calculated.
- External duplicates are reported as conflict or ignored metadata instead of overriding core installed status.

## Install And Backup

Install target:

- Legacy mode: `Plugin/<safeName>`.
- External mode: `VCP_PLUGIN_INSTALL_DIR/<safeName>`.

Force install:

- `force=true` may only back up and replace the existing target inside the selected install root.
- It must not back up or replace a same-name core plugin from external mode.

Backup target:

- Core backup: `Plugin/.backup`.
- External backup: `<externalRoot>/.backup`.
- Backup root and backup target must pass managed-root containment checks.

## Installed Status

Plugin Store installed status scans:

- core `Plugin/`
- current allowlisted external legacy roots

Rules:

- Core records are preferred over external records with the same plugin name.
- External duplicate records are marked as ignored or conflict metadata.
- Response metadata uses source, root id, and display path labels only.
- Raw absolute local paths are not returned by default.

## Uninstall

Uninstall behavior:

- Core uninstall remains allowed and uses core backup behavior.
- External uninstall only removes the plugin record from its own external root.
- `pluginName`-only uninstall is allowed only when the installed target is non-ambiguous.
- Duplicate names require `installedSource` and/or `installedRootId`.

## Log And Secret Safety

Plugin Store task logs are scrubbed before storage, SSE replay, and status responses.

Redaction covers:

- absolute local paths
- credential URLs
- `Authorization` / `Bearer` values
- token, password, cookie, secret, session, and API-key style values

P2 does not read or return real `.env`, `config.env`, or `Plugin/**/config.env` contents.

## Deferred

- AdminPanel-Vue Plugin Store UI conflict and root display polish.
- AdminPanel extension loader behavior, deferred to P4.
- External plugin-specific `config.env` editing.
- Real install/upload/uninstall probes.
- Release, deploy, and publish workflows.

# P3-F-C Remaining Unknown Taxonomy Helper Patch

Date: 2026-06-10

Status: helper/test/doc patch

## 1. Purpose

P3-F-C implements the P3-F-B remaining unknown taxonomy spec in the path-only
external ecosystem inventory helper.

The goal is to remove the remaining generic `unknown` bucket by classifying
root-level support surfaces conservatively. This patch does not move files,
enable loaders, grant migration permission, or change runtime behavior.

## 2. Scope

Changed files:

- `scripts/p3-external-ecosystem-inventory.js`
- `tests/p3-external-ecosystem-inventory.test.js`
- `docs/governance/P3F_REMAINING_UNKNOWN_TAXONOMY_HELPER_PATCH_20260610.md`

Runtime behavior remains unchanged. The helper remains path-only and does not
read file contents.

## 3. Implemented Rules

| Group | Pattern | Decision | Surface | Target |
| --- | --- | --- | --- | --- |
| repo metadata | `.dockerignore`, `.gitignore`, `LICENSE`, `.github/**` | `keep_core` | `repo-metadata` | null |
| local cache/state | `.file_cache`, `.omc/**`, `logs/**`, `tmp/**`, `data/**` | `blocked` | `local-cache-state` | null |
| runtime entrypoints | `server.js`, `adminServer.js`, `WebSocketServer.js`, root runtime JS modules | `keep_core` | `runtime-entrypoint` | null |
| repo build config | `package*.json`, `Dockerfile`, `docker-compose.yml`, Python/process config files | `keep_core` | `repo-build-config` | null |
| operator config | `ToolConfigs/**`, root map/config JSON files | `deferred` | `operator-config` | null |
| root documentation | `README*`, `AGENTS*`, `MEMORY.md`, `VCP*.md`, TagMemo docs, update text | `docs_only` | `documentation` | `governance/` |
| example media | root screenshots and logo images | `deferred` | `example-media` | null |
| maintenance scripts | root backup, notify, update, rebuild, repair, reset, sync, and test helper scripts | `keep_core` | `maintenance-tooling` | null |
| installer binary | `vcp-installer-一键安装脚本.exe` | `deferred` | `installer-binary` | null |
| contact state | `VCPTimedContacts` | `deferred` | `contact-state` | null |

Safety ordering preserved:

- real `.env` and `config.env` files still block before broad rules;
- secret-like paths still block before broad rules;
- key material still blocks before local cache/state rules;
- runtime/cache/operator data classifications do not become externalizable;
- `externalizable` was not widened in this phase.

## 4. Inventory Impact

Baseline before P3-F-C implementation:

| Decision | Count |
| --- | ---: |
| `unknown` | 99 |
| `keep_core` | 876 |
| `externalizable` | 1183 |
| `deferred` | 3206 |
| `blocked` | 1841 |
| `docs_only` | 178 |

P3-F-C helper result before adding this document:

| Decision | Count |
| --- | ---: |
| `unknown` | 0 |
| `keep_core` | 922 |
| `externalizable` | 1183 |
| `deferred` | 3232 |
| `blocked` | 1852 |
| `docs_only` | 194 |

Unknown reduction:

```text
99 -> 0
```

This governance document itself adds one additional `docs_only` / `governance`
path in subsequent helper summaries.

## 5. Test Coverage

Added tests cover:

- repo metadata stays core;
- local cache/state roots are blocked;
- root runtime entrypoints stay core;
- repo build config stays core;
- operator config is deferred;
- root documentation is docs-only;
- example media is deferred;
- maintenance scripts stay core;
- installer binary is deferred;
- contact-state directory is deferred;
- secret/config/key-material precedence is preserved.

## 6. Non-Goals

P3-F-C does not:

- move, copy, delete, or migrate files;
- change Plugin loading;
- change Plugin Store behavior;
- change Admin APIs;
- add Agent external directory loading;
- create or trust an external ecosystem root;
- read or print real `.env`, `config.env`, or plugin `config.env` contents;
- run install, upload, uninstall, server, or API probes.

## 7. Closeout Checklist

- [x] P3-F-B taxonomy rules implemented.
- [x] Tests added for new path-only classifications.
- [x] Secret/config/key-material precedence preserved.
- [x] Unknown bucket reduced to zero before this doc is counted.
- [x] Runtime behavior unchanged.
- [x] No migration permission granted.
- [x] No real secrets read or printed.

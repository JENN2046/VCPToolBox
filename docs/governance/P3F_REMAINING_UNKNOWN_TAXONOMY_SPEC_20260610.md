# P3-F-B Remaining Unknown Taxonomy Spec

Date: 2026-06-10

Status: docs-only remaining unknown taxonomy spec

## 1. Purpose

This document specifies the second-stage taxonomy rules for the 99 remaining
`unknown` path-only inventory records after P3-E-C.

The goal is to make the inventory report easier to review by removing the
remaining generic `unknown` bucket. This is classification only. It does not
authorize movement, migration, runtime loading, or externalization.

## 2. Baseline

Baseline commit:

```text
827d43c3 feat(adapter): refine external inventory taxonomy
```

Current helper summary:

| Decision | Count |
| --- | ---: |
| `unknown` | 99 |
| `keep_core` | 876 |
| `externalizable` | 1183 |
| `deferred` | 3206 |
| `blocked` | 1841 |
| `docs_only` | 177 |

When this P3-F-B governance document is present in the working tree, the helper
also counts it as one additional `docs_only` file; the remaining `unknown` count
stays 99.

The remaining unknown records are root-level support surfaces, metadata, local
state-like folders, operator configs, documentation, example media, and
maintenance scripts.

## 3. Rule Principles

P3-F rules must remain conservative:

- classify by path only;
- do not read file contents;
- do not expose absolute local paths;
- do not classify runtime/operator data as migration-ready;
- prefer `blocked` for local state/cache/log-like paths;
- prefer `deferred` for operator configuration or state-like surfaces;
- prefer `keep_core` for root runtime, tooling, and build surfaces;
- prefer `docs_only` only for documentation-like files;
- do not widen `externalizable` in this phase.

## 4. Proposed Rules

| Group | Pattern | Decision | Surface | Target | Rationale | Count |
| --- | --- | --- | --- | --- | --- | ---: |
| repo metadata | `.dockerignore`, `.gitignore`, `LICENSE`, `.github/**` | `keep_core` | `repo-metadata` | null | Repository governance and CI metadata should stay core. | 7 |
| local cache/state | `.file_cache`, `.omc/**`, `logs/**`, `tmp/**`, `data/**` | `blocked` | `local-cache-state` | null | Local/cache/runtime-like state must not move automatically. | 11 |
| runtime entrypoints | `server.js`, `adminServer.js`, `WebSocketServer.js`, root runtime JS modules | `keep_core` | `runtime-entrypoint` | null | Root runtime entry points and core modules are not external ecosystem packages. | 16 |
| repo build config | `package*.json`, `Dockerfile`, `docker-compose.yml`, Python/process config files | `keep_core` | `repo-build-config` | null | Build and dependency manifests remain repo-owned. | 9 |
| operator config | `ToolConfigs/**`, root map/config JSON files | `deferred` | `operator-config` | null | Operator policy/config surfaces need a separate review before movement. | 15 |
| root documentation | `README*`, `AGENTS*`, `MEMORY.md`, `VCP*.md`, TagMemo docs, update text | `docs_only` | `documentation` | `governance/` | Documentation can be cataloged, but docs do not grant runtime permission. | 16 |
| example media | root screenshots and logo images | `deferred` | `example-media` | null | Media examples may be documentation assets, but should not be auto-migrated. | 9 |
| maintenance scripts | root backup, notify, update, rebuild, repair, reset, sync, and test helper scripts | `keep_core` | `maintenance-tooling` | null | Root maintenance tooling remains repo-owned. | 14 |
| installer binary | `vcp-installer-一键安装脚本.exe` | `deferred` | `installer-binary` | null | Binary distribution requires package provenance review. | 1 |
| contact state | `VCPTimedContacts` | `deferred` | `contact-state` | null | Contact/state-like material is operator-adjacent. | 1 |

Projected result:

```text
unknown: 99 -> 0
```

## 5. Explicit Non-Migration Boundaries

The following classifications are not migration permissions:

- `operator-config`;
- `example-media`;
- `installer-binary`;
- `contact-state`;
- `local-cache-state`;
- any future root docs surfaced as `docs_only`.

`blocked` paths must never be moved automatically. `deferred` paths require a
separate gate before any copy, move, packaging, or externalization plan.

## 6. Future P3-F-C Test Plan

If implementation is authorized, add tests for:

- repo metadata stays core;
- `.file_cache`, `.omc`, `logs`, `tmp`, and `data` are blocked;
- root runtime entry points stay core;
- build/package config stays core;
- operator config is deferred;
- root docs become docs-only;
- example media is deferred;
- maintenance scripts stay core;
- installer binary is deferred;
- contact-state directory is deferred;
- secret/config/key-material rules still override these broad rules.

Suggested bounded validation:

```powershell
node --check scripts/p3-external-ecosystem-inventory.js
node --check tests/p3-external-ecosystem-inventory.test.js
node --test tests/p3-external-ecosystem-inventory.test.js
node scripts/p3-external-ecosystem-inventory.js --summary
git diff --check
```

## 7. Non-Goals

P3-F-B does not:

- modify the inventory helper;
- modify tests;
- modify runtime code;
- move, copy, delete, or package files;
- add loaders or Admin APIs;
- change Plugin Store behavior;
- change Agent loading;
- create or trust an external ecosystem root;
- read or print real secrets;
- run install, upload, uninstall, server, or API probes.

## 8. Closeout Checklist

- [x] All 99 remaining unknown records mapped to proposed rule groups.
- [x] Runtime-like local state is blocked.
- [x] Operator config and state-like material is deferred.
- [x] Root runtime and tooling remain core.
- [x] Documentation remains non-runtime.
- [x] Future P3-F-C tests specified.
- [x] No helper/runtime files changed.
- [x] No secret reads performed.

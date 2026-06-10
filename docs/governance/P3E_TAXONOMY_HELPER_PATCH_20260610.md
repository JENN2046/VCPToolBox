# P3-E-C Taxonomy Helper Patch

Date: 2026-06-10

Status: helper/test/doc patch

## 1. Purpose

P3-E-C implements the P3-E-B taxonomy rules in the path-only external ecosystem
inventory helper.

The goal is to reduce the `unknown` bucket without changing runtime behavior,
granting migration permission, or reading sensitive file contents.

## 2. Scope

Changed files:

- `scripts/p3-external-ecosystem-inventory.js`
- `tests/p3-external-ecosystem-inventory.test.js`
- `docs/governance/P3E_TAXONOMY_HELPER_PATCH_20260610.md`

Runtime behavior remains unchanged. The helper remains a path-only inventory
tool.

## 3. Implemented Rules

High-impact rules:

| Pattern | Decision | Surface | Target |
| --- | --- | --- | --- |
| `rust-vexus-lite/target/**` | `blocked` | `generated-build-artifact` | null |
| `rust-vexus-lite/**` except `target/**` | `deferred` | `native-module-source` | `adapters/` |
| `VectorStore/**` | `blocked` | `private-store` | null |
| `tests/**` | `keep_core` | `validation` | null |
| unmatched `modules/**` | `keep_core` | `runtime-support` | null |
| unmatched `routes/**` | `keep_core` | `runtime-support` | null |
| `vcp-installer-source/**` | `deferred` | `installer-source` | `adapters/installer/` |
| `scripts/**` | `keep_core` | `tooling` | null |

Medium-impact rules:

| Pattern | Decision | Surface | Target |
| --- | --- | --- | --- |
| `VCPChrome/**` | `deferred` | `client-subproject` | `adapters/vcpchrome/` |
| `SillyTavernSub/**` | `deferred` | `client-subproject` | `adapters/vcpchat/` |
| `OpenWebUISub/**` | `deferred` | `client-subproject` | `adapters/openwebui/` |
| `TVStxt/**` | `deferred` | `operator-tool-prompts` | `capability-maps/` |
| `.agent_board/**` | `blocked` | `protected-agent-board` | null |

Safety ordering preserved:

- real env/config files still block before broad rules;
- secret-like paths still block before broad rules;
- key material still blocks before generated/native/source rules;
- runtime roots still block before migration-oriented labels;
- vector/private stores are blocked broadly.

## 4. Inventory Impact

Baseline after P3-E-B spec existed:

| Decision | Count |
| --- | ---: |
| `unknown` | 1783 |
| `keep_core` | 651 |
| `externalizable` | 1183 |
| `deferred` | 3092 |
| `blocked` | 496 |
| `docs_only` | 176 |

P3-E-C helper result before adding this document:

| Decision | Count |
| --- | ---: |
| `unknown` | 99 |
| `keep_core` | 876 |
| `externalizable` | 1183 |
| `deferred` | 3206 |
| `blocked` | 1841 |
| `docs_only` | 176 |

Unknown reduction:

```text
1783 -> 99
```

This document itself will add one additional `docs_only` / `governance` path in
subsequent helper summaries.

## 5. Test Coverage

Added tests cover:

- generated native build artifacts;
- native module source;
- broad vector store blocking;
- validation paths;
- runtime module and route fallback behavior;
- installer source;
- tooling scripts;
- client subprojects;
- operator tool prompt text;
- protected `.agent_board` paths;
- secret/config/key-material override precedence.

## 6. Non-Goals

P3-E-C does not:

- move, copy, delete, or migrate files;
- change Plugin loading;
- change Plugin Store behavior;
- change Admin APIs;
- add Agent external directory loading;
- create or trust an external ecosystem root;
- read or print real `.env`, `config.env`, or plugin `config.env` contents;
- run install, upload, uninstall, server, or API probes.

## 7. Closeout Checklist

- [x] Helper taxonomy rules implemented.
- [x] Tests added for new path-only classifications.
- [x] Secret and key-material precedence preserved.
- [x] Runtime behavior unchanged.
- [x] No migration permission granted.
- [x] No real secrets read or printed.

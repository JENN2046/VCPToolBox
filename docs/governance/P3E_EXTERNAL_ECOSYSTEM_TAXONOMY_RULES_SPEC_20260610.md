# P3-E-B External Ecosystem Taxonomy Rules Spec

Date: 2026-06-10

Status: docs-only taxonomy rules spec

## 1. Purpose

This document defines the proposed P3-E taxonomy refinement rules for the
path-only external ecosystem inventory helper.

The immediate goal is to reduce the `unknown` bucket from the P3-D inventory
report without granting migration permission or changing runtime behavior.

This spec is intentionally separate from implementation. It does not modify
`scripts/p3-external-ecosystem-inventory.js`, tests, loaders, Plugin Store,
Admin APIs, Agent loading, or runtime state handling.

## 2. Baseline

Current baseline:

```text
main: e68a75ad docs(adapter): report external ecosystem inventory
```

Current P3-C helper summary after the P3-D report exists:

| Metric | Count |
| --- | ---: |
| total path records | 7380 |
| `unknown` | 1783 |
| `keep_core` | 651 |
| `externalizable` | 1183 |
| `deferred` | 3092 |
| `blocked` | 496 |
| `docs_only` | 175 |

The P3-D report recorded the pre-report snapshot as 7379 records. The current
7380 count includes the P3-D report itself as one additional docs/governance
path.

## 3. Taxonomy Principles

P3-E rules must stay conservative:

- Classification is path-only.
- Classification must not read file contents.
- Classification must not expose absolute local paths.
- Classification must not read real `.env`, `config.env`, or
  `Plugin/**/config.env` contents.
- Classification must not grant runtime loading, install, Admin, or Agent
  permission.
- `externalizable` means "candidate for later explicit review", not "safe to
  move now".
- `deferred` means a separate design gate is required before any migration.
- `blocked` means never move automatically.
- `keep_core` means keep in repo unless a later reviewed phase explicitly says
  otherwise.

## 4. Rule Ordering

Implementation should preserve the existing high-priority safety order:

1. real env/config files;
2. secret-like path names;
3. key material;
4. runtime/cache/state/log/image/operator roots;
5. vector, SQLite, and private stores;
6. explicit core adapter paths;
7. specific known directory contracts;
8. fallback unknown.

P3-E additions should be inserted after the existing secret/runtime/private-store
guards and before fallback unknown. Any rule that can classify a private store or
runtime artifact must prefer `blocked` over `deferred` or `keep_core`.

## 5. Proposed High-Impact Rules

These rules should be implemented first because they reduce the largest unknown
clusters while preserving the P3-B/P3-D safety boundary.

| Pattern | Decision | Surface | Target | Reason | Estimated unknown reduction |
| --- | --- | --- | --- | --- | ---: |
| `rust-vexus-lite/target/**` | `blocked` | `generated-build-artifact` | null | Native build output and generated metadata must not become migration input. | 1314 |
| `rust-vexus-lite/**` except `target/**` | `deferred` | `native-module-source` | `adapters/` | Native module source needs a separate package/build contract. | 18 |
| `VectorStore/**` | `blocked` | `private-store` | null | Vector indexes and SQLite sidecars are private/runtime data. | 25 |
| `tests/**` | `keep_core` | `validation` | null | Repository validation stays with the core repo unless a package split defines test ownership. | 108 |
| `modules/**` fallback | `keep_core` | `runtime-support` | null | Unmatched runtime modules should stay core by default. More specific existing deferred rules still win. | 64 |
| `routes/**` fallback | `keep_core` | `runtime-support` | null | Unmatched server routes stay core by default. More specific existing deferred rules still win. | 38 |
| `vcp-installer-source/**` | `deferred` | `installer-source` | `adapters/installer/` | Installer source needs packaging and distribution review. | 48 |
| `scripts/**` fallback | `keep_core` | `tooling` | null | Repository maintenance scripts are core tooling unless separately packaged. | 15 |

Projected impact:

```text
covered unknown records: 1630
```

## 6. Proposed Medium-Impact Rules

These rules clarify user-facing or client-adjacent subprojects that should not
remain unclassified.

| Pattern | Decision | Surface | Target | Reason | Estimated unknown reduction |
| --- | --- | --- | --- | --- | ---: |
| `VCPChrome/**` | `deferred` | `client-subproject` | `adapters/vcpchrome/` | Browser extension packaging needs separate UI/client review. | 11 |
| `SillyTavernSub/**` | `deferred` | `client-subproject` | `adapters/vcpchat/` | SillyTavern integration assets need adapter packaging review. | 9 |
| `OpenWebUISub/**` | `deferred` | `client-subproject` | `adapters/openwebui/` | OpenWebUI integration assets need adapter packaging review. | 8 |
| `TVStxt/**` | `deferred` | `operator-tool-prompts` | `capability-maps/` | Tool prompt text is operator-adjacent and needs evidence policy. | 20 |
| `.agent_board/**` | `blocked` | `protected-agent-board` | null | Protected agent board state must not move automatically. | 6 |

Projected impact:

```text
covered unknown records: 54
```

Combined projected impact:

```text
covered unknown records: 1684
remaining unknown records: about 99
```

## 7. Remaining Unknown Strategy

After the high- and medium-impact rules, the remaining unknown bucket is expected
to include about 99 paths. These should not be forced into a single broad rule.

Expected remaining categories:

- root runtime entry points such as `server.js`, `adminServer.js`, and
  `WebSocketServer.js`;
- root documentation, README files, and example images;
- CI, Docker, package, and dependency manifests;
- root maintenance scripts;
- `ToolConfigs/` and model/router JSON configs;
- runtime-like roots such as `logs/`, `tmp/`, and `data/`;
- assorted single-file utilities.

Recommended follow-up:

| Category | Proposed direction |
| --- | --- |
| root runtime entry points | `keep_core` / `runtime-entrypoint` |
| CI, Docker, package manifests | `keep_core` / `repo-build-config` |
| root README/docs/images | `docs_only` / `documentation` or `deferred` for media-heavy examples |
| root maintenance scripts | `keep_core` / `tooling` |
| `ToolConfigs/**` | `deferred` / `tool-config` unless secret-like path rules block first |
| `logs/**`, `tmp/**`, `data/**` | `blocked` or `deferred` depending on runtime/operator-data status |

These second-stage rules should be reviewed separately so the helper does not
hide sensitive runtime data behind convenient broad labels.

## 8. Test Plan For Future P3-E-C

When implementation is authorized, the helper patch should add focused tests for:

- `rust-vexus-lite/target/**` becomes `blocked/generated-build-artifact`;
- `rust-vexus-lite/src/**` becomes `deferred/native-module-source`;
- `VectorStore/**` is blocked even when extensions are not matched by the
  existing regex;
- `tests/**` remains `keep_core/validation`;
- unmatched `modules/**` and `routes/**` stay core, while existing specific
  deferred rules still win;
- `vcp-installer-source/**` is deferred;
- fallback `scripts/**` stays core tooling;
- client subprojects are deferred;
- `.agent_board/**` is blocked;
- real env/config and secret-like path rules still override all new rules.

Validation commands for P3-E-C should remain bounded:

```powershell
node --check scripts/p3-external-ecosystem-inventory.js
node --check tests/p3-external-ecosystem-inventory.test.js
node --test tests/p3-external-ecosystem-inventory.test.js
node scripts/p3-external-ecosystem-inventory.js --summary
git diff --check
```

## 9. Non-Goals

P3-E-B does not:

- modify the inventory helper;
- modify runtime code;
- add loaders;
- add Admin APIs;
- add Plugin Store behavior;
- add Agent external directory loading;
- copy, move, delete, or migrate files;
- create an external ecosystem root;
- grant permission from `VCP_EXTERNAL_ECOSYSTEM_ROOT`;
- read or print real secrets;
- run install, upload, uninstall, server, or API probes.

## 10. Closeout Checklist

- [x] Candidate taxonomy rules documented.
- [x] Estimated unknown reduction documented.
- [x] Rule ordering documented.
- [x] Remaining unknown strategy documented.
- [x] Future P3-E-C test plan documented.
- [x] No helper code changed.
- [x] No runtime files changed.
- [x] No secret reads performed.

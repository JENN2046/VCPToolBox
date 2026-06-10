# P3-D-B External Ecosystem Inventory Report

Date: 2026-06-10

Status: docs-only inventory report

## 1. Purpose

This report records the first path-only inventory review after the P3 Jenn
External Ecosystem Directory Contract and the P3-C inventory helper.

It is intended to answer:

- which repository surfaces already map cleanly to the external ecosystem
  contract;
- which surfaces must remain core;
- which surfaces are deferred or blocked;
- where the P3-C taxonomy needs refinement before any migration dry run.

This report does not authorize file movement, runtime loading, installer
changes, Agent external loading, AdminPanel extension loading, or LocalState
migration.

## 2. Baseline

Repository baseline:

```text
main: 58f8bdf0 test(plugin-root): align external dirs test with resolver order
```

Relevant prior phases:

- P0: plugin root adapter hardening
- P1: Admin managed external plugin roots
- P2-B: Plugin Store external install roots
- P2-C-B: Plugin Store UI/API polish
- P3-B: Jenn external ecosystem directory contract
- P3-C: path-only inventory helper

## 3. Inventory Method

Command:

```powershell
node scripts/p3-external-ecosystem-inventory.js --summary
```

Helper schema:

```text
p3c.path-only.inventory.v1
```

Evidence boundary:

- path-only inventory;
- no file content reads for classification evidence;
- no real `.env` or `config.env` content read;
- no plugin `config.env` content read;
- no runtime, cache, image, log, or operator data migration;
- no install, upload, uninstall, server, or API probe.

## 4. Summary Counts

Total path records:

```text
7379
```

This count is the snapshot captured before adding this report file. Running the
helper after this document exists will include this document as one additional
`docs_only` / `governance` record.

By decision:

| Decision | Count | Interpretation |
| --- | ---: | --- |
| `keep_core` | 651 | Repo surfaces that should remain core under the P3-B contract. |
| `externalizable` | 1183 | Candidate surfaces for later explicit copy-first migration or package design. |
| `deferred` | 3092 | Surfaces that need a separate gate before externalization. |
| `docs_only` | 174 | Documentation/governance material suitable for non-runtime packaging. |
| `blocked` | 496 | Sensitive or runtime/operator-adjacent material that must not move automatically. |
| `unknown` | 1783 | Paths not yet classified strongly enough for migration decisions. |

By surface:

| Surface | Count |
| --- | ---: |
| `memory` | 2079 |
| `file` | 1490 |
| `plugin-legacy` | 996 |
| `adapter` | 877 |
| `admin-panel` | 611 |
| `runtime-state` | 477 |
| `directory` | 293 |
| `plugin-modern` | 209 |
| `governance` | 101 |
| `env-example` | 74 |
| `documentation` | 73 |
| `adapter-core` | 37 |
| `shared-state` | 17 |
| `agent` | 16 |
| `secret-like-path` | 8 |
| `admin-or-adapter-route` | 7 |
| `secret-config` | 6 |
| `private-store` | 5 |
| `agent-governance` | 1 |
| `plugin-governance` | 1 |
| `plugin-root` | 1 |

## 5. Contract Fit

### Keep Core

The following classification result aligns with the P3-B contract:

- AdminPanel remains core for now.
- Adapter primitives and resolver contracts remain core.
- Plugin root and plugin governance surfaces remain core.
- Agent governance entry points remain core until a P5 loader design exists.

Observed counts:

| Surface | Count |
| --- | ---: |
| `admin-panel` | 611 |
| `adapter-core` | 37 |
| `agent-governance` | 1 |
| `plugin-governance` | 1 |
| `plugin-root` | 1 |

### Externalizable Later

The clearest candidate lane is selected legacy plugin packaging. This does not
mean automatic migration. It means P7 can use a copy-first, allowlisted dry run
after explicit selection and review.

Observed counts:

| Surface | Count |
| --- | ---: |
| `plugin-legacy` | 996 |
| `adapter` | 97 |
| `env-example` | 74 |
| `agent` | 16 |

Top-level areas:

| Area | Count |
| --- | ---: |
| `Plugin` | 1166 |
| `Agent` | 16 |
| `config.env.example` | 1 |

### Deferred

The largest deferred lane is memory/operator-adjacent material. It must stay
behind P6-style inventory and data governance.

Observed counts:

| Surface | Count |
| --- | ---: |
| `memory` | 2079 |
| `adapter` | 780 |
| `plugin-modern` | 209 |
| `shared-state` | 17 |
| `admin-or-adapter-route` | 7 |

Top-level areas:

| Area | Count |
| --- | ---: |
| `dailynote` | 2079 |
| `Plugin` | 742 |
| `plugins` | 226 |
| `modules` | 38 |
| `routes` | 7 |

### Blocked

Blocked records are not migration candidates. They represent secrets,
runtime/operator data, or private stores that must never be moved automatically.

Observed counts:

| Surface | Count |
| --- | ---: |
| `runtime-state` | 477 |
| `secret-like-path` | 8 |
| `secret-config` | 6 |
| `private-store` | 5 |

Top-level areas:

| Area | Count |
| --- | ---: |
| `image` | 404 |
| `state` | 64 |
| `Plugin` | 14 |
| `DebugLog` | 9 |
| `VectorStore` | 2 |
| `config.env` | 1 |
| `modules` | 1 |
| `tests` | 1 |

### Unknown

The unknown set is too large to support migration planning without taxonomy
improvement.

Observed counts:

| Surface | Count |
| --- | ---: |
| `file` | 1490 |
| `directory` | 293 |

Top-level areas:

| Area | Count |
| --- | ---: |
| `rust-vexus-lite` | 1332 |
| `tests` | 108 |
| `modules` | 64 |
| `vcp-installer-source` | 48 |
| `routes` | 38 |
| `VectorStore` | 25 |
| `TVStxt` | 20 |
| `scripts` | 15 |

The unknown count is a taxonomy gap, not a migration permission.

## 6. Priority Lanes

Recommended order:

1. P3-E taxonomy refinement for high-volume unknown areas.
2. P5 Agent external directory design if Agent packs are selected next.
3. P7 selected legacy plugin copy-first dry-run if plugin migration is selected
   next.
4. P6 LocalState/runtime data inventory before any memory, dailynote, image,
   state, cache, log, vector, or SQLite work.

## 7. Non-Goals

P3-D-B does not:

- move, copy, delete, or rewrite files;
- create an external ecosystem directory;
- set or infer `VCP_EXTERNAL_ECOSYSTEM_ROOT`;
- grant permissions from an umbrella root;
- change `VCP_PLUGIN_ALLOWED_ROOTS`, `VCP_PLUGIN_DIRS`, or
  `VCP_PLUGIN_INSTALL_DIR` behavior;
- implement modern external plugin registry support;
- implement Agent external loading;
- implement AdminPanel extension loading;
- migrate LocalState, memory, dailynote, runtime state, image data, cache,
  logs, vector stores, SQLite stores, or operator data;
- run real Plugin Store install, upload, or uninstall probes;
- read or print real secrets.

## 8. Risk Register

| Risk | Status | Notes |
| --- | --- | --- |
| Unknown taxonomy is large. | needs follow-up | `rust-vexus-lite`, tests, modules, routes, installer sources, and scripts need clearer rules. |
| Legacy plugin lane is broad. | non-blocking | Later P7 must select specific plugin folders and use copy-first dry-run review. |
| Agent lane is small but sensitive. | non-blocking | P5 must preserve built-in alias precedence and avoid prompt-body evidence by default. |
| Memory/runtime lanes dominate deferred and blocked counts. | blocking for migration | P6 data governance is required before any operator/private data movement. |
| Umbrella root can be misunderstood as permission. | controlled | P3-B states it is docs-only and grants no runtime trust. |

## 9. Closeout Checklist

- [x] Inventory was path-only.
- [x] Summary counts recorded.
- [x] Contract alignment reviewed.
- [x] Unknown taxonomy gap recorded.
- [x] No runtime files changed.
- [x] No loader behavior changed.
- [x] No install, upload, uninstall, server, or API probe performed.
- [x] No real env/config secrets read or printed.

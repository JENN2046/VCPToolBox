# OneRing SQL/hash-only Rewrite Preflight - 2026-06-07

本包只新增设计 / preflight 文档，不实现 OneRing SQL/hash-only rewrite，不导入
upstream `Plugin/OneRing/*`，不修改 `rust-vexus-lite/*`，不提交或更新 `.node`
二进制，不修改 handlers、admin routes、frontend、`preprocessor_order.json`，
不创建 SQLite、runtime 数据、向量索引或真实 env。

## 1. Preflight Context

| Item | Value |
| --- | --- |
| Local base | `9f11b0ac` / `origin/main` |
| Local branch | `codex/onering-rust-native-design-preflight-20260607` |
| Upstream source | `upstream/main` read-only inspection |
| Earlier native commits | `43436f12`, `178955ad`, `8bcd9b35`, `1dd5aec1` |
| Latest OneRing rewrite commits | `517c67ea`, `39d0c2ba`, `371d69f8`, `5b606b6b`, `3dbb9a4d`, `19a8f463`, `1f889489`, `d6e13b6b`, `9a80e4dd`, `ba0b8a88` |
| Ledger driver | `UPSTREAM_ABSORB_LOG_20260528.md` section 5 / section 7 |

The previous ledger bucket called this a OneRing Rust/native sweep because
`178955ad` added `rust-vexus-lite/src/onering.rs`, `OneRingEngine` exports, and
new / updated `.node` binaries.

Upstream has now changed direction. Commit `39d0c2ba` is titled:

```text
大幅简化Oring逻辑，用纯SQL方法实现整个系统，移除所有数学引擎
```

Read-only inspection confirms that the latest upstream line deletes
`rust-vexus-lite/src/onering.rs`, removes `OneRingEngine` types / exports from
`rust-vexus-lite/index.d.ts`, removes the OneRing `rayon` dependency, and changes
`Plugin/OneRing/OneRingNative.js` so diff / timestamp bind return `null` and
fall back to JS hash-only paths.

## 2. Updated Decision

Treat the Rust/native OneRing path as **upstream-withdrawn / deferred for local
absorption**.

Do not continue the local preflight as a Rust/native implementation plan.

Track the current upstream direction as a **OneRing SQL/hash-only rewrite
专项**, still not a raw merge candidate.

Do not import upstream `Plugin/OneRing/*` directly. The upstream plugin is now a
large SQL/hash/snapshot/handler protocol package, not a small native speedup.

## 3. Latest Upstream Scope

The latest upstream OneRing changes after `1dd5aec1` touch these areas:

| Area | Files |
| --- | --- |
| Main preprocessor | `Plugin/OneRing/OneRing.js` |
| SQLite layer | `Plugin/OneRing/OneRingDB.js` |
| Snapshot / hash layer | `Plugin/OneRing/OneRingSnapshot.js` |
| Native wrapper fallback | `Plugin/OneRing/OneRingNative.js` |
| Handler response meta | `modules/handlers/nonStreamHandler.js`, `modules/handlers/streamHandler.js` |
| Native package cleanup | `rust-vexus-lite/Cargo.toml`, `Cargo.lock`, `index.js`, `index.d.ts`, `src/lib.rs`, `.node` binaries |

The important functional shift is:

- native OneRing diff engine removed;
- SQL and hash-based matching becomes authoritative;
- `postTurns` / request hash metadata appear in the SQLite layer;
- OneRing adds frontend protocol / timestamp binding behavior;
- handlers receive `oneRingResponseMeta` to record final assistant responses by
  precomputed metadata;
- additional fixes target role-divider interaction, concurrent pipeline ordering,
  short-context race conditions, and DB creation logging.

## 4. Current Local Contract

The local OneRing line remains smaller and staged:

- `ONERING_LOCAL_DESIGN_20260606.md` chose disabled / record-only first.
- `ONERING_PLUGIN_PACKAGE_DECISION_20260606.md` chose local modular
  implementation, not raw-import of upstream `Plugin/OneRing/*`.
- Current local code already has pure helpers and focused tests for parser,
  fuzzy diff, handler adapter behavior, stream result shape, runtime ignore,
  hot config helper, temp-path store, and minimal handler wiring.
- Existing local handler wiring was reviewed around final upstream success and
  avoiding tool-only / intermediate assistant records.

The latest upstream SQL/hash-only rewrite may contain valuable behavior, but it
must be decomposed against this local contract.

## 5. Recommendation

Prefer SQL/hash-only absorption over Rust/native absorption for OneRing at this
stage.

Reasoning:

- OneRing correctness depends more on "record the right message at the right
  time" than raw fuzzy-compute speed.
- SQL/hash behavior is easier to inspect, test with temp SQLite, and roll back.
- Rust/native binaries add ABI, provenance, platform, and build risk before the
  OneRing behavior is stable.
- Upstream itself moved away from the Rust `onering.rs` engine.

This does not mean the latest upstream package is safe to import wholesale. It
means future local work should review SQL/hash contracts first.

## 6. Key Risks In The SQL/hash-only Rewrite

| Risk | Why it matters locally |
| --- | --- |
| Raw plugin size | `Plugin/OneRing/OneRing.js` grew into a large protocol / DB / snapshot coordinator and is not reviewable as one local patch. |
| SQLite writes | Upstream creates / mutates OneRing SQLite state. Local tests must use temp paths only. |
| Handler coupling | `oneRingResponseMeta` changes stream and non-stream recording paths and must preserve final-success-only behavior. |
| Preprocessor authority | Upstream mentions elevated preprocessor permission and frontend protocol adaptation; local order and default-off rules must stay explicit. |
| RoleDivider interaction | Upstream fixed a top-level array behavior issue; local array metadata preservation already exists and must not regress. |
| Concurrency and race handling | Concurrent pipeline fixes can hide subtle ordering assumptions; tests need short-context and retry fixtures. |
| Runtime cleanup | DB connections, pending turns, async updates, WAL files, and snapshots need rollback / shutdown behavior. |
| Native residue | `.node` files still changed in the upstream sequence even though OneRing no longer uses `onering.rs`; binary changes remain out of scope. |

## 7. Proposed Staging

### Phase 0: This package

Docs-only preflight. No implementation.

### Phase 1: SQL/hash contract fixtures

Add tests around local JS helpers and temp-path store behavior:

- stable content hash generation;
- tail marker stripping;
- frontend source / sender extraction;
- request hash identity;
- same / edited / unknown block classification;
- temp SQLite insert / update / prune behavior;
- no real `Plugin/OneRing/data` writes.

### Phase 2: Post-turn metadata design

Design how `postTurns`, `turnId`, `requestHash`, `responseMessageId`, and
`responseContentHash` should map onto the current local handler adapter.

This phase should remain docs/tests first and must preserve:

- final-success-only recording;
- no aborted / idle / failed upstream assistant record;
- no tool-only intermediate assistant record;
- no default context mutation.

### Phase 3: Focused DB/store package

If Phase 1 and Phase 2 pass, extend the local store in a small package:

- temp-path tests first;
- explicit schema migration / create-table behavior;
- path containment;
- bounded retention;
- close / cleanup behavior.

### Phase 4: Handler meta wiring

Only after the DB/store contract exists, consider a small handler package for
`oneRingResponseMeta`-style recording. This must be tested in stream and
non-stream paths.

### Phase 5: Preprocessor protocol compatibility

Review upstream frontend protocol and preprocessor permission behavior as a
separate package. Do not change `preprocessor_order.json` by default.

## 8. Out Of Scope For This Package

This package must not:

- add or edit `Plugin/OneRing/OneRing.js`;
- add or edit `Plugin/OneRing/OneRingDB.js`;
- add or edit `Plugin/OneRing/OneRingSnapshot.js`;
- add or edit `Plugin/OneRing/OneRingNative.js`;
- edit stream or non-stream handlers;
- edit `modules/roleDivider.js`;
- edit `rust-vexus-lite/*`;
- add, remove, or update any `.node` file;
- modify admin routes, frontend source, frontend `dist`, or
  `preprocessor_order.json`;
- run SQLite migrations, vector rebuilds, native builds, services, or external
  API calls.

## 9. Validation Plan

Docs-only validation:

```powershell
git diff --check
rg -n "SQL/hash-only|upstream-withdrawn|39d0c2ba|OneRingEngine|\\.node|Out Of Scope|Post-turn metadata" docs/governance/ONERING_SQL_HASH_ONLY_REWRITE_PREFLIGHT_20260607.md
git status --short
```

No Rust build, N-API load, SQLite operation, handler test, service startup,
database migration, vector rebuild, frontend build, or external API call is
required for this preflight.

## 10. Recommended Next Package

If this design is accepted, the next safe package should be
**OneRing SQL/hash contract fixtures**: add focused tests for local hash,
snapshot, request identity, and temp store behavior without importing upstream
plugin code or touching handlers.

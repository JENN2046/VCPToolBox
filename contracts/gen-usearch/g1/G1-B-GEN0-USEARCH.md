# Gen-USearch G1-B Production Implementation

Status: **IMPLEMENTATION_CANDIDATE**

Parent authority: G0 R3.1 FROZEN at `4d475a91f416a5951386c3bad8c64879b5a1f107`.

Parent production slice: G1-A at `863944c412f73716ad1d353549673a386e511bea`.

G1-B adds the real in-memory **Gen0 USearch MemTable** underneath the existing DailyNoteSearcher service. It remains shadow-only. Existing text/BM25 results are unchanged, and `GENERATIONAL_ACTIVE` stays fail-closed until QueryReadView and logical visibility routing exist.

## Gen0 contract

- USearch Rust crate pinned to `2.26.3`, built without optional default features.
- Cosine metric, F32 vectors, unique vector keys.
- Positive signed-int64 vector IDs map losslessly into USearch's u64 key space.
- Dimensions are explicit and exact. Zero dimensions, mismatches, NaN and infinity fail closed.
- Only `ACTIVE` MemTables accept writes.
- `SEALED_QUERY_VISIBLE`, `FLUSHING`, `SEGMENT_PUBLISHED`, and `RETIRED_QUERY_VISIBLE` remain physical candidate sources.
- `RECLAIMABLE` is not query-visible.
- Capacity grows without changing vector identity.
- Exact recovery vectors use a frozen little-endian F32 byte codec.
- Gen0 search returns **physical ANN candidates only**. It does not decide current-head visibility, tombstones, logical chunk deduplication, or user-visible ranking.

## Service integration

Shadow mode requires:

- `GEN_USEARCH_DIMENSIONS > 0`
- non-empty `GEN_USEARCH_EMBEDDING_FINGERPRINT`

Optional:

- `GEN_USEARCH_GEN0_INITIAL_CAPACITY`, default 1024

The Gen0 generation ID is **not user-configurable**. It is the durable runtime fence acquired from SQLite, so a successful ownership reacquire necessarily receives a new generation ID.

`/health` exposes Gen0 generation, dimensions, size, state, and embedding fingerprint.

Legacy mode opens no Gen-USearch state. Shadow initialization failure remains isolated from legacy search. Active mode still exits with `ACTIVE_ENGINE_UNAVAILABLE`.

## G1-B acceptance

G1-B requires:

1. locked Cargo dependency graph;
2. format + full Rust unit tests;
3. clippy with `-D warnings`;
4. Linux, Windows and macOS Rust build/test compatibility;
5. service binary build;
6. legacy behavior smoke;
7. shadow Gen0 health smoke;
8. shadow owner/failure isolation;
9. graceful runtime fence reacquire;
10. active fail-closed.

G1-B does not authorize immutable segment serving, compaction, QueryReadView routing, logical visibility filtering, or GENERATIONAL_ACTIVE.

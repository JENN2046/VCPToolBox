# Gen-USearch G1-A Production Implementation

Status: **PASS**

Parent authority: G0 R3.1 FROZEN at `4d475a91f416a5951386c3bad8c64879b5a1f107`.

G1-A is the first production slice. It builds the durable metadata, identity, lifecycle, recovery, and runtime-fence substrate beneath the future Gen0/USearch ANN layer. It does not change the existing text/BM25 search results and it does not enable GENERATIONAL_ACTIVE.

## Production behavior

- Default `GEN_USEARCH_MODE=legacy`: current DailyNoteSearcher behavior is unchanged and no Gen-USearch metadata DB is opened.
- GEN_USEARCH_MODE=shadow: attempts to open the crash-durable SQLite metadata store and acquire exclusive runtime ownership. If the shadow subsystem fails, it reports ERROR in /health but legacy text/BM25 search remains available.
- `GEN_USEARCH_MODE=active`: fail-closed with `ACTIVE_ENGINE_UNAVAILABLE` until G1-B implements the Gen0/USearch serving path. There is no silent legacy fallback.

## Durable substrate

The Rust production module implements:

- SQLite WAL + synchronous FULL durability profile;
- schema versioning and foreign keys;
- durable monotonic signed-int64 vector allocator with no reuse;
- independent `visibility_seq` and `manifest_epoch`;
- atomic source observation + reconciliation intent with canonical SHA256 source digests;
- stable document identity across URI moves;
- missing source observation without inferred delete;
- chunk/version MVCC lifecycle and current-head CAS publication;
- exact recovery material for staged/current vectors;
- immutable segment artifact SHA256 verification and durability registration;
- manifest publication with captured-epoch CAS, one embedding fingerprint per manifest, and fresh physical artifact re-verification before publication;
- recovery release only after current-manifest durable segment coverage and fresh physical artifact re-verification;
- exclusive runtime ownership and monotonic runtime fence;
- stale ownership after an unclean runtime exit remains fail-closed until an explicit recovery protocol exists;
- graceful DRAINING -> UNOWNED release.

On platforms where final-directory durability cannot yet be proven by this implementation, segment finalization fails closed instead of marking the artifact durable.

## G1-A acceptance

G1-A requires all of the following:

1. `cargo fmt --check`
2. `cargo test --locked`
3. `cargo clippy --all-targets -- -D warnings`
4. service binary build
5. LEGACY health smoke
6. SHADOW metadata/runtime activation
7. concurrent SHADOW owner rejection for the generational subsystem while legacy search remains available
8. graceful release and fence increment on reacquire
9. ACTIVE fail-closed while G1-B is unavailable

G1-A does not authorize Gen0 ANN, immutable vector segments, compaction workers, retrieval routing, or GENERATIONAL_ACTIVE.

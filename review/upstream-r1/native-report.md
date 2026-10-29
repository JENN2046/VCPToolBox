# R1-B final native-source and build evidence

Final Linux candidate validation: **PASS**. This report covers Rust/native integration, DailyNoteSearcher native payloads, and the `tdbRetrievalQuality.test.js` conflict in the isolated candidate. Fork `fef48db3e0bea997e99d7e7bd9c8551ae2ddb593`, upstream `393dc5e408f1dd521b4150946f77781ebabce399`. Production and other repositories were not modified.

## Final source and payload decisions

- All fixed-upstream Rust source, Cargo manifests/lock, RiverMemo V3/2.5 implementation, ANN exclusions, native rerank paths, diagnostics and tests are absorbed.
- Jenn's existing `getFileIdsByDiaries(dbPath, diaryNames, includePaths?)` Rust/TypeScript contract is preserved. Default callers still receive IDs; opt-in path metadata remains diary-scoped, with no bodies/vectors. Existing `chunkIndexGenerationalBaseline.test.cjs` validates both return shapes and injection-like diary input against the final native payload.
- Independent semantic review found that the new native Jev client inherited ambient HTTP proxy variables, unlike Jenn's JavaScript Jev transport. This was reproduced with the actual intermediate native binary and a fake loopback proxy. The final source disables ambient proxies **only for Jev**, then preserves explicit `JEV_PROXY_URL` configuration. Ordinary rerank keeps its prior ambient-proxy behavior. The client-cache key includes the proxy-policy class, preventing ordinary/Jev clients with equal timeouts and empty explicit proxy values from sharing incompatible transports.
- New `tests/nativeRerankProxyIsolation.test.js` runs each environment in a fresh child process. Its four scenarios prove Jev direct mode, explicit proxy mode, ordinary→Jev cache isolation, and Jev→ordinary cache isolation. No Rust test mutates shared process proxy settings.
- The final Rust/type diff against fixed upstream contains only Jenn's optional metadata contract and the native proxy-policy/cache fix; `native-jenn-preservation.diff` is 107 lines. No upstream Rust functionality was dropped.
- `tdbRetrievalQuality.test.js` keeps upstream's `node:test` wrapper, explicit absent-artifact skip and platform-specific candidate path, while preserving Jenn's explicit legacy baseline selection and historical artifact SHA256 validation when the baseline predates `capabilities()`.
- Candidate Linux Vexus and DailyNoteSearcher payloads are replaced with builds of their actual merged source. Historical receipts are unchanged; the new exact mapping is `docs/native-delivery-upstream-r1-linux.json`.

## Final Linux Vexus build

Default candidate artifact: `rust-vexus-lite/vexus-lite.linux-x64-gnu.node`.

SHA256: `d114ffd7b0cb6bb51ede252d2a9e7d027b2068b04b12d31eab5f7187e85da26d`.

The **unchanged original** pinned build recipe produced this final source twice in independent temporary source/build roots. Both payload hashes match byte-for-byte. Exact recipe inputs: Ubuntu image `docker.io/library/ubuntu@sha256:b8b6ee6aa931ecd9d0d952abc34dc0e5f7c6a30c6bb71b079fe399fde0329c02`, Rust `1.89.0`, GCC `12.3.0`, glibc `2.35`, Node `22.23.1`, napi CLI `2.18.4`, fixed Cargo.lock and the existing path-remapping flags. Build durations were 2m48s and 2m38s. Four upstream dead-code warnings remain in `rivermemo_wormhole.rs` (`Readout`, `evaluate`, `compare`, `augment`); no compilation errors.

```sh
VEXUS_COMPARE_TRACKED=0 bash scripts/run-vexus-linux-native-abi-container.sh \
  rust-vexus-lite/target/upstream-r1-pinned-source \
  rust-vexus-lite/target/upstream-r1-pinned-output \
  rust-vexus-lite/target/upstream-r1-pinned-cache
```

The candidate-local source snapshot excludes target/node_modules because the original script rejects a source tree containing target. It matches the final merged Rust source. The source mount is read-only; cache/output stay in this candidate's ignored target. `VEXUS_COMPARE_TRACKED=0` is the existing generation mode. After generation, the real output was copied to both the candidate default and isolated TDB-validation path, and `cmp` verified the candidate default equals the output. The build log records `REPRODUCIBLE=PASS`, `MAX_GLIBC=GLIBC_2.34`, `GLIBC_CEILING=PASS`.

The existing `node scripts/check-vexus-linux-native-abi.js` was then run on this exact final payload with its original default ceiling `MAX_ALLOWED_GLIBC=2.35`: PASS, observed `2.34`, including loader exports, index roundtrip, Memo-lifetime ABI and KBM module load. It was actually loaded and exercised on this Linux x64 host with Node `v22.23.1`; this does not claim production acceptance.

Host Rust 1.98 builds were also performed. Before the proxy fix, two independent target directories yielded `a854ab51280cfc5d7540d36044d0ee1bb5f22aecaf6a4ccc8c6a4b6f3ccd713e`. The final proxy-fixed source host build yielded `f8136628adb8ceadc7cb53018bd766cc5cfd54a5fab76ab323bf32a2ef8f05f9` and passed the four proxy scenarios. These are explicitly intermediate/superseded payloads; the final default is the pinned 1.89 artifact above. Old-source and briefly over-broad proxy-policy container attempts were deliberately stopped, their raw logs retained, and neither supplies final-source evidence.

## DailyNoteSearcher Linux and Windows

The merged Daily Rust source equals fixed upstream. Its change makes `WalkBuilder.git_ignore(false)` include Git-ignored diary data within the configured root.

```sh
CARGO_BUILD_JOBS=2 cargo +1.98.0 build --manifest-path Plugin/DailyNoteSearcher/src/Cargo.toml --locked --release --target-dir rust-vexus-lite/target/upstream-r1-daily-build
node scripts/verify-daily-note-searcher-native.cjs rust-vexus-lite/target/upstream-r1-daily-build/release/DailyNoteSearcher
node review/upstream-r1/daily-gitignore-probe.cjs rust-vexus-lite/target/upstream-r1-daily-build/release/DailyNoteSearcher
```

Build PASS (22.74s) using `rustc 1.98.0 (88d9e12ae 2026-08-18)`, `cargo 1.98.0 (797e8a9bc 2026-08-05)`, host GCC `15.2.0`, `x86_64-unknown-linux-gnu`. The original verifier passed 11 isolated checks: CLI search, malformed regex/traversal denial, local server searches, and correct/incorrect shutdown-token and instance behavior. The added fixture creates an isolated `.git`, `.gitignore` containing `ignored/`, and synthetic `ignored/fixture.md`; the current native executable finds its marker. No real notes or service were used.

The rebuilt candidate Linux payload SHA256 is `a4e87a6ad29d3e15eeacaa7914a4e41b30e9b8b6146f8bc8f89094ef82a14a79`, replacing historical `22c2cb9f33a1f428dee429be0afc677494d6d986ed2c38a6f8a93ba1d4d19ea5`. Observed maximum GLIBC is `2.34`. This Daily build is not claimed to have two-build bit reproducibility.

Both conflicting Daily Windows EXEs retain the exact fixed-upstream bytes, each SHA256 `f53e8364f744571ca1f8ea8ef3dc9dac6c745d47b33b8f23a0ad0a31d0377393`. They were **NOT_RUN** and not locally rebuilt; source/binary correspondence is not independently proved.

The conflicting Windows Vexus payload is preserved as `rust-vexus-lite/vexus-lite.win32-x64-msvc.upstream-393dc5e.node.unverified`, SHA256 `f3da3b501504bb77d667e007dc4fb0b7c81e9fb2958df5a535d5f16694e3956e`. It is absent from the default Windows x64 filename because it was not built from Jenn's merged source. The loader now rejects a missing candidate build with `VEXUS_CANDIDATE_BUILD_REQUIRED`, without loading an unrelated npm fallback. The simulated-platform probe passed; a genuine Windows build/run remains **BLOCKED** by the unavailable Windows environment.

## Final tests and actual commands

All data fixtures are temporary synthetic databases/indexes, in-memory data, or loopback HTTP. No production DB, real diaries, sync state, or external provider was tested.

| Status | Command / final evidence | Result |
| --- | --- | --- |
| PASS | `cargo +1.98.0 test --manifest-path rust-vexus-lite/Cargo.toml --locked --offline --lib --target-dir rust-vexus-lite/target/upstream-r1-tests` (`native-rust-tests-final.log`) | 191 passed, 0 failed, 0 ignored on final Rust source; RiverMemo, workspace/geometry, exclusions, HTTP fixtures, SQL and lifecycle tests |
| PASS | `node --test --test-concurrency=1 tests/tdbNativeAcceptance.test.js tests/chunkIndexGenerationalBaseline.test.cjs tests/tdbLegacyDimensionCompatibility.test.js tests/nativeGreenLane.test.js tests/nativeParallelRerank.test.js tests/nativeRerankSearchOptions.test.js tests/nativeRerankProxyIsolation.test.js tests/resultDeduplicatorBounds.test.js tests/lightMemoABDiagnostics.test.js` (`native-js-regression-final-pinned.log`) | 44 passed, 0 failed, 0 skipped on final pinned payload. Acceptance wrapper additionally executes all eight named native entry points successfully; do not double-count those as separate top-level tests. |
| PASS | `TDB_BASELINE_BINDING=rust-vexus-lite/target/upstream-r1-baseline/vexus-lite.linux-x64-gnu.node TDB_NATIVE_BINDING=rust-vexus-lite/target/tdb-validation/vexus-lite.linux-x64-gnu.node node --test tests/tdbRetrievalQuality.test.js` (`tdb-retrieval-quality-final-pinned.log`) | Deterministic 65D / 2304-vector / 32-query / k=10 comparison passed: old recall 0.971875, candidate 0.975 |
| PASS | `node --test tests/nativeDeliveryProvenance.test.cjs tests/textChunker.test.js` (`native-source-guards-final.log`) | 20 passed, 0 failed |
| PASS | `node scripts/check-native-delivery.cjs x86_64-unknown-linux-gnu vexus daily --receipt docs/native-delivery-upstream-r1-linux.json` (`native-candidate-provenance-final.log`) | Two final Linux artifacts and exact source inventories verified |
| PASS | `node scripts/check-vexus-linux-native-abi.js` (`native-linux-abi-final-pinned.log`) | Original GLIBC ceiling and ABI guard unchanged; observed 2.34 |
| PASS | `node review/upstream-r1/native-platform-probe.cjs` (`native-platform-probe-final.log`) | Simulated Windows missing-build rejection, no fallback |
| PASS | Quality test with a loadable but unrecorded wrapper selected as baseline (`tdb-retrieval-quality-negative.log`) | Expected rejection: `Legacy baseline does not match a recorded pre-TDB artifact` |
| PASS | Daily commands listed above (`daily-native-build.log`, `daily-native-regression.log`, `daily-gitignore-probe.log`) | Build, 11 existing checks and Git-ignore fixture passed |

The isolated USearch comparison baseline came from local Git commit `216edd06bb79afac83133dacc7d928eae11cb97e`, path `rust-vexus-lite/vexus-lite.linux-x64-gnu.node`; its hash exactly matches historical receipt `docs/native-delivery-30193c89.json`: `5af383730fff77eb2c6a47012cce2059b85b9dd26c6f5564a131b51bcf60b6b3`. It is neither the fixed Fork binary nor the candidate default. Synthetic recall scores do not demonstrate improved real-world recall; version names are not quality evidence.

## Earlier failures and non-runs retained

- **FAIL, fixed:** actual intermediate native Jev traffic hit the ambient fake proxy (`native-proxy-before-fix.log`). The final explicit-only policy/cache fix passes the new four-scenario test on both final-source host build and final pinned artifact.
- **FAIL, fixed:** the first quality conflict resolution lacked an explicit `node:crypto` import (`tdb-retrieval-quality-initial-fail.log`). It was corrected; the final real comparison passes.
- **FAIL, superseded:** initial parallel native JS execution had 42 passes and a green-lane 100ms cold-start deadline failure (`native-js-regression.log`). The unchanged test passed standalone, in the intermediate serial group and in the final pinned 44-test serial group. Timing sensitivity is disclosed, not erased.
- **NOT_RUN:** the pre-build quality invocation explicitly skipped for absent candidate artifact (`tdb-quality-no-artifact.log`), zero passes. Windows Daily execution, macOS, ARM64, musl and other native payloads remain unverified. Historical payloads/receipts on those platforms are not evidence for this merged source.
- The first offline Cargo attempt lacked a cached `dotenvy`; the subsequent fixed-lock fetch/build succeeded. No real credentials were used.
- The existing Linux Vexus workflow is now minimally repinned to `docs/native-delivery-upstream-r1-linux.json`, including the receipt watch path; its image, toolchain, source/payload `cmp` and GLIBC guards are unchanged. The build documentation references the current receipt. Remote CI was **NOT_RUN**. Windows/ARM workflows retain their historical receipts; those cannot establish new-source/platform compatibility, and cross-platform build evidence remains pending. No hash or ABI guard was relaxed.

## Review materials

`native-logs.tar.gz` losslessly contains all raw `logs/*.log` files cited above, including failures and deliberately aborted attempts. Extract from this directory with `tar -xzf native-logs.tar.gz`; log bytes are unchanged. Final source checksums (`native-source-sha256.txt`, normalized LF), preservation diff (`native-jenn-preservation.diff`) and this report's exact artifact/source receipt are included in the root regression archive / candidate review delivery. The root handoff owns the final candidate commit/tree, source bundle, client compatibility matrix and rollback boundary.

This evidence proves isolated final-source Linux integration and the stated tests. It does not establish VCPChat, NativeSync, ChannelHub or production acceptance.

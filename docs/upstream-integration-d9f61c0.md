# Upstream d9f61c0 integration

This integration starts from fork master b10d31fb and includes the eleven author commits after ea68ab3c through d9f61c0d0faedc62c6b0a6e9fc93151c51b1ad80.

Memo now shares observations and raw vectors within a request. Dual-field projection has one de-duplicated budget, default 256, including the required core. Dynamic wormholes change request-local selection while preserving stored graph assets. See [projection budgets](MEMO_FIELD_PROJECTION_BUDGET.md) and [dynamic wormholes](MEMO_DYNAMIC_WORMHOLES.md) for limits and diagnostics. These correctness changes do not establish better natural-language recall or lower end-to-end latency.

OpenHer includes bounded observation scheduling, caches and SQLite resource use. The host-policy compatibility patch removes automatic age/count deletion of audit history. Existing resource configuration keys remain accepted; a zero audit-row setting stops new recording while preserving history. Explicit reset/delete commands retain their existing behavior. See the [observer README](../Plugin/OpenHerPersona/README.md).

OpenHer's new FP32 anchor storage requires a consistent pre-upgrade database snapshot. A code-only rollback cannot safely read converted text placeholders. Production recovery must restore matching OpenHer state as well as any matching knowledge-store snapshot required by the prior runtime. Current state and audit rows were checked for preservation on an isolated copy; no external embedding request is needed for that check.

The native receipt for this source is [native-delivery-d9f61c0.json](native-delivery-d9f61c0.json), covering 48 Vexus compiler inputs. Historical receipts remain unchanged. Only targets listed as verified artifacts in the current receipt are accepted; incoming author binaries and old-platform payloads do not establish current-source provenance.

Local Linux builds use the existing digest-pinned Ubuntu 22.04 environment, Rust 1.89.0, GCC 12.3.0, Node 22.23.1 and NAPI CLI 2.18.4. Two independent builds are byte-identical and require at most GLIBC 2.34. The rebuilt payload also loads and passes the runtime contract on production Node 24.15.0.

Validation includes the existing native/runtime regressions, an unchanged USearch/TDB seeded-recall comparison using a receipt-matched legacy binding, JEV contract/policy tests, Admin typecheck/build/tests, OpenHer observer/resource tests, and private-copy storage compatibility. Stored-vector self-retrieval checks compare baseline, default, static-only and unbounded-projection modes without exposing private records. They are compatibility evidence, not a labeled natural-language benchmark or provider/tool acceptance.

Admin assets are rebuilt from merged source with the unchanged lockfile. Existing authentication, native host admission, diary/file scope, external bridge contracts and plugin enablement are not widened by this integration.

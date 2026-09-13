# RiverMemoInspector R0-P1B

Reusable native VCP read-only diagnostic plugin, **source only; not deployed**.

`source/` is the complete installable plugin bundle. It is deliberately one
level below the production scanner/watcher's manifest location. Do not move its
manifest to this directory during P1B: even a `.block` manifest triggers reload.
Tests materialize the bundle as a normal plugin under a temporary plugin root.
Production installation, loading and queries require the separate P1C authorization.

The Runtime V2 dependency `pluginManager.processToolCall` invokes **LightMemo**
once. No KBM/engine/database access, private LightMemo import, HTTP client or
candidate calculation exists in the plugin. No configuration is needed.

Input: `action: "trace_query"`, `query`, `diaries` (array or native JSON array
string), positive integer `k` (default 10), optional boolean `bm25`. Date modifiers
in the query and existing group/BM25 defaults remain LightMemo-owned. The public
App exposes BM25, so that one optional field supports reproduction with BM25 off.
Array entries map to comma-separated `folder` selectors; LightMemo uses SQL LIKE
substring matching, not exact diary identity. Entries containing its separator
characters are rejected to avoid silently widening an individual selector.
This is a scoped Hot RiverMemo profile; arbitrary native overrides are rejected.
It is not a replacement for every possible LightMemo parameter combination.

Result: native `content` plus schema version 1 summary and original `raw_trace`.
Summary fields are projections, never recomputed scores or parsed body titles.
Missing subject/metadata is null. Array order is retained. Unknown raw fields are
retained unchanged. Missing/invalid trace and upstream failure fail explicitly;
there is no text parsing or alternative retrieval fallback.

Current `rivermemo-topology-v3-result-v1` JS output exposes topology/geometry/
observables and aggregate anchor counters. Individual anchor contacts and dynamic
threshold are not exposed. Availability booleans describe this recognized schema;
unrecognized schemas report null/UNKNOWN_TRACE_SCHEMA and preserve raw data.
No conclusion about why an observed +0.1000 arose is inferred from aggregates.

Read-only describes capability effects on Memory, indexes and configuration.
Normal PluginManager approvals, privacy filtering, tool-call recording (if enabled)
and ordinary retrieval runtime bookkeeping still apply. There is no extra plugin
persistence or logging. The injected manager itself is not a sandboxed read-only
object; this plugin's only dispatch target/action is LightMemo SearchRAG.
No loader-enforced read-only annotation exists in the audited native manifest ABI,
so the description and executable guards express the capability restriction.

Run the isolated tests from the Core root:

```bash
node --test Plugin/RiverMemoInspector/tests/inspector.test.cjs
```

P1B does not query production, fix ranking, expand Rust trace fields, implement
VCP-APP integration, or change the later RAGDiaryPlugin/VCPChat cognition authority.

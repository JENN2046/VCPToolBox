# VCPChat isolated compatibility evidence

Status: **DEPLOYMENT_COMPATIBILITY_BLOCKED**.

Source client HEAD: `1f86d5912c6acb3588577945e19045edc1256731`. The actual client working tree was dirty, including `main.js`, but every source module consumed by this probe matches that HEAD byte-for-byte. Exact SHA256 values, dirty path metadata, and frozen source provenance are in `client-source/provenance.json`. No client repository file was modified. No config, credentials, settings, history, memory, or runtime state was read.

Reproduce from the candidate repository after its locked dependencies are installed:

```sh
node --experimental-vm-modules --test tests/upstreamR1ClientCompatibility.test.cjs
```

The default source is the included `client-source.tar.gz` snapshot with `client-source/provenance.json`. Tests read exact module bytes directly from the archive without extracting into the client tree. `tar` must be available. Original CRLF/whitespace is deliberately preserved. Set `R1_CLIENT_SOURCE` to a different complete source root only when intentionally testing another client. Source snapshot checksums are enforced. VM modules execute the actual ESM parsers; Acorn selects the exact original renderer function bytes. There is no copied substitute parser. `vcpClient.sendToVCP` runs as original CommonJS source with network and settings I/O replaced by isolated test doubles.

| Check | Result | Meaning |
|---|---|---|
| New batch reception | FAIL | Legacy inner results are recognized, but new batch markers remain in renderer Markdown input. |
| New/old coexistence | PASS (bounded) | Both legacy inner result payloads are retained verbatim; outer-marker compatibility still fails. |
| Every byte split of SSE | PASS | Actual TextDecoder and SSE line/JSON parser retain the full batch, including Chinese split inside UTF-8 sequences. |
| Every character split / stable renderer boundary | FAIL | Old result opacity remains; an unfinished batch-only wrapper does not establish an opaque data region. |
| Nonstream reception | PASS | Actual transport retains new-batch response content. |
| History JSON save/restore | PASS (bounded) | Actual transient-history finalization, isolated JSON roundtrip, and parser recovery retain raw result bytes. |
| User-forged new batch | FAIL | Old renderer treats a nested request as ToolUse presentation. This establishes display misclassification, not execution authorization. |
| Embedded role/tool text | FAIL | Complete legacy result shells protect payload. A batch-only shell allows role/tool presentation semantics to escape. |
| UNKNOWN reexecution, stream and nonstream | PASS (bounded) | Actual candidate handlers and actual ToolCallParser execute the initial call once; UNKNOWN result with nested request remains data when next model turn returns `done`. |

The probe process has 10 passing tests because it asserts these measured outcomes, including known incompatibilities. It does **not** turn compatibility FAIL into PASS. Detailed matrix: `client-compatibility-evidence.json`; test receipt: `client-compatibility-test.log`.

NOT_RUN: actual Electron rendering/Markdown DOM and interactions; actual ChatHistoryPersistence disk commit and application restart; installed production client and cross-repository acceptance; real tools, authorization credentials, and external side effects. Optional CSS/Mermaid/Flowlock/custom frontend processors and lazy DOM are outside the extracted renderer slice. No conclusion about their safety is made.

The Box protocol source is preserved. No VCPChat repair or production transition is attempted.

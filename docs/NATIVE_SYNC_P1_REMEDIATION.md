# R10_POST_REVIEW_P1_FIX

Result: `P1_REMEDIATION_PASS`, isolated synthetic tests only, 2026-10-23.
Baseline product `fe8e6a2f79c9410f9b46d4920bf0b0e6481a5cef`; worktree parent
`34679b7` adds only the prior handoff document. Branch `codex/r10-p1-remediation`.
The paired Chat baseline is `0f748f06f2e008035d9a0aa6860230c7ba17cee4`.

- `mobile/execution.js`: default four in-flight jobs, per-Topic serialization,
  oldest eligible queued selection excluding running Topics, guarded/coalesced
  scheduling, wake on submission/completion, cleanup-held Topic locks, synchronous
  drain and close awaiting every in-flight task. Existing durable intent/state
  recovery and uncertain-side-effect non-replay are preserved.
- `mobile/portal.js` / manifest: `NativeMobileMaxConcurrency`, integer 1–64,
  default 4. No runtime config was edited.
- `sync/centralStore.js` / HTTP: global bounded scan, exact device-scope filtering
  before parsing/serialization, nextSeq from scanned rows and hasMore from actual
  position. Empty scoped pages are valid. Auth, schema and journal apply unchanged.
- Tests add real synthetic HTTP concurrency/cancel/drain/restart and cross-repo
  Queue/pending/cursor crash tests. Existing scoped pull expectation now checks a
  filtered 200 instead of whole-page 403. Provenance checks still compare untouched
  schema/apply and canonical/hash source; the pull adaptation is explicitly listed.

Pinned baseline reproduction observed concurrency 1 (A2 blocking B/C/D) and
mixed-scope 403. Fixed tests observed concurrency 4, A1/B/C/D/A2 order, one attempt
per job, and no locks/tasks remaining. Seq 1/151 authorized around 149 unauthorized
events crossed empty pages without leaking messages or tombstones. Injected pending
ACK and empty-page checkpoint failures recovered to 151 without duplicates.

Validation: 541 passing Node test executions across affected suites, including
10 new P1 cases, 16 R10, 10 desktop daily, original 13 proof tests and 5 lifecycle
tests. Seven original real Electron IPC/Renderer checks pass. Actual R3 cold start,
R8 CDS/MobileSync write exclusion/group redo/restart, and R7 HTTPS PWA → trusted SSH
→ complete server.js → SQLite → official VCPChat Renderer pass. R7 central storage
contains seven messages and three one-attempt jobs (two completed, one cancelled),
integrity ok; three hosts exited 0 with balanced lifecycle calls. R8 independent
history/CDS/index checks passed with cursor 17 and empty pending/Outbox.

Paired actual Electron main-process capture at 5,000 history + 5,000 Outbox entries:
6917.35 → 57.90 ms; key calls 37,743,800 → 10,000; zero-delay timer lateness
6879.45 → 44.89 ms. Persisted state SHA-256 matches byte-for-byte, original hashes
and one durable write per capture preserved. No cache or Outbox format change.

Full commands, per-file rationale, CPU/loop-delay measurements, limitations and
evidence index are in the paired Chat `docs/NATIVE_SYNC_P1_REMEDIATION.md`.
Local evidence: `P:/VCPKF/vcp/artifacts/native-sync-p1/P1_FINAL_REPORT.json`.
Linux fixtures: `/home/admin/VCPKF/vcp/artifacts/native-sync-p1/node-20261023T004012656Z`.

```sh
VCP_P1_CHAT_SOURCE=/path/vcpchat-p1-remediation node --test \
  tests/native-sync-p1-execution.test.cjs tests/native-sync-p1-pull.test.cjs
node scripts/reproduce-native-sync-p1.cjs /isolated/native-sync-p1/baseline-repro
```

No production data/service/config, Rust CDS, model/tool execution interface,
canonical/hash algorithm, SQLite schema or shared-Topic authority changed.
No real provider or fresh Android/iPhone hardware run. No Push/Merge/deployment.

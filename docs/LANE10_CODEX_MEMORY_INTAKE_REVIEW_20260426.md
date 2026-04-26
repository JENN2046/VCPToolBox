# Lane10 Codex Memory Intake Review - 2026-04-26

## Summary

Branch reviewed: `lane10-codex-memory-intake-20260425`.

Decision: do not merge or cherry-pick the branch as a whole.

The branch contains two real candidate commits, but they are not a clean fit for
current `prod/stable`:

- `551f017 feat: add Codex memory recall analytics and adaptive tuning`
- `fb17dd0 fix: wire codex recall audit into rag diary runtime`

Current `prod/stable` already contains the safer Codex memory bridge, MCP search,
overview, adaptive profile helpers, and tests. Lane10 still has one high-value
gap, runtime recall auditing inside `RAGDiaryPlugin`, but that gap touches core
recall paths and must be integrated behind explicit safety gates.

## Current Prod Evidence

Observed on `prod/stable` at `c3cdef4`:

- Worktree has only the local retained `Plugin/UserAuth/code.bin` modification.
- `npm test` passed with 15 subtests.
- `routes/admin/codexMemory.js` exists.
- `adminServer.js` mounts `codexMemory` in its local admin module list.
- `server.js` mounts `/mcp/codex-memory` and imports `routes/codexMemoryMcp.js`.
- `server.js` does not directly mount `routes/admin/codexMemory.js` in the main
  admin router.
- `modules/codexMemoryOverview.js` and `modules/codexMemoryAdaptive.js` exist.
- `tests/codex-memory-admin.test.js` already covers recall summaries, adaptive
  profiles, and memory link aggregation from `logs/codex-memory-recall.jsonl`.
- `tests/codex-memory-adaptive.test.js` already covers adaptive profile and tag
  contribution calculations.
- `rag_params.json` does not currently include `RAGDiaryPlugin.codexAdaptiveRecall`.
- The current Vue AdminPanel does not have a Codex memory page or route.
- The old `AdminPanel/js/utils.js` and `AdminPanel/js/codex-memory-monitor.js`
  files do not exist in current prod.

## Lane10 Commit Split

### 551f017

Adds:

- `AdminPanel/js/codex-memory-monitor.js`
- `tests/codex-memory-recall.test.js`
- `RAGDiaryPlugin.codexAdaptiveRecall` defaults in `rag_params.json`
- Memory system and plugin docs updates
- Markdown output guideline changes

Assessment:

- The old `AdminPanel/js` monitor does not fit current `AdminPanel-Vue`.
- The test depends on private `RAGDiaryPlugin` recall-audit helper methods that
  do not exist in current prod.
- The config block enables adaptive tuning by default in the branch.
- Some documentation additions duplicate or partially conflict with current
  docs, including an old frontend module reference.
- `docs/Markdown_Output_Guideline.md` changes are unrelated to runtime intake
  and should not ride along.

### fb17dd0

Modifies:

- `Plugin/RAGDiaryPlugin/RAGDiaryPlugin.js`

Adds behavior:

- Imports `getCodexAdaptiveProfile`.
- Imports Codex diary constants.
- Writes recall audit JSONL entries to `logs/codex-memory-recall.jsonl`.
- Adds cache-aware recall audit recording.
- Applies adaptive threshold tuning to Codex diary recall.
- Adds private helpers such as `_buildCodexRecallAuditPayload`,
  `_recordCodexRecallAudit`, and `_getCodexAdaptiveTuning`.

Assessment:

- This is the only lane10 runtime piece with clear product value.
- It is also the highest-risk piece because it changes core RAG recall behavior.
- It should not be imported without log-size limits, redaction review, disabled
  default config, and targeted regression tests.

## Intake Decision Table

| Artifact | Decision | Reason |
| --- | --- | --- |
| Whole branch | Reject | Branch head is not a safe prod delta and includes stale/mismatched frontend shape. |
| `AdminPanel/js/codex-memory-monitor.js` | Reject | Current admin frontend is Vue under `AdminPanel-Vue`; the old JS module has no matching loader or DOM entry. |
| `routes/admin/codexMemory.js` | Already present | Backend route exists; independent `adminServer.js` mounts it locally. |
| Main `server.js` admin mount | Defer | Main process does not mount the route directly, but adminServer can serve it locally. Need decide whether dual mounting is required. |
| Vue AdminPanel page | Candidate | Should be implemented natively in `AdminPanel-Vue`, not by restoring old `AdminPanel/js`. |
| `tests/codex-memory-recall.test.js` | Defer with runtime | The test targets helper methods that only exist after runtime audit implementation. |
| `rag_params.json` `codexAdaptiveRecall` | Defer, disabled by default | Current prod lacks the block. If added, `enabled` should default to `false` until runtime audit is proven safe. |
| `fb17dd0` runtime audit | Candidate, high risk | Valuable recall telemetry, but touches core recall/cache paths and writes logs. Needs gated integration. |
| `docs/MEMORY_SYSTEM.md` additions | Partial candidate | Keep only current-fact updates after runtime/UI decisions are made. |
| `docs/PLUGIN_ECOSYSTEM.md` changes | Partial candidate | Review manually; avoid duplicate plugin rows. |
| `docs/Markdown_Output_Guideline.md` changes | Reject for this intake | Unrelated to Codex memory runtime and should be reviewed separately if still wanted. |

## Safety Gates For Runtime Intake

Before absorbing `fb17dd0` behavior:

1. Default all adaptive tuning to off.
2. Keep recall audit writing on only for Codex process and Codex knowledge diaries.
3. Redact or truncate logged text-derived fields.
4. Cap JSONL read/write impact and document retention expectations.
5. Confirm cache-hit audit does not double-count in normal repeated recall.
6. Add targeted tests for direct recall, cached recall, non-Codex diary exclusion,
   and malformed result handling.
7. Run `npm test` after integration.
8. Do not change unrelated RAG ranking behavior outside Codex diary targets.

## Recommended Intake Sequence

1. Documentation correction only:
   - Update `docs/CODEX_MEMORY_BRIDGE.md` to distinguish current backend
     observability from the missing Vue AdminPanel page.

2. Vue monitoring page:
   - Add a native `AdminPanel-Vue` API wrapper for
     `GET /admin_api/codex-memory/overview`.
   - Add a Vue route under the RAG group.
   - Reuse current `routes/admin/codexMemory.js`; do not restore
     `AdminPanel/js/codex-memory-monitor.js`.

3. Runtime audit, gated:
   - Port only the recall-audit writer pieces from `fb17dd0`.
   - Keep adaptive threshold changes disabled unless separately approved.
   - Add or adapt `tests/codex-memory-recall.test.js` with current prod helpers.

4. Adaptive tuning:
   - Add `RAGDiaryPlugin.codexAdaptiveRecall` to `rag_params.json` only after
     runtime audit proves stable.
   - Default `enabled` to `false` for first production landing.

5. Docs:
   - Update memory docs after implementation, not before.
   - Do not import unrelated Markdown guideline edits.

## Explicit Do-Not-Absorb List

- Do not merge `lane10-codex-memory-intake-20260425` as a branch.
- Do not restore the old `AdminPanel/js` monitoring surface.
- Do not enable adaptive recall tuning by default.
- Do not absorb unrelated Markdown output guideline changes in this lane.
- Do not rewrite or stage `Plugin/UserAuth/code.bin`.
- Do not treat already-present overview/adaptive modules as missing work.

## Current Validation

Executed:

```text
npm test
```

Result:

```text
15 subtests passed.
```

Validation limit:

This confirms the current prod Codex memory tests pass. It does not validate the
lane10 runtime recall audit behavior because that runtime patch has not been
integrated.

## Next Step

Recommended next action is documentation correction for `docs/CODEX_MEMORY_BRIDGE.md`,
then a native Vue AdminPanel page if operational monitoring is still wanted.
The runtime recall audit should remain a separate high-risk implementation phase.

# M7 Stub Untrack Remove Decision

Date: 2026-06-21

Status: DECISION_COMPLETE_NO_ACTION

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Purpose

M7 completes the stub/untrack/remove decision package without executing deletion, untracking, stubbing, or runtime dispatch changes.

The current route has enough evidence to decide what is not safe to automate yet.

## 2. Evidence Reviewed

Completed evidence:

- M2 skeleton, denylist, LocalState gate, and checksum rules are PASS.
- M3 `JennAIGentOrchestrator` copy-first pilot is PASS.
- External package commit `b4f250e` contains M3 checksum and receipt evidence.
- `MANIFEST_VERIFY_PASS count=4`.
- M4 shadow validation and rollback are PASS.
- Discovery and runtime registration remain separate.
- Exact `VCP_EXTERNAL_PLUGIN_ALLOWLIST` is required.
- Rollback can be performed by omitting process-only external env overlay.

Still not completed:

- Full parity for every old core behavior.
- Upstream PR.
- Long-term rebase workflow.
- M5/M6 implementation beyond contracts.
- Human approval for destructive core-file action.

## 3. Decision Table

| Candidate action | Decision | Reason |
| --- | --- | --- |
| Stub `Plugin/AIGentOrchestrator/` in clean core | DO_NOT_EXECUTE | Core fallback remains useful and no explicit destructive approval exists. |
| `git rm --cached` / untrack core copy | DO_NOT_EXECUTE | User hard boundary forbids automatic untrack. |
| Delete old core copy | DO_NOT_EXECUTE | User hard boundary forbids automatic delete. |
| Rewrite PluginManager dispatch to prefer external Jenn plugin | DO_NOT_EXECUTE | Execution dispatch must not change in this route. |
| Remove external package historical plugin copies | DO_NOT_EXECUTE | Not needed for M7 decision and could destroy review history. |
| Open upstream PR | DO_NOT_EXECUTE | User hard boundary forbids automatic upstream PR. |
| Keep core fallback and external package in parallel | SELECTED | Safe, reversible, already validated by M3/M4 evidence. |

## 4. Final M7 Decision

```text
Decision: keep core fallback; do not stub, untrack, remove, delete, or rewrite dispatch.
Status: DECISION_COMPLETE_NO_ACTION
Next allowed step: prepare M8 upstream PR/rebase workflow only after separate explicit approval.
```

This decision satisfies M7 by closing the decision gate, not by performing destructive action.

## 5. Required Future Approval For Destructive Action

Any future stub/untrack/remove proposal must include:

- exact target repository;
- exact branch;
- exact path list;
- source and external package commit ids;
- checksum receipt;
- shadow validation receipt;
- rollback drill receipt;
- user-owned worktree check;
- revert plan;
- explicit current-turn human approval for the destructive action.

Ambiguous continuation phrases do not authorize stub, untrack, remove, delete, merge, deploy, release, upstream PR, or dispatch rewrites.

## 6. Safety Confirmations

```text
Core files deleted: no
Core files untracked: no
Core files stubbed: no
PluginManager dispatch changed: no
Runtime env changed: no
LocalState read/copied/migrated: no
.agent_board read/copied/checksummed/migrated: no
Provider call executed: no
Bridge call executed: no
External live write executed: no
Upstream PR opened: no
```

## 7. Validation

M7 validation is documentation-only:

```powershell
git diff --check -- docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M7_STUB_UNTRACK_REMOVE_DECISION_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
rg -n "DECISION_COMPLETE_NO_ACTION|DO_NOT_EXECUTE|keep core fallback|Core files deleted: no|Core files untracked: no|Core files stubbed: no|Upstream PR opened: no" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M7_STUB_UNTRACK_REMOVE_DECISION_20260621.md
git status --short
```

Do not run `git rm`, delete files, untrack files, stub files, rewrite dispatch, open PRs, deploy, or release as part of M7.

## 8. Rollback

Rollback M7 by reverting this decision document and the tracker M7 update.

No code rollback is required because M7 performs no stub, untrack, remove, delete, dispatch rewrite, env change, provider call, bridge call, LocalState change, or upstream PR.

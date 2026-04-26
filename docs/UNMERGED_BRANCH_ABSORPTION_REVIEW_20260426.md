# Unmerged Branch Absorption Review

**Date**: 2026-04-26
**Base branch**: `prod/stable`
**Base commit**: `dc52cc0`
**Mode**: review only, no merge

This review records which remaining branches should be absorbed, rejected, or split for a later dedicated intake. It is intentionally conservative: old, duplicate, invalid, mixed, or destructive lines should not be merged into `prod/stable`.

## Current Repository State

- `prod/stable` is synced with `origin/prod/stable`.
- The only local worktree change is `Plugin/UserAuth/code.bin`.
- `Plugin/UserAuth/code.bin` is intentionally local-only and must not be restored, staged, committed, or pushed.

## Review Rules

Absorb only if a branch or commit is:

- not already patch-equivalent to `prod/stable`.
- not older than the current implementation.
- not deleting current accepted work.
- not mixing unrelated subsystems.
- not writing secrets, runtime data, local IDE state, or binary/runtime artifacts.
- small enough to validate independently.

Reject or defer if it:

- is patch-equivalent to current `prod/stable`.
- reintroduces a superseded implementation.
- deletes current AI Image, ChannelHub, DingTalk, or AdminPanel work.
- contains broad generated `AdminPanel-Vue/dist` churn.
- includes `.claude`, local runtime, `UserAuth`, or other environment-specific artifacts.
- requires production/external writes without a new safety gate.

## Decision Summary

| Branch | Decision | Reason |
|---|---|---|
| `codex/vcptoolbox-channelhub-core-20260425` | Do not absorb | `git cherry` marks the commit as patch-equivalent. ChannelHub runtime, routes, media gateway, and hardening tests already exist in `prod/stable`. |
| `codex/vcptoolbox-dingtalk-adapters-20260425` | Do not absorb | `git cherry` marks the commit as patch-equivalent. Current `prod/stable` has later DingTalkCLI/WeeklyReport safety work. |
| `codex/vcptoolbox-memory-rag-governance-20260425` | Do not absorb | `git cherry` marks the commit as patch-equivalent. Embedding fallback governance and stats route already exist. |
| `lane10-codex-memory-intake-20260425` | Defer, split-review only | Contains real new Codex memory recall audit/adaptive tuning work, but it modifies core `RAGDiaryPlugin` recall paths and writes `logs/codex-memory-recall.jsonl`. Must not be absorbed as a branch. |
| `feature/photo-studio-guide-contract-migration` | Defer, split-review only | Mixed Photo Studio guide-contract migration with older Codex memory changes and broad AdminPanel-Vue generated asset churn. |
| `feature/photo-studio-next-guide-contract` | Defer, split-review only | Mixed Photo Studio guide-contract work with live publish adapters and DingTalk changes. Some commits are already superseded by safer DingTalkCLI work. |
| `feature/latest-updates` | Defer, split-review only | Mixed candidate isolation commits, Photo Studio migration, Codex memory work, and generated frontend churn. Not safe as a branch merge. |
| `origin/custom` | Reject as branch | Historical/custom line with `.claude`, local state, AdminPanel-Vue deletion churn, old adapter work, and broad runtime changes. |
| `origin/feature-2026-04-19` | Reject as branch | Historical runtime/UserAuth/AdminPanel state line. It would conflict with current local `code.bin` policy and newer AI Image work. |
| `origin/backup-*` and `origin/safe-upstream-*` | Reject as branch | Backup/safe-upstream history lines, not feature intake branches. |

## Patch-Equivalent Lines

These branches still show as unmerged by topology, but their patch content has already been absorbed or superseded:

```text
git cherry -v prod/stable codex/vcptoolbox-channelhub-core-20260425
- 9f00142 feat: add channelhub core runtime

git cherry -v prod/stable codex/vcptoolbox-dingtalk-adapters-20260425
- e41f243 feat: add dingtalk workspace adapters

git cherry -v prod/stable codex/vcptoolbox-memory-rag-governance-20260425
- 5e9274e feat: add embedding fallback governance
```

Conclusion: do not cherry-pick or merge these branches.

## Lane10 Detailed Decision

Branch:

```text
lane10-codex-memory-intake-20260425
```

Unique commits:

```text
551f017 feat: add Codex memory recall analytics and adaptive tuning
fb17dd0 fix: wire codex recall audit into rag diary runtime
```

Observed new files or changes:

- `AdminPanel/js/codex-memory-monitor.js`
- `tests/codex-memory-recall.test.js`
- `rag_params.json` adds `RAGDiaryPlugin.codexAdaptiveRecall`
- `docs/MEMORY_SYSTEM.md`
- `docs/Markdown_Output_Guideline.md`
- `docs/PLUGIN_ECOSYSTEM.md`
- `Plugin/RAGDiaryPlugin/RAGDiaryPlugin.js`

Potential value:

- Codex recall audit records.
- adaptive recall tuning profile.
- AdminPanel monitoring UI.
- regression test for Codex recall audit payloads.

Risks:

- modifies core RAG recall paths.
- writes `logs/codex-memory-recall.jsonl`.
- imports modules that must be verified in current `prod/stable`.
- changes recall thresholds dynamically.
- may interact with current CodexMemoryBridge behavior.

Recommended split:

1. Low-risk intake: documentation and config schema review only.
2. Medium-risk intake: `tests/codex-memory-recall.test.js` adapted to current `RAGDiaryPlugin`.
3. Medium-risk intake: AdminPanel read-only monitor only after confirming matching admin APIs exist.
4. High-risk intake: runtime audit writing and adaptive tuning in `RAGDiaryPlugin`, behind explicit env/config gates.

Do not absorb lane10 as a branch.

## Photo Studio Lines

Photo Studio branches contain potentially useful guide-contract plugin work, but the branch-level diff is unsafe. It includes broad generated frontend churn and can delete or overwrite current accepted AI Image work.

Recommended approach:

1. Inventory only `plugins/custom/...` guide-contract plugin directories.
2. Compare each plugin against current `Plugin/PhotoStudio*` plugins.
3. Absorb only one plugin at a time.
4. Validate each plugin with targeted tests.
5. Do not import generated `AdminPanel-Vue/dist` churn.

Do not merge:

- `feature/photo-studio-guide-contract-migration`
- `feature/photo-studio-next-guide-contract`
- `feature/latest-updates`

## Historical Remote Lines

Do not absorb as branches:

- `origin/custom`
- `origin/feature-2026-04-19`
- `origin/backup-*`
- `origin/safe-upstream-*`

Reasons:

- historical backups or local custom snapshots.
- broad deletes and generated asset churn.
- stale ChannelHub/DingTalk/UserAuth changes.
- potential rollback of current `prod/stable` work.

## Recommended Next Action

Start a dedicated lane10 review branch or worktree only if Codex memory recall analytics is still wanted.

Safe order:

1. Create a review note for lane10 runtime gates.
2. Port only `tests/codex-memory-recall.test.js` after adapting it to current `RAGDiaryPlugin`.
3. Add config defaults without enabling behavior.
4. Add runtime audit behind an explicit disabled-by-default gate.
5. Only then consider AdminPanel monitor integration.

No current branch should be merged wholesale into `prod/stable`.

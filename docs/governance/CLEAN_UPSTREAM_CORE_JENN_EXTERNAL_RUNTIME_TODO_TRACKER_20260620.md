# Clean Core + Jenn External Runtime TODO Tracker

Progress: [#---------] 13% (13 / 100)

Last updated: 2026-06-20

Current milestone: M1 - Phase 1 clean core plugin contract internal review

Status source:

- Plan: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_ACCEPTANCE_PLAN_20260618.md`
- Current internal review PR: `JENN2046/VCPToolBox#272`
- Clean core review base: `codex/upstream-main-clean-base`
- Phase 1 implementation branch: `codex/phase1-clean-core-plugin-contract`

## 1. How To Update This Tracker

This file is the single progress source for the Clean Upstream Core + Jenn External Runtime route.

Update rules:

1. Check off completed tasks by changing `[ ]` to `[x]`.
2. Change `Status` to `PASS` only after evidence exists.
3. Record the shortest useful evidence: PR, commit, test command, checksum, or review decision.
4. Recalculate the top progress line after every completed step.
5. Update `Last updated` to the current date.

Progress rules:

- Global total is 100 points.
- Completed milestones count their full weight.
- In-progress milestones may count partial credit only when `Current score` explicitly records the credited evidence; sprint subpoints are the preferred mechanism.
- `DEFERRED` does not count as completed progress.
- Do not count a task complete just because code was written; validation or review evidence is required.

Hard boundaries:

- Do not mark Phase 2 copy-first, checksum, denylist, or LocalState work as completed by PR #272.
- Do not enter stub / untrack / remove before copy-first, checksum, shadow validation, rollback, and human approval.
- Do not automatically migrate or checksum `.agent_board/**`.
- Do not write Jenn business logic back into clean core.
- Do not treat discovery success as runtime registration success.

## 2. Global Milestone Roadmap

| Done | ID | Weight | Milestone | Status | Evidence / Next Gate |
| --- | --- | ---: | --- | --- | --- |
| [ ] | M0 | 6 | Baseline, branch, inventory, scan, and tracker setup | PARTIAL | Clean base branch and tracker exist; upstream remote record, clean-core creation record, old-fork inventory, and secret-risk scan still need explicit evidence. |
| [ ] | M1 | 12 | Clean Core Phase 1 plugin contract | PARTIAL | PR #272 head `5030dee3`; S1-S4 complete, S5 pending. |
| [ ] | M2 | 12 | External Runtime / LocalState skeleton | TODO | Needs external skeleton task book, full denylist, LocalState gate, checksum rules. |
| [ ] | M3 | 12 | `JennAIGentOrchestrator` copy-first pilot | TODO | Needs copy-first package, secret-risk scan, manifest identity, checksum. |
| [ ] | M4 | 10 | Shadow validation and rollback drill | TODO | Needs discovery, disabled, exact allowlist, rollback proof. |
| [ ] | M5 | 14 | Agent / LocalState / AdminPanel contracts | TODO | Needs `VCP_AGENT_DIRS`, `VCP_LOCAL_STATE_DIR`, Admin extension contract. |
| [ ] | M6 | 14 | AI Image / Codex-Memory / PhotoStudio externalization | TODO | Needs adapter boundaries and no private state in clean core. |
| [ ] | M7 | 10 | Stub / untrack / remove decision | TODO | Requires copy-first, checksum, validation, rollback, and human approval. |
| [ ] | M8 | 10 | Upstream PR and long-term rebase workflow | TODO | Open upstream PR only after Jenn fork internal acceptance. |

Current score:

```text
M0 partial setup credit: 3 / 6
M1 partial sprint credit: 10 / 12
Global total: 13 / 100
```

## 3. Current Sprint Checklist

Current sprint only expands M1 and M2 startup work. Later milestones remain intentionally unexpanded until their task books are written.

| Done | ID | Parent | Weight | Task | Status | Evidence |
| --- | --- | --- | ---: | --- | --- | --- |
| [x] | S1 | M1 | 3 | Establish Jenn fork internal clean-base PR flow | PASS | PR #272 base `codex/upstream-main-clean-base`; upstream PR #365 closed. |
| [x] | S2 | M1 | 4 | Implement Phase 1 plugin contract | PASS | `Plugin.js` + 4 contract modules. |
| [x] | S3 | M1 | 2 | Cover allowlist / registration / env sandbox with targeted tests | PASS | 6-test run: `63 pass / 0 fail`. |
| [x] | S4 | M1 | 1 | Record Phase 1 acceptance status in PR body | PASS | PR #272 body updated with PASS / PARTIAL / DEFERRED matrix. |
| [ ] | S5 | M1 | 2 | Close PR #272 internal review and decide ready / continue | TODO | Needs review conclusion. |
| [ ] | S6 | M2 | 3 | Write External Runtime skeleton task book | TODO | Must not change clean core. |
| [ ] | S7 | M2 | 3 | Land full denylist / `.gitignore` baseline | TODO | Must reuse existing governance denylist. |
| [ ] | S8 | M2 | 3 | Define LocalState skeleton and `.agent_board/**` human gate | TODO | `.agent_board/**` remains excluded by default. |
| [ ] | S9 | M2 | 3 | Define manifests / checksum rules | TODO | MANIFEST.sha256 generation rules required before copy-first closeout. |

M1 completion rule:

```text
S1-S5 all PASS => M1 becomes PASS and counts 12 / 12.
Current M1 progress: S1+S2+S3+S4 = 10 / 12.
```

M2 start rule:

```text
S6-S9 must be planned and accepted before copy-first migration begins.
M2 does not become PASS until External Runtime and LocalState skeletons both exist with denylist and checksum rules.
```

## 4. Deferred Domain Expansion

These domains are part of the full route but are not current-sprint implementation work.

| Domain | Future Contract | External Runtime / State Target | First Required Task |
| --- | --- | --- | --- |
| Agent | `VCP_AGENT_DIRS`, `VCP_AGENT_OVERRIDE_DIRS` | Jenn Agent and AgentOverrides | Write Agent externalization task book. |
| LocalState | `VCP_LOCAL_STATE_DIR` | Approved private memory, project data, local config | Define default exclusions and `.agent_board/**` human gate. |
| AdminPanel | Admin extension manifest / route registration | Jenn pages, APIs, menu entries | Design extension manifest and build validation. |
| AI Image | Generic adapter contract, default-off gates | Jenn fixtures, bindings, provider-specific adapters | Define adapter interface without trial/provider constants in core. |
| Codex/Memory | Generic bridge interface or no core change | CodexMemoryBridge and Jenn memory tools | Define manifest-only validation without reading private memory. |
| PhotoStudio | Generic plugin loading ability | PhotoStudio plugins, data, task templates | Define no-auto-write and data exclusion rules. |
| Governance Docs | Minimal clean-core acceptance notes | Detailed migration ledger and checksums | Decide which evidence lives outside clean core. |

## 5. Acceptance Gates Before Upstream PR

Before opening a new upstream PR to `lioensky/VCPToolBox`, the following must be true:

| Gate | Required Evidence | Status |
| --- | --- | --- |
| Jenn internal review complete | PR #272 has explicit ready / continue decision | TODO |
| Phase 1 validation stable | Syntax checks and 6-test command pass on the intended review head | PARTIAL |
| Phase boundary clear | Phase 2 copy-first/checksum/denylist remain out of PR #272 | PASS |
| No secret/runtime files | Diff contains no env, config, state, cache, log, image, or auth material | PASS for PR #272 |
| Upstream target decision | New upstream PR is opened only after internal acceptance | TODO |

## 6. Rollback Notes

For current Phase 1 work:

- Close or keep PR #272 as draft if internal review finds a blocker.
- Disable external runtime by omitting `VCP_PLUGIN_DIRS`, `VCP_PLUGIN_ALLOWED_ROOTS`, or `VCP_EXTERNAL_PLUGIN_ALLOWLIST`.
- Core fallback is not removed by PR #272.

For future Phase 2+ work:

- Do not delete or untrack core copies until copy-first, checksum, shadow validation, and rollback drill are complete.
- Every migrated domain must record rollback in its task book before implementation starts.

# M18 Agent Domain Final Closeout Decision

Date: 2026-06-21

Status: AGENT_DOMAIN_CLOSEOUT_DECISION_PASS_NO_DESTRUCTIVE_ACTION

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Purpose

M18 closes the Agent externalization domain as a decision package.

This decision package does not delete, untrack, stub, or rewrite core Agent files. It records the safe current state, deferred work, rollback map, and next-domain transition.

## 2. Evidence Reviewed

| Gate | Evidence | Status |
| --- | --- | --- |
| M9 | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M9_AGENT_EXTERNALIZATION_TASKBOOK_20260621.md` | PASS |
| M10 | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M10_AGENT_COPY_FIRST_GATE_SKELETON_RECEIPT_20260621.md` | PASS |
| M11 | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M11_AGENT_CANDIDATE_CONTENT_GATE_RECEIPT_20260621.md` | PASS |
| M12 | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M12_AGENT_CONTENT_COPY_FIRST_RECEIPT_20260621.md` | PASS |
| M13 | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M13_AGENT_SHADOW_LOADER_VALIDATION_RECEIPT_20260621.md` | PASS |
| M14 | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M14_AGENT_LOADER_CONTRACT_TEST_FIRST_RECEIPT_20260621.md` | PASS |
| M15 | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M15_AGENT_MANAGER_RUNTIME_WIRING_REVIEW_TASKBOOK_20260621.md` | PASS |
| M16 | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M16_AGENT_MANAGER_RUNTIME_WIRING_DEFAULT_OFF_RECEIPT_20260621.md` | PASS |
| M17 | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M17_AGENT_ENV_ON_SHADOW_ROLLBACK_RECEIPT_20260621.md` | PASS |

Repository evidence at closeout:

```text
core HEAD: 0634739d7dba766744ca0e99d9c1e8312bfb3f76
external HEAD: bc287826d47e89204cba536c75e9374fd6db87ab
core worktree: clean before M18 edits
external worktree: clean
real VCP_AGENT_* env: unset
```

## 3. Final Agent Domain Decision

```text
Decision: keep core Agent fallback and external Agent package in parallel.
Runtime default: off unless VCP_AGENT_DIRS / VCP_AGENT_OVERRIDE_DIRS are explicitly set.
Core fallback removal: future proposal only.
Destructive action now: none.
Next domain: LocalState route planning (M19).
```

Rationale:

- M9-M17 prove taskbook, source scan, reviewed candidate gate, copy-first, checksum, shadow validation, pure resolver, default-off runtime wiring, env-on validation, Admin read/write gate, and rollback.
- Core fallback is still useful for rollback and for duplicate additive Agent protection.
- User hard boundaries still forbid automatic delete, untrack, stub, real env mutation, LocalState migration, `.agent_board/**` migration, provider calls, bridge writes, production deploys, and upstream PR creation.

## 4. Decision Table

| Candidate action | Decision | Reason |
| --- | --- | --- |
| Keep core Agent fallback | SELECTED | Lowest-risk rollback path; current default-off runtime preserves core behavior. |
| Keep external `Agent/` + `AgentOverrides/` package | SELECTED | Copy-first and checksum evidence exists; package risk paths are `0`. |
| Activate real `.env` Agent external runtime | DEFERRED | Requires explicit operator env decision and must not be automated. |
| Add external Agent watcher support | DEFERRED | Not required for closeout; needs separate taskbook and tests. |
| Allow AdminPanel writes to external Agent roots | DEFERRED | Current gate intentionally keeps external Agent files read-only from Admin route. |
| Remove core fallback / stub core Agent files | FUTURE_PROPOSAL_ONLY | Requires exact path list, checksum evidence, rollback plan, and explicit current-turn destructive approval. |
| Open upstream PR | DEFERRED | User explicitly skipped upstream PR; M28 remains deferred. |
| Treat Agent domain as complete for Jenn fork maintenance route | SELECTED | M9-M18 are now closed without crossing hard boundaries. |

## 5. Deferred Matrix

| Deferred item | Current state | Required future gate |
| --- | --- | --- |
| Real env activation | Not done; `VCP_AGENT_*` remains unset in real environment | Operator env activation taskbook; no secret printing; rollback by unset env |
| External watcher support | Not done | Watch/cache taskbook; no LocalState or `.agent_board/**`; default-off |
| AdminPanel external Agent write support | Not done | Admin write contract; target disambiguation; external package backup/receipt |
| Core fallback removal | Not done | Destructive-action approval package; exact path list; checksums; rollback drill |
| Provider/runtime parity | Not done | No-provider first; provider call only under explicit separate approval |
| Upstream PR | Deferred | Current-turn explicit target repo/source/base/action approval |

## 6. Rollback Map

Operational rollback:

```text
unset VCP_AGENT_ALLOWED_ROOTS
unset VCP_AGENT_DIRS
unset VCP_AGENT_OVERRIDE_DIRS
keep core Agent files unchanged
```

Code rollback:

```text
revert Agent runtime wiring commits if needed:
- modules/agentRootResolver.js
- modules/agentManager.js
- routes/admin/agents.js
- tests/agent-external-root-resolver.test.js
- tests/agent-manager-external-runtime.test.js
- scripts/run-agent-env-on-shadow-rollback-harness.js
```

External package rollback:

```text
revert or reset reviewed external package commits only after confirming target repo and branch:
- 109d65e M10 skeleton
- bc28782 M12 Agent content copy-first
```

Do not use deletion of LocalState, `.agent_board/**`, secrets, cache, logs, outputs, DB/vector stores, or source core Agent files as rollback shortcuts.

## 7. Safety Confirmations

```text
Core Agent files deleted: no
Core Agent files untracked: no
Core Agent files stubbed: no
Real .env/config.env modified: no
Real VCP_AGENT_* env activated: no
LocalState content read/copied/migrated: no
.agent_board content read/copied/checksummed/migrated: no
Provider call executed: no
Bridge call executed: no
Production deploy/service startup executed: no
Live external write executed: no
Upstream PR opened: no
```

## 8. Next Safe Step

Proceed to M19:

```text
LocalState private-by-default route planning taskbook.
```

M19 remains docs/taskbook/gate planning only. It must not read, copy, checksum, or migrate real LocalState/private/operator data, and `.agent_board/**` remains blocked unless a separate explicit human gate is created and approved.

## 9. Validation

M18 validation is documentation-only:

```powershell
git diff --check
rg -n "AGENT_DOMAIN_CLOSEOUT_DECISION_PASS_NO_DESTRUCTIVE_ACTION|Decision: keep core Agent fallback|M9-M18|Core Agent files deleted: no|Real VCP_AGENT_\\* env activated: no|Upstream PR opened: no|Next domain: LocalState" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M18_AGENT_DOMAIN_FINAL_CLOSEOUT_DECISION_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
git status --short --branch
```

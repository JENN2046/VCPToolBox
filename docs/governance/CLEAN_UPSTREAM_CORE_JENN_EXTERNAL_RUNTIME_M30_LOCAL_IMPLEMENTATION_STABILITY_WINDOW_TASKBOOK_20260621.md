# M30 Local Implementation And Stability Window Taskbook

Date: 2026-06-21

Status: PASS_WINDOW_DEFINED_DOCS_ONLY

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M28_UPSTREAM_PR_DECISION_DEFERRED_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M29_JENN_FORK_MAINTENANCE_FINAL_CLOSEOUT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M31_ADMINPANEL_PERSISTENT_PACKAGE_GATE_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M32_AI_IMAGE_PROVIDER_ADAPTER_PACKAGE_GATE_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M33_CODEX_MEMORY_NO_LIVE_WRITE_PACKAGE_GATE_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M34_PHOTOSTUDIO_SOURCE_PACKAGE_GATE_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M35_AGGREGATE_FULL_LOCAL_MATRIX_REVIEW_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M36_STABLE_OPERATION_WINDOW_ENTRY_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M37_STABLE_OPERATION_WINDOW_CYCLE_1_OPENING_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M38_ACCELERATED_LOCAL_STABILITY_CLOSEOUT_RECEIPT_20260621.md`

## 1. Objective

Define the local acceptance gates for Jenn fork maintenance:

- an accelerated local stability closeout gate for finishing the current local externalization plan without calendar waiting;
- a deferred 7-day / 3-cycle calendar soak that may be used later as upstream-readiness evidence.

This taskbook defines the gates. M38 executes the accelerated local closeout gate.

M30 PASS means:

```text
local full-implementation and accelerated stability closeout gate is defined
future upstream-readiness calendar soak is defined separately
```

M30 PASS does not mean:

```text
whole local plan implemented: no
stable operation proven: no
upstream PR ready: no
runtime enabled: no
7-day calendar soak passed: no
```

## 2. Non-Goals

M30 does not:

- open, draft, update, or prepare an upstream PR
- enable external runtime in a real environment
- modify `.env`, secrets, auth material, tokens, or credentials
- call providers or generate real images
- write to bridge/live external systems
- copy, checksum, migrate, or read `.agent_board/**`
- read or copy LocalState/private/operator data
- delete, untrack, stub, or remove core fallback content
- run production deployment, production build, or production service startup

## 3. Full Local Implementation Definition

Before the full-local gate can pass, every in-scope domain must be in one of these two states:

```text
IMPLEMENTED_AND_VALIDATED
EXPLICITLY_OUT_OF_SCOPE
```

`IMPLEMENTED_AND_VALIDATED` requires all of the following evidence:

1. A taskbook that defines source lanes, private lanes, denylist, stop conditions, rollback, and validation.
2. Reviewed candidate content gate before copy-first.
3. Source path scan that is paths-only for sensitive/private lanes.
4. External target skeleton or package created only from reviewed source/package content.
5. Target paths-only secret-risk scan with `risk = 0`.
6. Manifest and checksum receipt.
7. Shadow validation that distinguishes discovery from runtime registration.
8. Default-off runtime behavior unless a separate explicit env-on local gate exists.
9. Rollback drill proving the core fallback or env-off route still works.
10. Tracker update and receipt with command evidence, commit refs, and skipped validation clearly named.

`EXPLICITLY_OUT_OF_SCOPE` requires:

- named domain or feature
- reason for exclusion
- proof that it is not required for the upstream payload being considered
- rollback/no-op statement
- confirmation that no hidden runtime dependency is being ignored

## 4. Domain Coverage Matrix

| Domain | Current state | Full-local requirement before upstream reconsideration |
| --- | --- | --- |
| Clean core plugin contract | PASS | Keep PR #272 evidence and ensure no later runtime overlay leaks into core. |
| Agent external runtime | PASS for current local route | Keep core fallback; any future core fallback removal remains out-of-scope unless separately reviewed. |
| LocalState | PASS for private-by-default skeleton | Private/operator content remains excluded; `.agent_board/**` remains blocked unless a separate human gate exists. |
| AdminPanel | PACKAGE_GATE_PASS_RUNTIME_DEFERRED | M31 persistent external package gate PASS; runtime registration, AdminPanel production build, and deployment remain deferred. |
| AI Image | PACKAGE_GATE_PASS_PROVIDER_RUNTIME_DEFERRED | M32 persistent provider-adapter package gate PASS; provider runtime, real image generation, and adapter registration remain deferred unless separately authorized. |
| Codex/Memory | PACKAGE_GATE_PASS_NO_LIVE_WRITE_RUNTIME_DEFERRED | M33 persistent bridge package gate PASS; no-live-write validation passed; runtime bridge registration, live memory writes, private memory reads, and bridge external writes remain deferred. |
| PhotoStudio | PACKAGE_GATE_PASS_NO_AUTO_WRITE_RUNTIME_DEFERRED | M34 persistent source package gate PASS; project data, LocalState/private data, external sync/publish/write, provider calls, bridge calls, and runtime registration remain deferred. |
| Aggregate full-local matrix | MATRIX_REVIEW_PASS_CLOSEOUT_READY | M35 re-ran M31-M34 package gates and confirmed package layer consistency; runtime gates remain deferred; accelerated local closeout is the next local blocker. |
| Accelerated local stability closeout | PASS | M38 records the plan change, runs two same-day revalidation rounds after M37, confirms checksum/env/no-live-write/runtime-off boundaries, and closes the local package-layer plan. |
| Calendar soak for upstream readiness | DEFERRED_OPTIONAL | M36/M37 7-day / 3-cycle calendar evidence is retained as future upstream-readiness soak only; it no longer blocks local Jenn fork closeout. |
| Core fallback removal | DEFERRED | Not required for local stability; remains future proposal only. |
| Upstream PR | DEFERRED | Still not opened; may be reconsidered only after a separate current-turn upstream decision and any then-required readiness soak. |

## 5. Local Stability Closeout And Deferred Calendar Soak

The current local plan uses two separate gates.

### 5.1 Accelerated Local Stability Closeout

The accelerated local closeout gate is the blocker for finishing the current Jenn fork local externalization route.

It can pass on the same local date when all of the following are true:

```text
core worktree clean before validation
external package worktree clean before validation
M31-M34 package gate harnesses pass in at least two fresh revalidation rounds
aggregate checksum remains unchanged
target risk counts remain 0
runtime registration refs remain 0
provider/bridge/live-write/project-data/LocalState counters remain 0
env/package switches are checked by presence only
real .env/secrets/auth/tokens/credentials are not read or modified
LocalState/private/operator data and .agent_board/** are not read/copied/checksummed/migrated
runtime remains default-off
upstream PR remains unopened
```

M38 is the receipt that executes this gate.

The accelerated closeout proves the current package-layer local implementation is coherent and repeatably validated. It does not prove production uptime, live provider behavior, runtime-on behavior, or upstream PR readiness.

### 5.2 Deferred Calendar Soak

The 7-day / 3-cycle calendar soak is retained only as future upstream-readiness evidence:

```text
minimum duration: 7 calendar days
minimum successful validation cycles: 3
cycle spacing: separate local sessions on separate days
required cycle positions: opening cycle, mid-window cycle, final-window cycle
```

The calendar soak is optional until a future upstream-readiness decision makes it required again. It must not block the current Jenn fork local closeout.

Each future calendar cycle must record:

1. Current branch and clean worktree status before validation.
2. Current commit refs for core repo and external package repo, when applicable.
3. Environment sanity check showing real env/config/secret files were not modified.
4. Manifest/checksum verification for all in-scope external packages.
5. Paths-only secret-risk scan for changed external targets and approved package paths.
6. Targeted no-live-write/no-provider/default-off tests for relevant domains.
7. Runtime registration proof only when runtime is intentionally enabled in a local controlled gate.
8. Rollback evidence for the most recently changed domain and global env-off fallback.
9. Known failures, skipped checks, and whether the window must reset.

Discovery success alone cannot satisfy either gate. A package being found is not proof that runtime registration, default-off behavior, rollback, or no-live-write behavior is correct.

## 6. Reset Rules

The accelerated closeout must be marked BLOCK or reset if any of the following occur before its receipt is committed:

- a validation cycle fails for runtime behavior, checksum integrity, secret-risk scan, rollback, no-live-write, or no-provider safety
- a new in-scope external package or runtime wiring change lands after the validation baseline
- any real `.env`, secret, auth material, token, or credential is modified
- a provider call, bridge live write, production deployment, or upstream remote write happens
- LocalState/private/operator data is read or copied outside an explicit approved gate
- `.agent_board/**` is read, copied, checksummed, or migrated without its separate human gate
- a deferred domain is silently treated as implemented without receipt evidence

If a future 7-day calendar soak is used, the same events reset that soak window.

Documentation-only typo fixes do not reset the window if they do not change scope, validation evidence, runtime behavior, package content, checksums, or rollback guarantees.

## 7. Deferred Domain Progression Rule

Deferred domains may be advanced locally before any optional calendar soak, but each domain must pass a domain-level mini-gate before the next domain starts:

```text
taskbook or existing taskbook reviewed
source path scan complete
reviewed candidate gate complete
target skeleton/package created only from allowed content
target scan risk = 0
manifest/checksum receipt written
targeted shadow/no-live validation passed
rollback drill passed
tracker updated
runtime remains default-off unless a separate explicit local env-on gate exists
```

Recommended local progression order:

1. AdminPanel persistent package gate without route registration or production build. Completed by M31.
2. AI Image provider-adapter package structure with no-provider validation. Completed by M32.
3. Codex/Memory no-live-write fixture/package gate. Completed by M33.
4. PhotoStudio source/package gate excluding project data. Completed by M34.
5. Aggregate full-local matrix review. Completed by M35.
6. Accelerated local stability closeout. Completed by M38.
7. Optional 7-day upstream-readiness soak. Defined by M36 and opened by M37, but deferred unless a later upstream decision requires it.

This order is a default. It may be changed by `PLAN_CHANGE` if the reason, risk, and validation impact are recorded before execution.

## 8. Required Receipts

The accelerated local closeout receipt uses this shape:

```text
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M38_ACCELERATED_LOCAL_STABILITY_CLOSEOUT_RECEIPT_YYYYMMDD.md
```

Any future calendar soak receipt uses this shape:

```text
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M##_LOCAL_STABILITY_WINDOW_RECEIPT_YYYYMMDD.md
```

The receipt must include:

- in-scope / out-of-scope matrix
- validation cycle timestamps and command evidence
- package commit refs and manifest checksum summaries
- skipped validation with reasons
- reset events, if any
- rollback evidence
- final PASS / BLOCK decision
- explicit statement that upstream PR remains deferred unless separately authorized

## 9. Stop Conditions

Stop and report before continuing if:

- a domain requires real provider credentials or live external writes
- a test requires production deployment, production service startup, or bridge enablement
- a package needs private LocalState/operator data
- `.agent_board/**` would need to be read or migrated
- source and target checksum evidence disagree
- rollback cannot be proven without deleting or untracking core fallback content
- worktree contains unrelated user-owned changes that would be overwritten

## 10. Rollback

Rollback for this taskbook:

```text
revert this M30 document and the tracker M30/S51 update
```

Rollback for future domain execution remains domain-specific and must be defined before that domain is modified.

## 11. Safety Confirmations

```text
Runtime code modified by M30: no
External package content copied by M30: no
Remote upstream PR opened: no
Remote upstream branch pushed: no
Real env/secret/auth material modified: no
Provider call executed: no
Bridge live write executed: no
LocalState/private content read: no
.agent_board content read/copied/checksummed/migrated: no
Delete/untrack/stub executed: no
Deployment executed: no
```

## 12. Acceptance

M30 is PASS when this taskbook is committed and the tracker records that the full-local-implementation and local stability gates are defined.

The accelerated local closeout gate is passed by M38. The optional 7-day calendar soak remains NOT PASSED and does not block local Jenn fork closeout unless a future upstream-readiness decision explicitly reinstates it.

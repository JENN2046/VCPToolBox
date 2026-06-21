# M36 Stable Operation Window Entry

Date: 2026-06-21

Status: PASS_ENTRY_DEFINED_CALENDAR_SOAK_DEFERRED_BY_M38

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related taskbooks / receipts:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M30_LOCAL_IMPLEMENTATION_STABILITY_WINDOW_TASKBOOK_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M35_AGGREGATE_FULL_LOCAL_MATRIX_REVIEW_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M37_STABLE_OPERATION_WINDOW_CYCLE_1_OPENING_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M38_ACCELERATED_LOCAL_STABILITY_CLOSEOUT_RECEIPT_20260621.md`

## 1. Purpose

M36 creates the formal entry point for the 7-day / 3-cycle calendar soak.

M36 does not start the soak. It defines how the soak can be started, what evidence each cycle must collect, what resets the soak, and what remains forbidden.

M38 later changes the local closeout policy: this calendar soak is retained as future upstream-readiness evidence only. It no longer blocks the accelerated Jenn fork local closeout.

## 2. Baseline Refs

Core repository:

```text
A:/AGENTS_OS_Workspace/runtime/VCPToolBox
branch: codex/m2-m7-jenn-external-runtime-roadmap
pre-entry HEAD: ad36dd79fd1c205c77837ec33724d676909a90ac
```

External package repository:

```text
A:/AGENTS_OS_Workspace/runtime/VCPToolBox-JENN-Extensions
branch: main
current HEAD: 3a63904e753aa8b8869f588fc0b8fc862354e123
```

Latest aggregate package evidence:

```text
M35 aggregate matrix review: PASS
current aggregate checksum manifest: 9e01af36f0ecd99c27294addc99d44d6592a5883fb5b41b2e2ee585f721809fd
M31-M34 package harnesses: PASS
runtime registration refs: 0 for package gates
```

## 3. Window Status

```text
7-day calendar soak started by M37 opening receipt: yes
opening cycle executed: yes
mid-window cycle executed: no
final-window cycle executed: no
accelerated local closeout gate passed by M38: yes
calendar soak passed: no
upstream PR authorized/opened: no
```

The calendar-soak clock starts only when an opening-cycle receipt explicitly records:

```text
WINDOW_START=yes
cycle position: opening
cycle timestamp
core HEAD
external package HEAD
validation commands and results
reset conditions checked
```

## 4. Required Calendar Soak Shape

If a future upstream-readiness decision requires the calendar soak, it must satisfy all of M30:

```text
minimum duration: 7 calendar days
minimum successful validation cycles: 3
cycle spacing: separate local sessions on separate days
required cycle positions: opening cycle, mid-window cycle, final-window cycle
```

Future calendar-soak receipts should use this shape:

```text
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M##_STABLE_OPERATION_WINDOW_CYCLE_1_OPENING_RECEIPT_YYYYMMDD.md
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M##_STABLE_OPERATION_WINDOW_CYCLE_2_MID_RECEIPT_YYYYMMDD.md
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M##_STABLE_OPERATION_WINDOW_CYCLE_3_FINAL_RECEIPT_YYYYMMDD.md
```

Do not assign the future `M##` numbers until the cycle is actually required, started, and recorded in the tracker.

## 5. Required Calendar Cycle Evidence

Every future calendar cycle receipt must include:

1. Core branch, worktree status, and HEAD.
2. External package branch, worktree status, and HEAD.
3. Environment sanity check for package/runtime env vars.
4. Confirmation that real `.env`, secrets, auth material, tokens, and credentials were not modified.
5. Current aggregate package checksum manifest hash.
6. M31-M34 package gate harness results, or a narrower documented replacement if the cycle scope changes.
7. Paths-only secret-risk scan status for reviewed package roots.
8. Runtime registration proof only if a separate explicit local runtime gate is started; otherwise `not enabled`.
9. Rollback evidence or rollback statement for the latest package layer.
10. Reset-condition checklist.
11. Explicit `upstream PR opened: no` unless a later current-turn upstream authorization exists after the required local and optional-soak evidence is reviewed.

## 6. Reset Conditions

The calendar soak must reset if any of these happen after an opening cycle:

```text
package checksum changes
new in-scope external package content lands
runtime wiring changes
any package gate harness fails
real env/secret/auth/token/credential is modified
provider call executes
bridge live write executes
production deploy/build/startup is used as validation
LocalState/private/operator data is read or copied outside an explicit gate
.agent_board/** is read/copied/checksummed/migrated
upstream PR is opened without current-turn explicit upstream authorization
core fallback content is deleted/untracked/stubbed
```

Documentation-only clarifications do not reset a future soak if they do not change scope, validation evidence, runtime behavior, package content, checksums, or rollback guarantees.

## 7. Forbidden During Entry

M36 did not and does not authorize:

```text
runtime package registration
AdminPanel production build or deploy
AI Image provider runtime or real image generation
Codex/Memory live write or private memory read
PhotoStudio real project data read/write or external sync/publish/write
LocalState/private/operator data read/copy
.agent_board/** read/copy/checksum/migration
real .env/secret/auth/token/credential modification
bridge/provider/live external write
delete/untrack/stub of core fallback
upstream PR
```

## 8. Acceptance

M36 is PASS only for the calendar-soak entry definition because:

- M30 already defined the stability closeout and optional calendar-soak contracts;
- M35 confirmed M31-M34 package layer consistency;
- M36 defines the future calendar cycle receipt shape, required evidence, reset conditions, and stop boundaries;
- no runtime, provider, bridge, private data, deployment, fallback removal, or upstream PR action was executed.

M36 does not prove stable operation. After M38, the 7-day / 3-cycle calendar soak is optional future upstream-readiness evidence and is not the blocker for local Jenn fork closeout.

## 9. Rollback

Rollback M36 by reverting:

```text
core governance commit that records this M36 entry and tracker update
```

No external package rollback is required for M36 because it is docs-only and creates no external package content.

## 10. Next Decision

The local next decision moved to M38 accelerated closeout.

Future mid/final calendar-soak cycles should only be resumed if a later upstream-readiness decision explicitly requires calendar soak evidence.

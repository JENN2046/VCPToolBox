# M36 Stable Operation Window Entry

Date: 2026-06-21

Status: PASS_ENTRY_DEFINED_WINDOW_NOT_STARTED

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related taskbooks / receipts:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M30_LOCAL_IMPLEMENTATION_STABILITY_WINDOW_TASKBOOK_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M35_AGGREGATE_FULL_LOCAL_MATRIX_REVIEW_20260621.md`

## 1. Purpose

M36 creates the formal entry point for the 7-day / 3-cycle stable-operation window.

M36 does not start the window. It defines how the window can be started, what evidence each cycle must collect, what resets the window, and what remains forbidden.

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
7-day stable-operation window started: no
opening cycle executed: no
mid-window cycle executed: no
final-window cycle executed: no
full-local/stability gate passed: no
upstream PR authorized/opened: no
```

The clock starts only when a future opening-cycle receipt explicitly records:

```text
WINDOW_START=yes
cycle position: opening
cycle timestamp
core HEAD
external package HEAD
validation commands and results
reset conditions checked
```

## 4. Required Window Shape

The window must satisfy all of M30:

```text
minimum duration: 7 calendar days
minimum successful validation cycles: 3
cycle spacing: separate local sessions on separate days
required cycle positions: opening cycle, mid-window cycle, final-window cycle
```

Future cycle receipts should use this shape:

```text
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M##_STABLE_OPERATION_WINDOW_CYCLE_1_OPENING_RECEIPT_YYYYMMDD.md
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M##_STABLE_OPERATION_WINDOW_CYCLE_2_MID_RECEIPT_YYYYMMDD.md
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M##_STABLE_OPERATION_WINDOW_CYCLE_3_FINAL_RECEIPT_YYYYMMDD.md
```

Do not assign the future `M##` numbers until the cycle is actually started and recorded in the tracker.

## 5. Required Cycle Evidence

Every cycle receipt must include:

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
11. Explicit `upstream PR opened: no` unless a later full-local/stability PASS and current-turn upstream authorization both exist.

## 6. Reset Conditions

The window must reset if any of these happen after an opening cycle:

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
upstream PR is opened before full-local/stability PASS
core fallback content is deleted/untracked/stubbed
```

Documentation-only clarifications do not reset a future window if they do not change scope, validation evidence, runtime behavior, package content, checksums, or rollback guarantees.

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

M36 is PASS only for the stable-operation window entry definition because:

- M30 already defined the stability window contract;
- M35 confirmed M31-M34 package layer consistency;
- M36 defines the future cycle receipt shape, required evidence, reset conditions, and stop boundaries;
- no runtime, provider, bridge, private data, deployment, fallback removal, or upstream PR action was executed.

M36 does not prove stable operation. The 7-day / 3-cycle window remains not started.

## 9. Rollback

Rollback M36 by reverting:

```text
core governance commit that records this M36 entry and tracker update
```

No external package rollback is required for M36 because it is docs-only and creates no external package content.

## 10. Next Decision

The next decision is whether to start the opening cycle.

Starting cycle 1 requires a new receipt that explicitly records `WINDOW_START=yes`. Until then, the stability window remains deferred.

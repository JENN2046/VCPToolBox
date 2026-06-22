# M112 Next Unextracted Domain Decision

Date: 2026-06-22

Status: PASS_DECISION_ONLY_NO_IMPLEMENTATION

Decision: `SELECT_PLUGIN_EXISTING_EXTERNAL_RECONCILE_TASKBOOK`

Parent receipt: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M111_PUSHED_STATE_AGGREGATE_CLOSEOUT_RECEIPT_20260622.md`

Tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Purpose

M112 selects the next narrow unextracted or unresolved domain after the pushed-state checkpoint.

It is decision-only. It does not copy files, modify runtime code, write env, enable runtime registration, start services, read private content, delete core fallback, or open upstream PRs.

## 2. Inputs Reviewed

| Input | Relevant result |
| --- | --- |
| M86 gap matrix | Remaining gaps include plugin reconcile items, Agent additive blocker, AdminPanel deferred dynamic runtime, Codex/Memory runtime, PhotoStudio runtime/data, LocalState/private, and stub/remove/untrack. |
| M87 plugin candidate gate | 11 plugin candidates scanned; 9 copied later; 2 existing external plugin dirs were classified as reconcile/no-overwrite. |
| M88 plugin copy-first wave | 9 missing plugin dirs copied; existing external dirs were not overwritten. |
| M89 plugin shadow/default-off validation | external `Plugin/` package integrity and default-off validation PASS; runtime registration remains off. |
| M111 pushed-state receipt | core and external commits pushed and origin-aligned before this new route decision. |

## 3. Remaining Candidate Lanes

| Candidate lane | Current state | M112 decision |
| --- | --- | --- |
| Existing external plugin reconcile | Two pre-existing external plugin dirs were intentionally not overwritten in M87/M88. | SELECTED as next low-risk taskbook. |
| Agent additive resolver/runtime | M100 BLOCK: effective source remains core for same-id additive files. | Defer; requires resolver/core fallback policy design. |
| AdminPanel dynamic external frontend/API runtime | static/core fallback and metadata-only package closed; dynamic runtime still deferred. | Defer; higher runtime/UI surface. |
| Codex/Memory runtime | persistent package exists; live write/private memory runtime deferred. | Defer; private/live-write-adjacent. |
| PhotoStudio runtime/data | source package exists; real data roots/external sync/write deferred. | Defer; project-data/external-write-adjacent. |
| LocalState/private | private-by-default skeleton/gates exist. | BLOCKED unless explicit private gate. |
| Stub/remove/untrack/core fallback retirement | explicitly deferred. | Defer; requires future decision package only. |
| Upstream PR | explicitly deferred. | Defer; requires future current-turn upstream PR authorization. |

## 4. Selected Next Gate

```text
NEXT_SELECTED_GATE=M113_PLUGIN_EXISTING_EXTERNAL_RECONCILE_TASKBOOK
```

M113 should be taskbook-only and should cover only:

```text
Plugin/AIGentOrchestrator/**
Plugin/AIGentQuality/**
```

M113 should decide how to compare the existing external package directories against current core fallback directories without overwriting them automatically.

## 5. M113 Allowed Shape

Allowed in M113:

```text
path-only existence checks
manifest/checksum status checks
commit/history references for existing external plugin dirs
taskbook-only reconcile options
future validation plan
rollback plan
stop line
```

Not allowed in M113:

```text
copying or overwriting plugin content
enabling VCP_PLUGIN_DIRS
editing real config.env or .env
executing plugin entrypoints
starting production server
reading LocalState/private/.agent_board/**
deleting, stubbing, untracking, or removing core Plugin/**
opening upstream PR
committing or pushing without explicit authorization
```

## 6. Why This Comes Before Other Lanes

The plugin reconcile lane is the lowest-risk remaining unresolved extraction lane because:

```text
it is package-level rather than runtime-on
it can start with path and manifest evidence only
it avoids private/operator data
it avoids provider calls and bridge/live writes
it avoids dynamic frontend runtime
it avoids core fallback deletion
```

This keeps the route moving without jumping into LocalState/private, live-write, provider, production, or irreversible cleanup gates.

## 7. Rollback

M112 rollback is docs-only:

```text
git revert <M112 docs/tracker commit>
```

No package/runtime/env rollback is required because M112 performs no implementation.

## 8. Result

```text
M112_NEXT_UNEXTRACTED_DOMAIN_DECISION_PASS=yes
DECISION_ONLY=yes
SELECTED_NEXT_GATE=M113_PLUGIN_EXISTING_EXTERNAL_RECONCILE_TASKBOOK
COPY_EXECUTED=no
RUNTIME_ENABLED=no
REAL_CONFIG_ENV_WRITTEN=no
PRIVATE_CONTENT_READ=no
UPSTREAM_PR_OPENED=no
```

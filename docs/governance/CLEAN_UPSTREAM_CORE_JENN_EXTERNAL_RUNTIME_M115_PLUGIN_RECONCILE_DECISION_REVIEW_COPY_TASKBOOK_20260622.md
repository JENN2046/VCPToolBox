# M115 Plugin Reconcile Decision / Review-Copy Taskbook

Date: 2026-06-22

Status: PASS_DECISION_TASKBOOK_ONLY_NO_COPY_NO_RUNTIME

Parent receipt: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M114_PLUGIN_EXISTING_EXTERNAL_RECONCILE_EVIDENCE_GATE_20260622.md`

Tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Purpose

M115 converts the M114 evidence-only classification into the next safe reconcile route.

This gate is decision/taskbook-only. It does not copy, overwrite, delete, untrack, stub, enable plugin runtime, execute plugin entrypoints, write env, start services, read private content, or open upstream PRs.

## 2. Inputs Reviewed

| Input | Relevant result |
| --- | --- |
| M113 taskbook | existing external plugin dirs must use a no-overwrite reconcile path. |
| M114 evidence gate | `Plugin/AIGentOrchestrator/**` shared hashes match; only core has `.disabled`. |
| M114 evidence gate | `Plugin/AIGentQuality/**` path set matches, but 3 shared files differ by SHA256. |

## 3. Decision Matrix

| Plugin path | M114 classification | M115 decision | Rationale |
| --- | --- | --- | --- |
| `Plugin/AIGentOrchestrator/**` | KEEP_EXISTING_EXTERNAL | KEEP_EXISTING_EXTERNAL_NO_FURTHER_COPY | Shared files match; the only difference is the core-only `.disabled` marker. |
| `Plugin/AIGentQuality/**` | NEEDS_REVIEW_COPY | WRITE_M116_TEMP_REVIEW_COPY_TASKBOOK | Hash differences require a narrow review route before any copy, overwrite, or keep-as-fork decision. |

## 4. M116 Taskbook Shape

Recommended next gate:

```text
NEXT_RECOMMENDED_GATE=M116_AIGENTQUALITY_TEMP_REVIEW_COPY_TASKBOOK
```

M116 should be taskbook-only unless separately expanded. It should define:

```text
exact temporary review-copy root outside active external Plugin/
source allowlist limited to Plugin/AIGentQuality/**
target cleanup rule
checksum comparison rule
no source body print rule
review outcomes: KEEP_EXISTING_EXTERNAL_AS_FORK_SPECIFIC, PROMOTE_REVIEWED_COPY_LATER, or BLOCK
rollback rule
stop line before active external overwrite
```

M116 should not copy into:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\AIGentQuality\
```

## 5. Allowed Future Work For M116

Allowed in M116 taskbook:

```text
define temp review-copy path
define exact source path allowlist
define path-risk and checksum commands
define cleanup and rollback
define future M117 decision gate
```

Forbidden in M116 taskbook:

```text
copy content now
overwrite active external Plugin/AIGentQuality/**
enable VCP_PLUGIN_DIRS
edit real config.env or .env
execute plugin entrypoints
start production server
read LocalState/private/.agent_board/**
delete, stub, untrack, or remove core Plugin/**
open upstream PR
commit or push without explicit authorization
```

## 6. Rollback

M115 rollback is docs-only:

```text
git revert <M115 docs/tracker commit>
```

No package/runtime/env rollback is required because M115 performs no implementation.

## 7. Result

```text
M115_PLUGIN_RECONCILE_DECISION_REVIEW_COPY_TASKBOOK_PASS=yes
DECISION_TASKBOOK_ONLY=yes
AIGENT_ORCHESTRATOR_DECISION=KEEP_EXISTING_EXTERNAL_NO_FURTHER_COPY
AIGENT_QUALITY_DECISION=WRITE_M116_TEMP_REVIEW_COPY_TASKBOOK
COPY_EXECUTED=no
OVERWRITE_EXECUTED=no
RUNTIME_ENABLED=no
REAL_CONFIG_ENV_WRITTEN=no
PRIVATE_CONTENT_READ=no
UPSTREAM_PR_OPENED=no
NEXT_RECOMMENDED_GATE=M116_AIGENTQUALITY_TEMP_REVIEW_COPY_TASKBOOK
```

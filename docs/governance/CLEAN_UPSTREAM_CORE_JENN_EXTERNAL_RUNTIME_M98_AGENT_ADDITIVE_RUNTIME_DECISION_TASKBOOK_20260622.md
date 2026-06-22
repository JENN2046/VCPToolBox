# M98 Agent Additive Runtime Decision Taskbook

Date: 2026-06-22

Status: PASS_TASKBOOK_ONLY_NO_RUNTIME_ENABLEMENT

Decision: `SELECT_M99_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_TASKBOOK`

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M18_AGENT_DOMAIN_FINAL_CLOSEOUT_DECISION_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M45_AGENTOVERRIDES_RUNTIME_ON_AGGREGATE_REVIEW_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M85_JENN_FORK_LOCAL_RUNTIME_ROUTE_FINAL_CLOSEOUT_RECEIPT_20260622.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M86_EXTRACTION_GAP_MATRIX_20260622.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M97_AGGREGATE_GAP_NEXT_LANE_DECISION_20260622.md`

## 1. Scope

M98 is a decision taskbook only. It decides the next safe shape for the Agent additive lane.

M98 does not:

```text
write real config.env or .env
enable VCP_AGENT_DIRS
change VCP_AGENT_ALLOWED_ROOTS
change VCP_AGENT_OVERRIDE_DIRS
modify AgentManager or agentRootResolver runtime behavior
copy additional Agent content
delete, untrack, stub, or remove core Agent fallback files
allow AdminPanel writes to external Agent roots
read LocalState/private/operator content
read, checksum, copy, or migrate .agent_board/**
start production server
call providers, bridges, live writes, sync, publish, or deployment endpoints
open upstream PR
```

## 2. Current Agent State

Current state is evidence-backed by M18, M45, M85, M86, and M97:

| Lane | Current state | Runtime state |
| --- | --- | --- |
| Additive external `Agent/` | 7 reviewed Agent files copied to external package | `COPIED_NOT_RUNTIME_ON` |
| External `AgentOverrides/` | `Metis` and `Nova` copied to external package | `OVERRIDE_RUNTIME_ON` |
| Real local config | `VCP_AGENT_ALLOWED_ROOTS` and `VCP_AGENT_OVERRIDE_DIRS` were previously authorized | override-only |
| Additive env key | `VCP_AGENT_DIRS` line count remains `0` | disabled |
| Core Agent fallback | all 9 core Agent files retained | fallback retained |

M86 Agent counts remain the governing baseline:

```text
PLAN_AGENT_ITEMS=9
COPIED_TO_EXTERNAL=9
OVERRIDE_RUNTIME_ON=2
ADDITIVE_RUNTIME_ON=0
CORE_AGENT_FALLBACK_RETAINED=9
AGENT_STUB_REMOVE_UNTRACK_EXECUTED=0
```

## 3. Decision Matrix

| Candidate action | M98 decision | Reason |
| --- | --- | --- |
| Enable real `VCP_AGENT_DIRS` now | BLOCKED | This would mutate real runtime config and activate additive roots without a fresh scoped duplicate/fallback review. |
| Modify AgentManager ordering or duplicate behavior now | BLOCKED | Runtime semantics are source code behavior and need a separate test-first gate. |
| Delete, untrack, stub, or remove core Agent fallback now | BLOCKED | Destructive/fallback-removal work remains future explicit proposal only. |
| Allow AdminPanel writes to external `Agent/` now | BLOCKED | M44/M45 proved external Agent write remains blocked; changing that needs a separate write contract. |
| Keep additive lane deferred forever | NOT_SELECTED_NOW | The package is already copied and low-risk enough for a scoped shadow taskbook, but not for real enablement. |
| Write a scoped shadow validation taskbook next | SELECTED | This preserves speed while keeping real config, production runtime, private lanes, and core fallback untouched. |

Selected next gate:

```text
M99_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_TASKBOOK
```

## 4. M99 Taskbook Requirements

M99, if executed, must stay taskbook-only unless a later current-turn instruction explicitly authorizes a test harness implementation.

Required M99 contents:

```text
define scoped process.env-only validation shape
define exact additive candidate list: 7 external Agent/*.txt files
define duplicate/core fallback expectations
define root allowlist and ordering expectations
define no-production-server validation commands
define rollback shape by restoring process.env only
define expected BLOCK reasons before any real VCP_AGENT_DIRS write
```

M99 must require that any future harness:

```text
uses temporary scoped env only
does not write real config.env or .env
does not print prompt body or secret/env values
does not start production server
does not call provider, bridge, live write, sync, publish, or deploy endpoints
does not read LocalState/private/operator content
does not read/checksum .agent_board/**
does not delete/stub/untrack core Agent fallback files
does not let AdminPanel write external Agent files
```

## 5. Future Real-Config Stop Line

Real additive enablement is not part of M98 or M99.

Before any future real `VCP_AGENT_DIRS` write, the route must have at least:

```text
scoped additive shadow validation PASS
duplicate/core fallback behavior explicitly reviewed
Admin external write guard still PASS
rollback drill shape written
redacted real-config unlock decision gate written
current-turn explicit authorization for the exact env key write
```

Even after those conditions, enabling `VCP_AGENT_DIRS` would still not authorize:

```text
core Agent fallback removal
AdminPanel external Agent writes
LocalState/private reads
.agent_board/** handling
provider/bridge/live writes
production deploy
upstream PR
```

## 6. Validation

M98 validation is documentation-only:

```powershell
git diff --check
changed-path risk scan
secret-shape scan over M98/tracker docs
git diff --cached --check
staged path-risk scan
staged secret-shape scan
```

No runtime, build, production server, provider call, bridge write, live external write, private data read, or real config write is required or allowed.

## 7. Rollback

M98 rollback is docs-only:

```text
git revert <M98 core commit>
```

Rollback must not touch external package content, real config, core Agent files, LocalState/private data, `.agent_board/**`, build artifacts, or upstream PR state.

## 8. Result

```text
M98_AGENT_ADDITIVE_RUNTIME_DECISION_TASKBOOK_PASS=yes
NEXT_GATE=M99_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_TASKBOOK
VCP_AGENT_DIRS_ENABLED=no
REAL_CONFIG_ENV_WRITTEN=no
AGENTMANAGER_RUNTIME_CHANGED=no
ADDITIONAL_AGENT_CONTENT_COPIED=no
CORE_AGENT_FALLBACK_REMOVED=no
ADMIN_EXTERNAL_AGENT_WRITE_ENABLED=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
PRODUCTION_SERVER_STARTED=no
PROVIDER_OR_BRIDGE_OR_LIVE_WRITE_EXECUTED=no
UPSTREAM_PR_OPENED=no
```

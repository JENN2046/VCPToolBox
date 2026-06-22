# M101 Agent Additive Blocker / Defer Decision

Date: 2026-06-22

Status: PASS_DECISION_ONLY_NO_RUNTIME_NO_SOURCE_CHANGE

Decision: `SELECT_M102_AGENT_ADDITIVE_COLLISION_RESOLUTION_TASKBOOK`

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M40_AGENT_REAL_CONFIG_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M46_NEXT_RUNTIME_LANE_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M98_AGENT_ADDITIVE_RUNTIME_DECISION_TASKBOOK_20260622.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M99_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_TASKBOOK_20260622.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M100_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_RECEIPT_20260622.md`

## 1. Scope

M101 is decision-only.

M101 does not:

```text
write real config.env or .env
enable real VCP_AGENT_DIRS
modify AgentManager or AgentRootResolver
modify routes/admin/agents.js
modify tests/**
copy additional Agent content
modify external package content
delete, untrack, stub, rename, or remove core Agent fallback files
change agent_map.json
read LocalState/private/operator content
read, checksum, copy, or migrate .agent_board/**
start production server
call provider, bridge, live write, sync, publish, or deployment endpoints
open upstream PR
```

## 2. M100 Reality

M100 proved both sides of the current state:

```text
ADDITIVE_EXTERNAL_SOURCE_COUNT=7
ADDITIVE_EFFECTIVE_EXTERNAL_SOURCE_COUNT=0
ADDITIVE_EFFECTIVE_SOURCE_MARKERS=core:7
ADDITIVE_DUPLICATE_CORE_DIAGNOSTIC_COUNT=7
OVERRIDE_EXTERNAL_SOURCE_COUNT=2
CORE_AGENT_FALLBACK_RETAINED=9
REAL_CONFIG_ENV_WRITTEN=no
VCP_AGENT_DIRS_REAL_CONFIG_ENABLED=no
AGENTMANAGER_RUNTIME_CHANGED=no
```

Therefore, enabling real `VCP_AGENT_DIRS` now would not make the 7 copied additive Agents effective external sources while same-id core fallback files remain retained.

## 3. Decision Options

| Option | Action | Risk | Allowed now |
| --- | --- | --- | --- |
| A | Keep additive Agent runtime deferred; continue using AgentOverrides only | Low | Yes |
| B | Write a taskbook for additive same-id collision resolution | Low if docs-only | Yes |
| C | Write a taskbook for core fallback removal/stub/untrack decision package | Medium/high; execution forbidden | Taskbook only |
| D | Write a taskbook for resolver policy change, such as explicit external shadowing | High; source change required later | Taskbook only |
| E | Enable real `VCP_AGENT_DIRS` now | Misleading and ineffective under current resolver | No |
| F | Delete/stub/untrack core fallback now | Forbidden by current hard boundary | No |
| G | Modify AgentManager/AgentRootResolver now | Out of current safe scope | No |

## 4. Selected Route

M101 selects:

```text
SELECT_M102_AGENT_ADDITIVE_COLLISION_RESOLUTION_TASKBOOK
```

M102 must be taskbook-only. It should compare the collision-resolution routes without executing them:

```text
keep additive runtime deferred
rename or remap external additive ids
prepare a core fallback removal/stub/untrack decision package
prepare a resolver policy change taskbook
```

M102 must not choose or execute a destructive/source-changing path automatically.

## 5. Current Operational State

```text
AGENTOVERRIDES_RUNTIME_ON=yes
ADDITIVE_AGENT_PACKAGE_COPIED=yes
ADDITIVE_AGENT_PACKAGE_SCANNED=yes
ADDITIVE_AGENT_EFFECTIVE_EXTERNAL_SOURCE=no
REAL_VCP_AGENT_DIRS_ENABLED=no
CORE_AGENT_FALLBACK_RETAINED=yes
CORE_FALLBACK_REMOVE_STUB_UNTRACK_EXECUTED=no
RUNTIME_SOURCE_CHANGED=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
UPSTREAM_PR_OPENED=no
```

## 6. Stop Conditions

Stop before:

```text
real VCP_AGENT_DIRS write
real config.env or .env edit
AgentManager / AgentRootResolver source change
core Agent fallback deletion, untrack, stub, rename, or content edit
agent_map.json edit
external package content mutation
LocalState/private/.agent_board content read
production server / provider / bridge / live write
upstream PR
```

Any of those requires a separate, explicit current-turn authorization and a narrower implementation gate.

## 7. Rollback

M101 rollback is docs-only:

```text
git revert <M101 docs commit>
```

No env, source, external package, private data, or core Agent rollback is required because M101 did not change them.

## 8. Result

```text
M101_AGENT_ADDITIVE_BLOCKER_DEFER_DECISION_PASS=yes
DECISION=SELECT_M102_AGENT_ADDITIVE_COLLISION_RESOLUTION_TASKBOOK
REAL_CONFIG_ENV_WRITTEN=no
VCP_AGENT_DIRS_ENABLED=no
AGENTMANAGER_RUNTIME_CHANGED=no
CORE_AGENT_FALLBACK_REMOVED=no
CORE_AGENT_FALLBACK_STUBBED=no
CORE_AGENT_FALLBACK_UNTRACKED=no
EXTERNAL_PACKAGE_MODIFIED=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
PRODUCTION_SERVER_STARTED=no
PROVIDER_OR_BRIDGE_OR_LIVE_WRITE_EXECUTED=no
UPSTREAM_PR_OPENED=no
NEXT_SAFE_GATE=M102_AGENT_ADDITIVE_COLLISION_RESOLUTION_TASKBOOK
```

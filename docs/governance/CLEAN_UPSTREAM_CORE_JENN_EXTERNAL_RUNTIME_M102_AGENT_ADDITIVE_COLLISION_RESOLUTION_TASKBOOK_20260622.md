# M102 Agent Additive Collision Resolution Taskbook

Date: 2026-06-22

Status: PASS_TASKBOOK_ONLY_NO_RUNTIME_NO_SOURCE_CHANGE

Decision: `STOP_BEFORE_AGENT_ADDITIVE_COLLISION_IMPLEMENTATION`

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Previous decision: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M101_AGENT_ADDITIVE_BLOCKER_DEFER_DECISION_20260622.md`

Blocking evidence: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M100_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_RECEIPT_20260622.md`

## 1. Scope

M102 is taskbook-only. It defines how to evaluate collision-resolution routes for the 7 copied additive Agent files that currently collide with retained core fallback ids.

M102 does not:

```text
write real config.env or .env
enable VCP_AGENT_DIRS
modify AgentManager or AgentRootResolver
modify routes/admin/agents.js
modify tests/**
modify agent_map.json
modify external package content
delete, untrack, stub, rename, or remove core Agent fallback files
read LocalState/private/operator content
read, checksum, copy, or migrate .agent_board/**
start production server
call provider, bridge, live write, sync, publish, or deployment endpoints
open upstream PR
```

## 2. Collision Set

M100 observed:

```text
ADDITIVE_CANDIDATE_COUNT=7
ADDITIVE_EXTERNAL_SOURCE_COUNT=7
ADDITIVE_EFFECTIVE_EXTERNAL_SOURCE_COUNT=0
ADDITIVE_EFFECTIVE_SOURCE_MARKERS=core:7
ADDITIVE_DUPLICATE_CORE_DIAGNOSTIC_COUNT=7
CORE_AGENT_FALLBACK_RETAINED=9
```

The current resolver policy is therefore:

```text
external additive Agent files can add new ids
external additive Agent files do not override same-id core Agent files
external override Agent files can override exact existing core ids through AgentOverrides
```

## 3. Candidate Resolution Routes

| Route | Summary | Benefits | Risks | Current status |
| --- | --- | --- | --- | --- |
| A | Keep additive lane deferred | No source/env/core changes; preserves current safe runtime | Additive external package remains non-effective for same ids | Allowed now |
| B | Rename/remap external additive ids to unique ids | Avoids overriding core fallback | May require alias/map design; may create operator confusion | Needs design |
| C | Move selected same-id files into override semantics | Uses existing override model | Changes meaning from additive to override; must be reviewed per Agent | Needs reviewed candidate gate |
| D | Prepare core fallback remove/stub/untrack decision package | Aligns external additive with effective source goal | Destructive/high-risk if executed; currently forbidden automatically | Decision package only |
| E | Add explicit resolver collision policy | Keeps core fallback but allows controlled external precedence | Runtime source/API behavior change; needs tests and compatibility review | Future implementation gate only |
| F | Enable real `VCP_AGENT_DIRS` without resolving collision | Would not make same-id files effective | Misleading runtime-on signal | Blocked |

## 4. Recommended Next Gate

M102 recommends stopping before implementation and choosing one of two future narrow taskbooks only after review:

```text
M103A_AGENT_ADDITIVE_OVERRIDE_CANDIDATE_REVIEW_TASKBOOK
M103B_AGENT_ADDITIVE_RESOLVER_POLICY_DESIGN_TASKBOOK
```

Default recommendation:

```text
M103A first, if continuing: review whether any of the 7 additive files should actually become explicit AgentOverrides.
```

Rationale:

```text
AgentOverrides already has runtime proof, rollback proof, and Admin write guard evidence.
Turning selected same-id additive files into explicit overrides is easier to review per file than changing resolver precedence globally.
It still must not copy, move, overwrite, or enable anything automatically.
```

## 5. M103A Taskbook Requirements

A future M103A taskbook must:

```text
list all 7 additive collision candidates
review each candidate as "keep additive deferred", "consider override", or "needs separate design"
require per-file content review before any copy/move
require path-only scan before target decision
require checksum receipt before runtime consideration
keep existing AgentOverrides Metis/Nova unchanged unless explicitly reviewed
keep real VCP_AGENT_DIRS disabled
keep core fallback retained
```

M103A must not:

```text
copy additive files into AgentOverrides
delete or edit core Agent files
edit agent_map.json
write real config.env or .env
enable VCP_AGENT_DIRS
change AgentManager or AgentRootResolver
read private/LocalState/.agent_board content
```

## 6. M103B Taskbook Requirements

A future M103B taskbook must:

```text
describe exact resolver policy alternatives
define default-off behavior
define compatibility tests for existing core, additive, and override precedence
define Admin route read/write behavior
define rollback to current resolver policy
define no-real-env/no-production validation
```

M103B must not implement the policy change. Any implementation would require a later explicit source-change gate.

## 7. Stop Line

M102 stops before:

```text
real config writes
runtime source changes
core fallback removal/stub/untrack
copying or moving Agent content
agent_map.json edits
provider/bridge/live-write/private lanes
upstream PR
```

## 8. Rollback

M102 rollback is docs-only:

```text
git revert <M102 docs commit>
```

No env/source/core/external/private rollback is required.

## 9. Result

```text
M102_AGENT_ADDITIVE_COLLISION_RESOLUTION_TASKBOOK_PASS=yes
TASKBOOK_ONLY=yes
RECOMMENDED_NEXT_GATE=M103A_AGENT_ADDITIVE_OVERRIDE_CANDIDATE_REVIEW_TASKBOOK
ALTERNATE_NEXT_GATE=M103B_AGENT_ADDITIVE_RESOLVER_POLICY_DESIGN_TASKBOOK
REAL_CONFIG_ENV_WRITTEN=no
VCP_AGENT_DIRS_ENABLED=no
AGENTMANAGER_RUNTIME_CHANGED=no
AGENTROOTRESOLVER_CHANGED=no
AGENT_MAP_CHANGED=no
CORE_AGENT_FALLBACK_REMOVED=no
CORE_AGENT_FALLBACK_STUBBED=no
CORE_AGENT_FALLBACK_UNTRACKED=no
EXTERNAL_PACKAGE_MODIFIED=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
PRODUCTION_SERVER_STARTED=no
PROVIDER_OR_BRIDGE_OR_LIVE_WRITE_EXECUTED=no
UPSTREAM_PR_OPENED=no
STOP_BEFORE_AGENT_ADDITIVE_COLLISION_IMPLEMENTATION=yes
```

# M120 Aggregate Gap / Next-Lane Decision

Date: 2026-06-22

Status: PASS_DECISION_ONLY_NO_IMPLEMENTATION

Parent closeout: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M119_PLUGIN_EXISTING_EXTERNAL_RECONCILE_CLOSEOUT_20260622.md`

Tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Purpose

M120 rechecks the remaining unresolved externalization lanes after the plugin existing-external reconcile lane closed at M119.

This is decision-only. It does not copy, overwrite, delete, untrack, stub, enable runtime, execute providers or plugins, write env, start services, read private content, or open upstream PRs.

## 2. Candidate Lanes

| Candidate lane | Current state | Risk | M120 decision |
| --- | --- | --- | --- |
| Agent additive resolver policy | M100 BLOCK: copied additive Agent files are scanned, but same-id core fallback remains effective. | Medium if implemented; low as taskbook-only. | SELECTED as M121 taskbook-only. |
| Plugin runtime registration | External plugin package exists and M119 closed reconcile. | High because runtime registration changes executable surface. | Defer. |
| AIGentQuality active overwrite | M117 temp copy evidence exists; M118 kept active external as fork-specific. | High because active overwrite. | Defer to explicit overwrite gate only. |
| AdminPanel dynamic external frontend/API runtime | Package and metadata registry exist; dynamic runtime still deferred. | High UI/runtime surface. | Defer. |
| Codex/Memory runtime | Persistent package exists; live-write/private memory runtime deferred. | High private/live-write-adjacent. | Defer. |
| PhotoStudio runtime/data | Source package exists; real data roots and external sync/write deferred. | High project-data/external-write-adjacent. | Defer. |
| LocalState/private | Private-by-default gates exist. | High private/operator-data. | Block unless explicit private gate. |
| Core fallback removal/stub/untrack | Explicitly deferred throughout route. | High irreversible/review-sensitive. | Defer; decision package only later. |
| Upstream PR | Explicitly deferred until full local implementation and stable evidence. | Remote side effect. | Defer; requires future current-turn upstream PR authorization. |

## 3. Selected Next Gate

```text
NEXT_SELECTED_GATE=M121_AGENT_ADDITIVE_RESOLVER_POLICY_TASKBOOK
```

M121 should write a policy taskbook for the M100 additive Agent blocker. It should compare policy options without implementation:

```text
keep current core-precedence behavior and leave additive runtime off
external-precedence under explicit runtime/env gate
namespace or alias design for additive files
override-only path for selected candidates
block/defer until a larger Agent resolver design exists
```

## 4. M121 Allowed Shape

Allowed:

```text
read M98-M109/M100 evidence
list current additive package and blocker state by path/name only
define resolver policy options
define future validation and rollback requirements
define stop line before AgentManager source changes
define stop line before real env changes
```

Forbidden:

```text
modify AgentManager or resolver code
enable VCP_AGENT_DIRS
edit real config.env or .env
copy additional Agent files
print prompt bodies
read LocalState/private/.agent_board/**
delete, stub, untrack, or remove core Agent/**
start production server
open upstream PR
commit or push without explicit authorization
```

## 5. Why This Lane Is Next

The Agent additive blocker is already documented and bounded by M100-M109. A taskbook-only policy decision is the lowest-risk way to keep the route moving because it:

```text
does not touch runtime source
does not write env
does not expose private/operator data
does not invoke providers or bridges
does not overwrite active external packages
does not remove core fallback
```

## 6. Rollback

M120 rollback is docs-only:

```text
git revert <M120 docs/tracker commit>
```

No package/runtime/env rollback is required because M120 performs no implementation.

## 7. Result

```text
M120_AGGREGATE_GAP_NEXT_LANE_DECISION_PASS=yes
DECISION_ONLY=yes
SELECTED_NEXT_GATE=M121_AGENT_ADDITIVE_RESOLVER_POLICY_TASKBOOK
COPY_EXECUTED=no
OVERWRITE_EXECUTED=no
RUNTIME_ENABLED=no
REAL_CONFIG_ENV_WRITTEN=no
PRIVATE_CONTENT_READ=no
UPSTREAM_PR_OPENED=no
```

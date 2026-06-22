# M121 Agent Additive Resolver Policy Taskbook

Date: 2026-06-22

Status: PASS_TASKBOOK_ONLY_NO_IMPLEMENTATION

Parent decision: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M120_AGGREGATE_GAP_NEXT_LANE_DECISION_20260622.md`

Tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Scope

M121 defines the next policy-design lane for the Agent additive runtime blocker recorded by M100.

This taskbook is documentation-only. It does not modify AgentManager, AgentRootResolver, real config, external package content, core Agent fallback files, or production runtime.

Allowed evidence sources for M121 are previous receipts, path/name summaries, counters, and checksums only. Agent prompt bodies must not be printed or recopied here.

## 2. Current Facts

The current Agent state is:

```text
ADDITIVE_EXTERNAL_AGENT_FILES_COPIED=7
ADDITIVE_RUNTIME_LANE_ENABLED=no
VCP_AGENT_DIRS_ENABLED=no
OVERRIDE_RUNTIME_LANE_ACTIVE=yes
OVERRIDE_RUNTIME_LANE_FILES=Metis,Nova,小秋
CORE_AGENT_FALLBACK_RETAINED=yes
CORE_FALLBACK_REMOVAL_DECISION=not_authorized
```

M100 proved that the external additive package exists and is stable:

```text
ADDITIVE_CANDIDATE_COUNT=7
ADDITIVE_EXTERNAL_SOURCE_COUNT=7
EXTERNAL_ADDITIVE_TARGET_MISSING_COUNT=0
EXTERNAL_ADDITIVE_HASH_UNCHANGED=yes
```

M100 also proved that enabling the current additive root shape would not make those same-id files effective while core fallback remains:

```text
ADDITIVE_EFFECTIVE_EXTERNAL_SOURCE_COUNT=0
ADDITIVE_EFFECTIVE_SOURCE_MARKERS=core:7
ADDITIVE_DUPLICATE_CORE_DIAGNOSTIC_COUNT=7
M100_STATUS=BLOCK
```

M104-M109 closed the narrow override lane:

```text
XIAOQIU_OVERRIDE_FINAL_STATE=LOCKED_RETAINED
REMAINING_AIIMAGEGENEXPERT_STATE=DEFERRED_NO_COPY
REMAINING_MUSE_STATE=DEFERRED_NO_COPY
REMAINING_AUDITMASTER_STATE=SEPARATE_DESIGN_REQUIRED_NO_COPY
REMAINING_MEMORIASORTER_STATE=SEPARATE_DESIGN_REQUIRED_NO_COPY
REMAINING_DONGLIMENGSHOU_STATE=SEPARATE_DESIGN_REQUIRED_NO_COPY
REMAINING_NUOBAO_STATE=SEPARATE_DESIGN_REQUIRED_NO_COPY
```

## 3. Policy Options

| Option | Policy | Runtime effect | Risk | Notes |
| --- | --- | --- | --- | --- |
| A | Keep current core-precedence behavior and leave additive runtime off | No additive external Agent becomes effective | Lowest | Current default; preserves core fallback and existing runtime behavior. |
| B | External precedence under explicit runtime/env gate | Same-id external additive Agent can override core when enabled | High | Requires Agent resolver design, tests, rollback drill, admin read/write guard, and explicit real-config gate. |
| C | Namespace or alias additive Agent ids | External files become new non-colliding ids | Medium | Avoids same-id override semantics but changes how users address Agents. Needs UX and compatibility decision. |
| D | Override-only path for individually reviewed candidates | Only selected reviewed files enter `AgentOverrides/` | Medium | Proven path for `小秋`; future candidates need per-Agent gate and behavior review. |
| E | Block/defer until a larger Agent resolver design exists | No runtime change | Low | Appropriate if resolver semantics should be designed together with core fallback retirement. |

## 4. Recommended Next Gate

The next gate should be:

```text
M122_AGENT_ADDITIVE_RESOLVER_POLICY_DECISION
```

M122 should select exactly one policy direction from section 3, or explicitly keep the lane deferred. M122 should still be decision-only unless the user separately authorizes implementation after review.

Recommended default for M122:

```text
RECOMMENDED_POLICY=A_KEEP_CORE_PRECEDENCE_AND_LEAVE_ADDITIVE_RUNTIME_OFF_NOW
```

Reason: M100 already showed additive package completeness does not equal effective runtime registration under the current same-id resolver. The lowest-risk next move is to keep runtime off until a deliberate resolver-policy decision exists.

## 5. Future Validation Requirements

Any future implementation gate after M122 must prove all applicable items below before any real runtime enablement:

```text
node --check affected source files
node --test tests/agent-external-root-resolver.test.js tests/agent-manager-external-runtime.test.js
scoped process.env-only additive shadow validation
duplicate-core diagnostic remains explicit
effective-source markers distinguish core / external-additive / external-override
rollback drill restores prior effective source
Admin external Agent write guard remains blocked
real config values are not printed
prompt bodies are not printed
```

If a future path changes resolver precedence, it must add explicit tests for:

```text
same-id core fallback retained
same-id external additive under disabled env
same-id external additive under scoped enabled env
override lane precedence
unknown Agent fallback behavior
admin read-only source labeling
admin write-block behavior
rollback to current core-precedence state
```

## 6. Forbidden Actions Without Separate Gate

The following remain forbidden after M121:

```text
modify AgentManager or AgentRootResolver code
enable VCP_AGENT_DIRS
write real config.env or .env
copy additional Agent files
print Agent prompt bodies
read LocalState/private/operator content
read, checksum, copy, or migrate .agent_board/**
delete, stub, untrack, or remove core Agent fallback
start production server
execute providers, bridges, or live external writes
open upstream PR
commit or push this taskbook without explicit authorization
```

## 7. Rollback

M121 has no runtime, env, package, source, or external side effects.

Rollback is docs-only:

```text
remove/revert docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M121_AGENT_ADDITIVE_RESOLVER_POLICY_TASKBOOK_20260622.md
revert the M121 tracker edits
```

## 8. Result

```text
M121_AGENT_ADDITIVE_RESOLVER_POLICY_TASKBOOK_PASS=yes
TASKBOOK_ONLY=yes
AGENTMANAGER_MODIFIED=no
AGENTROOTRESOLVER_MODIFIED=no
VCP_AGENT_DIRS_ENABLED=no
REAL_CONFIG_ENV_WRITTEN=no
PROMPT_BODY_PRINTED=no
PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_MIGRATED=no
CORE_FALLBACK_REMOVED=no
EXTERNAL_PACKAGE_CONTENT_MODIFIED=no
PRODUCTION_SERVER_STARTED=no
UPSTREAM_PR_OPENED=no
NEXT_RECOMMENDED_GATE=M122_AGENT_ADDITIVE_RESOLVER_POLICY_DECISION
```

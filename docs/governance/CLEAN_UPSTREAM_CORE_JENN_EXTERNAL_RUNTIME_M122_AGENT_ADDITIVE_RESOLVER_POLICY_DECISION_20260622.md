# M122 Agent Additive Resolver Policy Decision

Date: 2026-06-22

Status: PASS_DECISION_ONLY_NO_IMPLEMENTATION

Parent taskbook: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M121_AGENT_ADDITIVE_RESOLVER_POLICY_TASKBOOK_20260622.md`

Tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Decision

M122 selects the conservative resolver policy:

```text
SELECTED_POLICY=A_KEEP_CORE_PRECEDENCE_AND_LEAVE_ADDITIVE_RUNTIME_OFF_NOW
```

This means:

```text
CORE_PRECEDENCE_RETAINED=yes
ADDITIVE_RUNTIME_LANE_ENABLED=no
VCP_AGENT_DIRS_ENABLED=no
SAME_ID_EXTERNAL_ADDITIVE_OVERRIDE_ENABLED=no
CORE_AGENT_FALLBACK_RETAINED=yes
```

M122 is decision-only. It does not implement resolver changes, enable runtime, copy files, edit real env, or remove core fallback.

## 2. Evidence Used

M100 already proved the additive package is present but not effective under current same-id rules:

```text
ADDITIVE_EXTERNAL_SOURCE_COUNT=7
ADDITIVE_EFFECTIVE_EXTERNAL_SOURCE_COUNT=0
ADDITIVE_EFFECTIVE_SOURCE_MARKERS=core:7
ADDITIVE_DUPLICATE_CORE_DIAGNOSTIC_COUNT=7
M100_STATUS=BLOCK
```

M107-M109 already closed the narrow override lane:

```text
XIAOQIU_OVERRIDE_FINAL_STATE=LOCKED_RETAINED
REMAINING_AIIMAGEGENEXPERT_STATE=DEFERRED_NO_COPY
REMAINING_MUSE_STATE=DEFERRED_NO_COPY
REMAINING_AUDITMASTER_STATE=SEPARATE_DESIGN_REQUIRED_NO_COPY
REMAINING_MEMORIASORTER_STATE=SEPARATE_DESIGN_REQUIRED_NO_COPY
REMAINING_DONGLIMENGSHOU_STATE=SEPARATE_DESIGN_REQUIRED_NO_COPY
REMAINING_NUOBAO_STATE=SEPARATE_DESIGN_REQUIRED_NO_COPY
```

M121 compared the policy options and recommended keeping runtime off until a deliberate resolver-policy decision existed. M122 is that decision.

## 3. Rejected Options For Now

| Option | M122 state | Reason |
| --- | --- | --- |
| External precedence under env gate | Not selected | High risk because it changes same-id runtime semantics and would require AgentManager/AgentRootResolver implementation plus rollback proof. |
| Namespace or alias additive ids | Not selected | Needs user-facing Agent id and compatibility design before implementation. |
| New override-only copy now | Not selected | `小秋` is already retained; remaining six candidates are locked deferred/separate-design no-copy by M107-M109. |
| Core fallback removal/stub/untrack | Not selected | Explicitly not authorized and outside this route. |

## 4. Allowed Future Reopen Conditions

Any future reopen must start from a new taskbook or decision gate. Allowed future directions are:

```text
future external-precedence design taskbook
future namespace/alias Agent id design taskbook
future per-Agent override copy gate after explicit content review
future core-fallback retirement decision package without executing deletion/untrack/stub
```

None of those are authorized by M122.

## 5. Forbidden Actions After M122

The following remain blocked:

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
```

## 6. Next Recommended Gate

The next recommended gate is:

```text
M123_AGGREGATE_GAP_NEXT_LANE_DECISION
```

M123 should decide whether to keep moving to the next unresolved low-risk lane, or pause after this Agent additive resolver policy closeout. M123 should not implement runtime changes unless separately authorized.

## 7. Rollback

M122 has no runtime, env, package, source, or external side effects.

Rollback is docs-only:

```text
remove/revert docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M122_AGENT_ADDITIVE_RESOLVER_POLICY_DECISION_20260622.md
revert the M122 tracker edits
```

## 8. Result

```text
M122_AGENT_ADDITIVE_RESOLVER_POLICY_DECISION_PASS=yes
DECISION_ONLY=yes
SELECTED_POLICY=A_KEEP_CORE_PRECEDENCE_AND_LEAVE_ADDITIVE_RUNTIME_OFF_NOW
CORE_PRECEDENCE_RETAINED=yes
ADDITIVE_RUNTIME_ENABLED=no
VCP_AGENT_DIRS_ENABLED=no
SAME_ID_EXTERNAL_ADDITIVE_OVERRIDE_ENABLED=no
AGENTMANAGER_MODIFIED=no
AGENTROOTRESOLVER_MODIFIED=no
REAL_CONFIG_ENV_WRITTEN=no
NEW_AGENT_COPY_EXECUTED=no
PROMPT_BODY_PRINTED=no
PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_MIGRATED=no
CORE_FALLBACK_REMOVED=no
EXTERNAL_PACKAGE_CONTENT_MODIFIED=no
PRODUCTION_SERVER_STARTED=no
UPSTREAM_PR_OPENED=no
NEXT_RECOMMENDED_GATE=M123_AGGREGATE_GAP_NEXT_LANE_DECISION
```

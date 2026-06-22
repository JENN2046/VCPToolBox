# M107 Agent Override Closeout Decision

Date: 2026-06-22

Status: PASS_DECISION_ONLY_NO_NEW_COPY_NO_RUNTIME_CHANGE

Decision: `LOCK_XIAOQIU_OVERRIDE_AND_DEFER_REMAINING_SIX`

Parent receipt: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M106_XIAOQIU_OVERRIDE_COPY_ROLLBACK_RECEIPT_20260622.md`

Tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Purpose

M107 closes the current Agent override copy lane after M106.

It locks:

```text
小秋 override final state
remaining six additive collision candidates
next stop line
```

M107 is decision-only. It does not copy more files, modify runtime code, write real env, or enable additive Agent runtime.

## 2. Locked Final State

The M106 final copy is retained:

```text
AgentOverrides/小秋.txt
```

Evidence:

```text
M106_XIAOQIU_OVERRIDE_COPY_ROLLBACK_PASS=yes
TARGET_CREATED=yes
TARGET_HASH_MATCHES_SOURCE=yes
MANIFEST_ENTRY_COUNT=147
MANIFEST_VERIFY_BAD=0
MANIFEST_SHA256=76961c7c0f5ec3163c60cd51900e645f7b5d41ff9e736cea77516e6d4a2d88be
XIAOQIU_OVERRIDE_READ_PATH_MATCHES_EXTERNAL=yes
XIAOQIU_OVERRIDE_PROMPT_HASH_MATCHES_EXTERNAL=yes
ROLLBACK_DRILL_PASS=yes
FINAL_COPY_RESTORED=yes
```

Runtime boundary remains:

```text
REAL_CONFIG_ENV_WRITTEN=no
VCP_AGENT_DIRS_ENABLED=no
AGENTMANAGER_RUNTIME_CHANGED=no
AGENTROOTRESOLVER_CHANGED=no
AGENT_MAP_CHANGED=no
CORE_AGENT_FALLBACK_REMOVED=no
PRODUCTION_SERVER_STARTED=no
```

## 3. Remaining Six Candidate Decisions

| Candidate | M104 classification | M107 locked state | Future unblock requirement |
| --- | --- | --- | --- |
| `Agent/AIImageGenExpert.txt` | `KEEP_DEFERRED` | `DEFERRED_NO_COPY` | AI Image/provider no-provider boundary review and separate content gate. |
| `Agent/Muse.txt` | `KEEP_DEFERRED` | `DEFERRED_NO_COPY` | Provider/image-adjacent and large prompt content review. |
| `Agent/AuditMaster.txt` | `NEEDS_SEPARATE_DESIGN` | `SEPARATE_DESIGN_REQUIRED_NO_COPY` | Governance/audit behavior design gate. |
| `Agent/MemoriaSorter.txt` | `NEEDS_SEPARATE_DESIGN` | `SEPARATE_DESIGN_REQUIRED_NO_COPY` | Memory/private/LocalState-aware design gate. |
| `Agent/动力猛兽.txt` | `NEEDS_SEPARATE_DESIGN` | `SEPARATE_DESIGN_REQUIRED_NO_COPY` | Memory/governance/write-adjacent behavior gate. |
| `Agent/诺宝.txt` | `NEEDS_SEPARATE_DESIGN` | `SEPARATE_DESIGN_REQUIRED_NO_COPY` | Memory/governance/write-adjacent behavior gate. |

No remaining candidate may be copied by default.

## 4. Agent Lane State After M107

```text
OVERRIDE_RUNTIME_LANE_ACTIVE=yes
OVERRIDE_RUNTIME_LANE_FILES=Metis,Nova,小秋
ADDITIVE_RUNTIME_LANE_ACTIVE=no
VCP_AGENT_DIRS_ENABLED=no
ADDITIVE_COLLISION_BLOCKER_RESOLVED_FOR_ALL=no
XIAOQIU_OVERRIDE_LOCKED=yes
REMAINING_KEEP_DEFERRED_COUNT=2
REMAINING_SEPARATE_DESIGN_COUNT=4
REMAINING_BLOCK_OR_SECRET_RISK_COUNT=0
```

This means M107 closes only the narrow XiaoQiu override copy lane. It does not close all Agent extraction concerns.

## 5. Forbidden Next Actions Without Separate Gate

Do not automatically:

```text
copy AIImageGenExpert.txt
copy Muse.txt
copy AuditMaster.txt
copy MemoriaSorter.txt
copy 动力猛兽.txt
copy 诺宝.txt
enable VCP_AGENT_DIRS
write real config.env or .env
modify AgentManager or AgentRootResolver
modify agent_map.json
remove, untrack, stub, or delete core Agent files
read LocalState/private/operator content
read, checksum, copy, or migrate .agent_board/**
start production server
open upstream PR
```

## 6. Future Allowed Routes

Future work must choose one narrow gate:

```text
M108_AGENT_OVERRIDE_AGGREGATE_CLOSEOUT_OR_NEXT_DOMAIN_DECISION
M108A_AI_IMAGE_AGENT_CONTENT_DESIGN_TASKBOOK
M108B_MEMORY_GOVERNANCE_AGENT_CONTENT_DESIGN_TASKBOOK
M108C_AGENT_ADDITIVE_RESOLVER_POLICY_DESIGN_TASKBOOK
```

Default recommendation:

```text
NEXT_SAFE_GATE=M108_AGENT_OVERRIDE_AGGREGATE_CLOSEOUT_OR_NEXT_DOMAIN_DECISION
```

## 7. Rollback

M107 rollback is docs-only:

```text
git revert <M107 docs/tracker commit>
```

M106 rollback remains:

```text
remove ../VCPToolBox-JENN-Extensions/AgentOverrides/小秋.txt
remove its line from ../VCPToolBox-JENN-Extensions/manifests/MANIFEST.sha256
verify fallback to core
```

## 8. Result

```text
M107_AGENT_OVERRIDE_CLOSEOUT_DECISION_PASS=yes
DECISION_ONLY=yes
XIAOQIU_OVERRIDE_FINAL_STATE=LOCKED_RETAINED
REMAINING_AIIMAGEGENEXPERT_STATE=DEFERRED_NO_COPY
REMAINING_MUSE_STATE=DEFERRED_NO_COPY
REMAINING_AUDITMASTER_STATE=SEPARATE_DESIGN_REQUIRED_NO_COPY
REMAINING_MEMORIASORTER_STATE=SEPARATE_DESIGN_REQUIRED_NO_COPY
REMAINING_DONGLIMENGSHOU_STATE=SEPARATE_DESIGN_REQUIRED_NO_COPY
REMAINING_NUOBAO_STATE=SEPARATE_DESIGN_REQUIRED_NO_COPY
ADDITIVE_RUNTIME_LANE_ENABLED=no
REAL_CONFIG_ENV_WRITTEN=no
NEW_COPY_EXECUTED=no
RUNTIME_SOURCE_CHANGED=no
UPSTREAM_PR_OPENED=no
NEXT_SAFE_GATE=M108_AGENT_OVERRIDE_AGGREGATE_CLOSEOUT_OR_NEXT_DOMAIN_DECISION
```

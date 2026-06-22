# M103 Agent Additive Override Candidate Review Taskbook

Date: 2026-06-22

Status: PASS_TASKBOOK_ONLY_NO_CONTENT_REVIEW_NO_COPY

Decision: `STOP_BEFORE_M104_PER_AGENT_OVERRIDE_CANDIDATE_REVIEW`

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Previous taskbook: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M102_AGENT_ADDITIVE_COLLISION_RESOLUTION_TASKBOOK_20260622.md`

Blocking evidence: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M100_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_RECEIPT_20260622.md`

## 1. Scope

M103 defines a future per-Agent review gate for deciding whether any of the 7 copied additive Agent files should become explicit override candidates.

M103 does not:

```text
read prompt bodies
copy files into AgentOverrides
modify external package content
modify core Agent content
modify agent_map.json
write real config.env or .env
enable VCP_AGENT_DIRS
change AgentManager or AgentRootResolver
run runtime validation
read LocalState/private/operator content
read, checksum, copy, or migrate .agent_board/**
start production server
call provider, bridge, live write, sync, publish, or deployment endpoints
open upstream PR
```

## 2. Candidate Set

Future M104 may review these 7 additive collision candidates:

```text
Agent/AIImageGenExpert.txt
Agent/AuditMaster.txt
Agent/MemoriaSorter.txt
Agent/Muse.txt
Agent/动力猛兽.txt
Agent/小秋.txt
Agent/诺宝.txt
```

Current effective-source status:

```text
ADDITIVE_EXTERNAL_SOURCE_COUNT=7
ADDITIVE_EFFECTIVE_EXTERNAL_SOURCE_COUNT=0
ADDITIVE_EFFECTIVE_SOURCE_MARKERS=core:7
ADDITIVE_DUPLICATE_CORE_DIAGNOSTIC_COUNT=7
```

Existing explicit override controls remain:

```text
AgentOverrides/Metis.txt
AgentOverrides/Nova.txt
```

M103 does not add to that override set.

## 3. Future M104 Review Questions

For each candidate, M104 must answer:

```text
is the external file intended to replace the same-id core Agent behavior?
is the external file safer as deferred additive package-only content?
does the candidate contain provider/live-write/private-data assumptions?
does the candidate depend on LocalState, .agent_board, secrets, auth, or operator data?
does the candidate require agent_map.json changes?
does the candidate require runtime resolver policy changes?
does the candidate require user-visible behavior confirmation?
```

Allowed future classifications:

```text
KEEP_DEFERRED
ALLOW_OVERRIDE_CANDIDATE_FOR_LATER_COPY_GATE
NEEDS_SEPARATE_DESIGN
BLOCK_PRIVATE_OR_SECRET_RISK
```

M104 must not copy or enable anything. It is review/classification only.

## 4. Evidence Rules

M104 may inspect reviewed source/package Agent content, but must not print prompt bodies.

Allowed evidence:

```text
file path
sha256 hash
line count
content-risk category count
classification
short redacted rationale
```

Forbidden evidence:

```text
raw prompt body
secret/env/auth/token values
private LocalState/operator content
.agent_board content
provider credentials
full behavioral prompt excerpts
```

## 5. Future Copy Gate

If M104 classifies any candidate as `ALLOW_OVERRIDE_CANDIDATE_FOR_LATER_COPY_GATE`, a later M105 gate would still be required before copying:

```text
source path scan
target path scan
content review summary
manifest/checksum update plan
external package write allowlist
rollback plan
runtime-off proof
real config still unchanged
```

M105 would still not enable runtime. Any runtime proof would require a later scoped harness.

## 6. Stop Line

Stop before:

```text
prompt body output
copy/move into AgentOverrides
external package mutation
core Agent mutation
agent_map.json mutation
real env write
VCP_AGENT_DIRS enablement
AgentManager or AgentRootResolver source change
production/provider/bridge/private/upstream action
```

## 7. Rollback

M103 rollback is docs-only:

```text
git revert <M103 docs commit>
```

No env/source/core/external/private rollback is required.

## 8. Result

```text
M103_AGENT_ADDITIVE_OVERRIDE_CANDIDATE_REVIEW_TASKBOOK_PASS=yes
TASKBOOK_ONLY=yes
CONTENT_REVIEW_EXECUTED=no
PROMPT_BODIES_PRINTED=no
OVERRIDE_CANDIDATES_APPROVED_NOW=0
FILES_COPIED_TO_AGENTOVERRIDES=0
REAL_CONFIG_ENV_WRITTEN=no
VCP_AGENT_DIRS_ENABLED=no
AGENTMANAGER_RUNTIME_CHANGED=no
AGENTROOTRESOLVER_CHANGED=no
AGENT_MAP_CHANGED=no
CORE_AGENT_FALLBACK_REMOVED=no
EXTERNAL_PACKAGE_MODIFIED=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
PRODUCTION_SERVER_STARTED=no
PROVIDER_OR_BRIDGE_OR_LIVE_WRITE_EXECUTED=no
UPSTREAM_PR_OPENED=no
NEXT_SAFE_GATE=M104_PER_AGENT_OVERRIDE_CANDIDATE_REVIEW
```

# M105 Agent Override Copy Gate for XiaoQiu Taskbook

Date: 2026-06-22

Status: PASS_TASKBOOK_ONLY_NO_COPY_NO_RUNTIME

Decision: `STOP_BEFORE_M106_ACTUAL_XIAOQIU_OVERRIDE_COPY`

Parent receipt: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M104_AGENT_ADDITIVE_PER_AGENT_CLASSIFICATION_RECEIPT_20260622.md`

Tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Purpose

M105 defines the narrow future copy gate for the only M104-approved low-risk override candidate:

```text
Agent/小秋.txt
```

M105 does not copy the file.

M105 does not authorize M106 automatically.

## 2. Important Runtime Impact

`AgentOverrides/` is not a neutral package-only lane in the current local route.

Earlier gates enabled the AgentOverrides lane through real local `config.env` keys:

```text
VCP_AGENT_ALLOWED_ROOTS
VCP_AGENT_OVERRIDE_DIRS
```

Therefore, copying `小秋.txt` into external `AgentOverrides/` would become a behavior-affecting override candidate whenever local runtime reads that directory.

M106 must be explicitly authorized as an actual copy gate and must include rollback proof.

## 3. Candidate Paths

Future M106 may only consider these paths:

```text
core source: Agent/小秋.txt
reviewed external additive source: ../VCPToolBox-JENN-Extensions/Agent/小秋.txt
future override target: ../VCPToolBox-JENN-Extensions/AgentOverrides/小秋.txt
```

Preferred source for M106 is the reviewed external additive source, after verifying it still matches the core source hash.

## 4. M106 Preconditions

M106 must stop unless all are true:

```text
M104_PASS=yes
CANDIDATE_PATH=Agent/小秋.txt
SOURCE_EXTERNAL_ADDITIVE_EXISTS=yes
CORE_SOURCE_EXISTS=yes
SOURCE_HASH_MATCHES_CORE=yes
TARGET_AGENTOVERRIDES_FILE_EXISTS=no
SOURCE_PATH_RISK=0
TARGET_PATH_RISK=0
SECRET_SHAPE_SCAN_BEFORE_COPY=PASS
PROMPT_BODY_PRINTED=no
REAL_CONFIG_ENV_WRITE_REQUIRED=no
PRODUCTION_SERVER_RUNNING=no
```

If `../VCPToolBox-JENN-Extensions/AgentOverrides/小秋.txt` already exists, M106 must stop and write a blocker receipt. Do not overwrite.

## 5. Allowed Future M106 File Scope

Only after explicit M106 authorization, the allowed future file writes are:

```text
../VCPToolBox-JENN-Extensions/AgentOverrides/小秋.txt
../VCPToolBox-JENN-Extensions/manifests/MANIFEST.sha256
../VCPToolBox-JENN-Extensions/receipts/<M106 receipt>.md
docs/governance/<M106 receipt>.md
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
```

No other file writes are allowed.

## 6. Forbidden Future M106 Scope

M106 must not:

```text
write real config.env or .env
enable VCP_AGENT_DIRS
modify VCP_AGENT_ALLOWED_ROOTS
modify VCP_AGENT_OVERRIDE_DIRS
modify AgentManager or AgentRootResolver
modify agent_map.json
modify core Agent files
remove, untrack, stub, or delete core fallback files
copy any Agent other than 小秋.txt
copy LocalState/private/operator data
read, checksum, copy, or migrate .agent_board/**
start production server
call providers, bridge, live-write, sync, publish, deployment, or upstream PR actions
```

## 7. Required Future M106 Validation

M106 must produce these markers:

```text
SOURCE_HASH_MATCHES_CORE=yes
TARGET_CREATED=yes
TARGET_HASH_MATCHES_SOURCE=yes
MANIFEST_UPDATED=yes
MANIFEST_VERIFY_PASS=yes
TARGET_SECRET_SHAPE_SCAN_PASS=yes
VCP_AGENT_DIRS_ENABLED=no
REAL_CONFIG_ENV_WRITTEN=no
PRODUCTION_SERVER_STARTED=no
```

M106 must also run a local no-production runtime read check, scoped to the already-enabled AgentOverrides lane, and must not print prompt bodies:

```text
XIAOQIU_OVERRIDE_READ_PATH_MATCHES_EXTERNAL=yes
XIAOQIU_OVERRIDE_PROMPT_HASH_MATCHES_EXTERNAL=yes
PROMPT_BODY_PRINTED=no
```

## 8. Required Future M106 Rollback Drill

Because the target is an active override lane, M106 must prove rollback:

```text
remove ../VCPToolBox-JENN-Extensions/AgentOverrides/小秋.txt
regenerate ../VCPToolBox-JENN-Extensions/manifests/MANIFEST.sha256
verify XiaoQiu override read path no longer resolves to external override
restore no extra files remain
```

If M106 chooses to keep the copy after the rollback drill, that persistence must be an explicit final decision in the M106 receipt.

## 9. Stop Line

Stop now before:

```text
creating ../VCPToolBox-JENN-Extensions/AgentOverrides/小秋.txt
editing external MANIFEST.sha256
running runtime smoke for XiaoQiu override
writing real config.env
starting production server
```

## 10. Result

```text
M105_AGENT_OVERRIDE_COPY_GATE_XIAOQIU_TASKBOOK_PASS=yes
TASKBOOK_ONLY=yes
ACTUAL_COPY_EXECUTED=no
TARGET_CREATED=no
MANIFEST_UPDATED=no
REAL_CONFIG_ENV_WRITTEN=no
VCP_AGENT_DIRS_ENABLED=no
PRODUCTION_SERVER_STARTED=no
NEXT_SAFE_GATE=M106_ACTUAL_XIAOQIU_OVERRIDE_COPY_WITH_ROLLBACK_DRILL
```

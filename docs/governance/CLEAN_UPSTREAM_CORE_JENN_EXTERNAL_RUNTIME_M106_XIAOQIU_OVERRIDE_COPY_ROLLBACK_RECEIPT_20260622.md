# M106 XiaoQiu Override Copy + Rollback Drill Receipt

Date: 2026-06-22

Status: PASS_COPY_WITH_ROLLBACK_DRILL_NO_REAL_ENV_WRITE

Decision: `KEEP_XIAOQIU_OVERRIDE_COPY_AFTER_ROLLBACK_DRILL`

Parent taskbook: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M105_AGENT_OVERRIDE_COPY_GATE_XIAOQIU_TASKBOOK_20260622.md`

Tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

External package: `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions`

## 1. Scope

M106 copied only the single M104/M105-approved candidate into the active AgentOverrides lane:

```text
source: ../VCPToolBox-JENN-Extensions/Agent/小秋.txt
target: ../VCPToolBox-JENN-Extensions/AgentOverrides/小秋.txt
```

M106 did not:

```text
copy any other Agent file
modify core Agent files
modify agent_map.json
modify AgentManager or AgentRootResolver
write real config.env or .env
enable VCP_AGENT_DIRS
start production server
call provider, bridge, live-write, sync, publish, deployment, or upstream PR actions
read LocalState/private/operator content
read, checksum, copy, or migrate .agent_board/**
print prompt bodies
```

## 2. Preflight

```text
CORE_SOURCE_EXISTS=yes
SOURCE_EXTERNAL_ADDITIVE_EXISTS=yes
TARGET_AGENTOVERRIDES_FILE_EXISTS=no
CORE_SOURCE_SHA256=6938dabe01e2b1411736ed27325422981f87b09c07e6f9b056d90c70d491e437
EXTERNAL_SOURCE_SHA256=6938dabe01e2b1411736ed27325422981f87b09c07e6f9b056d90c70d491e437
SOURCE_HASH_MATCHES_CORE=yes
SOURCE_PATH_RISK=0
TARGET_PATH_RISK=0
SECRET_SHAPE_SCAN_BEFORE_COPY=PASS
MANIFEST_VERIFY_COUNT=146
MANIFEST_VERIFY_BAD=0
PROMPT_BODY_PRINTED=no
REAL_CONFIG_ENV_WRITE_REQUIRED=no
PRODUCTION_SERVER_RUNNING=no
M106_PREFLIGHT_PASS=yes
```

## 3. Copy And Manifest

M106 copied the reviewed external additive source into `AgentOverrides/` and regenerated only the external checksum manifest.

```text
TARGET_CREATED=yes
SOURCE_HASH=6938dabe01e2b1411736ed27325422981f87b09c07e6f9b056d90c70d491e437
TARGET_HASH=6938dabe01e2b1411736ed27325422981f87b09c07e6f9b056d90c70d491e437
TARGET_HASH_MATCHES_SOURCE=yes
MANIFEST_ENTRY_COUNT=147
MANIFEST_VERIFY_BAD=0
MANIFEST_SHA256=76961c7c0f5ec3163c60cd51900e645f7b5d41ff9e736cea77516e6d4a2d88be
TARGET_MANIFEST_ENTRY_PRESENT=yes
```

Manifest diff was kept narrow:

```text
AgentOverrides/小秋.txt added
manifests/MANIFEST.sha256 +1 line
```

## 4. Runtime Read Smoke

M106 used a scoped local `AgentManager` read check.

The check enabled only:

```text
VCP_AGENT_ALLOWED_ROOTS=<external package root>
VCP_AGENT_OVERRIDE_DIRS=<external AgentOverrides root>
```

It did not enable:

```text
VCP_AGENT_DIRS
```

Smoke result:

```text
TARGET_EXISTS=yes
TARGET_SHA256=6938dabe01e2b1411736ed27325422981f87b09c07e6f9b056d90c70d491e437
AGENT_EXTERNAL_ADDITIVE_ROOT_COUNT=0
AGENT_EXTERNAL_OVERRIDE_ROOT_COUNT=1
AGENT_ADDITIVE_FILE_COUNT=0
AGENT_OVERRIDE_FILE_COUNT=3
AGENT_DIAGNOSTIC_CODES=none
XIAOQIU_OVERRIDE_READ_PATH_MATCHES_EXTERNAL=yes
XIAOQIU_OVERRIDE_PROMPT_HASH_MATCHES_EXTERNAL=yes
PROMPT_BODY_PRINTED=no
VCP_AGENT_DIRS_ENABLED=no
REAL_CONFIG_ENV_WRITTEN=no
PRODUCTION_SERVER_STARTED=no
M106_XIAOQIU_OVERRIDE_READ_SMOKE_PASS=yes
```

## 5. Rollback Drill

Rollback drill temporarily removed `AgentOverrides/小秋.txt`, regenerated the manifest, verified fallback to core, then restored the final copy and manifest.

```text
ROLLBACK_TARGET_REMOVED=yes
ROLLBACK_MANIFEST_ENTRY_COUNT=146
ROLLBACK_MANIFEST_VERIFY_BAD=0
ROLLBACK_MANIFEST_TARGET_PRESENT=no
ROLLBACK_EFFECTIVE_SOURCE=core:core
ROLLBACK_EXTERNAL_RECORD_PRESENT=no
ROLLBACK_READ_PATH_MATCHES_CORE=yes
ROLLBACK_PROMPT_HASH_MATCHES_CORE=yes
FINAL_TARGET_RESTORED=yes
FINAL_TARGET_SHA256=6938dabe01e2b1411736ed27325422981f87b09c07e6f9b056d90c70d491e437
FINAL_MANIFEST_ENTRY_COUNT=147
FINAL_MANIFEST_VERIFY_BAD=0
FINAL_MANIFEST_TARGET_PRESENT=yes
FINAL_MANIFEST_SHA256=76961c7c0f5ec3163c60cd51900e645f7b5d41ff9e736cea77516e6d4a2d88be
FINAL_EFFECTIVE_SOURCE=external:override
FINAL_EXTERNAL_RECORD_PRESENT=yes
FINAL_READ_PATH_MATCHES_EXTERNAL=yes
FINAL_PROMPT_HASH_MATCHES_EXTERNAL=yes
PROMPT_BODY_PRINTED=no
REAL_CONFIG_ENV_WRITTEN=no
VCP_AGENT_DIRS_ENABLED=no
PRODUCTION_SERVER_STARTED=no
M106_ROLLBACK_DRILL_PASS=yes
```

## 6. Final External Package State

Final intended external package changes:

```text
new:      AgentOverrides/小秋.txt
modified: manifests/MANIFEST.sha256
```

M106 intentionally keeps the copied override after the rollback drill:

```text
KEEP_XIAOQIU_OVERRIDE_COPY_AFTER_ROLLBACK_DRILL=yes
```

## 7. Stop Line

Stop before:

```text
copying any other Agent to AgentOverrides
enabling VCP_AGENT_DIRS
editing real config.env or .env
changing AgentManager or AgentRootResolver
editing agent_map.json
removing/stubbing/untracking core Agent files
starting production server
opening upstream PR
committing or pushing without explicit authorization
```

## 8. Result

```text
M106_XIAOQIU_OVERRIDE_COPY_ROLLBACK_PASS=yes
TARGET_CREATED=yes
TARGET_HASH_MATCHES_SOURCE=yes
MANIFEST_UPDATED=yes
MANIFEST_VERIFY_PASS=yes
TARGET_SECRET_SHAPE_SCAN_PASS=yes
ROLLBACK_DRILL_PASS=yes
FINAL_COPY_RESTORED=yes
REAL_CONFIG_ENV_WRITTEN=no
VCP_AGENT_DIRS_ENABLED=no
PRODUCTION_SERVER_STARTED=no
PROMPT_BODY_PRINTED=no
UPSTREAM_PR_OPENED=no
NEXT_SAFE_GATE=M107_AGENT_OVERRIDE_COPY_CLOSEOUT_OR_NEXT_DECISION
```

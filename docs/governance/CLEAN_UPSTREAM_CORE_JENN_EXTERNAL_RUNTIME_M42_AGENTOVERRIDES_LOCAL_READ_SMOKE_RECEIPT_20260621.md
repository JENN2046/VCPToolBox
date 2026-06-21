# M42 AgentOverrides Runtime-On Local Read Smoke Receipt

Date: 2026-06-21

Status: PASS_AGENTOVERRIDES_LOCAL_READ_SMOKE

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M41_AGENTOVERRIDES_REAL_CONFIG_APPLY_RECEIPT_20260621.md`
- `scripts/run-agent-overrides-runtime-on-local-read-smoke-harness.js`
- `scripts/run-real-config-env-runtime-on-local-gate-harness.js`
- `scripts/run-agent-real-config-unlock-decision-gate-harness.js`

## 1. Scope

M42 verifies that the real-config runtime-on AgentOverrides lane works through the local `AgentManager` read path.

This smoke is intentionally narrow:

```text
production server started: no
HTTP server started: no
Admin route used: no
VCP_AGENT_DIRS enabled: no
plugin execution attempted: no
provider call executed: no
bridge live write executed: no
LocalState/private content read: no
.agent_board/** read or checksummed: no
upstream PR opened: no
```

Prompt content is read for the two reviewed override targets to prove the local read path, but prompt content is not printed.

## 2. Target

Target aliases:

```text
Metis
Nova
```

Target source:

```text
external AgentOverrides only
```

Not selected:

```text
VCP_AGENT_DIRS
external Agent additive lane
```

## 3. Smoke Evidence

Command:

```powershell
node scripts/run-agent-overrides-runtime-on-local-read-smoke-harness.js
```

Result:

```text
AGENT_OVERRIDES_RUNTIME_ON_LOCAL_READ_SMOKE
CONFIG_ENV_EXISTS=yes
CONFIG_ENV_VALUES_PRINTED=no
CONFIG_ENV_SHA256=6072970be0a36124c865d914b048ce1946ef24370cc5958adf7ad7fac9085223
ENV_VCP_AGENT_ALLOWED_ROOTS_SET=yes
ENV_VCP_AGENT_OVERRIDE_DIRS_SET=yes
ENV_VCP_AGENT_DIRS_SET=no
ENV_NON_AGENT_RUNTIME_KEYS_SET_COUNT=0
AGENT_EXTERNAL_ADDITIVE_ROOT_COUNT=0
AGENT_EXTERNAL_OVERRIDE_ROOT_COUNT=1
AGENT_ADDITIVE_FILE_COUNT=0
AGENT_OVERRIDE_FILE_COUNT=2
AGENT_EFFECTIVE_FILE_COUNT=15
AGENT_DIAGNOSTIC_CODES=none
TARGET_ALIAS_COUNT=2
TARGET_ALIASES=Metis,Nova
LOCAL_PROMPT_READ_COUNT=2
READ_PATHS_MATCH_EXTERNAL_OVERRIDE=yes
PROMPT_HASH_MATCHES_EXTERNAL_OVERRIDE=yes
PROMPT_CONTENT_READ=yes
PROMPT_CONTENT_PRINTED=no
PRODUCTION_SERVER_STARTED=no
HTTP_SERVER_STARTED=no
ADMIN_ROUTE_USED=no
PLUGIN_EXECUTION_ATTEMPTED=no
PROVIDER_CALL_EXECUTED=no
BRIDGE_LIVE_WRITE_EXECUTED=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
UPSTREAM_PR_OPENED=no
AGENT_OVERRIDES_RUNTIME_ON_LOCAL_READ_SMOKE_PASS
BLOCK_REASONS=none
```

## 4. Decision

```text
M42 result: PASS
runtime-on lane verified: AgentOverrides local read path
additive Agent lane enabled: no
production server smoke: no
HTTP/Admin route smoke: no
```

This validates local read-path behavior only. It does not validate production uptime, Admin route behavior, additive Agent activation, provider behavior, bridge behavior, or LocalState/private runtime behavior.

## 5. Rollback

Use the M41 rollback:

```text
remove VCP_AGENT_ALLOWED_ROOTS
remove VCP_AGENT_OVERRIDE_DIRS
rerun M39/M40/M42
```

Expected rollback state:

```text
M39 returns to no-runtime-lane BLOCK.
M40 returns to pre-apply decision mode.
M42 blocks because AgentOverrides runtime-on local read path is no longer enabled.
VCP_AGENT_DIRS remains unset.
```

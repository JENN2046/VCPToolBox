# M39 Real Config Env Runtime-On Local Gate Receipt

Date: 2026-06-21

Status: PASS_AFTER_M41_AGENTOVERRIDES_REAL_CONFIG_APPLY

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `scripts/run-real-config-env-runtime-on-local-gate-harness.js`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M38_ACCELERATED_LOCAL_STABILITY_CLOSEOUT_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M41_AGENTOVERRIDES_REAL_CONFIG_APPLY_RECEIPT_20260621.md`

Current status:

```text
Initial M39 run: BLOCK because real config kept all implemented runtime lanes off.
M41 rerun: PASS after explicit authorization to write only VCP_AGENT_ALLOWED_ROOTS and VCP_AGENT_OVERRIDE_DIRS.
VCP_AGENT_DIRS remains unset.
```

## 1. Gate Scope

M39 attempted a runtime-on local gate using the repository's real env file.

Repository reality:

```text
.env exists: no
config.env exists: yes
real env file used for this gate: config.env
```

The gate was intentionally bounded:

```text
server started: no
plugin execution attempted: no
provider call executed: no
bridge live write executed: no
PhotoStudio project data read: no
LocalState/private content read: no
.agent_board/** read or checksummed: no
upstream PR opened: no
config.env modified: no
config.env values printed: no
```

## 2. Real Config Env Result

Command:

```powershell
node scripts/run-real-config-env-runtime-on-local-gate-harness.js
```

Result:

```text
REAL_CONFIG_ENV_RUNTIME_ON_LOCAL_GATE
CONFIG_ENV_EXISTS=yes
CONFIG_ENV_VALUES_PRINTED=no
CONFIG_ENV_FILE_MODIFIED=no
ENV_VCP_PLUGIN_ALLOWED_ROOTS_SET=no
ENV_VCP_PLUGIN_DIRS_SET=no
ENV_VCP_PLUGIN_INSTALL_DIR_SET=no
ENV_VCP_EXTERNAL_PLUGIN_ALLOWLIST_SET=no
ENV_VCP_AGENT_ALLOWED_ROOTS_SET=no
ENV_VCP_AGENT_DIRS_SET=no
ENV_VCP_AGENT_OVERRIDE_DIRS_SET=no
ENV_VCP_ADMIN_EXTENSION_DIRS_SET=no
ENV_VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_SET=no
ENV_VCP_AI_IMAGE_ADAPTER_DIRS_SET=no
ENV_ENABLE_AI_IMAGE_REAL_EXECUTION_SET=no
ENV_VCP_CODEX_MEMORY_BRIDGE_ALLOWED_ROOTS_SET=no
ENV_VCP_CODEX_MEMORY_BRIDGE_DIRS_SET=no
ENV_ENABLE_CODEX_MEMORY_LIVE_WRITE_SET=no
ENV_VCP_PHOTOSTUDIO_PACKAGE_ALLOWED_ROOTS_SET=no
ENV_VCP_PHOTOSTUDIO_PACKAGE_DIRS_SET=no
ENV_ENABLE_PHOTOSTUDIO_AUTO_WRITE_SET=no
ENV_PHOTO_STUDIO_DATA_DIR_SET=no
ENV_VCP_LOCAL_STATE_DIR_SET=no
PLUGIN_EXTERNAL_ROOT_COUNT=0
PLUGIN_ROOT_DIAGNOSTIC_CODES=none
PLUGIN_EXTERNAL_MANIFEST_COUNT=0
PLUGIN_RUNTIME_ALLOWED_COUNT=0
PLUGIN_RUNTIME_BLOCKED_COUNT=0
PLUGIN_RUNTIME_BLOCKED_CODES=none
AGENT_EXTERNAL_ADDITIVE_ROOT_COUNT=0
AGENT_EXTERNAL_OVERRIDE_ROOT_COUNT=0
AGENT_ADDITIVE_FILE_COUNT=0
AGENT_OVERRIDE_FILE_COUNT=0
AGENT_EFFECTIVE_FILE_COUNT=15
AGENT_SKIPPED_FILE_COUNT=0
AGENT_DIAGNOSTIC_CODES=none
SERVER_STARTED=no
PLUGIN_EXECUTION_ATTEMPTED=no
PROVIDER_CALL_EXECUTED=no
BRIDGE_LIVE_WRITE_EXECUTED=no
PHOTO_STUDIO_PROJECT_DATA_READ=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
UPSTREAM_PR_OPENED=no
REAL_CONFIG_ENV_RUNTIME_ON_LOCAL_GATE_BLOCK
BLOCK_REASONS=no_implemented_runtime_lane_enabled_by_real_config_env
```

## 3. Initial Decision

```text
M39 result: BLOCK
block reason: real config.env does not enable any implemented external runtime lane
runtime-on local gate passed: no
config.env values exposed: no
config.env modified: no
```

This BLOCK means the code/package layer is ready enough to test a real-env runtime-on gate, but the actual real env currently keeps all implemented runtime lanes off.

## 3.1 M41 Rerun Decision

After explicit authorization, M41 wrote only the two selected AgentOverrides keys to real `config.env` and reran this gate.

```text
M39 rerun result: PASS
runtime-on lane: AgentOverrides only
VCP_AGENT_DIRS set: no
provider/bridge/LocalState/private enabled: no
config.env values exposed: no
```

## 4. Unblock Conditions

M39 was retried by M41 after a separate explicit decision about real `config.env` runtime-on configuration.

Historical options before M41:

```text
Option A: user manually edits config.env, then rerun M39 harness
Option B: user gives explicit current-turn authorization to modify config.env with exact env vars and rollback plan
Option C: keep real env runtime-off and leave M39 BLOCK/DEFERRED
```

No option may enable provider calls, bridge live writes, production deploy/startup, LocalState/private reads, or `.agent_board/**` access without a separate gate.

## 5. Rollback

Rollback M39 by reverting:

```text
core governance commit that adds the M39 harness, receipt, and tracker update
```

No `config.env` rollback is required because this gate did not modify it.

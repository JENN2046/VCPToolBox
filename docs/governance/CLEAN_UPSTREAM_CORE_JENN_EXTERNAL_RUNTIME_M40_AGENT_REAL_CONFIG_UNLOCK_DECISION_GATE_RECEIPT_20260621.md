# M40 Agent Real Config Unlock Decision Gate Receipt

Date: 2026-06-21

Status: PASS_AGENT_OVERRIDE_ONLY_UNLOCK_DECISION_AND_POST_APPLY_VALIDATION

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M39_REAL_CONFIG_ENV_RUNTIME_ON_LOCAL_GATE_RECEIPT_20260621.md`
- `scripts/run-agent-real-config-unlock-decision-gate-harness.js`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M17_AGENT_ENV_ON_SHADOW_ROLLBACK_RECEIPT_20260621.md`

## 1. Gate Scope

M40 defines the smallest safe real-config unlock decision after M39 blocked on runtime-off real config.

Post-apply update:

```text
M41 later applied the selected two-key config candidate.
M40 harness now supports post-apply validation and passed after M41.
```

This is a decision and dry-run gate only:

```text
config.env modified: no
config.env values printed: no
server started: no
Agent prompt content read: no
plugin execution attempted: no
provider call executed: no
bridge live write executed: no
PhotoStudio project data read: no
LocalState/private content read: no
.agent_board/** read or checksummed: no
upstream PR opened: no
```

## 2. Plan Change

Initial candidate considered:

```text
VCP_AGENT_ALLOWED_ROOTS
VCP_AGENT_DIRS
VCP_AGENT_OVERRIDE_DIRS
```

Dry-run result forced a narrower candidate:

```text
VCP_AGENT_DIRS caused additive_duplicate_core_agent:7
skipped additive files: 7
```

Decision:

```text
select only AgentOverrides as the first real-config unlock candidate
keep additive Agent lane off for now
```

This is still inside the Agent lane, but it is the minimum viable sub-lane. The seven additive Agent files remain packaged and reviewed, but they are not selected for the first real-config unlock because the current core already contains matching Agent ids.

## 3. Future Config Candidate

At initial decision time, M40 did not apply this change. M41 later applied the same minimum Agent-only candidate after explicit authorization:

```text
VCP_AGENT_ALLOWED_ROOTS=<external package root>
VCP_AGENT_OVERRIDE_DIRS=<external AgentOverrides root>
```

Explicitly not selected in this gate:

```text
VCP_AGENT_DIRS
VCP_PLUGIN_ALLOWED_ROOTS
VCP_PLUGIN_DIRS
VCP_PLUGIN_INSTALL_DIR
VCP_EXTERNAL_PLUGIN_ALLOWLIST
VCP_ADMIN_EXTENSION_DIRS
VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS
VCP_AI_IMAGE_ADAPTER_DIRS
ENABLE_AI_IMAGE_REAL_EXECUTION
VCP_CODEX_MEMORY_BRIDGE_ALLOWED_ROOTS
VCP_CODEX_MEMORY_BRIDGE_DIRS
ENABLE_CODEX_MEMORY_LIVE_WRITE
VCP_PHOTOSTUDIO_PACKAGE_ALLOWED_ROOTS
VCP_PHOTOSTUDIO_PACKAGE_DIRS
ENABLE_PHOTOSTUDIO_AUTO_WRITE
PHOTO_STUDIO_DATA_DIR
VCP_LOCAL_STATE_DIR
```

Provider, bridge, LocalState, private lanes, PhotoStudio project data, plugin runtime, and AdminPanel runtime stay closed.

## 4. Dry-Run Evidence

Command:

```powershell
node scripts/run-agent-real-config-unlock-decision-gate-harness.js
```

Result:

```text
AGENT_REAL_CONFIG_UNLOCK_DECISION_GATE
CONFIG_ENV_EXISTS=yes
CONFIG_ENV_VALUES_PRINTED=no
CONFIG_ENV_EDIT_APPLIED=no
CONFIG_ENV_HASH_UNCHANGED=yes
REAL_ENV_AGENT_KEYS_SET_COUNT=0
REAL_ENV_NON_AGENT_RUNTIME_KEYS_SET_COUNT=0
CANDIDATE_UNLOCK_LANE=agent-overrides
CANDIDATE_AGENT_ADDITIVE_ENABLED=no
CANDIDATE_AGENT_OVERRIDE_ENABLED=yes
CANDIDATE_AGENT_KEYS_SET_COUNT=2
CANDIDATE_NON_AGENT_RUNTIME_KEYS_SET_COUNT=0
EXTERNAL_ROOT_EXISTS=yes
EXTERNAL_AGENT_ROOT_EXISTS=yes
EXTERNAL_AGENT_ROOT_SELECTED=no
EXTERNAL_AGENT_OVERRIDE_ROOT_EXISTS=yes
EXTERNAL_AGENT_OVERRIDE_ROOT_SELECTED=yes
TARGET_PATH_SCAN_COUNT=3
TARGET_PATH_RISK_COUNT=0
TARGET_AGENT_BOARD_PATH_COUNT=0
TARGET_LOCALSTATE_PATH_COUNT=0
TARGET_PRIVATE_PATH_COUNT=0
AGENT_EXTERNAL_ADDITIVE_ROOT_COUNT=0
AGENT_EXTERNAL_OVERRIDE_ROOT_COUNT=1
AGENT_ADDITIVE_FILE_COUNT=0
AGENT_OVERRIDE_FILE_COUNT=2
AGENT_EFFECTIVE_FILE_COUNT=15
AGENT_SKIPPED_FILE_COUNT=0
AGENT_DIAGNOSTIC_CODES=none
AGENT_PROMPT_CONTENT_READ=no
SERVER_STARTED=no
PLUGIN_EXECUTION_ATTEMPTED=no
PROVIDER_CALL_EXECUTED=no
BRIDGE_LIVE_WRITE_EXECUTED=no
PHOTO_STUDIO_PROJECT_DATA_READ=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
UPSTREAM_PR_OPENED=no
AGENT_REAL_CONFIG_UNLOCK_DECISION_GATE_PASS
BLOCK_REASONS=none
```

## 5. Decision

```text
M40 result: PASS
selected unlock lane: AgentOverrides only
real config.env edited: no
M39 changed to PASS: no
```

At M40 decision time, M39 remained BLOCK until a separate explicit real `config.env` edit was authorized and then revalidated.

Post-apply validation:

```text
M41 explicitly authorized and applied the two-key candidate.
M39 passed after rerun.
M40 passed in post-apply-validation mode.
```

## 6. Rollback

Rollback this gate by reverting the core governance commit that adds:

```text
scripts/run-agent-real-config-unlock-decision-gate-harness.js
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M40_AGENT_REAL_CONFIG_UNLOCK_DECISION_GATE_RECEIPT_20260621.md
tracker M40/S61 updates
```

No `config.env` rollback is required because this gate did not modify it.

If a future approved config edit applies the candidate, rollback is:

```text
remove VCP_AGENT_ALLOWED_ROOTS
remove VCP_AGENT_OVERRIDE_DIRS
rerun M39/M40 validation
```

# M82 AI Image Diagnostic Real-Config Apply/Rollback Drill Receipt

Date: 2026-06-22

Status: PASS_AI_IMAGE_DIAGNOSTIC_REAL_CONFIG_APPLY_ROLLBACK_DRILL

Parent decision: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M81_AI_IMAGE_DIAGNOSTIC_ROUTE_REAL_CONFIG_UNLOCK_DECISION_20260622.md`

Harness: `scripts/run-ai-image-diagnostic-real-config-apply-rollback-drill-harness.js`

## 1. Authorization And Final State

User authorization:

```text
authorized_real_config_env_write=yes
authorized_scope=M82_AI_IMAGE_DIAGNOSTIC_METADATA_REAL_CONFIG_APPLY_ROLLBACK_DRILL
```

Selected final state:

```text
M82_FINAL_STATE=OPTION_B_REMOVED_AFTER_ROLLBACK
```

Reason:

M81 required the final state to be declared before writing real `config.env`. The safest authorized local proof is to write exactly the three diagnostic metadata keys, validate route behavior, then remove the keys and leave real `config.env` in the pre-apply state. This proves the unlock path without leaving AI Image diagnostic runtime-on in persistent config.

## 2. Allowed Real Config Writes

M82 was allowed to transiently write only these keys:

```text
ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE
VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS
VCP_AI_IMAGE_ADAPTER_DIRS
```

M82 did not write or enable:

```text
ENABLE_AI_IMAGE_REAL_EXECUTION
ENABLE_AI_IMAGE_AGENTS_ROUTE
ENABLE_NATIVE_DOUBAO_SECRETLESS_RUNTIME_DELEGATE
VCP_AGENT_DIRS
provider tokens / credentials / endpoints
bridge / LocalState / private keys
```

No raw `config.env` values were printed.

## 3. Harness Evidence

Command:

```powershell
node scripts\run-ai-image-diagnostic-real-config-apply-rollback-drill-harness.js
```

Key output:

```text
AI_IMAGE_DIAGNOSTIC_REAL_CONFIG_APPLY_ROLLBACK_DRILL_PASS=yes
M82_FINAL_STATE=OPTION_B_REMOVED_AFTER_ROLLBACK
CONFIG_ENV_VALUES_PRINTED=no
CONFIG_ENV_INITIAL_SHA256=908cf54b61878606946b6f0d14544a488ff24b87f17b78c04e9cab6d8ace97d3
CONFIG_ENV_AFTER_APPLY_SHA256=4dcd37f31b1f71c965f86cca25d8d4f882db045ee85cc5ee944b94724b025943
CONFIG_ENV_FINAL_SHA256=908cf54b61878606946b6f0d14544a488ff24b87f17b78c04e9cab6d8ace97d3
CONFIG_ENV_FINAL_SHA_RESTORED=yes
BLOCK_REASONS=none
```

Pre-apply proof:

```text
INITIAL_ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_LINE_COUNT=0
INITIAL_VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_LINE_COUNT=0
INITIAL_VCP_AI_IMAGE_ADAPTER_DIRS_LINE_COUNT=0
INITIAL_ENABLE_AI_IMAGE_REAL_EXECUTION_LINE_COUNT=0
PRE_APPLY_ROUTE_ENABLED=no
PRE_APPLY_MOUNTED_ROUTE_COUNT=0
PRE_APPLY_ROUTE_STATUS=404
```

Apply proof:

```text
REAL_CONFIG_WRITE_EXECUTED=yes
AFTER_APPLY_ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_LINE_COUNT=1
AFTER_APPLY_VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_LINE_COUNT=1
AFTER_APPLY_VCP_AI_IMAGE_ADAPTER_DIRS_LINE_COUNT=1
AFTER_APPLY_ENABLE_AI_IMAGE_REAL_EXECUTION_LINE_COUNT=0
AFTER_APPLY_ROUTE_ENABLED=yes
AFTER_APPLY_MOUNTED_ROUTE_COUNT=1
AFTER_APPLY_ROUTE_STATUS=200
AFTER_APPLY_POST_STATUS=404
UNAUTHORIZED_ROUTE_STATUS=403
REAL_EXECUTION_BLOCKED_STATUS=409
```

Metadata-only proof:

```text
AFTER_APPLY_METADATA_ADAPTER_COUNT=1
AFTER_APPLY_EXECUTABLE_ADAPTER_COUNT=0
AFTER_APPLY_PROVIDER_CALL_COUNT=0
AFTER_APPLY_IMAGE_GENERATION_COUNT=0
AFTER_APPLY_OUTPUT_WRITE_COUNT=0
AFTER_APPLY_BRIDGE_CALL_COUNT=0
AFTER_APPLY_LOCALSTATE_READ_COUNT=0
AFTER_APPLY_RESPONSE_ABSOLUTE_PATH_COUNT=0
AFTER_APPLY_RESPONSE_SECRET_FIELD_COUNT=0
```

Rollback proof:

```text
ROLLBACK_ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_LINE_COUNT=0
ROLLBACK_VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_LINE_COUNT=0
ROLLBACK_VCP_AI_IMAGE_ADAPTER_DIRS_LINE_COUNT=0
ROLLBACK_ROUTE_ENABLED=no
ROLLBACK_MOUNTED_ROUTE_COUNT=0
ROLLBACK_ROUTE_STATUS=404
REAL_CONFIG_ENV_MODIFIED=transient_only_final_restored
```

Safety proof:

```text
CORE_AI_IMAGE_DIAGNOSTIC_RUNTIME_HASH_UNCHANGED=yes
SERVER_JS_HASH_UNCHANGED=yes
ADMIN_PANEL_ROUTES_HASH_UNCHANGED_DURING_HARNESS=yes
EXTERNAL_AI_IMAGE_PACKAGE_HASH_UNCHANGED=yes
PROCESS_ENV_FINAL_UNCHANGED=yes
LOCAL_HTTP_TEST_SERVER_STARTED=yes
PRODUCTION_SERVER_STARTED=no
PROVIDER_CALL_EXECUTED=no
REAL_IMAGE_GENERATED=no
IMAGE_OUTPUT_WRITTEN=no
BRIDGE_WRITE_EXECUTED=no
LOCALSTATE_PRIVATE_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
UPSTREAM_PR_OPENED=no
```

## 4. Post-Run Real Config State

Independent post-run check:

```text
CONFIG_ENV_SHA256=908cf54b61878606946b6f0d14544a488ff24b87f17b78c04e9cab6d8ace97d3
ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_LINE_COUNT=0
VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_LINE_COUNT=0
VCP_AI_IMAGE_ADAPTER_DIRS_LINE_COUNT=0
ENABLE_AI_IMAGE_REAL_EXECUTION_LINE_COUNT=0
```

`config.env` was restored to its pre-apply hash and was not staged or committed.

## 5. Validation

```text
node --check scripts\run-ai-image-diagnostic-real-config-apply-rollback-drill-harness.js
PASS

node scripts\run-ai-image-diagnostic-real-config-apply-rollback-drill-harness.js
PASS
```

Additional protective validation:

```text
node --test tests\ai-image-adapter-diagnostic-route.test.js tests\ai-image-adapter-diagnostic-runtime-mount.test.js
11 pass / 0 fail

node scripts\run-ai-image-diagnostic-production-router-integration-scoped-env-harness.js
PASS

node scripts\run-ai-image-default-off-diagnostic-route-gate-harness.js
PASS

node scripts\run-ai-image-no-provider-runtime-registration-gate-harness.js
PASS
```

## 6. Safety Confirmations

```text
M82_REAL_CONFIG_WRITE_AUTHORIZED=yes
M82_REAL_CONFIG_WRITE_SCOPE=exact_three_diagnostic_metadata_keys
M82_FINAL_REAL_CONFIG_STATE=three_keys_removed
M82_CONFIG_VALUES_PRINTED=no
M82_PROVIDER_RUNTIME_UNLOCKED=no
M82_REAL_IMAGE_GENERATION_UNLOCKED=no
M82_EXECUTABLE_ADAPTER_RUNTIME_REGISTERED=no
M82_BRIDGE_WRITE_EXECUTED=no
M82_LOCALSTATE_PRIVATE_READ=no
M82_PRODUCTION_SERVER_STARTED=no
M82_UPSTREAM_PR_OPENED=no
```

## 7. Next Gate

M82 completes the real-config apply/rollback proof for the AI Image diagnostic metadata route. The next decision should choose one of:

```text
STOP_AI_IMAGE_AT_REAL_CONFIG_ROLLBACK_PROOF
WRITE_M83_AI_IMAGE_DIAGNOSTIC_PERSISTENT_ENABLE_TASKBOOK
RETURN_TO_DEFERRED_RUNTIME_LANE_MATRIX
```

Any future persistent enable must be a separate current-turn authorization and must still keep provider runtime, real image generation, bridge writes, and LocalState/private lanes closed unless explicitly opened by a later gate.

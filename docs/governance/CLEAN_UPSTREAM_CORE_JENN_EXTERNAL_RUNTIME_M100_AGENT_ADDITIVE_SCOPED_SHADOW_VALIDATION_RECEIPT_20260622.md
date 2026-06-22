# M100 Agent Additive Scoped Shadow Validation Receipt

Date: 2026-06-22

Status: BLOCK_SCOPED_HARNESS_IMPLEMENTED_NO_REAL_ENV

Decision: `M100_BLOCK_ADDITIVE_EFFECTIVE_SOURCE_REMAINS_CORE`

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Taskbook: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M99_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_TASKBOOK_20260622.md`

Harness: `scripts/run-agent-additive-scoped-shadow-validation-harness.js`

## 1. Scope

M100 implemented the authorized scoped harness only.

Allowed files changed:

```text
scripts/run-agent-additive-scoped-shadow-validation-harness.js
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M100_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_RECEIPT_20260622.md
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
```

M100 did not:

```text
write real config.env or .env
enable real VCP_AGENT_DIRS
modify AgentManager or AgentRootResolver runtime source
modify tests/**
copy additional Agent content
modify external package content
remove, stub, delete, or untrack core Agent fallback files
read LocalState/private/operator data
read, checksum, copy, or migrate .agent_board/**
start production server
call provider, bridge, live write, sync, publish, or deployment endpoints
open upstream PR
```

## 2. Validation Commands

```powershell
node --check scripts/run-agent-additive-scoped-shadow-validation-harness.js
```

Result: PASS.

```powershell
node --test tests/agent-external-root-resolver.test.js tests/agent-manager-external-runtime.test.js
```

Result: PASS, `13 pass / 0 fail`.

```powershell
node scripts/run-agent-additive-scoped-shadow-validation-harness.js
```

Result: expected BLOCK, exit `1`.

The BLOCK is the M100 gate result, not a harness crash.

## 3. Harness Result

```text
M100_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION
SCOPED_PROCESS_ENV_ONLY=yes
REAL_CONFIG_ENV_WRITTEN=no
REAL_CONFIG_ENV_VALUES_PRINTED=no
VCP_AGENT_DIRS_REAL_CONFIG_ENABLED=no
PROMPT_CONTENT_PRINTED=no
PRODUCTION_SERVER_STARTED=no
ADMIN_ROUTE_USED=no
ADMIN_EXTERNAL_AGENT_WRITE_ENABLED=no
ADMIN_EXTERNAL_AGENT_WRITE_BLOCKED=yes
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
PROVIDER_OR_BRIDGE_OR_LIVE_WRITE_EXECUTED=no
UPSTREAM_PR_OPENED=no
EXTERNAL_PACKAGE_ROOT_PRESENT=yes
EXTERNAL_ADDITIVE_TARGET_MISSING_COUNT=0
EXTERNAL_OVERRIDE_TARGET_MISSING_COUNT=0
CORE_FALLBACK_TARGET_MISSING_COUNT=0
EXTERNAL_ADDITIVE_AGGREGATE_SHA256=9e48f742d99268e75afe2a49f7b3885dd713e244267414ff3c3fd13315d0d122
EXTERNAL_OVERRIDE_AGGREGATE_SHA256=84a302a9a304213201b656f30db4680341b76cb1db35bf4733aabf3e64cc963f
CORE_FALLBACK_AGGREGATE_SHA256=49d186ae3f54ef1a35911659059d7a32b179c86a71a1574825b90e3e7c9542da
ADDITIVE_CANDIDATE_COUNT=7
ADDITIVE_EXTERNAL_SOURCE_COUNT=7
ADDITIVE_EFFECTIVE_EXTERNAL_SOURCE_COUNT=0
ADDITIVE_EFFECTIVE_SOURCE_MARKERS=core:7
ADDITIVE_DUPLICATE_CORE_DIAGNOSTIC_COUNT=7
OVERRIDE_CONTROL_COUNT=2
OVERRIDE_EXTERNAL_SOURCE_COUNT=2
OVERRIDE_EFFECTIVE_SOURCE_MARKERS=external-override:2
CORE_AGENT_FALLBACK_RETAINED=9
EXTERNAL_ADDITIVE_HASH_UNCHANGED=yes
EXTERNAL_OVERRIDE_HASH_UNCHANGED=yes
CORE_FALLBACK_HASH_UNCHANGED=yes
ROLLBACK_PROCESS_ENV_RESTORED=yes
ROLLBACK_ADDITIVE_EXTERNAL_SOURCE_COUNT=0
CORE_AGENT_FALLBACK_REMOVED=no
REAL_CONFIG_ENV_VALUES_READ=no
SCRIPT_MODIFIED=yes
TESTS_MODIFIED=no
AGENTMANAGER_RUNTIME_CHANGED=no
BLOCK_REASONS=additive_duplicate_core_blocks_effective_external_source,additive_effective_source_not_external
M100_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_PASS=no
M100_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_BLOCK
```

## 4. Interpretation

M100 proved the external additive package is present and scanned:

```text
ADDITIVE_EXTERNAL_SOURCE_COUNT=7
EXTERNAL_ADDITIVE_TARGET_MISSING_COUNT=0
EXTERNAL_ADDITIVE_HASH_UNCHANGED=yes
```

M100 also proved the current runtime contract does not make those 7 additive files effective while same-name core fallback files remain:

```text
ADDITIVE_EFFECTIVE_EXTERNAL_SOURCE_COUNT=0
ADDITIVE_EFFECTIVE_SOURCE_MARKERS=core:7
ADDITIVE_DUPLICATE_CORE_DIAGNOSTIC_COUNT=7
```

This matches the existing Agent resolver rule: additive external Agent roots add new ids but do not override same-id core Agent files. The override lane remains healthy:

```text
OVERRIDE_EXTERNAL_SOURCE_COUNT=2
OVERRIDE_EFFECTIVE_SOURCE_MARKERS=external-override:2
```

## 5. Stop Line

M100 must stop here.

Do not proceed to a real `VCP_AGENT_DIRS` write or an M101 real-config unlock decision from this result. Enabling additive runtime now would not make the 7 copied same-name Agent files effective under the current resolver while core fallback remains retained.

Any future continuation needs a separate decision package for one of these mutually exclusive paths:

```text
keep additive Agent lane deferred
create a reviewed core-fallback removal/stub/untrack decision package, without executing it automatically
design a reviewed resolver-policy change, without changing runtime source automatically
```

The current hard boundary still forbids automatic core fallback deletion, untrack, stub, or runtime source rewrite.

## 6. Rollback

Rollback for M100 is local and narrow:

```text
remove/revert scripts/run-agent-additive-scoped-shadow-validation-harness.js
remove/revert this M100 receipt
restore the tracker to the pre-M100 state
```

No real env rollback is required because M100 did not write real `.env` or `config.env`.

No external package rollback is required because M100 did not modify external package content.

No core Agent rollback is required because M100 did not remove, edit, stub, untrack, or overwrite core Agent files.

## 7. Result

```text
M100_STATUS=BLOCK
M100_HARNESS_IMPLEMENTED=yes
M100_HARNESS_EXIT=1_EXPECTED_BLOCK
M100_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_PASS=no
M100_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_BLOCK=yes
ADDITIVE_EXTERNAL_SOURCE_COUNT=7
ADDITIVE_EFFECTIVE_EXTERNAL_SOURCE_COUNT=0
ADDITIVE_DUPLICATE_CORE_DIAGNOSTIC_COUNT=7
OVERRIDE_EXTERNAL_SOURCE_COUNT=2
CORE_AGENT_FALLBACK_RETAINED=9
REAL_CONFIG_ENV_WRITTEN=no
VCP_AGENT_DIRS_ENABLED=no
AGENTMANAGER_RUNTIME_CHANGED=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
PRODUCTION_SERVER_STARTED=no
PROVIDER_OR_BRIDGE_OR_LIVE_WRITE_EXECUTED=no
UPSTREAM_PR_OPENED=no
NEXT_SAFE_GATE=M101_DECISION_PACKAGE_FOR_AGENT_ADDITIVE_BLOCKER_OR_DEFER
```

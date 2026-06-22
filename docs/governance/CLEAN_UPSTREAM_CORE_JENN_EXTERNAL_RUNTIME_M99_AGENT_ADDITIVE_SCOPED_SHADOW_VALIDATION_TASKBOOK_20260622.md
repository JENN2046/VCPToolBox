# M99 Agent Additive Scoped Shadow Validation Taskbook

Date: 2026-06-22

Status: PASS_TASKBOOK_ONLY_NO_HARNESS_NO_REAL_ENV

Decision: `DEFINE_M100_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_HARNESS_GATE`

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M12_AGENT_CONTENT_COPY_FIRST_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M13_AGENT_SHADOW_LOADER_VALIDATION_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M17_AGENT_ENV_ON_SHADOW_ROLLBACK_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M45_AGENTOVERRIDES_RUNTIME_ON_AGGREGATE_REVIEW_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M86_EXTRACTION_GAP_MATRIX_20260622.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M98_AGENT_ADDITIVE_RUNTIME_DECISION_TASKBOOK_20260622.md`

## 1. Scope

M99 defines a future scoped shadow validation gate for the additive Agent lane.

M99 does not:

```text
implement a harness
modify scripts/**
modify tests/**
modify modules/agentManager.js
modify modules/agentRootResolver.js
modify routes/admin/agents.js
write real config.env or .env
enable VCP_AGENT_DIRS
change VCP_AGENT_ALLOWED_ROOTS
change VCP_AGENT_OVERRIDE_DIRS
copy additional Agent content
modify external package content
delete, untrack, stub, or remove core Agent fallback files
allow AdminPanel writes to external Agent roots
read LocalState/private/operator content
read, checksum, copy, or migrate .agent_board/**
start production server
call providers, bridges, live writes, sync, publish, or deployment endpoints
open upstream PR
```

M99 is intentionally narrower than runtime enablement. It prepares M100 only.

## 2. Current Evidence Baseline

The additive Agent package is copied but not runtime-on.

External package root from prior receipts:

```text
A:/AGENTS_OS_Workspace/runtime/VCPToolBox-JENN-Extensions
```

Additive Agent candidates copied to external `Agent/`:

```text
Agent/AIImageGenExpert.txt
Agent/AuditMaster.txt
Agent/MemoriaSorter.txt
Agent/Muse.txt
Agent/动力猛兽.txt
Agent/小秋.txt
Agent/诺宝.txt
```

Override control candidates already handled by `AgentOverrides/`:

```text
AgentOverrides/Metis.txt
AgentOverrides/Nova.txt
```

Current state:

```text
ADDITIVE_COPIED_COUNT=7
OVERRIDE_RUNTIME_ON_COUNT=2
ADDITIVE_RUNTIME_ON_COUNT=0
VCP_AGENT_DIRS_REAL_CONFIG_LINE_COUNT=0
CORE_AGENT_FALLBACK_RETAINED=9
AGENT_STUB_REMOVE_UNTRACK_EXECUTED=0
```

M13 proved copy-first package integrity and target presence without runtime registration.
M17 proved the temporary env-on shadow/rollback pattern using scoped test process state.
M45 proved current real runtime remains `AgentOverrides` only and additive `VCP_AGENT_DIRS` remains disabled.

## 3. M100 Objective

M100, if explicitly authorized later, should answer one narrow question:

```text
Can the 7 reviewed additive external Agent files be resolved through AgentManager under scoped process.env only, while preserving override-only real config, core fallback, Admin write block, and all private/provider/bridge/production stop lines?
```

M100 must not answer or attempt:

```text
Should real VCP_AGENT_DIRS be written?
Should core Agent fallback be removed?
Should AdminPanel write external Agent files?
Should LocalState/private/.agent_board lanes be opened?
Should provider, bridge, live write, deployment, or upstream PR lanes be opened?
```

## 4. Future M100 Allowed Surface

Allowed future implementation files, only if a later current-turn instruction explicitly authorizes M100 implementation:

```text
scripts/run-agent-additive-scoped-shadow-validation-harness.js
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M100_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_RECEIPT_20260622.md
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
```

Allowed future validation commands:

```powershell
node --check scripts/run-agent-additive-scoped-shadow-validation-harness.js
node --test tests/agent-external-root-resolver.test.js tests/agent-manager-external-runtime.test.js
node scripts/run-agent-additive-scoped-shadow-validation-harness.js
git diff --check
```

These commands are future M100 commands only. M99 does not run them and does not create the harness.

## 5. Future M100 Required Harness Behavior

The future harness must:

```text
save current process.env VCP_AGENT_ALLOWED_ROOTS, VCP_AGENT_DIRS, and VCP_AGENT_OVERRIDE_DIRS
set scoped process.env values only inside the Node process
point scoped VCP_AGENT_ALLOWED_ROOTS to the reviewed external package root
point scoped VCP_AGENT_DIRS to reviewed external Agent/
preserve scoped VCP_AGENT_OVERRIDE_DIRS behavior for Metis and Nova controls
call AgentManager read paths locally without starting production server
verify additive prompt source markers for all 7 additive candidates
verify override prompt source markers for Metis and Nova remain external override controls
verify rollback by restoring process.env and observing core fallback / override-only behavior as expected
restore process.env in finally block
print only source markers, counts, hashes, and pass/fail booleans
avoid printing prompt bodies, env values, secrets, tokens, provider config, or absolute private paths
```

The future harness must not:

```text
write real config.env or .env
write external package files
write core Agent files
write LocalState/private/operator data
read/checksum .agent_board/**
start server.js or any production server
call provider, bridge, live write, sync, publish, or deployment endpoints
use AdminPanel write methods against external Agent roots
delete, stub, untrack, or remove fallback files
```

## 6. Future M100 Expected Markers

M100 receipt must include a redacted result block with at least:

```text
M100_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_PASS=yes
SCOPED_PROCESS_ENV_ONLY=yes
REAL_CONFIG_ENV_WRITTEN=no
REAL_CONFIG_ENV_VALUES_PRINTED=no
VCP_AGENT_DIRS_REAL_CONFIG_ENABLED=no
ADDITIVE_CANDIDATE_COUNT=7
ADDITIVE_EXTERNAL_SOURCE_COUNT=7
OVERRIDE_CONTROL_COUNT=2
OVERRIDE_EXTERNAL_SOURCE_COUNT=2
CORE_AGENT_FALLBACK_RETAINED=9
CORE_AGENT_FALLBACK_REMOVED=no
ADMIN_EXTERNAL_AGENT_WRITE_ENABLED=no
ADMIN_EXTERNAL_AGENT_WRITE_BLOCKED=yes
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
PRODUCTION_SERVER_STARTED=no
PROVIDER_OR_BRIDGE_OR_LIVE_WRITE_EXECUTED=no
UPSTREAM_PR_OPENED=no
```

If any marker cannot be produced without reading private content, writing real env, changing runtime source, or starting production services, M100 must stop as `BLOCKED`.

## 7. Future M100 Block Conditions

M100 must block if:

```text
external package root is missing
any of the 7 additive Agent target files is missing
any expected AgentOverrides control file is missing
scoped VCP_AGENT_ALLOWED_ROOTS cannot be constrained to the reviewed external package root
scoped VCP_AGENT_DIRS would point outside reviewed external Agent/
AgentManager behavior would require source code changes
prompt bodies would need to be printed as evidence
real config.env or .env would need to be read for values or written
AdminPanel write methods would need to be enabled
LocalState/private/.agent_board content would need to be read
production server or provider/bridge/live-write behavior would be required
```

## 8. Future Real-Config Stop Line

M99 and M100 do not authorize real additive runtime.

Before any future real `VCP_AGENT_DIRS` write, there must be a separate decision gate after M100:

```text
M101_AGENT_ADDITIVE_REAL_CONFIG_UNLOCK_DECISION_GATE
```

That future gate must be decision-only first and must still require current-turn explicit authorization before any real config edit.

## 9. Rollback

M99 rollback is docs-only:

```text
git revert <M99 core commit>
```

Future M100 rollback, if implemented later, must be:

```text
delete/revert the test-only harness
revert the M100 receipt and tracker rows
restore process.env inside the harness finally block
leave real config.env untouched
leave external package content untouched
leave core Agent fallback untouched
```

Rollback must not use deletion of LocalState, `.agent_board/**`, secrets, cache, logs, outputs, DB/vector stores, external package source, or core Agent files as shortcuts.

## 10. Validation

M99 validation is documentation-only:

```powershell
git diff --check
changed-path risk scan
secret-shape scan over M99/tracker docs
git diff --cached --check
staged path-risk scan
staged secret-shape scan
```

No runtime, build, production server, provider call, bridge write, live external write, private data read, harness implementation, or real config write is required or allowed.

## 11. Result

```text
M99_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_TASKBOOK_PASS=yes
NEXT_GATE=M100_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_HARNESS_GATE
HARNESS_IMPLEMENTED=no
SCRIPT_MODIFIED=no
TESTS_MODIFIED=no
AGENTMANAGER_RUNTIME_CHANGED=no
VCP_AGENT_DIRS_ENABLED=no
REAL_CONFIG_ENV_WRITTEN=no
REAL_CONFIG_ENV_VALUES_PRINTED=no
ADDITIONAL_AGENT_CONTENT_COPIED=no
EXTERNAL_PACKAGE_MODIFIED=no
CORE_AGENT_FALLBACK_REMOVED=no
ADMIN_EXTERNAL_AGENT_WRITE_ENABLED=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
AGENT_BOARD_READ_OR_CHECKSUMMED=no
PRODUCTION_SERVER_STARTED=no
PROVIDER_OR_BRIDGE_OR_LIVE_WRITE_EXECUTED=no
UPSTREAM_PR_OPENED=no
```

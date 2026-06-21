# M43 AgentOverrides Config Rollback Drill Receipt

Date: 2026-06-21

Status: PASS_AGENTOVERRIDES_CONFIG_ROLLBACK_DRILL

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M41_AGENTOVERRIDES_REAL_CONFIG_APPLY_RECEIPT_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M42_AGENTOVERRIDES_LOCAL_READ_SMOKE_RECEIPT_20260621.md`
- `scripts/run-agent-overrides-runtime-on-local-read-smoke-harness.js`

## 1. Scope

M43 temporarily removed the two AgentOverrides real `config.env` keys, confirmed M42 correctly blocked, restored the two keys, and confirmed M42 passed again.

Target keys:

```text
VCP_AGENT_ALLOWED_ROOTS
VCP_AGENT_OVERRIDE_DIRS
```

Key that stayed disabled:

```text
VCP_AGENT_DIRS
```

Boundaries:

```text
config.env values printed: no
config.env committed: no
production server started: no
HTTP server started: no
Admin route used: no
plugin execution attempted: no
provider call executed: no
bridge live write executed: no
LocalState/private content read: no
.agent_board/** read or checksummed: no
upstream PR opened: no
```

## 2. Remove Phase

Command class:

```text
key-only local config edit; values not printed
```

Result:

```text
VCP_AGENT_ALLOWED_ROOTS_LINE_COUNT=0
VCP_AGENT_OVERRIDE_DIRS_LINE_COUNT=0
VCP_AGENT_DIRS_LINE_COUNT=0
CONFIG_ENV_BEFORE_SHA256=6072970be0a36124c865d914b048ce1946ef24370cc5958adf7ad7fac9085223
CONFIG_ENV_AFTER_REMOVE_SHA256=580d92026e722d0f3d0a38929286b2aa8bc1a7ecd1f4d14de5a506bc8c73406e
CONFIG_ENV_VALUES_PRINTED=no
```

## 3. Expected Block

Command:

```powershell
node scripts/run-agent-overrides-runtime-on-local-read-smoke-harness.js
```

Expected result:

```text
AGENT_OVERRIDES_RUNTIME_ON_LOCAL_READ_SMOKE_BLOCK
EXPECTED_M42_BLOCK_EXIT=1
```

Key evidence:

```text
ENV_VCP_AGENT_ALLOWED_ROOTS_SET=no
ENV_VCP_AGENT_OVERRIDE_DIRS_SET=no
ENV_VCP_AGENT_DIRS_SET=no
LOCAL_PROMPT_READ_COUNT=0
PROMPT_CONTENT_READ=no
PROMPT_CONTENT_PRINTED=no
BLOCK_REASONS=agent_file_plan_missing,vcp_agent_allowed_roots_unset,vcp_agent_override_dirs_unset
```

Sanity check:

```text
M39 returned expected BLOCK with no implemented runtime lane enabled.
M40 returned PASS in pre-apply decision mode.
```

## 4. Restore Phase

Command class:

```text
key-only local config restore; values not printed
```

Result:

```text
VCP_AGENT_ALLOWED_ROOTS_LINE_COUNT=1
VCP_AGENT_OVERRIDE_DIRS_LINE_COUNT=1
VCP_AGENT_DIRS_LINE_COUNT=0
CONFIG_ENV_BEFORE_RESTORE_SHA256=580d92026e722d0f3d0a38929286b2aa8bc1a7ecd1f4d14de5a506bc8c73406e
CONFIG_ENV_AFTER_RESTORE_SHA256=6072970be0a36124c865d914b048ce1946ef24370cc5958adf7ad7fac9085223
CONFIG_ENV_VALUES_PRINTED=no
```

## 5. Restored Pass

Command:

```powershell
node scripts/run-agent-overrides-runtime-on-local-read-smoke-harness.js
```

Result:

```text
AGENT_OVERRIDES_RUNTIME_ON_LOCAL_READ_SMOKE_PASS
ENV_VCP_AGENT_ALLOWED_ROOTS_SET=yes
ENV_VCP_AGENT_OVERRIDE_DIRS_SET=yes
ENV_VCP_AGENT_DIRS_SET=no
AGENT_EXTERNAL_ADDITIVE_ROOT_COUNT=0
AGENT_EXTERNAL_OVERRIDE_ROOT_COUNT=1
AGENT_ADDITIVE_FILE_COUNT=0
AGENT_OVERRIDE_FILE_COUNT=2
LOCAL_PROMPT_READ_COUNT=2
READ_PATHS_MATCH_EXTERNAL_OVERRIDE=yes
PROMPT_HASH_MATCHES_EXTERNAL_OVERRIDE=yes
PROMPT_CONTENT_PRINTED=no
PRODUCTION_SERVER_STARTED=no
HTTP_SERVER_STARTED=no
ADMIN_ROUTE_USED=no
BLOCK_REASONS=none
```

Sanity checks after restore:

```text
M39 PASS
M40 post-apply-validation PASS
```

## 6. Decision

```text
M43 result: PASS
rollback removal verified: yes
expected M42 block verified: yes
restore verified: yes
final real config state: AgentOverrides only
VCP_AGENT_DIRS enabled: no
config.env committed: no
```

## 7. Future Rollback Procedure

If rollback is needed again:

```text
remove VCP_AGENT_ALLOWED_ROOTS
remove VCP_AGENT_OVERRIDE_DIRS
verify VCP_AGENT_DIRS remains absent
run M42 and expect BLOCK
```

If restoring:

```text
restore VCP_AGENT_ALLOWED_ROOTS
restore VCP_AGENT_OVERRIDE_DIRS
verify VCP_AGENT_DIRS remains absent
run M39/M40/M42 and expect PASS
```

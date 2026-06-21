# M17 Agent Env-On Shadow / Rollback Drill Receipt

Date: 2026-06-21

Status: AGENT_ENV_ON_SHADOW_ROLLBACK_PASS

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Predecessor receipt: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M16_AGENT_MANAGER_RUNTIME_WIRING_DEFAULT_OFF_RECEIPT_20260621.md`

## 1. Scope

M17 validates Agent external runtime env-on behavior with temporary fixtures only.

Covered gates:

```text
M17-01 preflight: M16 receipt read, worktree clean, real VCP_AGENT_* env unset
M17-02 temp external Agent / AgentOverrides fixture
M17-03 AgentManager env-on additive + override shadow
M17-04 Admin Agent route external read-only / write-block
M17-05 rollback drill: unset env returns to core-only behavior
M17-06 package checksum / path-risk shadow harness rerun
```

Changed runtime surface:

```text
modules/agentManager.js
```

Changed test / validation surfaces:

```text
tests/agent-manager-external-runtime.test.js
scripts/run-agent-env-on-shadow-rollback-harness.js
```

## 2. Preflight

M16 receipt was read before execution.

Real Agent env preflight:

```powershell
Get-ChildItem Env:VCP_AGENT* | ForEach-Object { $_.Name + '=SET' }
```

Result:

```text
no output
```

Meaning:

```text
VCP_AGENT_ALLOWED_ROOTS unset
VCP_AGENT_DIRS unset
VCP_AGENT_OVERRIDE_DIRS unset
```

No `.env`, `config.env`, secret, auth material, LocalState content, or `.agent_board/**` content was read or modified.

## 3. Finding And Fix

Rollback probe found a stale cache issue:

```text
CACHE_ROLLBACK_PROBE first=override second=override
```

Scenario:

```text
1. AgentManager reads an external override while VCP_AGENT_OVERRIDE_DIRS is active.
2. The same AgentManager then rolls back with setEnvironment({}).
3. The prompt cache could still return the old external override prompt.
```

Fix:

```text
AgentManager.setEnvironment() now clears promptCache.
AgentManager.setAgentDir() now clears promptCache.
```

This keeps rollback behavior consistent with the effective Agent root plan and does not enable external runtime by default.

## 4. Commands Run

Syntax checks:

```powershell
node --check modules/agentManager.js
node --check tests/agent-manager-external-runtime.test.js
node --check scripts/run-agent-env-on-shadow-rollback-harness.js
```

Result:

```text
PASS
```

Targeted tests:

```powershell
node --test tests/agent-external-root-resolver.test.js tests/agent-manager-external-runtime.test.js tests/dotenvPatch.test.js
```

Result:

```text
tests 15
pass 15
fail 0
```

M17 env-on / rollback harness:

```powershell
node scripts/run-agent-env-on-shadow-rollback-harness.js
```

Result:

```text
AGENT_ENV_ON_SHADOW_ROLLBACK_PASS
REAL_ENV_PRECHECK_UNSET=yes
TEMP_ENV_MANAGER_SHADOW_ONLY=yes
ADDITIVE_AGENT_PROMPT_SOURCE=external
OVERRIDE_AGENT_PROMPT_SOURCE=external
ADMIN_EXTERNAL_READ_PASS=yes
ADMIN_EXTERNAL_WRITE_BLOCK_PASS=yes
ROLLBACK_UNSET_ENV_CORE_ONLY_PASS=yes
NO_DOTENV_OR_CONFIG_ENV_MODIFIED=yes
NO_LOCALSTATE_OR_AGENT_BOARD_READS_EXECUTED=yes
NO_PROVIDER_OR_BRIDGE_CALLS_EXECUTED=yes
NO_PRODUCTION_SERVICE_STARTUP_EXECUTED=yes
LIVE_EXTERNAL_WRITE_EXECUTED=no
```

The harness created a temporary fixture under `os.tmpdir()` and removed it after the run.

Package checksum / path-risk shadow harness:

```powershell
node scripts/run-agent-content-copy-first-shadow-validation-harness.js
```

Result:

```text
AGENT_COPY_FIRST_SHADOW_VALIDATION_PASS
EXTERNAL_HEAD=bc287826d47e89204cba536c75e9374fd6db87ab
AGENT_CONTENT_TARGET_RISK_PATH_COUNT=0
PACKAGE_RISK_PATH_COUNT=0
MANIFEST_VERIFY_PASS count=15
ENV_VCP_AGENT_DIRS_SET=no
ENV_VCP_AGENT_OVERRIDE_DIRS_SET=no
RUNTIME_AGENT_ENV_REFERENCE_COUNT=2
NO_PROVIDER_OR_BRIDGE_CALLS_EXECUTED=yes
NO_SERVICE_STARTUP_EXECUTED=yes
NO_LOCALSTATE_OR_AGENT_BOARD_READS_EXECUTED=yes
```

## 5. Safety Confirmations

```text
Real .env/config.env modified: no
Real VCP_AGENT_* env file changed: no
Runtime default-off preserved: yes
Temp env used only inside test process: yes
Real external package write executed: no
Temp fixture writes only: yes
External package checksum verified: yes
External package risk paths detected: 0
Core Agent files deleted/untracked/stubbed: no
LocalState content read: no
.agent_board content read: no
Provider call executed: no
Bridge call executed: no
Production service startup executed: no
Live external write executed: no
Upstream PR opened: no
```

M17 used an ephemeral local Admin route test server on `127.0.0.1` only. No production service was started.

## 6. Deferred Work

Not done in M17:

- no real `.env` activation;
- no external watcher support;
- no AdminPanel write support for external Agent roots;
- no provider runtime validation;
- no delete/untrack/stub of core Agent files;
- no LocalState or `.agent_board/**` migration.

## 7. Rollback

Operational rollback remains:

```text
unset VCP_AGENT_ALLOWED_ROOTS
unset VCP_AGENT_DIRS
unset VCP_AGENT_OVERRIDE_DIRS
keep core Agent files unchanged
```

Code rollback:

```text
revert the commit that modifies modules/agentManager.js,
tests/agent-manager-external-runtime.test.js,
scripts/run-agent-env-on-shadow-rollback-harness.js,
this receipt,
and the tracker M17 / S38 rows.
```

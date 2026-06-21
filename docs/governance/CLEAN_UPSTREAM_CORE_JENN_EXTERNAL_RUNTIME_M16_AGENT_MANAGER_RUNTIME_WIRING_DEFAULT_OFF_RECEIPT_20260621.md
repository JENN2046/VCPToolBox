# M16 AgentManager Runtime Wiring Default-Off Receipt

Date: 2026-06-21

Status: RUNTIME_WIRING_DEFAULT_OFF_PASS

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Predecessor taskbook: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M15_AGENT_MANAGER_RUNTIME_WIRING_REVIEW_TASKBOOK_20260621.md`

## 1. Scope

M16 wires the pure Agent resolver into `AgentManager` with runtime default-off behavior.

Changed runtime surfaces:

```text
modules/agentManager.js
routes/admin/agents.js
```

Changed contract/test surfaces:

```text
modules/agentRootResolver.js
tests/agent-external-root-resolver.test.js
tests/agent-manager-external-runtime.test.js
```

## 2. Runtime Behavior

Default-off:

```text
unset VCP_AGENT_DIRS
unset VCP_AGENT_OVERRIDE_DIRS
=> legacy core Agent scan path remains active
```

Env-on requirements:

```text
VCP_AGENT_DIRS and VCP_AGENT_OVERRIDE_DIRS require VCP_AGENT_ALLOWED_ROOTS
LocalState and .agent_board roots remain blocked by the resolver
```

AgentManager:

- uses `agentRootResolver` only when `VCP_AGENT_DIRS` or `VCP_AGENT_OVERRIDE_DIRS` is set;
- resolves additive external Agents from the effective plan;
- resolves exact-id overrides from `AgentOverrides`;
- blocks additive duplicate ids from overriding core Agents;
- keeps core fallback files intact;
- does not add external file watchers in M16.

Admin Agent route:

- GET can read effective external Agent files and returns `source`, `lane`, and `external` metadata;
- POST rejects external Agent targets with `403`;
- POST remains core-only for writes.

Metadata handling:

```text
README.AGENTS_OS.md is ignored as package metadata and is not exposed as an Agent id.
```

## 3. Commands Run

Syntax checks:

```powershell
node --check modules/agentRootResolver.js
node --check modules/agentManager.js
node --check routes/admin/agents.js
node --check tests/agent-external-root-resolver.test.js
node --check tests/agent-manager-external-runtime.test.js
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
tests 14
pass 14
fail 0
```

Shadow/package harness:

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

`RUNTIME_AGENT_ENV_REFERENCE_COUNT=2` is expected after M16 because `modules/agentManager.js` now contains default-off references to `VCP_AGENT_DIRS` and `VCP_AGENT_OVERRIDE_DIRS`. The validation process still had both env vars unset.

Diff hygiene:

```powershell
git diff --check
```

Result:

```text
PASS
```

## 4. Safety Confirmations

```text
Runtime Agent loader default-off: yes
Real .env/config.env modified: no
VCP_AGENT_ALLOWED_ROOTS set in real env file: no
VCP_AGENT_DIRS activated in real env file: no
VCP_AGENT_OVERRIDE_DIRS activated in real env file: no
Core Agent files deleted/untracked/stubbed: no
External package modified: no
LocalState content read: no
.agent_board content read: no
Provider call executed: no
Bridge call executed: no
Production service startup executed: no
Live external write executed: no
Upstream PR opened: no
```

## 5. Deferred Work

Not done in M16:

- no real env activation;
- no external watcher support;
- no AdminPanel write support for external Agent roots;
- no provider runtime validation;
- no delete/untrack/stub of core Agent files;
- no env-on validation against real operator private data.

Current Jenn core still retains old Agent files. Because of that, additive external ids that duplicate core ids remain blocked until a separately approved core fallback/stub/untrack decision changes that state.

## 6. Rollback

Rollback M16 by reverting the commit that modifies:

- `modules/agentManager.js`
- `routes/admin/agents.js`
- `modules/agentRootResolver.js`
- `tests/agent-external-root-resolver.test.js`
- `tests/agent-manager-external-runtime.test.js`
- this receipt
- the tracker row for S37 / M16

Operational rollback remains:

```text
unset VCP_AGENT_ALLOWED_ROOTS
unset VCP_AGENT_DIRS
unset VCP_AGENT_OVERRIDE_DIRS
keep core Agent files unchanged
```

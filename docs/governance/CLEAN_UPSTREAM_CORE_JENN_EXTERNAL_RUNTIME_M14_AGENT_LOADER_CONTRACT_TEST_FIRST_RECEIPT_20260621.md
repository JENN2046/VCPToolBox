# M14 Agent Loader Contract Test-First Receipt

Date: 2026-06-21

Status: CONTRACT_TESTS_PASS_NO_RUNTIME_WIRING

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Taskbook: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M14_AGENT_LOADER_CONTRACT_TEST_FIRST_TASKBOOK_20260621.md`

## 1. Scope

M14 adds a pure, default-off Agent root resolver and tests for future Agent external runtime semantics.

Changed files:

```text
modules/agentRootResolver.js
tests/agent-external-root-resolver.test.js
```

The resolver is not wired into:

```text
modules/agentManager.js
adminServer.js
routes/admin/agents.js
```

## 2. Implemented Contract

New future env contract:

```text
VCP_AGENT_ALLOWED_ROOTS
VCP_AGENT_DIRS
VCP_AGENT_OVERRIDE_DIRS
```

Rules covered:

- external Agent roots are default-off;
- `VCP_AGENT_DIRS` and `VCP_AGENT_OVERRIDE_DIRS` require `VCP_AGENT_ALLOWED_ROOTS`;
- LocalState and `.agent_board/**` roots are rejected;
- additive roots add new Agent ids but do not override core ids;
- override roots replace exact existing core ids only;
- duplicate additive ids are blocked unless they are moved to the explicit override lane;
- Agent ids are normalized from relative `.txt` / `.md` paths.

## 3. Commands Run

Syntax checks:

```powershell
node --check modules/agentRootResolver.js
node --check tests/agent-external-root-resolver.test.js
```

Result:

```text
PASS
```

Targeted tests:

```powershell
node --test tests/agent-external-root-resolver.test.js
```

Result:

```text
tests 7
pass 7
fail 0
```

Passing test cases:

```text
Agent root resolver is default-off when external env vars are unset
Agent root resolver requires an explicit external allowlist
Agent root resolver rejects LocalState and .agent_board roots even when allowlisted
additive Agent roots add new ids without overriding core ids
override Agent roots replace exact core ids only
duplicate additive Agent ids are blocked unless they use override lane
Agent ids are derived from normalized relative paths
```

## 4. Safety Confirmations

```text
Runtime Agent loader changed: no
AgentManager runtime integration changed: no
adminServer Agent path behavior changed: no
AdminPanel Agent editor behavior changed: no
VCP_AGENT_ALLOWED_ROOTS set: no
VCP_AGENT_DIRS activated: no
VCP_AGENT_OVERRIDE_DIRS activated: no
LocalState content read: no
.agent_board content read: no
Provider call executed: no
Bridge call executed: no
Service startup executed: no
Live external write executed: no
Upstream PR opened: no
```

## 5. Open Risks / Deferred Work

Deferred to the next gate:

- `agent_map.json` alias semantics for external additive Agents;
- exact override prompt resolution inside `AgentManager.getAgentPrompt`;
- AdminPanel read/write policy for external Agent roots;
- runtime registration proof without provider calls;
- rollback drill for env-on shadow mode.

## 6. Rollback

Rollback M14 by reverting the core commit that adds:

- `modules/agentRootResolver.js`
- `tests/agent-external-root-resolver.test.js`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M14_AGENT_LOADER_CONTRACT_TEST_FIRST_TASKBOOK_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M14_AGENT_LOADER_CONTRACT_TEST_FIRST_RECEIPT_20260621.md`
- the tracker row for S35 / M14

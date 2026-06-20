# M15 AgentManager Runtime Wiring Review Taskbook

Date: 2026-06-21

Status: TASKBOOK_READY_NO_WIRING

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Predecessor receipt: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M14_AGENT_LOADER_CONTRACT_TEST_FIRST_RECEIPT_20260621.md`

## 1. Purpose

M15 prepares the review gate for wiring `modules/agentRootResolver.js` into Agent runtime.

This taskbook is intentionally no-wiring. It defines the decisions, file surfaces, tests, rollback, and stop conditions required before changing `AgentManager` behavior.

## 2. Current Proven State

Already completed:

```text
M11 reviewed candidate content gate: PASS
M12 Agent content copy-first: PASS
M13 no-runtime shadow validation: PASS
M14 pure resolver contract tests: PASS
```

Current M14 evidence:

```text
modules/agentRootResolver.js
tests/agent-external-root-resolver.test.js
node --test tests/agent-external-root-resolver.test.js => 7 pass / 0 fail
```

Still not done:

```text
AgentManager runtime wiring
AdminPanel external Agent read/write policy
agent_map.json external alias semantics
env-on shadow validation
rollback drill for env-on mode
```

## 3. Runtime Surfaces That Need Review

Potential future wiring touches:

```text
modules/agentManager.js
adminServer.js
routes/admin/agents.js
tests/agent-external-root-resolver.test.js
future tests/agent-manager-external-runtime.test.js
```

M15 does not touch those runtime files.

## 4. Decisions Required Before Wiring

### 4.1 agent_map.json alias semantics

Review must decide:

```text
Does agent_map.json continue to map alias -> relative Agent file path?
Can alias values point to external additive Agent ids?
Must override lane use the same relative id as core?
What happens when alias maps to an id skipped by duplicate protection?
```

Default recommendation:

```text
Keep alias -> relative Agent id/path semantics.
Use the M14 effective plan to resolve the final file path.
Do not auto-add aliases for external additive files.
Require explicit alias map update for user-facing Agent prompt usage.
```

### 4.2 AdminPanel read/write policy

Review must decide:

```text
Can GET /agents list external additive and override files?
Can GET /agents/:fileName read external files?
Can POST /agents/:fileName write external files?
How are external files labeled in the UI response?
How are override files prevented from accidental broad writes?
```

Default recommendation:

```text
Read-only external display first.
Keep writes restricted to core Agent root until a separate AdminPanel external write gate exists.
Expose source/lane metadata for UI review.
Do not allow POST writes to AgentOverrides in the first wiring patch.
```

### 4.3 Watcher and cache behavior

Review must decide:

```text
Does AgentManager watch external roots?
Does changing external override clear the same alias cache as core?
How are external root diagnostics surfaced?
```

Default recommendation:

```text
No external watchers in first wiring patch.
Re-scan on initialize / getAllAgentFiles only.
Cache invalidation for external roots can be a later patch.
```

### 4.4 Env contract

Future runtime activation must use:

```text
VCP_AGENT_ALLOWED_ROOTS
VCP_AGENT_DIRS
VCP_AGENT_OVERRIDE_DIRS
```

Rules:

```text
Unset env keeps current behavior.
VCP_AGENT_DIRS and VCP_AGENT_OVERRIDE_DIRS require VCP_AGENT_ALLOWED_ROOTS.
LocalState and .agent_board roots remain blocked.
```

## 5. Required Tests Before Wiring PASS

Future wiring patch must add targeted tests before any runtime activation:

```text
unset env preserves current AgentManager prompt resolution
VCP_AGENT_DIRS alone is rejected without VCP_AGENT_ALLOWED_ROOTS
VCP_AGENT_DIRS adds external Agent files to read-only list
VCP_AGENT_DIRS does not override core Agent ids
VCP_AGENT_OVERRIDE_DIRS overrides exact core id prompt path only when allowlisted
duplicate external Agent ids are blocked
LocalState and .agent_board roots are rejected
AdminPanel POST writes remain core-only
provider / bridge / service startup not executed
```

## 6. Env-On Shadow Validation Gate

Before runtime use, run env-on shadow mode in a test-only temp fixture:

```text
set VCP_AGENT_ALLOWED_ROOTS to a temp external package fixture
set VCP_AGENT_DIRS to fixture Agent
set VCP_AGENT_OVERRIDE_DIRS to fixture AgentOverrides
do not point env vars at real operator LocalState or .agent_board paths
do not call providers or bridges
do not start production services
```

The gate must prove:

```text
core fallback remains active when env unset
additive lane is visible only when env set
override lane affects exact id only
rollback is unsetting env vars
```

## 7. Stop Conditions

Stop before wiring if:

- implementation requires reading LocalState or `.agent_board/**`;
- implementation requires modifying `.env`, `config.env`, secrets, tokens, or auth material;
- AdminPanel external write behavior is not explicitly decided;
- alias semantics are ambiguous;
- tests would need provider calls, bridge calls, production service startup, or live external writes;
- runtime behavior changes when all Agent env vars are unset.

## 8. Rollback

Future wiring rollback must be:

```text
unset VCP_AGENT_ALLOWED_ROOTS
unset VCP_AGENT_DIRS
unset VCP_AGENT_OVERRIDE_DIRS
revert the runtime wiring commit
keep core Agent files unchanged
keep external package commit reversible
```

No rollback may delete LocalState, `.agent_board/**`, secrets, cache, logs, outputs, DB/vector stores, or source core Agent files.

## 9. M15 Validation

M15 is docs-only:

```powershell
git diff --check -- docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M15_AGENT_MANAGER_RUNTIME_WIRING_REVIEW_TASKBOOK_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
rg -n "TASKBOOK_READY_NO_WIRING|agent_map.json|AdminPanel read/write policy|Env-On Shadow Validation Gate|Stop Conditions|unset VCP_AGENT_ALLOWED_ROOTS" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M15_AGENT_MANAGER_RUNTIME_WIRING_REVIEW_TASKBOOK_20260621.md
```

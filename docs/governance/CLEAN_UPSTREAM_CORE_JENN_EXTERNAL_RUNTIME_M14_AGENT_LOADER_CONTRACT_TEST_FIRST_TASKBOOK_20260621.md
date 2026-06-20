# M14 Agent Loader Contract Test-First Taskbook

Date: 2026-06-21

Status: TASKBOOK_READY_PURE_CONTRACT_ONLY

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Predecessor receipt: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M13_AGENT_SHADOW_LOADER_VALIDATION_RECEIPT_20260621.md`

## 1. Purpose

M14 adds a test-first Agent loader contract layer without wiring it into runtime.

The goal is to make additive and override Agent root semantics explicit before any future `AgentManager` integration.

## 2. Scope

Allowed:

- add a pure Agent root resolver module;
- add focused unit tests for root resolution and Agent id conflict semantics;
- define a separate allowlist env var for future Agent roots;
- keep runtime default-off and unmodified.

Implemented contract module:

```text
modules/agentRootResolver.js
```

Implemented tests:

```text
tests/agent-external-root-resolver.test.js
```

Future env contract:

```text
VCP_AGENT_ALLOWED_ROOTS
VCP_AGENT_DIRS
VCP_AGENT_OVERRIDE_DIRS
```

## 3. Non-Scope

M14 does not:

- import or call the resolver from `modules/agentManager.js`;
- change `adminServer.js`;
- change `routes/admin/agents.js`;
- edit `agent_map.json`;
- set `VCP_AGENT_ALLOWED_ROOTS`, `VCP_AGENT_DIRS`, or `VCP_AGENT_OVERRIDE_DIRS`;
- start services;
- read LocalState or `.agent_board/**`;
- call providers or bridges;
- change AdminPanel Agent editor behavior.

## 4. Contract Rules

Default-off:

```text
unset VCP_AGENT_DIRS + unset VCP_AGENT_OVERRIDE_DIRS => core Agent root only
```

Allowlist:

```text
VCP_AGENT_DIRS and VCP_AGENT_OVERRIDE_DIRS require VCP_AGENT_ALLOWED_ROOTS
external roots outside VCP_AGENT_ALLOWED_ROOTS are rejected
```

Blocked roots:

```text
LocalState
.agent_board
state/cache/log/logs/DebugLog/image/output/outputs/secrets
.git
node_modules
project root itself
```

Additive lane:

```text
external additive Agent ids may add new ids
external additive Agent ids must not override core ids
duplicate additive ids are blocked
```

Override lane:

```text
external override Agent ids may replace exact existing core ids
override ids without matching core ids are blocked
duplicate override ids are blocked
```

## 5. Required Tests

M14 PASS requires:

```text
node --check modules/agentRootResolver.js
node --check tests/agent-external-root-resolver.test.js
node --test tests/agent-external-root-resolver.test.js
```

Expected test coverage:

```text
default-off root snapshot
allowlist required
LocalState and .agent_board roots rejected
additive roots do not override core ids
override roots replace exact core ids only
duplicate additive ids blocked
Agent id normalization
```

## 6. Stop Conditions

Stop before runtime wiring if:

- `AgentManager` integration would require changing `agent_map.json` semantics without a taskbook;
- AdminPanel read/write behavior for external Agent roots is unclear;
- override files might become writable from the wrong UI lane;
- provider calls, bridge calls, service startup, LocalState reads, or `.agent_board/**` reads are required;
- runtime activation is needed to validate the pure resolver.

## 7. Next Gate

The next gate is Agent runtime wiring design / review.

That gate must decide:

- how `agent_map.json` aliases map to external additive and override ids;
- whether AdminPanel can read external Agent roots;
- whether AdminPanel can write external Agent roots;
- how override files remain exact-id and reviewable;
- what validation proves runtime registration without provider calls.

## 8. Rollback

Rollback M14 by reverting:

```text
modules/agentRootResolver.js
tests/agent-external-root-resolver.test.js
this taskbook
the M14 receipt
the tracker row for S35 / M14
```

No runtime rollback is required because M14 does not wire the resolver into runtime code.

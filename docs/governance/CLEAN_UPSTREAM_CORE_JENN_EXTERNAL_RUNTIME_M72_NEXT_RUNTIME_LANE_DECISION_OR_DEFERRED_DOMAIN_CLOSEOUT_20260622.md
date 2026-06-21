# M72 Next Runtime Lane Decision Or Deferred Domain Closeout

Date: 2026-06-22

Status: PASS_NEXT_RUNTIME_LANE_DECISION

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Scope

M72 decides whether the route should keep all remaining runtime lanes deferred, or select exactly one deferred runtime lane for a future narrow taskbook.

M72 does not:

- write `config.env`, `.env`, secrets, auth material, tokens, credentials, or provider settings;
- enable runtime registration, provider runtime, bridge runtime, or additive Agent runtime;
- start production server, dev server, preview server, browser smoke, provider call, or bridge call;
- read, copy, checksum, or migrate LocalState/private/operator data or `.agent_board/**`;
- create the future runtime taskbook selected by this decision;
- open upstream PR, deploy, delete, untrack, stub, or remove core fallback content.

## 2. Inputs

| Input | Relevant fact |
| --- | --- |
| M71 aggregate review | AgentOverrides is PASS override-only; AdminPanel artifact lane is closed; AI Image/Codex-Memory/PhotoStudio remain package-layer PASS with runtime deferred; LocalState/private BLOCK; upstream PR DEFERRED. |
| M32 AI Image package gate | Persistent provider-adapter package exists; no provider runtime, no token, no image generation, no output data. |
| M33 Codex/Memory package gate | Persistent bridge package exists; no live write, no private memory read, no runtime bridge registration. |
| M34 PhotoStudio package gate | Persistent source package exists; no real project data read/write, no external sync/publish/write, no runtime registration. |
| M46 next runtime lane decision | Agent additive remained BLOCK; LocalState remained BLOCK; AI Image/Codex-Memory/PhotoStudio were DEFERRED. |

## 3. Decision Options

| Option | Result | Reason |
| --- | --- | --- |
| Keep all deferred lanes deferred | Not selected | Safest possible pause, but it stops local route progress after M71 even though a docs-only next taskbook can be scoped safely. |
| Select exactly one deferred runtime lane for a future narrow taskbook | Selected | Keeps progress narrow, reversible, and reviewable without enabling runtime or writing env. |

M72 excludes upstream PR reopening from this decision. Upstream PR remains governed by M8/M28 and requires explicit current-turn upstream PR authorization.

## 4. Candidate Lane Review

| Lane | M72 status | Reason |
| --- | --- | --- |
| Agent additive `VCP_AGENT_DIRS` | BLOCK | M46 recorded duplicate core agent ids; AgentOverrides override-only is already the accepted current runtime-on lane. |
| AdminPanel | CLOSED_FOR_CURRENT_ROUTE | M70 closed the AdminPanel artifact lane; remaining items are production deploy, upstream PR, dynamic external Vue runtime, external write surfaces, and core fallback removal. |
| AI Image | SELECTED_FOR_FUTURE_TASKBOOK | Lowest-risk deferred runtime taskbook candidate because it can stay no-provider, no-token, no-image-output, default-off, and docs-only first. |
| Codex/Memory | DEFERRED | Runtime bridge design risks live write and private memory boundaries; should follow only after a no-live-write runtime taskbook is explicitly chosen. |
| PhotoStudio | DEFERRED | Runtime package design is closer to real project/customer/media/export data and external sync/publish/write boundaries. |
| LocalState/private/`.agent_board/**` | BLOCK | Private-by-default and `.agent_board/**` blocked by existing gates; not a runtime lane for automatic taskbook selection. |
| Upstream PR | DEFERRED | Outside current local route decision; requires separate explicit authorization. |

## 5. Decision

```text
M72_RESULT=PASS_NEXT_RUNTIME_LANE_DECISION
M72_DECISION=WRITE_ONE_NARROW_TASKBOOK
M72_SELECTED_LANE=AI_IMAGE
M72_SELECTED_NEXT_TASKBOOK=M73_AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_TASKBOOK
M72_TASKBOOK_WRITTEN=no
M72_ENV_MODIFIED=no
M72_RUNTIME_ENABLED=no
M72_PROVIDER_CALL_EXECUTED=no
M72_BRIDGE_WRITE_EXECUTED=no
M72_LOCALSTATE_PRIVATE_READ=no
M72_UPSTREAM_PR_OPENED=no
```

The next safe milestone is a docs-only M73 taskbook for AI Image no-provider runtime registration. That taskbook must keep provider credentials, real provider calls, image generation, output data, bridge behavior, LocalState/private, and upstream PR outside scope.

## 6. Required M73 Boundaries

M73 must define, before any implementation:

- default-off runtime registration shape for AI Image adapters;
- allowed source files and forbidden files;
- no-provider/no-token/no-image-output validation;
- fixture-only or dry-run-only validation commands;
- rollback path to runtime-off state;
- stop conditions before any real provider, env, token, output, bridge, LocalState/private, production server, build artifact, or upstream PR action.

M73 must not modify runtime, env, provider credentials, image output, bridge, LocalState/private data, or upstream state.

## 7. Rollback

Rollback for M72 is documentation-only:

1. Revert this M72 decision document.
2. Revert the M72 tracker entries.

No runtime, env, provider, bridge, private data, dist artifact, or upstream state was changed by M72.

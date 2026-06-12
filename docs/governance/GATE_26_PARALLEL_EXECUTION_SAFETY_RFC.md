# Gate 26｜Parallel Execution Safety RFC

## Status

Gate 26 is a documentation-only safety RFC.

This RFC is ready for review, not sealed.

## Scope

This document defines the safety rules that must exist before any future
parallel execution experiment involving the external renamed
`JennAIGentOrchestrator` candidate.

Gate 26 is a strategy and boundary document only.

Covered:

- sealed Gate 23 through Gate 25 context;
- current external renamed candidate state;
- future execution prerequisites;
- hard execution prohibitions that remain in force;
- required dry-run and approval boundaries;
- rollback expectations;
- validation required before any later execution gate.

## Non-goals

Gate 26 does not execute `JennAIGentOrchestrator`.

Gate 26 does not execute `AIGentOrchestrator`.

Gate 26 does not call `processToolCall`.

Gate 26 does not start `server.js`.

Gate 26 does not start providers.

Gate 26 does not perform Plugin Store live install, uninstall, or update.

Gate 26 does not activate the external renamed plugin.

Gate 26 does not change resolver priority.

Gate 26 does not modify `Plugin.js`.

Gate 26 does not modify `modules/pluginRootResolver.js`.

Gate 26 does not edit routes.

Gate 26 does not persist `VCP_PLUGIN_*` env settings.

Gate 26 does not edit `.env` or `config.env`.

Gate 26 does not write LocalState.

Gate 26 does not write secrets, logs, cache, generated outputs, or operator data.

Gate 26 does not create a core commit unless a separate integration gate
authorizes it.

Gate 26 does not push, open a PR, merge, release, deploy, or publish.

Gate 26 does not start Gate 27.

## Sealed Context

Gate 23 created and sealed the renamed external candidate:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

Gate 24 statically compared the core plugin, sealed same-name external shadow
copy, and renamed external candidate.

Gate 25 proved with temporary discovery dry-run only that
`JennAIGentOrchestrator` can be discovered from the external `Plugin` root as:

```text
pluginSource: external
pluginRootId: external:1
```

Gate 25 did not execute plugin code, did not call `processToolCall`, did not
start `server.js`, and did not activate the external candidate.

## Current Candidate

Candidate:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

Current expected files:

```text
AIGentOrchestrator.js
config.env.example
plugin-manifest.json
README.md
```

Current manifest identity:

```text
name: JennAIGentOrchestrator
entry command: node AIGentOrchestrator.js
commands: PlanImagePipeline, PlanRetryPipeline, HealthCheck
```

Current safety status:

- discovered by temporary dry-run only;
- not active;
- not executed;
- not configured persistently;
- not registered through Plugin Store live operations;
- not cut over from the core plugin.

## Execution Safety Principle

No future gate may treat discovery as execution approval.

Discovery proves only that the resolver and manifest scanner can see the
candidate under an approved root. It does not prove that the candidate may run.

Execution must remain blocked until a separate task book authorizes a narrowly
scoped dry-run execution test.

## Required Future Execution Preconditions

Before any future execution gate, a new task book must explicitly authorize:

- the exact command identifier to test;
- the exact plugin name to invoke;
- the expected input payload;
- whether `processToolCall` may be called;
- whether provider calls are forbidden or mocked;
- whether downstream plugin calls are forbidden or mocked;
- where transient output may be written, if anywhere;
- what rollback means if the command fails;
- what evidence is allowed in receipts.

Absent those explicit authorizations, execution remains forbidden.

## Future Gate Shape

The next execution-related gate should be a separate read-only or dry-run
planning gate unless Commander explicitly authorizes otherwise.

Recommended sequence:

1. Gate 27: execution dry-run design review.
2. Gate 28: single-command no-provider dry-run execution, if approved.
3. Gate 29: receipt and rollback review.
4. Later gates: provider or downstream behavior, only after separate review.

## Allowed Future Dry-Run Pattern

A future dry-run execution gate, if authorized, should:

- use temporary process env only;
- keep external roots default-off outside the process;
- target only `JennAIGentOrchestrator`;
- call at most one explicitly named command;
- use a minimal inert payload;
- reject provider execution;
- reject downstream plugin execution;
- write no LocalState unless separately authorized;
- leave core repo clean;
- leave external package source unchanged;
- produce a receipt.

## Forbidden Future Shortcuts

The following shortcuts remain forbidden:

- using persistent env to activate external roots;
- deleting or moving the core `AIGentOrchestrator`;
- changing resolver priority to prefer external plugins;
- treating same-name shadow behavior as cutover;
- using Plugin Store live install or uninstall as migration;
- executing all commands in the manifest at once;
- allowing provider calls during the first execution gate;
- allowing image generation during the first execution gate;
- writing logs, cache, generated outputs, or secrets into plugin source;
- mutating LocalState without a separate LocalState policy gate.

## Boundary For Plugin Store

Plugin Store behavior remains out of scope for Gate 26.

The fact that the external install root can resolve to:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin
```

does not authorize live install, uninstall, update, activation, or package
mutation.

## Boundary For LocalState

`VCPToolBox-JENN-LocalState` remains private operator state.

Gate 26 does not authorize writes to:

```text
logs
cache
outputs
secrets
receipts
```

Any future LocalState write must be separately classified and authorized.

## Required Future Validation

Before any later execution gate, validation must prove:

- core repo is clean;
- `HEAD` equals `origin/main`;
- no persistent `VCP_PLUGIN_*` env is present;
- target inventory remains unchanged;
- forbidden file scan returns no results;
- manifest identity is still `JennAIGentOrchestrator`;
- baseline check passes;
- temporary discovery still finds the renamed candidate;
- LocalState remains marker-only unless a separate gate authorizes writes;
- no runtime files have changed.

## Rollback Expectations

Rollback for any future execution gate must be defined before execution.

At minimum, rollback must specify:

- how temporary env is cleared;
- how temporary scripts are removed;
- how partial output is identified;
- whether the external renamed candidate is preserved or removed;
- how receipts distinguish failed dry-run evidence from active state.

## Gate 26 Decision

Gate 26 records that the repository and external package are ready for a future
execution-safety design review.

Gate 26 does not authorize execution.

Gate 26 does not authorize activation.

Gate 26 does not authorize cutover.

Gate 26 does not authorize Gate 27.

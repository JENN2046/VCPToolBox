# Gate 22｜External Rename Parallel Test RFC

## Status

Gate 22 is a documentation-only RFC.

This RFC is ready for review, not sealed.

## Scope

This document designs the future external rename parallel test route recommended
by Gate 21.

Gate 22 plans a possible future renamed external `AIGentOrchestrator` candidate.
It does not create that candidate.

Covered:

- renamed external candidate name;
- manifest identity strategy;
- config strategy;
- behavior strategy;
- parallel test boundaries;
- intentional differences from core;
- provenance requirements that should remain tied to core;
- future discovery and execution expectations;
- validation, rollback, and future authorization requirements.

## Non-goals

Gate 22 does not create a renamed external plugin.

Gate 22 does not copy plugin code.

Gate 22 does not edit the external package.

Gate 22 does not edit the core plugin.

Gate 22 does not run discovery.

Gate 22 does not execute the plugin.

Gate 22 does not execute `processToolCall`.

Gate 22 does not start `server.js` or any provider.

Gate 22 does not modify `Plugin.js`.

Gate 22 does not modify `modules/pluginRootResolver.js`.

Gate 22 does not persist env.

Gate 22 does not perform Plugin Store live operations.

Gate 22 does not start Gate 23.

## Sealed context

Gate 17 sealed an external same-name `AIGentOrchestrator` copy under:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\AIGentOrchestrator
```

Gate 18 recorded that core-first ordering and same-name override prevention are
sealed contracts.

Gate 19 proved the core and external same-name copies matched by file inventory,
hash, normalized manifest content, config template, and README content.

Gate 20 proved that the same-name external copy can be detected under temporary
external root configuration while remaining shadow-only behind the preserved core
plugin.

Gate 21 compared cutover strategies and recommended:

```text
Option B｜External rename parallel test
```

Gate 21 kept permanent shadow-only as a fallback and deferred core
disable/remove and runtime resolver feature-flag strategies to later
separately authorized gates.

## Current state

Core plugin:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\Plugin\AIGentOrchestrator
```

Sealed external shadow copy:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\AIGentOrchestrator
```

External plugin root:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin
```

Recommended future renamed external candidate directory:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

The recommended future renamed directory does not exist as part of Gate 22.

The current safe runtime state remains:

```text
core AIGentOrchestrator active; external same-name AIGentOrchestrator shadow-only
```

## Problem statement

The same-name external copy proves package shape and discovery metadata, but it
cannot become an active parallel candidate while the core plugin keeps the same
name and remains first. That is intentional: the sealed contract prevents a
same-name external plugin from overriding a core plugin.

The next safe experiment needs a distinct external identity so future gates can
discover and inspect an external candidate without deleting the core plugin,
weakening duplicate protection, or changing resolver priority.

## Why rename is required

Renaming is required for a parallel test because:

- it avoids same-name override collision;
- it preserves core-first behavior for the production `AIGentOrchestrator` name;
- it lets a future external candidate appear as a separate plugin record;
- it avoids disabling, moving, or deleting the core plugin;
- it avoids runtime resolver changes;
- it gives rollback by deleting only the future renamed external candidate.

A renamed candidate is a trial identity, not a production replacement.

## Proposed renamed external candidate

Recommended future directory:

```text
VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

Recommended future manifest `name`:

```text
JennAIGentOrchestrator
```

Recommended future display name:

```text
Jenn AI Image Multi-Agent Orchestrator Trial
```

Relationship to core:

```text
parallel candidate, not replacement
```

Initial behavior:

```text
dry-run / inert / execution-disabled by default
```

Core plugin state:

```text
preserved, unchanged, still first for original AIGentOrchestrator name
```

Gate 22 does not create this directory, manifest, display name, or behavior.

## Naming strategy

Use `JennAIGentOrchestrator` as the future trial plugin identity.

Rationale:

- it is visibly Jenn-scoped;
- it keeps the original `AIGentOrchestrator` string for traceability;
- it avoids the exact core plugin name;
- it does not imply production readiness;
- it can be removed without affecting the core plugin.

Do not use names that imply replacement or production cutover, such as
`AIGentOrchestratorV2`, `AIGentOrchestratorExternalActive`, or
`AIGentOrchestratorProduction`.

## Manifest strategy

A future Gate 23 may copy the core or sealed external manifest as provenance,
but must intentionally change at least:

- `name`;
- `displayName`;
- `description`;
- README/operator warnings if included in the package.

The manifest should keep dry-run safety defaults:

```text
AIGENT_ORCHESTRATOR_ALLOW_EXECUTION=false
AIGENT_ORCHESTRATOR_DEFAULT_MODE=dry-run
```

The manifest must not declare production readiness.

The manifest must not declare secrets.

The manifest must not claim provider execution.

The manifest must not imply that the original core plugin has been replaced.

Any command identifier strategy must be reviewed separately. The safest initial
plan is to preserve command behavior only as static provenance, not execute it.

## Config strategy

Initial config strategy for a future renamed candidate:

- keep execution disabled by default;
- keep dry-run mode as default;
- avoid live secrets;
- do not create `config.env`;
- do not persist env activation;
- do not write LocalState;
- do not introduce provider credentials.

Open config question for Gate 23:

Should future config keys remain identical for provenance, or be trial-prefixed
to avoid operator confusion?

Gate 22 does not decide by editing files. It records that Gate 23 must make this
choice explicit before creating the candidate.

## Behavior strategy

Initial behavior must remain dry-run / inert / execution-disabled by default.

Future candidate behavior must not:

- invoke downstream agents by default;
- call providers;
- write files;
- write LocalState;
- call external services;
- start servers;
- mutate environment;
- call Plugin Store operations.

Any future execution, including dry-run command execution, requires a separate
execution safety RFC and explicit high-risk authorization.

## Parallel test boundaries

A future parallel test may only prove that a renamed external candidate can be:

- created under the external `Plugin` root;
- statically compared against source provenance;
- discovered as a separate external plugin record under temporary env;
- removed cleanly without changing core behavior.

A future parallel test must not prove production cutover.

A future parallel test must not require:

- core plugin deletion;
- resolver priority changes;
- persistent env activation;
- Plugin Store live install/uninstall;
- provider startup/call;
- `processToolCall`;
- server startup.

## What must remain identical to core

Future candidate provenance should initially preserve:

- source behavior unless a separately authorized inert wrapper is added;
- config template semantics;
- README provenance reference;
- copied file hash provenance before intentional manifest edits;
- dry-run safety assumptions from Gate 19 and Gate 20;
- absence of secrets, logs, cache, outputs, and private state.

Any deviation must be listed as intentional and reviewed.

## What must intentionally differ from core

The future renamed candidate must intentionally differ in:

- plugin directory name;
- manifest `name`;
- display name;
- description that labels the candidate as external trial / non-production;
- README warnings;
- possibly config prefix, if Gate 23 decides key collision risk outweighs strict
  provenance matching.

These differences prevent accidental same-name override and operator confusion.

## Discovery expectations for future gates

Future discovery must use temporary process env only:

```text
VCP_PLUGIN_ALLOWED_ROOTS=<path>\VCPToolBox-JENN-Extensions
VCP_PLUGIN_DIRS=<path>\VCPToolBox-JENN-Extensions\Plugin
VCP_PLUGIN_INSTALL_DIR=<path>\VCPToolBox-JENN-Extensions\Plugin
```

Expected future discovery results:

- core `AIGentOrchestrator` remains present;
- external same-name `AIGentOrchestrator` remains shadow-only;
- renamed `JennAIGentOrchestrator` appears as a separate external record;
- `VCPToolBox-JENN-Extensions` package root itself is not treated as plugin root;
- `VCPToolBox-JENN-LocalState` is not discovered;
- no resolver priority change is required.

Gate 22 performs no discovery.

## Execution expectations for future gates

No future gate may execute the renamed candidate unless a separate high-risk
execution safety RFC authorizes it.

Before any execution gate:

- static provenance comparison must pass;
- temporary discovery must pass;
- operator-facing identity must be reviewed;
- rollback must be rehearsed or documented concretely;
- `AIGENT_ORCHESTRATOR_ALLOW_EXECUTION` must remain false unless explicitly
  authorized otherwise;
- downstream agent and provider calls must remain blocked unless separately
  authorized.

## Validation matrix

| Validation area | Required proof | Earliest future gate |
| --- | --- | --- |
| Directory creation | `JennAIGentOrchestrator` is created only under external `Plugin` root | Gate 23 |
| Manifest identity | `name` differs from core and is intentionally documented | Gate 23 |
| Provenance | Source files match sealed source except intentional identity differences | Gate 24 |
| Config safety | Execution remains disabled and no live secrets are introduced | Gate 24 |
| External package purity | No logs, cache, outputs, secrets, or LocalState are copied | Gate 24 |
| Temporary discovery | Renamed candidate is discoverable as separate external record | Gate 25 |
| Same-name shadow | Existing external same-name copy remains shadow-only | Gate 25 |
| Core preservation | Core `AIGentOrchestrator` remains present and first | Gate 25 |
| LocalState boundary | `VCPToolBox-JENN-LocalState` is not discovered | Gate 25 |
| No execution | No `processToolCall`, server, provider, or downstream agent call occurs | Gate 25 |
| Execution safety | Any dry-run execution is separately authorized and bounded | Gate 26+ |
| Rollback | Removing only the renamed candidate restores prior discovery state | Gate 25+ |

## Rollback model

Gate 22 rollback:

- remove only `docs/governance/GATE_22_EXTERNAL_RENAME_PARALLEL_TEST_RFC.md`
  before commit if document creation fails.

Future Gate 23 rollback:

- delete only `VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator`;
- do not delete `VCPToolBox-JENN-Extensions\Plugin\AIGentOrchestrator`;
- do not delete `NoopJennExternalPlugin`;
- do not touch LocalState;
- do not touch the core plugin;
- clear temporary env if any later gate used it.

Future discovery rollback:

- clear temporary `VCP_PLUGIN_*` env;
- delete only temporary scripts outside core, if used;
- verify no persistent config changed;
- verify core-first state remains intact.

## Risk register

| Risk | Status | Mitigation |
| --- | --- | --- |
| Renamed candidate mistaken for production | Open | Use explicit Jenn/trial naming and README warnings. |
| Config key collision with core plugin | Open | Gate 23 must decide identical provenance keys versus trial-prefixed keys. |
| Same-name shadow copy confused with renamed candidate | Open | Keep both identities documented and require future discovery evidence. |
| Future candidate accidentally executes | High-risk deferred | Require execution safety RFC before any `processToolCall`. |
| External package receives runtime state | Present | Keep logs/cache/outputs/secrets/LocalState outside plugin package. |
| Resolver changes requested for convenience | Deferred | Keep resolver unchanged; renamed identity avoids this need. |
| Plugin Store live install becomes shortcut | Deferred | Keep Plugin Store live operations forbidden until separately reviewed. |

## Required future gate sequence

Recommended sequence:

```text
Gate 23｜JennAIGentOrchestrator External Rename Copy Trial
Gate 24｜JennAIGentOrchestrator Static Metadata Comparison
Gate 25｜JennAIGentOrchestrator Temporary Parallel Discovery Dry Run
Gate 26｜Parallel Execution Safety RFC
Gate 27+｜Limited execution / cutover experiments
```

Gate 22 starts none of these gates.

## Required future authorizations

Separate explicit authorization is required for:

- Gate 23;
- creating `JennAIGentOrchestrator`;
- copying plugin code;
- editing any manifest;
- editing external package files;
- writing external receipts;
- temporary env discovery;
- persistent env activation;
- plugin execution;
- `processToolCall`;
- `server.js` startup;
- provider startup/call;
- Plugin Store live install/uninstall/update;
- core plugin deletion, move, or disablement;
- `Plugin.js` changes;
- `modules/pluginRootResolver.js` changes;
- route or server changes;
- release, deploy, npm publish, push, PR, or merge.

## Open questions

- Should `JennAIGentOrchestrator` keep the same invocation command identifiers,
  or should commands receive trial-prefixed identifiers?
- Should config keys remain identical for provenance, or be trial-prefixed?
- Should Gate 23 copy from core source or from the sealed external same-name
  copy?
- Should the renamed candidate include an inert wrapper, or preserve the source
  entry file unchanged until execution safety review?
- What operator UI labeling is required before a renamed external trial can be
  visible in admin surfaces?

## Boundary confirmation

Gate 22 did not start Gate 23.

Gate 22 did not create a renamed external plugin.

Gate 22 did not copy plugin code.

Gate 22 did not modify the external package.

Gate 22 did not perform actual cutover.

Gate 22 did not execute shadow activation.

Gate 22 did not make the external plugin active.

Gate 22 did not perform temporary env discovery.

Gate 22 did not execute plugin code.

Gate 22 did not execute `processToolCall`.

Gate 22 did not start `server.js`.

Gate 22 did not perform provider startup or calls.

Gate 22 did not perform Plugin Store live operations.

Gate 22 did not delete the core plugin.

Gate 22 did not move the core plugin.

Gate 22 did not modify the external plugin.

Gate 22 did not change runtime behavior.

Gate 22 did not modify `Plugin.js`.

Gate 22 did not modify `modules/pluginRootResolver.js`.

Gate 22 did not modify `server.js`.

Gate 22 did not modify routes.

Gate 22 did not change resolver priority.

Gate 22 did not activate persistent env.

Gate 22 did not edit `.env` or `config.env`.

Gate 22 did not write LocalState.

Gate 22 did not write external receipts.

Gate 22 did not write secrets, logs, cache, or outputs.

## Conclusion

Gate 22 recommends the future renamed external candidate:

```text
JennAIGentOrchestrator
```

The future candidate should live under:

```text
VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

This route lets the project test a separate external plugin identity without
weakening core-first ordering, bypassing same-name override prevention, deleting
the core plugin, changing resolver priority, or activating persistent env.

Gate 22 does not create the candidate. It only prepares the RFC for review.

Gate 22 RFC is ready for review, not sealed.

Do not start Gate 23.

# Jenn External Runtime Allowlist Contract

**Status:** Gate 32 documentation-only contract capture.
**Date:** 2026-06-12
**Scope:** Gate 31D runtime allowlist finding for `JennAIGentOrchestrator`.

This document records the sealed Jenn external runtime allowlist contract after Gate 31D. It does
not change runtime behavior, create external plugin code, migrate plugins, enable providers, run
Plugin Store operations, or persist environment configuration.

## Purpose

Gate 31D verified that the external `JennAIGentOrchestrator` runtime can be registered and invoked
for a planner-only dry run when the existing external discovery roots and the exact runtime
registration allowlist are supplied as temporary process environment only.

This document preserves that contract so future gates do not confuse discovery with runtime
registration, and do not treat the Gate 31D dry run as provider validation.

## Package And State Boundaries

- `VCPToolBox-JENN-Extensions` is the managed Jenn external package root.
- `VCPToolBox-JENN-Extensions\Plugin` is the legacy-compatible external plugin discovery root.
- `VCPToolBox-JENN-LocalState` is private operator state and must never be used as a plugin root.

The package root, plugin discovery root, and local private state root are separate boundaries. The
existence of any directory under these roots does not grant runtime registration.

## Discovery Versus Runtime Registration

The discovery and install boundary variables are:

```text
VCP_PLUGIN_ALLOWED_ROOTS=<path>\VCPToolBox-JENN-Extensions
VCP_PLUGIN_DIRS=<path>\VCPToolBox-JENN-Extensions\Plugin
VCP_PLUGIN_INSTALL_DIR=<path>\VCPToolBox-JENN-Extensions\Plugin
```

`VCP_PLUGIN_ALLOWED_ROOTS`, `VCP_PLUGIN_DIRS`, and `VCP_PLUGIN_INSTALL_DIR` are discovery/install
boundary variables. They can allow the external legacy plugin root to enter the plugin root
snapshot, but passing discovery alone is not proof of runtime registration.

Runtime registration is gated separately by `VCP_EXTERNAL_PLUGIN_ALLOWLIST`.

Gate 31D used this exact plugin-scoped runtime registration allowlist:

```text
VCP_EXTERNAL_PLUGIN_ALLOWLIST=JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

Runtime registration must be verified separately from discovery in any future gate.

## Allowed Runtime Allowlist Form

The only approved Gate 31D runtime allowlist form was exact-plugin scoped:

```text
JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

Future gates may use the same exact form for `JennAIGentOrchestrator` only when explicitly
authorized by a task book.

## Forbidden Runtime Allowlist Forms

The following forms are not allowed for Jenn runtime registration work unless a future reviewed
runtime policy explicitly changes the contract:

- wildcard allowlists
- name-only allowlists
- package-root allowlists such as `VCPToolBox-JENN-Extensions`
- discovery-root allowlists such as `VCPToolBox-JENN-Extensions\Plugin`
- broad root-only allowlists
- multiple-plugin allowlists when only `JennAIGentOrchestrator` is under review
- LocalState-root allowlists

`VCPToolBox-JENN-LocalState` remains private local state and is not a plugin root by default.

## Gate 31D Planner-Only Result Boundary

Gate 31D invoked exactly `PlanImagePipeline` through `PluginManager.processToolCall` with:

```text
requestId: gate31d-plan-image-pipeline-no-provider-dry-run
dryRun: true
allowProvider: false
allowDownstream: false
allowExecution: false
AIGENT_ORCHESTRATOR_ALLOW_EXECUTION=false
AIGENT_ORCHESTRATOR_DEFAULT_MODE=dry-run
```

Gate 31D proved only the planner-only dry-run path:

- `PlanImagePipeline` returned a planned dry-run result.
- No provider call occurred.
- No downstream plugin call occurred.
- No `PlanRetryPipeline` call occurred.
- No `HealthCheck` fallback occurred.
- No `VCPToolBox-JENN-LocalState` write occurred.
- No provider credentials, provider URLs, generated outputs, logs, cache, or secrets were used.
- No persistent environment or config file was written.

Gate 31D must not be represented as provider validation, image generation validation, downstream
execution validation, migration validation, or production readiness.

## Gate 31D PlanImagePipeline ABI fixture shape

The Gate 31D ABI fixture statement is scoped to the sealed Gate 31D evidence
shape. It records the exact evidence fixture and does not redefine every valid
input shape that the external plugin implementation may accept outside Gate 31D.

```text
plugin identity: JennAIGentOrchestrator
command: PlanImagePipeline
requestId: gate31d-plan-image-pipeline-no-provider-dry-run
top-level user_input supplied: yes
input supplied: no
description supplied: no
allowProvider: false
allowDownstream: false
allowExecution: false
dryRun: true
PlanRetryPipeline executed: no
HealthCheck fallback executed: no
processToolCall count: 1
planner-only result observed: yes
provider validation: no
```

For repeating or citing the Gate 31D evidence fixture, `user_input` is the
top-level input field. `input` and `description` were absent from the Gate 31D
toolArgs shape.

input must not be substituted for user_input in the Gate 31D evidence fixture.

description must not be substituted for user_input in the Gate 31D evidence fixture.

This fixture-scoped prohibition does not claim that the external plugin
implementation never accepts `description` in other contexts. `PlanRetryPipeline`
and `HealthCheck` were not fallback commands for Gate 31D. Gate 31D remains
no-provider, no-downstream, planner-only evidence and is not provider validation.
Future provider validation requires a separate explicit gate.

## Future Gate Guidance

Future gates must preserve these distinctions:

- Discovery roots prove only that the external plugin folder can be found.
- Runtime registration proves only that an exact reviewed external plugin source root was allowed.
- Planner dry-run success proves only planning behavior for the supplied command and flags.
- Provider work requires a separate explicit gate and token.
- Downstream execution requires a separate explicit gate and token.
- Migration or cutover requires a separate explicit gate and token.

Any future provider validation must explicitly state that it is provider validation and must not
reuse Gate 31D as evidence that provider calls are safe or functional.

## Minimal Reference Shape

The Gate 31D no-provider dry-run used this command boundary:

```text
plugin: JennAIGentOrchestrator
command: PlanImagePipeline
requestId: gate31d-plan-image-pipeline-no-provider-dry-run
dryRun: true
allowProvider: false
allowDownstream: false
allowExecution: false
```

This reference is documentation only. It is not authorization to run `PlanImagePipeline`,
`HealthCheck`, `PlanRetryPipeline`, or any other plugin command.

## Validation Checklist For Future Gates

Before relying on this contract, a future gate should confirm:

- `VCPToolBox-JENN-Extensions` remains the managed external package root.
- `VCPToolBox-JENN-Extensions\Plugin` remains the external legacy plugin discovery root.
- `VCPToolBox-JENN-LocalState` remains private local state and is not configured as a plugin root.
- `VCP_EXTERNAL_PLUGIN_ALLOWLIST` is exact-plugin scoped.
- Broad, wildcard, name-only, package-root, discovery-root, and LocalState-root allowlists are not
  used.
- Discovery success is not treated as runtime registration success.
- Runtime registration success is not treated as provider validation.
- Planner dry-run success is not treated as downstream execution validation.

## Explicit Non-Goals

Gate 32 does not:

- change `Plugin.js`
- change `modules/pluginRootResolver.js`
- change `server.js`
- change `JennAIGentOrchestrator`
- change external package runtime/plugin files
- write `VCPToolBox-JENN-LocalState`
- execute `PlanImagePipeline`
- execute `HealthCheck`
- execute `PlanRetryPipeline`
- invoke `PluginManager.processToolCall`
- call providers
- dispatch downstream plugins
- persist env/config
- migrate plugins
- perform cutover
- create commits, pushes, PRs, merges, releases, deploys, or npm publishes
- start Gate 33

# Gate 29｜Post-HealthCheck Evidence Review + Next Command Scope RFC

## Status

Gate 29 is a documentation-only evidence review and next-command scope RFC.

This RFC is ready for review, not sealed.

## Scope

Gate 29 reviews the sealed Gate 28 `HealthCheck` dry-run evidence for the
external renamed `JennAIGentOrchestrator` candidate and defines the safest
next execution-related scope.

Covered:

- sealed Gate 26 and Gate 27 execution-safety context;
- sealed Gate 28 single-command `HealthCheck` dry-run evidence;
- current static candidate command surface;
- what `HealthCheck` proved and did not prove;
- risks that remain before any planner command can be invoked;
- recommended scope for the next gate.

## Non-goals

Gate 29 does not execute any plugin.

Gate 29 does not call `processToolCall`.

Gate 29 does not run discovery.

Gate 29 does not use temporary `VCP_PLUGIN_*` environment variables.

Gate 29 does not persist env or config.

Gate 29 does not start `server.js`.

Gate 29 does not perform Plugin Store live install, uninstall, update, or
activation.

Gate 29 does not call providers, downstream plugins, bridges, or external
services.

Gate 29 does not execute `PlanImagePipeline`.

Gate 29 does not execute `PlanRetryPipeline`.

Gate 29 does not write to the external package, external receipts, LocalState,
logs, cache, outputs, secrets, or operator state.

Gate 29 does not authorize migration, activation, cutover, Gate 30 execution,
push, PR creation, merge, release, deploy, or publish.

## Sealed context

Gate 26 established that discovery must not be treated as execution approval.
Any execution gate must name the exact plugin, exact command, exact payload,
provider/downstream prohibitions, timeout handling, cleanup, and receipt
requirements.

Gate 27 defined the minimum shape for a future dry-run execution. It required a
single-command, provider-free, temporary-env-only invocation and recommended
`HealthCheck` as the first candidate command because planner commands can couple
to provider, downstream, or generated-output behavior.

Gate 28 executed only the external renamed candidate's `HealthCheck` path after
separate authorization and is now sealed.

Current candidate:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

Current manifest command surface:

```text
PlanImagePipeline
PlanRetryPipeline
HealthCheck
```

## Gate 28 evidence summary

Gate 28 retry executed this exact call shape:

```text
pluginManager.processToolCall("JennAIGentOrchestrator", { action: "HealthCheck" }, requestIp, executionContext)
```

Sealed evidence:

- target plugin: `JennAIGentOrchestrator`;
- command/action: `HealthCheck`;
- `processToolCall` attempted once;
- plugin child process spawned once;
- internal wrapper timeout did not occur;
- wrapper exit code was `0`;
- terminal summary was emitted before exit;
- `pluginManager.shutdownAllPlugins()` was called in cleanup;
- explicit wrapper exit was performed;
- provider evidence: none observed;
- downstream evidence: none observed;
- Plugin Store live operation evidence: none;
- `server.js` startup evidence: none;
- temporary script directory was removed;
- no residual Gate 28 / `JennAIGentOrchestrator` Node process remained;
- no `VCP_PLUGIN_*` environment variables remained after the run;
- LocalState remained marker-only;
- core repo remained clean;
- baseline validation passed with 50 checks.

## What Gate 28 proved

Gate 28 proved that a narrowly scoped wrapper can invoke the renamed external
candidate through `PluginManager.processToolCall` for the `HealthCheck` action
without timing out when the wrapper performs explicit cleanup.

Gate 28 proved that the `HealthCheck` path can return an object result under the
authorized dry-run shape.

Gate 28 proved that wrapper-level safeguards are required and effective for this
path:

- internal timeout;
- terminal summary before process exit;
- `shutdownAllPlugins()` in `finally`;
- explicit wrapper exit;
- post-run residual process checks;
- temporary directory cleanup;
- final baseline validation.

Gate 28 proved no observed provider, downstream, server startup, Plugin Store,
LocalState, or persistent env/config side effect for this one command.

## What Gate 28 did not prove

Gate 28 did not prove that `PlanImagePipeline` is safe to execute.

Gate 28 did not prove that `PlanRetryPipeline` is safe to execute.

Gate 28 did not prove that planner output is stable, complete, or compatible
with future UI or executor consumers.

Gate 28 did not prove that provider and downstream paths are unreachable for
planner commands.

Gate 28 did not prove that planner commands cannot write files, logs, cache,
outputs, receipts, or LocalState under different payloads.

Gate 28 did not prove that future payload shapes are safe.

Gate 28 did not prove that the external plugin should become active by default.

Gate 28 did not authorize migration, activation, cutover, Plugin Store live
operations, or persistent external-root configuration.

## HealthCheck limitations

`HealthCheck` reports safety gate state and known agent roles. It is the
smallest command surface and does not exercise the planner branches.

Static inspection shows the candidate dispatches:

```text
PlanImagePipeline
PlanRetryPipeline
HealthCheck
```

`HealthCheck` reaches only the health-reporting branch. It does not call
`planImagePipeline(request)` or `planRetryPipeline(request)`.

Therefore `HealthCheck` is good evidence for wrapper, process, cleanup, and
basic command dispatch behavior, but weak evidence for planner-specific risk.

## Remaining execution risks

Planner commands remain higher risk than `HealthCheck` because they construct
multi-agent plans involving:

- prompt generation planning;
- workflow planning;
- optional StyleTrainer preparation;
- quality inspection and retry routing;
- future execution and audit-plan fields.

The current plugin README says this stage builds plans only and does not call
downstream plugins, generation workflows, training, or external services. That
is useful static evidence, but it is not sufficient by itself to authorize
planner execution.

Risks that still require a separate design gate:

- payload shape ambiguity;
- output-shape expectations;
- accidental provider or downstream coupling;
- accidental LocalState or external receipt writes;
- long-running process behavior;
- timeout and cleanup handling for planner branches;
- proof that no image generation, training, bridge, or Plugin Store behavior is
  reached.

## Candidate next commands

Candidate commands visible in the current manifest:

```text
HealthCheck
PlanImagePipeline
PlanRetryPipeline
```

`HealthCheck` has already been exercised once under strict dry-run controls.

`PlanImagePipeline` is the most likely next command to consider because it is
the primary planner branch and can use a minimal no-provider prompt payload.

`PlanRetryPipeline` should remain behind `PlanImagePipeline` because retry
planning depends on a retry queue shape and can imply regenerated workflow
behavior in later phases.

## PlanImagePipeline risk review

`PlanImagePipeline` may be considered next only through an RFC-only design gate.

That design must define:

- exact target plugin name;
- exact action value;
- exact inert input payload;
- whether `include_style_training` is allowed and what its default must be;
- expected output shape;
- forbidden provider, downstream, image-generation, training, bridge, and Plugin
  Store behavior;
- whether child process launch is allowed;
- timeout and cleanup requirements;
- post-run residual process checks;
- LocalState and external package write prohibitions;
- receipt classification.

Gate 29 does not authorize `PlanImagePipeline` execution.

## PlanRetryPipeline risk review

`PlanRetryPipeline` should not be the next execution target.

It should remain deferred until after a `PlanImagePipeline` no-provider planner
dry-run design and, if later authorized, a successful planner dry-run.

Before any retry-planner execution, a separate RFC must define:

- the exact retry queue schema;
- minimum inert retry payload;
- proof that no regeneration is executed;
- proof that no QualityInspector, generator, bridge, or provider call occurs;
- output and timeout expectations.

Gate 29 does not authorize `PlanRetryPipeline` execution.

## Provider and downstream prohibition model

The next gate must preserve the Gate 26 through Gate 28 prohibition model.

Forbidden until separately authorized:

- provider startup or call;
- Doubao or other image generation call;
- downstream plugin dispatch;
- bridge call;
- network call;
- Plugin Store install, uninstall, update, or activation;
- `server.js` startup;
- persistent `VCP_PLUGIN_*` env/config;
- LocalState writes;
- external package source mutation;
- generated output writes;
- secrets, logs, cache, receipts, or operator-state writes.

Static plugin claims about dry-run behavior are not enough. The future design
must specify how the receipt will prove those prohibitions were preserved.

## Recommended next gate

Recommended next step:

```text
Gate 30｜PlanImagePipeline No-provider Planner Dry-run Design RFC
```

Gate 30 should be RFC-only.

Gate 30 should not execute `PlanImagePipeline` unless a later, separate
Commander task book explicitly changes the mode and grants an execution token.

## Rejected next steps

Rejected for immediate next step:

- direct `PlanImagePipeline` execution;
- direct `PlanRetryPipeline` execution;
- executing all manifest commands;
- enabling external roots persistently;
- starting `server.js`;
- exercising Plugin Store live install or uninstall;
- writing LocalState receipts;
- migrating or cutting over from the core plugin;
- changing `Plugin.js` or `modules/pluginRootResolver.js`;
- opening a provider or downstream behavior gate before planner design is
  reviewed.

## Future validation requirements

A future RFC for planner dry-run must require validation that:

- core repo starts clean;
- local `HEAD` equals `origin/main`;
- no persistent `VCP_PLUGIN_*` env exists before or after the run;
- external candidate inventory is unchanged;
- LocalState remains marker-only unless separately authorized;
- baseline passes before and after;
- only the exact authorized command is invoked;
- no provider, downstream, server, Plugin Store, bridge, LocalState, or external
  package writes are observed;
- temporary scripts and directories are removed;
- residual plugin-related Node processes are absent.

## Future timeout and cleanup requirements

Any later execution gate must retain the Gate 28 cleanup improvements:

- internal `Promise.race` timeout;
- outer shell timeout;
- terminal summary before exit;
- `pluginManager.shutdownAllPlugins()` in `finally`;
- explicit wrapper exit;
- residual process scan;
- temporary directory removal;
- final worktree and env checks.

Without these controls, execution must remain blocked.

## Required future authorizations

Future work requires separate authorization for each boundary:

- Gate 30 RFC-only planning;
- any future `PlanImagePipeline` execution dry-run;
- any future `PlanRetryPipeline` execution dry-run;
- any provider or downstream behavior review;
- any LocalState write;
- any Plugin Store live operation;
- any migration, activation, or cutover;
- any push, PR, merge, release, deploy, or publish.

No authorization in Gate 29 carries forward into those steps.

## Rollback / abort model

Gate 29 rollback is document-only:

- delete this RFC before commit; or
- revert the local commit if already committed.

Abort a future execution design if it cannot prove:

- exact command and payload;
- provider/downstream prohibition;
- no persistent env/config;
- no server startup;
- no Plugin Store live operation;
- no LocalState or external package writes;
- cleanup and residual process handling.

## Open questions

- What exact inert payload should a future `PlanImagePipeline` design use?
- Should `include_style_training` be explicitly forced to `false` in the first
  planner dry-run?
- What output fields are required for a successful planner dry-run receipt?
- Should a future wrapper inspect result fields such as `allow_execution`,
  `default_mode`, and `safety_boundary` directly from the command result object
  instead of assuming nested result shape?
- What timeout budget is appropriate for a planner branch compared with
  `HealthCheck`?

## Boundary confirmation

Gate 29 is documentation-only.

Gate 29 does not execute any plugin.

Gate 29 does not call `processToolCall`.

Gate 29 does not run discovery.

Gate 29 does not start `server.js`.

Gate 29 does not perform Plugin Store live operations.

Gate 29 does not authorize `PlanImagePipeline` execution.

Gate 29 does not authorize `PlanRetryPipeline` execution.

Gate 29 does not authorize provider or downstream calls.

Gate 29 does not authorize Gate 30 execution.

Gate 29 does not modify runtime code, resolver behavior, routes, config, env,
external package source, LocalState, secrets, logs, cache, outputs, or operator
state.

## Conclusion

Gate 28 is sufficient evidence for a single `HealthCheck` dry-run under strict
wrapper cleanup controls.

Gate 28 is not sufficient evidence for broader execution.

The next safe step is a documentation-only Gate 30 design RFC for a
`PlanImagePipeline` no-provider planner dry-run.

Decision:

```text
READY_FOR_GATE_29_REVIEW
```

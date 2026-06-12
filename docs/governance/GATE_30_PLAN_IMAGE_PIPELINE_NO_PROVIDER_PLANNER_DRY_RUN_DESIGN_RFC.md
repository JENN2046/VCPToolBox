# Gate 30｜PlanImagePipeline No-provider Planner Dry-run Design RFC

## Status

Gate 30 is a documentation-only design RFC.

This RFC is ready for review, not sealed.

## Scope

Gate 30 defines the minimum safe design for a possible future
`PlanImagePipeline` no-provider planner dry-run against the external renamed
`JennAIGentOrchestrator` candidate.

Covered:

- sealed Gate 28 `HealthCheck` evidence;
- sealed Gate 29 post-HealthCheck limitations and next-command scope;
- static `PlanImagePipeline` behavior;
- exact future target and command candidate;
- future payload constraints;
- provider, downstream, LocalState, output, timeout, cleanup, and receipt
  requirements.

## Non-goals

Gate 30 does not execute `PlanImagePipeline`.

Gate 30 does not execute `PlanRetryPipeline`.

Gate 30 does not retry `HealthCheck`.

Gate 30 does not execute any plugin.

Gate 30 does not call `processToolCall`.

Gate 30 does not run discovery.

Gate 30 does not use temporary `VCP_PLUGIN_*` environment variables.

Gate 30 does not persist env or config.

Gate 30 does not start `server.js`.

Gate 30 does not perform Plugin Store live install, uninstall, update, or
activation.

Gate 30 does not authorize provider calls.

Gate 30 does not authorize downstream plugin calls.

Gate 30 does not authorize LocalState writes.

Gate 30 does not authorize output, log, cache, secret, receipt, or operator-state
writes.

Gate 30 does not modify runtime code, `Plugin.js`,
`modules/pluginRootResolver.js`, routes, server files, external package source,
or LocalState.

Gate 30 does not authorize Gate 31 execution, migration, activation, cutover,
push, PR creation, merge, release, deploy, or publish.

## Sealed context

Gate 28 proved that `JennAIGentOrchestrator` can run the `HealthCheck` path
through a narrowly scoped wrapper with explicit timeout, cleanup, and
`shutdownAllPlugins()` handling.

Gate 29 recorded that `HealthCheck` evidence is not enough to authorize planner
execution. It recommended an RFC-only Gate 30 for `PlanImagePipeline` before any
planner command is invoked.

Current external candidate:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

Current manifest command surface:

```text
HealthCheck
PlanImagePipeline
PlanRetryPipeline
```

Current config defaults:

```text
AIGENT_ORCHESTRATOR_ALLOW_EXECUTION=false
AIGENT_ORCHESTRATOR_DEFAULT_MODE=dry-run
```

## Gate 28 / Gate 29 evidence summary

Gate 28 sealed evidence:

- `processToolCall` was called once for `HealthCheck`;
- one child process was spawned;
- wrapper timeout did not occur;
- cleanup completed;
- no provider, downstream, server, Plugin Store, persistent env/config, or
  LocalState side effect was observed.

Gate 29 sealed conclusion:

- `HealthCheck` validates only the smallest dispatch and cleanup path;
- planner branches remain untested;
- `PlanImagePipeline` may be considered only after a separate no-provider
  design RFC;
- direct planner execution remains rejected.

## Why PlanImagePipeline is higher risk than HealthCheck

Static inspection shows `PlanImagePipeline` builds a multi-step plan involving:

- `AIGentPrompt` with command `GenerateImagePrompt`;
- `AIGentWorkflow` with command `ExecuteWorkflow`;
- `AIGentQuality` with command `BuildRetryPlan`;
- optional `AIGentStyle` with command `BuildTrainingJob` when
  `include_style_training === true`;
- `audit_plan` and `state_plan` objects for future integration.

The implementation returns plan data and sets safety markers such as:

```text
real_workflow_invoked: false
real_training_invoked: false
external_service_called: false
```

That static evidence suggests a no-provider planner-only path is possible, but
it is not execution evidence. A future dry-run receipt must prove that those
fields are returned without provider, downstream, LocalState, Plugin Store, or
server side effects.

## Planner-only dry-run definition

A planner-only dry-run means the plugin may return a JSON plan object only.

It must not:

- call any provider;
- call any downstream plugin;
- start a workflow;
- generate an image;
- train a model;
- inspect a real output directory;
- write files;
- write LocalState;
- write logs, cache, receipts, outputs, secrets, or operator state;
- mutate env/config;
- start `server.js`;
- use Plugin Store live operations.

Plan fields that mention future agents, future commands, default model metadata,
or placeholder output directories are permitted only as inert plan data. The
future receipt must classify those fields as plan metadata and must not treat
them as proof of execution.

## Exact future target plugin

Future target plugin candidate:

```text
JennAIGentOrchestrator
```

Future plugin source should remain external:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin
```

Future execution remains unauthorized by Gate 30. A later task book must
explicitly authorize the target plugin again.

## Exact future command candidate

Future command candidate:

```text
PlanImagePipeline
```

Future call shape should remain unapproved until a separate task book grants an
execution token. If later authorized, the candidate action should be:

```json
{
  "action": "PlanImagePipeline"
}
```

Gate 30 defines the candidate. It does not authorize the call.

## Exact future payload constraints

The first possible future payload must be minimal, inert, and planner-only.

Candidate payload shape for a later RFC or execution task book:

```json
{
  "action": "PlanImagePipeline",
  "user_input": "Gate 31 inert planner-only product image prompt",
  "scenario": "general",
  "include_style_training": false,
  "execute_pipeline": false,
  "confirm_external_effects": false,
  "requested_by": "gate-31-no-provider-planner-dry-run"
}
```

The payload must not contain:

- `provider`;
- `model`;
- `model_type`;
- `outputPath`;
- `output_path`;
- `output_directory`;
- downstream plugin target;
- LocalState path;
- real filesystem path for generated assets;
- `allowExecution=true`;
- `execute_pipeline=true`;
- `confirm_external_effects=true`;
- `include_style_training=true`;
- dataset path;
- secret, token, credential, or endpoint value.

The current plugin can default `model_type` to `flux` inside returned plan data.
That returned metadata is not a provider call by itself, but a future receipt
must identify it as inert plan metadata.

If a later task book cannot preserve these payload constraints, execution must
remain blocked.

## Provider prohibition model

Future dry-run execution must prove provider-free behavior.

Forbidden:

- Doubao or any image provider startup;
- model invocation;
- image generation API call;
- network call;
- provider config read beyond normal process env defaults;
- generated image output write;
- provider evidence collection that exposes secrets.

Required future evidence:

- no provider process spawned;
- no provider module dispatch observed;
- returned safety object reports `external_service_called: false`;
- no image output path exists or changes;
- no env/config persistence occurred.

## Downstream plugin prohibition model

Future dry-run execution must prove no downstream plugin dispatch.

The returned plan may contain future step metadata such as:

```text
AIGentPrompt / GenerateImagePrompt
AIGentWorkflow / ExecuteWorkflow
AIGentQuality / BuildRetryPlan
```

Those names are allowed only as inert plan entries.

Forbidden:

- `PluginManager.processToolCall` for any downstream plugin;
- direct child process launch for downstream plugins;
- bridge calls;
- workflow execution;
- QualityInspector execution;
- StyleTrainer execution;
- ComfyUI or generation workflow execution.

Required future evidence:

- exactly one target plugin invocation;
- no downstream plugin process;
- no downstream `processToolCall`;
- returned plan safety reports `real_workflow_invoked: false`;
- returned plan safety reports `real_training_invoked: false` when style
  training remains disabled.

## LocalState / output prohibition model

The future planner dry-run must not write LocalState or output artifacts.

Forbidden paths:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-LocalState
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\receipts
```

Forbidden data:

- secrets;
- logs;
- cache;
- generated images;
- receipts;
- audit logs;
- operator state.

The returned `audit_plan.write_audit_log` value must remain `false`.

The returned `state_plan.dry_run` value must remain `true`.

The returned quality step may include a placeholder directory value only. A
future payload must not pass a real output directory.

## Timeout and cleanup requirements

Any future execution gate must retain the Gate 28 wrapper cleanup model:

- internal `Promise.race` timeout;
- outer shell timeout;
- terminal JSON summary before exit;
- `pluginManager.shutdownAllPlugins()` in `finally`;
- explicit wrapper exit;
- residual Node process scan;
- temporary directory removal;
- post-run `VCP_PLUGIN_*` env check;
- final core repo worktree check;
- final LocalState marker-only check.

The future timeout budget may be higher than `HealthCheck`, but it must be
explicit in the task book. If the planner branch cannot complete within that
budget, the gate must return `BLOCKED` rather than expanding scope.

## Receipt evidence requirements

A future execution receipt must include:

- authorization token;
- branch, `HEAD`, `origin/main`, and worktree state;
- exact target plugin;
- exact command/action;
- exact payload with no secrets;
- process-local env values used, if discovery or execution is authorized;
- whether `processToolCall` was called;
- target plugin invocation count;
- child process spawn count;
- whether any downstream plugin invocation occurred;
- whether any provider call occurred;
- result type and selected result safety fields;
- whether returned plan contains only inert step metadata;
- `dry_run`, `status`, `safety`, `state_plan`, and `audit_plan` summary;
- timeout and cleanup result;
- residual process result;
- LocalState and external package write checks;
- final baseline and worktree status.

## Stop conditions before future execution

A future execution task must stop before invocation if:

- local `HEAD` differs from `origin/main`;
- worktree is dirty;
- persistent `VCP_PLUGIN_*` env exists before start;
- candidate files changed unexpectedly;
- target plugin or action differs from the task book;
- payload contains provider, model, output path, downstream target, LocalState
  path, `allowExecution=true`, `execute_pipeline=true`,
  `confirm_external_effects=true`, or `include_style_training=true`;
- provider prohibition cannot be observed;
- downstream prohibition cannot be observed;
- server startup would be required;
- Plugin Store live operation would be required;
- LocalState or external package writes would be required;
- timeout and cleanup cannot be enforced.

## Required future authorization

Gate 30 does not authorize execution.

Future work requires a separate task book and exact authorization token for:

- Gate 31 design review, if Commander wants another review layer;
- any `PlanImagePipeline` dry-run execution;
- any `PlanRetryPipeline` review or execution;
- any provider or downstream behavior test;
- any LocalState write;
- any external receipt write;
- any Plugin Store live operation;
- any migration, activation, cutover, push, PR, merge, release, deploy, or
  publish.

## Rejected unsafe shortcuts

Rejected:

- execute `PlanImagePipeline` directly after Gate 30;
- reuse the Gate 28 `HealthCheck` payload shape for planner execution;
- allow `include_style_training=true` in the first planner dry-run;
- pass a real output directory;
- pass a provider, model, downstream target, or LocalState path;
- set execution-related flags to true;
- start `server.js`;
- use Plugin Store live operations;
- persist external-root env;
- treat returned plan metadata as actual downstream execution evidence;
- broaden the gate to `PlanRetryPipeline`;
- change runtime code to make the test easier.

## Open questions

- Should the first future planner dry-run force `scenario: "general"` or use a
  product-oriented prompt to exercise ecommerce inference?
- Should a future wrapper capture and summarize the full returned step list, or
  only selected safety fields?
- Should returned default `model_type` metadata be explicitly allowed in receipt
  checks even when payload forbids passing model fields?
- Should Gate 31 be another review-only gate or the first execution gate?
- What exact timeout budget is acceptable for the planner branch?

## Boundary confirmation

Gate 30 is documentation-only.

Gate 30 does not execute `PlanImagePipeline`.

Gate 30 does not execute `PlanRetryPipeline`.

Gate 30 does not execute `HealthCheck`.

Gate 30 does not execute any plugin.

Gate 30 does not call `processToolCall`.

Gate 30 does not run discovery.

Gate 30 does not start `server.js`.

Gate 30 does not perform Plugin Store live operations.

Gate 30 does not authorize provider calls.

Gate 30 does not authorize downstream plugin calls.

Gate 30 does not authorize LocalState writes.

Gate 30 does not authorize output, log, cache, secret, receipt, or
operator-state writes.

Gate 30 does not authorize Gate 31 execution.

Gate 30 does not change runtime code, resolver behavior, routes, config, env,
external package source, LocalState, secrets, logs, cache, outputs, or operator
state.

## Conclusion

Static inspection indicates `PlanImagePipeline` can likely be tested as a
planner-only, no-provider dry-run if a future task book enforces strict payload,
timeout, cleanup, and evidence boundaries.

Gate 30 does not authorize that execution.

The next safe step is Commander review of this RFC. If approved, a later Gate 31
may either remain review-only or become a separately authorized
`PlanImagePipeline` no-provider planner dry-run execution gate.

Decision:

```text
READY_FOR_GATE_30_REVIEW
```

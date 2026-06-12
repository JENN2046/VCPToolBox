# Gate 27｜Execution Dry-run Design Review RFC

## Status

Gate 27 is a documentation-only design review RFC.

This RFC is ready for review, not sealed.

## Scope

This document defines the minimum safe design for a future execution dry-run of
the external renamed `JennAIGentOrchestrator` candidate.

Gate 27 does not execute the candidate. It only records what a later execution
gate must prove before any command invocation is allowed.

Covered:

- sealed Gate 23 through Gate 26 context;
- target candidate and command boundary;
- dry-run execution shape for a future gate;
- provider, downstream, LocalState, and Plugin Store prohibitions;
- temporary environment requirements;
- validation and receipt requirements;
- stop conditions for the later execution gate.

## Non-goals

Gate 27 does not execute `JennAIGentOrchestrator`.

Gate 27 does not execute `AIGentOrchestrator`.

Gate 27 does not call `processToolCall`.

Gate 27 does not start `server.js`.

Gate 27 does not start providers.

Gate 27 does not perform image generation.

Gate 27 does not call downstream plugins.

Gate 27 does not perform Plugin Store live install, uninstall, update, or
activation.

Gate 27 does not persist `VCP_PLUGIN_*` env settings.

Gate 27 does not edit `.env`, `config.env`, or secrets.

Gate 27 does not write LocalState.

Gate 27 does not write logs, cache, generated outputs, receipts, or operator
data.

Gate 27 does not modify `Plugin.js`.

Gate 27 does not modify `modules/pluginRootResolver.js`.

Gate 27 does not modify routes or `server.js`.

Gate 27 does not create, delete, or migrate plugin directories.

Gate 27 does not push, open a PR, merge, release, deploy, or publish.

Gate 27 does not authorize Gate 28.

## Sealed Context

Gate 23 created and sealed the renamed external candidate:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

Gate 24 confirmed the renamed candidate remains byte-aligned where expected
with the sealed external same-name copy and core source.

Gate 25 proved temporary discovery only. The candidate was discovered as an
external plugin, but no code was executed.

Gate 26 documented parallel execution safety and explicitly required a separate
design review before any execution dry-run.

## Candidate Boundary

The future dry-run target is:

```text
pluginName: JennAIGentOrchestrator
pluginSource: external
pluginRoot: A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin
```

The current candidate manifest exposes:

```text
PlanImagePipeline
PlanRetryPipeline
HealthCheck
```

The first execution dry-run should prefer `HealthCheck` unless a later task book
shows that command is not inert. Image planning commands remain deferred because
they can couple to provider, downstream, or generated-output behavior.

## Future Gate 28 Minimum Shape

A later Gate 28, if authorized, should be a single-command no-provider dry-run.

Minimum allowed shape:

- temporary process environment only;
- external roots default-off outside that process;
- target plugin name exactly `JennAIGentOrchestrator`;
- target command exactly one explicitly authorized command;
- minimal inert payload;
- no provider startup;
- no provider call;
- no downstream plugin call;
- no image generation;
- no persistent env/config writes;
- no LocalState writes unless separately authorized;
- no plugin source mutation;
- no core repo mutation;
- receipt-only evidence.

## Temporary Environment Contract

Any future execution dry-run must use process-local env only:

```text
VCP_PLUGIN_ALLOWED_ROOTS=A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
VCP_PLUGIN_DIRS=A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin
VCP_PLUGIN_INSTALL_DIR=A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin
```

The following remains incompatible with the recommended nested layout:

```text
VCP_PLUGIN_DIRS=A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
```

No future execution gate may persist these values into `.env`, `config.env`,
shell profile files, service configuration, or checked-in files.

## Invocation Boundary

The future dry-run task book must explicitly define:

- whether `PluginManager.processToolCall` may be called;
- the exact plugin name;
- the exact command name;
- the exact payload;
- the expected output shape;
- whether module import alone is acceptable evidence;
- whether child process launch is allowed;
- how stdout and stderr may be captured;
- how timeouts are enforced;
- how temporary env is cleared.

If any of those fields is missing, execution must remain blocked.

## Provider And Downstream Boundary

The first execution dry-run must be provider-free.

Forbidden in the first execution gate:

- Doubao provider calls;
- image generation calls;
- filesystem writes for generated image output;
- downstream plugin dispatch;
- bridge calls;
- network calls;
- live service calls;
- Plugin Store install or uninstall;
- LocalState writes.

If `HealthCheck` cannot run without any of those side effects, Gate 28 must stop
and report `BLOCKED` instead of expanding scope.

## LocalState Boundary

`VCPToolBox-JENN-LocalState` remains private local state.

Gate 27 does not authorize writes to:

```text
logs
cache
outputs
secrets
receipts
```

A later execution receipt may be written only if a future task book explicitly
authorizes the path and content classification.

## Plugin Store Boundary

Plugin Store live behavior remains out of scope.

The future dry-run must not call install, uninstall, update, activation, or
package mutation paths. The existence of `VCP_PLUGIN_INSTALL_DIR` in temporary
env is only to preserve resolver contract shape, not to authorize installation.

## Required Preflight For Future Execution

Before any later execution dry-run, preflight must prove:

- core repo branch is `main`;
- local `HEAD` equals `origin/main`;
- worktree is clean;
- no persistent `VCP_PLUGIN_*` env is present before the dry-run;
- external candidate inventory is unchanged;
- `JennAIGentOrchestrator` manifest name is unchanged;
- no same-name core plugin exists;
- LocalState remains marker-only unless separately authorized;
- baseline check passes;
- temporary discovery still finds the candidate;
- package root direct mapping still does not discover nested plugins.

## Required Receipt For Future Execution

The future execution receipt must include:

- authorization token;
- branch, `HEAD`, `origin/main`, and worktree state;
- temporary env values used, without secrets;
- target plugin and command;
- whether `processToolCall` was called;
- whether child process launch occurred;
- stdout and stderr classification, if captured;
- whether provider code was reached;
- whether downstream dispatch occurred;
- whether any file was written;
- whether LocalState changed;
- whether Plugin Store live behavior occurred;
- cleanup result;
- final worktree state;
- recommendation.

## Stop Conditions For Future Execution

The future execution gate must stop before invocation if:

- worktree is dirty;
- local `HEAD` differs from `origin/main`;
- persistent `VCP_PLUGIN_*` env is present;
- candidate files changed unexpectedly;
- the selected command is not explicitly authorized;
- provider calls cannot be blocked or proven absent;
- downstream plugin calls cannot be blocked or proven absent;
- execution would require `server.js` startup;
- execution would require Plugin Store live behavior;
- execution would require writing secrets, logs, cache, generated outputs, or
  LocalState without separate authorization.

## Gate 27 Decision

Gate 27 records that a future dry-run execution gate must be single-command,
provider-free, temporary-env-only, and receipt-driven.

Gate 27 does not authorize execution.

Gate 27 does not authorize activation.

Gate 27 does not authorize cutover.

Gate 27 does not authorize Gate 28.

# Gate 63 | AIGentOrchestrator Harness-Only Resolution Guard Design RFC

## 1. Status

Status: ready for review, harness-only guard design only.

Gate 63 designs a harness-only resolution guard.

Gate 63 does not implement the guard.

Gate 63 does not add or modify scripts.

Gate 63 does not execute the harness.

Gate 63 does not rerun Stage 3.

Gate 63 does not execute a runtime resolution probe.

Gate 63 does not execute a runtime dry-run.

Gate 63 does not invoke processToolCall.

Gate 63 does not execute PluginManager.loadPlugins.

Gate 63 does not call providers.

Gate 63 does not dispatch downstream plugins.

Gate 63 does not write LocalState.

Gate 63 does not activate server routes.

Gate 63 does not perform real image generation.

Gate 63 does not authorize runtime cutover.

Gate 63 does not modify Plugin files, modules, scripts, baseline checks, server
routes, or external package files.

Gate 63 does not start Gate 64.

## 2. Sealed Inputs

Gate 63 starts from these sealed facts:

- Stage 1 external identity proof: sealed.
- Stage 2 direct stdio no-provider probe: sealed.
- Stage 3 bounded runtime resolution proof: sealed.
- Gate 62 resolver source review: sealed.
- Gate 62 classification:

```text
RESOLVER_SOURCE_REQUIRES_HARNESS_ONLY_PATH
```

- Gate 62 recommendation:

```text
RECOMMEND_GATE_63_HARNESS_ONLY_RESOLUTION_GUARD_DESIGN_RFC
```

- No safe public runtime resolver-only API was found.
- PluginManager.loadPlugins remains too broad for the next proof.
- processToolCall remains the execution handoff boundary.
- Old broad Gate 52 remains blocked and must not be reused as-is.

## 3. Design Goal

The future guard should statically and deterministically check the external
resolution contract without entering broad runtime.

The guard should prove:

- exact external allowlist entry is present and parseable
- allowlist entry is exact path only
- wildcard allowlist is not used
- name-only allowlist is not used
- package-root allowlist is not used
- LocalState-root allowlist is not used
- external path resolves to the sealed plugin path
- manifest exists at the sealed plugin path
- manifest identity is `JennAIGentOrchestrator`
- core `Plugin/AIGentOrchestrator` fallback is false
- runtime execution handoff is false
- PluginManager.loadPlugins is not invoked
- processToolCall is not invoked
- provider, downstream, LocalState, server, and image paths remain off

The sealed external plugin path is:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

The sealed exact allowlist is:

```text
JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

## 4. Harness-Only Rationale

Gate 62 found that `PluginManager.loadPlugins()` is not a safe resolver-only
boundary because it can clear runtime state, register plugins, initialize
modules, rebuild descriptions, and emit runtime events.

Gate 62 also found that `processToolCall()` is the execution handoff boundary.

The future guard should therefore stay in the harness and avoid runtime manager
entrypoints.

The guard may inspect files, parse JSON, normalize paths, and inspect source
text statically.

The guard must not mutate runtime state.

## 5. Future Command Shape

The future implementation should add one explicit command path:

```powershell
node scripts/run-jenn-aigent-orchestrator-no-provider-runtime-harness.js --stage4-harness-only-resolution-guard
```

The proposed stage name is:

```text
stage4_harness_only_resolution_guard
```

The default harness command must remain unchanged.

Stage 2 and Stage 3 explicit command paths must remain unchanged.

The future command must not run unless explicitly requested by a later gate.

## 6. Future Guard Algorithm

The future guard should:

1. verify core and external worktrees are clean before the guard
2. parse the exact allowlist string
3. reject wildcard, name-only, package-root, and LocalState-root allowlists
4. normalize and resolve the allowlist path
5. compare the resolved path to the sealed external plugin path
6. compare the resolved path against the core fallback path
7. locate `plugin-manifest.json` under the sealed external path
8. parse manifest JSON
9. confirm manifest `name` is `JennAIGentOrchestrator`
10. confirm no runtime manager entrypoint was called
11. verify core and external worktrees are still clean after the guard
12. emit a PASS or BLOCK receipt

The guard should fail closed if any check cannot be completed or cannot be
ruled out.

## 7. Future Receipt Fields

The future receipt must include:

- stage
- exact external allowlist
- allowlist parsed
- allowlist type
- wildcard allowlist used
- name-only allowlist used
- package-root allowlist used
- LocalState-root allowlist used
- resolved external plugin path
- resolved path is external package path
- manifest path
- manifest identity
- manifest identity matched
- core fallback used
- execution handoff occurred
- PluginManager.loadPlugins invoked
- processToolCall invoked
- PlanImagePipeline executed
- provider calls
- downstream dispatch
- LocalState writes
- server route activation
- real image generation
- files modified
- result

Recommended fixed false/off fields:

- execution handoff occurred: false
- PluginManager.loadPlugins invoked: false
- processToolCall invoked: false
- PlanImagePipeline executed: false
- provider calls: `not_called`
- downstream dispatch: `not_dispatched`
- LocalState writes: `not_written`
- server route activation: `not_started`
- real image generation: `not_started`

## 8. Non-Proof Boundaries

The future guard must not be represented as:

- provider validation
- runtime cutover readiness
- downstream dispatch validation
- LocalState migration readiness
- server route readiness
- real image generation readiness
- full PluginManager success
- broad runtime success
- production readiness
- processToolCall execution
- PlanImagePipeline execution

The guard is a resolution contract check only.

## 9. Default Baseline Constraint

The future default `npm run test:baseline` path must not depend on external
package filesystem availability.

If baseline is updated in a later gate, it should statically verify only the
harness script and governance contract markers.

Baseline must not execute the future guard.

Baseline must not execute the harness.

## 10. Block Policy

The future implementation must block if:

- the exact allowlist is absent
- the allowlist cannot be parsed
- wildcard allowlist is accepted
- name-only allowlist is accepted
- package-root allowlist is accepted
- LocalState-root allowlist is accepted
- the resolved path differs from the sealed external plugin path
- the manifest is missing
- the manifest identity is not `JennAIGentOrchestrator`
- core fallback is used
- execution handoff occurs
- PluginManager.loadPlugins is invoked
- processToolCall is invoked
- PlanImagePipeline is executed
- provider calls occur
- downstream dispatch occurs
- LocalState writes occur
- server route activation occurs
- real image generation occurs
- files are modified
- any receipt field is missing or ambiguous

## 11. Old Broad Gate 52 Status

Old broad Gate 52 remains blocked and must not be reused as-is.

The old broad Gate 52 timeout must not be represented as no-provider runtime
success.

Stage 1, Stage 2, Stage 3, and the future harness-only guard must not be
converted into provider validation.

## 12. Rollback Policy

Gate 63 is documentation-only.

Rollback is a normal revert of the Gate 63 RFC commit.

No runtime state rollback is required because Gate 63 does not implement the
guard, execute the harness, run a runtime probe, call providers, dispatch
downstream plugins, write LocalState, activate server routes, perform image
generation, or modify external package files.

## 13. Deferred Work

Gate 64 remains not started.

A future Gate 64 must separately authorize any implementation.

Any future execution must be separately authorized after implementation.

Provider validation remains out of scope.

Runtime cutover remains out of scope.

## 14. Classification

HARNESS_ONLY_RESOLUTION_GUARD_DESIGN_READY

The design is ready because Gate 62 identified a harness-only path that can
check the external resolution contract without broad PluginManager loading,
processToolCall, provider calls, downstream dispatch, LocalState writes, server
route activation, real image generation, or runtime cutover.

## 15. Recommendation

RECOMMEND_GATE_64_HARNESS_ONLY_RESOLUTION_GUARD_IMPLEMENTATION

Gate 64 must remain separately authorized.

Gate 64 should implement only the harness-only resolution guard unless a later
task book explicitly expands scope.

Gate 64 must not execute the guard unless separately authorized by its own task
book.

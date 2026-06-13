# Gate 58 | AIGentOrchestrator Bounded Runtime Resolution Probe Design RFC

## 1. Status

Status: ready for review, Stage 3 design only.

Gate 58 designs a bounded runtime resolution probe.

Gate 58 does not implement Stage 3.

Gate 58 does not execute Stage 3.

Gate 58 does not execute the harness.

Gate 58 does not execute a runtime probe.

Gate 58 does not execute a runtime dry-run.

Gate 58 does not invoke processToolCall.

Gate 58 does not execute PluginManager.loadPlugins.

Gate 58 does not call providers.

Gate 58 does not dispatch downstream plugins.

Gate 58 does not write LocalState.

Gate 58 does not activate server routes.

Gate 58 does not perform real image generation.

Gate 58 does not authorize runtime cutover.

Gate 58 does not prove provider validation.

Gate 58 does not prove full PluginManager integration.

Gate 58 does not modify Plugin files, modules, scripts, baseline checks, server
routes, or external package files.

Gate 58 does not start Gate 59.

## 2. Current Evidence

Gate 58 starts from these sealed facts:

- core HEAD: `5f9392ea79384ffd34fd33f1f57d955caa4c1cbe`
- external HEAD: `f7772c654c2d8d34698f2818fde02ec63df783cb`
- Stage 1 external identity proof: sealed
- Stage 2 direct stdio no-provider probe: sealed
- old broad Gate 52: blocked and not reusable as-is

The sealed external plugin path is:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

The sealed exact allowlist is:

```text
JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

Core fallback was false in the sealed Stage 1 and Stage 2 evidence.

Stage 2 was direct stdio only. It was not full PluginManager integration.

## 3. Stage 3 Design Goal

Stage 3 should check whether core runtime infrastructure can resolve the
external plugin path and manifest identity under the exact external allowlist.

The design must stay below execution.

The Stage 3 probe must not execute `PlanImagePipeline`.

The Stage 3 probe must not call processToolCall.

The Stage 3 probe must not call providers.

The Stage 3 probe must not dispatch downstream plugins.

The Stage 3 probe must not write LocalState.

The Stage 3 probe must not activate server routes.

The Stage 3 probe must not perform real image generation.

The Stage 3 probe must not authorize runtime cutover.

## 4. Stage 3 Proof Scope

Stage 3 may prove only:

- exact allowlist parsing
- exact allowlist resolution
- external path resolution
- manifest path identification
- manifest identity: `JennAIGentOrchestrator`
- resolved path equals the external package plugin path
- core `Plugin/AIGentOrchestrator` fallback is false
- no wildcard allowlist was accepted
- no name-only allowlist was accepted
- no package-root allowlist was accepted
- no LocalState-root allowlist was accepted
- no execution handoff happened

The minimal future probe should inspect metadata only:

1. parse the exact allowlist entry
2. resolve the path component
3. confirm the resolved directory is the sealed external plugin path
4. locate the manifest inside that exact directory
5. read manifest metadata only
6. confirm the manifest identity is `JennAIGentOrchestrator`
7. confirm no fallback to the core plugin path occurred
8. emit a PASS or BLOCK receipt

## 5. Stage 3 Non-Proof Boundaries

Stage 3 must not be represented as:

- provider validation
- runtime cutover readiness
- downstream dispatch validation
- LocalState migration readiness
- server route readiness
- real image generation readiness
- full PluginManager success
- broad runtime success
- production readiness
- `PlanImagePipeline` execution

Stage 3 output must be described as bounded runtime resolution evidence only.

## 6. PluginManager Boundary

The future Stage 3 implementation may reference runtime resolver or
PluginManager source surfaces in read-only design and review work.

The future Stage 3 implementation must not call broad
`PluginManager.loadPlugins()` unless a later design proves a bounded,
non-hanging resolver-only mode before implementation.

If a resolver-only mode is introduced in a future gate, it must:

- inspect only the exact allowlist entry
- avoid package-wide discovery
- avoid service initialization
- avoid stdio child process launch
- avoid processToolCall
- avoid provider, downstream, LocalState, server route, and image-generation
  paths
- emit a receipt before and after the resolver boundary

## 7. Timeout, Abort, And Cleanup

Any future Stage 3 implementation must have a bounded timeout.

Recommended initial timeout:

```text
15000 ms
```

Any future implementation must:

- return PASS or BLOCK
- fail closed on missing receipt
- avoid silent hangs
- avoid automatic rerun after failure
- report timeout duration
- report whether any child process was started
- report whether any child process remained after cleanup
- verify core and external worktrees after the probe
- mark any file modification as BLOCK

Stage 3 should normally avoid starting a child process because the intended
boundary is metadata resolution, not entrypoint execution.

## 8. Future Receipt Design

The future Stage 3 PASS/BLOCK receipt must include:

- stage: `stage3_bounded_runtime_resolution_probe`
- core HEAD
- core origin/main
- external HEAD
- external origin/main
- exact allowlist
- resolved plugin path
- plugin identity
- manifest path
- core fallback used
- broad PluginManager.loadPlugins invoked
- processToolCall invoked
- provider calls
- downstream dispatch
- LocalState writes
- server route activation
- real image generation
- child process started
- timeout ms
- timed out
- files modified
- result

The receipt must report `PASS` only when the exact external path and manifest
identity are resolved without fallback and without execution handoff.

The receipt must report `BLOCK` if any forbidden path is required, observed, or
cannot be ruled out.

## 9. Block Policy

Stage 3 must block if:

- the exact allowlist is absent
- the allowlist is wildcard, name-only, package-root, or LocalState-root scoped
- the resolved path is not the sealed external plugin path
- the manifest cannot be located under the exact external plugin path
- the manifest identity is not `JennAIGentOrchestrator`
- core fallback is used
- broad PluginManager.loadPlugins is required
- processToolCall is required
- `PlanImagePipeline` execution is required
- provider calls are required or observed
- downstream dispatch is required or observed
- LocalState writes are required or observed
- server route activation is required or observed
- real image generation is required or observed
- any file is modified
- any receipt is missing or incomplete
- any future implementation hangs, times out, or reruns automatically

## 10. Old Broad Gate 52 Status

Old broad Gate 52 remains blocked and must not be reused as-is.

The old broad Gate 52 timeout must not be represented as no-provider runtime
success.

The Stage 1 and Stage 2 no-provider evidence must not be converted into provider
validation.

The future Stage 3 probe must stay narrower than old broad Gate 52 by checking
resolution and manifest identity only, without entering execution dispatch.

## 11. Rollback Policy

Gate 58 is documentation-only.

Rollback is a normal revert of the Gate 58 RFC commit.

No runtime state rollback is required because Gate 58 does not implement or
execute Stage 3, execute the harness, start child plugin processes, call
providers, dispatch downstream plugins, write LocalState, activate server
routes, perform image generation, or modify external package files.

## 12. Deferred Work

Gate 59 remains not started.

A future Gate 59 must be separately authorized before any implementation.

Provider validation remains out of scope.

Runtime cutover remains out of scope.

Full PluginManager integration remains out of scope.

## 13. Classification

STAGE3_RESOLUTION_PROBE_DESIGN_READY

The design is ready because the sealed Stage 1 and Stage 2 evidence provide an
exact external path, exact allowlist, manifest identity target, and core
fallback invariant. The future Stage 3 probe can be limited to metadata
resolution and manifest identity without executing `PlanImagePipeline`, calling
processToolCall, loading plugins broadly, calling providers, dispatching
downstream plugins, writing LocalState, activating server routes, or performing
real image generation.

## 14. Recommendation

RECOMMEND_GATE_59_BOUNDED_RUNTIME_RESOLUTION_PROBE_IMPLEMENTATION

Gate 59 must remain separately authorized.

Gate 59 must implement only the bounded runtime resolution probe unless a later
task book explicitly expands scope.

Gate 59 must not execute the runtime resolution probe unless separately
authorized by its own task book.

# Gate 54 | AIGentOrchestrator Bounded Stage 2 No-Provider Runtime Probe Design RFC

## 1. Status

Status: ready for review, Stage 2 design only.

Gate 54 designs a bounded Stage 2 no-provider runtime probe.

Gate 54 does not implement Stage 2.

Gate 54 does not add or modify scripts.

Gate 54 does not execute the harness.

Gate 54 does not execute a runtime probe.

Gate 54 does not execute a runtime dry-run.

Gate 54 does not invoke processToolCall.

Gate 54 does not call providers.

Gate 54 does not dispatch downstream plugins.

Gate 54 does not write LocalState.

Gate 54 does not activate server routes.

Gate 54 does not perform real image generation.

Gate 54 does not authorize runtime cutover.

Gate 54 does not modify Plugin files, modules, baseline checks, server routes,
or external package files.

## 2. Sealed Inputs

Gate 54 starts from these sealed facts:

- Gate 52B Stage 1 identity proof passed.
- The external plugin path was proven:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

- The exact allowlist was proven:

```text
JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

- Core fallback was false.
- The request shape was constructed but not executed.
- `PluginManager.loadPlugins()` was not invoked.
- `processToolCall` was not invoked.
- Providers were not called.
- Downstream dispatch did not occur.
- LocalState writes did not occur.
- Server routes were not activated.
- Real image generation did not occur.
- Old broad Gate 52 remains blocked and must not be reused as-is.

## 3. Stage 2 Design Goal

Stage 2 should move one small bounded step closer to runtime behavior while
preserving the no-provider boundary.

The Stage 2 probe should test only the external plugin stdio entrypoint
boundary:

```text
node AIGentOrchestrator.js
```

from this working directory:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

The probe should pass the inert `PlanImagePipeline` request shape over stdin and
observe a bounded JSON response from stdout.

The probe must not use broad `PluginManager.loadPlugins()`.

The probe must not call `PluginManager.processToolCall()`.

The probe must not use server routes or Plugin Store flows.

## 4. Why Direct Stdio Is The Preferred Boundary

The external manifest records:

- plugin identity: `JennAIGentOrchestrator`
- plugin type: `synchronous`
- communication protocol: `stdio`
- entrypoint command: `node AIGentOrchestrator.js`
- manifest timeout: 60000 ms

Static source inspection shows the entrypoint reads JSON from stdin, calls
`handleRequest(request)`, and writes JSON to stdout.

Static source inspection also shows the exported request handlers include
`handleRequest`, `planImagePipeline`, and `planRetryPipeline`.

This makes direct stdio probing a narrower boundary than PluginManager
discovery, service initialization, or full runtime dispatch.

## 5. Stage 2 May Prove

Stage 2 may prove only:

- the exact external entrypoint exists
- the entrypoint can be launched from the exact external plugin directory
- an inert no-provider request shape can be passed over stdin
- stdout can produce one parseable JSON response
- the process exits or is killed within a bounded timeout
- the response is for `PlanImagePipeline`
- the request keeps `dryRun: true`
- the request keeps `allowProvider: false`
- the request keeps `allowDownstream: false`
- the request keeps `allowExecution: false`
- the probe can report PASS or BLOCK without hanging
- no provider, downstream, LocalState, server, or image-generation path was
  reached according to the bounded probe evidence

## 6. Stage 2 Must Not Prove

Stage 2 must not be represented as:

- provider validation
- real runtime cutover
- downstream dispatch validation
- real image generation
- full PluginManager integration
- broad runtime success
- production readiness
- server route readiness
- LocalState migration readiness

Stage 2 output must be described as bounded direct-stdio no-provider evidence
only.

## 7. Proposed Future Implementation Shape

A future Gate 55 implementation may update the existing harness to include a
second explicit stage.

The future Stage 2 implementation should:

- keep Stage 1 identity checks first
- emit a Stage 1 PASS/BLOCK receipt before Stage 2 begins
- create the inert `PlanImagePipeline` request only after Stage 1 passes
- spawn `node AIGentOrchestrator.js` with `cwd` set to the exact external plugin
  path
- pass only the inert request JSON to stdin
- collect stdout and stderr with bounded buffers
- parse exactly one JSON response from stdout
- enforce a timeout that is shorter than or equal to the manifest timeout
- kill the child process on timeout
- report child exit code and signal
- report PASS only if the response is parseable and no forbidden boundary is
  observed
- report BLOCK for timeout, nonzero exit, invalid JSON, stderr-only failure,
  worktree mutation, or any forbidden evidence

## 8. Timeout, Abort, And Cleanup Design

The future Stage 2 implementation must use an explicit timeout.

Recommended timeout:

```text
15000 ms
```

The timeout must:

- mark the Stage 2 receipt as BLOCKED
- kill the child process
- report the timeout duration
- report whether the child was still running
- avoid rerunning automatically

Cleanup must:

- close stdin after writing the request
- stop collecting output after process exit or kill
- avoid leaving a residual child process
- verify core and external worktrees after the child exits
- report any residual process or worktree change as BLOCKED

## 9. PASS/BLOCK Receipt Design

The future Stage 2 receipt must include:

- stage: `stage2_direct_stdio_no_provider_probe`
- core HEAD
- core origin/main
- core worktree
- external HEAD
- external origin/main
- external worktree
- external origin
- exact external plugin path
- exact runtime allowlist
- entrypoint command
- working directory
- request shape
- requestId
- `dryRun`
- `allowProvider`
- `allowDownstream`
- `allowExecution`
- `PluginManager.loadPlugins invoked: false`
- `processToolCall invoked: false`
- provider calls
- downstream dispatch
- LocalState writes
- server route activation
- real image generation
- child process started
- child timeout ms
- child exit code
- child signal
- stdout JSON parse result
- response status
- response safety fields if present
- core fallback used
- files modified
- result

The receipt must be emitted for both PASS and BLOCK paths.

Missing receipt must be treated as BLOCK.

## 10. Block Policy

Stage 2 must block if:

- Stage 1 does not pass first
- the external path is not exact
- the exact allowlist is not exact
- the manifest entrypoint differs from `node AIGentOrchestrator.js`
- the manifest protocol differs from `stdio`
- the request shape uses `input` or `description`
- `dryRun` is not true
- `allowProvider`, `allowDownstream`, or `allowExecution` is not false
- `PluginManager.loadPlugins()` is needed
- `processToolCall()` is needed
- provider calls are required or observed
- downstream dispatch is required or observed
- LocalState writes are required or observed
- server route activation is required or observed
- real image generation is required or observed
- the child process times out
- the child process leaves a residual process
- stdout is not parseable JSON
- the core or external worktree changes
- any secret-like value would be printed in a receipt

## 11. Exact Allowlist Invariant

The exact allowlist remains:

```text
JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

Forbidden:

- wildcard allowlists
- name-only allowlists
- package-root allowlists
- LocalState-root allowlists
- core fallback while claiming external success

## 12. Deferred Work

Gate 54 does not implement Stage 2.

Gate 54 does not execute Stage 2.

Gate 54 does not execute the existing harness.

Gate 54 does not retry old broad Gate 52.

Gate 55 must remain separately authorized before any Stage 2 implementation.

## 13. Rollback Policy

Gate 54 is documentation-only.

Rollback is a normal revert of the Gate 54 RFC commit.

No runtime state rollback is required because Gate 54 does not execute the
harness, start child plugin processes, call providers, dispatch downstream
plugins, write LocalState, activate server routes, perform image generation, or
modify external package files.

## 14. Classification

STAGE2_PROBE_DESIGN_READY

The design is ready because the manifest and source ABI provide a clear,
bounded direct-stdio entrypoint that can be probed without broad
PluginManager runtime loading, provider calls, downstream dispatch, LocalState
writes, server route activation, or real image generation.

## 15. Recommendation

RECOMMEND_GATE_55_BOUNDED_STAGE2_NO_PROVIDER_PROBE_IMPLEMENTATION

Gate 55 must remain separately authorized.

Gate 55 must implement only the bounded Stage 2 probe unless a later task book
explicitly expands scope.

Gate 55 must not execute the probe unless separately authorized by its own task
book.

# Gate 50B | AIGentOrchestrator Harness Design Revision After Timeout RFC

## 1. Status

Status: ready for review, design revision only.

Gate 50B revises the Gate 50 / Gate 51 harness design after the Gate 52
execution timeout.

Gate 50B does not modify the existing harness script.

Gate 50B does not add a new harness script.

Gate 50B does not execute the harness.

Gate 50B does not execute a runtime dry-run.

Gate 50B does not invoke processToolCall.

Gate 50B does not call providers.

Gate 50B does not dispatch downstream plugins.

Gate 50B does not write LocalState.

Gate 50B does not authorize runtime cutover.

Gate 50B does not modify Plugin files, modules, scripts, server routes, baseline
checks, or external package files.

## 2. Timeout Evidence

Gate 52 attempted the explicit harness command once:

```powershell
node scripts/run-jenn-aigent-orchestrator-no-provider-runtime-harness.js
```

Observed Gate 52 result:

- harness timed out after about 124 seconds
- no JSON receipt was produced
- a residual harness node process existed and was contained
- provider state was not proven
- downstream dispatch state was not proven
- LocalState write state was not proven
- processToolCall count was not proven

Because no receipt was produced, Gate 52 remains blocked. Static no-provider
evidence and copy-integrity evidence cannot be converted into runtime execution
evidence.

## 3. Gate 52T Survey Finding

Gate 52T completed as a read-only timeout forensics survey.

Gate 52T classification:

```text
TIMEOUT_CAUSE_RUNTIME_PROMISE_OR_SERVER
```

The survey found that the implemented harness enters the broad PluginManager
runtime surface through:

```text
require('../Plugin')
pluginManager.loadPlugins()
pluginManager.processToolCall(...)
pluginManager.shutdownAllPlugins()
```

The target external plugin entrypoint is a synchronous stdio command, but the
harness uses full PluginManager discovery and initialization before the receipt
boundary is reached. That broad runtime surface can import direct plugins,
initialize service modules, create timers, depend on shutdown behavior, or await
runtime promises that are unrelated to proving the external AIGentOrchestrator
candidate identity.

## 4. Why Gate 52 Remains Blocked

Gate 52 cannot be sealed because the required runtime receipt is absent.

The missing receipt means there is no execution evidence for:

- exact external plugin resolution at runtime
- processToolCall invocation count
- provider calls remaining absent
- downstream dispatch remaining absent
- LocalState writes remaining absent
- server route activation remaining absent
- worktree cleanliness after runtime execution

The timeout containment proved only that the residual process was stopped. It
did not prove that the no-provider runtime dry-run succeeded.

## 5. Why A Timeout-Only Rerun Is Not Enough

Adding a simple timeout around the current harness would improve failure
containment, but it would not by itself prove that the design is narrow enough.

The current design still reaches the broad PluginManager runtime surface before
the core receipt evidence is complete. If a future run times out or blocks
during full plugin discovery, service initialization, processToolCall, or
shutdown, the result may still be ambiguous.

A valid retry design must produce evidence at each boundary before moving to
the next boundary. It must not wait until after broad runtime execution to emit
the first meaningful receipt.

## 6. Revised Harness Direction

The next harness must be split into a bounded, staged probe.

### Stage 1: External Identity Probe

Stage 1 must prove the external plugin identity without full PluginManager
runtime load.

Stage 1 must inspect only inert filesystem and manifest facts:

- external package root exists
- exact external plugin directory exists
- external plugin manifest exists
- manifest name is `JennAIGentOrchestrator`
- manifest entrypoint is `node AIGentOrchestrator.js`
- manifest communication protocol is `stdio`
- manifest plugin type is `synchronous`
- external HEAD and origin/main match the authorized expected commit
- core worktree is clean
- external worktree is clean
- exact external allowlist string is constructed
- core `Plugin/AIGentOrchestrator` fallback is not used as success evidence

Stage 1 must not require:

- `require('../Plugin')`
- `pluginManager.loadPlugins()`
- `pluginManager.processToolCall(...)`
- server route activation
- provider credentials
- downstream dispatch
- LocalState writes
- external package mutation

Stage 1 must print a receipt even when it blocks. A missing receipt must remain
a failure.

### Stage 2: Bounded Runtime Probe

Stage 2 may be designed in a future gate, but must not be executed in Gate 50B.

Any future Stage 2 runtime probe must:

- have an explicit timeout
- have an explicit abort or kill path for child processes
- have explicit cleanup
- emit a receipt before and after each boundary
- keep provider, downstream dispatch, LocalState writes, server routes, and real
  image generation out of scope
- block rather than silently hang

Stage 2 must not claim provider validation. It may only prove a no-provider,
bounded runtime path if a future gate explicitly authorizes execution.

## 7. Exact Allowlist Invariant

The only allowed external runtime allowlist value remains:

```text
JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

Explicitly forbidden:

- wildcard allowlists
- name-only allowlists
- package-root allowlists
- LocalState-root allowlists
- core `Plugin/AIGentOrchestrator` fallback while claiming external success

## 8. Safety Invariants

The revised design preserves these boundaries:

- no provider validation
- no runtime cutover
- no downstream dispatch
- no LocalState writes
- no real image generation
- no server route activation
- no PluginManager dispatch change
- no external package edits
- no broad runtime load in Stage 1
- no secret, token, credential, endpoint, or raw authorization value in receipts

## 9. Future Receipt Requirements

Any future bounded harness must emit receipts for each stage.

Stage 1 receipt must include:

- stage name
- core HEAD
- core origin/main
- core worktree
- external HEAD
- external origin/main
- external worktree
- external origin
- exact external plugin path
- manifest name
- manifest entrypoint
- manifest plugin type
- manifest communication protocol
- exact allowlist
- core fallback used
- PluginManager loaded
- processToolCall invoked
- provider calls
- downstream dispatch
- LocalState writes
- result

Stage 2 receipt requirements must be defined separately before implementation.

## 10. Block Policy

The revised design must block if:

- Stage 1 cannot produce a receipt
- exact external plugin identity cannot be proven without full PluginManager load
- the external plugin path is missing or ambiguous
- the external manifest identity is ambiguous
- the exact allowlist cannot be constructed
- core fallback is required to claim success
- any provider call is required
- any downstream dispatch is required
- any LocalState write is required
- any server route activation is required
- any real image generation is required
- runtime code changes are required to complete Stage 1
- external package changes are required

## 11. Rollback Policy

Gate 50B is documentation-only. Rollback is a normal revert of the Gate 50B RFC
commit.

No runtime state rollback should be needed because Gate 50B does not execute the
harness, does not call providers, does not dispatch downstream plugins, and does
not write LocalState.

## 12. Design Classification

REVISED_HARNESS_DESIGN_READY

The revised design is ready because the next implementation gate can be limited
to a bounded Stage 1 identity probe that avoids broad PluginManager runtime load
and must emit a BLOCK receipt on failure.

## 13. Recommended Next Gate

RECOMMEND_GATE_51B_BOUNDED_NO_PROVIDER_HARNESS_IMPLEMENTATION

Gate 51B must remain separately authorized.

Gate 51B must not execute a runtime dry-run unless a later task book explicitly
authorizes execution.

Gate 51B must not invoke processToolCall unless a later task book explicitly
authorizes a bounded runtime stage.

Gate 51B must not authorize provider validation, downstream dispatch,
LocalState writes, runtime cutover, or external package mutation.

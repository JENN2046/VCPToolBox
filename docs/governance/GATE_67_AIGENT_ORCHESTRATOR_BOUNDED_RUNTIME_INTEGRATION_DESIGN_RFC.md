# Gate 67 | AIGentOrchestrator Bounded Runtime Integration Design RFC

## 1. Route Identity

Route Segment 67-67R.

Gate name:

```text
AIGentOrchestrator Bounded Runtime Integration Design RFC
```

## 2. Baseline

Latest sealed route:

```text
Route Segment 66-66R
```

Core HEAD before design:

```text
26e2967c64a75750f3949191ccdda55edf5a2921
```

Core origin/main before design:

```text
26e2967c64a75750f3949191ccdda55edf5a2921
```

External HEAD before design:

```text
f7772c654c2d8d34698f2818fde02ec63df783cb
```

External origin/main before design:

```text
f7772c654c2d8d34698f2818fde02ec63df783cb
```

Core worktree before design:

```text
clean
```

External worktree before design:

```text
clean
```

## 3. Design Scope

Gate 67 is design only.

Gate 67 does not implement runtime integration.

Gate 67 does not integrate runtime registration behavior.

Gate 67 does not execute runtime.

Gate 67 does not run a runtime dry-run.

Gate 67 does not perform provider validation.

Gate 67 does not authorize runtime cutover.

Gate 67 does not edit `Plugin.js`, `modules/**`, `scripts/**`, package
manifests, external package files, or LocalState.

Gate 67 does not run Stage 1 / 2 / 3 / 4 harness commands.

## 4. Source-Review Basis

Gate 67 uses Gate 66 as the source-review basis.

Gate 66 files reviewed:

- `Plugin.js`
- `modules/externalPluginAllowPolicy.js`
- `modules/pluginRootResolver.js`
- `scripts/run-jenn-aigent-orchestrator-no-provider-runtime-harness.js`
- `docs/governance/GATE_63_AIGENT_ORCHESTRATOR_HARNESS_ONLY_RESOLUTION_GUARD_DESIGN_RFC.md`
- `docs/governance/GATE_65_AIGENT_ORCHESTRATOR_HARNESS_ONLY_RESOLUTION_GUARD_EXECUTION_PROOF.md`

Candidate seam recorded by Gate 66:

```text
Plugin.js::_evaluateExternalPluginRuntimeRegistration()
```

Preferred future shape recorded by Gate 66:

```text
pure exact-path resolver/helper called by registration policy path
```

Unsafe seams rejected by Gate 66:

- `PluginManager.loadPlugins()`
- `processToolCall()`
- `executePlugin()`
- hot reload / watcher paths

Required guardrails from Gate 66:

- exact allowlist required
- exact external plugin path required
- manifest identity match required
- core fallback denied
- execution handoff boundary preserved
- `PluginManager.loadPlugins()` not used as resolver-only proof
- `processToolCall()` boundary preserved
- `executePlugin()` boundary preserved
- provider, downstream, LocalState, server, image, and runtime cutover
  boundaries preserved

## 5. Proposed Future Architecture

Gate 68 or later should implement a pure bounded resolver/helper for the
external JennAIGentOrchestrator resolution contract.

The helper should be side-effect-free except for bounded file reads required to
inspect the external manifest. It should not register a plugin, mutate runtime
maps, initialize modules, emit runtime events, spawn a process, or perform any
tool execution handoff.

The helper should be called only by the bounded runtime registration policy
path, with the intended call site under:

```text
Plugin.js::_evaluateExternalPluginRuntimeRegistration()
```

The helper should resolve only:

```text
JennAIGentOrchestrator
```

The helper should require the exact allowlist entry:

```text
JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

The helper should require the exact external plugin path:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

The helper should read:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator\plugin-manifest.json
```

The helper should require:

```text
manifest.name === "JennAIGentOrchestrator"
```

The helper should deny any fallback to:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\Plugin\AIGentOrchestrator
```

The helper should return bounded resolution evidence only. It should not
perform execution handoff. It should not call `PluginManager.loadPlugins()`,
`processToolCall()`, or `executePlugin()`. It should not spawn
`AIGentOrchestrator.js`. It should not touch provider, downstream, LocalState,
server, image, or runtime cutover paths.

## 6. Proposed Future File-Change Map

### Plugin.js

Why it may need a future change:

- It contains `_evaluateExternalPluginRuntimeRegistration()`, the candidate
  runtime registration policy seam.
- It currently calls `evaluateExternalPluginAllowPolicy()`.
- It decides whether an external plugin manifest can be registered.

Possible future change:

- Call a pure Jenn exact-path resolver/helper from
  `_evaluateExternalPluginRuntimeRegistration()`.
- Consume the helper's bounded decision and evidence.
- Fail closed when the helper blocks, returns ambiguous evidence, or detects a
  forbidden boundary.

What must remain forbidden:

- Do not use this path to call `loadPlugins()` as a proof.
- Do not enter `processToolCall()`.
- Do not enter `executePlugin()`.
- Do not spawn plugin processes.
- Do not call providers, dispatch downstream, write LocalState, activate server
  routes, generate images, or perform runtime cutover.

### modules/pluginRootResolver.js

Why it may need a future change:

- It resolves core and external plugin roots from `VCP_PLUGIN_DIRS` and
  `VCP_PLUGIN_ALLOWED_ROOTS`.
- It currently works at external root level, not exact Jenn plugin path level.

Possible future change:

- Add or expose a narrow read-only helper for exact external plugin path
  normalization and comparison, only if Gate 68 design needs this placement.

What must remain forbidden:

- Do not accept broad root, package-root, LocalState-root, name-only, or
  wildcard Jenn allowlists.
- Do not treat core fallback as success.
- Do not trigger root discovery reloads or watcher behavior for proof.

### modules/externalPluginAllowPolicy.js

Why it may need a future change:

- It parses and evaluates external plugin allow policy entries.
- Its generic policy currently permits inside-or-equal source directory matches.
- Jenn requires exact sealed path matching.

Possible future change:

- Add a strict exact-path policy helper or Jenn-specific bounded adapter while
  preserving existing generic policy behavior.

What must remain forbidden:

- Do not weaken existing wildcard, missing-source, broad-root, or invalid-entry
  rejection.
- Do not permit name-only, package-root, or LocalState-root Jenn allowlists.
- Do not make exact Jenn behavior apply silently to unrelated plugins.

### Optional harness/proof script

Why it may need a future change:

- A later Gate 69 may need a bounded static proof or harness proof for the
  implemented runtime integration.

Possible future change:

- Add a proof command only if a later task book authorizes it.
- The proof should inspect the helper and integration decision without invoking
  runtime execution.

What must remain forbidden:

- Do not run Stage 1 / 2 / 3 / 4 as part of Gate 67.
- Do not spawn `AIGentOrchestrator.js`.
- Do not call `processToolCall()`, `PluginManager.loadPlugins()`, or
  `executePlugin()`.

## 7. Runtime Registration Policy Design

A future implementation should integrate at:

```text
Plugin.js::_evaluateExternalPluginRuntimeRegistration()
```

The integration should happen before any execution handoff and before the
external Jenn manifest can be accepted as a runtime registration success.

The integration should fail closed on ambiguity:

- missing allowlist
- invalid allowlist
- unresolved path
- path mismatch
- manifest read failure
- manifest identity mismatch
- possible core fallback
- ambiguous plugin source
- missing required evidence field
- any sign of execution handoff

The integration must not enter `PluginManager.loadPlugins()` as part of the
bounded resolver/helper. If the policy is reached during normal production
loading in a later implementation, tests and proof must isolate the policy
decision from full runtime loading behavior.

The integration must not enter `processToolCall()`.

The integration must not enter `executePlugin()`.

The integration must not trigger provider behavior.

The integration must not dispatch downstream plugins.

The integration must not write LocalState.

The integration must not activate server routes.

The integration must not generate images.

The integration must not authorize runtime cutover.

## 8. Evidence Model For Future Implementation

The future bounded runtime integration proof may prove only:

- `exactAllowlistParsed: true`
- `externalPathResolved: true`
- `resolvedPathIsExternalPackagePath: true`
- `manifestIdentityMatched: true`
- `coreFallback: false`
- `executionHandoff: false during resolution`
- `pluginManagerLoadPluginsInvoked: false during resolution`
- `processToolCallInvoked: false during resolution`
- `executePluginInvoked: false during resolution`
- `providerCalls: false during resolution`
- `downstreamDispatch: false during resolution`
- `localStateWrites: false during resolution`
- `serverRouteActivation: false during resolution`
- `imageGeneration: false during resolution`
- `runtimeCutover: false`

The evidence must not be represented as provider validation, downstream
validation, LocalState validation, server route readiness, real image generation
readiness, or runtime cutover readiness.

## 9. Failure Model

The future design must require fail-closed behavior for:

- missing allowlist
- broad allowlist
- wildcard allowlist
- name-only allowlist
- package-root allowlist
- LocalState-root allowlist
- path mismatch
- manifest missing
- manifest identity mismatch
- core fallback possibility
- ambiguous plugin source
- execution handoff during resolution
- `PluginManager.loadPlugins()` crossing during resolution
- `processToolCall()` crossing during resolution
- `executePlugin()` crossing during resolution
- provider touch during resolution
- downstream touch during resolution
- LocalState touch during resolution
- server touch during resolution
- image touch during resolution

Any missing, ambiguous, stale, or non-deterministic evidence must block.

## 10. Future Proof Plan

Gate 68:

- bounded runtime integration implementation
- no provider validation
- no runtime cutover unless separately authorized by a later task book

Gate 69:

- bounded static proof or harness proof for the implemented runtime integration
- proof must remain limited to resolution and policy evidence
- proof must not call providers or perform runtime cutover

Later separate gate:

- provider validation
- must remain separately authorized

Later separate gate:

- runtime cutover
- must remain separately authorized

Gate 67 starts none of these future gates.

## 11. Non-Goals

Gate 67 is not implementation.

Gate 67 is not runtime integration.

Gate 67 is not runtime execution.

Gate 67 is not a runtime dry-run.

Gate 67 is not harness execution.

Gate 67 is not provider validation.

Gate 67 is not downstream validation.

Gate 67 is not LocalState validation.

Gate 67 is not server route activation.

Gate 67 is not real image generation validation.

Gate 67 is not runtime cutover.

## 12. Evidence Limits

Stage 1 / 2 / 3 evidence remains bounded evidence only.

Gate 63 evidence remains design evidence only.

Gate 64 evidence remains implementation evidence only.

Gate 65 evidence remains harness-only resolution guard execution evidence only.

Gate 66 evidence remains source-review evidence only.

Gate 67 evidence is design evidence only.

None of these are provider validation.

None of these are runtime cutover.

## 13. Classification

BOUNDED_RUNTIME_INTEGRATION_DESIGN_READY

The design is ready because it defines a narrow future exact-path resolver/helper
called only by the runtime registration policy path, preserves exact allowlist,
external path, manifest identity, and core fallback guardrails, rejects unsafe
runtime seams, and defers implementation, proof execution, provider validation,
and runtime cutover to separately authorized later gates.

## 14. Recommendation

RECOMMEND_GATE_68_BOUNDED_RUNTIME_INTEGRATION_IMPLEMENTATION

Gate 68 must remain separately authorized.

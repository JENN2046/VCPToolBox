# Gate 66 | AIGentOrchestrator Bounded Runtime Integration Source Review

## 1. Route Identity

Route Segment 66-66R.

Gate name:

```text
AIGentOrchestrator Bounded Runtime Integration Source Review
```

## 2. Baseline

Latest sealed route:

```text
Route Segment 65-65R
```

Core HEAD before review:

```text
0d9dd97f9a2f6467c642eb7b94c425e55334cbbe
```

Core origin/main before review:

```text
0d9dd97f9a2f6467c642eb7b94c425e55334cbbe
```

External HEAD before review:

```text
f7772c654c2d8d34698f2818fde02ec63df783cb
```

External origin/main before review:

```text
f7772c654c2d8d34698f2818fde02ec63df783cb
```

Core worktree before review:

```text
clean
```

External worktree before review:

```text
clean
```

## 3. Files Reviewed

### Plugin.js

Why reviewed:

- It is the production plugin manager source.
- It imports `createPluginRootResolver` and `evaluateExternalPluginAllowPolicy`.
- It contains plugin discovery, registration, execution handoff, process spawn,
  watcher, and hot-reload boundaries.

Relevant findings:

- `PluginManager` constructs `pluginRootResolver` in the constructor.
- `_discoverLegacyPluginManifests()` obtains a root snapshot and iterates
  `legacyLoadRoots`.
- `_registerLocalPlugin()` calls `_evaluateExternalPluginRuntimeRegistration()`
  before adding a manifest to `this.plugins`.
- `_evaluateExternalPluginRuntimeRegistration()` is the narrowest existing
  runtime registration policy point for external plugin manifests.
- `_evaluateExternalPluginRuntimeRegistration()` already rejects external
  same-process direct and hybridservice runtime registration.
- `loadPlugins()` is not resolver-only. It clears local runtime maps, discovers
  modern and legacy manifests, registers modules, loads direct modules with
  `require()`, initializes modules, rebuilds descriptions, and emits
  `tools_changed`.
- `processToolCall()` is the execution handoff boundary.
- `executePlugin()` prepares runtime env and spawns a plugin process.
- `hotReloadPluginsAndOrder()` and manifest watcher paths can call
  `loadPlugins()`.

Proposed for later implementation change:

- Yes, but only after a separate design RFC.
- Candidate change location: `_evaluateExternalPluginRuntimeRegistration()` or
  a new pure helper it calls.
- The future change must not be designed as a broad `loadPlugins()` proof.

Edited in Gate 66:

```text
no
```

### modules/externalPluginAllowPolicy.js

Why reviewed:

- It parses and evaluates external plugin runtime allow policy entries.
- It is the existing source boundary for explicit plugin-name plus source path
  allow decisions.

Relevant findings:

- `parsePolicyEntry()` requires `pluginName@sourceDirectory`.
- It rejects wildcard entries.
- It rejects dot-only and filesystem-root source directories.
- `evaluateExternalPluginAllowPolicy()` returns `would_allow` only when an
  external manifest has a concrete plugin name, a real base path, no invalid
  policy errors, a same-name policy entry, and a matching source directory.
- Matching uses `isPathInsideOrEqual()`, so a future Jenn integration must
  decide whether equality to the sealed plugin path is required instead of
  accepting broader parent directories.
- The module does not by itself encode the sealed Jenn path, manifest identity
  check, core fallback denial, or LocalState-root denial.

Proposed for later implementation change:

- Possibly. A future design may add a strict exact-path policy helper or a
  Jenn-specific bounded adapter while preserving existing generic behavior.

Edited in Gate 66:

```text
no
```

### modules/pluginRootResolver.js

Why reviewed:

- It resolves core and external plugin roots from environment configuration.
- It builds the `legacyLoadRoots` consumed by `Plugin.js`.

Relevant findings:

- `VCP_PLUGIN_DIRS` supplies external legacy roots.
- `VCP_PLUGIN_ALLOWED_ROOTS` is required before external roots are accepted.
- External roots are rejected when equal to project root, inside `.git`, inside
  `node_modules`, or outside allowed roots.
- The resolver works at root level, not exact plugin identity level.
- It does not validate `JennAIGentOrchestrator` manifest identity.
- It does not deny core `Plugin/AIGentOrchestrator` fallback for the Jenn
  integration contract.

Proposed for later implementation change:

- Possibly, but not as the primary execution point. A future design may add a
  read-only exact external plugin path resolver that can be called before broad
  root discovery or registration.

Edited in Gate 66:

```text
no
```

### scripts/run-jenn-aigent-orchestrator-no-provider-runtime-harness.js

Why reviewed:

- It contains the sealed Stage 1 / 2 / 3 / 4 evidence paths.
- Stage 4 models the intended exact allowlist, external path, manifest identity,
  and no-execution boundary.

Relevant findings:

- Stage 4 parses the sealed exact allowlist:
  `JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator`.
- Stage 4 rejects wildcard, name-only, package-root, LocalState-root, and core
  fallback paths.
- Stage 4 checks the manifest under the resolved external path and verifies
  `manifest.name === JennAIGentOrchestrator`.
- Stage 4 emits fixed false values for execution handoff,
  `PluginManager.loadPlugins`, `processToolCall`, provider calls, downstream
  dispatch, LocalState writes, server route activation, image generation, and
  runtime cutover.
- Stage 2 contains the direct `spawn('node', ['AIGentOrchestrator.js'])` path
  and must remain outside Gate 66.
- Gate 66 did not run any harness command.

Proposed for later implementation change:

- No direct script change in the next design gate. The Stage 4 algorithm is
  source-review evidence for a future pure runtime guard design.

Edited in Gate 66:

```text
no
```

### docs/governance/GATE_63_AIGENT_ORCHESTRATOR_HARNESS_ONLY_RESOLUTION_GUARD_DESIGN_RFC.md

Why reviewed:

- It records the sealed design rationale and block policy for the Stage 4 guard.

Relevant findings:

- It states `PluginManager.loadPlugins()` is too broad for resolver-only proof.
- It states `processToolCall()` is the execution handoff boundary.
- It defines the exact external plugin path and exact allowlist.
- It requires provider, downstream, LocalState, server, image, and runtime
  cutover paths to remain off.

Proposed for later implementation change:

```text
no
```

Edited in Gate 66:

```text
no
```

### docs/governance/GATE_65_AIGENT_ORCHESTRATOR_HARNESS_ONLY_RESOLUTION_GUARD_EXECUTION_PROOF.md

Why reviewed:

- It records the sealed PASS result for the Stage 4 guard execution proof.

Relevant findings:

- Stage 4 emitted `PASS`.
- Stage 4 emitted `HARNESS_ONLY_RESOLUTION_GUARD_PASS`.
- Stage 4 proved exact allowlist parsing, external path resolution, manifest
  identity matching, and core fallback false.
- Stage 4 proved no execution handoff, no `PluginManager.loadPlugins`, no
  `processToolCall`, no provider calls, no downstream dispatch, no LocalState
  writes, no server route activation, no image generation, and no runtime
  cutover.

Proposed for later implementation change:

```text
no
```

Edited in Gate 66:

```text
no
```

## 4. Runtime Integration Seam Findings

### Candidate Seam A: external runtime registration policy point

Location:

```text
Plugin.js::_evaluateExternalPluginRuntimeRegistration()
```

Why it is the best existing candidate:

- It receives a parsed manifest before external registration is accepted.
- It already distinguishes external manifests from core manifests.
- It already calls `evaluateExternalPluginAllowPolicy()`.
- It already blocks external same-process direct and hybridservice registration.
- It decides whether an external manifest is allowed or blocked before
  `_registerLocalPlugin()` adds it to `this.plugins`.

Safety assessment:

- This is a registration policy seam, not an execution seam.
- It does not by itself call `processToolCall()`.
- It does not by itself spawn `AIGentOrchestrator.js`.
- It must still be treated carefully because it is normally reached inside
  `loadPlugins()`, which has broader side effects.

Required future guardrails:

- Require exact `JennAIGentOrchestrator@<sealed external plugin path>` policy.
- Require resolved path equality to the sealed external plugin path.
- Require `plugin-manifest.json` identity `JennAIGentOrchestrator`.
- Deny core `Plugin/AIGentOrchestrator` fallback.
- Deny wildcard, name-only, package-root, and LocalState-root allowlists.
- Keep `processToolCall()` and `executePlugin()` outside the resolution proof.

### Candidate Seam B: pure exact-path resolver helper

Location:

```text
new helper, likely called by Plugin.js::_evaluateExternalPluginRuntimeRegistration()
```

Why it is safe if designed narrowly:

- It can reuse the Stage 4 algorithm shape without entering runtime execution.
- It can parse allowlist text, resolve one exact external path, read one
  manifest, and return a decision object.
- It can be unit-tested without `loadPlugins()`, `processToolCall()`, provider
  calls, downstream dispatch, LocalState writes, server activation, image
  generation, or runtime cutover.

Safety assessment:

- This is the preferred future design direction.
- Gate 67 should decide the helper's exact module placement, API shape,
  evidence fields, and tests.

### Unsafe Seam: PluginManager.loadPlugins()

Why rejected:

- It clears runtime maps.
- It discovers all configured roots.
- It requires direct modules.
- It initializes modules.
- It rebuilds descriptions.
- It emits runtime change events.
- It can be triggered by hot reload and watcher paths.

Boundary assessment:

- `PluginManager.loadPlugins()` would be crossed if a future proof calls it.
- Gate 66 does not recommend proving resolution by calling it.

### Unsafe Seam: PluginManager.processToolCall()

Why rejected:

- It is the tool execution handoff boundary.
- It can call direct service `processToolCall()`, distributed execution, or
  local stdio execution.

Boundary assessment:

- `processToolCall()` would cross execution handoff.
- Gate 66 does not recommend crossing this boundary for resolution integration.

### Unsafe Seam: PluginManager.executePlugin()

Why rejected:

- It builds runtime environment and spawns the plugin entrypoint command.
- It can pass request context, callback data, and runtime env to a plugin
  process.

Boundary assessment:

- `executePlugin()` would cross runtime execution and spawn boundaries.
- Gate 66 does not recommend crossing this boundary.

## 5. Guardrail Findings

Exact allowlist requirement:

- Required. Future integration must require exact `pluginName@absolutePath`
  for `JennAIGentOrchestrator`.

External path requirement:

- Required. Future integration must resolve to:
  `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator`.

Manifest identity requirement:

- Required. Future integration must read the external manifest and require
  `name` to equal `JennAIGentOrchestrator`.

Core fallback denial:

- Required. Any resolution to
  `A:\AGENTS_OS_Workspace\runtime\VCPToolBox\Plugin\AIGentOrchestrator`
  must block.

Execution handoff boundary:

- Must remain closed during resolution review, design, and future preflight.

PluginManager.loadPlugins boundary:

- Must not be used as a resolver-only proof path.
- If a later implementation integrates inside runtime registration, the design
  must distinguish policy decision tests from full runtime load behavior.

processToolCall boundary:

- Must remain closed. Resolution does not require tool execution.

Provider boundary:

- Must remain closed. Resolution must not call providers.

Downstream boundary:

- Must remain closed. Resolution must not dispatch downstream plugins.

LocalState boundary:

- Must remain closed. Resolution must not write LocalState or accept
  LocalState-root allowlists.

Server route boundary:

- Must remain closed. Resolution must not activate server routes.

Image generation boundary:

- Must remain closed. Resolution must not generate real images.

Runtime cutover boundary:

- Must remain closed until a separate later gate explicitly authorizes it.

## 6. Recommended Future Path

Gate 66 recommends a future design RFC only.

The next gate should specify:

- exact helper or module placement
- exact policy input
- exact manifest identity checks
- exact core fallback block behavior
- evidence fields
- tests that do not call `loadPlugins()`, `processToolCall()`, providers,
  downstream dispatch, LocalState, server routes, image generation, or runtime
  cutover
- how any later implementation would integrate with
  `_evaluateExternalPluginRuntimeRegistration()` without widening execution
  power

Required next recommendation:

```text
RECOMMEND_GATE_67_BOUNDED_RUNTIME_INTEGRATION_DESIGN_RFC
```

## 7. Non-Goals

Gate 66 is not implementation.

Gate 66 is not runtime integration.

Gate 66 is not runtime execution.

Gate 66 is not a runtime dry-run.

Gate 66 is not provider validation.

Gate 66 is not downstream validation.

Gate 66 is not LocalState validation.

Gate 66 is not server route activation.

Gate 66 is not real image generation validation.

Gate 66 is not runtime cutover.

## 8. Evidence Limits

Stage 1 / 2 / 3 evidence remains bounded evidence only.

Gate 63 evidence remains design evidence only.

Gate 64 evidence remains implementation evidence only.

Gate 65 evidence remains harness-only resolution guard execution evidence only.

None of these are provider validation.

None of these are runtime cutover.

## 9. Classification

BOUNDED_RUNTIME_INTEGRATION_SOURCE_REVIEW_READY

The source review is ready because the relevant runtime registration, allowlist,
root resolution, harness guard, and sealed governance evidence were reviewed
without implementation, runtime execution, provider calls, downstream dispatch,
LocalState writes, server route activation, image generation, or runtime cutover.

## 10. Recommendation

RECOMMEND_GATE_67_BOUNDED_RUNTIME_INTEGRATION_DESIGN_RFC

Gate 67 must remain separately authorized.

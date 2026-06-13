# Gate 70 | AIGentOrchestrator Bounded No-Provider Runtime Registration Dry-Run Design RFC

## 1. Route Identity

Route Segment:

```text
Route Segment 70-70R
```

Gate name:

```text
AIGentOrchestrator Bounded No-Provider Runtime Registration Dry-Run Design RFC
```

## 2. Baseline

Latest sealed route:

```text
Route Segment 69-69R
```

Core HEAD before design:

```text
4315739272066324fa6fed8557a21bdab59c70c7
```

Core origin/main before design:

```text
4315739272066324fa6fed8557a21bdab59c70c7
```

Core worktree before design:

```text
clean
```

Core ahead/behind before design:

```text
0 / 0
```

External HEAD before design:

```text
f7772c654c2d8d34698f2818fde02ec63df783cb
```

External origin/main before design:

```text
f7772c654c2d8d34698f2818fde02ec63df783cb
```

External worktree before design:

```text
clean
```

External ahead/behind before design:

```text
0 / 0
```

## 3. Design Scope

Gate 70 is design only.

Gate 70 does not implement the no-provider runtime registration dry-run.

Gate 70 does not execute a runtime dry-run.

Gate 70 does not execute runtime.

Gate 70 does not execute any harness mode.

Gate 70 does not validate providers.

Gate 70 does not start or authorize runtime cutover.

Gate 70 does not edit `Plugin.js`, `modules/**`, `scripts/**`, `Plugin/**`,
package manifests, external package files, or LocalState.

## 4. Prior Evidence Basis

Gate 66 source-review basis:

- `Plugin.js::_evaluateExternalPluginRuntimeRegistration()` is the narrow
  runtime registration policy seam for external plugin manifests.
- `PluginManager.loadPlugins()` is too broad for resolver-only or dry-run proof
  because it clears runtime maps, discovers roots, registers modules,
  initializes modules, rebuilds descriptions, and emits runtime change events.
- `processToolCall()` is the execution handoff boundary.
- `executePlugin()` prepares runtime environment and can spawn a plugin process.
- Hot reload and watcher paths are rejected as dry-run proof seams because they
  can call `loadPlugins()`.

Gate 67 design basis:

- The future integration should use a pure exact-path resolver/helper called
  from the registration policy path.
- The exact target plugin is `JennAIGentOrchestrator`.
- The exact external target path is:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

- The core fallback path that must remain denied is:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\Plugin\AIGentOrchestrator
```

- Provider, downstream, LocalState, server, image, execution handoff, and
  runtime cutover boundaries must remain closed.

Gate 68 implementation basis:

- Gate 68 implemented bounded runtime integration in `Plugin.js` and
  `modules/externalPluginAllowPolicy.js`.
- The implemented seam is:

```text
Plugin.js::_evaluateExternalPluginRuntimeRegistration()
```

- The implemented helper is:

```text
evaluateExactExternalPluginResolution
```

- The helper implements exact allowlist, exact external path, manifest identity,
  core fallback denial, and fail-closed behavior.
- Gate 68 did not run runtime, validate providers, or start runtime cutover.

Gate 69 proof basis:

- Gate 69 proved the Gate 68 implementation by static inspection and bounded
  module-level proof only.
- Positive exact-path proof returned:

```text
decision = would_allow
```

- Required negative fail-closed cases passed.
- Gate 69 did not instantiate `PluginManager`, call `loadPlugins()`, call
  `processToolCall()`, call `executePlugin()`, spawn `AIGentOrchestrator.js`,
  call providers, dispatch downstream, write LocalState, activate server routes,
  generate images, validate providers, or start runtime cutover.

Gate 70 is the next dry-run design layer because Gate 69 proved only static and
module-level evidence. Gate 70 designs a future bounded runtime-registration
dry-run, but it is not provider validation and not runtime cutover.

## 5. Proposed Future Dry-Run Architecture

A future Gate 71 or later may add a no-provider dry-run command or harness mode
bounded to runtime registration policy evaluation.

The future dry-run should:

- construct or load only the minimal manifest/classification inputs needed to
  evaluate `JennAIGentOrchestrator` external runtime registration policy
  evidence
- enter only a dry-run-safe registration-policy surface for:

```text
Plugin.js::_evaluateExternalPluginRuntimeRegistration()
```

- call or reuse the exact resolver/helper:

```text
evaluateExactExternalPluginResolution
```

- use exact allowlist parsing for:

```text
JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

- require exact external path resolution to:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

- require manifest identity:

```text
manifest.name === "JennAIGentOrchestrator"
```

- deny core fallback to:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\Plugin\AIGentOrchestrator
```

- record bounded evidence fields
- exit before any execution handoff
- fail closed on missing, ambiguous, invalid, or boundary-crossing evidence

The future dry-run must not:

- execute the plugin
- spawn `AIGentOrchestrator.js`
- call `PluginManager.loadPlugins()`
- call `processToolCall()`
- call `executePlugin()`
- call providers
- dispatch downstream
- write LocalState
- activate server routes
- generate real images
- perform runtime cutover

## 6. Proposed Command Shape

Future command shape, design only:

```powershell
node scripts/run-jenn-aigent-orchestrator-no-provider-runtime-harness.js --stage5-bounded-no-provider-runtime-registration-dry-run
```

Gate 70 does not implement this command.

Gate 70 does not execute this command.

The proposed Stage 5 mode is reserved for a later separately authorized
implementation gate.

## 7. Future Proof Evidence Model

The future dry-run may prove only these fields:

```json
{
  "stage": "stage5-bounded-no-provider-runtime-registration-dry-run",
  "result": "PASS or FAIL",
  "classification": "BOUNDED_NO_PROVIDER_RUNTIME_REGISTRATION_DRY_RUN_PASS or BOUNDED_NO_PROVIDER_RUNTIME_REGISTRATION_DRY_RUN_BLOCKED",
  "exactAllowlistParsed": true,
  "externalPathResolved": true,
  "resolvedPathIsExternalPackagePath": true,
  "manifestIdentityMatched": true,
  "coreFallback": false,
  "runtimeRegistrationPolicyEvaluated": true,
  "executionHandoff": false,
  "pluginManagerLoadPluginsInvoked": false,
  "processToolCallInvoked": false,
  "executePluginInvoked": false,
  "providerCalls": false,
  "downstreamDispatch": false,
  "localStateWrites": false,
  "serverRouteActivation": false,
  "imageGeneration": false,
  "runtimeCutover": false
}
```

The evidence model must not include provider response content, downstream
plugin output, LocalState data, server route activation evidence, real image
generation output, or runtime cutover readiness.

## 8. Required Future Positive Proof Expectation

Future dry-run PASS must require:

- `exactAllowlistParsed: true`
- `externalPathResolved: true`
- `resolvedPathIsExternalPackagePath: true`
- `manifestIdentityMatched: true`
- `coreFallback: false`
- `runtimeRegistrationPolicyEvaluated: true`
- `executionHandoff: false`
- `pluginManagerLoadPluginsInvoked: false`
- `processToolCallInvoked: false`
- `executePluginInvoked: false`
- `providerCalls: false`
- `downstreamDispatch: false`
- `localStateWrites: false`
- `serverRouteActivation: false`
- `imageGeneration: false`
- `runtimeCutover: false`

All fields must be explicit. Missing or inferred values must block.

## 9. Required Future Negative Cases

Future dry-run must fail closed for:

- missing allowlist entry
- wildcard allowlist
- name-only allowlist
- package-root allowlist
- LocalState-root allowlist
- path mismatch
- core fallback possibility
- manifest missing
- manifest identity mismatch
- ambiguous plugin source
- any execution handoff
- any `PluginManager.loadPlugins()` crossing
- any `processToolCall()` crossing
- any `executePlugin()` crossing
- any provider touch
- any downstream touch
- any LocalState touch
- any server touch
- any image touch
- any runtime cutover attempt

Broad, wildcard, name-only, package-root, or LocalState-root allowlists must not
be accepted as passing evidence.

## 10. No-Provider Boundary Design

The future dry-run must not require provider credentials.

The future dry-run must not read or print tokens.

The future dry-run must not read or print raw authorization headers.

The future dry-run must not depend on provider availability.

The future dry-run must not contact provider endpoints.

The future dry-run must not treat no-provider dry-run success as provider
validation.

Provider validation remains a later separately authorized route.

## 11. Runtime-Registration Boundary Design

The future dry-run may enter only the narrow registration-policy seam or a
dry-run-safe helper that exactly models that seam:

```text
Plugin.js::_evaluateExternalPluginRuntimeRegistration()
```

The future dry-run must exit before execution handoff.

The future dry-run must not instantiate or invoke plugin execution.

The future dry-run must not enter `PluginManager.loadPlugins()`.

The future dry-run must not enter `processToolCall()`.

The future dry-run must not enter `executePlugin()`.

The future dry-run must not activate server routes.

The future dry-run must not write LocalState.

If a later implementation needs a dry-run-safe private helper, that helper must
return policy evidence only and must not mutate plugin maps, initialize modules,
emit runtime events, spawn processes, or perform network/provider operations.

## 12. Future Implementation Map

### scripts/run-jenn-aigent-orchestrator-no-provider-runtime-harness.js

Why it may need a future change:

- It is the existing bounded Jenn no-provider harness location.
- It already contains sealed Stage 1 / 2 / 3 / 4 evidence modes.
- A future Stage 5 command can keep dry-run proof entrypoints in one governed
  harness file.

Possible future change type:

- Add `--stage5-bounded-no-provider-runtime-registration-dry-run`.
- Emit the bounded evidence model defined in this RFC.
- Ensure the mode cannot call Stage 1 / 2 / 3 / 4 commands unless separately
  authorized.

What must remain forbidden:

- Do not spawn `AIGentOrchestrator.js`.
- Do not call `PluginManager.loadPlugins()`.
- Do not call `processToolCall()`.
- Do not call `executePlugin()`.
- Do not call providers, dispatch downstream, write LocalState, activate server
  routes, generate images, or start runtime cutover.

### Plugin.js

Why it may need a future change:

- `_evaluateExternalPluginRuntimeRegistration()` is the runtime registration
  policy seam.
- A later dry-run may need a dry-run-safe private helper to evaluate only the
  policy portion without entering full plugin loading.

Possible future change type:

- Add or expose a narrow private policy-evaluation helper only if the harness
  cannot safely prove registration policy by calling existing pure helpers.
- The helper should accept bounded manifest/classification inputs and return
  policy evidence only.

What must remain forbidden:

- Do not change execution dispatch semantics.
- Do not call or require `PluginManager.loadPlugins()` for Stage 5 proof.
- Do not enter `processToolCall()` or `executePlugin()`.
- Do not register, initialize, execute, or spawn plugins.
- Do not weaken external runtime registration denial behavior.
- Do not make core fallback executable.

### modules/externalPluginAllowPolicy.js

Why it may need a future change:

- It contains `evaluateExactExternalPluginResolution`, the bounded exact-path
  resolver/helper.
- A future dry-run may need an additional explicit evidence field such as
  `runtimeRegistrationPolicyEvaluated`.

Possible future change type:

- Add bounded evidence export only if needed for Stage 5 proof.
- Preserve current exact allowlist, exact path, manifest identity, core fallback
  denial, and fail-closed behavior.

What must remain forbidden:

- Do not allow wildcard, name-only, package-root, or LocalState-root allowlists
  as passing evidence.
- Do not add fuzzy matching or display-name matching.
- Do not treat command identifiers as plugin aliases.
- Do not read secrets or provider credentials.

## 13. Future Route Plan

Gate 71:

- bounded no-provider runtime registration dry-run implementation
- no execution
- no provider validation
- no runtime cutover

Gate 72:

- bounded no-provider runtime registration dry-run execution proof
- must execute only the bounded Stage 5 dry-run mode if Gate 71 implements it
- must not execute plugin runtime or providers
- must not start runtime cutover

Later separate gate:

- provider validation design

Later separate gate:

- provider validation execution

Later separate gate:

- runtime cutover design

Later separate gate:

- runtime cutover execution

Gate 70 starts none of these future gates.

## 14. Non-Goals

Gate 70 is not implementation.

Gate 70 is not runtime dry-run execution.

Gate 70 is not runtime execution.

Gate 70 is not harness execution.

Gate 70 is not plugin execution.

Gate 70 is not provider validation.

Gate 70 is not downstream validation.

Gate 70 is not LocalState validation.

Gate 70 is not server route activation.

Gate 70 is not real image generation validation.

Gate 70 is not runtime cutover.

## 15. Evidence Limits

Stage 1 / 2 / 3 evidence remains bounded evidence only.

Gate 63 evidence remains design evidence only.

Gate 64 evidence remains implementation evidence only.

Gate 65 evidence remains harness-only resolution guard execution evidence only.

Gate 66 evidence remains source-review evidence only.

Gate 67 evidence remains design evidence only.

Gate 68 evidence remains implementation evidence only.

Gate 69 evidence remains static/module-level proof evidence only.

Gate 70 evidence is dry-run design evidence only.

None of these are provider validation.

None of these are runtime cutover.

## 16. Classification

```text
BOUNDED_NO_PROVIDER_RUNTIME_REGISTRATION_DRY_RUN_DESIGN_READY
```

The design is ready because it defines a bounded no-provider future dry-run
architecture that stays inside registration policy evidence, records exact
allowlist, exact external path, manifest identity, core fallback denial, and
closed execution/provider/downstream/LocalState/server/image/runtime cutover
boundaries, and defers implementation and execution to separate future gates.

## 17. Recommendation

```text
RECOMMEND_GATE_71_BOUNDED_NO_PROVIDER_RUNTIME_REGISTRATION_DRY_RUN_IMPLEMENTATION
```

Gate 71 must remain separately authorized.

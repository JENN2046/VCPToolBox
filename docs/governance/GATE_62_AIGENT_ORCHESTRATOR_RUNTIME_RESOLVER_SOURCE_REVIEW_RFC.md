# Gate 62 | AIGentOrchestrator Runtime Resolver Source Review RFC

## 1. Status

Status: ready for review, source review only.

Gate 62 reviews runtime resolver and PluginManager source surfaces.

Gate 62 does not modify runtime source.

Gate 62 does not modify the harness.

Gate 62 does not modify baseline checks.

Gate 62 does not execute the harness.

Gate 62 does not rerun Stage 3.

Gate 62 does not execute a runtime resolver probe.

Gate 62 does not execute a runtime dry-run.

Gate 62 does not invoke processToolCall.

Gate 62 does not execute PluginManager.loadPlugins.

Gate 62 does not call providers.

Gate 62 does not dispatch downstream plugins.

Gate 62 does not write LocalState.

Gate 62 does not activate server routes.

Gate 62 does not perform real image generation.

Gate 62 does not authorize runtime cutover.

Gate 62 does not modify Plugin files, modules, scripts, server routes, or
external package files.

Gate 62 does not start Gate 63.

## 2. Sealed Inputs

Current core HEAD:

```text
6d2ec93dd86fdb9bcd7ce2299a15021cdbb6a600
```

Current external HEAD:

```text
f7772c654c2d8d34698f2818fde02ec63df783cb
```

Stage 1 external identity proof: sealed.

Stage 2 direct stdio no-provider probe: sealed.

Stage 3 bounded runtime resolution proof: sealed.

Old broad Gate 52 remains blocked and must not be reused as-is.

## 3. Reviewed Source Surfaces

Gate 62 reviewed these core source surfaces read-only:

```text
Plugin.js
modules/pluginRootResolver.js
modules/externalPluginAllowPolicy.js
modules/externalPluginSafetyGate.js
tests/externalPluginAllowPolicy.test.js
tests/plugin-external-dirs.test.js
tests/plugin-external-runtime-registration-gate.test.js
tests/plugin-external-runtime-direct-policy.test.js
docs/JENN_EXTERNAL_RUNTIME_ALLOWLIST_CONTRACT.md
```

No source file was modified by this review.

## 4. Allowlist Parsing Source

Allowlist parsing is implemented in:

```text
modules/externalPluginAllowPolicy.js
```

Relevant source functions:

- `splitPolicyEntries`
- `parsePolicyEntry`
- `parseExternalPluginAllowPolicy`
- `evaluateExternalPluginAllowPolicy`

The parser requires `pluginName@sourceDirectory`.

The parser rejects name-only entries.

The parser rejects path-only entries.

The parser rejects wildcard entries.

The parser rejects filesystem-root and dot-only broad source directories.

The evaluator requires an external plugin classification with matching plugin
name and matching real source directory before returning `would_allow`.

The evaluator uses fresh realpath checks for both source directory and plugin
base path.

## 5. Plugin Root And Path Resolution Source

External plugin root and path resolution is implemented in:

```text
modules/pluginRootResolver.js
```

Relevant source functions:

- `splitPathList`
- `uniqueByResolvedPath`
- `isSubPath`
- `realpathOrResolve`
- `realpathOrResolveSync`
- `getExternalLegacyRoots`
- `getPluginRootSnapshot`
- `discoverLegacyManifestRecordsFromRoot`
- `discoverAdminLegacyManifestRecords`

The resolver keeps core legacy roots first.

External legacy roots are default-off.

External legacy roots require `VCP_PLUGIN_ALLOWED_ROOTS`.

External legacy roots are rejected when unsafe, including project root, `.git`,
and `node_modules`.

Tests confirm the Jenn external package is discovered from the external
`Plugin` subdirectory and that `VCPToolBox-JENN-LocalState` is not a plugin
root.

## 6. Manifest Identity Source

Legacy manifest discovery is implemented in:

```text
Plugin.js
```

Relevant source functions:

- `_discoverLegacyPluginManifestsFromDir`
- `_discoverLegacyPluginManifests`

`_discoverLegacyPluginManifestsFromDir` reads:

```text
plugin-manifest.json
```

It populates manifest metadata including:

- `name`
- `pluginType`
- `entryPoint`
- `basePath`
- `pluginSource`
- `pluginRoot`
- `pluginRootId`
- `pluginRootDisplayPath`

The discovery function reads manifest JSON and does not execute stdio command
entrypoints by itself.

However, discovery alone is not the full runtime registration boundary.

## 7. Core Fallback Risk

Core fallback risk appears at two boundaries:

1. `pluginRootResolver.getPluginRootSnapshot()` returns core legacy roots before
   external legacy roots.
2. `PluginManager.loadPlugins()` registers core manifests before external
   manifests and skips duplicate plugin names.

This ordering protects built-in plugins from external same-name override, but it
also means a resolver-only proof must explicitly report whether the resolved
target came from the external path or a core fallback path.

Any future Jenn AIGentOrchestrator proof must keep this invariant explicit:

```text
core fallback used: false
```

## 8. PluginManager.loadPlugins Boundary

`PluginManager.loadPlugins()` is too broad for the next safe probe.

It performs runtime state changes:

- preserves distributed plugins
- shuts down local modules when available
- clears plugin maps and preprocessor state
- discovers modern and legacy manifests
- calls `_registerLocalPlugin`
- computes preprocessor order
- may initialize modules
- rebuilds VCP descriptions
- emits `tools_changed`

It may require or initialize direct modules through `_registerLocalPlugin` and
the later initialization loop.

Therefore, `PluginManager.loadPlugins()` must remain out of scope for the next
gate unless a future design proves a bounded, non-hanging resolver-only mode
that does not mutate runtime state or initialize plugins.

## 9. processToolCall Boundary

`PluginManager.processToolCall()` begins execution handoff.

It resolves tool arguments, performs approval handling, dispatches distributed
or direct tool paths, and calls stdio plugin execution through `executePlugin`
for local stdio plugins.

It is the wrong boundary for a resolver-only proof.

Any future resolver-only probe must report:

```text
processToolCall invoked: false
```

## 10. Existing Resolver-Only Path Finding

The reviewed source does not expose a single public runtime resolver-only API
that performs the exact Jenn external allowlist check, external path resolution,
manifest identity check, and core fallback check without also entering broad
runtime loading.

The reviewed source does provide safe pieces that can be inspected or reused by
a harness-only design:

- exact allow policy parsing and evaluation
- external root resolution helpers
- manifest metadata read behavior
- external safety classification
- tests that prove discovery and registration boundaries

The next safest path is therefore a harness-only resolution guard design that
mirrors or imports narrow exported helper modules, compares the result to
runtime source expectations, and still avoids broad `PluginManager.loadPlugins`.

## 11. Runtime Code Change Assessment

A bounded resolver probe does not require immediate runtime code changes if the
next gate remains harness-only.

Runtime source changes would be required only if a future gate wants an official
PluginManager resolver-only API.

That runtime-code path is not recommended as the immediate next gate because it
would expand the surface beyond evidence recording and harness-only guard
design.

## 12. Harness-Only Path Viability

A harness-only path is viable for the next design gate.

It can remain below runtime execution by:

- parsing the exact allowlist
- resolving the external plugin path
- reading manifest metadata only
- checking manifest identity
- checking core fallback false
- checking broad allowlists remain rejected
- checking no execution handoff occurs
- checking no PluginManager.loadPlugins call occurs
- checking no processToolCall call occurs
- emitting PASS/BLOCK receipt fields

The harness-only path must not claim provider validation or runtime cutover.

## 13. Stage 4 Boundary

Stage 4 should remain:

- no provider
- no downstream
- no LocalState
- no server route activation
- no real image generation
- no processToolCall execution
- no broad PluginManager.loadPlugins execution
- no PlanImagePipeline execution
- no runtime cutover

The next gate should design a harness-only resolution guard before any
implementation or execution.

## 14. Rollback Policy

Gate 62 is documentation-only.

Rollback is a normal revert of the Gate 62 RFC commit.

No runtime state rollback is required because Gate 62 does not modify runtime
source, execute the harness, run a runtime probe, call providers, dispatch
downstream plugins, write LocalState, activate server routes, perform image
generation, or modify external package files.

## 15. Classification

RESOLVER_SOURCE_REQUIRES_HARNESS_ONLY_PATH

The source review shows that existing runtime loading is broader than the next
safe proof boundary, but the harness can safely inspect or mirror the narrow
resolution evidence without runtime code changes.

## 16. Recommendation

RECOMMEND_GATE_63_HARNESS_ONLY_RESOLUTION_GUARD_DESIGN_RFC

Gate 63 must remain separately authorized.

Gate 63 should design a harness-only resolution guard.

Gate 63 must not implement or execute the guard unless a later task book
explicitly expands scope.

Gate 63 must not execute the harness, rerun Stage 3, run a runtime dry-run,
invoke processToolCall, execute PluginManager.loadPlugins, call providers,
dispatch downstream plugins, write LocalState, activate server routes, perform
real image generation, or start runtime cutover.

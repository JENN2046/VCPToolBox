# Gate 47 | AIGentOrchestrator Runtime Cutover Readiness Survey RFC

## 1. Status

Status: ready for review, not runtime cutover authorization.

Gate 47 is a readiness survey only.

Gate 47 does not authorize provider validation.
Gate 47 does not authorize downstream dispatch.
Gate 47 does not authorize LocalState writes.
Gate 47 does not modify PluginManager, resolver, allowlist, modules, server routes, or external package files.

## 2. Current evidence

Core HEAD:

```text
2dc029d06f2a02acc2c0c757cd0a79784bb40105
```

Core origin/main:

```text
2dc029d06f2a02acc2c0c757cd0a79784bb40105
```

External HEAD:

```text
f7772c654c2d8d34698f2818fde02ec63df783cb
```

External origin/main:

```text
f7772c654c2d8d34698f2818fde02ec63df783cb
```

External origin:

```text
https://github.com/JENN2046/VCPToolBox-JENN-Extensions
```

External tags:

```text
none
```

Core validation:

```powershell
node --check scripts/check-prod-baseline.js
npm run test:baseline
```

Cross-repo integrity guard:

```powershell
node --check scripts/check-jenn-aigent-orchestrator-copy-integrity.js
node scripts/check-jenn-aigent-orchestrator-copy-integrity.js
```

External validation:

```powershell
node --check scripts\check-jenn-static-no-provider.mjs
node scripts\check-jenn-static-no-provider.mjs
```

## 3. Runtime cutover surface

### Current core Plugin/AIGentOrchestrator references

The core plugin remains present at `Plugin/AIGentOrchestrator` with these tracked files:

- `AIGentOrchestrator.js`
- `README.md`
- `config.env.example`
- `plugin-manifest.json`

The core manifest name is `AIGentOrchestrator`.

The core manifest describes a dry-run orchestration planner that builds plans without invoking downstream plugins, generation workflows, training, or external services.

The core plugin exposes:

- `PlanImagePipeline`
- `PlanRetryPipeline`
- `HealthCheck`

The core config keeps `AIGENT_ORCHESTRATOR_ALLOW_EXECUTION` defaulted to `false`.

### External Plugin/JennAIGentOrchestrator availability

The external package contains `Plugin/JennAIGentOrchestrator` with matching source, config example, manifest contract, and README body as verified by the Gate 45 integrity guard.

The external target files are present:

- `AIGentOrchestrator.js`
- `README.md`
- `config.env.example`
- `plugin-manifest.json`

### Manifest identity differences

The manifest identity difference is intentional:

- core name: `AIGentOrchestrator`
- external name: `JennAIGentOrchestrator`

The external description identifies the package as a renamed Jenn external candidate and states execution remains disabled by governance policy until a future separately authorized gate.

No source/config divergence was found by the Gate 45 guard.

### README identity preface difference

The external README may include a `JennAIGentOrchestrator` identity preface.

The Gate 45 guard verifies the external README retains the normalized core README body while allowing the external preface / identity text only.

### PluginManager / processToolCall touchpoints

Runtime registration and execution remain owned by `PluginManager`.

The current runtime touchpoints include:

- `PluginManager` discovery and duplicate handling
- external runtime registration allowlist evaluation
- `_registerLocalPlugin`
- `processToolCall`
- stdio plugin execution through the manifest entry point

Gate 47 does not invoke `PluginManager.processToolCall`.

Gate 47 does not change PluginManager, resolver, allowlist, execution dispatch, or duplicate behavior.

### PlanImagePipeline assumptions

The documented no-provider dry-run boundary for a future runtime gate must keep:

- plugin identity: `JennAIGentOrchestrator`
- command: `PlanImagePipeline`
- `dryRun: true`
- `allowProvider: false`
- `allowDownstream: false`
- `allowExecution: false`

Gate 31D remains planner-only no-provider evidence, not provider validation.

`PlanRetryPipeline` and `HealthCheck` must not be used as fallback commands while claiming a `PlanImagePipeline` result.

### Allowlist requirements

Future no-provider runtime dry-run work must use the exact external runtime allowlist only:

```text
JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

Broad, wildcard, name-only, package-root, discovery-root, and LocalState-root allowlists remain outside the approved boundary.

### Provider/downstream/LocalState/server route risks

Provider risk: provider validation is still not authorized. Any provider call, provider credential use, provider URL use, real image generation, generated output, provider log, or provider cache write blocks the next gate.

Downstream risk: downstream dispatch validation is still not authorized. Any downstream plugin call or fallback dispatch blocks the next gate.

LocalState risk: LocalState writes are still not authorized. `VCPToolBox-JENN-LocalState` remains private state and not a plugin root.

Server route risk: server route activation is still not authorized. No admin route, runtime-to-review route, Plugin Store live operation, or server startup is authorized by this RFC.

## 4. Readiness conclusion

AIGentOrchestrator external copy integrity is guarded.

External package remote binding is complete.

Core baseline guards remain independent of external package filesystem availability.

Runtime cutover is still not authorized.

Provider validation is still not authorized.

Downstream dispatch validation is still not authorized.

LocalState writes are still not authorized.

No runtime blocker was found for preparing a later no-provider runtime dry-run plan, provided the later gate remains exact-allowlist, no-provider, no-downstream, no-LocalState, and receipt-driven.

## 5. Minimum future dry-run requirements

A future no-provider runtime dry-run gate must require:

- exact external runtime allowlist only:

```text
JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

- no wildcard allowlists
- no name-only allowlists
- no package-root allowlists
- no LocalState-root allowlists
- no provider calls
- no downstream dispatch
- no LocalState writes
- no server route activation
- no real image generation
- no package publish/release/deploy
- explicit receipt proving processToolCall path and dryRun/no-provider flags

## 6. Rollback / block policy

If future external runtime registration fails, block.

Do not fallback silently to core Plugin/AIGentOrchestrator while claiming external success.

Do not remove or mutate the core Plugin/AIGentOrchestrator source in the first runtime dry-run gate.

Do not delete external package files.

Do not change external remote or force-push.

Do not repair by merge/rebase/reset without a separate task book.

Provider validation requires a later separate explicit gate.

## 7. Recommended next gate

RECOMMEND_GATE_48_AIGENT_ORCHESTRATOR_NO_PROVIDER_RUNTIME_DRY_RUN_PLAN

Rationale: core and external validation passed, the Gate 45 integrity guard passed, external remote binding remains intact, no source/config divergence was found, and the survey found no required provider call, downstream dispatch, LocalState write, runtime code change, module change, server route activation, or external package edit for a future no-provider runtime dry-run planning gate.

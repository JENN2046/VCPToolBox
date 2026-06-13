# Gate 48 | AIGentOrchestrator No-Provider Runtime Dry-Run Plan RFC

## 1. Status

Status: ready for review, not runtime dry-run execution.

Gate 48 is a planning RFC only.

Gate 48 does not invoke processToolCall.

Gate 48 does not authorize runtime cutover.

Gate 48 does not authorize provider validation.

Gate 48 does not authorize downstream dispatch.

Gate 48 does not authorize LocalState writes.

Gate 48 does not modify PluginManager, resolver, allowlist behavior, modules,
scripts, server routes, or external package files.

## 2. Current Evidence

Core HEAD:

```text
2434eaff5aa2ebe34b31280959730363b3f024f9
```

Core origin/main:

```text
2434eaff5aa2ebe34b31280959730363b3f024f9
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

Result: pass.

Cross-repo integrity guard:

```powershell
node --check scripts/check-jenn-aigent-orchestrator-copy-integrity.js
node scripts/check-jenn-aigent-orchestrator-copy-integrity.js
```

Result: pass.

External validation:

```powershell
node --check scripts\check-jenn-static-no-provider.mjs
node scripts\check-jenn-static-no-provider.mjs
```

Result: pass.

## 3. Exact Future Runtime Allowlist

Future dry-run gates must use exactly this external runtime allowlist entry:

```text
JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

The future dry-run gate must use only this exact external allowlist entry.

Explicitly forbidden:

- wildcard allowlists
- name-only allowlists
- package-root allowlists
- LocalState-root allowlists
- core Plugin/AIGentOrchestrator fallback while claiming external success

## 4. Future No-Provider Dry-Run Request Shape

Future request shape:

- plugin identity: `JennAIGentOrchestrator`
- target path:
  `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator`
- pipeline: `PlanImagePipeline`
- dryRun: `true`
- allowProvider: `false`
- allowDownstream: `false`
- allowExecution: `false`
- provider calls: forbidden
- downstream dispatch: forbidden
- LocalState writes: forbidden
- real image generation: forbidden
- server route activation: forbidden

ABI expectation from prior sealed gates:

- top-level user_input supplied: yes
- input supplied: no
- description supplied: no
- requestId: required
- command: must target the no-provider planning path only

The request must remain planner-only. Any returned future step metadata for
downstream agents is inert plan data, not downstream execution evidence.

## 5. Future Command / Invocation Policy

Gate 49 must use a single explicit no-provider dry-run command or script
invocation.

Gate 49 must not start persistent servers.

Gate 49 must not call provider adapters.

Gate 49 must not dispatch downstream plugins.

Gate 49 must not write LocalState.

Gate 49 must not activate server routes.

Gate 49 must not perform real image generation.

Gate 49 must not remove or mutate core Plugin/AIGentOrchestrator.

Gate 49 must not modify external package files.

Gate 49 must not broaden allowlists.

Gate 49 must record processToolCall count only if processToolCall is actually
invoked by the explicit no-provider dry-run command.

Gate 49 must block if command discovery would require guessing runtime
entrypoints.

Current read-only survey found the manifest command surface
`node AIGentOrchestrator.js` and command identifier `PlanImagePipeline`, but did
not identify an existing checked-in exact-external-allowlist runtime invocation
script or command that can be executed without further entrypoint discovery.

## 6. Future Receipt Fields

Required future Gate 49 receipt fields:

- core HEAD:
- external HEAD:
- external origin/main:
- exact runtime allowlist:
- command invoked:
- request shape:
- requestId:
- user_input present:
- input present:
- description present:
- dryRun:
- allowProvider:
- allowDownstream:
- allowExecution:
- provider calls:
- downstream dispatch:
- LocalState writes:
- server route activation:
- real image generation:
- processToolCall count:
- plugin resolved from external path:
- core fallback used:
- PlanRetryPipeline invoked:
- HealthCheck fallback invoked:
- files modified:
- core worktree:
- external worktree:
- result:

## 7. Block / Fallback Policy

If external plugin cannot be resolved from the exact external path, block.

If runtime falls back to core Plugin/AIGentOrchestrator, block.

If provider call is required, block.

If downstream dispatch is required, block.

If LocalState write is required, block.

If server route activation is required, block.

If real image generation is required, block.

If PlanRetryPipeline is invoked, block.

If HealthCheck fallback is invoked, block.

If request shape requires input or description instead of top-level user_input,
block and issue a new ABI review gate.

Do not repair by changing runtime code without a separate task book.

Do not remove core Plugin/AIGentOrchestrator in the first no-provider dry-run
gate.

## 8. Recommended Next Gate

RECOMMEND_GATE_49_RUNTIME_ENTRYPOINT_DISCOVERY_SURVEY

Rationale: validation passed and the plugin source/manifest support a
planner-only `PlanImagePipeline` path, but the read-only survey did not identify
an existing checked-in exact-external-allowlist runtime dry-run command or
script invocation. The next safe gate should discover and document the exact
runtime entrypoint rather than guessing it during execution.

This recommendation does not authorize provider validation.

This recommendation does not authorize runtime cutover.

This recommendation does not authorize removing core Plugin/AIGentOrchestrator.

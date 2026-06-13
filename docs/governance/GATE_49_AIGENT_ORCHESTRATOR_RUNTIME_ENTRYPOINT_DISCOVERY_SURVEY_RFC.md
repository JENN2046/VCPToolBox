# Gate 49 | AIGentOrchestrator Runtime Entrypoint Discovery Survey RFC

## 1. Status

Status: ready for review, not runtime dry-run execution.

Gate 49 is an entrypoint discovery survey only.

Gate 49 does not invoke processToolCall.

Gate 49 does not authorize runtime cutover.

Gate 49 does not authorize provider validation.

Gate 49 does not authorize downstream dispatch.

Gate 49 does not authorize LocalState writes.

Gate 49 does not modify PluginManager, resolver, allowlist behavior, modules,
scripts, server routes, or external package files.

## 2. Current Evidence

Core HEAD:

```text
4c56f9df30e4d375051322cf0d37e27d85b9f88b
```

Core origin/main:

```text
4c56f9df30e4d375051322cf0d37e27d85b9f88b
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

## 3. Entrypoint Discovery Findings

Package metadata:

- package name: `vcptoolbox`
- package.json main: `Server.js`
- package.json bin: none
- package.json type: none

Package scripts:

- `test`: broad Node test suite
- `test:baseline`: `node scripts/check-prod-baseline.js`
- `test:photo-studio`: photo studio tests
- `test:dingtalk-cli`: DingTalk CLI tests
- `test:dingtalk-cli:smoke`: DingTalk smoke runner
- `dws:baseline`, `dws:matrix`, `dws:workflow`, `dws:calibrate`: DingTalk
  workflow scripts
- `start`: `node server.js`
- `start:admin`: `node adminServer.js`
- `start:all`: starts server and admin server
- `build:admin`: AdminPanel build

No package script names an exact `JennAIGentOrchestrator`
no-provider runtime dry-run with exact external allowlist.

Scripts that mention dryRun / allowProvider / allowDownstream /
allowExecution:

- `scripts/check-prod-baseline.js` contains Gate 31D fixture markers for
  `JennAIGentOrchestrator`, `PlanImagePipeline`, `dryRun: true`,
  `allowProvider: false`, `allowDownstream: false`,
  `allowExecution: false`, and `processToolCall count: 1`.
- `scripts/check-jenn-aigent-orchestrator-copy-integrity.js` verifies copied
  source/config/manifest/README integrity and reports provider calls,
  downstream dispatch, runtime cutover, and LocalState writes as `NO`.
- These scripts are guards and evidence checks, not a future runtime dry-run
  command surface.

Modules that mention PlanImagePipeline:

- Runtime survey output found `PlanImagePipeline` in the core
  `Plugin/AIGentOrchestrator` source and manifest.
- Baseline checks also preserve Gate 31D `PlanImagePipeline` ABI fixture
  markers.
- No module-level exact external no-provider runtime dry-run harness was found
  in this gate.

PluginManager / processToolCall touchpoints:

- `modules/toolExecution.js` calls `pluginManager.processToolCall`.
- `modules/vcpLoop/toolExecutor.js` calls `this.pluginManager.processToolCall`.
- Several plugins expose their own `processToolCall` functions for normal tool
  handling.
- Gate 49 did not invoke any of these paths.

External plugin resolver / allowlist touchpoints:

- `modules/pluginRootResolver.js` contains `VCP_PLUGIN_DIRS`,
  `VCP_PLUGIN_ALLOWED_ROOTS`, and `VCP_PLUGIN_INSTALL_DIR` handling.
- `scripts/check-prod-baseline.js` preserves
  `VCP_EXTERNAL_PLUGIN_ALLOWLIST` and the exact
  `JennAIGentOrchestrator` external allowlist marker.
- Runtime registration remains gated separately by
  `VCP_EXTERNAL_PLUGIN_ALLOWLIST`.

Server route / persistent server risks:

- `package.json` exposes `start`, `start:admin`, and `start:all`.
- Those scripts start persistent server surfaces and are not valid for a
  no-provider runtime dry-run gate.
- Gate 49 did not start a server and did not activate routes.

Provider/downstream/LocalState risks:

- The core `AIGentOrchestrator` source is planner-only and returns inert future
  step metadata for `AIGentPrompt`, `AIGentWorkflow`, `AIGentQuality`, and
  optional `AIGentStyle`.
- The external static validator confirms the Jenn source has no
  provider/network markers and no write/spawn markers.
- External docs preserve the boundary: planner-only, not provider-backed, not
  downstream-backed, no provider calls, no downstream plugin calls, and no
  LocalState writes.
- Gate 31D remains planner-only, no-provider, no-downstream evidence, not
  provider validation.

Exact no-provider runtime dry-run command:

- An exact safe no-provider runtime dry-run command was not found.
- The manifest command surface `node AIGentOrchestrator.js` exists, but by
  itself it is a plugin stdio entrypoint, not an exact runtime dry-run command
  proving external resolution through the allowlisted runtime path.
- A future gate must not guess the runtime entrypoint.

## 4. Exact External Runtime Allowlist Requirement

Future runtime dry-run execution gates must use only this exact external
allowlist entry:

```text
JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

Explicitly forbidden:

- wildcard allowlists
- name-only allowlists
- package-root allowlists
- LocalState-root allowlists
- core Plugin/AIGentOrchestrator fallback while claiming external success

## 5. Runtime Dry-Run Execution Boundary

Gate 49 does not run the dry-run.

Gate 49 does not invoke processToolCall.

Gate 49 does not start a server.

Gate 49 does not activate routes.

Gate 49 does not call providers.

Gate 49 does not dispatch downstream.

Gate 49 does not write LocalState.

Gate 49 does not perform image generation.

Gate 49 does not mutate core runtime code.

Gate 49 does not mutate external package files.

## 6. Entrypoint Classification

ENTRYPOINT_AMBIGUOUS_NEEDS_HARNESS_DESIGN

Candidate references exist, including the plugin stdio command surface,
`PlanImagePipeline` command identifiers, baseline ABI fixture markers, and
runtime allowlist markers. However, no exact safe command can be named without
guessing or without designing a tiny no-provider harness.

## 7. Future Gate 50 Shape

Recommend a future harness design RFC gate.

The future harness must be static/no-provider/no-downstream/no-LocalState by
construction.

The future harness must not be added to baseline if it requires external
package filesystem availability.

The future harness must be explicitly invoked only.

The future Gate 50 must still not authorize provider validation or runtime
cutover.

## 8. Required Future Receipt Fields

Required future receipt fields for any eventual runtime dry-run:

- core HEAD:
- external HEAD:
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

## 9. Recommended Next Gate

RECOMMEND_GATE_50_AIGENT_ORCHESTRATOR_NO_PROVIDER_RUNTIME_HARNESS_DESIGN_RFC

Rationale: the survey found candidate runtime surfaces and preserved
no-provider evidence, but did not find an existing exact external-allowlist
runtime dry-run command that can be safely executed without guessing. The next
safe step is a harness design RFC, not execution.

This recommendation does not authorize provider validation.

This recommendation does not authorize runtime cutover.

This recommendation does not authorize removing core Plugin/AIGentOrchestrator.

This recommendation does not authorize adding broad, wildcard, name-only,
package-root, or LocalState-root allowlists.

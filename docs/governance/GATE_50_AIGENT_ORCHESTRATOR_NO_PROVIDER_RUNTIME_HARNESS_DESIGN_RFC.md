# Gate 50 | AIGentOrchestrator No-Provider Runtime Harness Design RFC

## 1. Status

Status: ready for review, not harness implementation.

Gate 50 is a design RFC only.

Gate 50 does not implement a harness.

Gate 50 does not execute a runtime dry-run.

Gate 50 does not invoke processToolCall.

Gate 50 does not authorize provider validation.

Gate 50 does not authorize downstream dispatch.

Gate 50 does not authorize LocalState writes.

Gate 50 does not authorize runtime cutover.

Gate 50 does not modify PluginManager, resolver, allowlist behavior, modules,
scripts, server routes, Plugin files, or external package files.

## 2. Current Evidence

Core HEAD:

```text
fc4f49dc4c2e8c49f13c8094e1eebc6074dd943c
```

Core origin/main:

```text
fc4f49dc4c2e8c49f13c8094e1eebc6074dd943c
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

Validation used before this design:

```powershell
node --check scripts/check-prod-baseline.js
npm run test:baseline
node --check scripts/check-jenn-aigent-orchestrator-copy-integrity.js
node scripts/check-jenn-aigent-orchestrator-copy-integrity.js
node --check scripts\check-jenn-static-no-provider.mjs
node scripts\check-jenn-static-no-provider.mjs
```

Result: pass.

## 3. Proposed Harness Purpose

The future harness should provide one tiny, explicit, locally invoked command
that proves the runtime can resolve and call the external
`JennAIGentOrchestrator` candidate through the exact allowlisted runtime path
while preserving the no-provider, no-downstream, no-LocalState boundary.

The harness should produce a receipt only. It must not become a general runtime
runner, a provider validator, a Plugin Store operation, or a cutover tool.

The harness should exist only to remove the ambiguity found in Gate 49: candidate
runtime surfaces exist, but no exact safe no-provider command can currently be
named without guessing.

## 4. Proposed Command / Script Name

Proposed future script:

```text
scripts/run-jenn-aigent-orchestrator-no-provider-runtime-harness.js
```

Proposed future command:

```powershell
node scripts/run-jenn-aigent-orchestrator-no-provider-runtime-harness.js
```

The script must be explicitly invoked only.

The script must not be wired into `npm test`, `npm run test:baseline`, startup
scripts, server routes, Plugin Store flows, or automatic lifecycle hooks.

The script must not be added to baseline if it requires external package
filesystem availability. Baseline must remain independent from optional external
package presence.

## 5. Exact External Allowlist

The future harness must use exactly this allowlist entry:

```text
JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

Only this exact external allowlist entry is in scope.

Explicitly forbidden:

- wildcard allowlists
- name-only allowlists
- package-root allowlists
- LocalState-root allowlists
- core Plugin/AIGentOrchestrator fallback while claiming external success

## 6. Request Shape

The future harness request shape must be inert and planner-only:

- plugin identity: `JennAIGentOrchestrator`
- target path:
  `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator`
- command: `PlanImagePipeline`
- requestId: required
- top-level user_input: required
- input: absent
- description: absent
- dryRun: `true`
- allowProvider: `false`
- allowDownstream: `false`
- allowExecution: `false`
- include_style_training: `false`
- execute_pipeline: `false`
- confirm_external_effects: `false`

The request must not include:

- provider
- model
- output path
- LocalState path
- downstream plugin target
- dataset path
- secret, token, credential, endpoint, or raw authorization value

## 7. Expected Plugin Resolution Proof

The future harness receipt must prove:

- `JennAIGentOrchestrator` was resolved from:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

- the exact external allowlist was active
- the core `Plugin/AIGentOrchestrator` path was not used
- no fallback to core `Plugin/AIGentOrchestrator` occurred
- `PlanRetryPipeline` was not invoked
- `HealthCheck` fallback was not invoked

If the external plugin cannot be resolved from the exact external path, the
harness must block.

If the runtime falls back to core `Plugin/AIGentOrchestrator`, the harness must
block.

## 8. Future Receipt Fields

Any future harness execution receipt must include:

- core HEAD:
- core origin/main:
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
- PlanImagePipeline invoked:
- PlanRetryPipeline invoked:
- HealthCheck fallback invoked:
- files modified:
- core worktree:
- external worktree:
- result:

## 9. Block Policy

The future harness must block if:

- the core worktree is dirty
- the external worktree is dirty
- external HEAD or origin/main differs from the authorized expected commit for
  that future gate
- exact allowlist construction fails
- external plugin resolution is ambiguous
- the resolved plugin path is not the exact external path
- core fallback occurs
- request shape requires `input` or `description` instead of top-level
  `user_input`
- provider calls are required
- downstream dispatch is required
- LocalState writes are required
- server startup or route activation is required
- real image generation is required
- runtime code changes are required
- Plugin, modules, or external package files must be edited
- broad, wildcard, name-only, package-root, or LocalState-root allowlists are
  needed

The harness must not self-repair by changing runtime code.

The harness must not remove or mutate core `Plugin/AIGentOrchestrator`.

## 10. Rollback Policy

Gate 50 itself is documentation-only. Rollback is a normal revert of the Gate 50
RFC commit.

For a future harness implementation gate:

- rollback must be limited to deleting or reverting the explicit harness file
- no runtime state rollback should be needed because the harness must not write
  LocalState, provider output, cache, logs, or operator state
- no external package rollback should be needed because external package files
  must not be edited
- no PluginManager or resolver rollback should be needed because runtime code
  must not be changed

## 11. Why This Is Not Provider Validation

This design does not call any provider.

This design does not validate image generation.

The future harness must use `allowProvider: false`.

The future harness must treat returned model names, downstream agent names, and
workflow step names as inert plan metadata only.

No provider credentials, provider URLs, generated images, provider logs,
provider caches, or provider response bodies are in scope.

## 12. Why This Is Not Runtime Cutover

This design does not change PluginManager, resolver, allowlist behavior, module
code, Plugin code, scripts, server routes, or external package files.

This design does not remove core `Plugin/AIGentOrchestrator`.

This design does not make `JennAIGentOrchestrator` the default runtime target.

This design does not authorize persistent server startup, Plugin Store live
operations, production flags, releases, deploys, tags, or runtime cutover.

## 13. Design Classification

HARNESS_DESIGN_READY

The design is ready for review because it stays narrow, exact-allowlist,
explicit-invocation-only, no-provider, no-downstream, no-LocalState, and does
not require runtime, Plugin, module, server route, or external package changes
inside Gate 50.

## 14. Recommended Next Gate

RECOMMEND_GATE_51_AIGENT_ORCHESTRATOR_NO_PROVIDER_RUNTIME_HARNESS_IMPLEMENTATION

Gate 51 must remain a separately authorized implementation gate.

Gate 51 must not execute runtime dry-run unless its task book explicitly
authorizes execution after implementation and validation.

Gate 51 must not authorize provider validation.

Gate 51 must not authorize runtime cutover.

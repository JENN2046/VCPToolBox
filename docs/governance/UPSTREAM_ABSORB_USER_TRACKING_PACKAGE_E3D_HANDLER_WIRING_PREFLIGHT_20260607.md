# Upstream Absorb User Tracking Package E3d Handler Wiring Preflight - 2026-06-07

本文件记录 User Tracking Package E3d 的 handler wiring design/preflight。

本包只新增文档，不修改 `server.js`，不修改 `modules/chatCompletionHandler.js`，不修改 `modules/messageProcessor.js`，不接入运行链路，不修改 `config.env` / `config.env.example` / `preprocessor_order.json`，不启动服务，不跑数据库、向量重建或真实插件流程。

## 1. Scope

| Item | Value |
|------|-------|
| Local base | `main` after #184, merge `42192b28` |
| Existing local evidence | #178 Package E preflight, #179 E1 contracts, #180 E2 detector helper, #181 E3 design, #182 E3a tests, #183 E3b message helper, #184 E3c mode resolver |
| Proposed local change in this package | Documentation/preflight only |
| Explicitly excluded | handler wiring, default behavior change, env/example mutation, admin route, frontend, database/vector rebuild, generated artifacts |

Goal: define the smallest future handler wiring shape for the default-off `PromptPipelineOrderMode` experiment before touching runtime code.

## 2. Current Local State

Current code already has a pure resolver:

```text
modules/promptPipelineOrderMode.js
```

It exposes:

```text
PROMPT_PIPELINE_ORDER_MODES.LEGACY = "legacy"
PROMPT_PIPELINE_ORDER_MODES.DETECTOR_POST_PROCESSORS_FINAL_ROLE_DIVIDER = "detector_post_processors_final_role_divider"
resolvePromptPipelineOrderMode(value)
isExperimentalPromptPipelineOrderMode(value)
```

The resolver is deliberately input-only:

- missing, empty, non-string, or unknown values resolve to `legacy`;
- only the exact experimental value resolves to `detector_post_processors_final_role_divider`;
- it does not read `process.env` by itself.

Current runtime remains legacy:

```text
LogInput
Role Divider initial stage
consume VCP tool-use forbidden placeholder
TransBase64 marker scan
VCPTavern priority preprocessor
semantic model routing
replaceAgentVariables / replaceOtherVariables
media preprocessor
generic preprocessors
TransBase64+ cleanup and restore
finalContextStore capture
upstream fetch
```

`modules/chatCompletionHandler.js` does not import or call `promptPipelineOrderMode.js` yet.

## 3. Config Source Decision

Future minimal wiring should use one explicit config field:

```text
promptPipelineOrderMode
```

Recommended source path:

```text
root config.env
  -> server.js reads process.env.PromptPipelineOrderMode
  -> ChatCompletionHandler config.promptPipelineOrderMode
  -> resolvePromptPipelineOrderMode(config.promptPipelineOrderMode ?? process.env.PromptPipelineOrderMode)
```

Rationale:

- `server.js` already loads root `config.env` through `dotenv.config({ path: 'config.env' })`;
- `server.js` already normalizes and passes Role Divider settings into `ChatCompletionHandler`;
- `ChatCompletionHandler` already accepts a config object and also has limited `process.env` fallback patterns for runtime options;
- keeping the resolver input-only preserves pure tests and avoids hidden env reads in helper code.

Do not make `EnableRoleDivider=true` imply the experimental mode.

The two controls must stay separate:

| Setting | Meaning |
|---------|---------|
| `EnableRoleDivider` | Whether Role Divider is allowed to run at all |
| `PromptPipelineOrderMode` | Where Detector / SuperDetector and Role Divider run in the request pipeline |

## 4. Default-Off Contract

Default behavior must be:

```text
PromptPipelineOrderMode missing -> legacy
PromptPipelineOrderMode empty -> legacy
PromptPipelineOrderMode unknown -> legacy
PromptPipelineOrderMode=legacy -> legacy
PromptPipelineOrderMode=detector_post_processors_final_role_divider -> experimental
```

Future handler wiring must satisfy:

- no runtime behavior change when the field is absent;
- no runtime behavior change when the field is invalid;
- no `LogAfterDetectors` or `LogAfterFinalRoleDivider` checkpoint in legacy execution;
- no message-level Detector pass in legacy execution;
- no final Role Divider pass in legacy execution;
- no initial Role Divider pass in experimental execution;
- no Detector / SuperDetector double application in any mode.

Rollback must remain simple:

```text
unset PromptPipelineOrderMode
or set PromptPipelineOrderMode=legacy
```

## 5. Minimal Future Wiring Shape

The smallest acceptable runtime package should touch only:

```text
server.js
modules/chatCompletionHandler.js
tests/pipeline-order-contract.test.js
tests/pipeline-order-experiment.test.js
```

Allowed future changes:

1. `server.js`

```text
promptPipelineOrderMode: process.env.PromptPipelineOrderMode
```

No parsing should happen in `server.js` beyond passing the raw value.

2. `modules/chatCompletionHandler.js`

```text
const {
  PROMPT_PIPELINE_ORDER_MODES,
  resolvePromptPipelineOrderMode
} = require('./promptPipelineOrderMode.js');
```

Resolve once near the start of `handle()`:

```text
const pipelineOrderMode = resolvePromptPipelineOrderMode(
  this.config.promptPipelineOrderMode ?? process.env.PromptPipelineOrderMode
);
```

Then derive booleans:

```text
const useExperimentalPipelineOrder =
  pipelineOrderMode === PROMPT_PIPELINE_ORDER_MODES.DETECTOR_POST_PROCESSORS_FINAL_ROLE_DIVIDER;
```

3. Initial Role Divider branch

```text
if (enableRoleDivider && !useExperimentalPipelineOrder) {
  run initial Role Divider
}
```

4. Variable replacement context

Future wiring needs a clear detector phase marker so Detector is not applied twice:

```text
detectorPhase: useExperimentalPipelineOrder ? 'deferred' : 'legacy'
```

The exact suppression mechanism belongs in the implementation package, but it must be tested before merge.

5. Experimental post-preprocessor branch

Only in experimental mode:

```text
processedMessages = messageProcessor.applyDetectorsToMessages(processedMessages, processingContext)
if DEBUG_MODE write LogAfterDetectors

if (enableRoleDivider) {
  processedMessages = roleDivider.process(processedMessages, ...)
  if DEBUG_MODE write LogAfterFinalRoleDivider
}
```

This branch must run after TransBase64+ cleanup and before `finalContextStore.setLastFinalContext`.

## 6. Explicit Non-Goals

Do not include these in the first handler wiring package:

- changing the default mode away from `legacy`;
- adding admin write APIs;
- adding frontend controls;
- modifying `config.env` or real operator config;
- modifying `config.env.example` before runtime behavior is accepted;
- touching `preprocessor_order.json`;
- changing handler dispatch, VCP tool execution, stream/non-stream loops, bridge behavior, OneRing recorder behavior, or OAuth provider behavior;
- importing upstream files wholesale.

`config.env.example` can be a later small package after the runtime wiring has passed review.

## 7. Required Tests For Future Runtime Package

Future runtime wiring should add or extend focused tests for:

1. Config resolution

```text
config.promptPipelineOrderMode undefined + env undefined => legacy
config.promptPipelineOrderMode unknown => legacy
config.promptPipelineOrderMode experimental => experimental
config value wins over env fallback when both exist
```

2. Default-off source contract

```text
server.js passes process.env.PromptPipelineOrderMode into ChatCompletionHandler config
handler resolves but resolver remains input-only
```

3. Legacy source contract remains unchanged

```text
existing pipeline-order-contract legacy assertions still pass
no LogAfterDetectors
no LogAfterFinalRoleDivider
no applyDetectorsToMessages(processedMessages...) in legacy path
```

4. Experimental branch source order

```text
TransBase64+ cleanup
applyDetectorsToMessages
LogAfterDetectors
Role Divider final stage
LogAfterFinalRoleDivider
finalContextStore.setLastFinalContext
```

5. Single ownership

```text
legacy: initial Role Divider only, detector inside replaceOtherVariables only
experimental: final Role Divider only, message-level Detector only
EnableRoleDivider=false: no Role Divider in either position
```

6. Safety fixtures

```text
VCP tool markers are not unexpectedly split or detector-rewritten
multimodal non-text parts are preserved
semantic routing input delta remains explicit
preprocessor visibility delta remains explicit
```

## 8. Stop Conditions

Stop before implementation or merge if:

- missing or invalid mode can enter the experimental branch;
- Detector / SuperDetector can run twice;
- Role Divider can run both initial and final stages;
- `EnableRoleDivider` silently enables the experimental order;
- the future package requires real upstream calls, real plugins, database/vector rebuilds, service startup, or runtime file mutation;
- env/secrets/runtime/cache/debug/generated files would be touched;
- the package grows beyond the narrow files listed above.

## 9. Validation Performed

Read-only commands used for this preflight:

```powershell
git branch --show-current
git status --short
git log --oneline --decorate -n 10
rg --files docs | rg "USER_TRACKING|PIPELINE|PACKAGE|UPSTREAM|PREFLIGHT|R16|OneRing"
Get-Content -LiteralPath docs\governance\UPSTREAM_ABSORB_USER_TRACKING_PACKAGE_E_PIPELINE_ORDER_PREFLIGHT_20260606.md
Get-Content -LiteralPath docs\governance\UPSTREAM_ABSORB_USER_TRACKING_PACKAGE_E3_OPT_IN_PIPELINE_EXPERIMENT_PREFLIGHT_20260607.md
rg -n "PromptPipelineOrderMode|promptPipelineOrderMode|resolvePromptPipelineOrderMode|detector_post_processors_final_role_divider|config.env|process\.env|load.*config|read.*config" modules\chatCompletionHandler.js modules\promptPipelineOrderMode.js modules\messageProcessor.js tests\pipeline-order-contract.test.js tests\pipeline-order-experiment.test.js -S
rg -n "new ChatCompletionHandler|ChatCompletionHandler\(|require\('./modules/chatCompletionHandler|require\(.*chatCompletionHandler" -S . -g "*.js"
rg -n "ENABLE_ROLE_DIVIDER|dotenv|config.env|process\.env\.EnableRoleDivider|ROLE_DIVIDER" server.js -S
```

No service startup, plugin execution, admin API call, database operation, vector rebuild, config/env mutation, or external write was run.

## 10. Preflight Result

Approved design direction for the next implementation package:

```text
Keep PromptPipelineOrderMode default-off.
Pass raw PromptPipelineOrderMode from server.js into ChatCompletionHandler config.
Resolve in ChatCompletionHandler with modules/promptPipelineOrderMode.js.
Use legacy for missing, empty, or unknown values.
Branch handler order only after resolver returns the explicit experimental mode.
Keep config.env.example and admin/frontend controls out of the first runtime wiring package.
```

Recommended next package:

```text
E3e minimal handler wiring tests/runtime package
```

That package should be small and reviewable, with `legacy` still the default.

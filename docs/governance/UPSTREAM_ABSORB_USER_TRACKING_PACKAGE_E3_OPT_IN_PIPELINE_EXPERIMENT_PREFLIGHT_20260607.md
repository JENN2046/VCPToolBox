# Upstream Absorb User Tracking Package E3 Opt-In Pipeline Experiment Preflight - 2026-06-07

本文件记录 User Tracking Package E3 的 design/preflight 评估。

本包只新增文档，不修改 `modules/chatCompletionHandler.js`，不修改 `modules/messageProcessor.js`，不移动 Detector / SuperDetector / Role Divider 执行顺序，不新增运行开关，不修改 `config.env` / `config.env.example` / `preprocessor_order.json`，不启动服务，不跑数据库、向量重建或真实插件流程。

## 1. Scope

| Item | Value |
|------|-------|
| Local base | `main` after #180, merge `47a205ec` |
| Upstream commit inspected | `ec1737f9` |
| Existing local evidence | #178 Package E design/preflight, #179 E1 pipeline-order contracts, #180 E2 pure detector helper |
| Proposed local change in this package | Documentation/preflight only |
| Explicitly excluded | runtime wiring, default behavior change, env/config mutation, admin route, frontend, database/vector rebuild, generated artifacts |

Goal: define a safe future shape for an opt-in experiment that can compare the current local pipeline with the upstream-like Detector / Role Divider ordering without silently changing production defaults.

## 2. Current Baseline

Current local runtime remains legacy order:

```text
LogInput
Role Divider initial stage on originalBody.messages
consume VCP tool-use forbidden placeholder
TransBase64 marker scan
VCPTavern priority preprocessor
semantic model routing
per-message replaceAgentVariables / replaceOtherVariables
media preprocessor
generic message preprocessors
TransBase64+ cleanup and restore
finalContextStore capture
upstream fetch
```

Current detector state after #180:

- `messageProcessor.applyDetectorRules(text, role, context)` exists as a pure helper;
- `replaceOtherVariables()` still calls `applyDetectorRules()` at the legacy point;
- `detectors` remain system-role only;
- `superDetectors` remain all-role;
- `applyDetectorsToMessages()` is not exported or wired;
- `chatCompletionHandler.js` has no `LogAfterDetectors`, no `LogAfterFinalRoleDivider`, and no final Role Divider stage.

The current `tests/pipeline-order-contract.test.js` intentionally protects that state.

## 3. Upstream Behavior Under Review

Upstream `ec1737f9` changes the pipeline order:

```text
LogInput
consume VCP tool-use forbidden placeholder
TransBase64 marker scan
VCPTavern priority preprocessor
semantic model routing
per-message variable replacement
media preprocessor
generic message preprocessors
TransBase64+ cleanup and restore
Detector / SuperDetector message-level post-processing
Role Divider final stage
finalContextStore capture
upstream fetch
```

This is not a mechanical refactor. It changes which messages preprocessors see, when detector rewrites happen, what semantic routing receives, and what final upstream message layout looks like.

## 4. E3 Design Decision

Do not raw-port upstream `ec1737f9`.

If implementation proceeds later, use a default-off explicit experiment mode. The recommended shape is a single mode switch rather than multiple independent booleans:

```text
PromptPipelineOrderMode=legacy
PromptPipelineOrderMode=detector_post_processors_final_role_divider
```

Rules:

- missing, empty, or unknown mode must resolve to `legacy`;
- `legacy` must remain the default and must preserve #179/#180 behavior exactly;
- the experimental mode must be opt-in per process/config load, never inferred from `EnableRoleDivider=true`;
- `EnableRoleDivider` must continue to control whether Role Divider runs at all;
- the experiment switch controls only pipeline order, not whether Role Divider itself is enabled;
- DEBUG-only checkpoint names may be added only behind the experimental branch;
- no admin write API or frontend control should be added in the first implementation package.

This keeps rollback simple: unset the mode or restore `legacy`.

## 5. Single-Ownership Rules

The future E3 implementation must avoid double application.

Legacy mode:

```text
Role Divider: initial stage only
Detector: applyDetectorRules() inside replaceOtherVariables()
Message-level Detector: absent
Final Role Divider: absent
```

Experimental mode:

```text
Role Divider: skip initial stage
Detector: skip inside replaceOtherVariables()
Message-level Detector: apply once after all preprocessors and TransBase64+ cleanup
Final Role Divider: run once after message-level Detector, only if EnableRoleDivider is true
```

Implementation implication:

- `replaceOtherVariables()` needs an explicit context marker, for example `detectorPhase: 'legacy' | 'deferred'`, or an equally clear local option;
- `detectorPhase: 'deferred'` must suppress the current `applyDetectorRules()` call inside `replaceOtherVariables()`;
- `applyDetectorsToMessages()` must be pure, clone message objects before modification, preserve non-text multimodal parts, and process only string content plus array text parts;
- neither branch may mutate `originalBody.messages` in a way that makes rollback impossible inside the same request.

## 6. Proposed Future Code Boundary

The smallest acceptable implementation package should touch only:

```text
modules/messageProcessor.js
modules/chatCompletionHandler.js
tests/pipeline-order-contract.test.js
tests/message-processor-detector-helper.test.js
tests/pipeline-order-experiment.test.js
```

Allowed in a future implementation:

- add `applyDetectorsToMessages()` as a pure message helper;
- add a local pipeline mode resolver inside `chatCompletionHandler.js` or a tiny pure helper if that keeps tests clean;
- branch the initial Role Divider block so it runs only in legacy mode;
- branch `processingContext` so detector rules are legacy or deferred, never both;
- add experimental DEBUG checkpoints only inside the experimental branch.

Not allowed in the E3 implementation package:

- changing the default mode away from `legacy`;
- changing `preprocessor_order.json`;
- modifying `config.env`, real env files, secrets, runtime state, cache, database, vector files, or generated dist;
- changing handler dispatch, VCP tool execution, stream/non-stream response loop behavior, bridge behavior, or OneRing recorder wiring;
- adding admin/frontend controls;
- importing unrelated upstream files.

## 7. Required Tests Before Runtime Wiring

Future E3 implementation must include focused tests before merge:

1. Default-off contract

```text
PromptPipelineOrderMode unset
=> current #179 pipeline contract still passes
=> no LogAfterDetectors / LogAfterFinalRoleDivider markers active in source path
```

2. No double Detector

```text
detector: "A" -> "B"
superDetector: "B" -> "C"
legacy mode runs once inside replaceOtherVariables()
experimental mode skips legacy detector and runs message-level detector once
```

3. Message traversal

```text
string content is rewritten
array text parts are rewritten
image_url and other non-text parts are preserved by identity-equivalent data
input messages are not mutated
```

4. Role Divider ownership

```text
legacy mode calls initial Role Divider only
experimental mode calls final Role Divider only
EnableRoleDivider=false calls neither
```

5. Preprocessor visibility fixture

```text
legacy fake preprocessor sees already split messages
experimental fake preprocessor sees unsplit messages
```

This test should make the behavioral delta explicit rather than hiding it.

6. Semantic routing fixture

```text
legacy semantic router sees messages after early Role Divider and VCPTavern
experimental semantic router sees VCPTavern output before final Role Divider
```

If this changes selected backend model in a fixture, the PR must document it.

7. Tool marker safety

```text
VCP tool markers and hidden payload markers are not split or detector-rewritten unexpectedly
```

If this cannot be proven in a small fixture, stop before runtime wiring.

8. Debug/final context

```text
legacy finalContextStore payload remains unchanged
experimental finalContextStore payload captures after detector post-processing and final Role Divider
```

## 8. Risk Register

| Risk | Why it matters | Required mitigation |
|------|----------------|---------------------|
| Double Detector rewrite | Running legacy detector and message-level detector together can rewrite twice | single detector phase marker and tests |
| Async result rewrite delta | Upstream-like post-processing can rewrite async placeholder results that legacy mode does not rewrite | explicit fixture and operator note |
| Preprocessor input delta | RAGDiaryPlugin, VCPTavern, media processors, and generic preprocessors may see split vs unsplit messages | fake preprocessor visibility tests |
| Semantic model delta | routing model selection can change when divider tags exist | semantic routing fixture |
| VCP tool marker split | final Role Divider may alter tool-loop parsing surface | tool marker safety fixture |
| Debug checkpoint drift | operators may rely on existing logs | DEBUG checkpoint tests and docs |
| Hidden default flip | behavior changes without operator intent | default `legacy`, unknown mode fallback to `legacy` |

## 9. Stop Conditions

Stop before implementation or merge if:

- default mode changes from `legacy`;
- experimental behavior can run when the mode is unset or invalid;
- detector rules can run twice in one request;
- Role Divider can run both initial and final stages in one request;
- semantic routing input changes without a focused test;
- VCP tool markers can be split or rewritten without an explicit decision;
- tests require real upstream calls, real plugins, database/vector rebuilds, or service startup;
- env/secrets/runtime/cache/generated files would be touched.

## 10. Recommended Next Package

If continuing after this preflight, do not jump directly to a full handler rewrite.

Recommended next package:

```text
E3a tests-only experiment harness
```

Scope:

- add test fixtures that model legacy vs experimental phase ownership;
- add or extend pure helper tests for `applyDetectorsToMessages()`;
- keep `chatCompletionHandler.js` runtime behavior unchanged unless the tests force a tiny pure extraction.

Only after E3a passes should an implementation package wire the default-off mode into `chatCompletionHandler.js`.

## 11. Validation Performed

Read-only commands used for this preflight:

```powershell
git status -sb
git branch --show-current
git log --oneline --decorate -n 8
rg -n "Package E|E1|E2|E3|Detector / SuperDetector|Role Divider|opt-in pipeline" docs\governance tests modules -S
rg -n "Applying Role Divider processing|LogAfterInitialRoleDivider|LogAfterDetectors|LogAfterFinalRoleDivider|applyDetectorRules|applyDetectorsToMessages|replaceOtherVariables|executeMessagePreprocessor|finalContextStore" modules\chatCompletionHandler.js modules\messageProcessor.js -S
git show --unified=80 ec1737f9 -- modules\chatCompletionHandler.js modules\messageProcessor.js
```

No service startup, plugin execution, admin API call, database operation, vector rebuild, config/env mutation, or external write was run.

## 12. Preflight Result

E3 is not ready for direct runtime absorption as a single large port.

Approved design direction:

```text
Use a default-off explicit experiment mode.
Preserve legacy as the default.
Enforce single ownership for Detector and Role Divider phases.
Add tests before wiring runtime behavior.
```

Do not make the upstream order the default without a later E4 decision package.

# Upstream Absorb User Tracking Package E Pipeline Order Preflight - 2026-06-06

本文件记录 User Tracking Package E 的 design/preflight 评估。

本包只新增文档，不修改 `modules/chatCompletionHandler.js`，不修改 `modules/messageProcessor.js`，不移动 Detector / SuperDetector / Role Divider 执行顺序，不修改 `preprocessor_order.json`，不启动服务，不跑数据库、向量重建或真实插件流程。

## 1. Scope

| Item | Value |
|------|-------|
| Local base | `main` after #177, merge `72448865` |
| Upstream commit inspected | `ec1737f9` |
| Upstream theme | Detector / SuperDetector post-processing and Role Divider final-stage ordering |
| Proposed local change in this package | Documentation/preflight only |
| Explicitly excluded | runtime code, handler pipeline reorder, detector helper export, preprocessor order config, env/runtime/state/cache/database/vector rebuild |

Goal: decide whether `ec1737f9` can be absorbed directly after Package A-D completed the shared real-user tracking consumers.

Conclusion: do not absorb directly. Package E changes the prompt pipeline order, not just user-message selection.

## 2. Upstream Payload

`ec1737f9` changes two files:

```text
modules/chatCompletionHandler.js
modules/messageProcessor.js
```

In `modules/messageProcessor.js`, upstream:

- adds `applyDetectorRules(text, role, context)`;
- adds `applyDetectorsToMessages(messages, context)`;
- removes Detector / SuperDetector application from `replaceOtherVariables()`;
- exports the new detector helpers.

In `modules/chatCompletionHandler.js`, upstream:

- removes the early Role Divider block that currently runs immediately after `LogInput`;
- applies `messageProcessor.applyDetectorsToMessages(processedMessages, processingContext)` after:
  - variable replacement;
  - media preprocessor;
  - generic message preprocessors;
  - `TransBase64+` cleanup and restore;
- then runs Role Divider as a final-stage split;
- adds debug checkpoints named `LogAfterDetectors` and `LogAfterFinalRoleDivider`.

This is a real ordering change across the request path.

## 3. Current Local Pipeline

Current local `modules/chatCompletionHandler.js` order is:

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

Current local Detector behavior lives inside `replaceOtherVariables()`:

- `detectors` run only inside `role === 'system'`;
- `superDetectors` run for every content string processed by `replaceOtherVariables()`;
- detector replacement happens before async placeholder replacement returns from `replaceOtherVariables()`;
- there is no exported `applyDetectorRules()` or `applyDetectorsToMessages()` helper.

Current local Role Divider behavior:

- runs before `VCPTavern`;
- changes what `VCPTavern`, semantic routing, variable replacement, media preprocessing, and generic preprocessors receive;
- writes `LogAfterInitialRoleDivider`;
- does not run again after all preprocessors.

## 4. Behavior Delta

| Area | Current local behavior | Upstream `ec1737f9` behavior | Risk |
|------|------------------------|------------------------------|------|
| Role Divider input to preprocessors | Preprocessors see already split messages | Preprocessors see unsplit messages | RAGDiaryPlugin, VCPTavern, media processors, dynamic tools, and other preprocessors can observe different roles/counts/content |
| Semantic routing input | Routing sees messages after early Role Divider and VCPTavern | Routing sees VCPTavern output before final Role Divider | Selected backend model can change for role-divided prompts |
| Detector timing | Detector/SuperDetector run during variable replacement | Detector/SuperDetector run after all preprocessors | Detector can rewrite preprocessor output and resolved async output |
| Detector coverage | Only strings that pass through `replaceOtherVariables()` are rewritten | Final string content and text parts are rewritten via message-level traversal | Array text parts and plugin-emitted text may be affected differently |
| Debug checkpoints | `LogAfterInitialRoleDivider` exists | `LogAfterDetectors` and `LogAfterFinalRoleDivider` exist | Existing debug comparison and operator expectations change |
| Final upstream body | Built from messages split early | Built from messages split at the end | Message count, role layout, and VCP tool parsing surface can change |

Package A-D intentionally avoided these changes. They only unified latest real-user selection for RAG, semantic routing, dynamic fold, and ContextFoldingV2.

## 5. Compatibility Questions

Before implementation, answer these with tests or fixtures:

1. Should `VCPTavern` consume role-divided messages, or should Role Divider wait until after Tavern injection?
2. Should `RAGDiaryPlugin` and other generic preprocessors see split or unsplit user floors?
3. Should semantic routing happen before or after Role Divider when the user prompt contains divider tags?
4. Should `detectors` rewrite only system-origin content, or also system-like output emitted by preprocessors?
5. Should `superDetectors` rewrite tool payloads, hidden markers, OneRing wrappers, or preprocessor-generated text?
6. Can final-stage Role Divider split content that contains VCP tool markers without changing tool loop behavior?
7. Does moving Detector after async placeholder replacement intentionally allow detector rules to rewrite async tool results?
8. Are multimodal array parts preserved exactly when Detector traversal and final Role Divider both run?

Without those answers, raw absorption is too broad.

## 6. Proposed Future Package Boundary

Do not implement Package E as one raw port.

If continuing, prefer this staged path:

| Future package | Scope | Explicit exclusions |
|----------------|-------|---------------------|
| E1 order contract tests | Add fixtures that document current local order and upstream target order; no behavior change | no handler reorder, no detector helper export |
| E2 pure detector helper tests | Add pure helper design/tests for string and array traversal if the behavior is approved | no handler wiring, no removal from `replaceOtherVariables()` |
| E3 opt-in pipeline experiment | Wire Detector post-processing and final Role Divider behind an explicit default-off strategy if still desired | no default behavior change without review |
| E4 default switch decision | Only after E1-E3 evidence and operator review | no silent default flip |

The smallest next useful package is E1: pipeline-order contract tests or a design test fixture, still without changing runtime behavior.

## 7. Required Validation For Any Future Implementation

Future implementation should include focused tests for:

- Role Divider before vs after `VCPTavern`;
- Role Divider before vs after `RAGDiaryPlugin` or a fake generic preprocessor;
- semantic routing input when divider tags are present;
- detector-only system rewrite and superDetector all-role rewrite;
- detector rewrite of preprocessor-generated output;
- array content traversal preserving non-text parts;
- VCP tool marker text not being split or rewritten unexpectedly;
- debug checkpoint names or final context capture shape when DEBUG mode is enabled.

Recommended local checks for any future runtime package:

```powershell
node --check modules\messageProcessor.js
node --check modules\chatCompletionHandler.js
node --test tests\message-processor-user-tracking.test.js
node --test tests\semantic-model-router.test.js
node --test tests\dynamicToolRegistry.test.js
node --test tests\codex-memory-chat-loop.test.js
git diff --check
```

Broader CI should remain required before merge because this path affects shared request processing.

## 8. Stop Conditions

Stop before implementation if the package would:

- change default Role Divider order without tests;
- remove Detector / SuperDetector from `replaceOtherVariables()` without replacement coverage;
- change semantic routing input without a focused fixture;
- change VCP tool execution, handler dispatch, or tool loop parsing;
- modify `preprocessor_order.json`;
- touch env, secrets, runtime state, cache, debug logs, database, vector stores, or generated artifacts;
- import upstream OneRing files or mix unrelated upstream changes.

## 9. Validation Performed

Read-only commands used:

```powershell
git show --name-status --oneline ec1737f9
git show --stat ec1737f9
git show --unified=70 ec1737f9 -- modules\chatCompletionHandler.js
git show --unified=70 ec1737f9 -- modules\messageProcessor.js
rg -n "Role Divider|Applying Role Divider|applyDetectorsToMessages|applyDetectorRules|detectors|superDetectors|replaceOtherVariables|LogAfterDetectors|LogAfterFinalRoleDivider|LogAfterInitialRoleDivider" modules\chatCompletionHandler.js modules\messageProcessor.js
rg -n "roleDivider|Role Divider|detectors|superDetectors|replaceOtherVariables|messagePreprocessors|VCPTavern|MultiModalProcessor|ImageProcessor" tests modules -g "*.test.js" -g "*.js"
```

No service startup, plugin execution, admin API call, database operation, vector rebuild, config/env mutation, or external write was run.

## 10. Preflight Result

Package E remains open as a design/runtime-order decision.

Current recommendation:

```text
Do not absorb ec1737f9 directly.
Do not move Detector / SuperDetector / Role Divider order in this package.
Next package, if approved: E1 pipeline-order contract tests only.
```

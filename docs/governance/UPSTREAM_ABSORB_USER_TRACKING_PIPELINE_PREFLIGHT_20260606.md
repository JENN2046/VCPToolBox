# Upstream Absorb User Tracking Pipeline Preflight - 2026-06-06

本文件记录对 upstream 统一真实 User 追踪管线的只读 preflight 评估。

本包只新增文档，不修改 `modules/messageProcessor.js`，不修改 `Plugin/RAGDiaryPlugin/RAGDiaryPlugin.js`，不修改 `modules/semanticModelRouter.js`，不修改 `Plugin/ContextFoldingV2/ContextFoldingV2.js`，不移动 Detector / Role Divider 执行顺序，不启动服务，不跑数据库、向量重建或真实插件流程。

## 1. Scope

| Item | Value |
|------|-------|
| Local target | `main` after `a67f2166` |
| Upstream commits inspected | `1cb979c4`, `d50297b3`, `ec1737f9` |
| Upstream theme | Unified real user message tracking across RAG, semantic routing, dynamic fold, and ContextFoldingV2 |
| Proposed local change in this package | Documentation only |
| Explicitly excluded | runtime code, handler pipeline reorder, Detector / Role Divider behavior, OneRing upstream wrapper changes, database/vector rebuild |

## 2. Upstream Payload

### 2.1 `1cb979c4` - unified User tracking pipeline

Files changed:

```text
Plugin/RAGDiaryPlugin/RAGDiaryPlugin.js
modules/messageProcessor.js
modules/semanticModelRouter.js
```

Main behavior:

- adds shared helpers in `modules/messageProcessor.js`:
  - `extractTextFromMessageContent`
  - `isSystemNotificationText`
  - `isBetaSystemUserText`
  - `stripSystemNotificationBlocks`
  - `findLastRealUserMessage`
- changes `RAGDiaryPlugin` to use the shared helper when selecting the latest real user query;
- changes dynamic fold logic in `messageProcessor` to use the same helper;
- changes `semanticModelRouter` to use the same helper for the user side of its context vector.

The important behavior is that user messages which are really system carriers or empty after system-notification stripping should not become the query source for vectorization or routing.

### 2.2 `d50297b3` - ContextFoldingV2 consumer

Files changed:

```text
Plugin/ContextFoldingV2/ContextFoldingV2.js
```

Main behavior:

- imports `findLastRealUserMessage`;
- uses it when building the folding context vector;
- strips OneRing tail markers before sanitize/vectorization;
- avoids letting pseudo-system or notification user blocks perturb folding decisions.

### 2.3 `ec1737f9` - broader pipeline order adjustment

Files changed:

```text
modules/chatCompletionHandler.js
modules/messageProcessor.js
```

Main behavior:

- extracts Detector / SuperDetector application into shared functions;
- applies Detector / SuperDetector after all message preprocessors;
- moves Role Divider from an early stage to the final stage after preprocessors and detectors.

This is related to the same "unified pipeline" direction, but it is a separate behavior change from real user selection.

## 3. Local Reality

Local code still has several independent definitions of "latest user":

| Local file | Current behavior |
|------------|------------------|
| `Plugin/RAGDiaryPlugin/RAGDiaryPlugin.js` | Finds the last `role === "user"` and skips only `[系统邀请指令:]` / `[系统提示:]无内容`; system notification blocks are stripped later during sanitize, so a notification-only latest user can hide the earlier real user. |
| `modules/messageProcessor.js` | Dynamic fold has its own latest-user search and sanitize fallback logic. |
| `modules/semanticModelRouter.js` | Has a local `findLastMessageText()` helper; skips `[系统提示:]`, `[系统邀请指令:]`, and tool payloads, but not all beta-system user carriers or notification-only blocks. |
| `Plugin/ContextFoldingV2/ContextFoldingV2.js` | Has another latest-user search and only skips `[系统邀请指令:]` / `[系统提示:]无内容`. |

Local `modules/messageProcessor.js` currently does not export:

```text
findLastRealUserMessage
isBetaSystemUserText
stripSystemNotificationBlocks
applyDetectorRules
applyDetectorsToMessages
```

Existing local tests cover parts of `RAGDiaryPlugin`, `semanticModelRouter`, and `messageProcessor`, but there is no focused unit test for shared real-user selection semantics.

## 4. Risk Assessment

Raw-merging these upstream commits is not recommended.

The commits mix at least two behavior groups:

1. real user selection normalization;
2. Detector / SuperDetector / Role Divider ordering.

These should not land in one local package because failures would be hard to attribute:

- RAG recall could change because a different user block is vectorized;
- semantic model routing could choose a different route;
- ContextFoldingV2 could fold different assistant blocks;
- Detector / SuperDetector could rewrite text produced by preprocessors, not only original system text;
- moving Role Divider to the final stage can change message count, role layout, and downstream VCP tool parsing behavior.

The real-user helper itself is worth absorbing, but it should be introduced first as pure logic with tests before any consumer is changed.

## 5. Recommended Local Absorption Plan

### Package A - pure helper and tests

Allowed files:

```text
modules/messageProcessor.js
tests/message-processor-user-tracking.test.js
```

Allowed behavior:

- add pure helpers:
  - `extractTextFromMessageContent`
  - `isSystemNotificationText`
  - `isBetaSystemUserText`
  - `stripSystemNotificationBlocks`
  - `findLastRealUserMessage`
- add unit tests for:
  - normal string user content;
  - array content text extraction;
  - skip `[系统邀请指令:]`;
  - skip `[系统提示:]无内容`;
  - skip beta-system user carriers except `[系统通知]`;
  - strip `[系统通知]... [系统通知结束]`;
  - if the newest user becomes empty after stripping, continue searching older real user content;
  - optional sanitizer callback use;
  - no mutation of caller-owned message objects.

Explicitly excluded:

```text
Plugin/RAGDiaryPlugin/RAGDiaryPlugin.js
modules/semanticModelRouter.js
Plugin/ContextFoldingV2/ContextFoldingV2.js
modules/chatCompletionHandler.js
```

### Package B - RAGDiaryPlugin consumer

Allowed files:

```text
Plugin/RAGDiaryPlugin/RAGDiaryPlugin.js
tests/codex-memory-recall.test.js or a focused RAGDiaryPlugin test
```

Allowed behavior:

- replace the local latest-user search with `findLastRealUserMessage`;
- keep existing sanitize behavior;
- prove notification-only latest user blocks do not mask the earlier real user query.

### Package C - semantic router / dynamic fold consumers

This can be one or two packages depending on test blast radius.

Candidate files:

```text
modules/semanticModelRouter.js
modules/messageProcessor.js
tests/semantic-model-router.test.js
tests/dynamicToolRegistry.test.js
```

Allowed behavior:

- make semantic model routing use the same real-user helper;
- make dynamic fold use the same real-user helper;
- avoid changing Detector / SuperDetector behavior in this package.

### Package D - ContextFoldingV2 consumer

Allowed files:

```text
Plugin/ContextFoldingV2/ContextFoldingV2.js
tests/context-folding-v2-user-tracking.test.js
```

Allowed behavior:

- make folding context vector use the same real-user helper;
- preserve current OneRing marker sanitization policy;
- avoid changing folding thresholds, queueing, store writes, or summary generation behavior.

### Package E - Detector / Role Divider order design

Do not implement directly after Package A.

This needs a separate design/preflight because it changes prompt pipeline ordering rather than just selecting the correct user block.

## 6. Stop Conditions

Stop before implementation if a package requires:

- moving Role Divider order;
- changing Detector / SuperDetector timing;
- changing VCP tool execution or handler dispatch;
- changing OneRing wrapper behavior;
- running database/vector rebuilds;
- writing runtime state, debug logs, cache, or config.env;
- broad formatting of shared runtime files;
- changing `preprocessor_order.json`;
- importing upstream OneRing files.

## 7. Validation Performed

Read-only commands used:

```powershell
git show --name-status --oneline 1cb979c4 d50297b3 ec1737f9
git show 1cb979c4:modules/messageProcessor.js | rg -n "extractTextFromMessageContent|isSystemNotificationText|isBetaSystemUserText|stripSystemNotificationBlocks|findLastRealUserMessage"
git show ec1737f9:modules/messageProcessor.js | rg -n "applyDetectorRules|applyDetectorsToMessages|replaceOtherVariables|module.exports"
git show d50297b3:Plugin/ContextFoldingV2/ContextFoldingV2.js | rg -n "findLastRealUserMessage|_getContextVector"
rg -n "findLastRealUserMessage|isBetaSystemUserText|applyDetectorsToMessages|Role Divider|replaceOtherVariables|lastUserMessageIndex|系统通知|系统邀请指令|系统提示" modules Plugin tests -g "*.js"
```

No service startup, plugin execution, admin API call, database operation, vector rebuild, or external call was run.

## 8. Preflight Result

Proceed with Package A only: pure real-user helper plus focused tests.

Do not absorb `ec1737f9` Detector / Role Divider order changes in the same implementation package. Treat that as a later pipeline-order design item after the shared helper and first consumer packages are validated.

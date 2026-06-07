# OneRing Plugin Wrapper Post-turn Preflight - 2026-06-08

本包只新增 design / preflight 文档，不修改 `Plugin/OneRing/*`，不修改
`modules/handlers/*`，不修改 `modules/oneringHandlerWiring.js`，不修改
`modules/oneringStore.js`，不创建 SQLite/runtime 数据，不接 live handler
链路。

## 1. Context

| Item | Value |
| --- | --- |
| Local base | `6c81656e` / `origin/main` after #204 |
| Current branch | `codex/onering-plugin-wrapper-postturn-preflight-20260608` |
| Prior package | #204 OneRing store-aware wiring helper + tests |
| Package type | docs-only design/preflight |

This preflight decides how the local OneRing plugin wrapper should expose
post-turn-aware assistant recording before any wrapper implementation is opened.

## 2. Current Local Reality

`Plugin/OneRing/OneRing.js` currently exposes two assistant recording methods:

```js
recordAIResponseFromMessages(messages, assistantContent)
recordAIResponse(meta, assistantContent)
```

Both methods:

- clean visible assistant content;
- skip when OneRing is disabled or content is empty;
- write an assistant `messages` row through `recordMessage()`;
- return `{ recorded: true, id: result.id }` after the assistant message is
  persisted;
- return `{ recorded: false, reason }` for safe skips.

`recordAIResponse(meta, assistantContent)` currently accepts:

```js
{
  agentName,
  frontendSource
}
```

It does not inspect `meta.postTurn` and does not call
`store.completePostTurn()`.

After #204, `modules/oneringHandlerWiring.js` can carry optional
`metadata.postTurn` and can complete a post-turn when a store object is supplied
through `context.oneRingPostTurnStore`. That remains a helper seam, not a live
handler integration.

## 3. Decision

The plugin wrapper should become the preferred owner of post-turn completion.

Local policy:

```text
recordAIResponse(meta, assistantContent)
  -> validate meta.agentName / meta.frontendSource
  -> clean visible assistant content
  -> if disabled or invalid, return recorded:false and do not touch postTurn
  -> record the assistant message first
  -> return the assistant message id
  -> if meta.postTurn exists, complete it through the same OneRingStore instance
```

Rationale:

- the wrapper already owns `getStore()` and path-contained data-dir resolution;
- live handlers should not receive or pass a raw store object;
- `completePostTurn()` already validates that the referenced message belongs to
  the same agent/frontend and has role `assistant`;
- returning the assistant message id preserves the #204 wiring contract;
- keeping completion after message persistence prevents successful post-turns
  without a real assistant message row.

## 4. Proposed Return Shape

Preserve the existing return shape and add optional post-turn fields:

```ts
type OneRingAssistantRecordResult = {
  recorded: boolean,
  id?: number,
  reason?: string,
  postTurnCompleted?: boolean,
  postTurnReason?: string | null
}
```

Rules:

- `recorded:false` means no assistant message was written and no post-turn
  completion was attempted;
- `recorded:true` requires a positive integer `id`;
- `postTurnCompleted:true` means `store.completePostTurn()` returned
  `{ updated: true }`;
- `postTurnCompleted:false` with `recorded:true` means the assistant message was
  stored, but post-turn completion was skipped or rejected;
- legacy callers that only read `recorded` and `id` remain compatible.

Do not return the full completed row by default. If a later debugging package
needs it, add it behind a test-reviewed field. The first wrapper package should
keep the public result small.

## 5. Metadata Contract

`recordAIResponse(meta, assistantContent)` may accept:

```js
{
  agentName: string,
  frontendSource?: string,
  postTurn?: {
    turnId: string,
    agentName: string,
    frontendSource: string,
    requestHash: string,
    requestBlockCount: number,
    responseMessageId: null,
    responseContentHash: null,
    status: 'pending',
    createdAt: string,
    updatedAt: string,
    completedAt: null,
    abortedAt: null
  }
}
```

Wrapper rules:

- normalize `agentName` and `frontendSource` exactly as current
  `recordAIResponse()` does;
- do not infer `agentName` from `postTurn`;
- if `meta.postTurn` exists but its agent/source does not match normalized
  `agentName`/`frontendSource`, do not complete it;
- use `completePostTurnMetadata(meta.postTurn, candidate)` to compute
  `responseContentHash`;
- call `getStore().completePostTurn(completed.metadata, result.id)` only after
  `recordMessage()` succeeds;
- if `completePostTurnMetadata()` fails, return `postTurnCompleted:false` and
  `postTurnReason`;
- if `store.completePostTurn()` returns `{ updated:false, reason }`, return that
  reason without throwing into the caller.

## 6. Interaction With #204 Wiring

The #204 wiring helper already supports a fake-store completion seam. The next
wrapper package should not remove that seam. Instead:

- keep `metadata.messages` untouched;
- keep `metadata.postTurn` as the optional pending metadata key;
- add or prepare resolver preference for a wrapper method that can consume
  `recordAIResponse(meta, content)` when `metadata.postTurn` exists;
- avoid requiring `context.oneRingPostTurnStore` in live handler contexts;
- if the wrapper completes the post-turn internally, #204 helper must not attempt
  a second completion for that same result.

The safest staged path is:

1. first update the wrapper and tests so `recordAIResponse(meta, content)` can
   complete post-turns internally;
2. then, in a later wiring package, prefer `recordAIResponse(meta, content)` over
   `recordAIResponseFromMessages(messages, content)` when `metadata.postTurn`
   exists.

This preflight opens only step 1.

## 7. Recommended Next Implementation Package

Recommended next package: **OneRing plugin wrapper postTurn recording + tests**.

Allowed target files:

```text
Plugin/OneRing/OneRing.js
tests/onering-plugin-wrapper.test.js
```

Do not modify:

```text
modules/handlers/streamHandler.js
modules/handlers/nonStreamHandler.js
modules/oneringHandlerWiring.js
modules/oneringStore.js
preprocessor_order.json
config.env
Plugin/OneRing/data/*
AdminPanel-Vue/dist/*
```

## 8. Minimum Tests For The Next Package

Tests should use temp directories or fake stores only.

Minimum test cases:

- existing disabled behavior still does not create a store;
- existing `recordAIResponseFromMessages()` behavior still returns an assistant
  message id;
- `recordAIResponse({ agentName, frontendSource }, content)` still returns
  `{ recorded:true, id }` without postTurn metadata;
- with `meta.postTurn`, `recordAIResponse()` records assistant message first and
  completes the matching pending post-turn;
- completed post-turn receives a content hash from visible assistant content;
- if `meta.postTurn` agent/source mismatches `meta.agentName` or
  `meta.frontendSource`, assistant recording can succeed but postTurn completion
  is skipped with a reason;
- if assistant content is empty or OneRing is disabled, postTurn completion is
  not attempted;
- if `store.completePostTurn()` returns `{ updated:false, reason }`, the wrapper
  returns `recorded:true`, the assistant id, and `postTurnCompleted:false`;
- wrapper tests must not touch real `Plugin/OneRing/data`.

Validation for that package:

```powershell
node --check Plugin/OneRing/OneRing.js
node --check tests/onering-plugin-wrapper.test.js
node --test tests/onering-plugin-wrapper.test.js tests/onering-post-turn-metadata.test.js tests/onering-store.test.js
git diff --check
```

## 9. Explicit Non-goals

This preflight and the next wrapper package must not:

- edit stream or non-stream handlers;
- change response JSON/SSE shape;
- change diary or chat log behavior;
- change `modules/oneringHandlerWiring.js`;
- expose raw `OneRingStore` through handler context;
- add admin routes or frontend controls;
- write real operator data;
- run migrations against non-temp databases;
- enable context patching;
- persist reasoning content;
- persist tool-call-only payloads;
- import upstream Rust/native code.

## 10. Stop Conditions

Stop before implementation if the next package requires:

- changing handler call sites;
- changing VCP loop behavior;
- modifying env/config defaults;
- touching real `Plugin/OneRing/data`;
- broadening from wrapper behavior into live recorder routing;
- adding a public store getter for handlers;
- changing `recordAIResponseFromMessages()` semantics.

## 11. Validation Plan

Docs-only validation:

```powershell
git diff --check
rg -n "recordAIResponse\\(|postTurnCompleted|completePostTurn|recordAIResponseFromMessages|Non-goals|Stop Conditions" docs/governance/ONERING_PLUGIN_WRAPPER_POSTTURN_PREFLIGHT_20260608.md
git status --short
```

No handler tests, service startup, SQLite operation, vector rebuild, Rust/native
build, real migration, or external API call is required for this preflight.

## 12. Preflight Result

Do not connect wrapper post-turn behavior to live handlers yet.

Proceed next with a plugin-wrapper-only package that teaches
`recordAIResponse(meta, assistantContent)` to return a persisted assistant id and
optionally complete `meta.postTurn` through the wrapper-owned store.

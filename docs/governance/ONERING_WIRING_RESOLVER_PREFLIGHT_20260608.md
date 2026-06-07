# OneRing Wiring Resolver Preflight - 2026-06-08

本包只新增 design / preflight 文档，不修改 `modules/oneringHandlerWiring.js`，
不修改 `modules/handlers/*`，不修改 `Plugin/OneRing/*`，不创建
SQLite/runtime 数据，不接 live handler 链路。

## 1. Context

| Item | Value |
| --- | --- |
| Local base | `da843938` / `origin/main` after #206 |
| Current branch | `codex/onering-wiring-resolver-preflight-20260608` |
| Prior package | #206 OneRing wrapper postTurn support |
| Package type | docs-only design/preflight |

This preflight designs the resolver change that should make #204 wiring prefer
the #206 wrapper-owned `recordAIResponse(meta, content)` path when
`metadata.postTurn` exists.

## 2. Current Local Reality

`modules/oneringHandlerWiring.js` currently builds dispatch metadata as:

```js
{
  phaseLabel,
  messages: context?.originalBody?.messages,
  postTurn: context?.oneRingPostTurn || null
}
```

It resolves recorders in this order:

1. explicit hook from `context.handleOneRingAssistantRecordCandidate` or
   `context.onOneRingAssistantRecordCandidate`;
2. OneRing plugin fallback through
   `oneRingModule.recordAIResponseFromMessages(metadata.messages,
   candidate.content)`;
3. no recorder.

It can also complete a post-turn through `context.oneRingPostTurnStore`, but
live handler contexts do not currently provide a raw store and should not need
to.

`Plugin/OneRing/OneRing.js` now supports:

```js
recordAIResponse(meta, assistantContent)
```

When `meta.postTurn` exists, the wrapper records the assistant message first and
then completes the post-turn through its own store. It returns the assistant
record result plus optional `postTurnCompleted` / `postTurnReason` fields.

## 3. Gap To Close

The local runtime-friendly path should be:

```text
handler
  -> oneringHandlerWiring builds metadata.postTurn
  -> resolver sees metadata.postTurn
  -> resolver calls oneRingModule.recordAIResponse(meta, candidate.content)
  -> wrapper records assistant and completes postTurn internally
```

The current fallback still calls `recordAIResponseFromMessages()`, which can
record the assistant message but cannot complete `metadata.postTurn`.

## 4. Resolver Decision

When resolving the OneRing plugin fallback:

```text
if metadata.postTurn exists
  and oneRingModule.recordAIResponse is a function
  -> call recordAIResponse(buildWrapperMeta(metadata), candidate.content)
else if recordAIResponseFromMessages exists
  -> keep current legacy fallback
else
  -> no recorder
```

`buildWrapperMeta(metadata)` should include:

```js
{
  agentName: metadata.postTurn.agentName,
  frontendSource: metadata.postTurn.frontendSource,
  postTurn: metadata.postTurn
}
```

Do not infer `agentName` or `frontendSource` from `metadata.messages` in this
resolver package. The post-turn metadata already owns the canonical request
identity for this path.

## 5. Avoiding Double Completion

#204 wiring still has a helper seam that can call
`completeOneRingPostTurnAfterRecord()` if `context.oneRingPostTurnStore` exists.
The wrapper-owned resolver path should not require that store seam.

Local policy:

- live handler contexts should rely on wrapper-owned completion;
- tests may keep the fake-store seam for helper-level coverage;
- if `recordAIResponse()` returns `postTurnCompleted` or `postTurnReason`, #204
  completion helper should treat that as wrapper-owned and skip any additional
  `context.oneRingPostTurnStore` completion;
- legacy explicit hooks remain unchanged, because callers that provide hooks own
  their own completion policy.

This prevents a future context that accidentally provides both wrapper completion
and a fake/raw store from completing the same turn twice.

## 6. Recommended Next Implementation Package

Recommended next package: **OneRing wiring resolver postTurn preference + tests**.

Allowed target files:

```text
modules/oneringHandlerWiring.js
tests/onering-handler-wiring.test.js
```

Do not modify:

```text
modules/handlers/streamHandler.js
modules/handlers/nonStreamHandler.js
Plugin/OneRing/*
modules/oneringStore.js
preprocessor_order.json
config.env
Plugin/OneRing/data/*
AdminPanel-Vue/dist/*
```

## 7. Minimum Tests For The Next Package

Tests should use fake plugin modules and fake stores only.

Minimum test cases:

- without `metadata.postTurn`, plugin fallback still calls
  `recordAIResponseFromMessages(messages, content)`;
- with `metadata.postTurn` and `recordAIResponse()`, plugin fallback calls
  `recordAIResponse({ agentName, frontendSource, postTurn }, content)`;
- when both wrapper methods exist and `metadata.postTurn` exists,
  `recordAIResponse()` wins over `recordAIResponseFromMessages()`;
- if `recordAIResponse()` is missing, postTurn path safely falls back to
  `recordAIResponseFromMessages()` only for assistant recording, with no thrown
  error;
- explicit hooks keep current behavior and are not overridden by plugin fallback;
- if wrapper result includes `postTurnCompleted` or `postTurnReason`,
  `completeOneRingPostTurnAfterRecord()` does not call `context.oneRingPostTurnStore`;
- existing fake-store helper test still proves non-wrapper completion when a
  custom hook returns only `{ recorded:true, id }`.

Validation for that package:

```powershell
node --check modules/oneringHandlerWiring.js
node --check tests/onering-handler-wiring.test.js
node --test tests/onering-handler-wiring.test.js tests/onering-post-turn-metadata.test.js
git diff --check
```

## 8. Explicit Non-goals

This preflight and the next resolver package must not:

- edit stream or non-stream handlers;
- change response JSON/SSE shape;
- change diary or chat log behavior;
- modify plugin wrapper behavior;
- expose raw `OneRingStore` through handler context;
- write real operator data;
- run migrations against non-temp databases;
- add admin routes or frontend controls;
- enable context patching;
- persist reasoning content;
- persist tool-call-only payloads;
- import upstream Rust/native code.

## 9. Stop Conditions

Stop before implementation if the next package requires:

- changing handler call sites;
- changing VCP loop behavior;
- touching `Plugin/OneRing/OneRing.js`;
- adding env/config defaults;
- writing `Plugin/OneRing/data`;
- changing `recordAIResponseFromMessages()` semantics;
- removing the explicit hook path;
- broadening into pending postTurn creation.

## 10. Validation Plan

Docs-only validation:

```powershell
git diff --check
rg -n "recordAIResponse\\(|recordAIResponseFromMessages|metadata.postTurn|postTurnCompleted|Non-goals|Stop Conditions" docs/governance/ONERING_WIRING_RESOLVER_PREFLIGHT_20260608.md
git status --short
```

No handler tests, service startup, SQLite operation, vector rebuild, Rust/native
build, real migration, or external API call is required for this preflight.

## 11. Preflight Result

Do not connect pending postTurn creation to live handlers yet.

Proceed next with a wiring resolver package that keeps handler call sites
unchanged and changes only plugin fallback selection in `oneringHandlerWiring`.

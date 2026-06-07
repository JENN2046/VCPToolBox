# OneRing Store Wiring Preflight - 2026-06-08

本包只新增 design / preflight 文档，不修改 `modules/handlers/*`，不修改
`Plugin/OneRing/*`，不修改 `modules/oneringStore.js`，不创建 SQLite/runtime
数据，不修改 `preprocessor_order.json`，不接入真实运行链路。

## 1. Context

| Item | Value |
| --- | --- |
| Local base | `6517a97d` / `origin/main` after #202 |
| Current branch | `codex/onering-store-wiring-preflight-20260608` |
| Prior package | #202 OneRing post-turn temp-store schema + tests |
| Package type | docs-only design/preflight |

This preflight designs the next local boundary between handler adapter output and
the new post-turn store API. It intentionally stops before live handler wiring.

## 2. Current Local Reality

The current OneRing chain is already split into small pieces:

- `modules/oneringHandlerAdapter.js` converts stream/non-stream handler results
  into visible assistant candidates.
- `modules/oneringPostTurnMetadata.js` builds pending, completed, and aborted
  post-turn metadata without side effects.
- `modules/oneringStore.js` now owns temp-path friendly `post_turns` methods:
  - `upsertPostTurn(metadata)`;
  - `completePostTurn(metadata, responseMessageId)`;
  - `abortPostTurn(metadata)`;
  - `listRecentCompletedPostTurns(agentName, frontendSource, options)`.
- `modules/oneringHandlerWiring.js` currently dispatches successful assistant
  candidates through a legacy recorder boundary with metadata shaped as:

```js
{
  phaseLabel,
  messages: context?.originalBody?.messages
}
```

The legacy fallback calls:

```js
oneRingModule.recordAIResponseFromMessages(metadata.messages, candidate.content)
```

`Plugin/OneRing/OneRing.js` also exposes `recordAIResponse(meta,
assistantContent)`, but it currently only records the assistant message and does
not complete a `post_turns` row.

## 3. Gap To Close

The missing local piece is not handler collection. The handler already produces a
final assistant candidate. The missing piece is a safe recorder/wiring contract
that can:

1. receive pending post-turn metadata from request context;
2. record the final visible assistant message;
3. obtain the inserted assistant `message.id`;
4. derive completed post-turn metadata;
5. call `store.completePostTurn(completedMetadata, message.id)`;
6. abort or skip the post-turn when the final assistant candidate is not
   recordable.

That contract must be testable without touching `modules/handlers/*`.

## 4. Proposed Local Metadata Key

Use a new optional metadata key at the wiring boundary:

```js
{
  phaseLabel,
  messages,
  postTurn
}
```

Where `postTurn` is the pending metadata object produced by
`buildPendingPostTurnMetadata()`.

Do not document or implement `metadata.originalBody.messages`; the current local
wiring uses `metadata.messages`, sourced from `context.originalBody.messages`.

## 5. Proposed Wiring Contract

The next implementation package should keep `dispatchOneRingAssistantRecordCandidate()`
as the handler-facing entrypoint and make it context-aware without changing
handler call sites.

Allowed behavior:

```text
candidate.shouldRecord !== true
  -> no assistant record
  -> if context.oneRingPostTurn exists and caller opts in, abort metadata through a pure/store boundary

candidate.shouldRecord === true, no postTurn metadata
  -> preserve current legacy behavior
  -> recordAIResponseFromMessages(metadata.messages, candidate.content)

candidate.shouldRecord === true, postTurn metadata exists
  -> prefer a post-turn-aware recorder path
  -> record final assistant message first
  -> complete postTurn only after assistant record returns a valid message id
```

Suggested recorder resolution order:

1. explicit hook from `context.handleOneRingAssistantRecordCandidate` or
   `context.onOneRingAssistantRecordCandidate`;
2. plugin method that can accept post-turn metadata, if added later;
3. current `recordAIResponseFromMessages()` fallback for legacy behavior.

The next package should not add a plugin method yet unless tests prove the
wiring contract first. A pure hook test is enough to lock the shape.

## 6. Store Completion Rules

Completion is downstream of successful assistant message persistence.

Required rules:

- never call `completePostTurn()` before the assistant message is recorded;
- require the recorder result to include a positive integer `id`;
- use `completePostTurnMetadata(postTurn, candidate)` to compute
  `responseContentHash`;
- pass the returned completed metadata plus the assistant message id to
  `store.completePostTurn()`;
- if assistant recording returns `{ recorded: false }`, do not complete the
  post-turn;
- if assistant recording throws, do not complete the post-turn;
- if `store.completePostTurn()` returns `{ updated: false }`, surface the reason
  in the async log/debug result but do not alter the client response path.

## 7. Abort / Skip Rules

Skipped candidates must not turn into successful post-turns.

Default local policy for the first wiring package:

- missing postTurn metadata: keep legacy skip behavior;
- non-recordable final candidate with postTurn metadata: call a pure abort helper
  or return an abort intent in tests, but do not require handler changes;
- failed upstream paths remain represented by adapter skip reasons such as
  `stream-error`, `stream-idle-timeout`, `client-abort`, or
  `empty-assistant-record-candidates`;
- tool-only turns remain skipped unless a later package designs explicit tool
  payload persistence.

If abort persistence requires handler lifecycle information that is not already
available in `oneringHandlerWiring.js`, stop and keep the package tests-only.

## 8. Recommended Next Implementation Package

Recommended next package: **OneRing store-aware wiring helper + tests**.

Allowed target files:

```text
modules/oneringHandlerWiring.js
tests/onering-handler-wiring.test.js
```

Optional only if the package stays pure and local:

```text
modules/oneringPostTurnMetadata.js
tests/onering-post-turn-metadata.test.js
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
```

## 9. Minimum Tests For The Next Package

The next package should prove behavior through hooks/fakes, not real handlers:

- legacy candidate dispatch still calls `recordAIResponseFromMessages(messages,
  content)`;
- dispatch metadata keeps the current `metadata.messages` key;
- when `context.oneRingPostTurn` exists and the fake recorder returns
  `{ recorded: true, id }`, wiring can produce a completed post-turn intent;
- completed metadata uses `completePostTurnMetadata()` and preserves
  `responseMessageId` ownership for the store layer;
- if the fake recorder returns `{ recorded: false }`, no completed post-turn is
  attempted;
- if the fake recorder throws, no completed post-turn is attempted and the
  dispatch path still returns without throwing synchronously;
- non-recordable candidates do not record assistant messages;
- missing postTurn metadata preserves current behavior.

If a fake store is introduced in tests, it must be an in-memory object, not a
SQLite file.

## 10. Explicit Non-goals

This preflight and the next wiring package must not:

- edit stream or non-stream handlers;
- change response JSON/SSE shape;
- change diary or chat log behavior;
- open real SQLite files;
- write `Plugin/OneRing/data`;
- run migrations against operator databases;
- add admin routes or frontend controls;
- enable context patching;
- persist reasoning content;
- persist tool-call-only payloads;
- import upstream Rust/native code.

## 11. Stop Conditions

Stop before implementation if the next package requires:

- changing handler call sites;
- changing VCP loop behavior;
- changing plugin initialization;
- adding env/config defaults;
- touching `modules/oneringStore.js` again;
- writing real runtime data;
- broadening from helper tests into live recorder behavior.

## 12. Validation Plan

Docs-only validation:

```powershell
git diff --check
rg -n "postTurn|metadata.messages|completePostTurn|recordAIResponseFromMessages|Non-goals|Stop Conditions" docs/governance/ONERING_STORE_WIRING_PREFLIGHT_20260608.md
git status --short
```

No handler tests, service startup, SQLite operation, vector rebuild, Rust/native
build, real migration, or external API call is required for this preflight.

## 13. Preflight Result

Do not connect OneRing store completion to handlers yet.

Proceed next with a store-aware wiring helper and focused tests only. The live
handler/runtime chain should remain unchanged until that helper contract is
reviewed.

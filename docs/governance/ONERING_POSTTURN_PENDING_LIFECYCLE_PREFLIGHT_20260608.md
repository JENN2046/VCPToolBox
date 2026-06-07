# OneRing Post-turn Pending Lifecycle Preflight - 2026-06-08

本包只新增 design / preflight 文档，不修改 `modules/handlers/*`，
不修改 `modules/chatCompletionHandler.js`，不修改 `Plugin/OneRing/*`，
不修改 `modules/oneringStore.js`，不创建 SQLite/runtime 数据，不修改
`preprocessor_order.json`，不接入新的 live handler 行为。

## 1. Context

| Item | Value |
| --- | --- |
| Local base | `3f417199` / `origin/main` after #208 |
| Current branch | `codex/onering-postturn-pending-lifecycle-preflight-20260608` |
| Prior packages | #202 post-turn store schema, #204 store-aware wiring helper, #206 wrapper postTurn completion, #208 wrapper resolver preference |
| Package type | docs-only design/preflight |

This preflight defines the missing pending-row lifecycle before any further live
handler wiring is opened.

## 2. Current Local Reality

The current local OneRing path is partially live:

- `modules/handlers/streamHandler.js` and
  `modules/handlers/nonStreamHandler.js` already collect final assistant
  candidates and call `dispatchOneRingAssistantRecordCandidate()`.
- `modules/oneringHandlerAdapter.js` records only explicit success results and
  skips abort / idle timeout / stream error / raw fallback / empty content.
- `modules/oneringHandlerWiring.js` now carries optional
  `metadata.postTurn` and, after #208, prefers
  `Plugin/OneRing/OneRing.js` `recordAIResponse(meta, content)` when
  `context.oneRingPostTurn` exists.
- `Plugin/OneRing/OneRing.js` can complete `meta.postTurn` through its own
  store after it records the assistant message.
- `modules/oneringStore.js` owns temp-path friendly `post_turns` methods.

The gap is that production request contexts do not currently provide
`context.oneRingPostTurn`. Repository search shows `oneRingPostTurn` exists only
inside helper tests and wiring code.

## 3. Risk Being Closed

If a future package only adds `context.oneRingPostTurn` but does not create a
matching pending store row first, the wrapper path can record the assistant
message and then return:

```text
{ recorded: true, id, postTurnCompleted: false, postTurnReason: "missing-pending-post-turn" }
```

That is safe but incomplete.

If a future package creates a pending row too early and does not abort or skip it
on request failure, it can leave stale `pending` rows for:

- upstream fetch failure before handlers run;
- upstream non-OK stream error chunks;
- client abort;
- stream idle timeout;
- stream read error;
- non-stream recursion failure;
- tool-only turns that intentionally clear OneRing candidates.

The next implementation must therefore treat pending creation, completion, and
abort/skip as one lifecycle, not as isolated plumbing.

## 4. Lifecycle Decision

Local policy:

```text
pending row creation belongs to the OneRing wrapper/store side
handler code receives only opaque pending metadata
assistant completion remains downstream of final assistant record success
failed or skipped final turns must not become completed post-turns
```

Handlers must not receive a raw `OneRingStore`. Live handlers should only see:

```js
context.oneRingPostTurn
```

and should keep calling the existing `dispatchOneRingAssistantRecordCandidate()`
entrypoint.

## 5. Proposed Metadata Side-channel

Use array-level metadata on the processed `messages` array as the narrow bridge
between the OneRing preprocessor/wrapper phase and `chatCompletionHandler`
context construction.

Suggested key:

```js
const ONERING_POST_TURN_METADATA_KEY = Symbol.for('vcp.onering.postTurn');
```

Suggested shape:

```js
{
  postTurn,
  prepared: true,
  reason: null
}
```

Rules:

- the metadata is a side-channel only; it must not be serialized into upstream
  request JSON;
- it may be non-enumerable to avoid accidental prompt contamination;
- `roleDivider.process()` already preserves string and symbol array-level
  metadata through `Reflect.ownKeys()`;
- `roleDivider.process()` preservation is not sufficient by itself, because the
  final chat pipeline can still replace the whole array after role-divider work;
- `chatCompletionHandler` may read this metadata from the final
  `processedMessages` array before creating handler context;
- if metadata is absent, existing legacy OneRing assistant recording behavior
  stays unchanged.

## 6. Final Array Replacement Boundary

The side-channel must survive the final `processedMessages` boundary, not only
individual preprocessor calls.

Known current replacement points:

- in experimental pipeline mode, `processFinalRoleDivider()` may call
  `roleDivider.process()` on slices and then return a fresh array literal;
- when final role divider is disabled, `processedMessages.map(...)` returns a
  fresh array after stripping the original top system prompt marker.

Both paths drop array-level string and symbol properties unless the final
pipeline explicitly copies them from the previous `processedMessages` array to
the replacement array.

Required rule:

```text
every final processedMessages replacement that may run after OneRing preparation
must preserve the OneRing side-channel before chatCompletionHandler reads it
```

The next implementation must therefore include a small preservation helper or
equivalent local code at the final `processedMessages` boundary, with tests for
both:

- `processFinalRoleDivider()` returning a fresh merged array;
- role-divider-disabled `.map(stripOriginalTopSystemPromptMarker)` returning a
  fresh array.

## 7. Pending Creation Owner

The preferred local owner is the OneRing plugin wrapper, not the live handlers.

Recommended wrapper contract for a later package:

```ts
preparePostTurnFromMessages(messages): {
  prepared: boolean,
  postTurn: object | null,
  reason: string | null
}
```

Allowed behavior:

- find the latest valid OneRing trigger from final processed messages;
- require OneRing effective enablement, including hot config;
- require the latest visible user text used by OneRing recording;
- build pending metadata with `buildPendingPostTurnMetadata()`;
- call `store.upsertPostTurn(pending.metadata)` only after all gates pass;
- attach the returned metadata to the messages array side-channel;
- return the original messages unchanged.

Disallowed behavior:

- writing pending rows while OneRing is disabled;
- writing pending rows without a valid trigger;
- writing pending rows for empty visible user input;
- writing pending rows from handler loop variables;
- serializing metadata into the prompt sent upstream;
- creating a raw store object in `chatCompletionHandler` or handlers.

## 8. Completion Path

The desired success path after later implementation:

```text
OneRing preprocessor/wrapper
  -> prepare pending metadata
  -> upsert pending row
  -> attach side-channel metadata to messages

chatCompletionHandler
  -> reads side-channel metadata
  -> passes context.oneRingPostTurn to StreamHandler / NonStreamHandler

handler final success
  -> dispatchOneRingAssistantRecordCandidate()
  -> resolver calls recordAIResponse({ agentName, frontendSource, postTurn }, content)
  -> wrapper records assistant message
  -> wrapper completes matching pending row
```

Completion remains owned by `recordAIResponse(meta, content)` after assistant
message persistence. `completePostTurn()` must not run before a successful
assistant `messages` row exists.

## 9. Failure / Skip Policy

Default policy for the first lifecycle implementation:

| Path | Pending row behavior |
| --- | --- |
| No trigger / disabled / empty user text | do not create pending row |
| Upstream fetch fails before handler starts | no handler completion; if pending was created, abort before returning error |
| Stream success final answer | complete through wrapper-owned `recordAIResponse(meta, content)` |
| Stream idle timeout / client abort / stream read error | do not complete; abort if pending was created and caller has a clear final skip reason |
| Non-stream upstream error before a parseable message | do not complete; abort if pending was created |
| VCP recursion upstream non-OK after tool call | clear final candidate; abort pending if lifecycle owner can observe the failure |
| Tool-only no-final-answer path | do not complete; abort with a tool-only/no-final-answer reason if pending exists |
| Recorder disabled after pending was prepared | do not complete; prefer abort or leave a bounded pending row with explicit reason only if abort is unavailable |

Implementation must not invent a successful assistant record from an error
chunk or partial content.

## 10. Abort Boundary

There are two viable abort strategies:

### Strategy A: Context-level abort helper

`chatCompletionHandler` creates a small lifecycle object and exposes only safe
methods to handlers:

```js
context.oneRingPostTurn = metadata
context.abortOneRingPostTurn(reason)
```

Handlers call the abort helper when they already clear the final OneRing
candidate because of a known final failure.

### Strategy B: Wrapper-owned cleanup after request

`chatCompletionHandler` owns a request-level finally/cleanup step:

```text
if pending exists and no completion was reported, abort with a known reason
```

This requires a reliable completion signal from `dispatchOneRingAssistantRecordCandidate()`.
The current dispatch function is async fire-and-forget, so this strategy should
not be used until completion observability is designed.

Initial recommendation: use Strategy A only if the next implementation can keep
handler edits tiny and focused. Otherwise open a separate abort observability
preflight before live changes.

## 11. Recommended Next Package

Recommended next package: **OneRing pending metadata side-channel helpers +
tests**, still not live handler wiring.

Allowed target files:

```text
modules/oneringPostTurnContext.js
tests/onering-post-turn-context.test.js
Plugin/OneRing/OneRing.js
tests/onering-plugin-wrapper.test.js
```

The package may be split smaller if review risk is high:

1. pure side-channel attach/read helpers only;
2. wrapper `preparePostTurnFromMessages()` with temp-store tests;
3. final `processedMessages` preservation plus context seeding package;
4. minimal handler abort package if needed.

## 12. Test Requirements For The Next Package

Minimum tests before live wiring:

- metadata side-channel is non-enumerable or otherwise not serialized by
  `JSON.stringify(messages)`;
- symbol-keyed and string-keyed metadata survive `roleDivider.process()`;
- symbol-keyed and string-keyed metadata survive `processFinalRoleDivider()`
  when it returns a fresh merged array around the original system prompt;
- symbol-keyed and string-keyed metadata survive the role-divider-disabled
  `processedMessages.map(stripOriginalTopSystemPromptMarker)` path;
- `chatCompletionHandler` reads `oneRingPostTurn` only from the final preserved
  array, not from an earlier array that may be replaced;
- absent metadata returns `null` and preserves legacy behavior;
- wrapper preparation skips when OneRing is disabled;
- wrapper preparation skips without a trigger;
- wrapper preparation skips when latest visible user text is empty;
- wrapper preparation upserts a pending row only in a temp store;
- wrapper preparation returns pending metadata matching trigger agent/source;
- pending metadata request hash is based on normalized final post blocks;
- no test writes `Plugin/OneRing/data`.

Validation for that package should include:

```powershell
node --check modules/oneringPostTurnContext.js
node --check Plugin/OneRing/OneRing.js
node --check tests/onering-post-turn-context.test.js
node --check tests/onering-plugin-wrapper.test.js
node --test tests/onering-post-turn-context.test.js tests/onering-plugin-wrapper.test.js tests/pipeline-order-contract.test.js
git diff --check
```

## 13. Explicit Non-goals

This preflight and the next helper package must not:

- modify `modules/handlers/streamHandler.js`;
- modify `modules/handlers/nonStreamHandler.js`;
- change response JSON/SSE shape;
- change VCP tool loop behavior;
- change diary or chat log behavior;
- expose raw `OneRingStore` through handler context;
- write real operator OneRing data;
- run migrations against non-temp databases;
- add admin routes or frontend controls;
- modify real env/config files;
- enable OneRing by default;
- persist hidden reasoning or tool payloads;
- import upstream Rust/native code.

## 14. Stop Conditions

Stop before implementation if the next package requires:

- broad edits across `chatCompletionHandler`, stream handler, and non-stream
  handler in one PR;
- changing `executeMessagePreprocessor()` return semantics globally;
- relying on serialized metadata in prompt messages;
- reading side-channel metadata before final `processedMessages` replacements
  have finished;
- adding a raw store getter to handlers;
- completing post-turns without a persisted assistant message id;
- recording aborted / idle / failed stream partials;
- writing `Plugin/OneRing/data` in tests;
- changing `preprocessor_order.json`.

## 15. Validation Plan

Docs-only validation:

```powershell
git diff --check
rg -n "pending|side-channel|oneRingPostTurn|preparePostTurnFromMessages|processFinalRoleDivider|stripOriginalTopSystemPromptMarker|abort|Non-goals|Stop Conditions" docs/governance/ONERING_POSTTURN_PENDING_LIFECYCLE_PREFLIGHT_20260608.md
git status --short
```

No handler execution, service startup, SQLite operation, vector rebuild,
Rust/native build, real migration, or external API call is required for this
preflight.

## 16. Preflight Result

Do not open direct live handler edits yet.

Proceed next with a side-channel/helper package that proves pending metadata can
be prepared, attached, preserved through final array replacements, read, and
kept out of upstream prompt JSON. After that, open a separate minimal
context-seeding package, then decide whether handler abort hooks are necessary.

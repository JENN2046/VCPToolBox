# OneRing Stream Adapter Result Consumption Preflight - 2026-06-06

本文件记录 OneRing handler adapter 消费 stream helper explicit result shape 的只读 preflight。

本包只新增文档，不修改 `modules/oneringHandlerAdapter.js`，不修改 `modules/handlers/streamHandler.js`，不接入 OneRing recorder，不创建 SQLite/runtime 数据，不修改 `preprocessor_order.json`。

## 1. Scope

| Item | Value |
|------|-------|
| Local base | `main` after #154 |
| Prior packages | #153 stream result-shape preflight, #154 stream result-shape implementation |
| Proposed change in this package | Documentation/preflight only |
| Explicitly excluded | handler wiring, recorder calls, SQLite, runtime data, preprocessor order |

Goal: decide whether the next small implementation package should align `modules/oneringHandlerAdapter.js` with the explicit stream helper result shape now emitted by `modules/handlers/streamHandler.js`.

## 2. Current Facts

`processAIResponseStreamHelper()` now preserves legacy fields and adds explicit metadata:

```ts
{
  content: string,
  raw: string,
  message: object,
  outcome: "success" | "idle-timeout" | "client-abort" | "stream-abort" | "stream-error",
  recordable: boolean,
  partial: boolean,
  error?: {
    name: string | null,
    message: string,
    type: string | null
  }
}
```

Current stream paths:

| Stream path | Helper `outcome` | `recordable` | `partial` |
|-------------|------------------|--------------|-----------|
| normal upstream end | `success` | `true` | `false` |
| idle timeout | `idle-timeout` | `false` | `true` |
| client abort | `client-abort` | `false` | `true` |
| aborted stream error | `stream-abort` | `false` | `true` |
| default helper shape | `stream-error` | `false` | `true` |

`modules/oneringHandlerAdapter.js` currently accepts several success aliases:

```js
const SUCCESS_OUTCOMES = new Set(['success', 'done', 'end']);
```

It also still recognizes pre-#154 legacy failure hints:

```js
aborted -> stream-aborted
idleTimeout -> stream-idle-timeout
error -> stream-error
missing outcome/status -> missing-stream-success
```

## 3. Consumption Question

The next implementation package can be small if it only changes the pure adapter layer:

- prefer the explicit stream helper fields `outcome`, `recordable`, and `partial`;
- keep invalid input behavior as `shouldRecord=false`;
- keep visible-text extraction behavior unchanged;
- keep non-stream adapter behavior unchanged unless a test proves a shared helper needs a tiny pure refactor.

The important rule is not "anything with message content can be recorded".

The important rule is:

```text
stream assistant content may be recorded only when the stream result explicitly says success and is not partial.
```

## 4. Proposed Adapter Rule

For `buildStreamAssistantRecordCandidate(streamResult)`:

1. Reject non-object inputs as `invalid-stream-result`.
2. Reject `recordable === false` before reading message content.
3. Reject `partial === true` before reading message content.
4. Accept success only when `outcome` or `status` is an allowed success marker.
5. Prefer canonical #154 outcomes in returned skip reasons.
6. Continue to ignore `reasoning_content`.
7. Continue to avoid mutating caller-owned result objects.

Suggested rule shape:

```text
if invalid input -> skip invalid-stream-result
if recordable === false -> skip outcome || status || non-recordable-stream-result
if partial === true -> skip outcome || status || partial-stream-result
if outcome/status is success -> parse visible message.content
otherwise -> skip outcome/status/missing-stream-success
```

This keeps the adapter defensive for future handler wiring while still preserving compatibility with test fixtures that use `status: "done"`.

## 5. Compatibility Decision

Keep `SUCCESS_OUTCOMES = ['success', 'done', 'end']` for now.

Reason:

- `streamHandler.js` now emits `success`;
- existing adapter tests intentionally accept `status: "done"`;
- removing aliases before wiring gives little safety benefit;
- a later wiring package can narrow accepted stream success markers after real caller shapes are visible.

Do not treat `recordable: true` alone as success. It should support, not replace, an explicit success marker.

## 6. Suggested Next Implementation Package

Allowed files:

```text
modules/oneringHandlerAdapter.js
tests/onering-handler-adapter.test.js
```

Allowed behavior change:

- make stream adapter consume #154 `recordable` and `partial` metadata;
- add tests proving `outcome="idle-timeout"`, `outcome="client-abort"`, `outcome="stream-abort"`, and `recordable=false` skip visible partial content;
- add tests proving `partial=true` skips even if content is present;
- keep explicit `success` recording path working;
- keep invalid input tests passing.

Explicitly excluded:

```text
modules/handlers/streamHandler.js
modules/handlers/nonStreamHandler.js
Plugin/OneRing/*
preprocessor_order.json
runtime/cache/state/debug files
```

## 7. Stop Conditions

Stop before implementation if the package requires:

- calling a OneRing recorder from any handler;
- adding SQLite or runtime storage;
- modifying `Plugin/OneRing/*`;
- changing client-facing stream/SSE behavior;
- changing diary/chat log behavior;
- changing non-stream result handling;
- changing `preprocessor_order.json`;
- recording aborted, timed-out, partial, or errored stream content.

## 8. Preflight Result

Proceed with a narrow pure adapter implementation package only.

Do not wire OneRing recorder into stream handlers yet. The next package should only teach `modules/oneringHandlerAdapter.js` and its tests to consume the #154 explicit stream helper metadata before any runtime handler integration is considered.

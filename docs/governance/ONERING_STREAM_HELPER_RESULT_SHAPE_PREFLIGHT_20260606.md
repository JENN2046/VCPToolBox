# OneRing Stream Helper Result Shape Preflight - 2026-06-06

本文件记录 OneRing handler wiring 前的 stream helper result shape 设计。

本包只新增 preflight/design 文档，不修改 `modules/handlers/streamHandler.js`，不新增 `Plugin/OneRing/*`，不修改 `preprocessor_order.json`，不创建 SQLite 或 runtime 数据。

## 1. Scope

| Item | Value |
|------|-------|
| Local base | `main` after #151/#152 |
| Prior packages | parser/marker, handler adapter, fuzzy helper, runtime ignore |
| Proposed change in this package | Documentation/design only |
| Explicitly excluded | stream handler implementation, OneRing recorder, SQLite, plugin registration |

The next implementation package may add an explicit result shape to the stream helper, but this package must not connect OneRing recording to handlers.

## 2. Current Stream Helper Shape

Current `processAIResponseStreamHelper()` resolves several different situations with the same object shape:

```js
{
  content: collectedContentThisTurn,
  raw: rawResponseDataThisTurn,
  message
}
```

Observed paths:

| Path | Current behavior | Risk for OneRing |
|------|------------------|------------------|
| normal `end` | resolve `{ content, raw, message }` | should be recordable only after explicit success |
| idle timeout | writes timeout chunk, destroys upstream body, resolves same shape | partial content must not be recorded |
| client abort | destroys upstream body, resolves same shape | aborted partial content must not be recorded |
| aborted stream error | resolves same shape when `streamAborted` / `AbortError` / `aborted` | failure must not look like success |
| stream read error | writes error SSE and rejects | should remain non-recordable |

This ambiguity is why `modules/oneringHandlerAdapter.js` currently requires an explicit stream success marker before recording.

## 3. Proposed Explicit Shape

Future stream helper results should add metadata while preserving existing fields:

```ts
{
  content: string,
  raw: string,
  message: {
    content: string,
    reasoning_content?: string
  },
  outcome: "success" | "idle-timeout" | "client-abort" | "stream-abort" | "stream-error",
  recordable: boolean,
  partial: boolean,
  error?: {
    name?: string,
    message?: string,
    type?: string
  }
}
```

Rules:

- Keep `content`, `raw`, and `message` for existing VCP loop behavior.
- Set `outcome="success"` only on normal upstream stream end.
- Set `recordable=true` only when `outcome="success"`.
- Set `partial=true` for timeout, abort, and aborted stream error paths.
- Do not add `reasoning_content` to any OneRing-persisted text.
- Do not change client-facing SSE shape in this package.
- Do not change diary or chat log behavior in this package.

## 4. Outcome Matrix

| Path | Future `outcome` | `recordable` | `partial` | OneRing adapter result |
|------|------------------|--------------|-----------|------------------------|
| normal stream end | `success` | `true` | `false` | may record visible `message.content` |
| idle timeout | `idle-timeout` | `false` | `true` | skip |
| client abort | `client-abort` | `false` | `true` | skip |
| aborted stream error | `stream-abort` | `false` | `true` | skip |
| stream read error reject | `stream-error` | `false` | `true` | skip / no candidate |

The adapter should continue to treat missing `outcome/status` as `missing-stream-success`.

## 5. Compatibility Requirements

A future implementation package must prove:

- Existing consumers can still read `content`, `raw`, and `message`.
- Normal successful streams produce `outcome="success"`.
- Idle timeout path does not produce `outcome="success"`.
- Client abort path does not produce `outcome="success"`.
- Aborted stream error path does not produce `outcome="success"`.
- Non-aborted stream read errors still reject or surface as existing error behavior.
- No handler wiring calls OneRing recorder in the same package unless explicitly approved.

## 6. Suggested Next Implementation Package

Target files may be:

```text
modules/handlers/streamHandler.js
tests/stream-handler-result-shape.test.js
```

Allowed behavior change:

- Add explicit internal result metadata to `processAIResponseStreamHelper()` results.
- Preserve existing response forwarding, VCP loop, diary, chat log, and tool loop semantics.

Do not modify:

```text
modules/handlers/nonStreamHandler.js
Plugin/OneRing/*
preprocessor_order.json
```

Minimum tests:

- normal stream fixture returns `outcome="success"` and `recordable=true`;
- idle timeout fixture returns `outcome="idle-timeout"` and `recordable=false`;
- client abort fixture returns `outcome="client-abort"` or equivalent non-success outcome;
- aborted stream error fixture returns non-success outcome;
- legacy fields `content`, `raw`, and `message` remain present;
- no test writes runtime OneRing data or calls SQLite.

## 7. Stop Conditions

Stop before implementation if the package requires:

- connecting OneRing recorder to handlers;
- adding `Plugin/OneRing/*`;
- creating or opening SQLite files;
- modifying real env/config files;
- changing `preprocessor_order.json`;
- changing client-facing SSE payload shape;
- changing diary or chat log behavior;
- recording partial aborted/stalled stream content.

## 8. Preflight Result

Do not wire OneRing into stream handlers yet.

Proceed next with a narrow stream helper result-shape implementation package only. Handler recording should remain a later package after success/failure result metadata is explicit and tested.

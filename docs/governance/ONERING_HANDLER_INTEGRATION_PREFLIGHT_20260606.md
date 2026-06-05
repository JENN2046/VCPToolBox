# OneRing Handler Integration Preflight - 2026-06-06

本文件记录 OneRing handler integration 的实现前设计边界。

本包只新增 preflight/design 文档，不修改 `modules/handlers/*`，不新增 `Plugin/OneRing/*`，不修改 `preprocessor_order.json`，不创建 SQLite 或 runtime 数据。

## 1. Scope

| Item | Value |
|------|-------|
| Local base | `main` after #148 |
| Prior package | `modules/oneringParser.js` + `tests/onering-parser.test.js` |
| Proposed change in this package | Documentation/design only |
| Explicitly excluded | handlers, SQLite, plugin registration, preprocessor order |

The next implementation package may add test seams or pure adapter tests, but this package must not connect OneRing to the live request/response path.

## 2. Handler Reality Check

Current local stream path:

- `modules/handlers/streamHandler.js` collects `delta.content` into `message.content`;
- the same path currently also appends `delta.reasoning_content` into `collectedContentThisTurn`;
- aborted, stalled, and stream read error paths resolve or reject through different branches.

Current local non-stream path:

- `modules/handlers/nonStreamHandler.js` parses `choices[0].message`;
- `fullContentFromAI` may include `reasoning_content` when `HIDE_NONSTREAM_REASONING=false`;
- the initial raw response is also passed to diary handling.

Design consequence:

OneRing must not persist handler loop variables directly. Future integration needs a visible-content-only adapter that extracts assistant text from the response message shape and ignores `reasoning_content` regardless of local display/debug settings.

## 3. Integration Boundary

Allowed future handler integration shape:

```text
handler receives upstream response
handler preserves existing client response behavior
handler extracts visible assistant text through a small adapter
handler calls OneRing recorder after upstream success only
OneRing recorder failure is logged/debug-visible but does not alter client response
```

Forbidden future integration shape:

```text
handler imports SQLite store directly
handler writes OneRing data before upstream success
handler persists collectedContentThisTurn or fullContentFromAI directly
handler changes response JSON/SSE shape
handler changes diary/chat log behavior as a side effect
handler enables context patching
```

## 4. Success And Failure Matrix

| Path | Upstream result | Candidate OneRing action | Required rule |
|------|-----------------|--------------------------|---------------|
| stream | normal `[DONE]` / end | record visible assistant text | no reasoning persistence |
| stream | idle timeout with partial text | no record by default | partial recording needs separate decision |
| stream | client abort | no record by default | do not convert abort into success |
| stream | stream read error | no record | failed upstream must not create success record |
| non-stream | HTTP ok + parseable message | record visible `message.content` | ignore `reasoning_content` |
| non-stream | HTTP ok + raw non-chat body | no record by default | fallback raw recording needs separate decision |
| non-stream | fetch/upstream error | no record | preserve existing error behavior |
| VCP loop | tool calls follow initial answer | record only final approved phase if designed | no hidden tool payload persistence |

## 5. Adapter Requirements

A future handler adapter should be pure and separately testable.

Minimum input candidates:

- stream final `message` object;
- non-stream parsed `choices[0].message`;
- optional request metadata already visible to OneRing, such as `agentName`, `senderName`, and `frontendSource`.

Minimum output:

```ts
{
  shouldRecord: boolean,
  role: "assistant",
  content: string,
  reason: string | null
}
```

Adapter rules:

- return `shouldRecord=false` for empty visible content;
- ignore `reasoning_content` in every mode;
- do not read env values directly;
- do not write files or databases;
- do not mutate handler response objects;
- keep stream and non-stream fixtures separate.

The existing `getVisibleMessageText()` helper in `modules/oneringParser.js` is suitable as the lowest-level visible-text extractor, but handler integration still needs success/failure classification around it.

## 6. Test Plan For The Next Implementation Package

Recommended next package: pure handler adapter tests only.

Target files may be:

```text
modules/oneringHandlerAdapter.js
tests/onering-handler-adapter.test.js
```

Do not modify:

```text
modules/handlers/streamHandler.js
modules/handlers/nonStreamHandler.js
Plugin/OneRing/*
preprocessor_order.json
```

Minimum tests:

- stream success records only `message.content`;
- stream success ignores `message.reasoning_content`;
- stream abort returns `shouldRecord=false`;
- stream read error returns `shouldRecord=false`;
- non-stream success records only `choices[0].message.content`;
- non-stream ignores `choices[0].message.reasoning_content` even when a display setting would show it;
- empty visible content is skipped;
- adapter does not require SQLite or plugin setup.

Validation:

```powershell
node --check modules/oneringHandlerAdapter.js
node --check tests/onering-handler-adapter.test.js
node --test tests/onering-handler-adapter.test.js
git diff --check
```

## 7. Stop Conditions

Stop before implementation if the package requires:

- editing stream/non-stream handlers;
- adding `Plugin/OneRing/*`;
- creating or opening SQLite files;
- modifying real env/config files;
- changing `preprocessor_order.json`;
- recording aborted stream partials;
- recording raw fallback bodies;
- persisting `reasoning_content`;
- changing response shape, diary behavior, chat logs, or VCP loop semantics.

## 8. Preflight Result

Do not connect OneRing to handlers yet.

Proceed next with a pure handler adapter test package only. Live handler wiring should remain a later package after adapter behavior is reviewed and the success/failure matrix is accepted.

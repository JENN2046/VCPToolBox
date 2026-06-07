# OneRing Post-turn Metadata Preflight - 2026-06-07

本包只新增 design / preflight 文档，不修改 `modules/handlers/*`，不修改
`Plugin/OneRing/*`，不修改 `modules/oneringStore.js`，不创建 SQLite/runtime
数据，不修改 `preprocessor_order.json`，不接入真实 recorder。

## 1. Context

| Item | Value |
| --- | --- |
| Local base | `d92c3add` / `origin/main` after #198 |
| Current branch | `codex/onering-post-turn-metadata-preflight-20260607` |
| Prior package | #198 OneRing SQL/hash contract fixtures |
| Upstream reference | `postTurns` / `oneRingResponseMeta` from latest upstream OneRing SQL/hash-only line |
| Package type | docs-only design/preflight |

This preflight designs how upstream-style post-turn metadata should map onto the
current local handler adapter without changing live handlers yet.

## 2. Current Local Reality

Local OneRing handler integration is still intentionally small:

- `modules/oneringHandlerAdapter.js` builds visible assistant record candidates
  only after explicit stream / non-stream success.
- `modules/oneringHandlerWiring.js` dispatches a successful candidate with
  metadata containing `phaseLabel` and `originalBody.messages`.
- `Plugin/OneRing/OneRing.js` currently supports:
  - `recordAIResponseFromMessages(messages, assistantContent)`;
  - `recordAIResponse(meta, assistantContent)`.
- `modules/oneringSqlHashContract.js` now provides:
  - `buildOneRingContentHash()`;
  - `buildOneRingRequestHash()`;
  - `normalizeRequestBlocks()`;
  - `storeRowsToDiffBlocks()`.
- `modules/oneringStore.js` currently stores only `messages`; it has no
  `postTurns` table locally.

The next design must therefore stay adapter-first. It must not force handler or
store changes before metadata contracts are tested.

## 3. Upstream Shape Being Evaluated

The latest upstream SQL/hash-only line introduces a `postTurns` table shape:

```text
turnId TEXT PRIMARY KEY
agentName TEXT NOT NULL
frontendSource TEXT NOT NULL
requestHash TEXT NOT NULL
requestBlockCount INTEGER NOT NULL
status TEXT NOT NULL
responseMessageId INTEGER
responseContentHash TEXT
createdAt TEXT NOT NULL
updatedAt TEXT NOT NULL
completedAt TEXT
abortedAt TEXT
```

It also routes final assistant recording through handler metadata similar to
`oneRingResponseMeta`, instead of rediscovering the trigger from raw messages at
response time.

## 4. Local Metadata Contract

The local contract should use an opaque metadata object carried from the
preprocessor side to the final assistant recorder:

```ts
{
  turnId: string,
  agentName: string,
  frontendSource: string,
  requestHash: string,
  requestBlockCount: number,
  responseMessageId: number | null,
  responseContentHash: string | null,
  status: "pending" | "completed" | "aborted",
  createdAt: string,
  updatedAt: string,
  completedAt: string | null,
  abortedAt: string | null
}
```

### Field mapping

| Field | Local source | Handler responsibility |
| --- | --- | --- |
| `turnId` | Generated before handler work, preferably from request hash + timestamp/random suffix | Treat as opaque; never derive from assistant content |
| `agentName` | OneRing trigger metadata | Pass through only |
| `frontendSource` | OneRing trigger metadata | Pass through only |
| `requestHash` | `buildOneRingRequestHash(postBlocks)` | Pass through only |
| `requestBlockCount` | `normalizeRequestBlocks(postBlocks).length` | Pass through only |
| `responseMessageId` | Store layer after final assistant insert/update | Handler should not invent it |
| `responseContentHash` | `buildOneRingContentHash(finalAssistantContent)` after candidate success | Can be computed by adapter/recorder boundary, not raw handler loop state |
| `status` | Starts as `pending`; becomes `completed` only after final assistant record succeeds | Handler failure/abort must not complete it |
| timestamps | Preprocessor / recorder clock | Handler should not repair or infer DB timestamps |

## 5. Adapter Boundary

The next implementation package should add pure metadata helpers, not handler
wiring.

Recommended target files:

```text
modules/oneringPostTurnMetadata.js
tests/onering-post-turn-metadata.test.js
```

Suggested pure helper outputs:

```ts
buildPendingPostTurnMetadata({ agentName, frontendSource, postBlocks, now, makeId })
completePostTurnMetadata(pendingMeta, assistantCandidate)
abortPostTurnMetadata(pendingMeta, reason)
```

Rules:

- `buildPendingPostTurnMetadata()` computes `requestHash` and
  `requestBlockCount` from normalized post blocks.
- `completePostTurnMetadata()` requires `assistantCandidate.shouldRecord === true`
  and non-empty visible assistant content.
- `completePostTurnMetadata()` computes `responseContentHash` from candidate
  content, but leaves `responseMessageId` null until a store package can set it.
- `abortPostTurnMetadata()` records aborted status without assistant content.
- All helpers are pure and side-effect-free.
- Invalid metadata returns a safe skip/error result; it must not throw in handler
  paths unless the caller explicitly chooses strict mode.

## 6. Success / Failure Matrix

| Path | Candidate state | Metadata result |
| --- | --- | --- |
| stream final success | `shouldRecord=true` | `pending -> completed`, `responseContentHash` set |
| non-stream final success | `shouldRecord=true` | `pending -> completed`, `responseContentHash` set |
| stream idle timeout | `shouldRecord=false` | remain pending or mark aborted by explicit caller decision; never completed |
| client abort | `shouldRecord=false` | mark aborted only if handler has explicit abort signal |
| upstream fetch/error | no successful candidate | no completed post-turn |
| VCP tool-only intermediate | no final visible answer | no completed post-turn |
| missing metadata | successful candidate may still use legacy recorder, but no post-turn completion |

The important rule is:

```text
post-turn completion is downstream of final assistant recording success, not
upstream request receipt.
```

## 7. Store Boundary

This package does not add a `postTurns` table.

Future store work should be separate and must prove:

- temp-path SQLite only;
- path containment;
- create-table / migration idempotence;
- pending turn upsert;
- completed turn update with `responseMessageId`;
- aborted turn update without response content;
- no real `Plugin/OneRing/data` writes in tests.

Until then, `responseMessageId` should stay nullable in pure metadata helpers.

## 8. Handler Boundary

Do not change `modules/handlers/streamHandler.js` or
`modules/handlers/nonStreamHandler.js` in the next package.

When handler wiring is eventually opened, handlers should only:

- receive an already-built metadata object from the preprocessor / request
  context;
- pass metadata into `dispatchOneRingAssistantRecordCandidate()`;
- never write SQLite directly;
- never compute `turnId` from assistant text;
- never complete metadata for aborted / idle / failed upstream paths;
- preserve existing client response, diary, chat log, and VCP loop behavior.

## 9. Explicit Non-goals

This preflight must not:

- edit stream or non-stream handlers;
- edit `Plugin/OneRing/OneRing.js`;
- add `postTurns` to `modules/oneringStore.js`;
- write `Plugin/OneRing/data`;
- change `preprocessor_order.json`;
- enable context patching;
- record failed upstream responses;
- record tool-only or intermediate VCP assistant turns;
- persist hidden reasoning or tool payloads.

## 10. Validation Plan

Docs-only validation:

```powershell
git diff --check
rg -n "turnId|requestHash|responseMessageId|postTurns|handler|Out Of Scope|Non-goals" docs/governance/ONERING_POST_TURN_METADATA_PREFLIGHT_20260607.md
git status --short
```

No tests, service startup, SQLite operation, vector rebuild, Rust/native build,
handler execution, or external API call is required for this design package.

## 11. Recommended Next Package

If accepted, the next safe package should be
**OneRing post-turn metadata pure helpers + tests**:

- add `modules/oneringPostTurnMetadata.js`;
- add `tests/onering-post-turn-metadata.test.js`;
- test pending / complete / abort metadata transitions;
- keep `responseMessageId` nullable;
- do not touch handlers, store schema, plugin wrapper, or real runtime data.

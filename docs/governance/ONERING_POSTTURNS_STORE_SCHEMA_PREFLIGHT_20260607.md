# OneRing postTurns Store Schema Preflight - 2026-06-07

本包只新增 design / preflight 文档，不修改 `modules/oneringStore.js`，不修改
`Plugin/OneRing/*`，不修改 `modules/handlers/*`，不创建真实
`Plugin/OneRing/data`，不运行 SQLite migration，不修改 `preprocessor_order.json`。

## 1. Context

| Item | Value |
| --- | --- |
| Local base | `011ceda1` / `origin/main` after #200 |
| Current branch | `codex/onering-postturns-store-schema-preflight-20260607` |
| Prior package | #200 OneRing post-turn metadata pure helpers |
| Upstream reference | latest upstream `Plugin/OneRing/OneRingDB.js` `postTurns` table |
| Package type | docs-only design/preflight |

This preflight designs the local `postTurns` store schema and state-update
contract before any store implementation is opened.

## 2. Current Local Store Reality

`modules/oneringStore.js` currently owns a temp-path friendly SQLite store for
visible conversation messages only:

```text
messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  sender_name TEXT NOT NULL,
  frontend_source TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  post_context_hash TEXT
)
```

Existing safety properties:

- explicit `baseDir` is required;
- `fileName` path traversal is rejected;
- tests create SQLite files only under OS temp dirs;
- no real `Plugin/OneRing/data` writes are needed for tests;
- store close is idempotent;
- message retention is bounded by `maxRecords`.

`modules/oneringPostTurnMetadata.js` now provides pure pending / completed /
aborted metadata transitions and intentionally keeps `responseMessageId`
nullable until store code owns message IDs.

## 3. Upstream Shape Being Evaluated

Upstream currently creates:

```text
postTurns(
  turnId TEXT PRIMARY KEY,
  agentName TEXT NOT NULL,
  frontendSource TEXT NOT NULL,
  requestHash TEXT NOT NULL,
  requestBlockCount INTEGER NOT NULL,
  status TEXT NOT NULL,
  responseMessageId INTEGER,
  responseContentHash TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  completedAt TEXT,
  abortedAt TEXT
)
```

Upstream methods include:

- `insertPostTurn()`
- `getPostTurn()`
- `getRecentCompletedPostTurn()`
- `completePostTurn()`
- `markPostTurnAborted()`

The local implementation should not raw-copy upstream naming or SQL blindly:
local `messages` columns already use snake_case, path containment is stricter,
and local helpers use normalized JS field names.

## 4. Local Schema Decision

Use snake_case SQLite column names while preserving camelCase JS objects at the
module boundary.

Proposed table:

```sql
CREATE TABLE IF NOT EXISTS post_turns (
  turn_id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  frontend_source TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  request_block_count INTEGER NOT NULL CHECK (request_block_count >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'aborted')),
  response_message_id INTEGER,
  response_content_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  aborted_at TEXT,
  FOREIGN KEY (response_message_id) REFERENCES messages(id) ON DELETE SET NULL
);
```

Indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_onering_post_turns_agent_frontend_updated
ON post_turns (agent_name, frontend_source, updated_at);

CREATE INDEX IF NOT EXISTS idx_onering_post_turns_request_hash
ON post_turns (agent_name, frontend_source, request_hash);

CREATE INDEX IF NOT EXISTS idx_onering_post_turns_status_updated
ON post_turns (status, updated_at);
```

Rationale:

- table name follows local snake_case style;
- `response_message_id` can link to `messages.id` later;
- `ON DELETE SET NULL` prevents normal message retention pruning from failing
  when old referenced assistant messages are deleted;
- nullable response fields preserve the #200 pure helper contract;
- `CHECK` constraints make invalid states fail in store tests, not at runtime
  after handler wiring.

## 5. Retention And Foreign-key Contract

`OneRingStore.addMessage()` currently calls `_pruneAgent()` after every insert.
That pruning deletes old `messages` rows once `maxRecords` is exceeded. Future
`post_turns.response_message_id` references must not make ordinary message
append fail with `FOREIGN KEY constraint failed`.

Local policy for the first store package:

- use `ON DELETE SET NULL` for `response_message_id`;
- keep the completed `post_turns` row even if the referenced assistant message is
  later pruned;
- after the reference is nulled, `listRecentCompletedPostTurns()` must exclude
  that row from message-backed replay candidates because it requires
  `response_message_id IS NOT NULL`;
- do not cascade-delete `post_turns` in the first package, because the turn row
  still carries useful request / completion audit metadata;
- add a temp-db test where a completed post turn references an assistant message,
  then message retention pruning deletes that message without failing the next
  `addMessage()` call.

## 6. Migration Contract

Schema creation must be idempotent:

- constructing `OneRingStore` on a fresh temp db creates `messages` and
  `post_turns`;
- constructing it again against the same temp db does not drop data;
- adding the table to an existing temp db containing only `messages` preserves
  all message rows;
- schema initialization must not require handler, plugin wrapper, or env access.

No migration package should touch real operator databases until temp-path tests
prove the behavior.

## 7. State Update Contract

Suggested future store methods:

```ts
upsertPostTurn(metadata)
getPostTurn(agentName, turnId)
completePostTurn(metadata, responseMessageId)
abortPostTurn(metadata)
listRecentCompletedPostTurns(agentName, frontendSource, options)
```

### `upsertPostTurn(metadata)`

- accepts only normalized metadata from `normalizePostTurnMetadata()`;
- inserts a pending row by `turn_id`;
- on conflict, updates request identity fields and `updated_at`;
- must not overwrite a completed or aborted row back to pending unless a future
  explicit repair mode is designed;
- returns the stored row as camelCase JS fields.

### `completePostTurn(metadata, responseMessageId)`

- requires metadata status `completed`;
- requires a positive integer `responseMessageId`;
- validates that the referenced `messages` row belongs to
  `metadata.agentName`, belongs to `metadata.frontendSource`, and has
  `role = 'assistant'`;
- if the referenced message is missing, belongs to another agent/frontend, or is
  not an assistant message, returns a safe `{ updated: false, reason }` result;
- stores `response_content_hash`, `completed_at`, and `updated_at`;
- updates only rows currently in `pending` status;
- if no pending row matches, returns a safe `{ updated: false, reason }` result
  instead of throwing into handler paths.

### `abortPostTurn(metadata)`

- requires metadata status `aborted`;
- stores `aborted_at` and `updated_at`;
- clears response fields;
- updates only rows currently in `pending` status;
- if no pending row matches, returns a safe `{ updated: false, reason }` result.

### `listRecentCompletedPostTurns(...)`

- returns only `status = 'completed'` rows;
- requires `response_message_id IS NOT NULL`;
- orders by `updated_at DESC`;
- default limit should be bounded.

## 8. Test Contract For The Next Package

The next implementation package may modify only:

```text
modules/oneringStore.js
tests/onering-store.test.js
```

Minimum tests:

- creates `post_turns` in a temp db without touching real runtime data;
- schema creation is idempotent;
- existing `messages` rows survive post_turns migration;
- `upsertPostTurn()` stores pending metadata and returns camelCase fields;
- `completePostTurn()` requires a positive `responseMessageId`;
- `completePostTurn()` rejects `responseMessageId` rows from another agent;
- `completePostTurn()` rejects `responseMessageId` rows from another frontend;
- `completePostTurn()` rejects `responseMessageId` rows whose role is not
  `assistant`;
- `completePostTurn()` updates only pending rows;
- `abortPostTurn()` clears response fields and updates only pending rows;
- completed rows are returned by recent-completed query in newest-first order;
- pruning old referenced assistant messages sets `response_message_id` to null
  instead of failing message insertion;
- closed store rejects post-turn operations;
- invalid metadata returns safe results or throws only in already-established
  store-validation style, not in handler paths.

Validation for that package:

```powershell
node --check modules/oneringStore.js
node --test tests/onering-store.test.js tests/onering-post-turn-metadata.test.js
git diff --check
```

## 9. Explicit Non-goals

This preflight and the next store-schema package must not:

- edit stream or non-stream handlers;
- edit `Plugin/OneRing/OneRing.js`;
- connect recorder wiring to post-turn completion;
- write real `Plugin/OneRing/data`;
- run migrations against operator databases;
- modify `preprocessor_order.json`;
- enable context patching;
- import upstream `Plugin/OneRing/OneRingDB.js`;
- touch Rust/native files or `.node` binaries.

## 10. Rollback And Safety

Rollback must be simple:

- docs-only package rollback removes this file;
- future store package rollback removes the added store methods / tests;
- no live runtime state should be created during tests;
- if a temp db contains `post_turns`, removing the local feature should not
  affect existing `messages` behavior.

## 11. Validation Plan

Docs-only validation:

```powershell
git diff --check
rg -n "post_turns|ON DELETE SET NULL|upsertPostTurn|completePostTurn|abortPostTurn|temp db|Non-goals" docs/governance/ONERING_POSTTURNS_STORE_SCHEMA_PREFLIGHT_20260607.md
git status --short
```

No SQLite operation, handler test, service startup, vector rebuild, Rust/native
build, real migration, or external API call is required for this preflight.

## 12. Recommended Next Package

If accepted, the next safe package should be
**OneRing postTurns temp-store schema + tests**:

- modify only `modules/oneringStore.js` and `tests/onering-store.test.js`;
- use temp SQLite paths only;
- add `post_turns` schema and store methods;
- keep handler, plugin wrapper, env, and runtime data untouched.

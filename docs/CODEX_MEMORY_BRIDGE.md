# CodexMemoryBridge

**Version:** 1.1.0  
**Last Updated:** 2026-04-13  
**Scope:** `Plugin/CodexMemoryBridge/`

---

## 1. Purpose

`CodexMemoryBridge` is the policy gate for normal Codex memory writes.

- It enforces write-time rules at tool level (not only prompt-level guidance).
- It records every allow/reject decision for audit.
- It does not replace dream-channel persistence.

---

## 2. Write Targets

- `process`
- `knowledge`

`process` is for checkpoints, risks, todos, pending items, and stage conclusions.  
`knowledge` is for reusable and validated conclusions.

---

## 3. Policy Rules

### Shared Rules

- `title`, `content`, and `evidence` must all be present.
- Caller must be `agentAlias=Codex`.
- Any rule violation is handled as `fail-closed` (`decision=rejected`).

### `knowledge` Rules (strict)

- `validated=true` and `reusable=true` are both required.
- `sensitivity` must be exactly `none`.

### `process` Rules (relaxed on 2026-04-13)

- Content must include one of: `checkpoint`, `risk`, `todo`, `pending`, `stage-conclusion`.
- `sensitivity=none` is accepted.
- Non-`none` sensitivity is accepted unless it matches high-risk markers.
- High-risk markers are rejected, including:  
  `secret`, `unsafe`, `credential`, `password`, `token`, `api key`.

---

## 4. Execution Context

Bridge evaluation depends on execution context passed from tool execution:

- `VCP_EXECUTION_CONTEXT`
- `VCP_AGENT_ALIAS`
- `VCP_AGENT_ID`
- `VCP_REQUEST_SOURCE`

If context is missing or alias is not `Codex`, write is rejected.

---

## 5. Audit Log

Every bridge decision is appended to:

- `logs/codex-memory-bridge.jsonl`

Main fields:

- `timestamp`
- `agentAlias`
- `agentId`
- `decision`
- `target`
- `title`
- `memoryId`
- `reason`
- `filePath`

---

## 6. Storage and Recall Consistency

`knowledge` writes now target the canonical diary:

- write target maid: `[Codex的知识]Codex`
- diary folder: `dailynote/Codex的知识/`

`search_memory` for `target=knowledge` queries the same canonical diary name from:

- `modules/codexMemoryConstants.js`

This alignment prevents "accepted write but search miss" caused by mismatched diary names.

---

## 7. Admin Monitoring

Bridge runtime observability is available in AdminPanel:

- menu entry: `Codex Memory Bridge`
- overview API: `GET /admin_api/codex-memory/overview`
- frontend module: `AdminPanel/js/codex-memory-monitor.js`
- backend route: `routes/admin/codexMemory.js`

---

## 8. Related Files

- `Plugin/CodexMemoryBridge/plugin-manifest.json`
- `Plugin/CodexMemoryBridge/codex-memory-bridge.js`
- `modules/codexMemoryConstants.js`
- `modules/codexMemorySearch.js`
- `modules/vcpLoop/toolExecutor.js`
- `routes/codexMemoryMcp.js`
- `routes/admin/codexMemory.js`
- `AdminPanel/js/codex-memory-monitor.js`

---

## 9. 2026-04-13 Change Notes

- Relaxed `process` sensitivity policy (no longer binary reject for all non-`none` values).
- Kept `knowledge` policy strict (`sensitivity=none` + `validated=true` + `reusable=true`).
- Fixed `knowledge` write path to canonical `Codex的知识` diary for search consistency.

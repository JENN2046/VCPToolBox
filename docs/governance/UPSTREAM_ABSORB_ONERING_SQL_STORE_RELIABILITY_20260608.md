# Upstream Absorb OneRing SQL Store Reliability - 2026-06-08

本文件记录 `b3f5840c..0c841d2a` Oring 范围中的一个小型 SQL/store
可靠性吸收包。

本包不 raw-merge upstream `Plugin/OneRing/OneRingDB.js`。本包只把可安全映射到
本地 `modules/oneringStore.js` 的 owner-scoped message update 行为吸收到本地
store API 和 temp-path tests。

## 1. Scope

| Item | Value |
| --- | --- |
| Local branch | `codex/onering-upstream-20260608-preflight` |
| Upstream range | `b3f5840c..0c841d2a` |
| Main upstream evidence | `5b606b6b`, `e478faa6` |
| Local package type | narrow store reliability implementation |

## 2. Upstream Evidence

The relevant upstream behavior is that message updates should return SQLite
change information and should not update arbitrary rows outside the intended
agent scope.

Observed upstream snippets:

```text
5b606b6b: updateMessageById returns db.run() result
e478faa6: updateMessageById guards by agentName and id
```

## 3. Local Mapping

Local code does not use upstream `OneRingDB.js` directly. It uses
`modules/oneringStore.js`, so the safe local mapping is:

```text
OneRingStore.updateMessageContent(messageId, patch)
```

The method:

- requires a valid positive message id;
- requires `agentName`;
- requires non-empty visible `content`;
- optionally scopes by `frontendSource`;
- optionally scopes by `role`;
- optionally updates `timestamp`;
- returns `{ updated, reason, row }`;
- never creates real `Plugin/OneRing/data`;
- does not change plugin enablement or handler wiring.

## 4. Changed Files

```text
modules/oneringStore.js
tests/onering-store.test.js
docs/governance/UPSTREAM_ABSORB_ONERING_20260608_RANGE_PREFLIGHT.md
docs/governance/UPSTREAM_ABSORB_ONERING_SQL_STORE_RELIABILITY_20260608.md
```

## 5. Explicit Non-goals

This package does not:

- import upstream `Plugin/OneRing/OneRingDB.js`;
- import timeline modules;
- import `onring.bak.js`;
- add native/Rust files;
- touch `Plugin/OneRing/OneRing.js`;
- touch stream/non-stream handlers;
- write real OneRing runtime data;
- change OneRing default enablement.

## 6. Validation

Expected validation:

```powershell
node --check modules/oneringStore.js
node --check tests/onering-store.test.js
node --test tests/onering-store.test.js tests/onering-plugin-wrapper.test.js
git diff --check
```

All SQLite writes in tests must remain under temp directories.

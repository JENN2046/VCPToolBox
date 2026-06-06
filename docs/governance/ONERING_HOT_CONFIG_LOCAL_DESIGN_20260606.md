# OneRing Hot Config Local Design - 2026-06-06

本文件定义 OneRing hot-config 在本地吸收线中的策略边界。

本包只新增设计文档，不新增 `Plugin/OneRing/*`，不修改 handlers，不修改 `routes/admin/finalContext.js`，不修改 `AdminPanel-Vue/src/*`，不修改 `AdminPanel-Vue/dist/*`，不创建 `OneRingConfig.json`。

## 1. Background

Upstream commit `f456575f` moved several OneRing runtime controls into `Plugin/OneRing/OneRingConfig.json` and added:

- plugin-side `chokidar` hot reload;
- `enabled`, `tailTagPlacement`, `maxContextBlocks`, and `timeInsert` runtime settings;
- admin `GET/PUT /admin_api/onering-config`;
- a FinalContextViewer config modal;
- built `AdminPanel-Vue/dist/*` artifacts.

Local state after #159:

- #158 already absorbed the safe display-only final-context badges;
- #159 classified the remainder as a OneRing hot-config专项;
- local `Plugin/OneRing/` is still absent;
- local OneRing work currently lives in pure modules, adapter tests, and minimal handler wiring.

## 2. Design Decision

Do not adopt upstream hot-config as a raw merge.

Local strategy:

```text
plugin semantics first
runtime config ownership second
admin write API third
frontend config UI last
```

The first local hot-config implementation, if opened later, should be plugin-local and default-safe. It must not require an admin write route or frontend modal.

## 3. Configuration Ownership

`OneRingConfig.json` is operator-owned runtime state, not a checked-in source default.

Rules:

- Do not commit real `Plugin/OneRing/OneRingConfig.json`.
- Do not create `Plugin/OneRing/OneRingConfig.json` during normal tests.
- Do not make admin UI create the file before plugin behavior and path rules are implemented.
- A future `config.env.example` may document defaults, but must clearly mark them as examples.
- A future plugin package may create an in-memory normalized default when the file is missing.

Recommended ignore coverage before any runtime config implementation:

```text
Plugin/OneRing/OneRingConfig.json
Plugin/OneRing/OneRingConfig.*.json
Plugin/OneRing/data/
Plugin/OneRing/*.db
Plugin/OneRing/*.db-wal
Plugin/OneRing/*.db-shm
```

## 4. Local Default Policy

Local defaults must remain conservative.

Recommended normalized defaults:

```json
{
  "enabled": false,
  "tailTagPlacement": "inline",
  "maxContextBlocks": 10,
  "timeInsert": false
}
```

Rationale:

- `enabled=false` keeps OneRing opt-in until the plugin package is reviewed.
- `tailTagPlacement=inline` preserves the smallest behavior change for existing marker parsing.
- `maxContextBlocks=10` keeps future context expansion bounded.
- `timeInsert=false` avoids silent timeline reordering until cross-context patching is explicitly approved.

If a later package wants upstream's active defaults (`enabled=true`, `timeInsert=true`), it must call out operator impact in the PR body and include tests.

## 5. Allowed Future Hot-Config Scope

The first implementation package may include only plugin-local pieces, after `Plugin/OneRing/` exists locally:

- config schema constants;
- pure normalization helpers;
- read-only config load from a contained path;
- missing-file fallback to safe normalized defaults;
- watcher setup and shutdown behavior;
- tests using a temp directory.

It must not include:

- admin `PUT /admin_api/onering-config`;
- frontend config modal;
- generated `dist` assets;
- real `Plugin/OneRing/OneRingConfig.json`;
- SQLite creation in real plugin paths;
- cross-frontend context patching defaults.

## 6. Admin API Policy

No admin write API in the hot-config design package.

Before adding any admin config endpoint, a separate package must answer:

- which auth/session boundary protects `/admin_api/onering-config`;
- whether writes are allowed only when `Plugin/OneRing/` exists;
- whether the endpoint can create parent directories;
- how invalid config is normalized and reported;
- how rollback works if a bad runtime config is saved;
- whether write operations need audit logs or explicit operator confirmation.

Recommended future API shape, if approved:

```text
GET /admin_api/onering-config
PUT /admin_api/onering-config
```

The future `PUT` must write only to a controlled path and must not accept arbitrary file paths from the client.

## 7. Frontend UI Policy

No frontend config modal until the backend write contract exists.

When opened later, frontend work should be source-only:

```text
AdminPanel-Vue/src/api/system.ts
AdminPanel-Vue/src/types/api.system.ts
AdminPanel-Vue/src/views/FinalContextViewer.vue
```

Still exclude:

```text
AdminPanel-Vue/dist/*
```

The UI should display current normalized config and submit only known fields:

- `enabled`
- `tailTagPlacement`
- `maxContextBlocks`
- `timeInsert`

It must not expose arbitrary path editing or raw JSON upload.

## 8. Test Requirements For Implementation

Future plugin-local tests should cover:

- missing file returns safe defaults;
- invalid booleans normalize safely;
- invalid `tailTagPlacement` falls back to `inline`;
- invalid `maxContextBlocks` falls back to `10`;
- watcher shutdown closes without throwing;
- temp config file changes update normalized state;
- no files are created under real `Plugin/OneRing/` paths.

Future admin API tests should cover:

- `GET` missing config response;
- `PUT` normalization;
- write path containment;
- malformed request body;
- missing plugin directory behavior;
- no acceptance of client-supplied path fields.

## 9. Stop Conditions

Stop and split the package if implementation would require:

- changing handlers and config loading in the same PR;
- adding frontend modal and backend write route together;
- committing `OneRingConfig.json`;
- enabling OneRing by default;
- changing `preprocessor_order.json`;
- creating SQLite/runtime files during tests;
- adding `AdminPanel-Vue/dist/*`.

## 10. Next Package Recommendation

The next implementation package should be one of:

1. **OneRing plugin-local hot config helpers**
   - after deciding to import or locally implement `Plugin/OneRing/*`;
   - no admin route and no frontend UI.

2. **OneRing plugin package decision**
   - decide whether to import upstream plugin files or continue local modular implementation.

Do not start with admin config UI. The UI is only useful after local plugin config semantics exist.

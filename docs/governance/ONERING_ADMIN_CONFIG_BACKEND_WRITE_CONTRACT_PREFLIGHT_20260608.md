# OneRing Admin Config Backend Write Contract Preflight - 2026-06-08

本包只新增 design / preflight 文档，不修改 `Plugin/OneRing/*`，
不修改 `routes/admin/*`，不修改 `AdminPanel-Vue/src/*`，不修改
`AdminPanel-Vue/dist/*`，不创建或提交真实 `Plugin/OneRing/OneRingConfig.json`。

## 1. Context

| Item | Value |
| --- | --- |
| Local base | `7356eaa3` / `origin/main` after #214 |
| Current branch | `codex/onering-admin-config-write-contract-20260608` |
| Prior package | #213 live final-dispatch lazy prepare; #214 ledger closeout |
| Package type | docs-only design/preflight |

OneRing JS line is now locally implemented through a default-off thin wrapper,
temp-path store contracts, postTurn metadata helpers, wrapper-owned postTurn
completion, resolver preference, and final-dispatch lazy prepare.

The next risky boundary is not frontend UI. It is the backend write contract for
the hot config file that a future admin endpoint may edit.

## 2. Current Local Reality

Current code already has these local pieces:

- `modules/oneringHotConfig.js`
  - `DEFAULT_ONERING_HOT_CONFIG`
  - `normalizeOneRingHotConfig(raw)`
  - `readOneRingHotConfigFile(configPath, options)`
- `Plugin/OneRing/OneRing.js`
  - reads hot config from `ONERING_HOT_CONFIG_PATH` or
    `Plugin/OneRing/OneRingConfig.json`;
  - keeps runtime effective enablement behind both `ONERING_ENABLED` and
    hot config `enabled === true`;
  - does not create the config file when it is missing.
- `tests/onering-hot-config.test.js`
  - verifies missing files return safe defaults without creating files;
  - verifies invalid JSON returns defaults;
  - verifies normalization of supported fields.

There is still no OneRing admin route, no frontend modal, and no checked-in real
`OneRingConfig.json`.

## 3. Decision

The next implementation should be a backend write-contract package, not a full
admin UI package.

Recommended local order:

```text
write-contract helper/tests
-> admin GET/PUT route tests
-> source-only frontend modal
-> optional operator docs
```

The first package after this preflight should define a small helper that can be
unit-tested without mounting the admin app and without writing to the real
plugin path.

## 4. Config Shape

Only these fields are accepted:

```json
{
  "enabled": false,
  "tailTagPlacement": "inline",
  "maxContextBlocks": 10,
  "timeInsert": false
}
```

Rules:

- unknown keys are rejected, not silently persisted;
- missing known keys are filled from safe defaults;
- values are normalized through `normalizeOneRingHotConfig()`;
- `enabled` remains `false` unless explicitly supplied as true by the operator;
- `tailTagPlacement` accepts only normalized local values:
  - `inline`
  - `system_user_block`
- `maxContextBlocks` must remain a positive integer after normalization;
- `timeInsert` remains `false` unless explicitly supplied as true.

The route must not edit `ONERING_ENABLED`, `ONERING_DATA_DIR`, or
`ONERING_HOT_CONFIG_PATH`. Those remain env/runtime config, not admin hot config
fields.

## 5. Path Contract

The backend must resolve exactly one controlled target path:

```text
Plugin/OneRing/OneRingConfig.json
```

Path rules:

- do not accept a client-supplied path;
- resolve the target from the server project root;
- verify the resolved target stays under `Plugin/OneRing/`;
- verify the filename is exactly `OneRingConfig.json`;
- create the `Plugin/OneRing/` directory only if the local plugin package
  exists in source;
- never create `Plugin/OneRing/data/` as part of config writes;
- never write `config.env`, `config.env.example`, `.env`, runtime state,
  SQLite files, or generated assets.

Tests must use a temp project root and temp plugin directory. They must not
write to the real repository `Plugin/OneRing/OneRingConfig.json`.

## 6. Write Semantics

Recommended helper:

```js
readOneRingAdminConfig({ projectRoot })
writeOneRingAdminConfig({ projectRoot, config })
```

`readOneRingAdminConfig()` should return:

```js
{
  config,
  exists,
  path: 'Plugin/OneRing/OneRingConfig.json',
  error: null | string
}
```

`writeOneRingAdminConfig()` should:

- require an object payload;
- reject unknown keys before normalization;
- normalize accepted fields;
- write pretty JSON with trailing newline;
- write to a same-directory temp file first;
- atomically rename temp file to `OneRingConfig.json`;
- clean up the temp file on failure when safe;
- return the normalized config and relative path;
- never echo raw filesystem internals to the client response.

If the current platform cannot guarantee atomic rename across devices, the temp
file must still live in the same directory as the final target.

## 7. Admin Route Contract

Recommended route names, if the later route package is opened:

```text
GET /admin_api/onering-config
PUT /admin_api/onering-config
```

Route behavior:

- `GET` returns normalized config plus `exists`;
- missing file returns defaults and `exists:false`;
- invalid existing JSON returns defaults and a sanitized `error`;
- `PUT` accepts either a raw config object or `{ config: object }`;
- `PUT` returns the normalized saved config;
- malformed payload returns `400`;
- unknown keys return `400`;
- filesystem errors return `500` with sanitized details;
- successful write does not enable OneRing unless the saved hot config and
  runtime `ONERING_ENABLED` are both true.

The route package should be backend-only. It must not include frontend source or
`AdminPanel-Vue/dist/*`.

## 8. Auth And Operator Boundary

This preflight does not introduce a new auth model. The future route must be
mounted only under the existing admin API surface.

Minimum requirements for the route package:

- use the same router mounting path as other admin routes;
- do not expose the endpoint under public chat/completion routes;
- do not add unauthenticated standalone HTTP listeners;
- do not bypass existing admin session/auth checks if present in the mounted
  admin stack;
- include tests that instantiate the route through the same factory pattern used
  by nearby admin route tests.

If the current admin stack cannot prove a shared auth/session boundary for this
route, stop and split out an auth-boundary preflight before implementing writes.

## 9. Hot Reload Policy

The write contract does not need to force live reload.

Acceptable first behavior:

- write the normalized JSON;
- rely on existing wrapper reads / future watcher package to observe changes;
- return a clear response that config was saved.

Do not add `chokidar`, long-lived watchers, handler reloads, or live context
patching in the backend write package. If immediate reload is needed later, open
a separate package with watcher lifecycle tests.

## 10. Tests For The Next Package

Recommended target files for a helper-only package:

```text
modules/oneringAdminConfig.js
tests/onering-admin-config.test.js
```

Minimum tests:

- missing config returns safe defaults and does not create a file;
- valid write creates temp-path `Plugin/OneRing/OneRingConfig.json`;
- saved JSON contains only known normalized fields;
- unknown keys are rejected and do not create or modify the file;
- non-object payload is rejected;
- invalid existing JSON is reported but normalized defaults are returned;
- path containment rejects project roots that would resolve outside the temp
  root;
- write uses same-directory temp file before rename;
- helper never writes to the real repository plugin path.

Validation for that package:

```powershell
node --check modules/oneringAdminConfig.js
node --check tests/onering-admin-config.test.js
node --test tests/onering-admin-config.test.js tests/onering-hot-config.test.js
git diff --check
```

## 11. Explicit Non-goals

This preflight and the next helper package must not:

- create or commit real `Plugin/OneRing/OneRingConfig.json`;
- modify `config.env` or `config.env.example`;
- modify `Plugin/OneRing/OneRing.js`;
- modify live handlers;
- modify store schema or runtime SQLite files;
- add admin routes and frontend UI in the same package;
- add `AdminPanel-Vue/dist/*`;
- enable OneRing by default;
- change default `preprocessor_order.json`;
- add Rust/native code or binary files.

## 12. Stop Conditions

Stop before implementation if the backend write contract would require:

- accepting arbitrary file paths from the client;
- writing outside `Plugin/OneRing/`;
- changing env variables through the OneRing config endpoint;
- creating runtime data directories;
- changing handler behavior;
- turning on OneRing by default;
- coupling backend route, frontend modal, and generated dist into one PR;
- running tests against real operator config or real runtime DB files.

## 13. Validation Plan For This Preflight

Docs-only validation:

```powershell
git diff --check
rg -n "OneRingConfig.json|writeOneRingAdminConfig|GET /admin_api/onering-config|PUT /admin_api/onering-config|Non-goals|Stop Conditions" docs/governance/ONERING_ADMIN_CONFIG_BACKEND_WRITE_CONTRACT_PREFLIGHT_20260608.md
git status --short
```

No service startup, admin route mount, frontend build, SQLite write, real config
write, watcher, vector rebuild, or external API call is required for this
preflight.

## 14. Preflight Result

Proceed next with a helper-only backend write-contract package:

```text
modules/oneringAdminConfig.js
tests/onering-admin-config.test.js
```

Do not implement the live admin route or frontend modal until the helper
contract has passed review and CI.

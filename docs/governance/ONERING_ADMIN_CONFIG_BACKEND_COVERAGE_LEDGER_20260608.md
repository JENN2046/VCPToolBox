# OneRing Admin Config Backend Coverage Ledger - 2026-06-08

本文件是单文件台账核销包，用于记录 OneRing admin config backend
已经由 #215 / #216 覆盖到后端实现层。

本包只新增本台账文件，不修改 OneRing 插件、admin route、前端源码、
`AdminPanel-Vue/dist/*`、真实 `Plugin/OneRing/OneRingConfig.json`，也不创建
OneRing runtime data。

## 1. 核销结论

OneRing admin config backend 已经由 #215 / #216 覆盖到后端实现层。

具体边界如下：

| PR | 覆盖内容 | 结论 |
| --- | --- | --- |
| #215 | backend write contract / preflight | 已覆盖设计合同 |
| #216 | backend helper、admin route、route/helper tests | 已覆盖后端实现 |

因此，后续不应再把“实现 OneRing admin config backend”列为未完成项。
剩余工作应改按更窄的后续边界描述，例如 frontend modal、live reload、
operator docs，或上游最新 Oring SQL/timeline/native 管线专项。

## 2. 已覆盖证据

### #215

合入提交：

```text
46ae8db1 Merge pull request #215 from JENN2046/codex/onering-admin-config-write-contract-20260608
87d44629 docs: preflight onering admin config writes
```

覆盖文件：

```text
docs/governance/ONERING_ADMIN_CONFIG_BACKEND_WRITE_CONTRACT_PREFLIGHT_20260608.md
```

覆盖内容：

- 受控目标路径：`Plugin/OneRing/OneRingConfig.json`;
- client 不可提供任意 path;
- 字段白名单：`enabled`, `tailTagPlacement`, `maxContextBlocks`, `timeInsert`;
- unknown keys 必须拒绝;
- 缺省值保持安全默认关闭;
- route 行为、错误语义、写入语义和测试边界已经定义;
- 明确不覆盖 frontend modal、live reload、真实 runtime config 文件和
  `AdminPanel-Vue/dist/*`。

### #216

合入提交：

```text
57afd801 Merge pull request #216 from JENN2046/codex/onering-admin-config-backend-20260608
49ba53a5 feat: add onering admin config backend
8b80521f fix: surface onering config read failures
```

覆盖文件：

```text
modules/oneringAdminConfig.js
routes/admin/finalContext.js
tests/onering-admin-config.test.js
```

覆盖内容：

- `readOneRingAdminConfig()`;
- `writeOneRingAdminConfig()`;
- `validateOneRingAdminConfigPayload()`;
- `getRequestOneRingAdminConfig()`;
- `GET /admin_api/onering-config`;
- `PUT /admin_api/onering-config`;
- temp project root based tests;
- invalid payload `400`;
- config read failure sanitized `500`;
- no real repository config write during tests.

## 3. Current Backend Behavior

Current backend behavior is:

- `GET /admin_api/onering-config` returns normalized config, `exists`, path, and
  sanitized error state;
- missing config returns safe defaults and does not create a config file;
- invalid JSON returns safe defaults with `error: "invalid-json"`;
- `PUT /admin_api/onering-config` accepts either a raw config object or
  `{ "config": object }`;
- supported fields are normalized through `normalizeOneRingHotConfig()`;
- unknown keys are rejected before write;
- writes use a same-directory temp file before rename;
- write target is fixed to `Plugin/OneRing/OneRingConfig.json`;
- write requires the local `Plugin/OneRing/` source directory to exist;
- route responses avoid exposing raw filesystem internals.

## 4. Safety Confirmations

This coverage does not mean OneRing is enabled by default.

Confirmed backend boundaries:

- no change to `ONERING_ENABLED`;
- no change to `.env` or `config.env`;
- no committed real `Plugin/OneRing/OneRingConfig.json`;
- no committed `Plugin/OneRing/data/*`;
- no default `preprocessor_order.json` change;
- no frontend modal or generated `AdminPanel-Vue/dist/*` in #215 / #216;
- no live reload watcher;
- no Rust/native import.

OneRing remains gated by runtime env enablement and hot config enablement.

## 5. Not Covered By This Backend Closeout

The following remain separate work items and must not be treated as covered by
#215 / #216:

- AdminPanel frontend OneRing config modal;
- generated frontend build artifacts;
- live hot reload / watcher lifecycle;
- operator documentation for using the config endpoint;
- importing or reconciling upstream latest Oring timeline / SQL / native
  pipeline changes after `b3f5840c`;
- committing a real default `Plugin/OneRing/OneRingConfig.json`;
- enabling OneRing by default.

## 6. Recommended Queue Update

If a future queue or handoff still says "implement OneRing admin config backend",
rewrite it as:

```text
done: OneRing admin config backend covered by #215 / #216.
remaining: frontend config UI, optional operator docs, live reload policy, and
latest upstream Oring pipeline reconciliation.
```

## 7. Validation Plan For This Ledger

Docs-only validation is sufficient:

```powershell
git diff -- docs/governance/ONERING_ADMIN_CONFIG_BACKEND_COVERAGE_LEDGER_20260608.md
rg -n "#215|#216|onering-config|writeOneRingAdminConfig|GET /admin_api/onering-config|PUT /admin_api/onering-config|Not Covered" docs/governance/ONERING_ADMIN_CONFIG_BACKEND_COVERAGE_LEDGER_20260608.md
git status --short
```

No service startup, admin API call, config write, SQLite write, frontend build,
external API call, push, deploy, or bridge action is required.

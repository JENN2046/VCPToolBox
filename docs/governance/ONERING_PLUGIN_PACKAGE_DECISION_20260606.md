# OneRing Plugin Package Decision - 2026-06-06

本文件决定 OneRing 专项接下来是否导入 upstream `Plugin/OneRing/*`，或继续本地模块化实现。

本包只新增决策文档，不新增 `Plugin/OneRing/*`，不修改 handlers，不修改 admin routes，不修改 frontend，不创建 SQLite 或 runtime config。

## 1. Context

Local OneRing work already exists as small reviewed packages:

| Area | Local files |
|------|-------------|
| Parser/marker helpers | `modules/oneringParser.js`, `tests/onering-parser.test.js` |
| Fuzzy helpers | `modules/oneringFuzzy.js`, `tests/onering-fuzzy.test.js` |
| Handler adapter | `modules/oneringHandlerAdapter.js`, `tests/onering-handler-adapter.test.js` |
| Handler wiring helper | `modules/oneringHandlerWiring.js`, handler tests |
| Stream result shape | `modules/handlers/streamHandler.js`, tests |
| Minimal handler wiring | `modules/handlers/streamHandler.js`, `modules/handlers/nonStreamHandler.js`, tests |

Relevant governance docs:

- `UPSTREAM_ABSORB_ONERING_SPECIAL_PREFLIGHT_20260606.md`
- `ONERING_LOCAL_DESIGN_20260606.md`
- `ONERING_HANDLER_INTEGRATION_PREFLIGHT_20260606.md`
- `ONERING_STREAM_HELPER_RESULT_SHAPE_PREFLIGHT_20260606.md`
- `ONERING_STREAM_ADAPTER_RESULT_CONSUMPTION_PREFLIGHT_20260606.md`
- `UPSTREAM_ABSORB_F456575F_ONERING_REMAINDER_PREFLIGHT_20260606.md`
- `ONERING_HOT_CONFIG_LOCAL_DESIGN_20260606.md`

Upstream `Plugin/OneRing/*` is a larger plugin package with SQLite persistence, fuzzy diff, snapshot logic, tail marker placement, hot config, plugin manifest, and env docs.

## 2. Options

### Option A: Raw import upstream `Plugin/OneRing/*`

Benefits:

- Faster apparent feature parity with upstream.
- Keeps upstream file layout and docs recognizable.
- May reduce one-time manual porting of plugin internals.

Costs and risks:

- Imports a large runtime surface in one package.
- Introduces SQLite persistence paths before local runtime-data policy is implemented.
- Brings upstream defaults and plugin config semantics that conflict with local default-off design.
- Requires reconciliation with already absorbed local modules and handler adapters.
- Increases risk of duplicated parser/fuzzy logic drifting between `modules/*` and `Plugin/OneRing/*`.
- Makes review harder because plugin import, config, DB behavior, and manifest semantics arrive together.

### Option B: Continue local modular implementation

Benefits:

- Preserves the small reviewed surfaces already merged locally.
- Lets parser, fuzzy, adapter, config, store, and plugin registration remain separately testable.
- Keeps runtime writes and SQLite paths out until a dedicated store package.
- Keeps handler behavior protected by the existing explicit-result and final-turn success rules.
- Allows upstream algorithms to be ported selectively instead of raw-merged.
- Matches the local hot-config design: plugin semantics first, runtime config ownership second, admin write API third, frontend UI last.

Costs and risks:

- Slower than a raw import.
- Requires manual mapping from upstream plugin code into local module boundaries.
- Some upstream plugin README/config text may need rewriting instead of direct reuse.
- Feature parity must be tracked explicitly.

## 3. Decision

Choose **Option B: continue local modular implementation**.

Do not raw-import upstream `Plugin/OneRing/*` as the next package.

Allowed future use of upstream plugin files:

- read as reference;
- port narrow pure functions or algorithms into existing `modules/onering*.js`;
- use upstream test cases as fixtures after adapting them to local helper APIs;
- copy documentation language only when it matches local default-off policy.

Forbidden for the next implementation package:

- adding the full `Plugin/OneRing/` directory;
- adding `Plugin/OneRing/OneRingConfig.json`;
- adding real SQLite data paths;
- changing `preprocessor_order.json`;
- enabling OneRing by default;
- adding admin `PUT /admin_api/onering-config`;
- adding frontend config modal;
- adding `AdminPanel-Vue/dist/*`.

## 4. Local Architecture Direction

Keep OneRing as local composable modules first:

```text
modules/oneringParser.js
modules/oneringFuzzy.js
modules/oneringHandlerAdapter.js
modules/oneringHandlerWiring.js
future modules/oneringHotConfig.js
future modules/oneringStore.js
future Plugin/OneRing/OneRing.js thin wrapper
```

The eventual `Plugin/OneRing/OneRing.js`, if added, should be a thin integration wrapper around local modules. It should not reimplement parser/fuzzy/adapter logic privately.

## 5. Next Implementation Boundary

The next safe implementation package should be:

```text
OneRing plugin-local hot config helpers
```

Suggested scope:

- add a pure/local `modules/oneringHotConfig.js`;
- add `tests/onering-hot-config.test.js`;
- implement normalization only:
  - `enabled`;
  - `tailTagPlacement`;
  - `maxContextBlocks`;
  - `timeInsert`;
- default to:

```json
{
  "enabled": false,
  "tailTagPlacement": "inline",
  "maxContextBlocks": 10,
  "timeInsert": false
}
```

Explicit exclusions:

- no file watcher yet;
- no `Plugin/OneRing/*`;
- no admin route;
- no frontend UI;
- no real `OneRingConfig.json`;
- no SQLite;
- no handler changes.

This package would create the config normalization seam needed before any plugin wrapper or admin API exists.

## 6. Later Package Sequence

After hot-config helpers:

1. **OneRing store design or temp-path store tests**
   - define runtime data path policy;
   - use temp paths only;
   - no real plugin data writes.

2. **Thin plugin wrapper**
   - add `Plugin/OneRing/OneRing.js` only when local helper modules are ready;
   - default disabled/record-only;
   - no context patching by default.

3. **Runtime config file loader/watcher**
   - only after ignore rules and temp-path tests exist;
   - missing file returns safe defaults.

4. **Admin config API**
   - separate package;
   - path-contained write tests;
   - explicit missing-plugin behavior.

5. **Frontend config UI**
   - source-only;
   - depends on API package;
   - still excludes `dist`.

## 7. Review Checklist For Future Packages

Every future OneRing package should answer:

- Does it write runtime files?
- Does it create or touch SQLite?
- Does it change handler success/failure behavior?
- Does it change request context content?
- Does it store reasoning or hidden content?
- Does it enable OneRing by default?
- Does it duplicate logic already present in local `modules/onering*.js`?
- Can it be tested with temp paths or pure fixtures?
- Is rollback a file-level revert?

## 8. Validation For This Decision Package

This package should only require:

```powershell
git diff --check
rg -n "Option B|continue local modular implementation|Do not raw-import|oneringHotConfig" docs/governance/ONERING_PLUGIN_PACKAGE_DECISION_20260606.md
```

No service startup, plugin execution, admin API call, SQLite operation, runtime config creation, vector rebuild, frontend build, or external write is needed.

## 9. Decision Summary

Continue local modular implementation.

Treat upstream `Plugin/OneRing/*` as reference material, not an import target. The next code package should create a pure hot-config normalization seam in `modules/`, with tests, and no runtime writes.

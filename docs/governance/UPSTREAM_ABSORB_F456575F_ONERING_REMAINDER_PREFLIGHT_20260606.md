# Upstream Absorb f456575f OneRing Remainder Preflight - 2026-06-06

本文件记录 upstream commit `f456575f` (`Oring系统大量细节优化`) 在 #158 之后的剩余吸收评估。

本包只新增文档，不吸收运行代码，不新增 `Plugin/OneRing/*`，不修改 admin write API，不修改 `AdminPanel-Vue/dist/*`，不创建 `OneRingConfig.json`。

## 1. Current Local State

| Item | Value |
|------|-------|
| Local base | `main` after #158 (`db4b5d12`) |
| Upstream commit | `f456575f4ca109eb1ffa11dea4ca7f475c6a121b` |
| Already absorbed | #158 source-only final context block badges |
| Local `Plugin/OneRing` directory | not present |
| Proposed change in this package | documentation/preflight only |

## 2. Already Absorbed

#158 absorbed the safe source-only subset in:

```text
AdminPanel-Vue/src/views/FinalContextViewer.vue
```

Behavior now present locally:

- user blocks starting with `[系统提示` are labeled as `伪系统块`;
- user blocks starting with `[系统通知` are labeled as `携带通知栏`;
- the jump index and block header both show the badge.

This was intentionally limited to display-only behavior. It does not add OneRing config APIs, does not save config, and does not import built frontend artifacts.

## 3. Remaining Upstream Payload

The remaining non-dist files from `f456575f` are:

| Area | Files | Nature |
|------|-------|--------|
| Frontend config UI | `AdminPanel-Vue/src/views/FinalContextViewer.vue` | adds OneRing hot-config modal and save button |
| Frontend API/types | `AdminPanel-Vue/src/api/system.ts`, `AdminPanel-Vue/src/types/api.system.ts` | adds `getOneRingConfig()` / `saveOneRingConfig()` contracts |
| Admin route | `routes/admin/finalContext.js` | adds `GET/PUT /admin_api/onering-config` |
| Plugin hot config | `Plugin/OneRing/OneRing.js`, `config.env.example`, `plugin-manifest.json`, `OneRingConfig.json` | moves runtime controls into hot-loaded JSON |
| Built assets | `AdminPanel-Vue/dist/*` | generated build output |

## 4. Why This Should Not Be Raw-Absorbed

The remainder is not a narrow patch against existing local code.

Main blockers:

- `Plugin/OneRing/` does not exist locally, so the plugin-side diff is not a small edit; it depends on importing a full upstream plugin package that this repo has deliberately not raw-merged.
- `routes/admin/finalContext.js` would introduce a `PUT /admin_api/onering-config` endpoint that writes `Plugin/OneRing/OneRingConfig.json`.
- `AdminPanel-Vue/src/views/FinalContextViewer.vue` config modal depends on that write endpoint and exposes runtime operator controls.
- `Plugin/OneRing/OneRingConfig.json` is runtime configuration, not a passive source helper.
- `AdminPanel-Vue/dist/*` is generated output and remains excluded from source-only absorption.

Directly importing the remainder would mix four concerns in one PR:

```text
frontend UI + admin write route + runtime config file + plugin hot reload semantics
```

That is too broad for the current local OneRing absorption track.

## 5. Direct Absorption Decision

| Candidate | Decision | Reason |
|-----------|----------|--------|
| `AdminPanel-Vue/dist/*` | Do not absorb | generated artifacts |
| `Plugin/OneRing/OneRingConfig.json` | Do not absorb directly | runtime config surface |
| `routes/admin/finalContext.js` `PUT /onering-config` | Do not absorb directly | writes plugin config file |
| `AdminPanel-Vue` config modal | Do not absorb directly | depends on write API and live plugin config semantics |
| `system.ts` / `api.system.ts` OneRing config contracts | Do not absorb standalone | dead API until backend contract is designed locally |
| `Plugin/OneRing/*` hot config edits | Defer to OneRing plugin专项 | local plugin package is not present |

## 6. Recommended Next Package Boundary

If continuing `f456575f`, the next safe package should be a single design or implementation package named around:

```text
OneRing hot config local design
```

It should decide these points before code:

- whether local OneRing hot config exists at all before the full plugin package is imported;
- whether config remains env-only in the local default-off design;
- whether an admin write API is allowed, and if so whether it needs CSRF/auth/permission checks beyond the current admin surface;
- whether `enabled`, `maxContextBlocks`, `timeInsert`, and `tailTagPlacement` are operator-owned runtime state or checked-in defaults;
- whether a config file path under `Plugin/OneRing/` is valid while `Plugin/OneRing` is absent locally.

Do not open the frontend config modal until the backend write contract and local plugin config semantics are approved.

## 7. Safe Future Implementation Sequence

If approved later, keep the sequence coarse rather than splitting every line:

1. **Hot config design package**
   - docs only;
   - decides config ownership, defaults, route safety, and rollback.

2. **Plugin package**
   - imports or locally implements `Plugin/OneRing/*`;
   - keeps default disabled/record-only;
   - no admin write UI yet.

3. **Admin config API package**
   - adds read/write endpoint with tests;
   - writes only under a controlled path;
   - handles missing plugin directory explicitly.

4. **Frontend config UI package**
   - adds the modal after API exists;
   - source-only, still no `dist`.

This keeps `f456575f` from becoming a mixed raw merge while avoiding dozens of tiny follow-up preflights.

## 8. Validation Performed

Read-only/static commands used during this assessment:

```powershell
git fetch upstream
git show --name-status --oneline --no-renames f456575f
git show --stat --oneline f456575f
git show f456575f -- AdminPanel-Vue/src/api/system.ts AdminPanel-Vue/src/types/api.system.ts routes/admin/finalContext.js
git show f456575f -- Plugin/OneRing/OneRing.js Plugin/OneRing/config.env.example Plugin/OneRing/plugin-manifest.json Plugin/OneRing/OneRingConfig.json
Test-Path Plugin\OneRing
rg -n "OneRing|onering|finalContext" routes AdminPanel-Vue/src modules Plugin -g "!AdminPanel-Vue/dist/**"
rg -n "chokidar|OneRingConfig|ONERING_ENABLED|ONERING_MAX_CONTEXT_BLOCKS|ONERING_TIME_INSERT|tailTagPlacement|maxContextBlocks|timeInsert" package.json Plugin modules routes AdminPanel-Vue/src -g "!AdminPanel-Vue/dist/**"
```

No service startup, admin API call, config write, runtime file creation, SQLite operation, vector rebuild, or frontend build was run.

## 9. Preflight Result

`f456575f` is partially absorbed by #158.

The remaining payload should be treated as a OneRing hot-config专项, not as direct source absorption. The next meaningful step is a hot-config design package or a full plugin package decision, not a raw cherry-pick.

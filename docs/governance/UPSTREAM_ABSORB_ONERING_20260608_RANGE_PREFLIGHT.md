# Upstream Absorb OneRing 2026-06-08 Range Preflight

本文件记录作者上游 `b3f5840c..0c841d2a` 中 Oring / OneRing 相关变更的
本地吸收 preflight。

本包只新增本文件，不修改 `Plugin/OneRing/*`，不修改 handlers，不修改
`chatCompletionHandler.js`，不修改 `AdminPanel-Vue/src/*`，不创建真实
`Plugin/OneRing/OneRingConfig.json`，不创建 SQLite/runtime data，不导入 native
二进制。

## 1. Scope

| Item | Value |
| --- | --- |
| Local branch | `codex/onering-upstream-20260608-preflight` |
| Local base | `main` at #217 merge |
| Upstream range | `b3f5840c..0c841d2a` |
| Upstream head | `0c841d2a 去掉已经不再调用的native桥` |
| Package type | docs-only preflight / absorption ledger |

Relevant upstream commits in this range:

```text
178955ad 全面重构Oring系统下沉到rust，计算速度提升1500倍。
517c67ea 优化onering的流程可靠性
39d0c2ba 大幅简化Oring逻辑，用纯SQL方法实现整个系统，移除所有数学引擎
371d69f8 最终fix
c22424c9 优化后端对oring的渲染监控
5b606b6b Onering添加建库检查日志
3dbb9a4d 提升预消息处理器权限，适配vcp自己的oring前端协议
19a8f463 优化cli兼容
1f889489 修复rolediveder破坏了顶层数组行为
d6e13b6b 优化Oring并发管线
9a80e4dd 最终fix
ba0b8a88 修复超短上下文下极端竟态并发边界情况
e478faa6 大幅优化和稳固oring管线
0c841d2a 去掉已经不再调用的native桥
```

## 2. Upstream Payload Shape

Static diff for the Oring-relevant paths is broad:

```text
AdminPanel-Vue/src/views/FinalContextViewer.vue | 531 lines
Plugin/OneRing/OneRing.js                       | 2404 lines
Plugin/OneRing/OneRingDB.js                     | 96 lines
Plugin/OneRing/OneRingFuzzy.js                  | 59 lines
Plugin/OneRing/OneRingRawClientTimeline.js      | new
Plugin/OneRing/OneRingServerInferredTimeline.js | new
Plugin/OneRing/OneRingSnapshot.js               | 135 lines
Plugin/OneRing/OneRingTimelineCommon.js         | new
Plugin/OneRing/onring.bak.js                    | new backup file
modules/chatCompletionHandler.js                | 64 lines
modules/handlers/nonStreamHandler.js            | 15 lines
modules/handlers/streamHandler.js               | 15 lines
modules/roleDivider.js                          | 24 lines
```

The range also contains native/Rust churn in earlier commits, followed by a
later removal of the native bridge. Those native pieces must not be imported as
a local shortcut.

## 3. Already Covered Locally

### RoleDivider top-level array metadata

Upstream commit `1f889489` preserves array-level metadata when
`roleDivider.process()` returns a new messages array.

Local status: already covered.

Local evidence:

- `modules/roleDivider.js` already has `copyArrayMetadata(source, target)`;
- local implementation uses `Reflect.ownKeys(source)`, so it covers string keys
  and symbols;
- `tests/onering-post-turn-context.test.js` covers OneRing post-turn side-channel
  preservation through `roleDivider.process()`;
- `tests/pipeline-order-contract.test.js` covers non-enumerable array metadata
  preservation.

Decision: do not re-apply this upstream patch.

### Admin config backend

OneRing admin config backend has already been closed by #215 / #216 and the
coverage ledger in #217.

Decision: do not reopen backend config work in this range unless a later package
is explicitly about frontend UI, live reload, or operator docs.

## 4. Direct Raw Merge Decision

Do not raw-merge `b3f5840c..0c841d2a`.

Reasons:

- upstream `Plugin/OneRing/OneRing.js` is a large runtime rewrite, not a small
  patch against local thin-wrapper semantics;
- upstream adds timeline modules and a backup file, requiring local package
  decisions before import;
- handler and `chatCompletionHandler.js` changes alter response-meta capture
  and final assistant recording flow;
- upstream frontend changes are large and should remain source-only if absorbed;
- native/Rust commits appear in the range even though the final head removes the
  native bridge;
- local policy keeps OneRing default-off and avoids committing real runtime
  config or data files.

## 5. Candidate Package Classification

| Candidate | Decision | Reason |
| --- | --- | --- |
| `roleDivider` metadata preservation | closed | local implementation and tests already cover it |
| `onring.bak.js` | exclude | backup file, not a source package |
| native/Rust bridge files | exclude | upstream later removes bridge; dependency/native churn is high-risk |
| `OneRingConfig.json` real file | exclude | operator/runtime config, not checked-in source |
| frontend `FinalContextViewer.vue` changes | defer | large UI package; depends on backend/UI review |
| handler response-meta capture | defer | shared response path; requires narrow tests |
| timeline modules | defer | new source modules; must be mapped to local default-off wrapper |
| SQL DB helper changes | candidate | possible next safe package if kept temp-path tested |
| logging / build-db diagnostics | candidate | safe if no runtime data is created in tests |
| ultra-short-context race fix | candidate | safe if isolated and covered by wrapper tests |

## 6. Recommended Next Implementation Package

Recommended next package:

```text
OneRing SQL/store reliability intake
```

Suggested file scope:

```text
modules/oneringStore.js
tests/onering-store.test.js
docs/governance/UPSTREAM_ABSORB_ONERING_SQL_STORE_RELIABILITY_20260608.md
```

Package goals:

- inspect upstream `OneRingDB.js` changes from `39d0c2ba`, `5b606b6b`, and
  `e478faa6`;
- map only store reliability behavior that fits the local `OneRingStore` module;
- keep all tests on temp directories;
- do not touch real `Plugin/OneRing/data`;
- do not change handler dispatch or plugin enablement;
- do not import timeline modules in the same package.

Minimum validation for that package:

```powershell
node --check modules/oneringStore.js
node --check tests/onering-store.test.js
node --test tests/onering-store.test.js tests/onering-plugin-wrapper.test.js
git diff --check
```

## 7. Explicit Non-goals

This range preflight and the next store package must not:

- enable OneRing by default;
- import or commit `Plugin/OneRing/OneRingConfig.json`;
- create or write real `Plugin/OneRing/data`;
- import `onring.bak.js`;
- add native/Rust dependencies or binary files;
- change `Plugin.js` preprocessor priority;
- change stream/non-stream shared handler behavior;
- add frontend UI or `AdminPanel-Vue/dist/*`;
- combine timeline import, handler wiring, frontend UI, and store changes in one
  PR.

## 8. Stop Conditions

Stop before implementation if the next package requires:

- touching production/runtime config;
- writing SQLite outside a temp test directory;
- changing `Plugin.js` execution or preprocessor priority;
- accepting raw upstream handler changes without local tests;
- importing native/Rust code or dependency updates;
- committing generated frontend artifacts;
- enabling cross-frontend context patching by default.

## 9. Validation Plan For This Preflight

Docs-only validation:

```powershell
rg -n "b3f5840c|0c841d2a|1f889489|roleDivider|OneRing SQL/store reliability intake|Non-goals|Stop Conditions" docs/governance/UPSTREAM_ABSORB_ONERING_20260608_RANGE_PREFLIGHT.md
node --test tests/onering-post-turn-context.test.js tests/pipeline-order-contract.test.js
git diff --check
git status --short
```

No service startup, admin API call, SQLite runtime write, frontend build,
external API call, bridge action, deploy, or push is required for this preflight.

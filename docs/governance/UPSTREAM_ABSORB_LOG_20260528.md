# Upstream 吸收总表 - 2026-05-28

本文件是 `upstream/main` 吸收工作的正式台账。

用途：

- 记录什么时间审查了哪个 upstream commit。
- 记录哪些内容已经吸收到 JENN2046 的 `main`。
- 记录吸收到哪个本地 commit。
- 记录哪些 upstream commit 没有吸收，以及明确原因。
- 解释为什么 `git cherry -v main upstream/main` 仍可能显示 `+`。

## 0. 状态定义

| 状态 | 含义 |
|------|------|
| 已吸收并已推送 | 功能或文档已进入本地 `main`，并且已经推送到 `origin/main`。 |
| 已吸收但未推送 | 功能或文档已进入本地 `main`，但还没有推送到 `origin/main`。 |
| 已审未吸收 | 已经看过 upstream commit，本轮明确不吸收。 |
| 需另开包 | upstream commit 里有可取内容，但它不是一个安全的窄包；以后需要用户明确指定再开新包。 |
| 不可 raw merge | 不能直接 cherry-pick 或 merge upstream commit，因为会带入生成产物、运行态、配置样例、旧实现覆盖、或大量与本地线冲突的改动。 |

## 1. 本次台账创建时基线

以下状态记录的是创建本台账时的工作区事实，用于解释本轮吸收账目。

| 项目 | 值 |
|------|----|
| 台账更新时间 | 2026-05-28 Asia/Shanghai |
| 工作目录 | `A:/VCP/VCPToolBox` |
| upstream 源 | `upstream/main` = `https://github.com/lioensky/VCPToolBox` |
| 本地主线目标 | `main` |
| 远端主线目标 | `origin/main` = `https://github.com/JENN2046/VCPToolBox` |
| 当前本地 `main` | `0d0adc0a feat: add embedding model resilience` |
| 当前 `origin/main` | `e034131d feat: add semantic model router runtime and admin editor` |
| 本地领先远端 | `main...origin/main [ahead 3]` |
| tracked 工作树 | 干净 |
| 未跟踪文件 | 本台账文件：`docs/governance/UPSTREAM_ABSORB_LOG_20260528.md` |
| ignored 本地环境目录 | `rust-vexus-lite/node_modules/`、`rust-vexus-lite/target/` |

注意：

- 这 3 个本地 ahead commit 是：`56232b6d`、`cc63628b`、`0d0adc0a`。
- 这 3 个 commit 尚未推送到 `origin/main`。
- 本表只记录本地审查与吸收结果，不代表已经完成远端同步。

## 2. 已吸收记录

| 吸收时间 | upstream commit | upstream 时间 | upstream 主题 | 本地落点 | 本地落点时间 | 当前状态 | 验证记录 | 准确说明 |
|----------|-----------------|---------------|---------------|----------|--------------|----------|----------|----------|
| 2026-05-28 18:00:44 +08:00 | `9338e01e` | 2026-05-27 20:37:59 +08:00 | 上架 vcp 智能模型路由器 | `e034131d feat: add semantic model router runtime and admin editor` | 2026-05-28 18:00:44 +08:00 | 已吸收并已推送 | `.agent_board/CHECKPOINT.md`、`.agent_board/VALIDATION_LOG.md` | 这是拆包吸收，不是 raw cherry-pick。`git cherry` 仍可能显示 `9338e01e` 为 `+`，因为本地 commit hash 和 upstream commit hash 不同。 |
| 2026-05-26 01:40:53 +08:00 | `13ddefe9` | 2026-05-25 22:53:04 +08:00 | 修复某些情况下边界库的冷启动初始容错问题 | `debfa1da chore: absorb upstream urlfetch and vexus fixes` | 2026-05-26 01:40:53 +08:00 | 已吸收并已推送 | 2026-05-28 复核：`rust-vexus-lite/src/lib.rs` 和 `rust-vexus-lite/vexus-lite.win32-x64-msvc.node` 与 upstream `13ddefe9` Git object 一致 | 本轮没有替换 `.node` 二进制，因为当前二进制已经与 upstream 一致。 |
| 2026-05-28 18:59:45 +08:00 | `13ddefe9` 后续测试修正 | 2026-05-25 22:53:04 +08:00 | Rust/Vexus native refresh 运行态测试 | `cc63628b test: update rust vexus lite smoke test` | 2026-05-28 18:59:45 +08:00 | 已吸收但未推送 | `node rust-vexus-lite/test.js`；NAPI build 到 `rust-vexus-lite/target/napi-build-check`；fresh build binary smoke；`cargo test --manifest-path rust-vexus-lite/Cargo.toml --locked` | 只修正 `rust-vexus-lite/test.js`，让测试匹配当前 `add/addBatch/search/remove/stats` API；没有改生产 `.node`。 |
| 2026-05-28 19:17:37 +08:00 | `2ae8a9d0` | 2026-05-28 18:42:46 +08:00 | 新增向量容灾系统 | `0d0adc0a feat: add embedding model resilience` | 2026-05-28 19:17:37 +08:00 | 已吸收但未推送 | `node --test tests/embedding-model-fallback.test.js`；`node --check EmbeddingUtils.js KnowledgeBaseManager.js TagMemoEngine.js tests/embedding-model-fallback.test.js`；`node rust-vexus-lite/test.js`；`git diff --check` | 保留本地已有 backend fallback 机制，新增同一 embedding backend 内的模型候选切换，并接入 `EmbeddingModelSig`。没有调用真实 embedding 服务。 |
| 2026-05-28 18:30:23 +08:00 | upstream continuation audit | 不适用 | 记录剩余 upstream 正差异审查结论 | `56232b6d docs: checkpoint upstream continuation audit` | 2026-05-28 18:30:23 +08:00 | 已记录但未推送 | `git cherry -v main upstream/main`、文件范围审查 | 这是审计记录提交，不是功能吸收提交。 |
| 2026-05-29 11:21:53 +08:00 | `fad82a91` | 2026-05-28 20:23:42 +08:00 | 优化布尔值兼容 | `f857d86c 优化布尔值兼容` | 2026-05-29 11:21:53 +08:00 | 已吸收但未推送 | `node --check Plugin/LightMemo/LightMemo.js`；LightMemo helper inline assertions；`node tests/gptimagegen-safety.test.js` | 原样 cherry-pick 上游单文件补丁。规范化 `search_all_knowledge_bases`、`k`、`tag_boost`、`core_tags`、`core_boost_factor`，避免字符串 `"false"` 被 JS 当作真值。 |

## 3. 已审但本轮没有吸收的 upstream commit

这些 commit 已经审查过。本轮不直接吸收它们。后续如果要吸收，必须按表中“后续动作”重新开包。

| upstream commit | upstream 时间 | 主题 | 改动文件 | 本轮决定 | 明确原因 | 后续动作 |
|-----------------|---------------|------|----------|----------|----------|----------|
| `18728628` | 2026-05-25 13:55:33 +08:00 | FileOperator 路径回退、README、EmojiListGenerator 文档、VSearch 错误提示 | `Plugin/EmojiListGenerator/README.md`；`Plugin/FileOperator/FileOperator.js`；`Plugin/FileOperator/README.md`；`Plugin/FileOperator/config.env.example`；`Plugin/VSearch/VSearch.js` | 已审未吸收 | 一个 commit 混合 3 个主题：FileOperator 行为、文档、VSearch 错误提示。不能作为单一安全窄包 raw cherry-pick。 | 如需要，拆成 `FileOperator path fallback`、`VSearch error message`、`Emoji docs` 三个独立包。 |
| `973e2bdd` | 2026-05-25 23:16:00 +08:00 | fixKBDRebuild 方法 + 优化 UrlFetch 返回格式 | `KnowledgeBaseManager.js`；`Plugin/UrlFetch/UrlFetch.js` | 已审未吸收 | 与已经存在的本地 `debfa1da` UrlFetch/Vexus 吸收线重叠；raw cherry-pick 会重新覆盖当前 `KnowledgeBaseManager.js` 和 `UrlFetch.js` 的本地治理形态。 | 如需要，只能重新开 `UrlFetch return format` 窄包，对当前文件做手工补丁。 |
| `09fdab2a` | 2026-05-25 23:41:23 +08:00 | 为 URLFetch 引入 JinA 鉴权访问模式 | `Plugin/UrlFetch/UrlFetch.js`；`Plugin/UrlFetch/config.env.example`；`Plugin/UrlFetch/plugin-manifest.json` | 已审未吸收 | 改动涉及插件行为、配置样例和 manifest。当前本地 UrlFetch 已有不同实现线，不能 raw cherry-pick 覆盖。 | 如用户需要 JinA 鉴权，单独开 `UrlFetch JinA auth` 包，并做配置兼容审查。 |
| `b30dbf7e` | 2026-05-25 23:47:51 +08:00 | 优化逻辑 | `Plugin/UrlFetch/UrlFetch.js` | 已审未吸收 | 主题描述过窄且不说明行为边界；文件与当前本地 UrlFetch 线冲突。 | 需要先做 `git show b30dbf7e -- Plugin/UrlFetch/UrlFetch.js` 行为审查，再决定是否手工移植。 |
| `3a95a1e3` | 2026-05-26 13:12:43 +08:00 | 引入缓存 Fuzzy 可调参机制 | `AdminPanel-Vue/dist/*`；`AdminPanel-Vue/src/features/rag-tuning/metadata.ts`；`Plugin/ContextFoldingV2/ContextFoldingV2.js`；`Plugin/RAGDiaryPlugin/RAGDiaryPlugin.js`；`modules/messageProcessor.js`；`rag_params.json` | 已审未吸收 | 包含前端构建产物、RAG 参数、插件行为和 message processor 运行逻辑，风险面过宽。 | 如需要，开 `RAG fuzzy tuning` 设计包，先审 `rag_params.json` 是否属于运行参数。 |
| `07c9994e` | 2026-05-26 21:47:45 +08:00 | 统一图片生成类工具格式调用 | `Plugin/DMXDoubaoGen/DoubaoGen.js`；`Plugin/GPTImageGen/GPTImageGen.js`；`Plugin/NanoBananaGen2/NanoBananaGen.mjs`；`Plugin/ZImageTurboGen/ZImageTurboGen.mjs`；`TVStxt/MediaToolBox.txt` | 已审未吸收 | 同时修改多个生图插件和 TVS 文本提示资源。当前项目正在单独讨论 Codex 内置 `image_gen` 接入，不能把这条作为普通 raw absorb。 | 需要单独开 `image tool format unification` 包，逐插件验证。 |
| `0c45a35a` | 2026-05-27 04:27:35 +08:00 | 补齐重要参数的浪潮可调参 | `AdminPanel-Vue/dist/*`；`AdminPanel-Vue/src/features/rag-tuning/metadata.ts`；`Plugin/RAGDiaryPlugin/RAGDiaryPlugin.js`；`rag_params.json` | 已审未吸收 | 和 `3a95a1e3` 同类，包含构建产物和 RAG 运行参数，不能 raw cherry-pick。 | 如需要，合并到同一个 `RAG fuzzy tuning` 包处理。 |
| `696e3a9f` | 2026-05-28 04:41:42 +08:00 | 更新说明 | `README.md` | 已审未吸收 | 只有 README 更新；内容未作为本地主线说明采用。 | 如需要，开文档同步包，逐段比对 README，不直接覆盖本地 README。 |

## 4. 为什么 `git cherry` 还会显示 `+`

当前策略是“拆包吸收 / 手工移植”，不是“把 upstream commit 原样 cherry-pick”。

因此会出现这种情况：

- 功能已经进入本地 `main`；
- 但本地 commit hash 与 upstream commit hash 不同；
- `git cherry -v main upstream/main` 仍显示 upstream commit 为 `+`。

已知例子：

| upstream commit | 本地解释 |
|-----------------|----------|
| `9338e01e` | 功能已由 `e034131d` 吸收，但不是原样 cherry-pick。 |
| `13ddefe9` | Rust/Vexus 文件已由 `debfa1da` 覆盖，测试修正由 `cc63628b` 补齐。 |
| `2ae8a9d0` | 功能已由 `0d0adc0a` 手工吸收，保留本地 fallback backend 机制。 |

结论：

- 不得只根据 `git cherry` 的 `+` 判断“还没吸收”。
- 必须结合本表、本地 commit、文件范围和验证结果判断。

## 5. 当前明确剩余项

截至 2026-05-29，本表没有标记“必须继续吸收”的 upstream commit。

当前剩余项只有两类：

| 类别 | 内容 | 处理 |
|------|------|------|
| 已审未吸收 | 第 3 节列出的 upstream commit | 不自动吸收；需要用户明确指定后单独开包。 |
| 本地未推送 | `f857d86c` 以及本次台账更新提交 | 如果要让 `origin/main` 获得这轮结果，需要用户明确批准 push。 |

## 6. 下次审查固定流程

只读检查：

```powershell
git fetch upstream
git status --short --branch
git cherry -v main upstream/main
git diff --name-status main..upstream/main
```

分类规则：

| 分类 | 标准 |
|------|------|
| `absorb` | 小、当前有效、可验证、不会覆盖本地主线治理形态。 |
| `covered` | 行为已由本地 commit 实现，但 hash 不同。必须写明本地 commit。 |
| `defer` | 有价值，但需要设计包或跨模块验证。 |
| `reject` | stale、生成产物、运行态、真实配置、密钥风险、或会删除本地治理资产。 |

## 7. 2026-06-06 OneRing 专项追加台账

本节追加记录 `f456575f` 及前序 OneRing upstream 专项在本地的吸收状态。

本节不是 raw merge 记录。OneRing 采用本地模块化吸收策略：上游 `Plugin/OneRing/*` 作为参考材料，不作为直接导入目标。

| 时间 | 范围 | 本地 PR / commit | 状态 | 验证记录 | 准确说明 |
|------|------|------------------|------|----------|----------|
| 2026-06-06 | upstream OneRing 专项 preflight | #146 / `UPSTREAM_ABSORB_ONERING_SPECIAL_PREFLIGHT_20260606.md` | 已吸收并已推送 | 文档 preflight；未运行服务、未创建 SQLite、未改 handlers | 将 upstream OneRing 归为专项，不再作为 R16 普通碎包 raw absorb。 |
| 2026-06-06 | OneRing local design | #147 / `ONERING_LOCAL_DESIGN_20260606.md` | 已吸收并已推送 | 文档 design | 定义本地默认关闭、record-only 优先、不得存 reasoning、不得默认改 `preprocessor_order.json`。 |
| 2026-06-06 | parser / marker helpers | #148 | 已吸收并已推送 | targeted parser tests | 新增本地 `modules/oneringParser.js` 与测试；不接 SQLite、handlers 或 plugin wrapper。 |
| 2026-06-06 | handler integration preflight | #149 / `ONERING_HANDLER_INTEGRATION_PREFLIGHT_20260606.md` | 已吸收并已推送 | 文档 preflight | 明确 handler 只可在 upstream 成功后记录可见 assistant 内容，不直接持久化 handler 内部累积变量。 |
| 2026-06-06 | pure handler adapter tests | #150 | 已吸收并已推送 | adapter tests；review 修正 stream explicit success 和 invalid input P2 | 新增 `modules/oneringHandlerAdapter.js` 与测试，只产出候选记录，不写库。 |
| 2026-06-06 | fuzzy helper pure functions | #151 | 已吸收并已推送 | fuzzy tests；review 修正 content block 与长文本边界 P2 | 新增 `modules/oneringFuzzy.js` 与测试，支持 replay/edit detection，长文本比较有边界。 |
| 2026-06-06 | runtime ignore rules | #152 | 已吸收并已推送 | ignore diff review | 补 OneRing runtime 数据忽略规则，不提交运行态数据库。 |
| 2026-06-06 | stream helper explicit result shape preflight / implementation / adapter consumption | #153, #154, #155, #156 | 已吸收并已推送 | stream result shape tests；adapter consumption tests | 先明确 stream success/abort/idle/error 形态，再让 adapter 消费显式结果；不直接接 recorder 直到后续包。 |
| 2026-06-06 | minimal handler wiring | #157 | 已吸收并已推送 | PR CI；review 修正只记录 final successful turn、跳过 tool-only turn | 接入 OneRing assistant record candidate flushing，但保持失败 upstream 不产出成功记录。 |
| 2026-06-06 | `f456575f` final context display-only subset | #158 / `db4b5d12` | 已吸收并已推送 | `git diff --check`；`vue-tsc --noEmit`；PR CI | 只吸收 `FinalContextViewer.vue` 的伪系统/通知 user block badge；未吸收 config UI/API、`Plugin/OneRing/*` 或 `dist`。 |
| 2026-06-06 | `f456575f` remainder preflight | #159 / `1214326f` | 已吸收并已推送 | 文档 diff check；PR CI | 将剩余 hot-config UI/API/admin route/plugin config 统一归为 OneRing hot-config 专项，不 raw cherry-pick。 |
| 2026-06-06 | OneRing hot-config local design | #160 / `7ae2bb44` | 已吸收并已推送 | 文档 diff check；PR CI | 定义 hot-config 策略：plugin semantics first、runtime config ownership second、admin write API third、frontend UI last。 |
| 2026-06-06 | OneRing plugin package decision | #161 / `832e9552` | 已吸收并已推送 | 文档 diff check；PR CI | 决定不 raw-import upstream `Plugin/OneRing/*`，继续本地模块化实现；上游文件只作参考。 |
| 2026-06-06 | OneRing local core helpers | #162 / `b2620d94` | 已吸收并已推送 | `node --check` 新增文件；OneRing targeted suite 58 pass；`git diff --check`；PR CI | 新增 `modules/oneringHotConfig.js`、`modules/oneringStore.js` 与测试。store 要求显式 temp/baseDir，未接 `Plugin/OneRing/*`、admin route、frontend、handlers 或 `dist`。 |
| 2026-06-06 | OneRing thin plugin wrapper | #170 / `c1e0ecde` | 已合并 | `node --check Plugin\OneRing\OneRing.js`；OneRing targeted suite 35 pass；`git diff --check`；PR CI | 新增本地薄插件壳、manifest、config example 与 wrapper tests。默认关闭，且要求 `ONERING_ENABLED=true` 与 hot config `enabled=true` 双开关才创建 store；review 后修复 reload 旧配置残留；不 raw-import upstream `OneRingDB/Fuzzy/Snapshot`，不接 admin write API、frontend、`dist` 或默认 `preprocessor_order.json`。 |

当前仍不直接吸收的 OneRing upstream 内容：

| 内容 | 当前状态 | 原因 |
|------|----------|------|
| upstream `Plugin/OneRing/*` 整包 | 不 raw-import | 本地已决定继续模块化实现；已只吸收 thin wrapper 子集。整包导入仍会混入 snapshot、fuzzy diff 私有实现、context patching 等多层行为。 |
| `Plugin/OneRing/OneRingConfig.json` | 不提交 | operator-owned runtime state；不得作为源码默认提交。 |
| `routes/admin/finalContext.js` 的 `PUT /admin_api/onering-config` | 暂缓 | admin 写接口需单独路径收束、权限、回滚和缺失插件目录测试。 |
| `AdminPanel-Vue` OneRing config modal/API/types | 暂缓 | 必须等 backend write contract 与 plugin config 语义存在后再做 source-only UI 包。 |
| `AdminPanel-Vue/dist/*` | 不吸收 | 生成产物，不进入 source-only 吸收。 |
| `preprocessor_order.json` 默认加入 `OneRing` | 暂缓 | thin wrapper 已默认关闭；显式运行顺序仍必须单独设计和测试，不能跟随 upstream 默认文件。 |

下一步建议：

1. 继续审查 thin wrapper 的 PR/CI 结果。
2. 后续若继续 OneRing，可做 runtime config loader/watcher 小包，但仍不得提交真实 `OneRingConfig.json`。
3. admin write API、frontend UI、`dist` 与默认 `preprocessor_order.json` 继续单独暂缓。

## 8. 2026-06-06 快速吸收追加台账

本节追加记录 `b3f5840c` 附近作者上游差异在 JENN2046 `main`
快吸收策略下的处理结果。

本节同样不是 raw merge 记录。判断是否已吸收必须以本台账、PR/commit、
文件行为和验证记录为准，不得只看 `git cherry -v` 的 `+`。

| 时间 | upstream commit / 范围 | 本地 PR / commit | 状态 | 验证记录 | 准确说明 |
|------|------------------------|------------------|------|----------|----------|
| 2026-06-06 | `457470c0` partial | #164 / `6fd00970`, review fixes `1175966e`, `07985c28` | 已吸收并已推送 | `node --check Plugin\VolcSearch\VolcSearch.js`; `node --check Plugin\DailyNote\dailynote.js`; `Plugin/VolcSearch/plugin-manifest.json` JSON parse; PR CI | 只吸收 VolcSearch `full_content` 支持和 DailyNote 缺失 command 时的 create/update 参数形态推断。review 后修正 full-content 兼容和 snippet-mode Summary 保留。 |
| 2026-06-06 | `5d6dc451` docs-only | #165 / `cc644b69` | 已吸收并已推送 | PR CI; staged `VCP.md` diff review | 吸收 `VCP.md` 演讲稿 front matter/title、`SystemPromptHacker` 与 `OneRing` 文档段落。`VCP.md` 仍为 CRLF 文件，未在该小包内做整文件换行规范化。 |
| 2026-06-06 | `b3f5840c` DailyNote review-safe subset | #167 / `4562e77f`, review fix pending | PR 已打开，未合并 | `node --check Plugin\DailyNote\dailynote.js`; `node --test tests\gptimagegen-safety.test.js` 25 pass; `git diff --check` 仅有既有 CRLF 转换提示 | 保留 #164 的“缺失/空白 command 可按明确参数形态推断”行为；review 后不吸收上游“显式但无效 command 也可由参数形态纠正”的宽松行为，显式未知 command 继续返回 unknown-command，避免 `delete` / `search` / malformed parser value 携带写入参数时触发 DailyNote 写入。 |

### 8.1 本轮明确没有吸收的内容

| upstream 内容 | 当前状态 | 原因 / 后续动作 |
|---------------|----------|-----------------|
| `Plugin/OneRing/config.env.example` from `92a1e80d` | 不单独吸收 | 当前本地 `main` 不存在 `Plugin/OneRing/` 插件包；本地策略是模块化实现，已在第 7 节决定不 raw-import upstream `Plugin/OneRing/*`。配置样例会指向不存在的插件包，需等待 thin plugin wrapper 专项。 |
| `Plugin/OneRing/README.md` docs snippets from `31064f3f` | 不单独吸收 | 同上。文档描述 upstream plugin wrapper / snapshot / output dedup 形态，但当前本地主线没有该插件目录，不能先提交超前文档。 |
| upstream `Plugin/OneRing/OneRing.js` changes from `7855f8ae`, `31064f3f`, `4ef1517f`, `f34e5ca2`, `f456575f` and later fixes | 继续归入 OneRing 专项 | 已由第 7 节明确：上游 OneRing 整包只作为参考材料，不 raw-import；后续应做 thin plugin wrapper 设计/实现包，默认关闭或 record-only，不接 admin write API、frontend UI、`dist` 或默认 `preprocessor_order.json`。 |

### 8.2 后续吸收固定补充规则

继续吸收作者上游时，必须先读本台账最新章节，再执行只读扫描：

```powershell
git fetch upstream
git status --short --branch
git cherry -v origin/main upstream/main
```

如果 `git cherry` 显示 `+`，必须先在本台账中查找是否已有
`covered` / `defer` / `reject` / 专项归类记录。只有台账没有覆盖、文件范围
仍小、且不触及核心边界时，才进入快速吸收。

## 9. 2026-06-06 R13 剩余脚本迁移追加台账

本节追加记录 R13 目录治理剩余脚本迁移专项。该专项仍不是 raw merge
`567cf29b`，而是在本地保留根目录兼容入口、将真实实现迁入 `scripts/`，
并修正迁移后的 repo root 路径解析。

| 时间 | upstream 范围 | 本地分支 | 状态 | 验证记录 | 准确说明 |
|------|---------------|----------|------|----------|----------|
| 2026-06-06 | `567cf29b` remaining script relocations | `codex/r13-remaining-scripts-migration-20260606` | 本地验证通过，待提交/PR | `node --check` migrated JS scripts/wrappers; Python AST parse; `node --test tests\upstream-diff-closeout.test.js` 4 pass; `git diff --check` | 迁移 `diary-tag-batch-processor.js`、`rebuild_vector_indexes.js`、`rebuild_tag_index_custom.js`、`repair_database.js`、`sync_missing_tags.js`、`test-units.js`、`timeline整理器.py` 到 `scripts/`，根目录保留 wrapper；不执行真实写入/SSH/插件流程。 |

## 10. 2026-06-06 `18728628` FileOperator/VSearch 快速吸收台账

`18728628` 在本地主要已由 `6d6121f4` 覆盖，但 patch-id 不同：
本地保留了 EmojiListGenerator README 的本地化段落整理，且没有吸收
`Plugin/VSearch/VSearch.js` 的“移除文件末尾换行”格式倒退。

| 时间 | upstream commit / 范围 | 本地 PR / commit | 状态 | 验证记录 | 准确说明 |
|------|------------------------|------------------|------|----------|----------|
| 2026-06-06 | `18728628` FileOperator/VSearch/EmojiListGenerator subset | `6d6121f4` + `codex/absorb-18728628-20260606` | 本地验证通过，待提交/PR | `node --check Plugin\FileOperator\FileOperator.js`; `node --check Plugin\VSearch\VSearch.js`; `git diff --check` | `FileOperator` 默认 `WEB_FILE_DIR` fallback、README、`config.env.example` 以及 `VSearch` 缺参文案已由 `6d6121f4` 覆盖；本分支只补齐 EmojiListGenerator README 多余空行清理和台账记录。不吸收 upstream 对 `VSearch.js` 的 no-final-newline 格式差异。 |

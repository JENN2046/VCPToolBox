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
| `18728628` | 2026-05-25 13:55:33 +08:00 | FileOperator 路径回退、README、EmojiListGenerator 文档、VSearch 错误提示 | `Plugin/EmojiListGenerator/README.md`；`Plugin/FileOperator/FileOperator.js`；`Plugin/FileOperator/README.md`；`Plugin/FileOperator/config.env.example`；`Plugin/VSearch/VSearch.js` | 当前 `main` 已覆盖 | #169 和第 10 节台账已核销：当前 `main` 已有 `FileOperator` 的 `WEB_FILE_DIR > DEFAULT_DOWNLOAD_DIR > VCPToolBox/file/` fallback、README、`config.env.example`、`VSearch` 的 `SearchTopic 和 Keywords` 缺参提示，以及 EmojiListGenerator README 文案修正。 | 不再开拆分代码包；后续如改 FileOperator/VSearch 行为，必须另开行为包并跑对应静态/单元验证。 |
| `973e2bdd` | 2026-05-25 23:16:00 +08:00 | fixKBDRebuild 方法 + 优化 UrlFetch 返回格式 | `KnowledgeBaseManager.js`；`Plugin/UrlFetch/UrlFetch.js` | 当前 `main` 已覆盖 | 批量复核确认当前 `main` 已有 `KnowledgeBaseManager.scanInitialFiles()`，且 Rust watcher 成功后会在 `fullScanOnStartup` 下触发初始全量扫描；`Plugin/UrlFetch/UrlFetch.js` 也已包含 `formatExtractedArticleContent()` / `renderNodeAsText()`，保留段落、列表和标题边界。相关实现来自本地 `debfa1da` / `b5fd3a33` 吸收线。 | 不再开 `UrlFetch return format` 或 KnowledgeBase watcher 行为包；后续若调整读取格式或启动扫描策略，必须分别开可验证行为包。 |
| `09fdab2a` | 2026-05-25 23:41:23 +08:00 | 为 URLFetch 引入 JinA 鉴权访问模式 | `Plugin/UrlFetch/UrlFetch.js`；`Plugin/UrlFetch/config.env.example`；`Plugin/UrlFetch/plugin-manifest.json` | 当前 `main` 已覆盖 | #194 preflight 确认当前 `main` 已有 `JINA_API_KEY` / `JINA_READER_TIMEOUT_MS`、`fetchWithJinaReader()`、Authorization Bearer 鉴权优先、失败回退免费 `https://r.jina.ai/`、`mode === 'jina'`、`config.env.example` 示例和 manifest 说明；实现来自本地 `b5fd3a33` 之后的 UrlFetch 吸收线，并与后续 download/direct fast path 改造共存。 | 不再开行为实现包；后续如调整 Jina 行为，必须另开可 mock 的行为设计/测试包，不访问真实 Jina 或读取真实 key。 |
| `b30dbf7e` | 2026-05-25 23:47:51 +08:00 | 优化逻辑 | `Plugin/UrlFetch/UrlFetch.js` | 当前 `main` 已覆盖 | 只读评估确认当前 `Plugin/UrlFetch/UrlFetch.js` 已有 `DIRECT_FETCH_TIMEOUT_MS` / `DIRECT_FETCH_MAX_BYTES`、`requestDirectHttp()`、`fetchWithDirectHttp()`，且 `mode === 'text'` 已先走 direct HTTP 快速路径、失败再回退 Puppeteer。 | 不再开代码包；后续如调整 UrlFetch 网络读取行为，必须另开行为设计/测试包。 |
| `3a95a1e3` | 2026-05-26 13:12:43 +08:00 | 引入缓存 Fuzzy 可调参机制 | `AdminPanel-Vue/dist/*`；`AdminPanel-Vue/src/features/rag-tuning/metadata.ts`；`Plugin/ContextFoldingV2/ContextFoldingV2.js`；`Plugin/RAGDiaryPlugin/RAGDiaryPlugin.js`；`modules/messageProcessor.js`；`rag_params.json` | 当前 `main` 已覆盖源码/参数子集，`dist` 仍排除 | 批量复核确认当前 `main` 已有 `ContextFoldingV2.fuzzyEmbedding` 热参数、`RAGDiaryPlugin._getFuzzyEmbeddingOptions()`、dynamic fold fuzzy options、`rag_params.json` 中 fuzzyEmbedding 默认值，以及 RagTuning metadata/range。`AdminPanel-Vue/dist/*` 继续作为生成产物排除。 | 不再开普通吸收包；后续若继续调整 fuzzy 参数默认值或 UI，必须走 `RAG fuzzy tuning` 专项，明确运行参数归属和回滚。 |
| `07c9994e` | 2026-05-26 21:47:45 +08:00 | 统一图片生成类工具格式调用 | `Plugin/DMXDoubaoGen/DoubaoGen.js`；`Plugin/GPTImageGen/GPTImageGen.js`；`Plugin/NanoBananaGen2/NanoBananaGen.mjs`；`Plugin/ZImageTurboGen/ZImageTurboGen.mjs`；`TVStxt/MediaToolBox.txt` | 当前 `main` 已覆盖主要源码/提示词子集 | 批量复核确认当前 `main` 已有多生图插件的 `parseImageArrayInput()` / `collectImageInputs()` / normalize args 路径，并已在 `TVStxt/MediaToolBox.txt` 中合并统一生图/修图/多图合成调用说明。未运行真实生图 API。 | 不再开普通 raw absorb；后续如调整生图字段兼容或外部 API 行为，必须走 image plugin 专项并逐插件 mock/静态验证。 |
| `0c45a35a` | 2026-05-27 04:27:35 +08:00 | 补齐重要参数的浪潮可调参 | `AdminPanel-Vue/dist/*`；`AdminPanel-Vue/src/features/rag-tuning/metadata.ts`；`Plugin/RAGDiaryPlugin/RAGDiaryPlugin.js`；`rag_params.json` | 当前 `main` 已覆盖源码/参数子集，`dist` 仍排除 | 批量复核确认当前 `main` 已有 `shotgunDecayFactor` / `shotgunHistorySegmentLimit` 参数消费、缓存键纳入、RagTuning metadata/range 和 `rag_params.json` 配置项；本地保留当前参数值，不 raw 覆盖运行参数。`AdminPanel-Vue/dist/*` 继续排除。 | 不再开普通吸收包；后续如调整 shotgun 默认值或 UI，必须并入 `RAG fuzzy tuning` / RAG 参数专项。 |
| `696e3a9f` | 2026-05-28 04:41:42 +08:00 | 更新说明 | `README.md` | 当前 `main` 已覆盖 | 只读评估确认当前 `README.md` 已包含 `3.10 语义智能模型路由：带语义容灾的自动选模系统` 段落，并引用 `docs/SEMANTIC_MODEL_ROUTER.md`。 | 不再开 README 同步包；后续 README 只做当前主线叙事的增量维护。 |

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

截至 2026-06-07 批量复核后，本表没有标记“必须继续吸收”的 upstream commit。

当前剩余/跟踪项主要分为三类：

| 类别 | 内容 | 处理 |
|------|------|------|
| 当前 `main` 已覆盖 | 第 3 节中 `18728628`、`973e2bdd`、`09fdab2a`、`b30dbf7e`、`696e3a9f` 等 | 不再开代码包；后续只在相关行为需要调整时另开小包。 |
| 已覆盖但后续只能走专项 | 第 3 节中 RAG fuzzy/shotgun 参数与 image tool format unification 相关项 | 不 raw cherry-pick；后续分别走 RAG 参数专项或 image plugin 专项，继续排除 `AdminPanel-Vue/dist/*` 和真实外部 API 调用。 |
| 已审转专项 / 不 raw merge | OneRing Rust/native sweep：`43436f12`、`178955ad`、`8bcd9b35`、`1dd5aec1` | 仍是待跟踪专项，不属于第 3 节普通小包候选；#197 已将当前 OneRing 本地路线收窄为 SQL/hash-only JS 实现，Rust/native 只保留观察，除非后续重新开启专项并完成源码、native API、`.node` 二进制来源、跨平台构建、数据库/向量安全和回滚审查。 |

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

### 6.1 2026-06-08 上游吸收策略调整

VCP 上游吸收从“连续快速跟跑”调整为“三档分流”。执行规则已同步写入
`AGENTS.md` 的“作者上游三档吸收策略”。

后续每轮 upstream diff 必须先分档，再决定处理方式：

| 新分档 | 含义 | 处理原则 |
|--------|------|----------|
| `Full absorb` | 独立、低耦合、可整体替换。 | 可整体吸收，但必须确认不会破坏本地生产契约，并保留验证记录。 |
| `Selective absorb` | 有价值但涉及本地契约。 | 只摘关键逻辑，小包实现，补回归测试；不得 raw merge 大文件。 |
| `Observe only` | 大重构、高速变化、收益不确定。 | 先不动，只记录观察结论；等上游稳定成版本块后再统一评估。 |

本策略变更后，不再因 upstream 持续更新而自动追逐吸收。每轮吸收必须有明确结束条件；
大重构、文件体系重排、删除本地测试/治理层、依赖/二进制/运行态变更，默认归入
`Observe only`，除非用户另行明确开启专项。

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
| 2026-06-06 | OneRing thin plugin wrapper | #170 / `c1e0ecde` | 已吸收并已推送 | `node --check Plugin\OneRing\OneRing.js`；OneRing targeted suite 35 pass；`git diff --check`；PR CI | 新增本地薄插件壳、manifest、config example 与 wrapper tests。默认关闭，且要求 `ONERING_ENABLED=true` 与 hot config `enabled=true` 双开关才创建 store；review 后修复 reload 旧配置残留；不 raw-import upstream `OneRingDB/Fuzzy/Snapshot`，不接 admin write API、frontend、`dist` 或默认 `preprocessor_order.json`。 |
| 2026-06-07 | OneRing SQL/hash-only rewrite preflight | #197 / merge `bca71812` | 已吸收并已推送 | 文档 diff check；PR CI；只读 upstream sweep | 将 OneRing 后续方向从 Rust/native design 收窄为 SQL/hash-only rewrite preflight。Rust/native upstream 线含 `.node` 二进制与跨平台构建风险，且作者方向已回撤/暂缓观察；本地不 raw merge Rust/native，不导入二进制。 |
| 2026-06-07 | OneRing SQL/hash contract fixtures | #198 / merge `d92c3add` | 已吸收并已推送 | hash/snapshot/request identity/temp store 契约测试；PR CI | 补本地 SQL/hash-only 路线的 request hash、content hash、snapshot diff block 与 temp store 契约测试；不碰 handlers、SQLite live data、plugin wrapper 或 admin/frontend。 |
| 2026-06-07 | OneRing post-turn metadata design / pure helpers | #199 / merge `47d89e99`; #200 / merge `011ceda1` | 已吸收并已推送 | preflight 文档；metadata helper tests；PR CI | 设计并实现 `turnId` / `requestHash` / `responseMessageId` post-turn metadata 纯 helper。#199 review 后修正文档中的 `metadata.messages` 键说明；#200 仍不碰 handlers、store schema、plugin wrapper 或真实 runtime 数据。 |
| 2026-06-07 | OneRing post-turn temp-store schema | #201 / merge `b0bfa941`; #202 / merge `6517a97d` | 已吸收并已推送 | schema preflight；`tests/onering-store.test.js`; PR CI | 设计并实现 temp-path SQLite `post_turns` schema、pending/completed/aborted 状态更新、message ownership 校验与 retention 外键策略。review 后明确并验证 `PRAGMA foreign_keys=ON`、`ON DELETE SET NULL`、completion 只允许同 agent/source 的 assistant message。 |
| 2026-06-08 | OneRing store-aware handler wiring helpers | #203 / merge `487bebd7`; #204 / merge `6c81656e` | 已吸收并已推送 | wiring preflight；`tests/onering-handler-wiring.test.js`; PR CI | 先设计 store API 到 adapter/handler 之间的只读边界，再新增 `modules/oneringHandlerWiring.js` store-aware helper/tests；仍不改 live handlers。 |
| 2026-06-08 | OneRing wrapper postTurn support | #205 / merge `9a53fc18`; #206 / merge `da843938` | 已吸收并已推送 | wrapper postTurn preflight；`tests/onering-plugin-wrapper.test.js`; PR CI | 设计并实现 wrapper-only `recordAIResponse(meta, content)` postTurn completion：支持 `meta.postTurn` 时先记录 assistant message，再完成对应 post_turn；不接 live handlers、admin write API、frontend、dist 或默认运行顺序。 |
| 2026-06-08 | OneRing wiring resolver to wrapper recorder | #207 / merge `2d6f1adc`; #208 / merge `3f417199` | 已吸收并已推送 | resolver preflight；`tests/onering-handler-wiring.test.js`; PR CI | 设计并实现 resolver：当 metadata 带 `postTurn` 时优先调用 wrapper `recordAIResponse(meta, content)`，否则保持 legacy `recordAIResponseFromMessages()` fallback；仍不改 live handlers。 |
| 2026-06-08 | OneRing postTurn pending lifecycle / side-channel | #209 / merge `5e941f19`; #210 / merge `c27fc893` | 已吸收并已推送 | lifecycle preflight；side-channel helper tests；PR CI | 明确 pending postTurn 的 prepare/complete/abort 生命周期，并补 `modules/oneringPostTurnContext.js` side-channel helper/tests。review 后要求 final processedMessages 边界保留 side-channel，避免 replacement array 丢 metadata。 |
| 2026-06-08 | OneRing wrapper `preparePostTurnFromMessages()` temp-store + wiring alignment | #211 / merge `20542147` | 已吸收并已推送 | `node --check` wrapper/wiring/tests；focused OneRing tests；`npm test` 298 pass；PR CI | wrapper 新增 `preparePostTurnFromMessages(messages)`，在 trigger/enabled/user gates 后创建 pending postTurn 并挂 messages side-channel。review 后修正重复 prepare 幂等复用、completion path 读取 side-channel、skipped-candidate abort path 读取 side-channel，并将 `tests/onering-handler-wiring.test.js` 接入 `npm test`。仍未接新的 live handler prepare 调用，不改 admin/frontend、真实 config、runtime 数据、dist 或默认 `preprocessor_order.json`。 |
| 2026-06-08 | OneRing live final-dispatch prepare | #213 / merge `b832544f` | 已吸收并已推送 | `node --check modules/oneringHandlerWiring.js`; `node --check tests/onering-handler-wiring.test.js`; `node --test tests/onering-handler-wiring.test.js tests/onering-plugin-wrapper.test.js`; PR CI | 在最终 assistant candidate dispatch 处懒调用 wrapper `preparePostTurnFromMessages()`：只有可记录 final candidate 才创建 pending postTurn，skipped candidate 不新建 pending；`_isEffectiveEnabled()` 为 false 时不 prepare，保持默认关闭；prepare 抛错时回落 legacy recorder，不影响请求路径。不改 env/config、admin/frontend、真实 runtime 数据、dist 或默认 `preprocessor_order.json`。 |
| 2026-06-06 | latest OneRing Rust/native upstream sweep | `43436f12`, `178955ad`, `8bcd9b35`, `1dd5aec1` | 已审转专项 / 暂缓观察 / 不 raw merge | 只读 `git show --name-status --stat`; #197 SQL/hash-only preflight | `43436f12` 继续改 upstream `Plugin/OneRing/OneRing.js`；`178955ad` 曾将 OneRing 计算下沉到 Rust 并新增 `rust-vexus-lite/src/onering.rs`、`Plugin/OneRing/OneRingNative.js`、native API 与 Windows `.node` 二进制；`8bcd9b35` / `1dd5aec1` 继续新增或更新 Linux native 二进制。该组不是本地 thin wrapper 增量；当前本地策略已由 #197 收窄为 SQL/hash-only JS 路线，Rust/native 仅保留观察，不导入源码或二进制。 |

当前仍不直接吸收的 OneRing upstream 内容：

| 内容 | 当前状态 | 原因 |
|------|----------|------|
| upstream `Plugin/OneRing/*` 整包 | 不 raw-import | 本地已决定继续模块化实现；已只吸收 thin wrapper 子集。整包导入仍会混入 snapshot、fuzzy diff 私有实现、context patching 等多层行为。 |
| `Plugin/OneRing/OneRingConfig.json` | 不提交 | operator-owned runtime state；不得作为源码默认提交。 |
| `routes/admin/finalContext.js` 的 `PUT /admin_api/onering-config` | 暂缓 | admin 写接口需单独路径收束、权限、回滚和缺失插件目录测试。 |
| `AdminPanel-Vue` OneRing config modal/API/types | 暂缓 | 必须等 backend write contract 与 plugin config 语义存在后再做 source-only UI 包。 |
| `AdminPanel-Vue/dist/*` | 不吸收 | 生成产物，不进入 source-only 吸收。 |
| `preprocessor_order.json` 默认加入 `OneRing` | 暂缓 | thin wrapper 已默认关闭；显式运行顺序仍必须单独设计和测试，不能跟随 upstream 默认文件。 |
| OneRing Rust/native rewrite (`178955ad`, `8bcd9b35`, `1dd5aec1`) | 暂缓观察 / 不 raw merge | 涉及 Rust 源码、native package API、`.node` 二进制、跨平台产物和性能/一致性语义。当前本地已由 #197 改走 SQL/hash-only JS 路线；除非后续重新开启 Rust/native 专项并完成二进制来源、构建、回滚和一致性审查，否则不导入。 |

下一步建议：

1. OneRing JS 线已完成到 final-dispatch lazy prepare（#213），默认仍关闭，并复用 #211 side-channel 完成/中止路径。
2. 后续若继续 OneRing，优先做 admin config / backend write contract preflight；admin config API / frontend config UI 必须等 backend write contract 单独通过后再做，不提交真实 `OneRingConfig.json`。
3. Rust/native、`AdminPanel-Vue/dist/*` 与默认 `preprocessor_order.json` 继续单独暂缓。

## 8. 2026-06-06 快速吸收追加台账

本节追加记录 `b3f5840c` 附近作者上游差异在 JENN2046 `main`
快吸收策略下的处理结果。

本节同样不是 raw merge 记录。判断是否已吸收必须以本台账、PR/commit、
文件行为和验证记录为准，不得只看 `git cherry -v` 的 `+`。

| 时间 | upstream commit / 范围 | 本地 PR / commit | 状态 | 验证记录 | 准确说明 |
|------|------------------------|------------------|------|----------|----------|
| 2026-06-06 | `457470c0` partial | #164 / `6fd00970`, review fixes `1175966e`, `07985c28` | 已吸收并已推送 | `node --check Plugin\VolcSearch\VolcSearch.js`; `node --check Plugin\DailyNote\dailynote.js`; `Plugin/VolcSearch/plugin-manifest.json` JSON parse; PR CI | 只吸收 VolcSearch `full_content` 支持和 DailyNote 缺失 command 时的 create/update 参数形态推断。review 后修正 full-content 兼容和 snippet-mode Summary 保留。 |
| 2026-06-06 | `5d6dc451` docs-only | #165 / `cc644b69` | 已吸收并已推送 | PR CI; staged `VCP.md` diff review | 吸收 `VCP.md` 演讲稿 front matter/title、`SystemPromptHacker` 与 `OneRing` 文档段落。`VCP.md` 仍为 CRLF 文件，未在该小包内做整文件换行规范化。 |
| 2026-06-06 | `b3f5840c` DailyNote review-safe subset | #167 / `4562e77f`, review fix `a153ead6`, merge `2ea8294e` | 已吸收并已推送 | `node --check Plugin\DailyNote\dailynote.js`; `node --test tests\gptimagegen-safety.test.js` 25 pass; PR CI | 保留 #164 的“缺失/空白 command 可按明确参数形态推断”行为；review 后不吸收上游“显式但无效 command 也可由参数形态纠正”的宽松行为，显式未知 command 继续返回 unknown-command，避免 `delete` / `search` / malformed parser value 携带写入参数时触发 DailyNote 写入。 |
| 2026-06-06 | `666af9eb` DailyNote missing-command robustness | #164 / #167 covered | 已覆盖 | 只读 `git show 666af9eb -- Plugin\DailyNote\dailynote.js`; 当前 `Plugin\DailyNote\dailynote.js` 静态确认 | upstream `666af9eb` 的核心行为是缺失 command 时按 `content/contentText/Content` 或 `target + replace` 推断 create/update。本地已由 #164 引入并由 #167 收窄保护；`git cherry` 仍显示 `+` 是 hash 不同，不代表未吸收。 |
| 2026-06-07 | `392269bb` DailyNote update failure hint | #190 / merge `5f06efc4` | 已吸收并已推送 | `node --check Plugin\DailyNote\dailynote.js`; `node --test tests\gptimagegen-safety.test.js` 25 pass; `git diff --check`; PR CI | 只吸收 update 找不到 target 时的可操作提示：检查字段或标点是否与原文一致，并建议用 `DailyNoteManager list` 查看原文状态后重试。未改变 DailyNote 搜索、写入、fuzzy fallback 或 command 推断逻辑。 |

### 8.1 本轮明确没有吸收的内容

| upstream 内容 | 当前状态 | 原因 / 后续动作 |
|---------------|----------|-----------------|
| `Plugin/OneRing/config.env.example` from `92a1e80d` | 已由 #170 本地安全子集覆盖 / 不再单独吸收 | 本地已有 thin wrapper 的 `Plugin/OneRing/config.env.example`，默认关闭并匹配本地双开关策略。upstream full plugin config 仍不 raw-import。 |
| `Plugin/OneRing/README.md` docs snippets from `31064f3f` | 不单独吸收 | 文档描述 upstream plugin wrapper / snapshot / output dedup 形态；本地只有 thin wrapper，不应提交会承诺 upstream 整包行为的 README。 |
| upstream `Plugin/OneRing/OneRing.js` changes from `7855f8ae`, `31064f3f`, `4ef1517f`, `f34e5ca2`, `f456575f` and later fixes | 继续归入 OneRing 专项 | 已由第 7 节明确：上游 OneRing 整包只作为参考材料，不 raw-import；后续应做 thin plugin wrapper 设计/实现包，默认关闭或 record-only，不接 admin write API、frontend UI、`dist` 或默认 `preprocessor_order.json`。 |
| upstream DailyNote explicit-invalid-command correction from `b3f5840c` | 不吸收 | 该行为会让显式未知 command 在携带写入形态参数时被纠正为 create/update。本地 #167 review 后明确保留更严格策略：只有缺失/空白 command 可推断，显式未知 command 必须报 unknown-command。 |
| upstream DailyNote 其它潜在提示/流程变化 | 不随 #190 扩展 | #190 只核销 `392269bb` 的 update failure hint 文案，不作为 DailyNote 行为重构入口；任何写入路径、搜索策略、fuzzy diff 或 command parser 变化仍需单独包和测试。 |

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
| 2026-06-06 | `567cf29b` remaining script relocations | #168 / `bcb68423`, review fix `c38b0c09`, merge `5a3462ed` | 已吸收并已推送 | `node --check` migrated JS scripts/wrappers; Python AST parse; `node --test tests\upstream-diff-closeout.test.js` 4 pass; `git diff --check`; PR CI | 迁移 `diary-tag-batch-processor.js`、`rebuild_vector_indexes.js`、`rebuild_tag_index_custom.js`、`repair_database.js`、`sync_missing_tags.js`、`test-units.js`、`timeline整理器.py` 到 `scripts/`，根目录保留 wrapper；不执行真实写入/SSH/插件流程。 |

## 10. 2026-06-06 `18728628` FileOperator/VSearch 快速吸收台账

`18728628` 在本地主要已由 `6d6121f4` 覆盖，但 patch-id 不同：
本地保留了 EmojiListGenerator README 的本地化段落整理，且没有吸收
`Plugin/VSearch/VSearch.js` 的“移除文件末尾换行”格式倒退。

| 时间 | upstream commit / 范围 | 本地 PR / commit | 状态 | 验证记录 | 准确说明 |
|------|------------------------|------------------|------|----------|----------|
| 2026-06-06 | `18728628` FileOperator/VSearch/EmojiListGenerator subset | #169 / `1c470a52`, merge `85badf51` | 已吸收并已推送 | `node --check Plugin\FileOperator\FileOperator.js`; `node --check Plugin\VSearch\VSearch.js`; `git diff --check`; PR CI | `FileOperator` 默认 `WEB_FILE_DIR` fallback、README、`config.env.example` 以及 `VSearch` 缺参文案已由 `6d6121f4` 覆盖；#169 补齐 EmojiListGenerator README 多余空行清理和台账记录。不吸收 upstream 对 `VSearch.js` 的 no-final-newline 格式差异。 |

## 11. 2026-06-06 统一真实 User 追踪管线追加台账

本节追加记录 `1cb979c4` / `d50297b3` / `ec1737f9` 方向在本地的已吸收状态。该组仍不是 raw merge，当前只吸收真实 user 选择语义，不吸收 Detector / Role Divider 执行顺序调整。

| 时间 | 范围 | 本地 PR / commit | 状态 | 验证记录 | 准确说明 |
|------|------|------------------|------|----------|----------|
| 2026-06-06 | User tracking pipeline preflight | #171 / `10d5fd1c` | 已吸收并已推送 | 文档 preflight；只读 upstream inspection | 明确把 upstream 统一真实 User 追踪拆为 helper、RAGDiary consumer、semantic/dynamic fold consumer、ContextFoldingV2 consumer 与 Detector / Role Divider order design，禁止混包。 |
| 2026-06-06 | Package A pure helper + tests | #172 / `cffa2b79`, review fix `eb3ecd95`, merge `3d78491d` | 已吸收并已推送 | `node --test tests\message-processor-user-tracking.test.js`; PR CI | 新增 `extractTextFromMessageContent`、`isSystemNotificationText`、`isBetaSystemUserText`、`stripSystemNotificationBlocks`、`findLastRealUserMessage` 与 focused tests。review 后收窄伪系统识别，只匹配已知 `[系统提示:]` / `[系统邀请指令:]` / `[系统通知]` carrier，不把普通 `[系统...]` 用户文本当伪系统。 |
| 2026-06-06 | Package B RAGDiaryPlugin consumer | #173 / `c5f84505`, review fix `f7d5b35f`, merge `f9039b0e` | 已吸收并已推送 | `node --test tests\message-processor-user-tracking.test.js`; `node --test tests\rag-diary-user-tracking.test.js`; `node --test tests\codex-memory-recall.test.js`; PR CI | `RAGDiaryPlugin` 使用共享 helper 选择最新真实 user。review 后修正 sanitized-empty P2：emoji-only、image-only、HTML/tool-marker-only 等最新真实 user 清洗为空时不回退旧 query；只有已知通知/系统 carrier 才继续向前找。 |
| 2026-06-06 | Package C semantic router / dynamic fold consumers | #175 / `da003497`, merge `547285b8` | 已吸收并已推送 | `node --check modules\semanticModelRouter.js`; `node --check modules\messageProcessor.js`; `node --test tests\semantic-model-router.test.js`; `node --test tests\dynamicToolRegistry.test.js`; `node --test tests\message-processor-user-tracking.test.js`; PR CI | `semanticModelRouter` 与 `messageProcessor` dynamic fold 均复用共享真实 user helper；保持 Detector / SuperDetector / Role Divider 顺序不变，不碰 env、runtime state、数据库、向量重建、服务启动或生成产物。 |
| 2026-06-06 | Package D ContextFoldingV2 consumer | #176 / `9226d474`, merge `ee99246b` | 已吸收并已推送 | `node --check Plugin\ContextFoldingV2\ContextFoldingV2.js`; `node --check tests\context-folding-v2-user-tracking.test.js`; `node --test tests\context-folding-v2-user-tracking.test.js`; `node --test tests\message-processor-user-tracking.test.js`; `git diff --check`; PR CI | `ContextFoldingV2` 上下文向量改用共享真实 user helper；保留最新 assistant 处理、折叠阈值、summary queue、store write 与 summary 生成行为。 |
| 2026-06-07 | Package E preflight / pipeline-order contracts / pure detector helper | #178 / merge `64b21b1e`; #179 / merge `99605478`; #180 / merge `47a205ec` | 已吸收并已推送 | preflight 文档；`node --test tests\pipeline-order-contract.test.js`; `node --test tests\message-processor-detector-helper.test.js`; PR CI | 将 `ec1737f9` 的 Detector / Role Divider order 调整确认为不能 raw-port 的高影响 pipeline 变化；随后补当前 legacy 顺序 contract tests，并提取 `applyDetectorRules()` / `applyDetectorsToMessages()` 纯 helper，运行行为仍保持 legacy。 |
| 2026-06-07 | Package E3 default-off pipeline experiment design / tests harness / message helper | #181 / merge `cf36803f`; #182 / merge `975711c2`; #183 / merge `d46e5ac6` | 已吸收并已推送 | E3 design/preflight；`node --test tests\pipeline-order-experiment.test.js`; `node --test tests\message-processor-detector-helper.test.js`; PR CI | 明确 `PromptPipelineOrderMode=legacy` / `detector_post_processors_final_role_divider` 双模式策略，legacy 默认；补 tests-only experiment harness；新增默认关闭的 `applyDetectorsToMessages()` 消息级 helper，不接 handler。 |
| 2026-06-07 | Package E3c/E3d/E3e default-off mode resolver + handler wiring | #184 / merge `42192b28`; #185 / merge `b54e625e`; #186 / merge `bfe22f1e` | 已吸收并已推送 | `node --check` 相关源码/测试；focused tests；handler/semantic/dynamic tests；`npm test`；PR CI | 新增 input-only `promptPipelineOrderMode` resolver；完成 handler wiring preflight；随后接入默认关闭 runtime wiring：`server.js` 只传 raw `process.env.PromptPipelineOrderMode`，`chatCompletionHandler` 缺失/空/未知均保持 `legacy`，只有显式 `detector_post_processors_final_role_divider` 才启用 message-level Detector + final Role Divider。#186 review 后修复 final Role Divider 跳过对象：即使 VCPTavern/预处理器在第一条 system 前插入消息，也保护原始顶层 SystemPrompt，且内部 marker 不泄露到 upstream body。 |
| 2026-06-07 | Package E config example closeout | #188 / merge `1251d610` | 已吸收并已推送 | `git diff --check`；静态 grep 确认 `PromptPipelineOrderMode` 由 `server.js` / `chatCompletionHandler.js` 消费 | `config.env.example` 已补 `PromptPipelineOrderMode=legacy` 示例说明，明确 experimental 值 `detector_post_processors_final_role_divider`、默认仍为 `legacy`，并提示生产启用前需要回归验证；未修改真实 `config.env` 或运行行为。 |

当前 Package E 后续决策项：

| 内容 | 当前状态 | 原因 / 后续动作 |
|------|----------|-----------------|
| Package E 默认切换 / E4 decision | 暂缓 | 不把 upstream order 设为默认；当前 `PromptPipelineOrderMode=legacy` 仍是保守默认，`detector_post_processors_final_role_divider` 只作为显式 opt-in 实验值存在。是否切换默认值需要后续独立 E4 决策包、更多 fixture/运营验证与回滚方案。 |

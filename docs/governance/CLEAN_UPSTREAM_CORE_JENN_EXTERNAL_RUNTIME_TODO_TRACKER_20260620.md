# Clean Core + Jenn External Runtime TODO 进度表

Progress: [##########] 98% (81.7 / 83 global milestone units; scope expanded by M82 PASS)

Last updated: 2026-06-22

当前里程碑：AI Image diagnostic real-config apply/rollback drill（M82 PASS；M83 persistent-enable/closeout decision recommended）

状态来源：

- 计划文档：`docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_ACCEPTANCE_PLAN_20260618.md`
- 当前 Jenn fork 内部 review PR：`JENN2046/VCPToolBox#272`（已合并）
- Clean core review base：`codex/upstream-main-clean-base`，merge commit `86c69e8d`
- Phase 1 实现分支：`codex/phase1-clean-core-plugin-contract`

## 1. 如何更新这份进度表

这份文件是 Clean Upstream Core + Jenn External Runtime 路线的当前进度源。

当前采用双层结构：

- 长期路线图：正式 milestone，从原始 M0-M8 到 Jenn fork maintenance overlay M9-M82。
- 短期执行记录：实际 sprint ledger，记录 S1-S48 与 S50-S103 已完成工作；S49 upstream PR gate deferred。

更新规则：

1. 完成任务后，把 `[ ]` 改成 `[x]`。
2. 只有已经有证据时，才把 `Status` 改成 `PASS`。
3. 证据尽量短：PR、commit、测试命令、checksum、review 结论即可。
4. 每完成一步，都重新计算顶部 `Progress`。
5. 每次更新进度，都同步更新 `Last updated`。
6. 新工作开始前，必须先在本 tracker 的长期路线或详细待办里有对应 TODO；若现实变化导致计划调整，先补 `PLAN_CHANGE` 说明再执行。

进度计算规则：

- 全局 Progress 覆盖 M0-M82 全路线，只保留这一种进度口径。
- 每个 milestone 记 1 个 global milestone unit；M0-M82 合计 83 units。
- `PASS` 计 1 unit。
- `PARTIAL` 只按已验证、已记录的比例计入；当前 M8 = 7 / 10 = 0.7 unit。
- `TODO`、`DEFERRED`、`BLOCK` 计 0 unit。
- 表格中的 `原始分` 只保留原 acceptance plan / sprint 拆分背景，不再作为顶部 Progress 的第二套口径。
- 不能因为“代码写了”就标完成；必须有验证或 review 证据。
- Upstream PR gate 已收紧：只有整个计划在 Jenn fork/local 路线中完成本地实现，并产生稳定运转证据后，才允许重新考虑 M8/S25 或 M28；当前轮或未来轮的泛化 `自动推进` / `继续` 不足以恢复 upstream PR。
- M30 定义本地完整实现、accelerated closeout 和 optional calendar soak 双门；不代表 runtime-on 或 upstream-ready。
- M31 只完成 AdminPanel persistent package gate；不代表 AdminPanel runtime registration、production build、deploy、stable-operation window 或 upstream-ready。
- M32 只完成 AI Image persistent provider-adapter package gate；不代表 provider runtime、真实图片生成、adapter registration、stable-operation window 或 upstream-ready。
- M33 只完成 Codex/Memory persistent no-live-write package gate；不代表 live memory write、private memory recall、bridge runtime registration、stable-operation window 或 upstream-ready。
- M34 只完成 PhotoStudio persistent source package gate；不代表 runtime package registration、真实项目数据读写、external sync/publish/write、stable-operation window 或 upstream-ready。
- M35 只完成 M31-M34 aggregate full-local matrix review；不代表 runtime gates、accelerated closeout 或 upstream-ready。
- M36 只完成 optional calendar-soak entry definition；不代表 local closeout、runtime-on 或 upstream-ready。
- M37 只完成 calendar-soak opening validation evidence；不代表 mid/final cycles passed、7-day minimum duration satisfied、runtime-on 或 upstream-ready。
- M38 完成 accelerated local package-layer stability closeout；不代表 7-day calendar soak、runtime-on、production uptime、real provider behavior 或 upstream-ready。
- M39 使用真实 `config.env` 做 redacted runtime-on local gate；M41 后 rerun PASS；当前只证明 AgentOverrides runtime-on，不证明 provider/bridge/LocalState/private。
- M40 只完成 Agent real-config unlock decision gate；选择 `AgentOverrides` 子车道作为最小候选，不修改 `config.env`，不启用 `VCP_AGENT_DIRS` additive lane，不启用 provider/bridge/LocalState/private。
- M41 完成真实 `config.env` 两键应用与 M39/M40 复验；`config.env` ignored，不提交；rollback 是移除 `VCP_AGENT_ALLOWED_ROOTS` 和 `VCP_AGENT_OVERRIDE_DIRS`。
- M42 只完成 AgentOverrides local read smoke；验证 `AgentManager` 本地读路径命中 external override；不启动 production/HTTP/Admin route，不启用 additive `VCP_AGENT_DIRS`。
- M43 完成 AgentOverrides real config rollback drill；临时移除两键后 M42 BLOCK，恢复两键后 M42 PASS；最终仍是 AgentOverrides only。
- M44 只完成 AgentOverrides Admin write guard；使用本地临时 HTTP test server 挂载 Admin route，确认 external override GET 可识别、POST 写入被 403 拒绝；不启动 production server。
- M45 只完成 AgentOverrides runtime-on aggregate review；fresh rerun M39/M40/M42/M44 和 Agent tests，M43 仅核对既有 receipt，不再次修改真实 `config.env`。
- M46 只完成 next runtime lane unlock decision gate；结论 `NEXT_AUTO_UNLOCKABLE_LANE=none`，推荐下一步是 M47 AdminPanel runtime registration taskbook；不启用 runtime，不修改真实 `config.env`。
- M47 只完成 AdminPanel default-off runtime registration taskbook；定义未来 M48 backend read-only registry gate；不写 env、不改 AdminPanel runtime、不启用 runtime。
- M48 完成 AdminPanel backend default-off registry implementation gate；只在 scoped local test server 验证 read-only GET route；未接入生产 router，未写真实 `config.env`，frontend runtime 仍 deferred。
- M49 完成 AdminPanel backend registry shadow validation + rollback drill；只用 scoped env 序列验证 off/on/rollback/reapply，未写真实 `config.env`，未接生产 router。
- M50 完成 AdminPanel runtime-on local smoke；只在 Node 进程内临时设置 scoped `process.env`，验证默认 off / runtime-on / restore rollback，不写真实 `config.env`，不接生产 router，不启用 frontend runtime。
- M51 只完成 AdminPanel production-router integration taskbook；定义未来 M52 backend integration gate，不修改 `server.js` / `routes/adminPanelRoutes.js`，不写真实 `config.env`，不启用 frontend runtime。
- M52 完成 AdminPanel backend production-router integration gate；test-first 接入 `routes/adminPanelRoutes.js`，默认关闭；scoped env harness 证明 `/admin_api/jenn-admin-status/status` GET 可达、写方法 404、rollback 回到 404；不改 `server.js`、不写真实 `config.env`、不启用 frontend runtime。
- M53 完成 AdminPanel real-config unlock decision gate；选择未来最小候选 `adminpanel-backend-readonly` 三键，但不写真实 `config.env`；frontend runtime、production server smoke、AdminPanel build/dist 仍 deferred。
- M54 完成 AdminPanel real-config apply + rollback drill；真实 `config.env` 写入三键但不提交；backend-readonly route 在本地 test server GET `200`、写方法 `404`；移除三键 rollback 回到 `404`，恢复后三键 PASS；不启动 production server，不启用 frontend runtime。
- M55 完成 AdminPanel production-server smoke / frontend route-nav 决策 taskbook；选择下一步 M56 production-server smoke taskbook-only，M57 actual smoke 需单独授权且后来已完成，M58 frontend route/nav taskbook 后续已完成；不启动 server、不改 frontend。
- M56 完成 AdminPanel production-server smoke taskbook；定义 M57 actual smoke 的命令、端口、auth、日志、cleanup、rollback 和 stop conditions；M56 本身仍不启动 production server。
- M57 完成 AdminPanel production-server smoke；经当前轮明确授权，短时启动 `node server.js` 子进程，GET `/admin_api/jenn-admin-status/status` 返回 `200`，写方法 `404`，随后按 PID 清理并确认端口释放；仍不启用 frontend route/nav。
- M58 完成 AdminPanel frontend route/nav taskbook；定义可显示内容、metadata 来源、允许前端文件、禁止 build/dist、动态 external Vue import blocked 和 M59 静态实现门；不改前端源码。
- M59 完成 AdminPanel frontend route/nav static implementation；按 M58 只改静态 manifest/component map/view，未跑 build、未碰 `dist`、未启用动态 external Vue import；targeted ESLint 与 `vue-tsc --noEmit` PASS，全量 lint 仍被既有 typography baseline 阻挡。
- M60 完成 AdminPanel build/dist decision taskbook；决策当前不 run build、不改 `AdminPanel-Vue/dist/**`，下一安全门为 M61 no-build route/source validation；build/dist 需要未来单独授权和 artifact policy。
- M61 完成 AdminPanel no-build route/source validation；复跑 source route/nav grep、secret-risk display scan、targeted ESLint、`vue-tsc --noEmit`、M53 redacted gate；仍不 build、不 dev/preview、不改 `dist`。
- M62 完成 AdminPanel build/lint baseline path decision taskbook；选择 M63 temp outDir dry build authorization taskbook 作为下一门；实际 build、dev/preview、dist 修改或 broad typography cleanup 仍需单独授权。
- M63 完成 AdminPanel temp outDir dry-build authorization taskbook；定义未来 exact Vite temp outDir command、`.tmp` 输出目录、cleanup target、no-dist proof 和 stop boundary；实际 build/cleanup 未执行，仍需未来当前轮明确授权。
- M64 完成 AdminPanel temp outDir dry build；经当前轮明确授权运行 Vite 到 workspace `.tmp`，产物 `255` files / `12179826` bytes，随后精确清理 temp run dir；`AdminPanel-Vue/dist/**` tracked hash unchanged；M64 evidence fix 补充 case-insensitive/bracket-pattern path-risk scan 规则与当前 auth-surface false-positive 记录，不重跑 build。
- M65 完成 AdminPanel browser visual smoke taskbook；选择 M66 future visual smoke execution gate，先于 normal dist artifact gate；本身不启动 server/browser、不 build、不截图、不改 dist。
- M66 完成 AdminPanel browser visual smoke；经当前轮明确授权使用 temp build + 本地只读静态 server + Puppeteer/Chromium；desktop/mobile route/text/icon/nonblank checks PASS；`/admin_api/*` 被本地 fixture 拦截，未调用真实后端；screenshots/temp output cleaned；`AdminPanel-Vue/dist/**` tracked hash unchanged；normal dist artifact gate 仍 deferred。
- M67 完成 AdminPanel normal dist artifact taskbook；定义 M68 future normal typed build gate、artifact diff review、paths-only risk scan、stage/commit allowlist、rollback/stop conditions；M67 本身不 build、不改 `AdminPanel-Vue/dist/**`。
- M68 完成 AdminPanel normal dist artifact build；经当前轮明确授权运行 `npm run build --prefix AdminPanel-Vue`，`vue-tsc && vite build` PASS；`AdminPanel-Vue/dist/**` 更新并 staged；source/package/config 不变；path-risk 仅 `OAuthAuthCenter` frontend auth asset false positives；不启动 server，不打开 upstream PR。
- M69 完成 AdminPanel post-dist static smoke；读取已提交 normal `AdminPanel-Vue/dist/**`，本地 static server + Puppeteer/Chromium desktop/mobile checks PASS；screenshots/temp output cleaned；dist hash unchanged；不调用真实后端。
- M70 完成 AdminPanel artifact lane closeout decision；AdminPanel lane 在当前 Jenn fork local route 中收口；生产部署、upstream PR、dynamic external Vue runtime、external AdminPanel write surfaces、core fallback removal 仍 deferred。
- M71 完成 aggregate Jenn fork local route review；把 AgentOverrides、AdminPanel closeout、AI Image、Codex/Memory、PhotoStudio、LocalState/private、upstream PR 放入同一张核对表；只做 docs-only review，不改 env、不启动 runtime、不读取 private、不打开 upstream PR。
- M72 完成 next runtime lane decision；不继续全部 deferred，选择只给 AI Image 写未来窄 taskbook：`M73_AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_TASKBOOK`；M72 本身不写 taskbook、不启 runtime、不改 env、不调用 provider。
- M73 完成 AI Image no-provider runtime registration taskbook；定义未来 M74 default-off manifest/metadata registry gate；M73 本身不改 runtime、不写 env、不改 external package、不调用 provider、不生成图片。
- M74 完成 AI Image default-off adapter metadata registry；scoped env 下只注册只读 metadata，`executableAdapters=0`，provider/image/output/bridge/LocalState counters all `0`；不写真实 env、不接路由、不生成图片。
- M75 完成 AI Image registry review / closeout decision；决策不在 M74 metadata-only 处立即收口，下一步只写 M76 default-off diagnostic route taskbook；不实现 route、不写真实 env、不启 provider。
- M76 完成 AI Image default-off diagnostic route taskbook；定义未来 `GET /admin_api/ai-image-adapter-registry/diagnostics`、auth、允许/禁止字段、rollback 和 M77 test-only route factory 停止线；M76 不实现 route、不改 runtime。
- M77 完成 AI Image default-off diagnostic route factory gate；新增 test-only route factory/tests/harness，默认 off `404`，scoped auth route `200`，provider/image/output/bridge/LocalState counters all `0`；未接 production router。
- M78 完成 AI Image diagnostic route production-router decision；决策继续保持 route factory unmounted now，下一步只写 M79 production-router integration taskbook；不接 production router、不写真实 env、不启 provider。
- M79 完成 AI Image diagnostic route production-router integration taskbook；定义 M80 default-off integration 的 mount/auth/env/rollback/validation 边界；M79 不改代码。
- M80 完成 AI Image diagnostic route production-router integration gate；`routes/adminPanelRoutes.js` 默认关闭接入 diagnostic helper；scoped env GET `200`，default-off/rollback `404`，unauthorized `403`，real execution `409`；不写真实 env、不启 provider、不生成图片。
- M81 完成 AI Image diagnostic route real-config unlock decision；选择未来 M82 三键 diagnostic metadata apply/rollback drill 候选；M81 不写真实 `config.env`，不启 provider/runtime/image。
- M82 完成 AI Image diagnostic real-config apply/rollback drill；授权后短暂写真实 `config.env` 三键，route `200`，rollback 后三键 `0`、route `404`、hash restored；最终不保留 AI Image diagnostic runtime-on。

计划变更规则：

- 允许计划按现实修改，但修改必须留痕：原因、影响范围、旧计划、新计划、安全边界、是否影响计分。
- 不能用事后补 TODO 的方式把越界操作伪装成计划内；先补计划，再执行。
- 紧急窄修可以同 commit 追加计划变更说明，但必须说明为什么不能先停下来规划。
- 每个新领域必须先有 taskbook / gate / rollback，再进入 copy-first 或 runtime wiring。
- `PASS` 只能来自证据；推测、愿望、发现文件存在，都不是 PASS。

硬边界：

- 不要把 Phase 2 copy-first、checksum、denylist、LocalState 工作误标成 PR #272 已完成。
- copy-first、checksum、shadow validation、rollback、人类确认完成前，不进入 stub / untrack / remove。
- 不要自动迁移或 checksum `.agent_board/**`。
- 不要把 Jenn 业务逻辑写回 clean core。
- 不要把 discovery 成功当成 runtime registration 成功。

## 2. 长期路线图（正式阶段）

M0-M8 是原始 acceptance plan 阶段；M9-M82 是当前 Jenn fork 长期维护与本地稳定验收路线。两者共同计入顶部全局 Progress；原始 100 分仅作为历史验收拆分背景，不再单独维护进度。

| 完成 | ID | 原始分 | 里程碑 | Status | 证据 / 下一道门 |
| --- | --- | ---: | --- | --- | --- |
| [x] | M0 | 6 | 基线、分支、inventory、扫描、tracker 建立 | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M0_BASELINE_INVENTORY_SECRET_RISK_EVIDENCE_20260621.md`；upstream/origin refs、clean-core 创建记录、旧 fork inventory、paths-only secret-risk scan 已补齐；LocalState 仅存在性记录，不枚举。 |
| [x] | M1 | 12 | Clean Core Phase 1 plugin contract | PASS | PR #272 已合并到 Jenn clean base；merge commit `86c69e8d`；final head `a4225aca`；review threads 全部 resolved；6-test 复跑：`65 pass / 0 fail`。 |
| [x] | M2 | 12 | External Runtime / LocalState skeleton | PASS | S6 任务书、S7 denylist / `.gitignore` baseline、S8 LocalState / `.agent_board/**` gate、S9 manifest / checksum rules 已写；M3 copy-first 已单独完成，M8 workflow 已展开且 S25 deferred。 |
| [x] | M3 | 12 | `JennAIGentOrchestrator` copy-first 试点 | PASS | External package commit `b4f250e`；receipt `receipts/M3_JENN_AIGENT_ORCHESTRATOR_COPY_FIRST_RECEIPT_20260621.md`；paths-only scan clean；`MANIFEST_VERIFY_PASS count=4`；manifest identity `JennAIGentOrchestrator`。 |
| [x] | M4 | 10 | Shadow validation 和 rollback 演练 | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M4_SHADOW_VALIDATION_ROLLBACK_RECEIPT_20260621.md`；external discovery / registration gate tests `14+6+5 pass`；Jenn no-provider shadow harness PASS；rollback overlay PASS。 |
| [x] | M5 | 14 | Agent / LocalState / AdminPanel contracts | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M5_AGENT_LOCALSTATE_ADMIN_CONTRACTS_20260621.md`；定义 `VCP_AGENT_DIRS`、`VCP_AGENT_OVERRIDE_DIRS`、`VCP_LOCAL_STATE_DIR`、`VCP_ADMIN_EXTENSION_DIRS`；docs-only。 |
| [x] | M6 | 14 | AI Image / Codex-Memory / PhotoStudio 外置化 | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M6_AI_IMAGE_MEMORY_PHOTOSTUDIO_CONTRACTS_20260621.md`；定义 adapter / memory / PhotoStudio 外置边界；clean core 不放 private state；docs-only。 |
| [x] | M7 | 10 | Stub / untrack / remove 决策 | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M7_STUB_UNTRACK_REMOVE_DECISION_20260621.md`；决策完成：keep core fallback，不执行 delete/untrack/stub，不改 dispatch，不开 upstream PR。 |
| [ ] | M8 | 10 | Upstream PR 和长期 rebase workflow | PARTIAL | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M8_UPSTREAM_PR_REBASE_WORKFLOW_20260621.md`；workflow / rebase gate ready；upstream/main `f8d45479` 预检无重叠文件；按用户决定先跳过打开 upstream PR；恢复条件已收紧为全计划本地实现 + 稳定运转证据 + 当前轮明确 upstream PR 授权。 |
| [x] | M9 | 0 | Agent externalization taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M9_AGENT_EXTERNALIZATION_TASKBOOK_20260621.md`；taskbook-only；定义 additive / override lane；不复制、不启用 runtime。 |
| [x] | M10 | 0 | Agent source scan + external skeleton | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M10_AGENT_COPY_FIRST_GATE_SKELETON_RECEIPT_20260621.md`；external commit `109d65e`；source candidates `9` risk `0`；target skeleton risk `0`；`MANIFEST_VERIFY_PASS count=6`。 |
| [x] | M11 | 0 | Agent reviewed candidate content gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M11_AGENT_CANDIDATE_CONTENT_GATE_RECEIPT_20260621.md`；7 additive + 2 override；`ALLOW_COPY=9`、`BLOCK=0`。 |
| [x] | M12 | 0 | Agent content copy-first | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M12_AGENT_CONTENT_COPY_FIRST_RECEIPT_20260621.md`；external commit `bc28782`；7 copied to `Agent/`、2 copied to `AgentOverrides/`；`MANIFEST_VERIFY_PASS count=15`；runtime still off。 |
| [x] | M13 | 0 | Agent shadow / loader contract validation | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M13_AGENT_SHADOW_LOADER_VALIDATION_RECEIPT_20260621.md`；shadow harness PASS；external HEAD `bc28782`；package risk `0`；env unset。 |
| [x] | M14 | 0 | Agent loader contract test-first pure resolver | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M14_AGENT_LOADER_CONTRACT_TEST_FIRST_RECEIPT_20260621.md`；`modules/agentRootResolver.js`；resolver tests `7 pass / 0 fail`；not wired into runtime yet。 |
| [x] | M15 | 0 | AgentManager runtime wiring review taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M15_AGENT_MANAGER_RUNTIME_WIRING_REVIEW_TASKBOOK_20260621.md`；alias、AdminPanel read/write、watch/cache、env-on shadow、rollback gates defined；docs-only。 |
| [x] | M16 | 0 | AgentManager runtime wiring default-off | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M16_AGENT_MANAGER_RUNTIME_WIRING_DEFAULT_OFF_RECEIPT_20260621.md`；`AgentManager` 接入 resolver 但仅 env-on 触发；Admin route external read-only/write-block；tests `14 pass / 0 fail`；真实 env 未设置。 |
| [x] | M17 | 0 | Agent env-on shadow / rollback drill | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M17_AGENT_ENV_ON_SHADOW_ROLLBACK_RECEIPT_20260621.md`；temp fixture env-on additive + override shadow PASS；Admin external read-only / write-block PASS；rollback unset env core-only PASS；package risk `0`、`MANIFEST_VERIFY_PASS count=15`；真实 env 未设置。 |
| [x] | M18 | 0 | Agent domain final closeout decision | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M18_AGENT_DOMAIN_FINAL_CLOSEOUT_DECISION_20260621.md`；决策：keep core Agent fallback + external Agent package in parallel；core fallback removal 仅 future proposal；不 delete/untrack/stub；下一领域 M19 LocalState planning。 |
| [x] | M19 | 0 | LocalState private-by-default route planning | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M19_LOCALSTATE_PRIVATE_ROUTE_TASKBOOK_20260621.md`；taskbook-only；定义 M20 skeleton scope、deny-all `.gitignore`、`.agent_board/**` gate matrix、stop conditions、receipt template；未读取/复制真实 LocalState。 |
| [x] | M20 | 0 | LocalState skeleton / paths-only gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M20_LOCALSTATE_SKELETON_PATHS_ONLY_RECEIPT_20260621.md`；PLAN_CHANGE：root 已存在，只补齐缺失 deny-all `.gitignore`；skeleton risk `0`、`.agent_board` path count `0`；不读取 private lanes。 |
| [x] | M21 | 0 | AdminPanel extension manifest route planning | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M21_ADMINPANEL_EXTENSION_MANIFEST_TASKBOOK_20260621.md`；taskbook-only；定义 `VCP_ADMIN_EXTENSION_DIRS`、manifest schema、default-off registration、M22 fixture/shadow validation、rollback；未改 AdminPanel runtime。 |
| [x] | M22 | 0 | AdminPanel extension build / shadow validation | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M22_ADMINPANEL_EXTENSION_SHADOW_VALIDATION_RECEIPT_20260621.md`；temp fixture manifest schema PASS；fixture risk `0`；checksum `f1b192f988e38430a71683cd0f37878e9ca078f23806e38bf77fcce75168c007`；rollback removed temp fixture；未注册真实 Admin route，未运行 AdminPanel build。 |
| [x] | M23 | 0 | AI Image adapter externalization planning | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M23_AI_IMAGE_ADAPTER_EXTERNALIZATION_TASKBOOK_20260621.md`；taskbook-only；定义 `VCP_AI_IMAGE_ADAPTER_DIRS`、manifest schema、source/private lane split、candidate gate、M24 no-provider shadow validation；未调用 provider、未生成图片。 |
| [x] | M24 | 0 | AI Image no-provider shadow validation | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M24_AI_IMAGE_NO_PROVIDER_SHADOW_VALIDATION_RECEIPT_20260621.md`；temp fixture manifest schema PASS；fixture risk `0`；checksum `6b1263812aebf1042752b0c09ca1f53032fd620647f41b19a49d4391bf87a05e`；provider/image/output/bridge/LocalState counters all `0`；rollback removed temp fixture。 |
| [x] | M25 | 0 | Codex/Memory external bridge planning | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M25_CODEX_MEMORY_EXTERNAL_BRIDGE_TASKBOOK_20260621.md`；taskbook-only；定义 `VCP_CODEX_MEMORY_BRIDGE_DIRS`、manifest schema、source/private lane split、candidate gate、no-live-write validation；未读取 private memory，未写 bridge。 |
| [x] | M26 | 0 | PhotoStudio externalization planning | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M26_PHOTOSTUDIO_EXTERNALIZATION_TASKBOOK_20260621.md`；taskbook-only；定义 `VCP_PHOTOSTUDIO_PACKAGE_DIRS`、source/private lane split、candidate gate、no-auto-write validation；未读取/复制项目数据，未外部写。 |
| [x] | M27 | 0 | Governance migration ledger finalization | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M27_GOVERNANCE_MIGRATION_LEDGER_FINALIZATION_20260621.md`；汇总 M0-M26 evidence、checksums、deferred/open risks、rollback map；docs-only，不改变 runtime。 |
| [ ] | M28 | 0 | Upstream PR decision revisit | DEFERRED | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M28_UPSTREAM_PR_DECISION_DEFERRED_20260621.md`；用户已决定先跳过打开 `lioensky/VCPToolBox` upstream PR；M38 已完成 Jenn fork 本地 accelerated closeout，但 upstream PR 仍需未来单独决策；不计入 Progress。 |
| [x] | M29 | 0 | Jenn fork maintenance route final closeout | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M29_JENN_FORK_MAINTENANCE_FINAL_CLOSEOUT_20260621.md`；active Jenn fork maintenance domains PASS；M8/S25 与 M28 upstream PR gates explicitly DEFERRED；全局 Progress 非 100%。 |
| [x] | M30 | 0 | Full local implementation + stability gate definition | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M30_LOCAL_IMPLEMENTATION_STABILITY_WINDOW_TASKBOOK_20260621.md`；定义 accelerated local closeout 与 optional 7-day calendar soak 双门、domain mini-gates、reset rules、receipt template；docs-only，不启用 runtime。 |
| [x] | M31 | 0 | AdminPanel persistent package gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M31_ADMINPANEL_PERSISTENT_PACKAGE_GATE_RECEIPT_20260621.md`；external commit `eff66b2979e319494e49bbeec9ccb652afcd57ee`；`AdminExtensions/JennAdminStatus` persistent skeleton；target risk `0`；checksum manifest `a2d0afb04ea17416c982f07b2e0f4d920ddd24929bfa406b3864825a58f1d5cf`；runtime registration still off。 |
| [x] | M32 | 0 | AI Image provider-adapter package gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M32_AI_IMAGE_PROVIDER_ADAPTER_PACKAGE_GATE_RECEIPT_20260621.md`；external commit `5edb89051291137859100cfc915349b9921f84cd`；`AIImageAdapters/JennImageProviderAdapter` persistent skeleton；target risk `0`；checksum manifest `9067d97dadf3c7a83138c90ac487ac0e2615b64c4a74de927b2d4a3670c548a7`；provider/runtime registration still off。 |
| [x] | M33 | 0 | Codex/Memory no-live-write package gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M33_CODEX_MEMORY_NO_LIVE_WRITE_PACKAGE_GATE_RECEIPT_20260621.md`；external commit `320cf17ec3204179a150161fa87429e1fef29cab`；`MemoryBridges/JennCodexMemoryBridge` persistent skeleton；target risk `0`；checksum manifest `2cff44db435e9458781d41e5260f1e73f246505fb118fabc7badec6f13dabaf2`；bridge/private-memory/LocalState/external/provider counters all `0`；runtime registration still off。 |
| [x] | M34 | 0 | PhotoStudio source package gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M34_PHOTOSTUDIO_SOURCE_PACKAGE_GATE_RECEIPT_20260621.md`；external commit `3a63904e753aa8b8869f588fc0b8fc862354e123`；`PhotoStudioPackages/JennPhotoStudioPackage` persistent skeleton；target risk `0`；checksum manifest `9e01af36f0ecd99c27294addc99d44d6592a5883fb5b41b2e2ee585f721809fd`；project-data/external/provider/bridge/LocalState counters all `0`；runtime registration still off。 |
| [x] | M35 | 0 | Aggregate full-local matrix review | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M35_AGGREGATE_FULL_LOCAL_MATRIX_REVIEW_20260621.md`；M31-M34 harnesses re-run PASS；current aggregate checksum manifest `9e01af36f0ecd99c27294addc99d44d6592a5883fb5b41b2e2ee585f721809fd`；package layer consistent；runtime gates still deferred；accelerated closeout completed later by M38。 |
| [x] | M36 | 0 | Optional calendar-soak entry | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M36_STABLE_OPERATION_WINDOW_ENTRY_20260621.md`；calendar-soak cycle receipt shape、required evidence、reset conditions、stop boundaries defined；after M38, this is future upstream-readiness evidence only。 |
| [x] | M37 | 0 | Calendar-soak opening evidence | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M37_STABLE_OPERATION_WINDOW_CYCLE_1_OPENING_RECEIPT_20260621.md`；`WINDOW_START=yes` at `2026-06-21T15:15:51+08:00`；M31-M34 harnesses PASS；current aggregate checksum `9e01af36f0ecd99c27294addc99d44d6592a5883fb5b41b2e2ee585f721809fd`；mid/final cycles deferred optional。 |
| [x] | M38 | 0 | Accelerated local stability closeout | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M38_ACCELERATED_LOCAL_STABILITY_CLOSEOUT_RECEIPT_20260621.md`；PLAN_CHANGE：7-day calendar wait no longer blocks local closeout；two fresh same-day revalidation rounds PASS；checksum `9e01af36f0ecd99c27294addc99d44d6592a5883fb5b41b2e2ee585f721809fd`；target risk `0`；runtime refs `0`；calendar soak deferred optional。 |
| [x] | M39 | 0 | Real config-env runtime-on local gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M39_REAL_CONFIG_ENV_RUNTIME_ON_LOCAL_GATE_RECEIPT_20260621.md` + M41 rerun；real `config.env` now has AgentOverrides lane enabled only；`VCP_AGENT_DIRS` unset；server/plugin/provider/bridge/live-write counters all `0`；values not printed。 |
| [x] | M40 | 0 | Agent real-config unlock decision gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M40_AGENT_REAL_CONFIG_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`；initial all-Agent candidate found `additive_duplicate_core_agent:7`，therefore narrowed to `AgentOverrides` only；post-apply validation PASS；provider/bridge/LocalState/private remain closed。 |
| [x] | M41 | 0 | AgentOverrides real-config apply and rerun | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M41_AGENTOVERRIDES_REAL_CONFIG_APPLY_RECEIPT_20260621.md`；user explicitly authorized two-key `config.env` edit；line counts `1/1/0` for allowed/override/additive; M39 PASS; M40 post-apply PASS; Agent tests `13 pass / 0 fail`。 |
| [x] | M42 | 0 | AgentOverrides runtime-on local read smoke | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M42_AGENTOVERRIDES_LOCAL_READ_SMOKE_RECEIPT_20260621.md`；`AgentManager.getAgentPrompt()` local read path hit external override for `Metis,Nova`; prompt content read but not printed；production/HTTP/Admin server not started；`VCP_AGENT_DIRS` unset。 |
| [x] | M43 | 0 | AgentOverrides config rollback drill | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M43_AGENTOVERRIDES_CONFIG_ROLLBACK_DRILL_RECEIPT_20260621.md`；temporary remove counts `0/0/0`; M42 expected BLOCK; restore counts `1/1/0`; M42 PASS; final config remains AgentOverrides only。 |
| [x] | M44 | 0 | AgentOverrides Admin write guard | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M44_AGENTOVERRIDES_ADMIN_WRITE_GUARD_RECEIPT_20260621.md`；Admin GET `Metis,Nova` external override `200,200`; Admin POST write blocked `403,403`; write trap `0`; core/external hashes unchanged；production server not started。 |
| [x] | M45 | 0 | AgentOverrides runtime-on aggregate review | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M45_AGENTOVERRIDES_RUNTIME_ON_AGGREGATE_REVIEW_RECEIPT_20260621.md`；M39/M40/M42/M44 fresh rerun PASS；Agent external runtime tests PASS；M43 receipt evidence present；`VCP_AGENT_DIRS` still `0`；no production/provider/bridge/LocalState/private/upstream side effects。 |
| [x] | M46 | 0 | Next runtime lane unlock decision gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M46_NEXT_RUNTIME_LANE_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`；`NEXT_AUTO_UNLOCKABLE_LANE=none`; Agent additive BLOCK due duplicate core ids；AdminPanel/AI Image/Codex-Memory/PhotoStudio DEFERRED；LocalState BLOCK；upstream PR DEFERRED；stop position reached。 |
| [x] | M47 | 0 | AdminPanel default-off runtime registration taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M47_ADMINPANEL_DEFAULT_OFF_RUNTIME_REGISTRATION_TASKBOOK_20260621.md`；taskbook-only；defines future M48 backend read-only default-off registry gate；frontend runtime registration deferred；no env write, no runtime code change, no AdminPanel build。 |
| [x] | M48 | 0 | AdminPanel backend default-off registry gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M48_ADMINPANEL_BACKEND_DEFAULT_OFF_REGISTRY_GATE_RECEIPT_20260621.md`；`modules/adminExtensionRegistry.js` + tests + harness；default-off/dirs-only/allowlist-missing no registration；scoped env-on local GET `200`; write methods `404`; rollback `404`; no real env write。 |
| [x] | M49 | 0 | AdminPanel backend registry shadow rollback drill | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M49_ADMINPANEL_BACKEND_REGISTRY_SHADOW_ROLLBACK_DRILL_RECEIPT_20260621.md`；scoped sequence off -> on -> rollback off -> reapply on -> partial env blocked；snapshot stable；GET `404/200/404/200/404`; no real env write。 |
| [x] | M50 | 0 | AdminPanel runtime-on local smoke with scoped env | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M50_ADMINPANEL_RUNTIME_ON_LOCAL_SMOKE_SCOPED_ENV_RECEIPT_20260621.md`；temporary `process.env` scoped keys；default-off GET `404`; runtime-on GET `200`; restore rollback GET `404`; real config untouched；production/frontend deferred。 |
| [x] | M51 | 0 | AdminPanel production-router integration taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M51_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_TASKBOOK_20260621.md`；taskbook-only；defined M52 backend integration gate；no `server.js` / `routes/adminPanelRoutes.js` change in M51；no real env/frontend/runtime enablement。 |
| [x] | M52 | 0 | AdminPanel backend production-router integration gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M52_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_RECEIPT_20260621.md`；`modules/adminExtensionRuntimeMount.js` + tests + scoped production-router harness；`routes/adminPanelRoutes.js` default-off integration；GET `200` only under scoped env；rollback `404`; no `server.js` / real env / frontend change。 |
| [x] | M53 | 0 | AdminPanel real-config unlock decision gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M53_ADMINPANEL_REAL_CONFIG_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`；dry-run selected `adminpanel-backend-readonly` three-key candidate；candidate registers 1 GET route with diagnostics `none`; no real `config.env` edit, no frontend/prod server/build。 |
| [x] | M54 | 0 | AdminPanel real-config apply + rollback drill | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M54_ADMINPANEL_REAL_CONFIG_APPLY_ROLLBACK_DRILL_RECEIPT_20260621.md`；authorized exact three-key real `config.env` apply；M52/M53 post-apply PASS；M54 rollback remove -> `404`, restore -> `200`; config ignored/not committed；frontend/prod server/build deferred。 |
| [x] | M55 | 0 | AdminPanel production-server smoke / frontend route-nav decision taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M55_ADMINPANEL_PRODUCTION_SMOKE_FRONTEND_DECISION_TASKBOOK_20260621.md`；docs-only decision：M56 smoke taskbook next, M57 actual smoke only with separate authorization and later completed, M58 frontend route/nav taskbook later completed；no server/frontend/build/env change in M55。 |
| [x] | M56 | 0 | AdminPanel production-server smoke taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M56_ADMINPANEL_PRODUCTION_SERVER_SMOKE_TASKBOOK_20260621.md`；taskbook-only；defines M57 command/port/auth/log/cleanup/rollback; no server start, no frontend/build/env change。 |
| [x] | M57 | 0 | AdminPanel production-server smoke | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M57_ADMINPANEL_PRODUCTION_SERVER_SMOKE_RECEIPT_20260621.md`；authorized short `node server.js` child-process smoke；GET `200` for `jenn.admin.status/read-only`; write methods `404`; PID cleanup PASS；frontend implementation still deferred。 |
| [x] | M58 | 0 | AdminPanel frontend route/nav taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M58_ADMINPANEL_FRONTEND_ROUTE_NAV_TASKBOOK_20260621.md`；docs-only；defines display boundary, metadata source, allowed frontend files, M59 static route/nav implementation gate; no frontend source/build/dist change。 |
| [x] | M59 | 0 | AdminPanel frontend route/nav static implementation | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M59_ADMINPANEL_FRONTEND_ROUTE_NAV_STATIC_IMPLEMENTATION_RECEIPT_20260621.md`；static `jenn-admin-status` route/nav/view implemented; targeted ESLint + `vue-tsc --noEmit` PASS；no build/dist/dynamic external import。 |
| [x] | M60 | 0 | AdminPanel build/dist decision taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M60_ADMINPANEL_BUILD_DIST_DECISION_TASKBOOK_20260621.md`；docs-only decision：no build/no dist now; M61 no-build route/source validation next; build/dist requires separate authorization and artifact policy。 |
| [x] | M61 | 0 | AdminPanel no-build route/source validation | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M61_ADMINPANEL_NO_BUILD_ROUTE_SOURCE_VALIDATION_RECEIPT_20260621.md`；source route/nav + no-secret display scan PASS；targeted ESLint + `vue-tsc --noEmit` PASS；M53 redacted gate PASS；no build/dev/preview/dist。 |
| [x] | M62 | 0 | AdminPanel build/lint path decision taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M62_ADMINPANEL_BUILD_LINT_PATH_DECISION_TASKBOOK_20260621.md`；docs-only；selected M63 temp outDir dry-build authorization taskbook; no build/lint cleanup/dist change。 |
| [x] | M63 | 0 | AdminPanel temp outDir dry-build authorization taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M63_ADMINPANEL_TEMP_OUTDIR_DRY_BUILD_AUTHORIZATION_TASKBOOK_20260621.md`；docs-only；exact future Vite temp outDir command, cleanup target, no-dist proof, and stop boundary defined; build not executed。 |
| [x] | M64 | 0 | AdminPanel temp outDir dry build | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M64_ADMINPANEL_TEMP_OUTDIR_DRY_BUILD_RECEIPT_20260621.md`；authorized Vite temp outDir build PASS；temp dist `255` files / `12179826` bytes；`AdminPanel-Vue/dist` hash unchanged；temp output cleaned；evidence fix documents corrected case-insensitive/bracket-pattern path scan and current auth-surface false positives。 |
| [x] | M65 | 0 | AdminPanel browser visual smoke taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M65_ADMINPANEL_BROWSER_VISUAL_SMOKE_TASKBOOK_20260621.md`；docs-only；selects M66 browser visual smoke before normal dist artifact gate; no server/browser/build/screenshots/dist change。 |
| [x] | M66 | 0 | AdminPanel browser visual smoke | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M66_ADMINPANEL_BROWSER_VISUAL_SMOKE_RECEIPT_20260621.md`；authorized temp build + local static server + Puppeteer/Chromium desktop/mobile smoke PASS；screenshots/temp output cleaned；`AdminPanel-Vue/dist` hash unchanged；normal dist artifact gate still deferred。 |
| [x] | M67 | 0 | AdminPanel normal dist artifact taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M67_ADMINPANEL_NORMAL_DIST_ARTIFACT_TASKBOOK_20260622.md`；docs-only；defines M68 normal typed build gate, dist artifact review, paths-only scan, stage allowlist, rollback and stop conditions；no build/dist change。 |
| [x] | M68 | 0 | AdminPanel normal dist artifact build | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M68_ADMINPANEL_NORMAL_DIST_ARTIFACT_RECEIPT_20260622.md`；authorized `npm run build --prefix AdminPanel-Vue` PASS；dist indexed count `255`; cached diff `18 add / 1 mod / 16 del / 38 rename`; source/package/config unchanged；upstream PR deferred。 |
| [x] | M69 | 0 | AdminPanel post-dist static smoke | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M69_ADMINPANEL_POST_DIST_STATIC_SMOKE_RECEIPT_20260622.md`；post-M68 committed dist static smoke PASS；desktop/mobile route/text/icon/nonblank checks PASS；temp screenshots cleaned；dist hash unchanged。 |
| [x] | M70 | 0 | AdminPanel artifact lane closeout decision | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M70_ADMINPANEL_ARTIFACT_LANE_CLOSEOUT_DECISION_20260622.md`；AdminPanel artifact lane closed for current route；production deploy/upstream PR/dynamic external Vue/write surfaces remain deferred。 |
| [x] | M71 | 0 | Aggregate Jenn fork local route review | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M71_AGGREGATE_JENN_FORK_LOCAL_ROUTE_REVIEW_20260622.md`；AgentOverrides override-only runtime-on、AdminPanel artifact lane closeout、AI Image/Codex-Memory/PhotoStudio package-layer runtime-deferred、LocalState/private BLOCK、upstream PR DEFERRED 已放入同一张核对表；docs-only review。 |
| [x] | M72 | 0 | Next runtime lane decision or deferred closeout | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M72_NEXT_RUNTIME_LANE_DECISION_OR_DEFERRED_DOMAIN_CLOSEOUT_20260622.md`；decision = `WRITE_ONE_NARROW_TASKBOOK`；selected next taskbook `M73_AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_TASKBOOK`；Codex/Memory、PhotoStudio、LocalState/private、upstream PR remain deferred/BLOCK。 |
| [x] | M73 | 0 | AI Image no-provider runtime registration taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M73_AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_TASKBOOK_20260622.md`；taskbook-only；defines future M74 default-off manifest/metadata registry gate；no runtime/env/external package/provider/image/private/upstream action。 |
| [x] | M74 | 0 | AI Image default-off adapter metadata registry | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M74_AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_RECEIPT_20260622.md`；`modules/aiImageAdapterRegistry.js` metadata-only registry；scoped env metadata count `1`、executable count `0`；provider/image/output/bridge/LocalState counters `0`；no real env/server/provider/image/private/upstream action。 |
| [x] | M75 | 0 | AI Image registry review / closeout decision | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M75_AI_IMAGE_REGISTRY_REVIEW_OR_CLOSEOUT_DECISION_20260622.md`；decision `WRITE_M76_DEFAULT_OFF_DIAGNOSTIC_ROUTE_TASKBOOK`; metadata-only closeout now `no`; route implementation now `no`; no real env/provider/image/private/upstream action。 |
| [x] | M76 | 0 | AI Image default-off diagnostic route taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M76_AI_IMAGE_DEFAULT_OFF_DIAGNOSTIC_ROUTE_TASKBOOK_20260622.md`；taskbook-only；defines future `GET /admin_api/ai-image-adapter-registry/diagnostics` URL/auth/allowed fields/forbidden fields/rollback/M77 stop line；no route/runtime/env/provider/image/private/upstream action。 |
| [x] | M77 | 0 | AI Image default-off diagnostic route factory gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M77_AI_IMAGE_DEFAULT_OFF_DIAGNOSTIC_ROUTE_RECEIPT_20260622.md`；route factory only；default-off `404`、unauthorized `403`、scoped `200`、POST `404`、real execution env `409`；response absolute path/secret field count `0`；no production router/env/provider/image/private/upstream action。 |
| [x] | M78 | 0 | AI Image diagnostic route production-router decision | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M78_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_DECISION_20260622.md`；decision `WRITE_M79_PRODUCTION_ROUTER_INTEGRATION_TASKBOOK`; route factory unmounted now `yes`; production-router implementation now `no`; no real env/provider/image/private/upstream action。 |
| [x] | M79 | 0 | AI Image diagnostic route production-router integration taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M79_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_INTEGRATION_TASKBOOK_20260622.md`；taskbook-only；defines M80 default-off production-router mount/auth/env/rollback/validation gate；no code/env/provider/image/private/upstream action。 |
| [x] | M80 | 0 | AI Image diagnostic route production-router integration gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M80_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_INTEGRATION_RECEIPT_20260622.md`；`routes/adminPanelRoutes.js` default-off helper integration；default-off `404`、scoped `200`、unauthorized `403`、POST `404`、real execution `409`；no `server.js` / real env / provider / image / private action。 |
| [x] | M81 | 0 | AI Image diagnostic route real-config unlock decision | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M81_AI_IMAGE_DIAGNOSTIC_ROUTE_REAL_CONFIG_UNLOCK_DECISION_20260622.md`；decision `SELECT_M82_AI_IMAGE_DIAGNOSTIC_METADATA_REAL_CONFIG_APPLY_ROLLBACK_DRILL`; real config write now `no`; provider/image/bridge/LocalState/upstream remain closed。 |
| [x] | M82 | 0 | AI Image diagnostic real-config apply/rollback drill | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M82_AI_IMAGE_DIAGNOSTIC_REAL_CONFIG_APPLY_ROLLBACK_DRILL_RECEIPT_20260622.md`；authorized transient real `config.env` three-key write; after apply route `200`; unauthorized `403`; real execution `409`; rollback route `404`; final hash restored; final state `OPTION_B_REMOVED_AFTER_ROLLBACK`。 |

全局进度明细：

```text
M0-M7 PASS：8.0 / 8 units
M8 PARTIAL：0.7 / 1 unit（S23+S24 = 7 / 10；S25 upstream PR 仍 DEFERRED）
M9-M27 PASS：19.0 / 19 units
M28 DEFERRED：0 / 1 unit
M29 PASS：1.0 / 1 unit
M30 PASS：1.0 / 1 unit
M31 PASS：1.0 / 1 unit
M32 PASS：1.0 / 1 unit
M33 PASS：1.0 / 1 unit
M34 PASS：1.0 / 1 unit
M35 PASS：1.0 / 1 unit
M36 PASS：1.0 / 1 unit
M37 PASS：1.0 / 1 unit
M38 PASS：1.0 / 1 unit
M39 PASS：1.0 / 1 unit（M41 后真实 config-env runtime-on gate PASS；AgentOverrides only）
M40 PASS：1.0 / 1 unit（AgentOverrides-only unlock decision；不修改真实 config）
M41 PASS：1.0 / 1 unit（真实 `config.env` 两键应用 + M39/M40 rerun）
M42 PASS：1.0 / 1 unit（AgentOverrides local read smoke；no production server）
M43 PASS：1.0 / 1 unit（AgentOverrides config rollback drill）
M44 PASS：1.0 / 1 unit（AgentOverrides Admin write guard）
M45 PASS：1.0 / 1 unit（AgentOverrides runtime-on aggregate review）
M46 PASS：1.0 / 1 unit（next runtime lane unlock decision gate；no auto-unlockable lane）
M47 PASS：1.0 / 1 unit（AdminPanel default-off runtime registration taskbook；docs-only）
M48 PASS：1.0 / 1 unit（AdminPanel backend default-off registry gate；scoped local proof）
M49 PASS：1.0 / 1 unit（AdminPanel backend registry shadow rollback drill；scoped env only）
M50 PASS：1.0 / 1 unit（AdminPanel runtime-on local smoke；scoped process.env only）
M51 PASS：1.0 / 1 unit（AdminPanel production-router integration taskbook；docs-only）
M52 PASS：1.0 / 1 unit（AdminPanel backend production-router integration gate；default-off）
M53 PASS：1.0 / 1 unit（AdminPanel real-config unlock decision gate；pre-apply dry-run）
M54 PASS：1.0 / 1 unit（AdminPanel real-config apply + rollback drill；backend-readonly）
M55 PASS：1.0 / 1 unit（AdminPanel production-server smoke / frontend route-nav decision taskbook；docs-only）
M56 PASS：1.0 / 1 unit（AdminPanel production-server smoke taskbook；docs-only）
M57 PASS：1.0 / 1 unit（AdminPanel production-server smoke；short child-process runtime proof）
M58 PASS：1.0 / 1 unit（AdminPanel frontend route/nav taskbook；docs-only）
M59 PASS：1.0 / 1 unit（AdminPanel frontend route/nav static implementation；no build/dist）
M60 PASS：1.0 / 1 unit（AdminPanel build/dist decision taskbook；docs-only）
M61 PASS：1.0 / 1 unit（AdminPanel no-build route/source validation）
M62 PASS：1.0 / 1 unit（AdminPanel build/lint path decision taskbook；docs-only）
M63 PASS：1.0 / 1 unit（AdminPanel temp outDir dry-build authorization taskbook；docs-only）
M64 PASS：1.0 / 1 unit（AdminPanel temp outDir dry build；temp output cleaned）
M65 PASS：1.0 / 1 unit（AdminPanel browser visual smoke taskbook；docs-only）
M66 PASS：1.0 / 1 unit（AdminPanel browser visual smoke；temp build/static server/screenshots cleaned）
M67 PASS：1.0 / 1 unit（AdminPanel normal dist artifact taskbook；docs-only）
M68 PASS：1.0 / 1 unit（AdminPanel normal dist artifact build；dist staged）
M69 PASS：1.0 / 1 unit（AdminPanel post-dist static smoke；temp screenshots cleaned）
M70 PASS：1.0 / 1 unit（AdminPanel artifact lane closeout decision）
M71 PASS：1.0 / 1 unit（aggregate Jenn fork local route review；docs-only）
M72 PASS：1.0 / 1 unit（next runtime lane decision；M73 AI Image no-provider taskbook selected）
M73 PASS：1.0 / 1 unit（AI Image no-provider runtime registration taskbook；docs-only）
M74 PASS：1.0 / 1 unit（AI Image default-off adapter metadata registry；metadata-only scoped env proof）
M75 PASS：1.0 / 1 unit（AI Image registry review / closeout decision；M76 taskbook selected）
M76 PASS：1.0 / 1 unit（AI Image default-off diagnostic route taskbook；docs-only）
M77 PASS：1.0 / 1 unit（AI Image default-off diagnostic route factory gate；test-only local mount proof）
M78 PASS：1.0 / 1 unit（AI Image diagnostic route production-router decision；M79 taskbook selected）
M79 PASS：1.0 / 1 unit（AI Image diagnostic route production-router integration taskbook；docs-only）
M80 PASS：1.0 / 1 unit（AI Image diagnostic route production-router integration gate；default-off scoped proof）
M81 PASS：1.0 / 1 unit（AI Image diagnostic route real-config unlock decision；M82 apply/rollback selected, no config write）
M82 PASS：1.0 / 1 unit（AI Image diagnostic real-config apply/rollback drill；final config restored and keys removed）
Global Progress：81.7 / 83 = 98.43%，顶部显示为 98%
```

## 3. 短期执行记录（Sprint Ledger）

当前 sprint ledger 记录实际执行顺序。M8 upstream PR 仍按用户决定 deferred，不自动打开 upstream PR。Agent 外置路线已提升为 M9-M18 正式路线段，短期记录继续使用 S 编号。

| 完成 | ID | 父项 | 原始分 | 任务 | Status | 证据 |
| --- | --- | --- | ---: | --- | --- | --- |
| [x] | S1 | M1 | 3 | 建立 Jenn fork 内部 clean-base PR 流程 | PASS | PR #272 base `codex/upstream-main-clean-base`；PR #272 已合并为 `86c69e8d`；upstream PR #365 已关闭。 |
| [x] | S2 | M1 | 4 | 实现 Phase 1 plugin contract | PASS | `Plugin.js` + 4 个 contract modules。 |
| [x] | S3 | M1 | 2 | 用 targeted tests 覆盖 allowlist / registration / env sandbox | PASS | final 6-test run：`65 pass / 0 fail`。 |
| [x] | S4 | M1 | 1 | 在 PR body 记录 Phase 1 验收状态 | PASS | PR #272 body 已更新 PASS / PARTIAL / DEFERRED matrix。 |
| [x] | S5 | M1 | 2 | 关闭 PR #272 内部 review，并决定 ready / continue | PASS | 结论：ready 后已内部合并；PR #272 final head `a4225aca`；merge commit `86c69e8d`；3 个 P2 threads resolved；6-test 复跑：`65 pass / 0 fail`。 |
| [x] | S6 | M2 | 3 | 写 External Runtime skeleton 任务书 | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S6_EXTERNAL_RUNTIME_SKELETON_TASKBOOK_20260620.md`；docs-only，没有 clean core runtime 改动。 |
| [x] | S7 | M2 | 3 | 落地完整 denylist / `.gitignore` baseline | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S7_DENYLIST_GITIGNORE_BASELINE_20260621.md`；复用 AGENTS sensitive paths、S2 harness sensitive pathspecs、P3E taxonomy；保留 `Plugin/**/dist/**`，默认排除 `.agent_board/**`。 |
| [x] | S8 | M2 | 3 | 定义 LocalState skeleton 和 `.agent_board/**` 人工 gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S8_LOCALSTATE_AGENT_BOARD_GATE_20260621.md`；LocalState private-by-default；`.agent_board/**` 有单独 gate，默认 blocked，不能自动 copy/checksum/migrate。 |
| [x] | S9 | M2 | 3 | 定义 manifests / checksum 规则 | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S9_MANIFEST_CHECKSUM_RULES_20260621.md`；先 denylist / paths-only secret-risk scan，再生成 `MANIFEST.sha256`；checksum 不等于 runtime registration proof。 |
| [x] | S10 | M3 | 4 | 确认 `JennAIGentOrchestrator` external copy-first pilot | PASS | External package `Plugin/JennAIGentOrchestrator/`；manifest identity `JennAIGentOrchestrator`；runtime payload refresh limited to reviewed source files；source `.disabled` 未复制。 |
| [x] | S11 | M3 | 4 | 路径级 secret-risk scan 和 pilot checksum | PASS | `SOURCE_PATH_SCAN_CLEAN count=5`；`TARGET_POST_COPY_PATH_SCAN_CLEAN count=4`；`PACKAGE_PATH_SCAN_CLEAN count=29`；`MANIFEST_VERIFY_PASS count=4`。 |
| [x] | S12 | M3 | 4 | 写入 M3 external receipt 并记录 tracker | PASS | External package commit `b4f250e`；`receipts/M3_JENN_AIGENT_ORCHESTRATOR_COPY_FIRST_RECEIPT_20260621.md`；core tracker commit `f8b798bc`。 |
| [x] | S13 | M4 | 3 | 验证 external discovery / registration gate | PASS | `node tests/plugin-external-dirs.test.js`：`14 pass / 0 fail`；`node tests/plugin-external-runtime-registration-gate.test.js`：`6 pass / 0 fail`；`node tests/plugin-external-runtime-direct-policy.test.js`：`5 pass / 0 fail`。 |
| [x] | S14 | M4 | 4 | 执行 Jenn no-provider shadow validation | PASS | `node scripts/run-jenn-aigent-orchestrator-plugin-execution-validation-harness.js --stage8-no-provider-external-plugin-execution-proof`：PASS；provider/image/LocalState/server/runtime cutover 均为 no。 |
| [x] | S15 | M4 | 3 | 执行 rollback overlay drill 并写 receipt | PASS | `node scripts/run-jenn-aigent-orchestrator-rollback-drill-harness.js --stage88-rollback-drill-proof`：PASS；`docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M4_SHADOW_VALIDATION_ROLLBACK_RECEIPT_20260621.md`。 |
| [x] | S16 | M5 | 4 | 定义 Agent externalization contract | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M5_AGENT_LOCALSTATE_ADMIN_CONTRACTS_20260621.md`；定义 `VCP_AGENT_DIRS`、`VCP_AGENT_OVERRIDE_DIRS`；docs-only。 |
| [x] | S17 | M5 | 5 | 定义 LocalState contract | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M5_AGENT_LOCALSTATE_ADMIN_CONTRACTS_20260621.md`；定义 `VCP_LOCAL_STATE_DIR`；LocalState 非 plugin/Agent/Admin root；`.agent_board/**` 仍 blocked。 |
| [x] | S18 | M5 | 5 | 定义 AdminPanel extension contract | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M5_AGENT_LOCALSTATE_ADMIN_CONTRACTS_20260621.md`；定义 `VCP_ADMIN_EXTENSION_DIRS`；未运行 AdminPanel build；未注册 route。 |
| [x] | S19 | M6 | 5 | 定义 AI Image adapter 外置边界 | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M6_AI_IMAGE_MEMORY_PHOTOSTUDIO_CONTRACTS_20260621.md`；generic adapter、provider-off、无 Jenn trial/provider 常量写回 core。 |
| [x] | S20 | M6 | 4 | 定义 Codex/Memory 外置边界 | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M6_AI_IMAGE_MEMORY_PHOTOSTUDIO_CONTRACTS_20260621.md`；manifest/path/fixture-only validation；不读取 private memory。 |
| [x] | S21 | M6 | 5 | 定义 PhotoStudio 外置边界 | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M6_AI_IMAGE_MEMORY_PHOTOSTUDIO_CONTRACTS_20260621.md`；no-auto-write；项目数据留在 LocalState/private lane。 |
| [x] | S22 | M7 | 10 | 完成 stub / untrack / remove 决策包但不执行 | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M7_STUB_UNTRACK_REMOVE_DECISION_20260621.md`；决策：keep core fallback；不 delete/untrack/stub；不改 dispatch；不打开 upstream PR。 |
| [x] | S23 | M8 | 3 | 准备 upstream PR readiness packet | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M8_UPSTREAM_PR_REBASE_WORKFLOW_20260621.md`；明确 upstream candidate 只能来自 `origin/codex/upstream-main-clean-base` / Phase 1 generic contract，不使用 M2-M8 governance branch 直接开 PR。 |
| [x] | S24 | M8 | 4 | 定义长期 rebase workflow 和 conflict budget | PASS | `upstream/main` 已 fetch 到 `f8d45479`；merge-base `f901f1a9`；read-only preflight：upstream changed files `12`、clean-base changed files `11`、intersection `0`、merge-tree conflict markers none observed。 |
| [ ] | S25 | M8 | 3 | 人工授权后打开 upstream PR | DEFERRED | 用户决定先跳过打开 `lioensky/VCPToolBox` upstream PR；若未来恢复，需要当前轮明确授权目标仓库、source branch、target branch 和 action `open upstream PR`。 |
| [x] | S26 | M0 | 1 | 补齐 upstream/origin remote 与 clean-core 创建记录 | PASS | `upstream/main = f8d45479`；`origin/codex/upstream-main-clean-base = 86c69e8d`；merge parents `f901f1a9` + `a4225aca`；记录在 M0 evidence。 |
| [x] | S27 | M0 | 1 | 补齐旧 Jenn fork path-only inventory | PASS | `origin/main = e5874076`；tracked paths `5449`；Plugin paths `1501`；plugin manifests `141`；Agent txt `12`；Admin views `51`；Admin routes `31`；tests `114`。 |
| [x] | S28 | M0 | 1 | 补齐 paths-only secret-risk scan 证据 | PASS | `origin/main` high-risk path count `8`；clean-base count `28`；pre-M0 evidence HEAD `df314cd2` count `8`；external package count `0`；LocalState exists but enumeration skipped private-by-default。 |
| [x] | S29 | Agent | 0 | 写 Agent externalization taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M9_AGENT_EXTERNALIZATION_TASKBOOK_20260621.md`；taskbook-only；Agent path inventory：Jenn fork `16`、clean-base `9`、risk `0`；不复制 Agent、不创建 external Agent 目录、不改 loader。 |
| [x] | S30 | Agent | 0 | 审查 M9 taskbook | PASS | M9 review findings `0`；无 actionable issue；进入 Agent copy-first gate preflight。 |
| [x] | S31 | Agent | 0 | Agent source path scan + external skeleton | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M10_AGENT_COPY_FIRST_GATE_SKELETON_RECEIPT_20260621.md`；external commit `109d65e`；source candidates `9` risk `0`；target skeleton paths `2` risk `0`；`MANIFEST_VERIFY_PASS count=6`；不复制 Agent 内容、不启用 runtime。 |
| [x] | S32 | Agent | 0 | Agent reviewed candidate content gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M11_AGENT_CANDIDATE_CONTENT_GATE_RECEIPT_20260621.md`；7 additive + 2 override candidates reviewed；`ALLOW_COPY=9`、`NEEDS_REVIEW=0`、`BLOCK=0`；不复制 Agent 内容、不改 external package、不启用 runtime。 |
| [x] | S33 | Agent | 0 | Agent content copy-first 到 external package | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M12_AGENT_CONTENT_COPY_FIRST_RECEIPT_20260621.md`；external commit `bc28782`；7 additive copied to `Agent/`，2 override copied to `AgentOverrides/`；target risk `0`、package risk `0`、`MANIFEST_VERIFY_PASS count=15`；不启用 runtime。 |
| [x] | S34 | Agent | 0 | Agent copy-first shadow / loader contract validation | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M13_AGENT_SHADOW_LOADER_VALIDATION_RECEIPT_20260621.md`；harness `scripts/run-agent-content-copy-first-shadow-validation-harness.js`；`AGENT_COPY_FIRST_SHADOW_VALIDATION_PASS`；external HEAD `bc28782`；target risk `0`、package risk `0`、`MANIFEST_VERIFY_PASS count=15`；Agent env unset；不启用 runtime。 |
| [x] | S35 | Agent | 0 | Agent loader contract test-first pure resolver | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M14_AGENT_LOADER_CONTRACT_TEST_FIRST_RECEIPT_20260621.md`；新增 `modules/agentRootResolver.js` + `tests/agent-external-root-resolver.test.js`；`node --test tests/agent-external-root-resolver.test.js`：`7 pass / 0 fail`；未接入 `AgentManager`，不启用 runtime。 |
| [x] | S36 | Agent | 0 | AgentManager runtime wiring review taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M15_AGENT_MANAGER_RUNTIME_WIRING_REVIEW_TASKBOOK_20260621.md`；定义 `agent_map.json` alias、AdminPanel read/write、watch/cache、env-on shadow validation、rollback 和 stop conditions；docs-only，未接线 runtime。 |
| [x] | S37 | Agent | 0 | AgentManager runtime wiring default-off patch | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M16_AGENT_MANAGER_RUNTIME_WIRING_DEFAULT_OFF_RECEIPT_20260621.md`；`modules/agentManager.js` 接入 pure resolver 但仅在 `VCP_AGENT_DIRS` / `VCP_AGENT_OVERRIDE_DIRS` 设置时触发；Admin route external read-only/write-block；`node --test tests/agent-external-root-resolver.test.js tests/agent-manager-external-runtime.test.js tests/dotenvPatch.test.js`：`14 pass / 0 fail`；未设置真实 env。 |
| [x] | S38 | Agent / M17 | 0 | Agent env-on shadow / rollback drill | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M17_AGENT_ENV_ON_SHADOW_ROLLBACK_RECEIPT_20260621.md`；新增 `scripts/run-agent-env-on-shadow-rollback-harness.js`；`AGENT_ENV_ON_SHADOW_ROLLBACK_PASS`；targeted tests `15 pass / 0 fail`；package risk `0`、`MANIFEST_VERIFY_PASS count=15`；真实 env 未设置。 |
| [x] | S39 | Agent / M18 | 0 | Agent domain final closeout decision packet | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M18_AGENT_DOMAIN_FINAL_CLOSEOUT_DECISION_20260621.md`；Agent 领域 closeout：keep core fallback；future stub/untrack proposal only；下一领域 M19；不执行 delete/untrack/stub。 |
| [x] | S40 | LocalState / M19 | 0 | LocalState route planning taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M19_LOCALSTATE_PRIVATE_ROUTE_TASKBOOK_20260621.md`；M20 skeleton / paths-only gate defined；`.agent_board/**` remains blocked；不读取 LocalState 内容。 |
| [x] | S41 | LocalState / M20 | 0 | LocalState skeleton / paths-only receipt | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M20_LOCALSTATE_SKELETON_PATHS_ONLY_RECEIPT_20260621.md`；existing root plan-change；created `.gitignore` only；approved skeleton paths `3/3`；risk `0`；private content read `no`。 |
| [x] | S42 | AdminPanel / M21 | 0 | AdminPanel extension manifest taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M21_ADMINPANEL_EXTENSION_MANIFEST_TASKBOOK_20260621.md`；manifest schema + default-off gate + M22 fixture validation plan；不注册真实 route。 |
| [x] | S43 | AdminPanel / M22 | 0 | AdminPanel extension build shadow validation | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M22_ADMINPANEL_EXTENSION_SHADOW_VALIDATION_RECEIPT_20260621.md`；harness `ADMIN_EXTENSION_MANIFEST_SHADOW_VALIDATION_PASS`；fixture risk `0`；checksum entries `4`；rollback removed temp fixture；不 production deploy、不注册真实 route。 |
| [x] | S44 | AI Image / M23 | 0 | AI Image adapter taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M23_AI_IMAGE_ADAPTER_EXTERNALIZATION_TASKBOOK_20260621.md`；generic adapter、provider-off、fixture boundary、candidate gate；不 provider call、不生成图片。 |
| [x] | S45 | AI Image / M24 | 0 | AI Image no-provider shadow validation | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M24_AI_IMAGE_NO_PROVIDER_SHADOW_VALIDATION_RECEIPT_20260621.md`；harness `AI_IMAGE_NO_PROVIDER_SHADOW_VALIDATION_PASS`；fixture risk `0`；provider/image/output/bridge/LocalState counters `0`；不生成真实图片。 |
| [x] | S46 | Codex/Memory / M25 | 0 | Codex/Memory external bridge taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M25_CODEX_MEMORY_EXTERNAL_BRIDGE_TASKBOOK_20260621.md`；manifest/path-only/no-live-write plan；不读取 private memory；不 bridge 外写。 |
| [x] | S47 | PhotoStudio / M26 | 0 | PhotoStudio externalization taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M26_PHOTOSTUDIO_EXTERNALIZATION_TASKBOOK_20260621.md`；data exclusion、copy-first gates、no-auto-write plan；不读取项目私有数据。 |
| [x] | S48 | Governance / M27 | 0 | Migration ledger finalization | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M27_GOVERNANCE_MIGRATION_LEDGER_FINALIZATION_20260621.md`；evidence index、checksums、deferred/BLOCK、rollback map；docs-only。 |
| [ ] | S49 | Upstream / M28 | 0 | Upstream PR decision revisit | DEFERRED | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M28_UPSTREAM_PR_DECISION_DEFERRED_20260621.md`；需要用户当前轮明确授权，否则保持 deferred；本轮未打开 upstream PR。 |
| [x] | S50 | Closeout / M29 | 0 | Jenn fork maintenance final closeout | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M29_JENN_FORK_MAINTENANCE_FINAL_CLOSEOUT_20260621.md`；active/deferred/block 状态、最终风险、rollback、下一周期路线已记录。 |
| [x] | S51 | Stability / M30 | 0 | Full local implementation + stability gate definition | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M30_LOCAL_IMPLEMENTATION_STABILITY_WINDOW_TASKBOOK_20260621.md`；定义 accelerated local closeout 与 optional calendar soak 双门、domain mini-gates、reset rules、receipt template；不启用 runtime。 |
| [x] | S52 | AdminPanel / M31 | 0 | AdminPanel persistent package gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M31_ADMINPANEL_PERSISTENT_PACKAGE_GATE_RECEIPT_20260621.md`；external package commit `eff66b2979e319494e49bbeec9ccb652afcd57ee`；`ADMINPANEL_PERSISTENT_PACKAGE_GATE_PASS`；不注册 route、不跑 AdminPanel build、不启用 runtime。 |
| [x] | S53 | AI Image / M32 | 0 | AI Image provider-adapter package gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M32_AI_IMAGE_PROVIDER_ADAPTER_PACKAGE_GATE_RECEIPT_20260621.md`；external package commit `5edb89051291137859100cfc915349b9921f84cd`；`AI_IMAGE_PROVIDER_ADAPTER_PACKAGE_GATE_PASS`；provider/image/output/bridge/LocalState counters all `0`；不启用 runtime。 |
| [x] | S54 | Codex/Memory / M33 | 0 | Codex/Memory no-live-write package gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M33_CODEX_MEMORY_NO_LIVE_WRITE_PACKAGE_GATE_RECEIPT_20260621.md`；external package commit `320cf17ec3204179a150161fa87429e1fef29cab`；`CODEX_MEMORY_NO_LIVE_WRITE_PACKAGE_GATE_PASS`；bridge/private-memory/LocalState/external/provider counters all `0`；不启用 runtime。 |
| [x] | S55 | PhotoStudio / M34 | 0 | PhotoStudio source package gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M34_PHOTOSTUDIO_SOURCE_PACKAGE_GATE_RECEIPT_20260621.md`；external package commit `3a63904e753aa8b8869f588fc0b8fc862354e123`；`PHOTOSTUDIO_SOURCE_PACKAGE_GATE_PASS`；project-data/external/provider/bridge/LocalState counters all `0`；不启用 runtime。 |
| [x] | S56 | Matrix / M35 | 0 | Aggregate full-local matrix review | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M35_AGGREGATE_FULL_LOCAL_MATRIX_REVIEW_20260621.md`；M31-M34 harnesses re-run PASS；package layer consistent；runtime gates still deferred。 |
| [x] | S57 | Stability / M36 | 0 | Optional calendar-soak entry | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M36_STABLE_OPERATION_WINDOW_ENTRY_20260621.md`；calendar cycle receipt shape、evidence、reset conditions、stop boundaries defined；future upstream-readiness evidence only after M38。 |
| [x] | S58 | Stability / M37 | 0 | Calendar-soak opening evidence | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M37_STABLE_OPERATION_WINDOW_CYCLE_1_OPENING_RECEIPT_20260621.md`；`WINDOW_START=yes`；M31-M34 harnesses PASS；mid/final cycles deferred optional；not local closeout blocker after M38。 |
| [x] | S59 | Stability / M38 | 0 | Accelerated local stability closeout | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M38_ACCELERATED_LOCAL_STABILITY_CLOSEOUT_RECEIPT_20260621.md`；two same-day revalidation rounds PASS；checksum unchanged；target risk `0`；runtime refs `0`；calendar soak deferred optional；upstream PR not opened。 |
| [x] | S60 | Runtime-on / M39 | 0 | Real config-env runtime-on local gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M39_REAL_CONFIG_ENV_RUNTIME_ON_LOCAL_GATE_RECEIPT_20260621.md` + M41 rerun；real `config.env` AgentOverrides lane enabled；`VCP_AGENT_DIRS` unset；provider/bridge/LocalState/private closed。 |
| [x] | S61 | Agent / M40 | 0 | Agent real-config unlock decision gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M40_AGENT_REAL_CONFIG_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`；dry-run selected `AgentOverrides` only；`VCP_AGENT_DIRS` additive remains off due duplicate core ids；provider/bridge/LocalState/private closed；`config.env` not modified。 |
| [x] | S62 | Agent / M41 | 0 | AgentOverrides real-config apply and rerun | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M41_AGENTOVERRIDES_REAL_CONFIG_APPLY_RECEIPT_20260621.md`；exact two-key `config.env` edit applied locally；M39/M40 rerun PASS；Agent tests `13 pass / 0 fail`；`config.env` ignored and not committed。 |
| [x] | S63 | Agent / M42 | 0 | AgentOverrides runtime-on local read smoke | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M42_AGENTOVERRIDES_LOCAL_READ_SMOKE_RECEIPT_20260621.md`；`READ_PATHS_MATCH_EXTERNAL_OVERRIDE=yes`; `PROMPT_HASH_MATCHES_EXTERNAL_OVERRIDE=yes`; production/HTTP/Admin server not started；`VCP_AGENT_DIRS` unset。 |
| [x] | S64 | Agent / M43 | 0 | AgentOverrides config rollback drill | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M43_AGENTOVERRIDES_CONFIG_ROLLBACK_DRILL_RECEIPT_20260621.md`；remove two keys -> M42 expected BLOCK；restore two keys -> M42 PASS；final `config.env` hash restored；`VCP_AGENT_DIRS` unset。 |
| [x] | S65 | Agent / M44 | 0 | AgentOverrides Admin write guard | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M44_AGENTOVERRIDES_ADMIN_WRITE_GUARD_RECEIPT_20260621.md`；Admin GET external override PASS；Admin POST external write returns `403,403`; write trap `0`; hashes unchanged；production server not started。 |
| [x] | S66 | Agent / M45 | 0 | AgentOverrides runtime-on aggregate review | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M45_AGENTOVERRIDES_RUNTIME_ON_AGGREGATE_REVIEW_RECEIPT_20260621.md`；aggregate harness PASS；M39/M40/M42/M44 fresh rerun PASS；M43 receipt evidence checked, not rerun；Agent tests PASS。 |
| [x] | S67 | Decision / M46 | 0 | Next runtime lane unlock decision gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M46_NEXT_RUNTIME_LANE_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`；no auto-unlockable lane；recommended next safe milestone `M47_ADMINPANEL_RUNTIME_REGISTRATION_TASKBOOK`; stop required before runtime/env enablement。 |
| [x] | S68 | AdminPanel / M47 | 0 | AdminPanel default-off runtime registration taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M47_ADMINPANEL_DEFAULT_OFF_RUNTIME_REGISTRATION_TASKBOOK_20260621.md`；docs-only；future M48 backend read-only registry gate defined；frontend/runtime/env activation deferred。 |
| [x] | S69 | AdminPanel / M48 | 0 | AdminPanel backend default-off registry gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M48_ADMINPANEL_BACKEND_DEFAULT_OFF_REGISTRY_GATE_RECEIPT_20260621.md`；registry/test/harness PASS；scoped env only；production router untouched；frontend deferred。 |
| [x] | S70 | AdminPanel / M49 | 0 | AdminPanel backend registry shadow rollback drill | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M49_ADMINPANEL_BACKEND_REGISTRY_SHADOW_ROLLBACK_DRILL_RECEIPT_20260621.md`；M48 rerun PASS；off/on/rollback/reapply scoped sequence PASS；real config untouched。 |
| [x] | S71 | AdminPanel / M50 | 0 | AdminPanel runtime-on local smoke with scoped env | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M50_ADMINPANEL_RUNTIME_ON_LOCAL_SMOKE_SCOPED_ENV_RECEIPT_20260621.md`；process.env scoped-on local smoke PASS；restore rollback PASS；stop before real runtime/env/frontend enablement。 |
| [x] | S72 | AdminPanel / M51 | 0 | AdminPanel production-router integration taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M51_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_TASKBOOK_20260621.md`；docs-only；future M52 gate defined；production router/env/frontend unchanged。 |
| [x] | S73 | AdminPanel / M52 | 0 | AdminPanel backend production-router integration gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M52_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_RECEIPT_20260621.md`；test-first helper/tests/harness PASS；production router default-off backend mount integrated via `routes/adminPanelRoutes.js`; scoped env GET `200`; rollback `404`; `server.js` / real config / frontend unchanged。 |
| [x] | S74 | AdminPanel / M53 | 0 | AdminPanel real-config unlock decision gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M53_ADMINPANEL_REAL_CONFIG_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`；pre-apply dry-run PASS；selected backend readonly three-key candidate；no real env edit；frontend/prod server/build deferred。 |
| [x] | S75 | AdminPanel / M54 | 0 | AdminPanel real-config apply + rollback drill | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M54_ADMINPANEL_REAL_CONFIG_APPLY_ROLLBACK_DRILL_RECEIPT_20260621.md`；real config three-key apply PASS；M48-M53 post-apply compatible validation PASS；rollback remove `404`, restore `200`; config ignored/not committed。 |
| [x] | S76 | AdminPanel / M55 | 0 | AdminPanel production-server smoke / frontend route-nav decision taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M55_ADMINPANEL_PRODUCTION_SMOKE_FRONTEND_DECISION_TASKBOOK_20260621.md`；docs-only；selected M56 smoke taskbook next, M57 actual smoke needed separate authorization and later completed, M58 frontend route/nav taskbook later completed。 |
| [x] | S77 | AdminPanel / M56 | 0 | AdminPanel production-server smoke taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M56_ADMINPANEL_PRODUCTION_SERVER_SMOKE_TASKBOOK_20260621.md`；docs-only；M57 startup command/process/auth/log/cleanup/rollback plan ready；production server not started。 |
| [x] | S78 | AdminPanel / M57 | 0 | AdminPanel production-server smoke | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M57_ADMINPANEL_PRODUCTION_SERVER_SMOKE_RECEIPT_20260621.md`；authorized short production-server child process；GET `200`; write methods `404`; PID cleanup PASS；frontend implementation still deferred。 |
| [x] | S79 | AdminPanel / M58 | 0 | AdminPanel frontend route/nav taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M58_ADMINPANEL_FRONTEND_ROUTE_NAV_TASKBOOK_20260621.md`；docs-only；metadata/display/allowed-file/build-dist gates defined；future M59 static implementation gate selected。 |
| [x] | S80 | AdminPanel / M59 | 0 | AdminPanel frontend route/nav static implementation | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M59_ADMINPANEL_FRONTEND_ROUTE_NAV_STATIC_IMPLEMENTATION_RECEIPT_20260621.md`；`jenn-admin-status` static route/nav/view added; targeted ESLint + `vue-tsc --noEmit` PASS；full lint blocked by existing typography baseline。 |
| [x] | S81 | AdminPanel / M60 | 0 | AdminPanel build/dist decision taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M60_ADMINPANEL_BUILD_DIST_DECISION_TASKBOOK_20260621.md`；docs-only；no build/no dist now；M61 no-build validation next；future build gate requires explicit artifact policy。 |
| [x] | S82 | AdminPanel / M61 | 0 | AdminPanel no-build route/source validation | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M61_ADMINPANEL_NO_BUILD_ROUTE_SOURCE_VALIDATION_RECEIPT_20260621.md`；source route/nav + no-secret display scan PASS；targeted ESLint + `vue-tsc --noEmit` PASS；no build/dev/preview/dist。 |
| [x] | S83 | AdminPanel / M62 | 0 | AdminPanel build/lint path decision taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M62_ADMINPANEL_BUILD_LINT_PATH_DECISION_TASKBOOK_20260621.md`；docs-only；M63 temp outDir dry-build authorization taskbook next；actual build/broad lint cleanup blocked pending authorization。 |
| [x] | S84 | AdminPanel / M63 | 0 | AdminPanel temp outDir dry-build authorization taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M63_ADMINPANEL_TEMP_OUTDIR_DRY_BUILD_AUTHORIZATION_TASKBOOK_20260621.md`；docs-only；future exact Vite temp outDir command, cleanup target, no-dist proof, and stop conditions defined；actual build not executed。 |
| [x] | S85 | AdminPanel / M64 | 0 | AdminPanel temp outDir dry build | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M64_ADMINPANEL_TEMP_OUTDIR_DRY_BUILD_RECEIPT_20260621.md`；authorized Vite temp outDir build PASS；`AdminPanel-Vue/dist` unchanged；temp run dir cleaned。 |
| [x] | S86 | AdminPanel / M65 | 0 | AdminPanel browser visual smoke taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M65_ADMINPANEL_BROWSER_VISUAL_SMOKE_TASKBOOK_20260621.md`；docs-only；M66 visual smoke execution gate defined and later completed；normal dist artifact gate remains deferred。 |
| [x] | S87 | AdminPanel / M66 | 0 | AdminPanel browser visual smoke | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M66_ADMINPANEL_BROWSER_VISUAL_SMOKE_RECEIPT_20260621.md`；temp build + local static server + Puppeteer desktop/mobile smoke PASS；screenshots/temp output cleaned；`AdminPanel-Vue/dist` unchanged。 |
| [x] | S88 | AdminPanel / M67 | 0 | AdminPanel normal dist artifact taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M67_ADMINPANEL_NORMAL_DIST_ARTIFACT_TASKBOOK_20260622.md`；docs-only；M68 normal typed build gate defined；no build/no dist change。 |
| [x] | S89 | AdminPanel / M68 | 0 | AdminPanel normal dist artifact build | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M68_ADMINPANEL_NORMAL_DIST_ARTIFACT_RECEIPT_20260622.md`；typed build PASS；`AdminPanel-Vue/dist/**` staged；source/package/config unchanged。 |
| [x] | S90 | AdminPanel / M69 | 0 | AdminPanel post-dist static smoke | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M69_ADMINPANEL_POST_DIST_STATIC_SMOKE_RECEIPT_20260622.md`；post-dist static smoke PASS；screenshots/temp output cleaned；dist hash unchanged。 |
| [x] | S91 | AdminPanel / M70 | 0 | AdminPanel artifact lane closeout | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M70_ADMINPANEL_ARTIFACT_LANE_CLOSEOUT_DECISION_20260622.md`；lane closed for current route；deferred boundaries recorded。 |
| [x] | S92 | Aggregate / M71 | 0 | Jenn fork local route review | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M71_AGGREGATE_JENN_FORK_LOCAL_ROUTE_REVIEW_20260622.md`；AgentOverrides + AdminPanel closeout + deferred AI Image/Codex-Memory/PhotoStudio/runtime lanes reviewed in one matrix；no env/runtime/private/upstream action。 |
| [x] | S93 | Decision / M72 | 0 | Next runtime lane decision | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M72_NEXT_RUNTIME_LANE_DECISION_OR_DEFERRED_DOMAIN_CLOSEOUT_20260622.md`；selected `M73_AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_TASKBOOK`; M72 itself docs-only, no taskbook/runtime/env/provider/private/upstream action。 |
| [x] | S94 | AI Image / M73 | 0 | AI Image no-provider runtime registration taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M73_AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_TASKBOOK_20260622.md`；defines M74 default-off manifest/metadata registry gate; no runtime/env/provider/image/private/external package change。 |
| [x] | S95 | AI Image / M74 | 0 | AI Image default-off adapter metadata registry | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M74_AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_RECEIPT_20260622.md`；default-off registry implemented；scoped metadata `1`、executable `0`、provider/image/output/bridge/LocalState `0`；real env/provider/server/upstream untouched。 |
| [x] | S96 | AI Image / M75 | 0 | AI Image registry review / closeout decision | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M75_AI_IMAGE_REGISTRY_REVIEW_OR_CLOSEOUT_DECISION_20260622.md`；selected M76 default-off diagnostic route taskbook；no route implementation、real env、provider、image output、private read or upstream action。 |
| [x] | S97 | AI Image / M76 | 0 | AI Image default-off diagnostic route taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M76_AI_IMAGE_DEFAULT_OFF_DIAGNOSTIC_ROUTE_TASKBOOK_20260622.md`；defines future diagnostic route URL/auth/fields/rollback/M77 test-only stop line；no route implementation or runtime/env/provider/image/private action。 |
| [x] | S98 | AI Image / M77 | 0 | AI Image default-off diagnostic route factory gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M77_AI_IMAGE_DEFAULT_OFF_DIAGNOSTIC_ROUTE_RECEIPT_20260622.md`；test-only route factory PASS；default-off/scoped/auth/write-method/real-execution-block checks PASS；no production router/env/provider/image/private action。 |
| [x] | S99 | AI Image / M78 | 0 | AI Image diagnostic route production-router decision | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M78_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_DECISION_20260622.md`；selected M79 production-router integration taskbook；route factory remains unmounted；no production router/env/provider/image/private action。 |
| [x] | S100 | AI Image / M79 | 0 | AI Image diagnostic route production-router integration taskbook | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M79_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_INTEGRATION_TASKBOOK_20260622.md`；defines M80 default-off integration gate; no code/env/provider/image/private action。 |
| [x] | S101 | AI Image / M80 | 0 | AI Image diagnostic route production-router integration gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M80_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_INTEGRATION_RECEIPT_20260622.md`；default-off production-router integration PASS；scoped GET `200`; default/rollback `404`; unauthorized `403`; real execution `409`; no real env/provider/image/private action。 |
| [x] | S102 | AI Image / M81 | 0 | AI Image diagnostic route real-config unlock decision | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M81_AI_IMAGE_DIAGNOSTIC_ROUTE_REAL_CONFIG_UNLOCK_DECISION_20260622.md`；selected future M82 diagnostic metadata three-key apply/rollback drill；M81 did not write real `config.env`。 |
| [x] | S103 | AI Image / M82 | 0 | AI Image diagnostic real-config apply/rollback drill | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M82_AI_IMAGE_DIAGNOSTIC_REAL_CONFIG_APPLY_ROLLBACK_DRILL_RECEIPT_20260622.md`；transient real config three-key write PASS；route `200`; rollback route `404`; final hash restored; final three key line counts `0/0/0`。 |

原始验收拆分说明：

以下 M0-M8 原始分只用于解释历史 acceptance plan 和 PASS 证据，不再形成第二套 Progress。

M1 完成规则：

```text
S1-S5 全部 PASS => M1 才变成 PASS，并计入 12 / 12。
当前 M1 进度：S1+S2+S3+S4+S5 = 12 / 12。
```

M2 起步规则：

```text
copy-first 迁移开始前，S6-S9 必须先被规划并验收。
M2 只有在 External Runtime 和 LocalState skeleton 都具备 denylist 与 checksum 规则后，才能变成 PASS。
当前 M2 进度：S6+S7+S8+S9 = 12 / 12。
```

M3-M7 完成规则：

```text
M3：S10+S11+S12 = 12 / 12。
M4：S13+S14+S15 = 10 / 10。
M5：S16+S17+S18 = 14 / 14。
M6：S19+S20+S21 = 14 / 14。
M7：S22 = 10 / 10；这是决策完成，不是 delete/untrack/stub 执行完成。
M8：S23+S24 = 7 / 10；S25 按用户决定先跳过打开 upstream PR，当前保持 DEFERRED，不计分。
```

M9-M18 完成规则：

```text
M9-M18：已完成 Agent 外置从 taskbook、copy-first、shadow validation、default-off runtime wiring、env-on shadow / rollback drill 到 final closeout decision。
M18：决策包完成，不自动 delete/untrack/stub core Agent 文件。
Agent 领域最终完成条件：M9-M18 PASS，真实 env 未被自动修改，LocalState / .agent_board 未被读取或迁移，provider / bridge / live write 未执行，core fallback 保留；core fallback removal 仅 future proposal。
```

M19-M82 完成规则：

```text
M19/M21/M23/M25/M26：LocalState、AdminPanel、AI Image、Codex/Memory、PhotoStudio taskbooks PASS；不直接 copy-first 或 runtime wiring。
M20/M22/M24：LocalState skeleton / paths-only gate、AdminPanel fixture shadow validation、AI Image no-provider shadow validation PASS；仍保持 default-off / no-live-write。
M27：只汇总 migration ledger、receipts、checksums、deferred/BLOCK、rollback map，不改变 runtime。
M28：upstream PR decision revisit 默认 DEFERRED；没有用户当前轮明确授权，不打开 PR。
M29：所有 active 领域 PASS 或明确 DEFERRED/BLOCK 后，才能做 Jenn fork maintenance final closeout。
M30：定义 full-local implementation、accelerated closeout 与 optional calendar soak 双门；执行 closeout 和 deferred domain 实现另走后续 receipts。
M31：AdminPanel persistent package gate PASS；仅创建/验证 external AdminExtensions skeleton，不注册 runtime route，不跑 production build。
M32：AI Image provider-adapter package gate PASS；仅创建/验证 external AIImageAdapters skeleton，不启用 provider/runtime，不生成真实图片。
M33：Codex/Memory no-live-write package gate PASS；仅创建/验证 external MemoryBridges skeleton，不启用 runtime bridge，不读取真实 memory，不执行 live write。
M34：PhotoStudio source package gate PASS；仅创建/验证 external PhotoStudioPackages skeleton，不启用 runtime，不读取/写入真实项目数据，不执行 external sync/publish/write。
M35：aggregate full-local matrix review PASS；复跑 M31-M34 package harnesses 并确认 package layer consistent；不把 runtime gates 当 PASS。
M36：optional calendar-soak entry PASS；定义 future calendar cycle receipts、证据、reset conditions、stop boundaries；不阻塞 accelerated local closeout。
M37：calendar-soak opening evidence PASS；保留为 future upstream-readiness evidence；mid/final cycles deferred optional。
M38：accelerated local package-layer stability closeout PASS；同日本地两轮复验通过；checksum/env/no-live-write/runtime-off 边界稳定；7-day calendar soak 仍 deferred optional。
M39：real config-env runtime-on local gate PASS after M41；真实 `config.env` 只启用 AgentOverrides lane；不打印 secret，不启动 server/provider/bridge。
M40：Agent real-config unlock decision gate PASS；只选择 `AgentOverrides` 子车道作为未来最小 config 候选；`VCP_AGENT_DIRS` additive 因 duplicate core ids 暂不启用；不修改真实 env。
M41：AgentOverrides real-config apply PASS；真实 `config.env` 写入两个授权 key；M39/M40 rerun PASS；`config.env` ignored，不提交。
M42：AgentOverrides local read smoke PASS；验证 `AgentManager` 本地读路径命中 external override；不启动 production/HTTP/Admin server，不启用 additive lane。
M43：AgentOverrides config rollback drill PASS；移除两键导致 M42 BLOCK，恢复两键导致 M42 PASS；最终真实 config 回到 AgentOverrides only。
M44：AgentOverrides Admin write guard PASS；Admin route 在 runtime-on 状态下仍拒绝 external Agent 写入；local test server only，不启动 production。
M45：AgentOverrides runtime-on aggregate review PASS；fresh rerun M39/M40/M42/M44 和 Agent tests；M43 只核对 receipt 证据，不重复修改真实 config。
M46：next runtime lane unlock decision gate PASS；无可自动解锁 lane；M47 AdminPanel runtime registration taskbook 是下一安全候选，但 runtime/env enablement 必须另行决策。
M47：AdminPanel default-off runtime registration taskbook PASS；只定义未来 backend read-only registry / validation / rollback；不改 runtime、不写 env、不跑 build。
M48：AdminPanel backend default-off registry gate PASS；纯 resolver/validator/plan + local test-only mount proof；未接入生产 router，不写真实 env，frontend runtime deferred。
M49：AdminPanel backend registry shadow rollback drill PASS；scoped env off/on/rollback/reapply 和 partial-env blocked 序列稳定；真实 env 未写，production router 未接入。
M50：AdminPanel runtime-on local smoke PASS；临时 scoped process.env 触发本地 `/admin_api` shaped route；恢复 process.env 后回到 default-off；真实 config/env/frontend/production router 全部未启用。
M51：AdminPanel production-router integration taskbook PASS；只定义未来 M52 backend integration gate；未修改 production router，未写真实 env，frontend route/nav 仍 deferred。
M52：AdminPanel backend production-router integration gate PASS；`routes/adminPanelRoutes.js` 接入 default-off runtime mount helper；scoped env 触发 reviewed read-only route；rollback/unset 回到 default-off；`server.js`、真实 `config.env`、frontend route/nav 仍未启用。
M53：AdminPanel real-config unlock decision gate PASS；选择 backend readonly 三键候选；真实 `config.env` 未写；M54 later applied it after current-turn authorization。
M54：AdminPanel real-config apply + rollback drill PASS；真实 `config.env` 写入 backend-readonly 三键，M48-M53 post-apply compatible validation PASS；rollback remove/restore drill PASS；frontend/prod server/build 仍未启用。
M55：AdminPanel production-server smoke / frontend route-nav decision taskbook PASS；只做顺序决策和未来 gate 定义；不启动 production server，不启用 frontend route/nav。
M56：AdminPanel production-server smoke taskbook PASS；定义 M57 actual smoke 的 safe command/process/auth/log/cleanup/rollback；M56 本身仍不启动 production server。
M57：AdminPanel production-server smoke PASS；经当前轮明确授权短时启动 `node server.js` 子进程，验证 production server 上 backend read-only Admin extension route GET `200`、写方法 `404`，随后只清理本轮 PID；frontend route/nav 仍未启用。
M58：AdminPanel frontend route/nav taskbook PASS；定义 future M59 静态 reviewed copy 前端入口门禁；metadata 来源为 external Admin extension manifest；动态 external Vue import、build/dist、frontend source edit 在 M58 均未执行。
M59：AdminPanel frontend route/nav static implementation PASS；新增静态 `jenn-admin-status` route/nav/view；不跑 build、不碰 `dist`、不启用动态 external Vue import；targeted ESLint 与 `vue-tsc --noEmit` PASS；全量 lint 仍受既有 typography baseline 阻挡。
M60：AdminPanel build/dist decision taskbook PASS；决策当前不 build、不改 `AdminPanel-Vue/dist/**`；选择 M61 no-build route/source validation 作为下一安全门；任何 build/dist 仍需未来单独授权和 artifact policy。
M61：AdminPanel no-build route/source validation PASS；复跑 source route/nav、targeted ESLint、`vue-tsc --noEmit`、M53 redacted gate；验证 no build/dev/preview/dist；不把 source validation 当 build artifact proof。
M62：AdminPanel build/lint path decision taskbook PASS；选择 M63 temp outDir dry-build authorization taskbook 作为下一门；实际 build 命令、dev/preview server、`dist` 修改或 broad typography cleanup 均停在显式授权前。
M63：AdminPanel temp outDir dry-build authorization taskbook PASS；定义未来 exact Vite command、`.tmp` output path、cleanup target、no-dist proof、authorization wording 和 stop conditions；实际 build 与 cleanup 未执行。
M64：AdminPanel temp outDir dry build PASS；经明确授权运行 Vite temp outDir build，`TEMP_DIST_FILE_COUNT=255`，raw path-risk hits `4` reviewed false-positive，anchored private-root scan clean，temp output cleaned，`AdminPanel-Vue/dist` hash unchanged；evidence fix 补充 case-insensitive/bracket-pattern path-risk scan 要求，当前 frontend path-only scan `9` 个 auth-surface false positives。
M65：AdminPanel browser visual smoke taskbook PASS；选择 M66 使用临时 build + 本地只读静态 server + browser screenshots/DOM anchors，先于 normal dist artifact gate；M65 本身不启动 server/browser、不 build、不截图。
M66：AdminPanel browser visual smoke PASS；经明确授权使用 temp build + local static server + Puppeteer/Chromium，desktop/mobile route/text/icon/nonblank checks PASS；`/admin_api/*` 仅本地 fixture 拦截，真实后端未调用；screenshots/temp output cleaned；`AdminPanel-Vue/dist` hash unchanged；normal dist artifact gate 仍 deferred。
M67：AdminPanel normal dist artifact taskbook PASS；定义 M68 actual normal typed build、dist artifact diff review、paths-only risk scan、stage allowlist、rollback 和 stop conditions；M67 docs-only，不 build、不碰 `AdminPanel-Vue/dist/**`。
M68：AdminPanel normal dist artifact build PASS；`vue-tsc && vite build` 成功，normal `AdminPanel-Vue/dist/**` artifact 已更新并 staged；source/package/config 不变；path-risk scan 仅 auth-surface false positives；未启动 server/provider/bridge/upstream。
M69：AdminPanel post-dist static smoke PASS；读取 M68 committed normal dist artifact，本地 static server + browser desktop/mobile smoke PASS；screenshots/temp output cleaned；dist hash unchanged。
M70：AdminPanel artifact lane closeout decision PASS；AdminPanel lane 在当前 route 中 closed；生产部署、upstream PR、dynamic external Vue runtime、external write surfaces、core fallback removal 仍 deferred。
M71：aggregate Jenn fork local route review PASS；AgentOverrides、AdminPanel closeout、AI Image、Codex/Memory、PhotoStudio、LocalState/private、upstream PR 已在同一张 review matrix 中核对；docs-only，不修改 env、不启动 runtime、不读取 private、不打开 upstream PR。
M72：next runtime lane decision PASS；选择未来只写 AI Image no-provider runtime registration taskbook；M72 本身不写 taskbook、不启 runtime、不改 env、不调用 provider。
M73：AI Image no-provider runtime registration taskbook PASS；定义 M74 default-off manifest/metadata registry gate；M73 taskbook-only，不实现、不启 runtime、不写 env。
M74：AI Image default-off adapter metadata registry PASS；新增 metadata-only registry/test/harness；scoped env 可发现 reviewed adapter metadata 但 `executableAdapters=0`，provider/image/output/bridge/LocalState counters all `0`；不写真实 env、不接 production route、不调用 provider、不生成图片。
M75：AI Image registry review / closeout decision PASS；决策不在 metadata-only 处立即收口，下一步只写 M76 default-off diagnostic route taskbook；M75 不实现 route、不写 env、不启 provider、不生成图片。
M76：AI Image default-off diagnostic route taskbook PASS；定义未来诊断 route 的 URL、auth、metadata 来源、允许/禁止字段、rollback 和 M77 implementation stop line；M76 不实现 route、不改 runtime、不写 env。
M77：AI Image default-off diagnostic route factory gate PASS；仅新增未挂载的 route factory、focused tests 和 local harness；默认 off `404`、scoped auth `200`、响应无绝对路径/禁用字段；不接 production router、不写 env、不启 provider。
M78：AI Image diagnostic route production-router decision PASS；选择下一步只写 M79 production-router integration taskbook；M78 保持 route factory unmounted，不接 production router、不写真实 env、不启 provider。
M79：AI Image diagnostic route production-router integration taskbook PASS；定义 M80 default-off integration 的 mount/auth/env/rollback/validation；M79 docs-only，不改代码。
M80：AI Image diagnostic route production-router integration gate PASS；`routes/adminPanelRoutes.js` 默认关闭接入 diagnostic helper；scoped env 可达 sanitized metadata；default-off/rollback `404`，unauthorized `403`，real execution `409`；不写真实 env、不启 provider、不生成图片。
M81：AI Image diagnostic route real-config unlock decision PASS；选择未来 M82 三键 diagnostic metadata real-config apply/rollback drill；M81 不写真实 `config.env`，provider/runtime/image/bridge/LocalState 仍关闭。
M82：AI Image diagnostic real-config apply/rollback drill PASS；真实 `config.env` transient 三键写入后 route `200`，rollback 后 route `404`，final hash restored；最终不保留 AI Image diagnostic runtime-on。
```

## 4. Acceptance Plan 对照矩阵

本节把 `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_ACCEPTANCE_PLAN_20260618.md` 的 Phase / 分域验收表映射到 tracker。后续执行必须先落到这里或详细待办里；若现实变化，按计划变更规则写 `PLAN_CHANGE` 后再执行。

| 原计划来源 | Tracker 路线 | 必须执行的步骤入口 | 当前状态 |
| --- | --- | --- | --- |
| Phase 0：只读基线确认 | M0 / S26-S28 | remote/ref 记录、clean-core 创建记录、旧 fork path-only inventory、secret-risk paths-only scan | PASS；后续 baseline 变更必须新建 `PLAN_CHANGE`。 |
| Phase 1：Clean Core Contract Skeleton | M1 / S1-S5 | plugin external contract、allowlist/registration/env sandbox tests、内部 PR review/merge evidence | PASS；PR #272 已合并 Jenn clean base。 |
| Phase 2：External Runtime Skeleton | M2 / S6-S9 | skeleton taskbook、完整 denylist、LocalState / `.agent_board/**` gate、manifest/checksum rules | PASS；LocalState 真实领域继续走 M19-M20。 |
| Phase 3：第一个试点 `JennAIGentOrchestrator` | M3 / S10-S12 | copy-first、source/target paths-only scan、checksum、receipt、core fallback 保留 | PASS；不等于所有领域都已外置。 |
| Phase 4：Shadow Validation | M4 / S13-S15；Agent overlay M13/M17 | discovery/registration gate、no-provider shadow、rollback drill；Agent env-on drill 另走 M17 | Base PASS；Agent env-on M17 PASS。 |
| Phase 5：Stub / Untrack / Remove Decision | M7 / S22；Agent overlay M18 | 决策包、rollback map、人工 gate；只做决策，不执行删除/取消跟踪/stub | M7 PASS；Agent closeout M18 PASS。 |
| Upstream tracking / PR gate | M8 / S23-S25；M28 / S49；M30 / S51；M38 / S59 | readiness packet、rebase workflow、local closeout evidence、人工授权后才 open upstream PR | PARTIAL / DEFERRED / LOCAL_CLOSEOUT_PASS；当前仍跳过 upstream PR。 |
| Agent 分域验收 | M9-M18 / S29-S39 | taskbook、source scan、candidate gate、copy-first、shadow、resolver、default-off wiring、env-on rollback、final decision | M9-M18 PASS；Agent domain closed for current route。 |
| LocalState 分域验收 | M19-M20 / S40-S41 | private-by-default taskbook、paths-only skeleton/gate、`.agent_board/**` 单独 gate | M19-M20 PASS；existing root handled by PLAN_CHANGE；private content not read。 |
| AdminPanel 分域验收 | M21-M22 / S42-S43；M31 / S52；M47-M70 / S68-S91 | extension manifest taskbook、fixture/build shadow、persistent package gate、default-off backend registry、shadow/rollback、production-router backend integration、real-config unlock/apply drill、production smoke/frontend decision, production smoke taskbook, production-server smoke, frontend route/nav taskbook, static frontend implementation, build/dist decision, no-build route/source validation, build/lint path decision, temp outDir dry-build authorization taskbook, temp outDir dry build, browser visual smoke taskbook, browser visual smoke execution, normal dist artifact taskbook, normal dist artifact build, post-dist static smoke, artifact lane closeout | M21-M22 PASS；M31 persistent package PASS；M47-M70 backend route + real-config + production-server smoke + static frontend route/nav + no-build validation + build/lint path decision + temp outDir dry build + visual smoke + normal dist artifact build + post-dist smoke PASS；AdminPanel lane closed for current route。 |
| AI Image 分域验收 | M23-M24 / S44-S45；M32 / S53；M73-M82 / S94-S103 | generic adapter taskbook、provider-off fixture、no-provider shadow validation、persistent provider-adapter package gate、default-off adapter metadata registry、route/closeout decision、diagnostic route taskbook、test-only route factory、production-router decision、production-router taskbook、default-off production-router integration、real-config unlock decision、real-config apply/rollback drill | M23-M24 PASS；M32 persistent package PASS；M73 taskbook PASS；M74 metadata-only registry PASS；M75 selected M76；M76 taskbook-only PASS；M77 route factory PASS；M78 selected M79 taskbook；M79 taskbook PASS；M80 default-off production-router integration PASS；M81 selected M82 apply/rollback drill；M82 transient real config write PASS and final hash restored；no-provider only；不写 token，不发 provider call，不生成真实图片，不注册 executable runtime。 |
| Codex/Memory 分域验收 | M25 / S46；M33 / S54 | bridge taskbook、manifest/path-only scan、no-live-write validation design、persistent bridge package gate | M25 PASS；M33 persistent package PASS；不读取 private memory，不 bridge 外写，不启用 runtime。 |
| PhotoStudio 分域验收 | M26 / S47；M34 / S55 | taskbook、data exclusion、copy-first gates、no-auto-write rules、persistent source package gate | M26 PASS；M34 persistent package PASS；项目数据留 LocalState/private，不启用 runtime。 |
| Governance ledger | M27 / S48 | receipts/checksums/deferred/BLOCK/rollback 总账 | M27 PASS；docs-only。 |
| Jenn fork maintenance final closeout | M29 / S50 | active/deferred/block 总结、最终风险、下一周期路线 | M29 PASS；Jenn fork maintenance route closed；全局仍非 100%，upstream deferred。 |
| Local stability gate | M30 / S51；M38 / S59 | 定义并执行 accelerated local stability closeout；7-day calendar soak 作为 future upstream-readiness evidence | M38 PASS；local package-layer closeout passed；calendar soak deferred optional。 |
| AdminPanel persistent package | M31 / S52 | persistent external AdminExtensions skeleton、manifest/checksum、paths-only scan、no-runtime validation | M31 PASS；runtime registration and AdminPanel build remain deferred。 |
| AI Image persistent package | M32 / S53 | persistent external AIImageAdapters skeleton、manifest/checksum、paths-only scan、no-provider validation | M32 PASS；provider runtime and image generation remain deferred；M74 later added metadata-only registry but no executable adapter registration。 |
| Codex/Memory persistent package | M33 / S54 | persistent external MemoryBridges skeleton、manifest/checksum、paths-only scan、no-live-write validation | M33 PASS；runtime bridge registration, live writes, and private memory reads remain deferred。 |
| PhotoStudio persistent package | M34 / S55 | persistent external PhotoStudioPackages skeleton、manifest/checksum、paths-only scan、no-auto-write validation | M34 PASS；runtime package registration, real data roots, and external sync/publish/write remain deferred。 |
| Aggregate full-local matrix review | M35 / S56 | re-run M31-M34 harnesses、核对 current aggregate checksum、列出 runtime deferred items | M35 PASS；package layer consistent。 |
| Optional calendar-soak entry | M36 / S57 | define future calendar cycle receipt shape、required evidence、reset conditions、stop boundaries | M36 PASS；future upstream-readiness evidence only after M38。 |
| Calendar-soak opening evidence | M37 / S58 | run opening validation、record reset checklist | M37 PASS；mid/final cycles deferred optional；not local blocker。 |
| Accelerated local closeout | M38 / S59 | run two same-day revalidation rounds、核对 checksum/env/no-live-write/runtime-off boundaries | M38 PASS；local package-layer closeout complete；runtime-on and upstream PR still deferred。 |
| Real config-env runtime-on gate | M39 / S60 | load real `config.env` in redacted harness、verify implemented runtime lanes without server/provider/bridge/live write | PASS after M41；AgentOverrides lane only。 |
| Agent real-config unlock decision gate | M40 / S61 | dry-run and post-apply validation for Agent-only unlock | PASS；selected `AgentOverrides` only；provider/bridge/LocalState/private remain closed。 |
| AgentOverrides real-config apply | M41 / S62 | apply exact two-key `config.env` edit after explicit authorization, then rerun M39/M40 | PASS；`config.env` ignored/not committed；rollback is remove the two keys。 |
| AgentOverrides local read smoke | M42 / S63 | call local `AgentManager` read path for reviewed override aliases without production/HTTP/Admin server | PASS；`Metis,Nova` read from external override; prompt content not printed；additive lane remains off。 |
| AgentOverrides config rollback drill | M43 / S64 | remove two real config keys, confirm M42 BLOCK, restore keys, confirm M42 PASS | PASS；final config restored to AgentOverrides only。 |
| AgentOverrides Admin write guard | M44 / S65 | use local Admin route test server to verify external override files are read-only | PASS；GET external override recognized；POST returns 403；no writes。 |
| AgentOverrides runtime-on aggregate review | M45 / S66 | rerun M39/M40/M42/M44 and Agent external runtime tests; check M43 receipt without re-editing env | PASS；override-only chain consistent；`VCP_AGENT_DIRS` disabled；no production/provider/bridge/LocalState/private/upstream side effects。 |
| Next runtime lane unlock decision gate | M46 / S67 | evaluate next candidate lanes without enabling runtime or modifying real env | PASS；`NEXT_AUTO_UNLOCKABLE_LANE=none`; stop position reached before M47/default-off runtime design or human env authorization。 |
| AdminPanel default-off runtime registration taskbook | M47 / S68 | define future default-off backend read-only registry taskbook without runtime/env changes | PASS；M48 design gate defined；frontend runtime route/nav registration remains deferred。 |
| AdminPanel backend default-off registry gate | M48 / S69 | implement pure backend registry and test-only scoped-env mount proof | PASS；default-off no registration；scoped env-on GET read-only route；rollback `404`；no production registration。 |
| AdminPanel backend registry shadow rollback drill | M49 / S70 | rerun M48 and validate scoped off/on/rollback/reapply sequence | PASS；snapshot stable；rollback returns GET `404`; reapply returns GET `200`; no real env write。 |
| AdminPanel runtime-on local smoke | M50 / S71 | temporary process.env scoped keys and local `/admin_api` shaped runtime smoke | PASS；default-off `404`; scoped runtime-on `200`; restore rollback `404`; production/env/frontend enablement stopped。 |
| AdminPanel production-router integration taskbook | M51 / S72 | define future backend production-router integration gate without code changes | PASS；M52 gate defined；`server.js` / `routes/adminPanelRoutes.js` unchanged；frontend deferred。 |
| AdminPanel backend production-router integration gate | M52 / S73 | test-first default-off backend integration through `routes/adminPanelRoutes.js` with scoped-env harness | PASS；scoped env GET `200`; write methods `404`; rollback `404`; `server.js` / real config / frontend unchanged。 |
| AdminPanel real-config unlock decision gate | M53 / S74 | select smallest real-config candidate without writing `config.env` | PASS；selected `adminpanel-backend-readonly`; candidate route count `1`; frontend/prod server/build deferred。 |
| AdminPanel real-config apply + rollback drill | M54 / S75 | apply exact three-key backend-readonly config and validate rollback/restore | PASS；real config route GET `200`; remove keys `404`; restore `200`; frontend/prod server/build deferred。 |
| AdminPanel production-server smoke / frontend route-nav decision taskbook | M55 / S76 | choose next gate order without starting server or wiring frontend | PASS；M56 smoke taskbook next；M57 actual smoke later completed；M58 frontend route/nav taskbook later completed。 |
| AdminPanel production-server smoke taskbook | M56 / S77 | define exact M57 production server smoke command/process/auth/log/cleanup/rollback without starting server | PASS；M57 actual smoke completed later by M57；frontend route/nav remains deferred。 |
| AdminPanel production-server smoke | M57 / S78 | short authorized `node server.js` child-process smoke with PID cleanup and redacted auth/log handling | PASS；GET `200`; write methods `404`; process cleanup PASS；frontend route/nav remains deferred。 |
| AdminPanel frontend route/nav taskbook | M58 / S79 | define display boundary, metadata source, allowed frontend file scope, no-build/no-dist rules, and M59 implementation gate | PASS；taskbook-only；frontend source/build/dist unchanged。 |
| AdminPanel frontend route/nav static implementation | M59 / S80 | add static route manifest entry, static component map entry, and reviewed read-only status view | PASS；targeted ESLint + `vue-tsc --noEmit` PASS；no build/dist/dynamic external import。 |
| AdminPanel build/dist decision taskbook | M60 / S81 | decide build/dist policy, visual smoke boundary, and next no-build validation gate | PASS；docs-only；no build/dist/dev/preview run。 |
| AdminPanel no-build route/source validation | M61 / S82 | rerun source route/nav, no-secret display scan, targeted ESLint, `vue-tsc --noEmit`, and M53 redacted gate | PASS；no build/dev/preview/dist。 |
| AdminPanel build/lint path decision taskbook | M62 / S83 | choose next path among typography cleanup, temp outDir dry build, or normal dist build gate | PASS；docs-only；selected M63 taskbook; actual build/broad cleanup blocked before authorization。 |
| AdminPanel temp outDir dry-build authorization taskbook | M63 / S84 | define future exact temp build command, cleanup target, no-dist proof, and stop conditions | PASS；docs-only；actual build/cleanup blocked pending explicit authorization。 |
| AdminPanel temp outDir dry build | M64 / S85 | run authorized Vite build to workspace `.tmp`, prove no dist/source/package changes, inspect paths, clean temp output | PASS；temp build exit `0`; `AdminPanel-Vue/dist` aggregate hash unchanged；temp dir cleaned。 |
| AdminPanel browser visual smoke taskbook | M65 / S86 | define future visual smoke using temp build, local static server, browser screenshot/DOM checks, cleanup | PASS；docs-only；M66 execution later completed after explicit authorization。 |
| AdminPanel browser visual smoke | M66 / S87 | run authorized temp build, local static server, browser desktop/mobile DOM+screenshot checks, then cleanup | PASS；Puppeteer/Chromium smoke passed；`/admin_api/*` intercepted locally；temp output/screenshots cleaned；`AdminPanel-Vue/dist` unchanged。 |
| AdminPanel normal dist artifact taskbook | M67 / S88 | define M68 actual normal typed build, dist artifact review, paths-only scan, stage allowlist, rollback and stop conditions | PASS；docs-only；actual build/dist change still deferred pending explicit authorization。 |
| AdminPanel normal dist artifact build | M68 / S89 | run authorized typed normal build and stage reviewed `AdminPanel-Vue/dist/**` artifact | PASS；typed build exit `0`; dist artifact staged；source/package/config unchanged；post-dist smoke or closeout decision remains next。 |
| AdminPanel post-dist static smoke | M69 / S90 | serve committed normal dist artifact locally and verify target route with desktop/mobile browser checks | PASS；static smoke PASS；temp screenshots cleaned；dist hash unchanged。 |
| AdminPanel artifact lane closeout | M70 / S91 | close AdminPanel artifact lane for current Jenn fork local route and record deferred boundaries | PASS；production deploy/upstream PR/dynamic external Vue/write surfaces deferred。 |
| Aggregate Jenn fork local route review | M71 / S92 | review AgentOverrides + AdminPanel closeout + AI Image/Codex-Memory/PhotoStudio deferred runtime lanes in one matrix | PASS；docs-only aggregate review；LocalState/private remains BLOCK；upstream PR remains DEFERRED。 |
| Next runtime lane decision | M72 / S93 | decide whether to keep all deferred lanes paused or select one narrow future taskbook | PASS；selected M73 AI Image no-provider runtime registration taskbook；other deferred/BLOCK lanes unchanged。 |
| AI Image no-provider runtime registration taskbook | M73 / S94 | define future default-off AI Image adapter registry/manifest loader gate | PASS；taskbook-only；M74 allowed files, env contract, zero-counter validation, rollback, stop conditions defined。 |
| AI Image default-off adapter metadata registry | M74 / S95 | implement metadata-only manifest registry with scoped env validation and rollback to default-off | PASS；scoped metadata count `1`; executable count `0`; provider/image/output/bridge/LocalState counters `0`; no real env/server/provider/image/private/upstream action。 |
| AI Image registry review / closeout decision | M75 / S96 | decide whether to close at metadata-only or write a default-off diagnostic route taskbook | PASS；decision `WRITE_M76_DEFAULT_OFF_DIAGNOSTIC_ROUTE_TASKBOOK`; route implementation now `no`; provider/runtime/env/image/private remain closed。 |
| AI Image default-off diagnostic route taskbook | M76 / S97 | define future diagnostic route URL/auth/allowed fields/forbidden fields/rollback/M77 stop line | PASS；taskbook-only；future M77 limited to test-only route factory；production mount/provider/runtime/env/image/private remain closed。 |
| AI Image default-off diagnostic route factory | M77 / S98 | implement unmounted route factory, tests, and local harness only | PASS；default-off `404`; scoped `200`; unauthorized `403`; response absolute path/secret count `0`; provider/image/output/bridge/LocalState `0`; production mount deferred。 |
| AI Image diagnostic route production-router decision | M78 / S99 | decide whether to keep route factory unmounted or write production-router integration taskbook | PASS；decision `WRITE_M79_PRODUCTION_ROUTER_INTEGRATION_TASKBOOK`; route factory remains unmounted; production-router implementation/env/provider/image/private remain closed。 |
| AI Image diagnostic route production-router taskbook | M79 / S100 | define default-off production-router integration allowed files, mount strategy, auth boundary, validation, rollback, and stop conditions | PASS；taskbook-only；future M80 scoped default-off integration defined。 |
| AI Image diagnostic route production-router integration | M80 / S101 | implement default-off production-router integration with scoped local validation | PASS；default-off/rollback `404`; scoped `200`; unauthorized `403`; real execution `409`; provider/image/output/bridge/LocalState `0`; no real env/server/provider/image/private action。 |
| AI Image diagnostic route real-config unlock decision | M81 / S102 | decide whether to stop at default-off integration or select future diagnostic metadata real-config apply/rollback drill | PASS；selected M82 three-key diagnostic metadata apply/rollback drill；M81 decision-only；real `config.env` unchanged。 |
| AI Image diagnostic real-config apply/rollback drill | M82 / S103 | transiently write exactly three real diagnostic metadata keys, prove route-on behavior, then rollback and restore final hash | PASS；after apply route `200`; unauthorized `403`; real execution `409`; rollback route `404`; final key counts `0/0/0`; final hash restored。 |

## 5. 详细执行待办（Planned Backlog）

本节是“未来每一步”的计划源。执行时优先从这里取下一项；如果现实变化，先按计划变更规则修改本节，再执行。

### 5.1 M17 Agent Env-On Shadow / Rollback Drill

| 待办 | Status | 执行动作 | 验收证据 | 禁止事项 |
| --- | --- | --- | --- | --- |
| M17-01 | PASS | 读 M16 receipt、确认 worktree clean、确认真实 `VCP_AGENT_*` 未设置 | M17 receipt preflight；env command no output | 不改 `.env` |
| M17-02 | PASS | 创建 temp fixture external Agent / AgentOverrides 包 | `run-agent-env-on-shadow-rollback-harness.js` temp fixture | 不复制 LocalState / `.agent_board/**` |
| M17-03 | PASS | 用临时 env 跑 AgentManager env-on additive + override shadow | `AGENT_ENV_ON_SHADOW_ROLLBACK_PASS` | 不启动生产服务 |
| M17-04 | PASS | 验证 Admin Agent route external read-only / write-block | `ADMIN_EXTERNAL_READ_PASS=yes`；`ADMIN_EXTERNAL_WRITE_BLOCK_PASS=yes` | 不写 external package |
| M17-05 | PASS | rollback drill：unset 临时 env 后恢复 core-only behavior | `ROLLBACK_UNSET_ENV_CORE_ONLY_PASS=yes`；cache regression fixed | 不 delete/untrack/stub core Agent |
| M17-06 | PASS | 复跑 package checksum / path-risk shadow harness | `MANIFEST_VERIFY_PASS count=15`；package risk `0` | 不把 discovery 当 registration proof |
| M17-07 | PASS | 写 M17 receipt | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M17_AGENT_ENV_ON_SHADOW_ROLLBACK_RECEIPT_20260621.md` | 不漏未验证项 |
| M17-08 | PASS | 更新 tracker：M17/S38 PASS 或 BLOCK | M17/S38 PASS；M18 later completed by M18 decision packet | 不在 M17 内提前改 M18 为 PASS |

### 5.2 M18 Agent Domain Final Closeout Decision

| 待办 | Status | 执行动作 | 验收证据 | 禁止事项 |
| --- | --- | --- | --- | --- |
| M18-01 | PASS | 审计 M9-M17 receipts 是否齐全 | M18 evidence table；M9-M17 all found | 不补假证据 |
| M18-02 | PASS | 决策 Agent 领域状态：keep core fallback / future proposal / no-op close | M18 decision：keep core fallback + future proposal only | 不执行 delete/untrack/stub |
| M18-03 | PASS | 列出 deferred 项：真实 env 激活、external watcher、AdminPanel external write、core fallback removal | M18 deferred matrix | 不把 deferred 当 PASS |
| M18-04 | PASS | 写 Agent rollback map | M18 rollback map | 不删除 LocalState / `.agent_board/**` |
| M18-05 | PASS | 更新 tracker：M18/S39 PASS 或 BLOCK，标记 Agent 领域 closeout | M18/S39 PASS；Agent domain closed | 不切换下个领域前隐去风险 |
| M18-06 | PASS | 选择下一领域或暂停：LocalState / AdminPanel / AI Image / Memory / PhotoStudio / Upstream | Next domain: M19 LocalState planning | 不自动开 upstream PR |

### 5.3 Future Domain 通用执行模板

每个后续领域（LocalState、AdminPanel、AI Image、Codex/Memory、PhotoStudio）必须按以下顺序推进；若某步不适用，必须在 receipt 中写 `SKIPPED` 和原因。

| 顺序 | Status | 通用动作 | 必需证据 | 禁止事项 |
| ---: | --- | --- | --- | --- |
| D-01 | TODO | 写领域 taskbook | taskbook path | 不直接实现 |
| D-02 | TODO | source path-only inventory | path count + risk count | 不读取 secret/private content |
| D-03 | TODO | reviewed candidate content gate | ALLOW / REVIEW / BLOCK matrix | 不复制未 review 内容 |
| D-04 | TODO | external target skeleton | skeleton commit / receipt | 不放 runtime private data |
| D-05 | TODO | copy-first reviewed content | copy list | 不删除 core fallback |
| D-06 | TODO | target paths-only secret-risk scan | target risk `0` | 不读/复制 `.agent_board/**` |
| D-07 | TODO | manifest checksum regenerate + verify | `MANIFEST_VERIFY_PASS` | checksum 不等于 runtime proof |
| D-08 | TODO | no-provider / no-live-write shadow validation | targeted PASS | 不 provider / bridge / live write |
| D-09 | TODO | rollback drill | rollback PASS | 不用 destructive shortcut |
| D-10 | TODO | final decision packet | keep/defer/block decision | 不自动 stub/untrack/remove |

### 5.4 Future Domain Queue

| 队列 | 对应 M/S | Status | 领域 | 下一步 |
| --- | --- | --- | --- | --- |
| Q1 | M19/S40 | PASS | LocalState | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M19_LOCALSTATE_PRIVATE_ROUTE_TASKBOOK_20260621.md`。 |
| Q2 | M20/S41 | PASS | LocalState | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M20_LOCALSTATE_SKELETON_PATHS_ONLY_RECEIPT_20260621.md`。 |
| Q3 | M21/S42 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M21_ADMINPANEL_EXTENSION_MANIFEST_TASKBOOK_20260621.md`。 |
| Q4 | M22/S43 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M22_ADMINPANEL_EXTENSION_SHADOW_VALIDATION_RECEIPT_20260621.md`。 |
| Q5 | M23/S44 | PASS | AI Image | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M23_AI_IMAGE_ADAPTER_EXTERNALIZATION_TASKBOOK_20260621.md`。 |
| Q6 | M24/S45 | PASS | AI Image | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M24_AI_IMAGE_NO_PROVIDER_SHADOW_VALIDATION_RECEIPT_20260621.md`。 |
| Q7 | M25/S46 | PASS | Codex/Memory | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M25_CODEX_MEMORY_EXTERNAL_BRIDGE_TASKBOOK_20260621.md`。 |
| Q8 | M26/S47 | PASS | PhotoStudio | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M26_PHOTOSTUDIO_EXTERNALIZATION_TASKBOOK_20260621.md`。 |
| Q9 | M27/S48 | PASS | Governance | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M27_GOVERNANCE_MIGRATION_LEDGER_FINALIZATION_20260621.md`。 |
| Q10 | M28/S49 | DEFERRED | Upstream PR | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M28_UPSTREAM_PR_DECISION_DEFERRED_20260621.md`；仅在全计划本地实现、稳定运转证据齐备、且用户当前轮明确 upstream PR 授权后才恢复。 |
| Q11 | M29/S50 | PASS | Closeout | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M29_JENN_FORK_MAINTENANCE_FINAL_CLOSEOUT_20260621.md`。 |
| Q12 | M30/S51 | PASS | Stability Gate | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M30_LOCAL_IMPLEMENTATION_STABILITY_WINDOW_TASKBOOK_20260621.md`；定义完成，执行未开始。 |
| Q13 | M31/S52 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M31_ADMINPANEL_PERSISTENT_PACKAGE_GATE_RECEIPT_20260621.md`；persistent package gate complete；runtime registration deferred。 |
| Q14 | M32/S53 | PASS | AI Image | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M32_AI_IMAGE_PROVIDER_ADAPTER_PACKAGE_GATE_RECEIPT_20260621.md`；persistent provider-adapter package gate complete；provider/runtime registration deferred。 |
| Q15 | M33/S54 | PASS | Codex/Memory | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M33_CODEX_MEMORY_NO_LIVE_WRITE_PACKAGE_GATE_RECEIPT_20260621.md`；persistent no-live-write package gate complete；runtime bridge registration deferred。 |
| Q16 | M34/S55 | PASS | PhotoStudio | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M34_PHOTOSTUDIO_SOURCE_PACKAGE_GATE_RECEIPT_20260621.md`；persistent source package gate complete；runtime package registration deferred。 |
| Q17 | M35/S56 | PASS | Matrix | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M35_AGGREGATE_FULL_LOCAL_MATRIX_REVIEW_20260621.md`；package layer review complete；accelerated closeout completed later by M38。 |
| Q18 | M36/S57 | PASS | Stability | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M36_STABLE_OPERATION_WINDOW_ENTRY_20260621.md`；optional calendar-soak entry defined；future upstream-readiness evidence only after M38。 |
| Q19 | M37/S58 | PASS | Stability | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M37_STABLE_OPERATION_WINDOW_CYCLE_1_OPENING_RECEIPT_20260621.md`；opening validation evidence PASS；mid/final cycles deferred optional。 |
| Q20 | M38/S59 | PASS | Stability | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M38_ACCELERATED_LOCAL_STABILITY_CLOSEOUT_RECEIPT_20260621.md`；accelerated local closeout PASS；calendar soak deferred optional。 |
| Q21 | M39/S60 | PASS | Runtime-on | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M39_REAL_CONFIG_ENV_RUNTIME_ON_LOCAL_GATE_RECEIPT_20260621.md`；initial BLOCK superseded by M41 rerun PASS；AgentOverrides only。 |
| Q22 | M40/S61 | PASS | Agent | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M40_AGENT_REAL_CONFIG_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`；selected `AgentOverrides` only as real-config candidate；post-apply validation PASS。 |
| Q23 | M41/S62 | PASS | Agent | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M41_AGENTOVERRIDES_REAL_CONFIG_APPLY_RECEIPT_20260621.md`；two-key real config apply and M39/M40 rerun PASS。 |
| Q24 | M42/S63 | PASS | Agent | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M42_AGENTOVERRIDES_LOCAL_READ_SMOKE_RECEIPT_20260621.md`；local read smoke PASS without production server。 |
| Q25 | M43/S64 | PASS | Agent | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M43_AGENTOVERRIDES_CONFIG_ROLLBACK_DRILL_RECEIPT_20260621.md`；rollback drill PASS。 |
| Q26 | M44/S65 | PASS | Agent | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M44_AGENTOVERRIDES_ADMIN_WRITE_GUARD_RECEIPT_20260621.md`；Admin external write guard PASS。 |
| Q27 | M45/S66 | PASS | Agent | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M45_AGENTOVERRIDES_RUNTIME_ON_AGGREGATE_REVIEW_RECEIPT_20260621.md`；runtime-on aggregate review PASS；M43 not rerun to avoid re-editing real env。 |
| Q28 | M46/S67 | PASS | Decision | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M46_NEXT_RUNTIME_LANE_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`；no env write, no runtime enablement；stop required before next runtime design/env authorization。 |
| Q29 | M47/S68 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M47_ADMINPANEL_DEFAULT_OFF_RUNTIME_REGISTRATION_TASKBOOK_20260621.md`；taskbook-only；future backend read-only registry gate defined。 |
| Q30 | M48/S69 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M48_ADMINPANEL_BACKEND_DEFAULT_OFF_REGISTRY_GATE_RECEIPT_20260621.md`；backend default-off registry gate PASS；production runtime/frontend/env activation deferred。 |
| Q31 | M49/S70 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M49_ADMINPANEL_BACKEND_REGISTRY_SHADOW_ROLLBACK_DRILL_RECEIPT_20260621.md`；scoped rollback drill PASS；M50 scoped runtime-on local smoke is recommended next gate。 |
| Q32 | M50/S71 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M50_ADMINPANEL_RUNTIME_ON_LOCAL_SMOKE_SCOPED_ENV_RECEIPT_20260621.md`；scoped process.env local smoke PASS；stop before real runtime/env/frontend enablement。 |
| Q33 | M51/S72 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M51_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_TASKBOOK_20260621.md`；production-router integration taskbook ready；M52 implementation gate later completed by Q34。 |
| Q34 | M52/S73 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M52_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_RECEIPT_20260621.md`；backend production-router integration default-off PASS；next decision must choose real config unlock, frontend route/nav taskbook, production smoke, or stop。 |
| Q35 | M53/S74 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M53_ADMINPANEL_REAL_CONFIG_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`；selected backend readonly real-config candidate；M54 later applied exact three-key config after explicit authorization。 |
| Q36 | M54/S75 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M54_ADMINPANEL_REAL_CONFIG_APPLY_ROLLBACK_DRILL_RECEIPT_20260621.md`；exact three-key real config apply PASS；rollback drill PASS；frontend/prod server/build remain deferred。 |
| Q37 | M55/S76 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M55_ADMINPANEL_PRODUCTION_SMOKE_FRONTEND_DECISION_TASKBOOK_20260621.md`；decision taskbook PASS；M56 smoke taskbook next, M57 actual smoke later completed, M58 frontend route/nav taskbook later completed。 |
| Q38 | M56/S77 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M56_ADMINPANEL_PRODUCTION_SERVER_SMOKE_TASKBOOK_20260621.md`；taskbook-only；exact command/port/auth/log/cleanup/rollback plan ready; no server start in M56。 |
| Q39 | M57/S78 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M57_ADMINPANEL_PRODUCTION_SERVER_SMOKE_RECEIPT_20260621.md`；actual production-server smoke PASS after explicit authorization；GET `200`; write methods `404`; PID cleanup PASS。 |
| Q40 | M58/S79 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M58_ADMINPANEL_FRONTEND_ROUTE_NAV_TASKBOOK_20260621.md`；frontend route/nav taskbook PASS；metadata/display/allowed-file/no-build gates defined；no frontend source/build/dist change。 |
| Q41 | M59/S80 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M59_ADMINPANEL_FRONTEND_ROUTE_NAV_STATIC_IMPLEMENTATION_RECEIPT_20260621.md`；static route/nav/view implemented; targeted checks PASS；no build/dist/dynamic external import。 |
| Q42 | M60/S81 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M60_ADMINPANEL_BUILD_DIST_DECISION_TASKBOOK_20260621.md`；decision taskbook PASS；no build/no dist now；M61 no-build route/source validation next。 |
| Q43 | M61/S82 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M61_ADMINPANEL_NO_BUILD_ROUTE_SOURCE_VALIDATION_RECEIPT_20260621.md`；no-build validation PASS；targeted ESLint + `vue-tsc --noEmit` + M53 redacted gate PASS。 |
| Q44 | M62/S83 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M62_ADMINPANEL_BUILD_LINT_PATH_DECISION_TASKBOOK_20260621.md`；build/lint path decision PASS；selected M63 temp outDir dry-build authorization taskbook；no build executed。 |
| Q45 | M63/S84 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M63_ADMINPANEL_TEMP_OUTDIR_DRY_BUILD_AUTHORIZATION_TASKBOOK_20260621.md`；exact temp output, cleanup target, no-dist proof, authorization wording, and stop conditions defined；no build executed。 |
| Q46 | M64/S85 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M64_ADMINPANEL_TEMP_OUTDIR_DRY_BUILD_RECEIPT_20260621.md`；authorized temp outDir Vite build PASS；temp output inspected and cleaned；`AdminPanel-Vue/dist` unchanged。 |
| Q47 | M65/S86 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M65_ADMINPANEL_BROWSER_VISUAL_SMOKE_TASKBOOK_20260621.md`；visual smoke taskbook PASS；M66 actual browser execution later completed by Q48；normal dist artifact gate remains deferred。 |
| Q48 | M66/S87 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M66_ADMINPANEL_BROWSER_VISUAL_SMOKE_RECEIPT_20260621.md`；authorized browser visual smoke PASS；desktop/mobile route/text/icon/nonblank checks PASS；temp output/screenshots cleaned；normal dist artifact gate remains deferred。 |
| Q49 | M67/S88 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M67_ADMINPANEL_NORMAL_DIST_ARTIFACT_TASKBOOK_20260622.md`；normal dist artifact taskbook PASS；M68 actual build requires explicit current-turn authorization。 |
| Q50 | M68/S89 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M68_ADMINPANEL_NORMAL_DIST_ARTIFACT_RECEIPT_20260622.md`；actual normal dist artifact build PASS；typed build exit `0`; dist artifact staged；post-dist smoke/closeout decision next。 |
| Q51 | M69/S90 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M69_ADMINPANEL_POST_DIST_STATIC_SMOKE_RECEIPT_20260622.md`；post-dist static smoke PASS；desktop/mobile checks PASS；temp screenshots cleaned。 |
| Q52 | M70/S91 | PASS | AdminPanel | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M70_ADMINPANEL_ARTIFACT_LANE_CLOSEOUT_DECISION_20260622.md`；AdminPanel artifact lane closed for current route；remaining deferred boundaries recorded。 |
| Q53 | M71/S92 | PASS | Aggregate | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M71_AGGREGATE_JENN_FORK_LOCAL_ROUTE_REVIEW_20260622.md`；AgentOverrides override-only runtime-on + AdminPanel artifact closeout + deferred runtime lanes reviewed together；no env/runtime/private/upstream action。 |
| Q54 | M72/S93 | PASS | Decision | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M72_NEXT_RUNTIME_LANE_DECISION_OR_DEFERRED_DOMAIN_CLOSEOUT_20260622.md`；decision `WRITE_ONE_NARROW_TASKBOOK`; selected `M73_AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_TASKBOOK`; M72 did not write taskbook or enable runtime。 |
| Q55 | M73/S94 | PASS | AI Image | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M73_AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_TASKBOOK_20260622.md`；taskbook-only；future M74 default-off manifest/metadata registry gate defined；M73 did not modify runtime/env/external package/provider/image/private。 |
| Q56 | M74/S95 | PASS | AI Image | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M74_AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_RECEIPT_20260622.md`；metadata-only registry implemented；default-off count `0`; scoped metadata `1`; executable `0`; provider/image/output/bridge/LocalState `0`; real env/server/provider/image/private untouched。 |
| Q57 | M75/S96 | PASS | AI Image | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M75_AI_IMAGE_REGISTRY_REVIEW_OR_CLOSEOUT_DECISION_20260622.md`；decision `WRITE_M76_DEFAULT_OFF_DIAGNOSTIC_ROUTE_TASKBOOK`; M75 decision-only；no route/env/provider/image/private/upstream action。 |
| Q58 | M76/S97 | PASS | AI Image | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M76_AI_IMAGE_DEFAULT_OFF_DIAGNOSTIC_ROUTE_TASKBOOK_20260622.md`；taskbook-only；future diagnostic route URL/auth/fields/rollback/M77 stop line defined；no route/runtime/env/provider/image/private/upstream action。 |
| Q59 | M77/S98 | PASS | AI Image | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M77_AI_IMAGE_DEFAULT_OFF_DIAGNOSTIC_ROUTE_RECEIPT_20260622.md`；test-only route factory PASS；default-off/scoped/auth/write-method/real-execution-block checks PASS；no production router/env/provider/image/private/upstream action。 |
| Q60 | M78/S99 | PASS | AI Image | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M78_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_DECISION_20260622.md`；decision `WRITE_M79_PRODUCTION_ROUTER_INTEGRATION_TASKBOOK`; route factory remains unmounted；no production-router implementation/env/provider/image/private/upstream action。 |
| Q61 | M79/S100 | PASS | AI Image | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M79_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_INTEGRATION_TASKBOOK_20260622.md`；taskbook-only；M80 default-off production-router integration gate defined；no code/env/provider/image/private/upstream action。 |
| Q62 | M80/S101 | PASS | AI Image | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M80_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_INTEGRATION_RECEIPT_20260622.md`；default-off production-router integration PASS；scoped `200`; default/rollback `404`; unauthorized `403`; real execution `409`; no real env/provider/image/private/upstream action。 |
| Q63 | M81/S102 | PASS | AI Image | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M81_AI_IMAGE_DIAGNOSTIC_ROUTE_REAL_CONFIG_UNLOCK_DECISION_20260622.md`；selected M82 diagnostic metadata real-config apply/rollback drill; M81 decision-only; no real config write/provider/image/private/upstream action。 |
| Q64 | M82/S103 | PASS | AI Image | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M82_AI_IMAGE_DIAGNOSTIC_REAL_CONFIG_APPLY_ROLLBACK_DRILL_RECEIPT_20260622.md`；real config transient three-key write PASS; final state `OPTION_B_REMOVED_AFTER_ROLLBACK`; no provider/image/private/upstream action。 |

### 5.5 M19-M82 Specific Step Plan

| 待办 | Status | 执行动作 | 验收证据 | 禁止事项 |
| --- | --- | --- | --- | --- |
| M19-01 | PASS | 复读 S8 gate、M5 LocalState contract、S7 denylist | M19 source gates list | 不读取 LocalState 内容 |
| M19-02 | PASS | 写 LocalState private-by-default route planning taskbook | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M19_LOCALSTATE_PRIVATE_ROUTE_TASKBOOK_20260621.md` | 不创建真实 LocalState 数据目录 |
| M19-03 | PASS | 定义 `.agent_board/**` 单独人工 gate、确认主体、证据、允许/禁止范围 | M19 `.agent_board/**` gate matrix | 不自动 copy/checksum/migrate `.agent_board/**` |
| M19-04 | PASS | 定义 LocalState rollback、stop conditions、paths-only validation | M19 rollback / stop conditions / M20 validation sections | 不读取 secret/env/auth content |
| M19-05 | PASS | 更新 tracker：M19/S40 PASS 或 BLOCK | M19/S40 PASS；M20 later completed by M20 paths-only receipt | 不在 M19 内提前改 M20 为 PASS |
| M20-01 | PASS | 确认 M19 PASS、worktree clean、真实 private/env 未被读取 | root exists path-only preflight；env command no output | 不枚举 private/operator data |
| M20-02 | PASS | 如 M19 允许，创建 reviewed LocalState skeleton / README / denylist receipt | PLAN_CHANGE：root existed；created missing `.gitignore`; README paths already existed and were not overwritten | 不复制真实状态、配置、日志、数据库 |
| M20-03 | PASS | 对 skeleton 目标做 paths-only secret-risk scan | skeleton risk `0`; `.agent_board` path count `0`; private top-level presence noted only | 不 checksum `.agent_board/**` |
| M20-04 | PASS | 写 M20 receipt 并更新 tracker S41 | M20 receipt + tracker update | 不启用 runtime |
| M21-01 | PASS | 复读 M5 AdminPanel contract 和现有 AdminPanel route/menu/API 结构 | M21 source observations | 不修改 AdminPanel runtime |
| M21-02 | PASS | 写 AdminPanel extension manifest taskbook | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M21_ADMINPANEL_EXTENSION_MANIFEST_TASKBOOK_20260621.md` | 不注册真实 route |
| M21-03 | PASS | 定义 fixture build、route/menu/API shadow validation、rollback | M21 M22 fixture / shadow validation plan | 不 production build/deploy |
| M21-04 | PASS | 更新 tracker：M21/S42 PASS 或 BLOCK | M21/S42 PASS；M22 remains TODO | 不把 M22 标 PASS |
| M22-01 | PASS | 确认 M21 PASS 并创建 reviewed AdminPanel extension fixture/skeleton | harness temp fixture under system temp root；no persistent package | 不写真实 Admin route |
| M22-02 | PASS | 执行 fixture/build shadow validation | `ADMIN_EXTENSION_MANIFEST_SHADOW_VALIDATION_PASS`；manifest schema PASS；fixture risk `0`；AdminPanel build script present but build not run | 不部署、不启用生产 flag |
| M22-03 | PASS | 执行 rollback drill 并写 M22 receipt | `ROLLBACK_TEMP_FIXTURE_REMOVED=yes`；`docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M22_ADMINPANEL_EXTENSION_SHADOW_VALIDATION_RECEIPT_20260621.md` | 不删除 core AdminPanel fallback |
| M22-04 | PASS | 更新 tracker S43 | M22/S43 PASS；M23 remains TODO | 不声称 production ready |
| M23-01 | PASS | 复读 M6 AI Image boundary 和 provider-off 红线 | M23 source observations | 不读取 token/.env |
| M23-02 | PASS | 写 generic adapter externalization taskbook | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M23_AI_IMAGE_ADAPTER_EXTERNALIZATION_TASKBOOK_20260621.md` | 不写 Jenn trial/provider 常量进 core |
| M23-03 | PASS | 定义 fixture/mock/no-provider validation 与 rollback | M23 M24 no-provider validation plan | 不 provider call、不生成真实图片 |
| M23-04 | PASS | 更新 tracker：M23/S44 PASS 或 BLOCK | M23/S44 PASS；M24 remains TODO | 不把 M24 标 PASS |
| M24-01 | PASS | 确认 M23 PASS 并创建 reviewed fixture/mock adapter skeleton | harness temp fixture under system temp root；no persistent package | 不写 provider secret |
| M24-02 | PASS | 运行 no-provider shadow validation | `AI_IMAGE_NO_PROVIDER_SHADOW_VALIDATION_PASS`；provider/image/output/bridge/LocalState counters `0` | 不 live external write |
| M24-03 | PASS | paths-only scan、manifest checksum、rollback receipt | risk `0`；checksum `6b1263812aebf1042752b0c09ca1f53032fd620647f41b19a49d4391bf87a05e`；`ROLLBACK_TEMP_FIXTURE_REMOVED=yes`；M24 receipt | 不把 mock 通过当 provider 通过 |
| M24-04 | PASS | 更新 tracker S45 | M24/S45 PASS；M25 remains TODO | 不启用 runtime |
| M25-01 | PASS | 复读 M6 Codex/Memory boundary | M25 source observations | 不读取 private memory |
| M25-02 | PASS | 写 bridge taskbook、manifest/path-only contract | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M25_CODEX_MEMORY_EXTERNAL_BRIDGE_TASKBOOK_20260621.md` | 不 bridge 外写 |
| M25-03 | PASS | 定义 no-live-write validation、rollback、deferred matrix | M25 no-live-write validation plan / stop conditions | 不同步外部状态 |
| M25-04 | PASS | 更新 tracker S46 | M25/S46 PASS；M26 remains TODO | 不启用 runtime |
| M26-01 | PASS | 复读 M6 PhotoStudio boundary | M26 source observations | 不读取摄影项目私有数据 |
| M26-02 | PASS | 写 PhotoStudio externalization taskbook | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M26_PHOTOSTUDIO_EXTERNALIZATION_TASKBOOK_20260621.md` | 不复制项目数据 |
| M26-03 | PASS | 定义 plugins/templates source path-only candidate gate | M26 source/private lane split + candidate gate matrix | 不把 LocalState data 当 package content |
| M26-04 | PASS | 更新 tracker S47 | M26/S47 PASS；M27 remains TODO | 不启用 no-auto-write 之外的写入 |
| M27-01 | PASS | 收集 M0-M26 receipts / commits / checksum evidence | M27 evidence index | 不补造 PASS |
| M27-02 | PASS | 核对 deferred/BLOCK/open risks 与 rollback map | M27 deferred/open risk ledger + rollback map | 不改变 runtime |
| M27-03 | PASS | 写 migration ledger finalization doc | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M27_GOVERNANCE_MIGRATION_LEDGER_FINALIZATION_20260621.md` | 不开 upstream PR |
| M27-04 | PASS | 更新 tracker S48 | M27/S48 PASS；M28 remains DEFERRED | 不声称 deferred 已完成 |
| M28-01 | DEFERRED | 保持 upstream PR decision deferred；M38 后本地 closeout 已完成但 upstream PR 仍需未来单独授权 | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M28_UPSTREAM_PR_DECISION_DEFERRED_20260621.md` | 不自动打开 upstream PR |
| M28-02 | DEFERRED | M38 local closeout evidence 已具备；若未来当前轮明确授权 upstream PR，再做 target repo/source branch/base branch/action preflight | not run; M38 evidence present, upstream authorization/preflight not executed | 不把 M38 local closeout 当成 upstream PR 授权 |
| M28-03 | DEFERRED | 只有未来当前轮明确 upstream PR 授权时，才准备/open PR 并记录 rollback/close path | skipped; upstream PR not opened | 不混入 Jenn runtime overlay |
| M29-01 | PASS | 审计所有 active/deferred/BLOCK 状态 | M29 final status matrix | 不隐藏风险 |
| M29-02 | PASS | 写最终风险、rollback、未做项、下一周期建议 | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M29_JENN_FORK_MAINTENANCE_FINAL_CLOSEOUT_20260621.md` | 不自动执行 stub/untrack/remove |
| M29-03 | PASS | 更新 tracker S50 和顶部 current milestone | M29/S50 PASS；S50-time Progress `28.7 / 30`；M8/M28 upstream deferred remains non-counting | 不把 M29 closeout 当成 upstream-ready proof |
| M30-01 | PASS | 复读 M28/M29 gate，确认 upstream PR 仍独立 deferred | M30 source gate references | 不把 M29 closeout 当 upstream-ready |
| M30-02 | PASS | 写 full-local implementation + stability gate taskbook | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M30_LOCAL_IMPLEMENTATION_STABILITY_WINDOW_TASKBOOK_20260621.md` | 不启用 runtime |
| M30-03 | PASS | 定义 accelerated local closeout、optional calendar soak、domain mini-gates、reset rules、receipt template | M30 sections 3-8 | 不用 discovery success 代替 runtime/stability proof |
| M30-04 | PASS | 更新 tracker：M30/S51 PASS，M8/M28 仍 deferred | Progress `29.7 / 31`；M30 window defined only | 不改变 M28 为 PASS |
| M31-01 | PASS | 确认 M21/M22/M30 gate 和 external package worktree clean | external base `bc287826d47e89204cba536c75e9374fd6db87ab` | 不读取 LocalState/private/`.agent_board/**` |
| M31-02 | PASS | 创建 persistent `AdminExtensions/JennAdminStatus` skeleton | external commit `eff66b2979e319494e49bbeec9ccb652afcd57ee` | 不注册 AdminPanel runtime route |
| M31-03 | PASS | 重新生成 source/package checksum 并运行 persistent package harness | `ADMINPANEL_PERSISTENT_PACKAGE_GATE_PASS`; checksum manifest `a2d0afb04ea17416c982f07b2e0f4d920ddd24929bfa406b3864825a58f1d5cf` | 不跑 AdminPanel build，不修改 `AdminPanel-Vue/dist/**` |
| M31-04 | PASS | 写 M31 external/core receipts 并更新 tracker | M31 receipt + S52 PASS | 不把 package gate 当 runtime/stability proof |
| M32-01 | PASS | 确认 M23/M24/M30 gate 和 external package worktree clean | external base `eff66b2979e319494e49bbeec9ccb652afcd57ee` | 不读取 token/.env/LocalState/private/`.agent_board/**` |
| M32-02 | PASS | 创建 persistent `AIImageAdapters/JennImageProviderAdapter` skeleton | external commit `5edb89051291137859100cfc915349b9921f84cd` | 不启用 provider/runtime registration |
| M32-03 | PASS | 重新生成 source/package checksum 并运行 no-provider persistent package harness | `AI_IMAGE_PROVIDER_ADAPTER_PACKAGE_GATE_PASS`; checksum manifest `9067d97dadf3c7a83138c90ac487ac0e2615b64c4a74de927b2d4a3670c548a7`; provider/image/output/bridge/LocalState counters `0` | 不 provider call、不生成真实图片、不写 image output |
| M32-04 | PASS | 写 M32 external/core receipts 并更新 tracker | M32 receipt + S53 PASS | 不把 package gate 当 runtime/stability proof |
| M33-01 | PASS | 确认 M25/M30 gate 和 external package worktree clean | external base `5edb89051291137859100cfc915349b9921f84cd` | 不读取真实 dailynote memory/log/vector/db/LocalState/`.agent_board/**` |
| M33-02 | PASS | 创建 persistent `MemoryBridges/JennCodexMemoryBridge` skeleton | external commit `320cf17ec3204179a150161fa87429e1fef29cab` | 不启用 bridge runtime registration |
| M33-03 | PASS | 重新生成 source/package checksum 并运行 no-live-write persistent package harness | `CODEX_MEMORY_NO_LIVE_WRITE_PACKAGE_GATE_PASS`; checksum manifest `2cff44db435e9458781d41e5260f1e73f246505fb118fabc7badec6f13dabaf2`; bridge/private-memory/LocalState/external/provider counters `0` | 不执行 memory write、不读取 private memory、不 bridge 外写 |
| M33-04 | PASS | 写 M33 external/core receipts 并更新 tracker | M33 receipt + S54 PASS | 不把 package gate 当 runtime/stability proof |
| M34-01 | PASS | 确认 M26/M30 gate 和 external package worktree clean | external base `320cf17ec3204179a150161fa87429e1fef29cab` | 不读取真实 PhotoStudio data/media/export/LocalState/`.agent_board/**` |
| M34-02 | PASS | 创建 persistent `PhotoStudioPackages/JennPhotoStudioPackage` skeleton | external commit `3a63904e753aa8b8869f588fc0b8fc862354e123` | 不启用 PhotoStudio runtime package registration |
| M34-03 | PASS | 重新生成 source/package checksum 并运行 no-auto-write persistent package harness | `PHOTOSTUDIO_SOURCE_PACKAGE_GATE_PASS`; checksum manifest `9e01af36f0ecd99c27294addc99d44d6592a5883fb5b41b2e2ee585f721809fd`; project-data/external/provider/bridge/LocalState counters `0` | 不读取/写入真实项目数据、不 external sync/publish/write |
| M34-04 | PASS | 写 M34 external/core receipts 并更新 tracker | M34 receipt + S55 PASS | 不把 package gate 当 runtime/stability proof |
| M35-01 | PASS | 确认 core/external worktree clean，读取 M30/M31-M34 evidence | core HEAD `501f7a80fe8d43133eea68a2dd4b5d85d79056c9`; external HEAD `3a63904e753aa8b8869f588fc0b8fc862354e123` | 不启用 runtime、不修改 external package |
| M35-02 | PASS | 复跑 M31-M34 package harnesses | `ADMINPANEL_PERSISTENT_PACKAGE_GATE_PASS`; `AI_IMAGE_PROVIDER_ADAPTER_PACKAGE_GATE_PASS`; `CODEX_MEMORY_NO_LIVE_WRITE_PACKAGE_GATE_PASS`; `PHOTOSTUDIO_SOURCE_PACKAGE_GATE_PASS` | 不把 discovery/checksum 当 runtime/stability proof |
| M35-03 | PASS | 写 aggregate full-local matrix review | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M35_AGGREGATE_FULL_LOCAL_MATRIX_REVIEW_20260621.md` | 不把 deferred runtime gates 隐去 |
| M35-04 | PASS | 更新 tracker/M30：M35/S56 PASS；后续由 M38 完成 accelerated closeout | Historical progress `34.7 / 36`; later tracker current state is M38 PASS | 不打开 upstream PR |
| M36-01 | PASS | 复读 M30/M35，确认 stable window 只能由 opening cycle receipt 启动 | M36 entry baseline refs | 不启动 cycle |
| M36-02 | PASS | 写 optional calendar-soak entry | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M36_STABLE_OPERATION_WINDOW_ENTRY_20260621.md` | 不把 entry 当 stability proof |
| M36-03 | PASS | 定义 future cycle receipt shape、required evidence、reset conditions、stop boundaries | M36 sections 4-7 | 不提前分配未来 cycle M 编号 |
| M36-04 | PASS | 更新 tracker/M30：M36/S57 PASS；后续由 M38 降级为 optional calendar-soak entry | Historical progress `35.7 / 37`; later tracker current state is M38 PASS | 不打开 upstream PR |
| M37-01 | PASS | 确认 core/external worktree clean 和 baseline refs | core `522e0816e5824db1c43ccc2cc046fde4ee6b61b9`; external `3a63904e753aa8b8869f588fc0b8fc862354e123` | 不修改 external package |
| M37-02 | PASS | 检查 package/runtime env vars presence only | all listed env vars `unset` | 不读取 `.env` 内容 |
| M37-03 | PASS | 复跑 M31-M34 package harnesses | four harnesses PASS; checksum `9e01af36f0ecd99c27294addc99d44d6592a5883fb5b41b2e2ee585f721809fd` | 不启用 runtime/provider/bridge |
| M37-04 | PASS | 写 opening cycle receipt 并启动 window | `WINDOW_START=yes`; timestamp `2026-06-21T15:15:51+08:00` | 不把 cycle 1 当 final stability proof |
| M37-05 | PASS | 更新 tracker/M30：M37/S58 PASS；后续由 M38 将 mid/final cycles 改为 deferred optional | Historical progress `36.7 / 38`; later tracker current state is M38 PASS | 不打开 upstream PR |
| M38-01 | PASS | 记录 PLAN_CHANGE：7-day calendar wait 不再阻塞 Jenn fork 本地收口 | M38 section 1；M30/M36/M37 已同步修正 | 不把 calendar soak 删除或伪装成已通过 |
| M38-02 | PASS | 确认 core/external clean、记录 baseline refs 和 env presence-only | core `48591a8d71b22c47e6f4c78e714264455e4d02a2`; external `3a63904e753aa8b8869f588fc0b8fc862354e123`; all listed env vars `unset` | 不读取 `.env` 内容 |
| M38-03 | PASS | 执行 accelerated revalidation Round A | four harnesses PASS; checksum `9e01af36f0ecd99c27294addc99d44d6592a5883fb5b41b2e2ee585f721809fd`; risk `0`; runtime refs `0` | 不启用 runtime/provider/bridge |
| M38-04 | PASS | 执行 accelerated revalidation Round B | four harnesses PASS; checksum unchanged; no-live-write/default-off counters remain `0` | 不把同日复验当 7-day soak |
| M38-05 | PASS | 写 M38 closeout receipt | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M38_ACCELERATED_LOCAL_STABILITY_CLOSEOUT_RECEIPT_20260621.md` | 不声称 production uptime 或 upstream-ready |
| M38-06 | PASS | 更新 tracker/M30/M36/M37：local closeout PASS，calendar soak deferred optional | Progress `37.7 / 39`; current milestone M38 PASS | 不打开 upstream PR |
| M39-01 | PASS | 检测真实 env 文件路径 | `.env exists: no`; `config.env exists: yes`; real env file used `config.env` | 不创建、不修改 `.env` / `config.env` |
| M39-02 | PASS | 新增 redacted real-config runtime-on gate harness | `scripts/run-real-config-env-runtime-on-local-gate-harness.js`；只输出 `_SET=yes/no`、counts、diagnostic codes | 不打印 env 值、不执行 plugin/provider/bridge |
| M39-03 | BLOCK | 使用真实 `config.env` 运行 runtime-on local gate | `REAL_CONFIG_ENV_RUNTIME_ON_LOCAL_GATE_BLOCK`; `BLOCK_REASONS=no_implemented_runtime_lane_enabled_by_real_config_env` | 不把 runtime-off 真实配置伪装成 runtime-on PASS |
| M39-04 | PASS | 写 initial M39 receipt 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M39_REAL_CONFIG_ENV_RUNTIME_ON_LOCAL_GATE_RECEIPT_20260621.md`; historical Progress `37.7 / 40` | 当时不自动修改真实 env；后续由 M41 单独授权解除 BLOCK |
| M40-01 | PASS | 新增 Agent real-config unlock decision dry-run harness | `scripts/run-agent-real-config-unlock-decision-gate-harness.js` | 不修改 `config.env`，不输出 env 值 |
| M40-02 | PLAN_CHANGE | 初始 all-Agent candidate 触发 additive duplicate | `additive_duplicate_core_agent:7`; skipped additive files `7` | 不强行开启 `VCP_AGENT_DIRS` |
| M40-03 | PASS | 收窄到 `AgentOverrides` only 候选 | `CANDIDATE_UNLOCK_LANE=agent-overrides`; `CANDIDATE_AGENT_ADDITIVE_ENABLED=no` | 不启用 provider/bridge/LocalState/private |
| M40-04 | PASS | 运行 dry-run 复验 | `AGENT_REAL_CONFIG_UNLOCK_DECISION_GATE_PASS`; override files `2`; diagnostics `none`; path risk `0` | 不读取 Agent prompt 正文，不启动 server |
| M40-05 | PASS | 写 M40 receipt 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M40_AGENT_REAL_CONFIG_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`; historical Progress `38.7 / 41` | M40 决策时不把 M39 改成 PASS；后续由 M41 单独授权应用真实 env |
| M41-01 | PASS | 当前轮明确授权后，确认目标 key line counts | pre-edit counts `0/0/0` for allowed/override/additive | 不读取或打印 secret 值 |
| M41-02 | PASS | 写入真实 `config.env` 两个授权 key | post-edit counts `1/1/0`; before/after sha256 recorded | 不写 `VCP_AGENT_DIRS`，不写 provider/bridge/LocalState |
| M41-03 | PASS | rerun M39 real-config runtime-on gate | `REAL_CONFIG_ENV_RUNTIME_ON_LOCAL_GATE_PASS`; Agent override roots `1`; override files `2`; diagnostics `none` | 不启动 server，不执行 plugin/provider/bridge |
| M41-04 | PASS | rerun M40 post-apply validation | `GATE_MODE=post-apply-validation`; `AGENT_REAL_CONFIG_UNLOCK_DECISION_GATE_PASS` | 不读取 Agent prompt 正文 |
| M41-05 | PASS | rerun Agent resolver/manager tests | `13 pass / 0 fail` | 不运行生产服务 |
| M41-06 | PASS | 写 M41 receipt 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M41_AGENTOVERRIDES_REAL_CONFIG_APPLY_RECEIPT_20260621.md`; Progress `40.7 / 42` | 不提交 `config.env` |
| M42-01 | PASS | 确认真实 config 仍是 AgentOverrides only | counts `1/1/0` for allowed/override/additive | 不打印 env 值 |
| M42-02 | PASS | 新增 local read smoke harness | `scripts/run-agent-overrides-runtime-on-local-read-smoke-harness.js` | 不启动 production/HTTP/Admin server |
| M42-03 | PASS | 调用 `AgentManager.getAgentPrompt()` 读取目标 overrides | `LOCAL_PROMPT_READ_COUNT=2`; `READ_PATHS_MATCH_EXTERNAL_OVERRIDE=yes` | 不输出 prompt 正文 |
| M42-04 | PASS | 确认 additive lane 仍关闭 | `AGENT_EXTERNAL_ADDITIVE_ROOT_COUNT=0`; `ENV_VCP_AGENT_DIRS_SET=no` | 不启用 `VCP_AGENT_DIRS` |
| M42-05 | PASS | 写 M42 receipt 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M42_AGENTOVERRIDES_LOCAL_READ_SMOKE_RECEIPT_20260621.md`; Progress `41.7 / 43` | 不提交 `config.env` |
| M43-01 | PASS | 临时移除两个 AgentOverrides real config keys | line counts `0/0/0`; hash `6072970...` -> `580d920...` | 不打印 env 值，不触碰 `VCP_AGENT_DIRS` |
| M43-02 | PASS | 运行 M42 rollback smoke，预期 BLOCK | `AGENT_OVERRIDES_RUNTIME_ON_LOCAL_READ_SMOKE_BLOCK`; `EXPECTED_M42_BLOCK_EXIT=1` | runtime-off 时不读 prompt |
| M43-03 | PASS | 运行 M39/M40 sanity | M39 expected BLOCK；M40 pre-apply decision PASS | 不启动 server/provider/bridge |
| M43-04 | PASS | 恢复两个 AgentOverrides real config keys | line counts `1/1/0`; hash restored to `6072970...` | 不提交 `config.env` |
| M43-05 | PASS | 运行 M42/M39/M40 restored validation | M42 PASS；M39 PASS；M40 post-apply PASS | 不启用 additive lane |
| M43-06 | PASS | 写 M43 receipt 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M43_AGENTOVERRIDES_CONFIG_ROLLBACK_DRILL_RECEIPT_20260621.md`; Progress `42.7 / 44` | 最终 config 必须恢复到 AgentOverrides only |
| M44-01 | PASS | 确认当前 runtime-on config 仍是 AgentOverrides only | line counts `1/1/0` | 不打印 env 值 |
| M44-02 | PASS | 新增 Admin write guard harness | `scripts/run-agent-overrides-admin-write-guard-harness.js` | 不启动 production server |
| M44-03 | PASS | 用本地临时 Admin route 读取 external overrides | GET status `200,200`; external flags `true,true`; lanes `override,override` | 不输出 prompt 正文 |
| M44-04 | PASS | 尝试 Admin POST 写 external overrides 并确认拒绝 | POST status `403,403`; write trap `0`; core/external hashes unchanged | 不允许任何 Agent 文件写入 |
| M44-05 | PASS | 写 M44 receipt 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M44_AGENTOVERRIDES_ADMIN_WRITE_GUARD_RECEIPT_20260621.md`; Progress `43.7 / 45` | 不提交 `config.env` |
| M45-00 | PLAN_CHANGE | M44 后新增 runtime-on aggregate review 小门 | M45 receipt section 1；同提交记录计划变更与执行证据，因为该门只复跑/核对本地证据、不改 runtime、不改真实 env | 不用事后补 TODO 掩盖越界；本项只能覆盖 no-side-effect aggregate review |
| M45-01 | PASS | 确认真实 config 仍是 AgentOverrides only | counts `1/1/0`; `CONFIG_ENV_VALUES_PRINTED=no`; hash `6072970...` | 不打印 env 值、不提交 `config.env` |
| M45-02 | PASS | 新增 aggregate review harness | `scripts/run-agent-overrides-runtime-on-aggregate-review-harness.js` | 不启用 `VCP_AGENT_DIRS`，不启动 production server |
| M45-03 | PASS | fresh rerun M39/M40/M42/M44 和 Agent external runtime tests | aggregate command exits all `0`; missing required lines `0`; `RUNTIME_CHAIN_M39_M40_M42_M44_PASS=yes` | 不运行 provider/bridge/live write |
| M45-04 | PASS | 核对 M43 rollback receipt，但不重跑 env-mutating drill | `M43_ROLLBACK_DRILL_RERUN=no`; `M43_RECEIPT_PASS_EVIDENCE=yes` | 不再次修改真实 `config.env` |
| M45-05 | PASS | 写 M45 receipt 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M45_AGENTOVERRIDES_RUNTIME_ON_AGGREGATE_REVIEW_RECEIPT_20260621.md`; Progress `44.7 / 46` | 不打开 upstream PR |
| M46-00 | PASS | 新增 next runtime lane unlock decision gate 计划 | tracker M46/Q28/S67 TODO was added before execution | 不事后补计划 |
| M46-01 | PASS | 读取真实 config key presence 和 package receipts / source refs | counts `1/0/1`; non-agent runtime keys `0`; package receipts present | 不打印 env 值、不读取 private content |
| M46-02 | PASS | 评估 Agent additive / AdminPanel / AI Image / Codex-Memory / PhotoStudio / LocalState / upstream candidates | Agent additive BLOCK；AdminPanel/AI Image/Codex-Memory/PhotoStudio DEFERRED；LocalState BLOCK；upstream DEFERRED | 不启用 runtime、不修改真实 env |
| M46-03 | PASS | 写 M46 receipt 和 harness 证据 | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M46_NEXT_RUNTIME_LANE_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`; `M46_NEXT_RUNTIME_LANE_UNLOCK_DECISION_GATE_PASS` | 不把 package presence 当 runtime proof |
| M46-04 | PASS | 更新 tracker：M46/S67 PASS，并明确停止条件 | Progress `45.7 / 47`; `STOP_REQUIRED_AFTER_M46=yes` | 不打开 upstream PR |
| M47-01 | PASS | 复读 M21/M31/M46 和现有 AdminPanel backend/frontend route structures | source observations recorded in M47 sections 2 and 6 | 不修改 AdminPanel runtime |
| M47-02 | PASS | 定义 future split env contract | `VCP_ADMIN_EXTENSION_ALLOWED_ROOTS` / `VCP_ADMIN_EXTENSION_DIRS` / `VCP_ADMIN_EXTENSION_ALLOWLIST` | 不写真实 env |
| M47-03 | PASS | 定义 M48 backend read-only default-off registry scope | M47 sections 5, 8, 9；local test server only | 不启用 frontend runtime route/nav |
| M47-04 | PASS | 明确 frontend runtime registration deferred | M47 section 6 | 不动态 import external Vue，不跑 build，不写 dist |
| M47-05 | PASS | 写 M47 taskbook 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M47_ADMINPANEL_DEFAULT_OFF_RUNTIME_REGISTRATION_TASKBOOK_20260621.md`; Progress `46.7 / 48` | 不启用 runtime、不打开 upstream PR |
| M48-01 | PASS | 实现纯 Admin extension resolver / manifest validator / registration plan builder | `modules/adminExtensionRegistry.js` | 不接入生产 router，不写真实 env |
| M48-02 | PASS | 增加 default-off / dirs-only / allowlist-missing / core-inside-root rejection / scoped env-on 单元测试 | `tests/admin-extension-registry.test.js`; `5 pass / 0 fail` | 不启动 server/provider/bridge |
| M48-03 | PASS | 增加 local test-only backend registry harness | `M48_ADMINPANEL_BACKEND_DEFAULT_OFF_REGISTRY_GATE_PASS`; scoped GET `200`; write methods `404`; rollback `404` | 不启动 production server，不注册 frontend runtime |
| M48-04 | PASS | 验证 `config.env`、core Admin runtime 文件、external Admin package hash 未改变 | `CONFIG_ENV_FILE_MODIFIED=no`; `CORE_ADMIN_RUNTIME_HASH_UNCHANGED=yes`; `EXTERNAL_ADMIN_PACKAGE_HASH_UNCHANGED=yes` | 不打印 secret/env 值 |
| M48-05 | PASS | 写 M48 receipt 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M48_ADMINPANEL_BACKEND_DEFAULT_OFF_REGISTRY_GATE_RECEIPT_20260621.md`; Progress `47.7 / 49` | 不打开 upstream PR |
| M49-01 | PASS | 新增 AdminPanel backend registry shadow rollback harness | `scripts/run-adminpanel-backend-registry-shadow-rollback-drill-harness.js` | 不写真实 `config.env` |
| M49-02 | PASS | rerun M48 backend registry gate | `M48_ADMINPANEL_BACKEND_DEFAULT_OFF_REGISTRY_GATE_PASS` | 不接生产 router |
| M49-03 | PASS | 执行 scoped env off/on/rollback/reapply/partial-env 序列 | GET status `404/200/404/200/404`; write methods `404,404,404,404` | 不注册 frontend runtime |
| M49-04 | PASS | 校验 plan snapshot 稳定和 hash 不变 | `OFF_PLAN_SNAPSHOT_STABLE=yes`; `SCOPED_ON_PLAN_SNAPSHOT_STABLE=yes`; `CONFIG_ENV_FILE_MODIFIED=no` | 不打印 secret/env 值 |
| M49-05 | PASS | 写 M49 receipt 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M49_ADMINPANEL_BACKEND_REGISTRY_SHADOW_ROLLBACK_DRILL_RECEIPT_20260621.md`; Progress `48.7 / 50` | 不打开 upstream PR |
| M50-01 | PASS | 新增 runtime-on local smoke harness | `scripts/run-adminpanel-runtime-on-local-smoke-scoped-env-harness.js` | 不写真实 `config.env` |
| M50-02 | PASS | 验证默认 process.env 下 Admin extension runtime off | `DEFAULT_OFF_GET_STATUS=404`; `DEFAULT_OFF_REGISTERED_ROUTE_COUNT=0` | 不从真实 config 激活 |
| M50-03 | PASS | 临时设置 scoped process.env 三键并用默认 env path 建 plan | `BUILD_PLAN_ENV_SOURCE=process.env`; `SCOPED_PROCESS_ENV_APPLIED=yes`; GET `200` | 不接生产 router |
| M50-04 | PASS | 验证 `/admin_api` shaped local mount、read-only GET、写方法阻断 | mounted `/admin_api/jenn-admin-status`; write methods `404,404,404,404` | 不注册 frontend runtime |
| M50-05 | PASS | restore process.env rollback 并验证 hash 不变 | `ROLLBACK_GET_STATUS=404`; `PROCESS_ENV_FINAL_UNCHANGED=yes`; `CONFIG_ENV_FILE_MODIFIED=no` | 不启动 production server |
| M50-06 | PASS | 写 M50 receipt 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M50_ADMINPANEL_RUNTIME_ON_LOCAL_SMOKE_SCOPED_ENV_RECEIPT_20260621.md`; Progress `49.7 / 51` | 不打开 upstream PR；停止在真实 runtime/env/frontend 启用前 |
| M51-01 | PASS | 复读 M47-M50 和现有 AdminPanel backend production router shape | M51 sections 2-4 | 不修改 `server.js` / `routes/adminPanelRoutes.js` |
| M51-02 | PASS | 记录计划变更：M51 从 frontend taskbook 调整为 backend production-router integration taskbook | M51 section 2 | 不把 frontend route/nav 混入 M51 |
| M51-03 | PASS | 定义未来 M52 allowed scope、stop conditions、validation matrix、rollback | M51 sections 4-8 | 不直接执行 M52 |
| M51-04 | PASS | 写 M51 taskbook 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M51_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_TASKBOOK_20260621.md`; Progress `50.7 / 52` | 不打开 upstream PR |
| M52-01 | PASS | 新增 Admin extension runtime mount helper | `modules/adminExtensionRuntimeMount.js` | 不写真实 env，不接 frontend |
| M52-02 | PASS | 先写并运行 runtime mount 单元测试 | `tests/admin-extension-runtime-mount.test.js`; registry/runtime tests `8 pass / 0 fail` | 不启动 production server |
| M52-03 | PASS | 将 default-off backend runtime mount 接入 `routes/adminPanelRoutes.js` | Git blob `0b624cd4` -> `68da2489`; `server.js` unchanged | 不修改 `server.js` |
| M52-04 | PASS | 新增 scoped production-router integration harness | `scripts/run-adminpanel-production-router-integration-scoped-env-harness.js`; `M52_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_SCOPED_ENV_PASS` | 不读取/打印 secret/env 值 |
| M52-05 | PASS | 复跑 M48/M49/M50 与 M52 validation | M48/M49/M50/M52 harnesses PASS；scoped GET `200`; rollback `404` | 不写真实 `config.env` |
| M52-06 | PASS | 写 M52 receipt 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M52_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_RECEIPT_20260621.md`; Progress `51.7 / 53` | 不打开 upstream PR |
| M53-01 | PASS | 新增 AdminPanel real-config unlock decision dry-run harness | `scripts/run-adminpanel-real-config-unlock-decision-gate-harness.js` | 不修改 `config.env`，不输出 env 值 |
| M53-02 | PASS | 读取真实 config key presence/hash，并允许既有 AgentOverrides only 状态 | `REAL_ENV_ADMIN_KEYS_SET_COUNT=0`; `REAL_ENV_ALLOWED_AGENT_RUNTIME_KEYS_SET_COUNT=2`; `CONFIG_ENV_HASH_UNCHANGED=yes` | 不把 AgentOverrides 已授权状态误判为污染 |
| M53-03 | PASS | 评估 AdminPanel backend readonly 三键候选 | candidate route count `1`; mount `/jenn-admin-status`; method `GET`; diagnostics `none` | 不选择 frontend/prod server/build |
| M53-04 | PASS | 写 M53 receipt 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M53_ADMINPANEL_REAL_CONFIG_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`; Progress `52.7 / 54` | 不打开 upstream PR |
| M54-01 | PASS | 获取当前轮明确授权后，准备 exact three-key real `config.env` apply | user authorized; preflight M53 PASS | 未授权前不写真实 `config.env` |
| M54-02 | PASS | 只写入 `VCP_ADMIN_EXTENSION_ALLOWED_ROOTS` / `VCP_ADMIN_EXTENSION_DIRS` / `VCP_ADMIN_EXTENSION_ALLOWLIST` 三键 | hash `6072970...` -> `908cf54...`; key count `0` -> `3` | 不改 Agent/provider/bridge/LocalState/private keys |
| M54-03 | PASS | rerun M48-M53 post-apply validation | M48/M49/M50/M52/M53 PASS；tests `8 pass / 0 fail` | 不启动 production server |
| M54-04 | PASS | rollback drill：移除三键确认 default-off，再恢复三键确认 PASS | remove GET `404`; restore GET `200`; final hash restored `908cf54...` | 不触碰 AgentOverrides keys |
| M54-05 | PASS | 写 M54 receipt 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M54_ADMINPANEL_REAL_CONFIG_APPLY_ROLLBACK_DRILL_RECEIPT_20260621.md`; Progress `53.7 / 55` | 不启用 frontend runtime，不跑 AdminPanel build |
| M55-01 | PASS | 复读 M54、`server.js` production route/auth shape、AdminPanel frontend static route shape | M55 sections 2-3 | 不启动 production server |
| M55-02 | PASS | 比较 production-server smoke、frontend route/nav、build/dist 选项 | M55 option matrix | 不把 backend registration 当 frontend readiness |
| M55-03 | PASS | 决策下一顺序：M56 smoke taskbook -> M57 actual smoke with separate authorization -> M58 frontend route/nav taskbook | M55 decision section | 不直接执行 M57/M58 |
| M55-04 | PASS | 写 M55 taskbook 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M55_ADMINPANEL_PRODUCTION_SMOKE_FRONTEND_DECISION_TASKBOOK_20260621.md`; Progress `54.7 / 56` | 不打开 upstream PR |
| M56-01 | PASS | 写 AdminPanel production-server smoke taskbook | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M56_ADMINPANEL_PRODUCTION_SERVER_SMOKE_TASKBOOK_20260621.md` | 不启动 production server |
| M56-02 | PASS | 定义 command/port/auth/log/cleanup/rollback 证据格式 | M56 sections 4-10 | 不打印 secret/env 值 |
| M56-03 | PASS | 明确 M57 actual smoke 授权门和 M58 frontend taskbook 延后 | M56 sections 1, 7, 9 | 不直接执行 M57/M58 |
| M56-04 | PASS | 更新 tracker：M56/S77 PASS；M57/S78 later completed by M57 | Progress later updated again by M59 to `58.7 / 60` | 不打开 upstream PR |
| M57-01 | PASS | 在当前轮明确授权后启动 production server 做 smoke | M57 receipt；controlled `node server.js` child process | 未授权前不启动 server |
| M57-02 | PASS | 清理 server process 并验证 backend readonly route / write block | GET `200`; POST/PUT/PATCH/DELETE `404`; PID cleanup PASS | 不启用 frontend/build/provider/bridge |
| M57-03 | PASS | 写 M57 receipt 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M57_ADMINPANEL_PRODUCTION_SERVER_SMOKE_RECEIPT_20260621.md` | 不提交 ignored runtime paths |
| M58-01 | PASS | 写 AdminPanel frontend route/nav taskbook | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M58_ADMINPANEL_FRONTEND_ROUTE_NAV_TASKBOOK_20260621.md` | 不直接修改 AdminPanel-Vue runtime |
| M58-02 | PASS | 定义可显示内容、metadata 来源、允许前端文件、禁止 build/dist 和动态 import 边界 | M58 sections 3-10 | 不把 backend registration 当 frontend readiness |
| M58-03 | PASS | 更新 tracker：M58/S79 PASS；M59/S80 later completed by M59 | Progress later updated to `58.7 / 60` | 不打开 upstream PR |
| M59-01 | PASS | 实现静态 reviewed route/nav 前端入口 | `manifest.ts`、`components.ts`、`JennAdminStatusView.vue` | 只限 M58 allowed files；不 build/dist |
| M59-02 | PASS | 验证 route/nav manifest、component map、view 页面和 no-secret display boundary | targeted ESLint PASS；`vue-tsc --noEmit` PASS；secret-risk grep clean | 不启用动态 external Vue import |
| M59-03 | PASS | 写 M59 receipt 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M59_ADMINPANEL_FRONTEND_ROUTE_NAV_STATIC_IMPLEMENTATION_RECEIPT_20260621.md`；Progress `58.7 / 60` | 不提交 dist/runtime ignored paths |
| M60-01 | PASS | 写 AdminPanel build/dist decision taskbook | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M60_ADMINPANEL_BUILD_DIST_DECISION_TASKBOOK_20260621.md` | 不直接 run build/dev/preview |
| M60-02 | PASS | 决定是否需要 browser visual smoke、build artifact policy、dist commit policy | M60 decision：no build/no dist now；future build gate requires separate authorization | 不 blanket ignore `dist/` |
| M60-03 | PASS | 选择下一安全门 M61 no-build route/source validation | M60 section 8 | 不把 source validation 当 build proof |
| M61-01 | PASS | 执行 no-build route/source validation receipt | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M61_ADMINPANEL_NO_BUILD_ROUTE_SOURCE_VALIDATION_RECEIPT_20260621.md` | 不 run build/dev/preview |
| M61-02 | PASS | 复跑 targeted ESLint、`vue-tsc --noEmit`、M53 redacted gate 并记录 dist untouched | M61 receipt validation | 不修改 `dist` 或真实 config |
| M62-01 | PASS | 写 AdminPanel build/lint baseline path decision taskbook | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M62_ADMINPANEL_BUILD_LINT_PATH_DECISION_TASKBOOK_20260621.md` | 不直接 run build/dev/preview |
| M62-02 | PASS | 在 typography baseline cleanup、temp outDir dry build、explicit dist build gate 中选择下一安全路线 | M62 decision：M63 temp outDir dry-build authorization taskbook | 不自动提交 dist |
| M62-03 | PASS | 标记自动推进停止边界：实际 build / broad lint cleanup 前需当前轮明确授权 | M62 stop boundary | 不把“继续”当 build 授权 |
| M63-01 | PASS | 写 temp outDir dry-build authorization taskbook | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M63_ADMINPANEL_TEMP_OUTDIR_DRY_BUILD_AUTHORIZATION_TASKBOOK_20260621.md` | 不直接执行 build |
| M63-02 | PASS | 定义 exact Vite temp outDir command、`.tmp` output path、cleanup target、no-dist proof | M63 sections 2-7 | 不修改 `AdminPanel-Vue/dist/**` |
| M63-03 | PASS | 标记实际 build/cleanup 的授权词和 stop conditions | M63 sections 8-9 | 不把“继续/自动推进”当 build 授权 |
| M64-01 | PASS | 当前轮明确授权后执行 Vite temp outDir dry build | M64 receipt；build exit `0` | 不运行 dev/preview/production server |
| M64-02 | PASS | 验证 no-dist/no-source/package unchanged 和 temp output evidence | dist aggregate SHA256 unchanged；temp file count `255` | 不提交或修改 `AdminPanel-Vue/dist/**` |
| M64-03 | PASS | 审查 raw path-risk hits 并补充 case-insensitive/bracket-pattern evidence fix | raw hits `4` reviewed false-positive；current frontend auth-surface false positives `9`; future temp output scan must use corrected pattern | 不读取 LocalState/private 或 `.agent_board/**` |
| M64-04 | PASS | 精确清理 `.tmp/m63-adminpanel-dry-build` 并复核 | `TEMP_OUTDIR_EXISTS_AFTER_CLEANUP=no` | 不清理 workspace root 或 `AdminPanel-Vue/dist/**` |
| M65-01 | PASS | 写 browser visual smoke taskbook | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M65_ADMINPANEL_BROWSER_VISUAL_SMOKE_TASKBOOK_20260621.md` | 不启动 server/browser |
| M65-02 | PASS | 定义 M66 target URL、viewports、text anchors、screenshot policy、cleanup policy | M65 sections 3-7 | 不创建 screenshots、不跑 Playwright |
| M65-03 | PASS | 明确 normal dist artifact gate deferred until after visual smoke decision | M65 decision section | 不修改 `AdminPanel-Vue/dist/**` |
| M66-01 | PASS | 审查 M65 并窄修 expected visible anchors 到当前源码真实文案 | M65 docs-only wording fix | 不改前端源码、不改 dist |
| M66-02 | PASS | 当前轮授权后执行 Vite temp outDir build 并运行 corrected path-risk scan | temp dist `255` files / `12179826` bytes；raw auth-surface false positives `2`; private-root risk `0` | 不运行 dev/preview/production server |
| M66-03 | PASS | 启动本地只读 static server 并用 Puppeteer/Chromium 运行 desktop/mobile visual smoke | route/text/icon/nonblank checks all `yes`; `/admin_api/*` intercepted locally | 不调用真实 backend/provider/bridge |
| M66-04 | PASS | 关闭 server、清理 screenshots/temp output、证明 no-dist 和 redline clean | `TEMP_RUN_DIR_EXISTS_AFTER_CLEANUP=False`; `DIST_TRACKED_HASH_UNCHANGED=yes`; M53 redline PASS | 不提交 screenshots 或 `.tmp` |
| M67-01 | PASS | 写 normal dist artifact taskbook | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M67_ADMINPANEL_NORMAL_DIST_ARTIFACT_TASKBOOK_20260622.md` | 不执行 build |
| M67-02 | PASS | 定义 M68 normal typed build command、preflight、artifact diff review 和 paths-only scan | M67 sections 2-6 | 不使用 `build:no-type-check` |
| M67-03 | PASS | 定义 M68 stage allowlist、rollback、stop conditions | M67 sections 7-9 | 不 stage config/source/package/private/runtime paths |
| M67-04 | PASS | 更新 tracker：M67/S88/Q49 PASS，M68 actual build deferred | Progress `66.7 / 68` | 不修改 `AdminPanel-Vue/dist/**` |
| M68-01 | PASS | 当前轮授权后执行 preflight 并确认 worktree/source/package/temp 状态 | branch clean；temp dirs absent；dist pre hash `2f52f0...cb77f3` | 不启动 server |
| M68-02 | PASS | 运行 normal typed build | `npm run build --prefix AdminPanel-Vue`; `vue-tsc && vite build`; exit `0` | 不使用 `build:no-type-check` |
| M68-03 | PASS | 审查 dist artifact diff 和 paths-only risk scan | indexed dist count `255`; cached diff `73`; path-risk only `OAuthAuthCenter` false positives | 不读取 private content |
| M68-04 | PASS | 写 M68 receipt 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M68_ADMINPANEL_NORMAL_DIST_ARTIFACT_RECEIPT_20260622.md`; Progress `67.7 / 69` | 不修改 source/package/config |
| M69-01 | PASS | 执行 post-dist static smoke preflight | dist hash `66b634...e99`; temp dir absent；related paths clean | 不 build、不改 dist |
| M69-02 | PASS | 本地 static server 读取 `AdminPanel-Vue/dist` 并跑 desktop/mobile browser checks | `M69_POST_DIST_STATIC_SMOKE_PASS=yes`; all browser checks yes | 不启动 production server |
| M69-03 | PASS | 清理 screenshots/temp output 并证明 dist hash unchanged | `TEMP_RUN_DIR_EXISTS_AFTER_CLEANUP=False`; dist hash unchanged | 不提交 screenshots 或 `.tmp` |
| M70-01 | PASS | 写 AdminPanel artifact lane closeout decision | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M70_ADMINPANEL_ARTIFACT_LANE_CLOSEOUT_DECISION_20260622.md` | 不打开 upstream PR |
| M70-02 | PASS | 记录 completed evidence chain 和 remaining deferred work | M70 sections 2 and 5 | 不把 deferred 当 PASS |
| M70-03 | PASS | 更新 tracker：M69/S90/Q51 与 M70/S91/Q52 PASS | Progress `69.7 / 71` | 不修改 runtime/env/private paths |
| M71-01 | PASS | 读取 M45/M46/M68/M69/M70/M32/M33/M34/M38 证据并确认文件存在 | preflight evidence paths all FOUND | 不重新跑 env-mutating drill、不启动 server、不读取 private |
| M71-02 | PASS | 写 aggregate Jenn fork local route review，一张表核对 AgentOverrides、AdminPanel closeout、AI Image、Codex/Memory、PhotoStudio、LocalState/private、upstream PR | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M71_AGGREGATE_JENN_FORK_LOCAL_ROUTE_REVIEW_20260622.md` | 不把 package-layer PASS 当 runtime enablement |
| M71-03 | PASS | 明确 route decision values 和 next recommended gate | `M71_RESULT=PASS_AGGREGATE_JENN_FORK_LOCAL_ROUTE_REVIEW`; `NEXT_RECOMMENDED_GATE=M72_NEXT_RUNTIME_LANE_DECISION_OR_DEFERRED_DOMAIN_CLOSEOUT` | 不自动启用 M72 或后续 runtime/env/frontend/provider/bridge |
| M71-04 | PASS | 更新 tracker：M71/S92/Q53 PASS | Progress `70.7 / 72` | 不修改 env、dist、runtime、LocalState/private、upstream |
| M72-01 | PASS | 读取 M71 matrix 和 M32/M33/M34/M46 candidate boundaries | M72 inputs table | 不重新跑 provider/bridge/private/runtime validation |
| M72-02 | PASS | 比较“全部继续 deferred”与“只选一个窄 taskbook” | M72 decision options table | 不打开 upstream PR，不把 taskbook 选择当 runtime 授权 |
| M72-03 | PASS | 选择 AI Image no-provider runtime registration taskbook 作为 M73 候选 | `M72_SELECTED_NEXT_TASKBOOK=M73_AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_TASKBOOK` | 不写 M73 taskbook、不启 runtime、不写 env、不调用 provider |
| M72-04 | PASS | 更新 tracker：M72/S93/Q54 PASS | Progress `71.7 / 73` | 不修改 env、dist、runtime、LocalState/private、upstream |
| M73-01 | PASS | 读取 M72/M32/M23/M24 证据并复审当前 AI Image 可复用资产 | external package + no-provider harness + focused tests reviewed; no blockers | 不把旧分支大 diff 或 AdminPanel dist 当来源 |
| M73-02 | PASS | 写 AI Image no-provider runtime registration taskbook | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M73_AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_TASKBOOK_20260622.md` | 不实现 registry、不修改 runtime、不改 external package |
| M73-03 | PASS | 定义 M74 default-off manifest/metadata registry allowed files、env contract、validation、rollback、stop conditions | M73 sections 5-12 | 不写真实 `config.env`，不启 `ENABLE_AI_IMAGE_REAL_EXECUTION` |
| M73-04 | PASS | 更新 tracker：M73/S94/Q55 PASS | Progress `72.7 / 74` | 不调用 provider、不生成图片、不读取 LocalState/private |
| M74-01 | PASS | 复读 M73 allowed files 和当前 AI Image persistent package/harness 证据 | M73 taskbook + M32 harness rerun context reviewed | 不修改 `server.js`、AI Image execution route、external package、真实 env |
| M74-02 | PASS | 实现 default-off AI Image adapter metadata registry | `modules/aiImageAdapterRegistry.js` | 不 require/execute adapter entry，不读取 provider secret/token，不注册 executable runtime |
| M74-03 | PASS | 新增 focused registry tests 和 no-provider runtime registration gate harness | `tests/ai-image-adapter-registry.test.js`；`scripts/run-ai-image-no-provider-runtime-registration-gate-harness.js` | 不启动 server，不写 image/output，不读 LocalState/private |
| M74-04 | PASS | 运行 M74 validation 和 M32 persistent package harness rerun | `6 pass / 0 fail`; M74 harness PASS; M32 package harness PASS | 不把 metadata discovery 当 provider runtime |
| M74-05 | PASS | 写 M74 receipt 并更新 tracker：M74/S95/Q56 PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M74_AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_RECEIPT_20260622.md`; Progress `73.7 / 75` | 不打开 upstream PR、不写真实 `config.env` |
| M75-01 | PASS | 复审 M74 metadata registry receipt、M73 taskbook 和 AI Image deferred runtime边界 | M75 inputs table | 不把 metadata-only proof 当 route/provider runtime readiness |
| M75-02 | PASS | 比较 metadata-only closeout vs default-off diagnostic route taskbook | M75 decision options table | 不直接实现 route、不写 env |
| M75-03 | PASS | 选择 M76 default-off diagnostic route taskbook 作为下一门 | `M75_DECISION=WRITE_M76_DEFAULT_OFF_DIAGNOSTIC_ROUTE_TASKBOOK` | 不启 provider、不生成图片、不读取 private |
| M75-04 | PASS | 写 M75 decision doc 并更新 tracker：M75/S96/Q57 PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M75_AI_IMAGE_REGISTRY_REVIEW_OR_CLOSEOUT_DECISION_20260622.md`; Progress `74.7 / 76` | 不打开 upstream PR、不接 production route |
| M76-01 | PASS | 复审 M75 decision、M74 registry、现有 AI Image execution route 风险边界 | M76 sections 1-5 | 不复用 execution route 作为 metadata diagnostics route |
| M76-02 | PASS | 定义未来 diagnostic route URL、default-off env、auth 边界和 metadata 来源 | M76 sections 2-5 | 不实现 route、不写真实 env |
| M76-03 | PASS | 定义允许显示字段、禁止字段、未来 M77 allowed files、validation、rollback、stop conditions | M76 sections 6-11 | 不显示 absolute path、secret、raw binding、prompt/image output、private content |
| M76-04 | PASS | 写 M76 taskbook 并更新 tracker：M76/S97/Q58 PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M76_AI_IMAGE_DEFAULT_OFF_DIAGNOSTIC_ROUTE_TASKBOOK_20260622.md`; Progress `75.7 / 77` | 不打开 upstream PR、不改 runtime |
| M77-01 | PASS | 复读 M76 allowed files/stop lines 并确认 worktree clean | M77 receipt sections 1-3 | 不修改 production router、execution route、frontend 或真实 env |
| M77-02 | PASS | 实现未挂载的 default-off diagnostic route factory | `routes/admin/aiImageAdapterDiagnostics.js` | 不接 `server.js`，不 require/execute adapter entry，不调用 provider |
| M77-03 | PASS | 新增 focused route tests 和 local harness | `tests/ai-image-adapter-diagnostic-route.test.js`; `scripts/run-ai-image-default-off-diagnostic-route-gate-harness.js` | 不启动 production server，不写 image/output，不读 private |
| M77-04 | PASS | 运行 M77 validation 与 M74/M32 protective reruns | tests `6 pass / 0 fail`; M77 harness PASS; M74/M32 harness PASS | 不把 route factory success 当 production mount/runtime proof |
| M77-05 | PASS | 写 M77 receipt 并更新 tracker：M77/S98/Q59 PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M77_AI_IMAGE_DEFAULT_OFF_DIAGNOSTIC_ROUTE_RECEIPT_20260622.md`; Progress `76.7 / 78` | 不打开 upstream PR、不写真实 `config.env` |
| M78-01 | PASS | 复读 M77 receipt、M76 taskbook 和 M74/M32 no-provider evidence | M78 inputs table | 不把 test-only factory 当 production-router proof |
| M78-02 | PASS | 比较保持 unmounted、写 production-router taskbook、直接挂载三种选项 | M78 decision options table | 不直接接 production router |
| M78-03 | PASS | 选择 M79 production-router integration taskbook 作为下一门 | `M78_DECISION=WRITE_M79_PRODUCTION_ROUTER_INTEGRATION_TASKBOOK` | 不写真实 env、不启 provider |
| M78-04 | PASS | 写 M78 decision doc 并更新 tracker：M78/S99/Q60 PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M78_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_DECISION_20260622.md`; Progress `77.7 / 79` | 不打开 upstream PR、不接 production route |
| M79-01 | PASS | 写 AI Image diagnostic route production-router integration taskbook | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M79_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_INTEGRATION_TASKBOOK_20260622.md` | 不直接实现 production router |
| M79-02 | PASS | 定义 M80 allowed files、mount strategy、admin-auth marker、default-off env、validation、rollback、stop conditions | M79 sections 2-8 | 不写真实 env、不启动 server |
| M79-03 | PASS | 更新 tracker：M79/S100/Q61 PASS | Progress later updated by M80 to `79.7 / 81` | 不把 taskbook 当 runtime proof |
| M80-01 | PASS | 实现 default-off diagnostic production-router mount helper | `modules/aiImageAdapterDiagnosticRuntimeMount.js` | 不调用 provider、不执行 adapter entry |
| M80-02 | PASS | 将 helper 接入 `routes/adminPanelRoutes.js` 并保留 `server.js` unchanged | `routes/adminPanelRoutes.js`; `SERVER_JS_HASH_UNCHANGED=yes` | 不修改 `server.js` |
| M80-03 | PASS | 新增 focused runtime mount tests 和 scoped production-router harness | `tests/ai-image-adapter-diagnostic-runtime-mount.test.js`; `scripts/run-ai-image-diagnostic-production-router-integration-scoped-env-harness.js` | 不启动 production server |
| M80-04 | PASS | 运行 syntax/tests/M80 harness 和 M77/M74/M32 protective reruns | tests `11 pass / 0 fail`; M80 harness PASS; protective harnesses PASS | 不把 diagnostic route 当 executable runtime registration |
| M80-05 | PASS | 写 M80 receipt 并更新 tracker：M80/S101/Q62 PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M80_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_INTEGRATION_RECEIPT_20260622.md`; Progress `79.7 / 81` | 不打开 upstream PR、不写真实 `config.env` |
| M81-01 | PASS | 复读 M80 receipt 与当前 AI Image no-provider/metadata-only 边界 | M81 inputs table | 不把 route 200 当 provider runtime |
| M81-02 | PASS | 比较 stop-at-M80、select M82 candidate、write config now 三种选项 | M81 decision options table | 不在 M81 写真实 `config.env` |
| M81-03 | PASS | 选择 M82 三键 diagnostic metadata real-config apply/rollback drill 候选 | `M81_DECISION=SELECT_M82_AI_IMAGE_DIAGNOSTIC_METADATA_REAL_CONFIG_APPLY_ROLLBACK_DRILL` | 不启 `ENABLE_AI_IMAGE_REAL_EXECUTION` |
| M81-04 | PASS | 写 M81 decision doc 并更新 tracker：M81/S102/Q63 PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M81_AI_IMAGE_DIAGNOSTIC_ROUTE_REAL_CONFIG_UNLOCK_DECISION_20260622.md`; Progress `80.7 / 82` | 不打开 upstream PR、不提交 `config.env` |
| M82-01 | PASS | 用户当前轮授权写真实 `config.env`；声明最终状态 `OPTION_B_REMOVED_AFTER_ROLLBACK` | M82 receipt section 1 | 只授权 AI Image diagnostic metadata 三键 |
| M82-02 | PASS | 新增 M82 real-config apply/rollback harness | `scripts/run-ai-image-diagnostic-real-config-apply-rollback-drill-harness.js`; `node --check` PASS | 不打印 config 值，不启动 production server |
| M82-03 | PASS | transient 写入三键并验证 diagnostic route | after apply key counts `1/1/1`; route `200`; unauthorized `403`; real execution `409`; metadata `1`; executable `0` | 不写 `ENABLE_AI_IMAGE_REAL_EXECUTION`，不发 provider call |
| M82-04 | PASS | rollback 删除三键并恢复最终 hash | rollback key counts `0/0/0`; route `404`; final hash restored to initial hash | 最终不保留 AI Image diagnostic runtime-on |
| M82-05 | PASS | 写 M82 receipt 并更新 tracker：M82/S103/Q64 PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M82_AI_IMAGE_DIAGNOSTIC_REAL_CONFIG_APPLY_ROLLBACK_DRILL_RECEIPT_20260622.md`; Progress `81.7 / 83` | 不提交 `config.env`、不打开 upstream PR |

## 6. 领域路线概览

这些领域属于完整路线。Agent 已从“后续领域”提升为当前正式路线；其他领域仍保持待展开状态。

| 领域 | 未来 contract | External Runtime / State 目标 | 第一件必须做的事 |
| --- | --- | --- | --- |
| Agent | `VCP_AGENT_ALLOWED_ROOTS`、`VCP_AGENT_DIRS`、`VCP_AGENT_OVERRIDE_DIRS` | Jenn Agent 和 AgentOverrides | M41 已按授权在真实 `config.env` 启用 `AgentOverrides` only；M42 local read smoke PASS；M43 rollback drill PASS；M44 Admin write guard PASS；M45 aggregate review PASS；`VCP_AGENT_DIRS` additive 暂不启用；core fallback 保留。 |
| LocalState | `VCP_LOCAL_STATE_DIR` | 经批准的私有记忆、项目数据、本地配置 | 定义默认排除项和 `.agent_board/**` 人工 gate。 |
| AdminPanel | Admin extension manifest / route registration | Jenn 页面、API、菜单项 | M31 persistent package gate PASS；M47 default-off runtime registration taskbook PASS；M48 backend default-off registry gate PASS；M49 shadow rollback drill PASS；M50 scoped process.env local smoke PASS；M51 taskbook PASS；M52 backend production-router integration PASS；M53 real-config unlock decision PASS；M54 real-config backend-readonly apply + rollback PASS；M55 production-server smoke / frontend route-nav decision PASS；M56 production-server smoke taskbook PASS；M57 actual production-server smoke PASS；M58 frontend route/nav taskbook PASS；M59 frontend static implementation PASS；M60 build/dist decision PASS；M61 no-build validation PASS；M62 build/lint path decision PASS；M63 temp outDir dry-build authorization taskbook PASS；M64 temp outDir dry build PASS；M65 browser visual smoke taskbook PASS；M66 browser visual smoke PASS；M67 normal dist artifact taskbook PASS；M68 normal dist artifact build PASS；M69 post-dist static smoke PASS；M70 artifact lane closeout PASS；current AdminPanel lane closed。 |
| AI Image | Generic adapter contract、default-off gates | Jenn fixtures、bindings、provider-specific adapters | M32 persistent package gate PASS；M46 keeps provider runtime、真实图片生成、executable adapter registration deferred；M72 selected M73 taskbook；M73 taskbook PASS；M74 metadata-only registry PASS with scoped metadata `1`、executable `0`、provider/image/output/bridge/LocalState `0`；M75 selected M76；M76 taskbook PASS；M77 test-only diagnostic route factory PASS；M78 selected M79；M79 taskbook PASS；M80 default-off production-router integration PASS；M81 selected M82 real-config apply/rollback decision candidate；M82 transient real config three-key apply PASS and rollback final hash restored；最终仍未保留真实 AI Image env、不启 provider、不生成图片、不注册 executable adapter runtime。 |
| Codex/Memory | Generic bridge interface 或不改 core | CodexMemoryBridge 和 Jenn memory tools | M33 persistent no-live-write package gate PASS；M46 keeps runtime bridge registration、live writes、private memory reads deferred。 |
| PhotoStudio | Generic plugin loading ability | PhotoStudio plugins、data、task templates | M34 persistent source package gate PASS；M46 keeps runtime package registration、真实数据根、external sync/publish/write deferred。 |
| Governance Docs | 最少 clean-core acceptance notes | 详细 migration ledger 和 checksums | 决定哪些证据放在 clean core 外部。 |
| Local Stability | Full-local implementation matrix + accelerated closeout + optional calendar soak + real-config runtime-on/unlock gates | same-day multi-round local validation receipt；future 7-day / 3-cycle upstream-readiness soak if required；redacted real `config.env` gate | M38 accelerated local closeout PASS；M41 applied AgentOverrides-only real config and M39/M40 rerun PASS；M42 local read smoke PASS；M43 rollback drill PASS；M44 Admin write guard PASS；M45 aggregate review PASS；M46 decision PASS；M47 AdminPanel taskbook PASS；M48 AdminPanel backend registry gate PASS；M49 shadow rollback drill PASS；M50 scoped local smoke PASS；M51 taskbook PASS；M52 default-off backend production-router integration PASS；M53 AdminPanel real-config unlock decision PASS；M54 AdminPanel real-config backend-readonly apply + rollback PASS；M55 AdminPanel production smoke/frontend decision PASS；M56 production-server smoke taskbook PASS；M57 production-server smoke PASS；M58 frontend route/nav taskbook PASS；M59 frontend static implementation PASS；M60 build/dist decision PASS；M61 no-build validation PASS；M62 build/lint path decision PASS；M63 temp outDir dry-build authorization taskbook PASS；M64 temp outDir dry build PASS；M65 browser visual smoke taskbook PASS；M66 browser visual smoke PASS；M67 normal dist artifact taskbook PASS；M68 normal dist artifact build PASS；M69 post-dist static smoke PASS；M70 AdminPanel closeout PASS；M71 aggregate local route review PASS；M72 next runtime lane decision PASS；M73 AI Image taskbook PASS；M74 AI Image metadata-only registry PASS；M75 AI Image route/closeout decision PASS；M76 AI Image diagnostic route taskbook PASS；M77 AI Image diagnostic route factory PASS；M78 AI Image production-router decision PASS；M79 AI Image production-router taskbook PASS；M80 AI Image default-off production-router integration PASS；M81 AI Image real-config unlock decision PASS；M82 AI Image diagnostic real-config apply/rollback drill PASS；calendar soak mid/final cycles deferred optional；upstream PR still deferred。 |

## 7. 打开 Upstream PR 前的验收门

打开新的 `lioensky/VCPToolBox` upstream PR 前，必须满足：

2026-06-21 gate update:

- upstream PR 只有在整个计划已经在 Jenn fork/local 路线实现，并且稳定运转后才有意义开启。
- M29 Jenn fork maintenance closeout 是维护路线收口，不等于完整本地实现，也不等于稳定运转证明。
- M38 已完成当前 Jenn fork 本地 package-layer accelerated closeout；这满足本地速战速决收口，不等于 upstream PR ready。
- 7-day / 3-cycle calendar soak 已改为 future upstream-readiness optional evidence，不阻塞本地 closeout。
- M8/S25 与 M28 仍保持 DEFERRED；打开 upstream PR 需要未来当前轮明确 upstream PR 授权。

| Gate | 必需证据 | Status |
| --- | --- | --- |
| Jenn 内部 review 完成 | PR #272 有明确 ready / continue 决策，且已合并到 Jenn clean base | PASS |
| Phase 1 validation 稳定 | 在 final head `a4225aca` 上通过 syntax checks 和 6-test command：`65 pass / 0 fail` | PASS |
| Phase 边界清楚 | Phase 2 copy-first/checksum/denylist 不混进 PR #272 | PASS |
| 没有 secret/runtime 文件 | diff 不包含 env、config、state、cache、log、image、auth material | PASS for PR #272 |
| 验收窗口定义 | M30 taskbook 定义 full-local implementation、accelerated local closeout、optional calendar soak、domain mini-gates、reset rules、receipt template | PASS |
| AdminPanel persistent package gate | M31 receipt + external commit `eff66b2979e319494e49bbeec9ccb652afcd57ee`；package risk `0`；runtime registration reference count `0` | PASS |
| AI Image provider-adapter package gate | M32 receipt + external commit `5edb89051291137859100cfc915349b9921f84cd`；package risk `0`；provider/image/output/bridge/LocalState counters all `0`；runtime registration reference count `0` | PASS |
| AI Image metadata-only registry gate | M74 receipt；scoped metadata count `1`；executable adapter count `0`；provider/image/output/bridge/LocalState counters all `0`；real env/server/provider/image/private untouched | PASS；does not prove provider runtime readiness |
| AI Image diagnostic route factory gate | M77 receipt；default-off `404`、scoped local route `200`、unauthorized `403`、response absolute path/secret field count `0`；provider/image/output/bridge/LocalState counters all `0` | PASS_LOCAL_FACTORY；not production-mounted |
| AI Image production-router decision gate | M78 decision；route factory remains unmounted now；M79 taskbook selected before any production-router implementation | PASS_DECISION_ONLY；not production-mounted |
| AI Image production-router integration gate | M80 receipt；`routes/adminPanelRoutes.js` default-off helper integration；default-off/rollback `404`、scoped `200`、unauthorized `403`、real execution `409`；provider/image/output/bridge/LocalState counters all `0` | PASS_DEFAULT_OFF；real config and provider runtime still deferred |
| AI Image real-config unlock decision gate | M81 decision；future M82 diagnostic metadata three-key apply/rollback drill selected; M81 does not write real `config.env` | PASS_DECISION_ONLY；real config write still deferred pending explicit authorization |
| AI Image real-config apply/rollback drill | M82 receipt；authorized transient three-key real `config.env` write; after apply route `200`; unauthorized `403`; real execution `409`; metadata `1`; executable/provider/image/bridge/LocalState `0`; rollback route `404`; final hash restored | PASS_ROLLBACK_PROOF；final config does not retain AI Image diagnostic keys |
| Codex/Memory no-live-write package gate | M33 receipt + external commit `320cf17ec3204179a150161fa87429e1fef29cab`；package risk `0`；bridge/private-memory/LocalState/external/provider counters all `0`；runtime registration reference count `0` | PASS |
| PhotoStudio source package gate | M34 receipt + external commit `3a63904e753aa8b8869f588fc0b8fc862354e123`；package risk `0`；project-data/external/provider/bridge/LocalState counters all `0`；runtime registration reference count `0` | PASS |
| Aggregate full-local matrix review | M35 receipt；M31-M34 package harnesses re-run PASS；current aggregate manifest `9e01af36f0ecd99c27294addc99d44d6592a5883fb5b41b2e2ee585f721809fd` | PASS |
| Optional calendar-soak entry | M36 receipt；calendar cycle receipt shape、required evidence、reset conditions、stop boundaries defined | PASS；future upstream-readiness evidence only |
| Calendar-soak opening evidence | M37 receipt；`WINDOW_START=yes`; M31-M34 harnesses PASS；current aggregate manifest `9e01af36f0ecd99c27294addc99d44d6592a5883fb5b41b2e2ee585f721809fd` | PASS；mid/final cycles deferred optional |
| Accelerated local closeout | M38 receipt；two fresh same-day revalidation rounds PASS；checksum unchanged；target risk `0`；runtime refs `0`; no-live-write/default-off counters `0` | PASS |
| Aggregate Jenn fork local route review | M71 receipt；AgentOverrides override-only runtime-on、AdminPanel artifact closeout、AI Image/Codex-Memory/PhotoStudio package-layer deferred runtime lanes、LocalState/private BLOCK、upstream PR DEFERRED all reviewed in one matrix | PASS；local route review only |
| 全计划本地实现 | 当前 Jenn fork local package-layer route has implementation receipts, validation, rollback statements, and deferred runtime-on boundaries clearly named | PASS_LOCAL_PACKAGE_LAYER；runtime-on still deferred |
| 稳定运转证据 | 不能只用 taskbook、fixture shadow 或 discovery success；M38 提供同日本地多轮复验，calendar soak 作为 future optional evidence | PASS_LOCAL_ACCELERATED；calendar soak deferred optional |
| Upstream 目标决策 | M8 workflow / rebase gate ready；latest upstream/main `f8d45479`；按用户决定先跳过打开 upstream PR，未来必须 current-turn 明确授权 | DEFERRED |

## 8. 回滚说明

当前 Phase 1 工作的回滚方式：

- 如果后续需要回滚 Phase 1，revert merge commit `86c69e8d` 或回退 Jenn clean base。
- 通过不设置 `VCP_PLUGIN_DIRS`、`VCP_PLUGIN_ALLOWED_ROOTS`、`VCP_EXTERNAL_PLUGIN_ALLOWLIST` 来禁用 external runtime。
- PR #272 不会删除 core fallback。

未来 Phase 2+ 工作的回滚原则：

- copy-first、checksum、shadow validation、rollback drill 完成前，不要删除或 untrack core 副本。
- 每个迁移领域都必须先在任务书中写明 rollback，再开始实现。

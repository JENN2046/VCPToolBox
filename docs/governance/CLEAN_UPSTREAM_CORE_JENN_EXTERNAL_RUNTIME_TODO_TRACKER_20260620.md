# Clean Core + Jenn External Runtime TODO 进度表

Progress: [#########-] 94% (38.7 / 41 global milestone units; scope expanded by M40 PASS)

Last updated: 2026-06-21

当前里程碑：Agent real-config unlock decision gate（M40 PASS；AgentOverrides-only candidate selected）

状态来源：

- 计划文档：`docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_ACCEPTANCE_PLAN_20260618.md`
- 当前 Jenn fork 内部 review PR：`JENN2046/VCPToolBox#272`（已合并）
- Clean core review base：`codex/upstream-main-clean-base`，merge commit `86c69e8d`
- Phase 1 实现分支：`codex/phase1-clean-core-plugin-contract`

## 1. 如何更新这份进度表

这份文件是 Clean Upstream Core + Jenn External Runtime 路线的当前进度源。

当前采用双层结构：

- 长期路线图：正式 milestone，从原始 M0-M8 到 Jenn fork maintenance overlay M9-M40。
- 短期执行记录：实际 sprint ledger，记录 S1-S48 与 S50-S61 已完成工作；S49 upstream PR gate deferred。

更新规则：

1. 完成任务后，把 `[ ]` 改成 `[x]`。
2. 只有已经有证据时，才把 `Status` 改成 `PASS`。
3. 证据尽量短：PR、commit、测试命令、checksum、review 结论即可。
4. 每完成一步，都重新计算顶部 `Progress`。
5. 每次更新进度，都同步更新 `Last updated`。
6. 新工作开始前，必须先在本 tracker 的长期路线或详细待办里有对应 TODO；若现实变化导致计划调整，先补 `PLAN_CHANGE` 说明再执行。

进度计算规则：

- 全局 Progress 覆盖 M0-M40 全路线，只保留这一种进度口径。
- 每个 milestone 记 1 个 global milestone unit；M0-M40 合计 41 units。
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
- M39 使用真实 `config.env` 做 redacted runtime-on local gate；当前 BLOCK，因为真实配置没有启用任何已实现 runtime lane；不代表代码/package 层回退。
- M40 只完成 Agent real-config unlock decision gate；选择 `AgentOverrides` 子车道作为最小候选，不修改 `config.env`，不启用 `VCP_AGENT_DIRS` additive lane，不启用 provider/bridge/LocalState/private。

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

M0-M8 是原始 acceptance plan 阶段；M9-M40 是当前 Jenn fork 长期维护与本地稳定验收路线。两者共同计入顶部全局 Progress；原始 100 分仅作为历史验收拆分背景，不再单独维护进度。

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
| [ ] | M39 | 0 | Real config-env runtime-on local gate | BLOCK | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M39_REAL_CONFIG_ENV_RUNTIME_ON_LOCAL_GATE_RECEIPT_20260621.md`；real env file is `config.env`；values not printed；file not modified；all external runtime env vars unset；implemented runtime lane count `0`；server/plugin/provider/bridge/live-write counters all `0`；unblock requires explicit config decision。 |
| [x] | M40 | 0 | Agent real-config unlock decision gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M40_AGENT_REAL_CONFIG_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`；initial all-Agent candidate found `additive_duplicate_core_agent:7`，therefore narrowed to `AgentOverrides` only；dry-run PASS；`config.env` not modified；provider/bridge/LocalState/private remain closed。 |

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
M39 BLOCK：0 / 1 unit（新增真实 config-env runtime-on gate；真实配置当前保持 runtime-off）
M40 PASS：1.0 / 1 unit（AgentOverrides-only unlock decision；不修改真实 config）
Global Progress：38.7 / 41 = 94.39%，顶部显示保守为 94%
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
| [ ] | S60 | Runtime-on / M39 | 0 | Real config-env runtime-on local gate | BLOCK | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M39_REAL_CONFIG_ENV_RUNTIME_ON_LOCAL_GATE_RECEIPT_20260621.md`；`config.env` exists and values were not printed/modified；all implemented runtime env vars unset；gate blocked because real config keeps runtime lanes off。 |
| [x] | S61 | Agent / M40 | 0 | Agent real-config unlock decision gate | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M40_AGENT_REAL_CONFIG_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`；dry-run selected `AgentOverrides` only；`VCP_AGENT_DIRS` additive remains off due duplicate core ids；provider/bridge/LocalState/private closed；`config.env` not modified。 |

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

M19-M40 完成规则：

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
M39：real config-env runtime-on local gate BLOCK；真实 `config.env` 没有启用任何已实现 runtime lane；不修改 env，不打印 secret，不启动 server/provider/bridge。
M40：Agent real-config unlock decision gate PASS；只选择 `AgentOverrides` 子车道作为未来最小 config 候选；`VCP_AGENT_DIRS` additive 因 duplicate core ids 暂不启用；不修改真实 env。
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
| AdminPanel 分域验收 | M21-M22 / S42-S43；M31 / S52 | extension manifest taskbook、fixture/build shadow、persistent package gate、default-off route/API gate | M21-M22 PASS；M31 persistent package PASS；不注册真实 route，不 production deploy。 |
| AI Image 分域验收 | M23-M24 / S44-S45；M32 / S53 | generic adapter taskbook、provider-off fixture、no-provider shadow validation、persistent provider-adapter package gate | M23-M24 PASS；M32 persistent package PASS；no-provider only；不写 token，不发 provider call，不生成真实图片，不注册 runtime。 |
| Codex/Memory 分域验收 | M25 / S46；M33 / S54 | bridge taskbook、manifest/path-only scan、no-live-write validation design、persistent bridge package gate | M25 PASS；M33 persistent package PASS；不读取 private memory，不 bridge 外写，不启用 runtime。 |
| PhotoStudio 分域验收 | M26 / S47；M34 / S55 | taskbook、data exclusion、copy-first gates、no-auto-write rules、persistent source package gate | M26 PASS；M34 persistent package PASS；项目数据留 LocalState/private，不启用 runtime。 |
| Governance ledger | M27 / S48 | receipts/checksums/deferred/BLOCK/rollback 总账 | M27 PASS；docs-only。 |
| Jenn fork maintenance final closeout | M29 / S50 | active/deferred/block 总结、最终风险、下一周期路线 | M29 PASS；Jenn fork maintenance route closed；全局仍非 100%，upstream deferred。 |
| Local stability gate | M30 / S51；M38 / S59 | 定义并执行 accelerated local stability closeout；7-day calendar soak 作为 future upstream-readiness evidence | M38 PASS；local package-layer closeout passed；calendar soak deferred optional。 |
| AdminPanel persistent package | M31 / S52 | persistent external AdminExtensions skeleton、manifest/checksum、paths-only scan、no-runtime validation | M31 PASS；runtime registration and AdminPanel build remain deferred。 |
| AI Image persistent package | M32 / S53 | persistent external AIImageAdapters skeleton、manifest/checksum、paths-only scan、no-provider validation | M32 PASS；provider runtime, image generation, and adapter registration remain deferred。 |
| Codex/Memory persistent package | M33 / S54 | persistent external MemoryBridges skeleton、manifest/checksum、paths-only scan、no-live-write validation | M33 PASS；runtime bridge registration, live writes, and private memory reads remain deferred。 |
| PhotoStudio persistent package | M34 / S55 | persistent external PhotoStudioPackages skeleton、manifest/checksum、paths-only scan、no-auto-write validation | M34 PASS；runtime package registration, real data roots, and external sync/publish/write remain deferred。 |
| Aggregate full-local matrix review | M35 / S56 | re-run M31-M34 harnesses、核对 current aggregate checksum、列出 runtime deferred items | M35 PASS；package layer consistent。 |
| Optional calendar-soak entry | M36 / S57 | define future calendar cycle receipt shape、required evidence、reset conditions、stop boundaries | M36 PASS；future upstream-readiness evidence only after M38。 |
| Calendar-soak opening evidence | M37 / S58 | run opening validation、record reset checklist | M37 PASS；mid/final cycles deferred optional；not local blocker。 |
| Accelerated local closeout | M38 / S59 | run two same-day revalidation rounds、核对 checksum/env/no-live-write/runtime-off boundaries | M38 PASS；local package-layer closeout complete；runtime-on and upstream PR still deferred。 |
| Real config-env runtime-on gate | M39 / S60 | load real `config.env` in redacted harness、verify implemented runtime lanes without server/provider/bridge/live write | BLOCK；real config has no implemented external runtime lane enabled。 |
| Agent real-config unlock decision gate | M40 / S61 | dry-run candidate env overlay for Agent-only unlock without modifying `config.env` | PASS；selected `AgentOverrides` only；provider/bridge/LocalState/private remain closed。 |

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
| Q21 | M39/S60 | BLOCK | Runtime-on | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M39_REAL_CONFIG_ENV_RUNTIME_ON_LOCAL_GATE_RECEIPT_20260621.md`；real `config.env` redacted gate ran and blocked because no implemented external runtime lane is enabled。 |
| Q22 | M40/S61 | PASS | Agent | `CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M40_AGENT_REAL_CONFIG_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`；selected `AgentOverrides` only as future real-config candidate；no config edit applied。 |

### 5.5 M19-M40 Specific Step Plan

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
| M39-04 | PASS | 写 M39 receipt 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M39_REAL_CONFIG_ENV_RUNTIME_ON_LOCAL_GATE_RECEIPT_20260621.md`; Progress `37.7 / 40` | 不自动修改真实 env；后续解除 BLOCK 需要单独配置决策 |
| M40-01 | PASS | 新增 Agent real-config unlock decision dry-run harness | `scripts/run-agent-real-config-unlock-decision-gate-harness.js` | 不修改 `config.env`，不输出 env 值 |
| M40-02 | PLAN_CHANGE | 初始 all-Agent candidate 触发 additive duplicate | `additive_duplicate_core_agent:7`; skipped additive files `7` | 不强行开启 `VCP_AGENT_DIRS` |
| M40-03 | PASS | 收窄到 `AgentOverrides` only 候选 | `CANDIDATE_UNLOCK_LANE=agent-overrides`; `CANDIDATE_AGENT_ADDITIVE_ENABLED=no` | 不启用 provider/bridge/LocalState/private |
| M40-04 | PASS | 运行 dry-run 复验 | `AGENT_REAL_CONFIG_UNLOCK_DECISION_GATE_PASS`; override files `2`; diagnostics `none`; path risk `0` | 不读取 Agent prompt 正文，不启动 server |
| M40-05 | PASS | 写 M40 receipt 并更新 tracker | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M40_AGENT_REAL_CONFIG_UNLOCK_DECISION_GATE_RECEIPT_20260621.md`; Progress `38.7 / 41` | 不把 M39 改成 PASS；后续真实 env 修改仍需单独授权 |

## 6. 领域路线概览

这些领域属于完整路线。Agent 已从“后续领域”提升为当前正式路线；其他领域仍保持待展开状态。

| 领域 | 未来 contract | External Runtime / State 目标 | 第一件必须做的事 |
| --- | --- | --- | --- |
| Agent | `VCP_AGENT_ALLOWED_ROOTS`、`VCP_AGENT_DIRS`、`VCP_AGENT_OVERRIDE_DIRS` | Jenn Agent 和 AgentOverrides | 正式路线 M9-M18 已 closeout；M40 选择 `AgentOverrides` only 作为未来最小真实 config 候选；`VCP_AGENT_DIRS` additive 暂不启用；真实 env 仍未修改。 |
| LocalState | `VCP_LOCAL_STATE_DIR` | 经批准的私有记忆、项目数据、本地配置 | 定义默认排除项和 `.agent_board/**` 人工 gate。 |
| AdminPanel | Admin extension manifest / route registration | Jenn 页面、API、菜单项 | M31 persistent package gate PASS；future runtime registration remains separate and default-off。 |
| AI Image | Generic adapter contract、default-off gates | Jenn fixtures、bindings、provider-specific adapters | M32 persistent package gate PASS；provider runtime、真实图片生成、adapter registration 仍 deferred。 |
| Codex/Memory | Generic bridge interface 或不改 core | CodexMemoryBridge 和 Jenn memory tools | M33 persistent no-live-write package gate PASS；runtime bridge registration、live writes、private memory reads 仍 deferred。 |
| PhotoStudio | Generic plugin loading ability | PhotoStudio plugins、data、task templates | M34 persistent source package gate PASS；runtime package registration、真实数据根、external sync/publish/write 仍 deferred。 |
| Governance Docs | 最少 clean-core acceptance notes | 详细 migration ledger 和 checksums | 决定哪些证据放在 clean core 外部。 |
| Local Stability | Full-local implementation matrix + accelerated closeout + optional calendar soak + real-config runtime-on/unlock gates | same-day multi-round local validation receipt；future 7-day / 3-cycle upstream-readiness soak if required；redacted real `config.env` gate | M38 accelerated local closeout PASS；M39 real-config runtime-on gate BLOCK because implemented runtime lanes are unset；M40 selected AgentOverrides-only unlock candidate without config edit；calendar soak mid/final cycles deferred optional；upstream PR still deferred。 |

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
| Codex/Memory no-live-write package gate | M33 receipt + external commit `320cf17ec3204179a150161fa87429e1fef29cab`；package risk `0`；bridge/private-memory/LocalState/external/provider counters all `0`；runtime registration reference count `0` | PASS |
| PhotoStudio source package gate | M34 receipt + external commit `3a63904e753aa8b8869f588fc0b8fc862354e123`；package risk `0`；project-data/external/provider/bridge/LocalState counters all `0`；runtime registration reference count `0` | PASS |
| Aggregate full-local matrix review | M35 receipt；M31-M34 package harnesses re-run PASS；current aggregate manifest `9e01af36f0ecd99c27294addc99d44d6592a5883fb5b41b2e2ee585f721809fd` | PASS |
| Optional calendar-soak entry | M36 receipt；calendar cycle receipt shape、required evidence、reset conditions、stop boundaries defined | PASS；future upstream-readiness evidence only |
| Calendar-soak opening evidence | M37 receipt；`WINDOW_START=yes`; M31-M34 harnesses PASS；current aggregate manifest `9e01af36f0ecd99c27294addc99d44d6592a5883fb5b41b2e2ee585f721809fd` | PASS；mid/final cycles deferred optional |
| Accelerated local closeout | M38 receipt；two fresh same-day revalidation rounds PASS；checksum unchanged；target risk `0`；runtime refs `0`; no-live-write/default-off counters `0` | PASS |
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

# Clean Core + Jenn External Runtime TODO 进度表

Progress: [##########] 97% (97 / 100)

Last updated: 2026-06-21

当前里程碑：Jenn fork 内长期维护收口（M0 PASS；M8/S25 deferred）

状态来源：

- 计划文档：`docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_ACCEPTANCE_PLAN_20260618.md`
- 当前 Jenn fork 内部 review PR：`JENN2046/VCPToolBox#272`（已合并）
- Clean core review base：`codex/upstream-main-clean-base`，merge commit `86c69e8d`
- Phase 1 实现分支：`codex/phase1-clean-core-plugin-contract`

## 1. 如何更新这份进度表

这份文件是 Clean Upstream Core + Jenn External Runtime 路线的当前进度源。

更新规则：

1. 完成任务后，把 `[ ]` 改成 `[x]`。
2. 只有已经有证据时，才把 `Status` 改成 `PASS`。
3. 证据尽量短：PR、commit、测试命令、checksum、review 结论即可。
4. 每完成一步，都重新计算顶部 `Progress`。
5. 每次更新进度，都同步更新 `Last updated`。

进度计算规则：

- 全局总分是 100 分。
- 完整完成的 milestone 计入全部权重。
- 进行中的 milestone 只有在 `当前计分` 明确记录证据时，才可以计入部分分；优先用 sprint 小项计分。
- `DEFERRED` 不算完成进度。
- 不能因为“代码写了”就标完成；必须有验证或 review 证据。

硬边界：

- 不要把 Phase 2 copy-first、checksum、denylist、LocalState 工作误标成 PR #272 已完成。
- copy-first、checksum、shadow validation、rollback、人类确认完成前，不进入 stub / untrack / remove。
- 不要自动迁移或 checksum `.agent_board/**`。
- 不要把 Jenn 业务逻辑写回 clean core。
- 不要把 discovery 成功当成 runtime registration 成功。

## 2. 全局里程碑路线图

| 完成 | ID | 权重 | 里程碑 | Status | 证据 / 下一道门 |
| --- | --- | ---: | --- | --- | --- |
| [x] | M0 | 6 | 基线、分支、inventory、扫描、tracker 建立 | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M0_BASELINE_INVENTORY_SECRET_RISK_EVIDENCE_20260621.md`；upstream/origin refs、clean-core 创建记录、旧 fork inventory、paths-only secret-risk scan 已补齐；LocalState 仅存在性记录，不枚举。 |
| [x] | M1 | 12 | Clean Core Phase 1 plugin contract | PASS | PR #272 已合并到 Jenn clean base；merge commit `86c69e8d`；final head `a4225aca`；review threads 全部 resolved；6-test 复跑：`65 pass / 0 fail`。 |
| [x] | M2 | 12 | External Runtime / LocalState skeleton | PASS | S6 任务书、S7 denylist / `.gitignore` baseline、S8 LocalState / `.agent_board/**` gate、S9 manifest / checksum rules 已写；M3 copy-first 已单独完成，M8 workflow 已展开且 S25 deferred。 |
| [x] | M3 | 12 | `JennAIGentOrchestrator` copy-first 试点 | PASS | External package commit `b4f250e`；receipt `receipts/M3_JENN_AIGENT_ORCHESTRATOR_COPY_FIRST_RECEIPT_20260621.md`；paths-only scan clean；`MANIFEST_VERIFY_PASS count=4`；manifest identity `JennAIGentOrchestrator`。 |
| [x] | M4 | 10 | Shadow validation 和 rollback 演练 | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M4_SHADOW_VALIDATION_ROLLBACK_RECEIPT_20260621.md`；external discovery / registration gate tests `14+6+5 pass`；Jenn no-provider shadow harness PASS；rollback overlay PASS。 |
| [x] | M5 | 14 | Agent / LocalState / AdminPanel contracts | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M5_AGENT_LOCALSTATE_ADMIN_CONTRACTS_20260621.md`；定义 `VCP_AGENT_DIRS`、`VCP_AGENT_OVERRIDE_DIRS`、`VCP_LOCAL_STATE_DIR`、`VCP_ADMIN_EXTENSION_DIRS`；docs-only。 |
| [x] | M6 | 14 | AI Image / Codex-Memory / PhotoStudio 外置化 | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M6_AI_IMAGE_MEMORY_PHOTOSTUDIO_CONTRACTS_20260621.md`；定义 adapter / memory / PhotoStudio 外置边界；clean core 不放 private state；docs-only。 |
| [x] | M7 | 10 | Stub / untrack / remove 决策 | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M7_STUB_UNTRACK_REMOVE_DECISION_20260621.md`；决策完成：keep core fallback，不执行 delete/untrack/stub，不改 dispatch，不开 upstream PR。 |
| [ ] | M8 | 10 | Upstream PR 和长期 rebase workflow | PARTIAL | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M8_UPSTREAM_PR_REBASE_WORKFLOW_20260621.md`；workflow / rebase gate ready；upstream/main `f8d45479` 预检无重叠文件；按用户决定先跳过打开 upstream PR。 |

当前计分：

```text
M0 已完成：6 / 6
M1 已完成并内部合并：12 / 12
M2 已完成：12 / 12
M3 已完成：12 / 12
M4 已完成：10 / 10
M5 已完成：14 / 14
M6 已完成：14 / 14
M7 决策完成：10 / 10
M8 部分完成：7 / 10
全局总分：97 / 100
```

## 3. 当前 Sprint 清单

当前 sprint 已展开到 M8 upstream PR / 长期 rebase workflow。M8 可以完成 workflow / rebase gate，但不自动打开 upstream PR。

| 完成 | ID | 父项 | 权重 | 任务 | Status | 证据 |
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

## 4. 后续领域展开

这些领域属于完整路线，但不是当前 sprint 的实现工作。

| 领域 | 未来 contract | External Runtime / State 目标 | 第一件必须做的事 |
| --- | --- | --- | --- |
| Agent | `VCP_AGENT_DIRS`、`VCP_AGENT_OVERRIDE_DIRS` | Jenn Agent 和 AgentOverrides | 写 Agent externalization 任务书。 |
| LocalState | `VCP_LOCAL_STATE_DIR` | 经批准的私有记忆、项目数据、本地配置 | 定义默认排除项和 `.agent_board/**` 人工 gate。 |
| AdminPanel | Admin extension manifest / route registration | Jenn 页面、API、菜单项 | 设计 extension manifest 和 build validation。 |
| AI Image | Generic adapter contract、default-off gates | Jenn fixtures、bindings、provider-specific adapters | 定义 adapter interface，不把 trial/provider 常量写进 core。 |
| Codex/Memory | Generic bridge interface 或不改 core | CodexMemoryBridge 和 Jenn memory tools | 定义 manifest-only validation，不能读取私有 memory。 |
| PhotoStudio | Generic plugin loading ability | PhotoStudio plugins、data、task templates | 定义 no-auto-write 和 data exclusion rules。 |
| Governance Docs | 最少 clean-core acceptance notes | 详细 migration ledger 和 checksums | 决定哪些证据放在 clean core 外部。 |

## 5. 打开 Upstream PR 前的验收门

打开新的 `lioensky/VCPToolBox` upstream PR 前，必须满足：

| Gate | 必需证据 | Status |
| --- | --- | --- |
| Jenn 内部 review 完成 | PR #272 有明确 ready / continue 决策，且已合并到 Jenn clean base | PASS |
| Phase 1 validation 稳定 | 在 final head `a4225aca` 上通过 syntax checks 和 6-test command：`65 pass / 0 fail` | PASS |
| Phase 边界清楚 | Phase 2 copy-first/checksum/denylist 不混进 PR #272 | PASS |
| 没有 secret/runtime 文件 | diff 不包含 env、config、state、cache、log、image、auth material | PASS for PR #272 |
| Upstream 目标决策 | M8 workflow / rebase gate ready；latest upstream/main `f8d45479`；按用户决定先跳过打开 upstream PR | DEFERRED |

## 6. 回滚说明

当前 Phase 1 工作的回滚方式：

- 如果后续需要回滚 Phase 1，revert merge commit `86c69e8d` 或回退 Jenn clean base。
- 通过不设置 `VCP_PLUGIN_DIRS`、`VCP_PLUGIN_ALLOWED_ROOTS`、`VCP_EXTERNAL_PLUGIN_ALLOWLIST` 来禁用 external runtime。
- PR #272 不会删除 core fallback。

未来 Phase 2+ 工作的回滚原则：

- copy-first、checksum、shadow validation、rollback drill 完成前，不要删除或 untrack core 副本。
- 每个迁移领域都必须先在任务书中写明 rollback，再开始实现。

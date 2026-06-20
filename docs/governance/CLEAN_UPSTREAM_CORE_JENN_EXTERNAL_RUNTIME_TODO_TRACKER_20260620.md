# Clean Core + Jenn External Runtime TODO 进度表

Progress: [##--------] 18% (18 / 100)

Last updated: 2026-06-20

当前里程碑：M2 - 完整 denylist / LocalState / checksum 基础门禁

状态来源：

- 计划文档：`docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_ACCEPTANCE_PLAN_20260618.md`
- 当前 Jenn fork 内部 review PR：`JENN2046/VCPToolBox#272`
- Clean core review base：`codex/upstream-main-clean-base`
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
| [ ] | M0 | 6 | 基线、分支、inventory、扫描、tracker 建立 | PARTIAL | Clean base branch 和 tracker 已存在；还需要补齐 upstream remote 记录、clean-core 创建记录、旧 fork inventory、secret-risk scan 的明确证据。 |
| [x] | M1 | 12 | Clean Core Phase 1 plugin contract | PASS | PR #272 内部 review 已在 head `5030dee3` 得出 ready 结论；6-test 复跑：`63 pass / 0 fail`；无阻塞发现。 |
| [ ] | M2 | 12 | External Runtime / LocalState skeleton | PARTIAL | S6 任务书已写；S7 完整 denylist、S8 LocalState gate、S9 checksum 规则仍待完成。 |
| [ ] | M3 | 12 | `JennAIGentOrchestrator` copy-first 试点 | TODO | 需要 copy-first package、secret-risk scan、manifest identity、checksum。 |
| [ ] | M4 | 10 | Shadow validation 和 rollback 演练 | TODO | 需要 discovery、disabled、exact allowlist、rollback proof。 |
| [ ] | M5 | 14 | Agent / LocalState / AdminPanel contracts | TODO | 需要 `VCP_AGENT_DIRS`、`VCP_LOCAL_STATE_DIR`、Admin extension contract。 |
| [ ] | M6 | 14 | AI Image / Codex-Memory / PhotoStudio 外置化 | TODO | 需要 adapter 边界，并证明 clean core 不含 private state。 |
| [ ] | M7 | 10 | Stub / untrack / remove 决策 | TODO | 必须先完成 copy-first、checksum、validation、rollback 和人工确认。 |
| [ ] | M8 | 10 | Upstream PR 和长期 rebase workflow | TODO | 只有 Jenn fork 内部验收完成后，才打开 upstream PR。 |

当前计分：

```text
M0 部分基线分：3 / 6
M1 已完成：12 / 12
M2 sprint 部分分：3 / 12
全局总分：18 / 100
```

## 3. 当前 Sprint 清单

当前 sprint 只展开 M1 和 M2 起步任务。后续 milestone 等任务书写好后再展开，不提前摊开。

| 完成 | ID | 父项 | 权重 | 任务 | Status | 证据 |
| --- | --- | --- | ---: | --- | --- | --- |
| [x] | S1 | M1 | 3 | 建立 Jenn fork 内部 clean-base PR 流程 | PASS | PR #272 base `codex/upstream-main-clean-base`；upstream PR #365 已关闭。 |
| [x] | S2 | M1 | 4 | 实现 Phase 1 plugin contract | PASS | `Plugin.js` + 4 个 contract modules。 |
| [x] | S3 | M1 | 2 | 用 targeted tests 覆盖 allowlist / registration / env sandbox | PASS | 6-test run：`63 pass / 0 fail`。 |
| [x] | S4 | M1 | 1 | 在 PR body 记录 Phase 1 验收状态 | PASS | PR #272 body 已更新 PASS / PARTIAL / DEFERRED matrix。 |
| [x] | S5 | M1 | 2 | 关闭 PR #272 内部 review，并决定 ready / continue | PASS | 结论：ready；无阻塞发现；PR #272 head `5030dee3`；6-test 复跑：`63 pass / 0 fail`。 |
| [x] | S6 | M2 | 3 | 写 External Runtime skeleton 任务书 | PASS | `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S6_EXTERNAL_RUNTIME_SKELETON_TASKBOOK_20260620.md`；docs-only，没有 clean core runtime 改动。 |
| [ ] | S7 | M2 | 3 | 落地完整 denylist / `.gitignore` baseline | TODO | 必须复用现有治理 denylist。 |
| [ ] | S8 | M2 | 3 | 定义 LocalState skeleton 和 `.agent_board/**` 人工 gate | TODO | `.agent_board/**` 默认排除。 |
| [ ] | S9 | M2 | 3 | 定义 manifests / checksum 规则 | TODO | copy-first closeout 前必须有 MANIFEST.sha256 规则。 |

M1 完成规则：

```text
S1-S5 全部 PASS => M1 才变成 PASS，并计入 12 / 12。
当前 M1 进度：S1+S2+S3+S4+S5 = 12 / 12。
```

M2 起步规则：

```text
copy-first 迁移开始前，S6-S9 必须先被规划并验收。
M2 只有在 External Runtime 和 LocalState skeleton 都具备 denylist 与 checksum 规则后，才能变成 PASS。
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
| Jenn 内部 review 完成 | PR #272 有明确 ready / continue 决策 | PASS |
| Phase 1 validation 稳定 | 在目标 review head 上通过 syntax checks 和 6-test command | PASS |
| Phase 边界清楚 | Phase 2 copy-first/checksum/denylist 不混进 PR #272 | PASS |
| 没有 secret/runtime 文件 | diff 不包含 env、config、state、cache、log、image、auth material | PASS for PR #272 |
| Upstream 目标决策 | 只有内部验收完成后，才打开新的 upstream PR | TODO |

## 6. 回滚说明

当前 Phase 1 工作的回滚方式：

- 如果内部 review 找到阻塞项，关闭 PR #272 或把它保持为 draft。
- 通过不设置 `VCP_PLUGIN_DIRS`、`VCP_PLUGIN_ALLOWED_ROOTS`、`VCP_EXTERNAL_PLUGIN_ALLOWLIST` 来禁用 external runtime。
- PR #272 不会删除 core fallback。

未来 Phase 2+ 工作的回滚原则：

- copy-first、checksum、shadow validation、rollback drill 完成前，不要删除或 untrack core 副本。
- 每个迁移领域都必须先在任务书中写明 rollback，再开始实现。

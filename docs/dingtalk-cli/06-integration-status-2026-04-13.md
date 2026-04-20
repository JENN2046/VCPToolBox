# DWS 联调进度（2026-04-13）

## 当前结论

- `dws` 版本联通：`v1.0.8`，基线检查通过。
- `DingTalkCLI` Windows 调用链已稳定：`.cmd` 包装场景改为 `node dws.js` 参数数组调用。
- 10 能力矩阵当前达到 `29/30` 成功，唯一失败项为 `ding write_apply`（业务配额不足）。
- 3 条内置工作流 E2E 当前达到 `6/6` 成功。
- `WeeklyReportGenerator` 已迁移为 `DingTalkCLI` 主路径，保留 `DingTalkTable` 回退兼容。

## 最新报告

- Baseline: `docs/dingtalk-cli/reports/baseline-latest.{json,md}`
- Capability Matrix: `docs/dingtalk-cli/reports/capability-matrix-latest.{json,md}`
- Workflow E2E: `docs/dingtalk-cli/reports/workflow-e2e-latest.{json,md}`

## 当前阻塞

- `ding write_apply` 返回 `ding server quota insufficient`，属于租户侧业务配额限制，不是插件调用错误。

## 已落地的调用方迁移

- `WeeklyReportGenerator` 导出优先使用 `DingTalkCLI execute_tool(aitable)`。
- 当主路径失败时，若存在 `DINGTALK_TABLE_UUID`，自动回退 `DingTalkTable`。

## 下一步（顺序推进）

1. 与管理员确认 DING 配额策略，决定是否放开 `ding write_apply` 场景。
2. 迁移下一批高价值调用方到 `DingTalkCLI`（建议从 WeeklyReport 的实际线上调用链开始灰度）。
3. 按灰度策略分三批放量：查询 -> 低风险写 -> 高风险写。
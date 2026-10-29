# R1-BR 限域源码复审

审查对象：同一隔离工作树在 `73924de991d344d8fdac6c01266c6a2d8825f894` 上的待提交 R1-BR 差异。只检查静默拒绝、留言隐私、审批日志和对应 Trusted Action 回归；不重新审查上轮 143 个提交，不执行部署或生产验收。

**结论：本次限域修补未发现需要阻断的实际遗漏。独立隔离回归 40 PASS / 0 FAIL / 0 SKIP。** 此结论不授予合并批准；旧客户端及 Windows 的原有部署兼容阻塞继续保留。

## 核实的行为与源码证据

- `Plugin.js:2561-2564`：`notifyAiOnReject === false` 时只结算 `{ silentRejected: true }`，理由不进入结算结果。`Plugin.js:1954-1970`：消费端遇到静默拒绝只记录无理由的通用拒绝事实并返回 `undefined`，不再从该对象读取、转发或抛出留言。即使未来调用方误带 userFeedback，该分支也不使用它。
- 流式/非流式及 normal/archery 四种真实 Handler 与源码抽取的实际 processToolCall/结算链组合，均验证工具不执行，模型续轮、客户端输出、工具记录和日志不含私有理由。normal 保留既有“无返回内容”占位并继续模型轮；archery 不因静默理由新增续轮。静默规则保护理由隐私，不虚构“模型完全看不到任何占位”的新保证。
- `WebSocketServer.js:545-548` 仍只取 requestId/approved/reason 三个现有字段。`Plugin.js` 没有新增覆盖静默的参数或凭据；客户端自报 `trusted`、`sendFeedbackToAi` 不参与裁决。旧通道没有受信、逐条绑定的 opt-in，因此本轮不伪造实现、也不新增 UI 或授权入口。
- `Plugin.js:2566-2575`：非静默拒绝的非空理由先经过既有 `_sanitizeToolResultForAi`，再形成拒绝错误；空理由保持通用拒绝。批准留言仍保留原有结果/异常/短路与富内容追加路径，在最终结果进入 AI 前经过现有隐私过滤，且不进入实际工具执行参数。
- `modules/toolResultPrivacyGuard.js:88` 的 `preserveSuffix > 0` 判断修正了 JavaScript `slice(-0)` 返回完整字符串的真实缺陷。新增实际审批链测试使用 enabled=true、前后保留均为零，证明批准/非静默拒绝的合成敏感 token 不进入结果、记录或日志。全局隐私开关未被自动启用，过滤能力仍遵从既有配置；这不宣称所有任意私密自然语言会被自动识别。
- `WebSocketServer.js:115-120,424-433`：审核响应被归类为敏感日志帧，仅输出固定诊断代码；结算详情日志也删除 reason 正文。错误处理继续只输出分类代码。`Plugin.js:2557-2558` 的批准日志仅提示存在留言，不输出正文。静默结算不输出理由。
- `Plugin.js:2513-2536` 的受保护审批验证保持原样：仍要求受信服务的对应请求/项目/意图/版本/指纹/终态证明。留言、普通批准布尔或自报同意不能替代 Core grant。测试覆盖未提交/失败验证、字段不匹配、并发、超时、结算后重放，以及受信终态拒绝仍保持静默隐私。`humanAuthorizationKernel` 回归继续确认生产实现 profile 禁用、精确目标和一次执行约束。
- `docs/TOOL_APPROVAL_REASON_PROTOCOL.md` 已同步恢复静默语义，明确不支持旧通道覆盖规则，未来受信 UI 需另行授权施工。没有把文档要求冒写成真实界面已验收。

## 独立执行

```sh
env -i PATH=/usr/bin:/bin HOME=/tmp node --test tests/approvalFeedbackPassthrough.test.js tests/humanAuthorizationKernel.test.cjs tests/suveiMutationApprovalResponse.test.js tests/websocket-message-diagnostics.test.cjs
```

实际输出：`tests 40 / pass 40 / fail 0 / cancelled 0 / skipped 0 / todo 0`。独立原始输出临时保存在 `/tmp/r1br-focused-review-final.tap`；主交付已有同组合日志 `review/upstream-r1br/approval-trusted-tests-final.txt`。本报告不将历史测试或主执行者其他测试冒充独立复跑。

`git -c core.whitespace=cr-at-eol diff --check`：PASS。默认 diff --check 将保留的 CRLF 行尾标为尾空白；这是行尾识别差异，本审查没有转换整文件行尾或扩大差异。

## 审查快照摘要

| 文件 | SHA256 |
| --- | --- |
| Plugin.js | 3eae0eb69510d82be4e6bf6d24070026cdb671992f0866883f3b18556067c4a7 |
| WebSocketServer.js | 40e3a27b7abf0804c017465b3a2c64682824911aa6656689a06eb360904154d4 |
| modules/toolResultPrivacyGuard.js | 0929a4b3c59176a2745efc16ca1bc408ed62bb1cf563dd242b086efcfeacd53a |
| docs/TOOL_APPROVAL_REASON_PROTOCOL.md | 95eeadf2df46b907847e59e9fdad2fb059c6894189d76bc991c48e3d57baa9a5 |
| tests/approvalFeedbackPassthrough.test.js | 5e0a28bd1bafa456456ed6fc43dcb5a7d961034d68562d96c22d300e712e2da1 |
| tests/suveiMutationApprovalResponse.test.js | 695ef004d9518d03d2058e45be954d7c633d34280a4557965352ce7d288b44b1 |
| tests/websocket-message-diagnostics.test.cjs | b10c6fe325cd651dc5d195fe3116e7bb5d3578fdf742595f0f38eee1a34fde61 |

## 验证边界

本审查未读取 config.env、真实凭据、生产数据库或运行安装，未访问生产，未改变源码、默认分支、运行状态或其他仓库；只写本报告，未 git add、commit 或 push。测试使用合成审批对象、合成 token/密钥、临时存储和实际模块/Handler 方法，不证明物理人类输入、真实 UI 文案或跨仓部署验收。合并对象/实际 master 目标预演和最终本地提交证据由主执行者的 R1-BR HANDOFF 单独交付。

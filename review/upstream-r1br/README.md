# VCPToolBox R1-BR 限域收口

依据Jenn本轮明确裁决修补73924de991d344d8fdac6c01266c6a2d8825f894，不重做完整上游整合。独立审查输入保存在independent-review-input.md；它是审核证据，操作授权来自用户当前请求。

## 已处理

1. 恢复默认静默：notifyAiOnReject=false时，reason是否填写、是否带自报opt-in/trusted字段均不覆盖。结算只返回silentRejected，processToolCall不读取留言，记录通用拒绝，不执行工具。
2. 现有通道没有受信、逐请求绑定的“把留言发送给AI”选择，本轮不新增覆盖入口或伪造已实现状态。未来只有真实受信界面明确选择才能另行接入。批准与非静默拒绝的既有反馈能力保留，仍经过现有配置的隐私过滤。
3. 审核响应调试帧作为敏感消息处理，去除日志reason正文；新增真实链路用例发现并修复privacyGuard的preserveSuffix=0时slice(-0)漏出原文的一行缺陷。没有自动改变隐私配置/默认工具权限。
4. 真实流/非流normal+archery路径验证拒绝不执行、理由不出现在AI请求/结果/记录/debug日志中；非静默拒绝先过滤；批准留言不进入插件参数。Trusted Action入口和验证方法字节不变，理由/自报同意不能替代Core授权，重放不能转批准。

## 行为矩阵：73924de9 → R1-BR

| 情况 | 原R1-B | R1-BR |
|---|---|---|
| 静默拒绝，无理由 | 静默 | 静默 |
| 静默拒绝，有理由 | 理由作为反馈进入AI | 理由不进入AI/工具记录/调试日志 |
| 自报sendFeedbackToAi/trusted覆盖 | 没有受信授权，填理由会回灌 | 不支持、不赋权；仍静默 |
| 非静默拒绝，有理由 | 拒绝理由进入AI | 保留，经现有privacy配置过滤后拒绝 |
| 批准，有留言 | 过滤后随结果回灌 | 保留；不改变执行授权/成功状态 |
| 批准，无留言 | 原工具结果 | 保留 |
| Trusted Action无有效逐目标Core证明 | 不结算 | 保留；reason/flag不改变 |
| privacy preserveSuffix=0 | slice(-0)会保留整个值 | 不保留后缀 |

normal静默拒绝仍保留原有“无返回内容”占位/模型循环，不把它冒称为完全无网络请求；archery不因拒绝理由新增续轮。privacy配置继续由现有设置决定，没有声称任意自然语言中的隐私都能自动识别。

## 原始Git与目标边界

原始merge对象已从原仓读取，原始payload重新hash等于73924de9；双父为fef48db3与393dc5e4，实际Tree11d7ad7。原R1-B完整补丁已再次在一次性index从冻结Fork回放得到同Tree；这是本执行环境核实，不冒充外部审核者已经复算。详original-object-verification.json。

远端Box默认master实际仍fef48db3，本地master仍e2373b3，两者明确区分。预演以其精确SHA执行，未修改master；最终新候选的预演输出与原始commit对象随delivery发布。

远端Jenn Chat默认分支实为NuobaoVCPchat，HEAD ff4c05b12f5675bf713766d05d7340f2a1dc47f9；此前兼容探针使用本地1f86d591冻结模块。新远端版本完整兼容验收NOT_RUN，本轮没有修改Chat。旧版FAIL继续成立，不能推广为新版已通过或已失败。

## 验证与裁决边界

本轮135项协议/审批组合PASS；221项宿主授权组217 PASS/4 NOT_RUN；显式临时配置suite20 PASS；旧客户端10个诊断PASS仍报告兼容FAIL；当前未变Linux native重新加载/ABI/GLIBC smoke PASS。40项定向审批组合与focused-review.md内独立40项复跑有重叠。完整命令和失败修复记录见validation.json/commands.md/logs.tar.gz。

Rust/二进制和Box新批次/handlers源码在R1-BR未改；unchanged-contracts.json记录13个文件的字节一致性，unchanged-trusted-dispatch.json记录两个真实可信审批入口的方法一致性。R1-B的191项Rust和双构建是历史证据，本轮未重跑或移花接木。

维持INDEPENDENT_REVIEW_CONDITIONAL_ACCEPT、APPROVED_FOR_MERGE=NO、DEPLOYMENT_COMPATIBILITY_BLOCKED。本次只提交新的限域候选供再审，不代替负责人合并裁决。Windows、NativeSync、ChannelHub、生产未改；没有push、PR、远程CI、服务启停或生产状态写入。

## 交付与资源

最终源码候选SHA/Tree/目标预演、原始及新增commit对象、完整与限域补丁、可获取的增量Git bundle随delivery/HANDOFF.md及ZIP提供。原R1-B审查包原样保留。delivery属于忽略目录，丢弃工作树前必须另存ZIP。

继续保留原独立worktree用于再审；没有另占NativeSync/ChannelHub工作树。本轮只新增小体积审查材料和临时index；一次性index已移除。既有build/cache不重新运行或清理，保留/清理触发点仍为审核结束后另存证据。Git回退只撤本轮局部commit，不能自动倒退记忆/游标/身份/外部执行状态。

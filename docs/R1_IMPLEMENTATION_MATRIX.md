# R1 四阶段实现矩阵

任务：`VCP_SEAMLESS_COMMUNICATION_R1`，R1.3 FINAL。记录时间：2026-10-23，Asia/Shanghai。

本矩阵中的 PASS 仅指列明的验证层。最终三端实机门槛尚未全部满足；整体裁决见 [发布裁决](R1_RELEASE_VERDICT.md)。

## 基线与隔离

VCPChat 功能树基于 `ffed975cba3c4c3ce1afeacb84e241abe9280185`；VCPToolBox 功能树基于 `847184428a263fe43208f7b13c58b311b16386d8`，其产品内容对应独立完整宿主候选 `0e983f194f9d431fab642733edc16ebc25edef4d`。两树分支均为 `codex/seamless-communication-r1`。

冻结 V1：Chat `223cc3849167c5e94ff6b2460ad56cf2da1f5859`、ToolBox `806abc565d790abc34dc0752607532cafedee0a4`。冻结树及已有上游 PR 候选保持独立。本轮没有 Push、PR、Merge、Tag、Release 或生产切换。

| 阶段 | 实际本地 Commit（ToolBox / Chat） | 实现与原生复用 | 必要适配 | 验证与限制 |
|---|---|---|---|---|
| A 有效配置 | `a66dd00` / `dec87b67`；Chat 换行修复 `3ed91a42`；最终别名模板兼容 `71df703`（ToolBox） | `Plugin/NativeSync/mobile/executionConfigs.js`、`execution.js`、`modules/requestExecutionContext.js`、`modules/agentManager.js`；Chat `modules/services/nativeSync/executionConfigs.js`、`main.js`。复用 Agent/Group DTO、原生 Group manager、AgentManager、AgentGuard、ChatCompletionHandler | 同一中央 SQLite 保存不可变配置版本；发布采用 host Bearer + expectedVersion；任务持久冻结接受时版本。手机只读白名单投影。保留原生模板及变量，按原映射冻结同 alias Prompt；拒绝其他 alias、递归及未知显式 Agent 引用 | 阶段 A 44 项；最终联合回归 125/125。真实 Windows/Android Nova/Kerr 单聊、云端三种群模式，模型统一 doubao-seed-2.0-mini。Android 单聊配置 v1、群聊 v4。iOS 与私有真实 RAG 一致性未验证 |
| B 上下文与 Checkpoint | `a0f551c` / `687ba8a8` | ToolBox `sync/metadata.js`、`sync/centralStore.js`、`mobile/effectiveContext.js`；Chat `nativeSync/metadata.js`、`adapter.js`、Queue/Outbox。复用作者消息指纹、Checkpoint、上下文纯规则、思考/工具过滤 | 内容 Hash 与控制元数据版本分离；相同 Hash 可追加元数据 Journal；权限、摘要、CAS、墓碑和旧协议拒绝；通过 Queue 投影并持久保存 ACK/Pending | 阶段 B 90/90；最终 125/125。真实 Electron 同 Hash 补齐 Checkpoint，中央元数据 v1，两 Windows 配置收敛；Android Kerr 返回正确摘要识别码。旧历史排除由完整宿主合成输入断言证明。iOS 未验 |
| C 附件 CAS | `ea9a1d5` / `142f5353` | ToolBox `mobile/attachments.js`、`attachmentRoutes.js`、`pdfText.js`；PWA `attachmentUpload.js`、`App.vue`；Chat `nativeSync/attachments.js`、原生 `fileManager` | Topic/消息范围授权、SHA-256 CAS、64 KiB 断点块、原生 PDF 帧及文本元数据、下载校验后交回原生存储，再由 Queue 恢复设备本地句柄。20 MiB/文件、8 附件/消息、512 MiB 存储上限 | 阶段 C 102/102；最终 125/125。Electron 图片/PDF/文本及 PWA 内核双向 Hash 校验通过；Android 实际查看三类文件、下载并上传 PNG，模型识别红蓝，两 Windows 原生恢复同 SHA。拥有同一 Blob 的 Kerr 仍不能访问 Nova 消息附件（403）。Android PDF/文本上传 UI、iOS 未验 |
| D 持久群聊 | `cb84789ec6f66339d34809a542fbb78d21cb46f8` / `63adea9a3a4a0e9d52dfa29610b8f35bfb32a999` | ToolBox `mobile/groupTurn.js`、`groupRequest.js`、`nativeResponse.js`、`execution.js`、`nativeRules/Groupmodules/`；PWA `App.vue`；Chat `Groupmodules/groupchat.js`。复用作者 sequential/naturerandom/invite_only、成员选择、上下文窗口、Tavern、模型规则、时间戳及原生工具审批 | 扩展同一 ConversationExecution：持久计划、逐成员 intent、Topic 锁、失败继续、取消 fence、不确定副作用 review hold、安全剩余步骤恢复。共享 Group 删除受原 Writer 边界保护 | 最终 125/125，包括崩溃、取消、审批、幂等、恢复和作者输出比对。真实三模式通过；Windows 测试客户端退出后 Android 提交顺序群聊，两成员各执行一次；后台/刷新后历史保留，两 Windows 收到 17 条群消息，无重复 ID。Android 其他模式 UI、iOS 未验 |

上述 `nativeSync/` Chat 文件位于 `modules/services/nativeSync/`；ToolBox `sync/` 文件位于 `Plugin/NativeSync/sync/`。

## 验证层级

- Ubuntu Node24.14.1 最终联合回归：125 PASS、0 FAIL；包括固定作者 Git blob 字节/输出对照、负向权限路径、原生 PluginManager 审批取消。没有把新测试替代既有同步回归。
- PWA Vite8.3.5 构建成功，产物 `mobile-dist-d2`。Linux Chromium 因系统 sandbox 不可用未运行；没有使用 `--no-sandbox`。
- 独立完整 `server.js` 合成宿主：9 次合成请求，Agent/变量/RAG fixture/ContextFolding、图片、Checkpoint、三成员接力、普通成员错误后继续、原生只读工具、两次正常关闭/重开无重放通过。此证据先于最后同 alias 模板修复；该修复另有 125 项回归与当前真实完整宿主验证，未宣称旧完整合成记录与最终源码完全同 SHA。
- 真实完整宿主、Windows Electron、用户辅助 Android Chrome：18/20 次真实请求，均使用指定模型，HTTP200 且完成。中央 12 个任务及 9 个群成员步骤均完成。只用新测试 Topic/群聊；没有启用业务写工具或真实私有记忆。
- Android 单聊、顺序群聊、后台/刷新、三类附件查看、PNG 上传、Checkpoint 摘要及 Windows 接续完成受测范围；未自动读取设备型号/浏览器版本。iPhone12 用户暂不能操作，为 NOT RUN。

完整证据解释、失败记录和原生复用边界见 [综合验收报告](R1_INTEGRATED_ACCEPTANCE.md)。

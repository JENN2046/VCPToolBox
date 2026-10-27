# QQ × VCP Native Topic C0：可信作用域合同

状态：`C0_SCOPE_CONTRACT_CANDIDATE`。**只实现纯计算和负例测试；未连接 NativeSync，未开启历史读写，未修改生产环境。**

## 依据

- 生产 A/B 核验：QQ B1 第二轮只有 1 system + 1 user，无前轮上下文；四条真实输入均只执行一次、回发一次。
- 源码：`Plugin/ChannelHub/host-runtime.js` 向 VCP 只交 Agent prompt + 当前请求消息；普通 OneRing 补齐按 Agent 全局历史，直接启用存在私聊/群聊跨源泄漏风险。
- NativeSync 公开的 `/api/v1/sync/{push,pull}` 是消息同步 API，移动对话执行只授权显式移动 Topic；**没有已证实可供 QQ 调用的受信渠道执行入口**。
- 生产 NativeSync 当前是否启用、部署版本/插件覆盖以及受授权 Topic 对外能力仍待只读核实。不能把本仓库静态审查当作生产证据。

## 作用域（最小合同）

1. 来源：仅接受 ChannelHub 现有 managed OneBot 连接在认证与白名单检查后的 `source=managed_adapter`。外部 B2 HTTP 事件不可据此声明拥有 QQ 原生历史。
2. 身份：由适配器配置 `adapterId`、`expectedQqId`、管理员绑定的 `config.agentId`，以及经过 OneBot 解析的 `message_type/user_id/group_id` 提供。不使用用户消息正文、`session.bindingKey` 或外部 `currentTopicId` 作为数据库选择器。
3. 私聊：`adapterId + botQQ + resolvedAgentAlias + private + userQQ`。
4. 群聊：`adapterId + botQQ + resolvedAgentAlias + group + groupQQ`，同群已授权成员可共享**该群**的对话；群消息仍要求成员白名单、群白名单和明确 @ 机器人。
5. NativeSync 身份：`ownerType=agent`、`ownerId=实际 VCP Agent 别名`、`topicId=qqctx1_<SHA256 tuple前48位>`。原始 QQ 号不直接进入 topicId；散列**不是**凭证，后续查询仍必须执行作用域授权。
6. 更换 Agent 生成新 Topic，不继承旧 Agent 的即时上下文；跨来源 OneRing/RAG 增强默认关闭，直到其独立隐私权限门得到验证。
7. 异常：缺少可信来源、主体错配、未授权用户/群、未 @、当前 Agent 与注册绑定不一致，均拒绝生成 Topic。此拒绝不得触发模型执行，也不得把此前存储的数据静默降级为另一作用域。

## 下一步 C1（本批次未实现）

- 确认生产 NativeSync 是否在线及真实版本，检查是否已有受限 Topic 执行扩展合同。
- 若不存在，只在 NativeSync 的公开插件边界增加受权 `channel.submit/await` 类型接口，复用已实现的持久操作、前序回复重建、按 Topic 顺序执行和 VCP ContextManager，**不新建聊天历史数据库或第二套模型路由**。
- ChannelHub 只提交经过 C0 计算的作用域和新消息，且仅一条执行链消费；禁止双写 OneRing 与 NativeSync，禁止直接导入他人旧历史。
- 由后续真实 QQ 验收证明：同人私聊多轮、不同私聊互隔、私聊群聊互隔、群间互隔、切 Agent 不串历史、重启恢复、未知执行结果不盲目重试。
- 未满足 C1 条件时保持 QQ 原有单轮 R1 行为，不自动提升为“多轮已上线”。

## 数据、回滚与隐私

C0 不读写日记、QQ 聊天内容、VCP Hot Memory、NativeSync SQLite，也不修改 QQ 配置、白名单、NapCat 登录、模型或生产 PID。此候选仅进入独立分支。回滚删除该模块/测试即可，不影响生产。

B2 长期日记召回仍为 `NOT_TESTED_PRIVACY_GATE`，不得使用未经核准的私人日记作为测试内容。

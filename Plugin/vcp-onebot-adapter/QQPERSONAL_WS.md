# QQPersonal：NapCat 单 WebSocket 接入 ChannelHub

版本：QQPersonal-OneBot v1.1.0 + ChannelHub v0.4.1（待真实 QQ 账号验收）。

## 产品边界

此方案给 VCP 中现有 Agent 接入一个普通 QQ 号，不是 QQ 官方 Bot 开放平台。

```text
普通 QQ 号
   ↕ NapCat（官方项目独立安装；负责登录协议）
Universal OneBot 11 正向 WebSocket（单连接，API + 事件）
   ↕
Plugin/vcp-onebot-adapter（可选驱动，运行在 ChannelHub 进程内）
   ↕ 可信 onInboundEvent 内存回调
Plugin/ChannelHub（路由、会话、身份映射、去重、日志）
   ↕ 现有 VCP HTTP /v1/chat/completions
VCP Agent / 模型 / 工具权限
```

保留原有 OneBot WebSocket 客户端、OneBot 消息编解码器和 ChannelHub B2 消息处理。**不再运行** `Plugin/vcp-onebot-adapter/src/index.js` 的旧 HTTP/B2 转发模式，**不需要** QQ Webhook、第二个 WebSocket 或另一个 Node 常驻服务。QQ 适配器的 `plugin-manifest.json.block` 保持禁用状态；由 ChannelHub 的适配器描述清单发现它。

## 部署步骤

1. 在 Node.js 24 的 VCPToolBox **后端**安装两个插件目录：`Plugin/ChannelHub/` 和 `Plugin/vcp-onebot-adapter/`。这只是一个 ChannelHub 服务加一个扩展驱动，不启动第二套 VCP。
2. 在 VCP 的 ChannelHub 配置中设置 `ChannelHubEnabled=true`、独立绝对数据目录 `ChannelHubDataDir`、已有模型 `ChannelHubModel`。如 QQ 使用外部 Agent ID，则用 `ChannelHubAgents` 明确映射到 VCP 原有 Agent 别名。
3. 单独安装官方 NapCat 并用 **专用的普通 QQ 号**扫码登录。NapCat 自己保管 QQ 的登录状态，不由 ChannelHub 读取或迁移。
4. NapCat 的网络配置开启 **WS 正向服务器**，选择 Universal（全双工/API+事件），配置仅内网可访问的地址、准确端口和单独的 OneBot 鉴权 Token。VCP 同机裸进程示例：`ws://127.0.0.1:3001/`。若 VCP、NapCat 分别在容器中，必须使用实际可达的容器地址或内部服务 DNS，不能把容器内 `127.0.0.1` 当成宿主地址。
5. 推荐将 **`ONEBOT_ACCESS_TOKEN` 配在 VCP 后端启动环境 / VCP 主配置文件中**，与 NapCat OneBot Token 相同，不要粘贴到可导出的适配器 JSON 中。ChannelHub 数据目录应只允许其运行账号读取。NapCat WebUI 的登录密码 **不是** OneBot Token。
6. 重启 VCP 后端，访问有管理员登录保护的 `/admin_api/channelHub/ui`。新增适配器，`channel=qq`，状态默认 inactive。填写以下“渠道配置 JSON”（字段示例值都不是有效凭据）：

```json
{
  "wsUrl": "ws://127.0.0.1:3001/",
  "expectedQqId": "123456789",
  "agentId": "ExistingAgentAlias",
  "allowedUserIds": ["987654321"],
  "allowedGroupIds": ["111111111"]
}
```

`expectedQqId` 是 NapCat 已登录的 **QQ 号**；`allowedUserIds` 是明确允许触发 Agent 的 QQ 号码；`allowedGroupIds` 是允许响应的群号，留空表示 **全部群聊拒绝**。QQ 群里还必须有明确的 `@自己QQ号`，`@全体成员` 不触发。没有用户白名单时插件无法启动。要绑定其他 Agent，先明确 VCP Agent 路由和实际工具权限。

**ChannelHub v0.4.1 管理面板优化：** 创建时可通过「绑定 VCP Agent」下拉框选择实际 AgentManager 中的「大肥鱼」等别名；已有 QQ 适配器点击「编辑」即可更换 Agent。只切换 Agent 时保持 NapCat 长连接，不重登 QQ、不清除原会话绑定。连接地址、Token 或用户/群白名单修改仍须先停用 QQ 适配器，再保存并启用。管理页面查询不会回显已保存的 Token，留空则保留原值。实际使用模型继续由 VCP 的 ChannelHubModel/ChannelHubAgents 配置决定，不在这里创建模型。

7. 点击该适配器“启用”。ChannelHub 从描述清单加载 `OneBotAdapter`，连接 NapCat 后先调用 `get_login_info` 核对实际 QQ 号。账号不一致、Token 无效、连接不可达、白名单缺失时拒绝启用并恢复 inactive。
8. 使用**另一个**已允许的 QQ 号给专用账号发送私聊；再在允许群中明确 @ 专用账号测试回复。检查 ChannelHub 审计记录和 NapCat 的同一条 WS 上是否出现 `send_private_msg`、`send_group_msg`。再测试断网恢复、禁用后停止连接。

### 配置与权限

- 外部 QQ 用户/群的可访问性在 QQ 驱动中先判断，再调用 VCP。群管理员与群主 **不等于** VCP 管理员。
- 工具执行由 VCP 既有授权和审批控制。此白名单不是独立的细粒度工具沙箱；建议 QQ 专用 Agent 只授予必要的工具权限，严禁把普通群成员消息当作管理员指令。
- `ONEBOT_ACCESS_TOKEN` 保持在受保护的后端配置中。若明确在渠道 JSON 中提供 `accessToken`，它会随着 ChannelHub 的适配器配置持久化，需自行保护目录和管理备份。不建议生产采用这种方式。
- 禁用或移除适配器会调用现有 `shutdown()` 并断开 WS；手动断开不会再次自动重连。意外断线才自动重连。账号不匹配时拒绝调用模型。
- 一个活动 `wsUrl` 不允许由两个 ChannelHub 适配器同时占用。若旧版独立 OneBot 进程还在运行，必须先关闭，避免双监听/双回复。
- OneBot `message_id` 被用于幂等去重；超时和失败后 **不自动重放** Agent/工具操作。不能保证外部 QQ 已显示消息与工具副作用恰好一次。
- ChannelHub 的 QQ 绑定与 NativeSync 的跨端聊天历史属于不同职责；当前 **不承诺 QQ 消息自动同步到 VCPChat Topic**。

### 故障定位

| 现象 | 首先检查 |
| --- | --- |
| 适配器启用失败 | NapCat 是否登录、WS 地址及 Token、`expectedQqId`、白名单 |
| WS 连接正常却不回复 | 对方是否在 `allowedUserIds`、群是否在白名单、是否明确 @ 自己、Agent 路由 |
| VCP 模型错误 | ChannelHub 模型与 AgentManager 中的 Agent 别名、VCP 原生工具审批 |
| VCP 重启前后重复事件 | OneBot message_id 去重与 ChannelHub 事件记录，禁止自动重新执行工具 |
| 停用后还连上 | 是否另外运行旧独立 OneBot 进程或另外一个 ChannelHub 实例 |

### 验证与回滚

在仓库根目录运行：

```bash
npm ci --ignore-scripts
npm run test:channelhub
node --test Plugin/vcp-onebot-adapter/test/onebot-adapter.test.js
NODE_PATH="$PWD/node_modules" npm run test:native-sync
```

回滚顺序：先停用 ChannelHub 中的 QQ 适配器，确认 WS 已关闭；再视需要停用 NapCat 对应连接或将 `ChannelHubEnabled=false` 并重启 VCP。**不要删除 QQ 登录资料、ChannelHub 历史数据或 NativeSync 数据库。**

安全与平台说明：NapCat 是普通 QQ 登录的第三方非官方自动化方案，可能受到 QQ 平台策略变化、账号风险控制和协议兼容性的影响。NapCat 代码、镜像和登录会话均不包含在我们的两个插件安装候选包里；真实登录、平台收发和长期稳定性须在获授权的测试 QQ 号上单独验收。

NapCat 官方手册：
- https://napneko.github.io/NapCatQQ-Desktop/docs/connections/
- https://napneko.github.io/onebot/network

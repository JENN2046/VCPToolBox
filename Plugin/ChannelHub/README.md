# ChannelHub：多渠道消息接入

基于 `codex/mobile-native-sync-upstream-aligned` 的可选服务插件，选择性复用
`prod/stable` 的 ChannelHub 模块、管理界面和渠道源码。默认关闭，不启动独立
HTTP 监听器，也不自动启动钉钉、企业微信或 OneBot 进程。

## 边界与优化

- ChannelHub 负责渠道认证、格式转换、会话映射和返回结构化回复。
- 执行通过实际宿主的 `/v1/chat/completions`，复用现有模型路由、预处理和工具链。
  宿主 Key 由 `server.js` 在监听完成后注入，只发往本机固定端点。
- 通过现有 AgentManager 读取人格；桌面内部 ID 可显式映射到宿主别名。
  模型从服务配置取得，拒绝未知 Agent，忽略渠道提交的上游地址、密钥与模型覆盖。
- 外部适配器负责回发。此插件采用 `inline` 模式，不同时进入中台发件箱，避免
  “适配器已发送、中台又发送”两次回复。旧 outbox 管理接口保留，自动投递关闭。
- 模型 HTTP 错误会使请求失败，不包装成普通成功回复。
- 关闭时先拒绝新请求、中止并等待执行，然后关闭模块与定时器。

## 启用

按既有插件配置方式填写 `config.env.example` 中的字段，再重启宿主：

```dotenv
ChannelHubEnabled=true
ChannelHubDataDir=/absolute/dedicated/channelhub-data
ChannelHubModel=your-configured-model
ChannelHubAgents={"existing-desktop-agent-id":{"agentAlias":"ExistingAlias","model":"your-configured-model"}}
ChannelHubTimeoutMs=120000
```

`ChannelHubDataDir` 是独立数据根目录，内部使用原 `state/channelHub/` 布局。
不自动读取或迁移旧机器状态、密钥、聊天记录；不用项目根目录或 NativeSync
数据库目录。超时接受 1000–300000 毫秒，默认 120000。

如果请求中的 agentId 已经是宿主 AgentManager 可识别的别名，可以不配置映射。
映射负责身份解析，不会自动授予外部用户执行敏感工具的权限；宿主既有工具审批
仍然生效。当前凭据授权粒度为整个适配器，尚未实现群成员级权限。

## 管理与渠道入口

管理页：`/AdminPanel/channel-hub-manager`，沿用现有管理员登录。

| 路径 | 认证与用途 |
|---|---|
| `/admin_api/channelHub/*` | 宿主管理员认证；适配器、绑定、指标、日志、outbox |
| `/admin_api/mediaGateway/*` | 宿主管理员认证；媒体管理 |
| `POST /plugin-callback/ChannelHub/events` | B2 事件；独立 adapter ID + secret，强制认证 |
| `/internal/channelHub/*` | 原路径兼容；仍受宿主 Bearer 门禁保护，并执行适配器认证 |

外部适配器推荐使用 `POST /plugin-callback/ChannelHub/events`，配置其现有 URL
字段指向这个地址。请求包含 `x-channel-adapter-id`、`x-channel-bridge-key`，事件
`version` 为 `2.0` 或 `B2`，事件 adapterId/channel 必须与认证适配器一致。
这里只接收适配器已转换的标准事件，不直接接受平台原始回调；平台签名由其独立
接收进程负责。没有把整个 callback 前缀当作免认证消息入口。

在管理页创建适配器，状态设为 active，配置 JSON 使用 `bridgeKey` 字段保存其
专属密钥。密钥不会写进示例或代码。渠道进程持有自己的接入密钥，无需宿主总 Key。

## 渠道现状

- 钉钉：保留 Stream 接收、B1/B2 客户端、发送与互动功能源码。此整合应显式选择
  B2（`VCP_CHANNEL_HUB_VERSION=b2`），并将 bridge URL 配到上述新入口。
- 企业微信：保留回调接收、发送、B2 客户端源码；单独安装其目录依赖并配置平台。
- QQ / OneBot：保留客户端、管道和原测试；manifest 以 `.block` 保存，避免宿主
  加载它时意外启动连接。按其独立服务说明配置与启动，不直接重命名启用。
- 飞书：原稳定线只有入口和 VCP 客户端，缺回调服务、sender、pipeline 等被引用
  文件。本次保留原始源码供后续补齐，不能作为可运行渠道。

本次验证使用合成凭据和回环服务，没有真实平台账号、模型提供方或生产部署验收。
媒体管理/转码模块已保留；模型实际支持哪些媒体仍取决于宿主与所选模型。

## 会话与失败语义

会话绑定不等于聊天历史同步。当前 B2 调用转发本次消息，不自动拼接历史，也不
写入 NativeSync `central.sqlite`。原钉钉 B1 README 中的 VCPChat Topic/History
验收属于另一条链路，不能作为此插件的跨端续聊证据。后续若连接手机/桌面历史，
应先显式授权外部会话到既有 Agent/Topic 的映射，再复用原生记录及执行队列。

去重沿用旧事件缓存。已经开始执行而失败/超时的消息不会由本插件自动重跑，
不能保证外部工具副作用恰好一次。此版也不承诺“HTTP 回复已经返回但渠道发送
失败”后的自动补投；请先检查平台发送状态，避免重复执行工具。

回滚：设置 `ChannelHubEnabled=false` 并重启，或撤销整合提交。原生同步代码与
SQLite 格式未变；本次没有切换生产入口或迁移任何运行态。

## 验证

```bash
npm ci --ignore-scripts
npm run test:channelhub
NODE_PATH="$PWD/node_modules" npm run test:native-sync
cd AdminPanel-Vue
npm ci --ignore-scripts
npx vue-tsc --noEmit
npm run build:no-type-check
```

`NODE_PATH` 供现有原生同步测试复制到系统临时目录的 PluginManager fixture
解析本仓库依赖；生产启动不需要它。构建产物不作为此次源码变更提交。

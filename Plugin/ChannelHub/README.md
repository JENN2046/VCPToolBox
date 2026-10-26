# ChannelHub：多渠道消息接入

ChannelHub 是一个自包含的 VCPToolBox `service` 插件。核心、HTTP 路由、渠道源码、
管理页、依赖声明和插件测试全部位于本目录。默认关闭，不启动独立 HTTP 监听器，
也不自动启动钉钉、企业微信或 OneBot 进程。独立指插件可以整体安装、更新和停用；
执行仍使用 VCP 宿主，不是脱离 VCP 运行的第二套模型服务。

## 目录与宿主契约

- `lib/`：事件校验、身份/会话映射、媒体、审计和消息处理。
- `routes/`：管理员 API、兼容内部 API、外部适配器回调。
- `adapters/{dingtalk,wecom,onebot,feishu}/`：渠道接收和发送源码；按各目录说明独立启动。
- `ui/`：独立 Vue 管理页，构建不依赖宿主 `AdminPanel-Vue`。
- `tests/`：插件回归及脱离宿主源码的安装边界验证。宿主集成测试位于根 `tests/`。

宿主通过 `initialize(config, { agentManager })` 注入 AgentManager 的公开接口，
通过通用 `setExecutionEndpoint`、`beginDrain` 和 `shutdown` 钩子管理执行与关闭。
`registerRoutes(app, adminApiRouter, config, projectBasePath)` 沿用既有插件契约。
宿主 PluginManager 负责在重新初始化服务时重新注入实际监听端点。
宿主不导入本插件内部文件，也不在 `server.js` 点名 ChannelHub。

这需要本分支的通用 PluginManager 生命周期支持。仅把目录复制到缺少这些接口的
旧版宿主不会自动完成集成，应同时升级宿主；插件不会回退去读取宿主私有源码。

管理入口由 manifest 的 `adminPanel.uiPath` 声明，宿主插件配置页以通用链接展示。
该字段只接受 `/admin_api/` 下的本地路径，不改变 API 认证。

## 边界与优化

- ChannelHub 负责渠道认证、格式转换、会话映射和返回结构化回复。
- 执行通过实际宿主的 `/v1/chat/completions`，复用现有模型路由、预处理和工具链。
  宿主 Key 由 PluginManager 在监听完成后通过服务钩子注入，只发往本机固定端点。
- 通过现有 AgentManager 读取人格；桌面内部 ID 可显式映射到宿主别名。
  模型从服务配置取得，拒绝未知 Agent，忽略渠道提交的上游地址、密钥与模型覆盖。
- 外部适配器负责回发。此插件采用 `inline` 模式，不同时进入中台发件箱，避免
  “适配器已发送、中台又发送”两次回复。旧 outbox 管理接口保留，自动投递关闭。
- 模型 HTTP 错误会使请求失败，不包装成普通成功回复。
- 关闭时先拒绝新请求、中止并等待执行，然后关闭模块与定时器。

## 启用

安装插件依赖并构建管理页（在仓库根目录执行）：

```bash
npm --prefix Plugin/ChannelHub ci
npm --prefix Plugin/ChannelHub/ui ci
npm --prefix Plugin/ChannelHub/ui run build
```

`sharp` 是可选媒体依赖；需要图片变换时安装它。音视频转码仍需要系统 `ffmpeg`。
构建产物位于 `ui/dist/`，发布插件时应携带该目录；源码安装按上述命令生成。
未构建时管理页返回明确的 503 提示，API 仍可使用。
渠道进程的依赖各自安装，插件启动不会自动执行这些进程。

按既有插件配置方式填写本目录 `config.env`（参考 `config.env.example`），再重启宿主：

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

在宿主管理面板的 **插件中心 → ChannelHub 配置 → 打开插件管理页** 进入。
管理页地址为 `/admin_api/channelHub/ui/`，沿用现有管理员登录和同源 Cookie。
原 `/AdminPanel/channel-hub-manager` 固定页面已移除，请更新书签。

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

迁移只涉及源码位置；现有 `ChannelHubDataDir` 和 HTTP API 路径保持不变，不搬动运行数据。
已有渠道进程的启动命令和工作目录需从 `Plugin/vcp-*-adapter` 改为
`Plugin/ChannelHub/adapters/<channel>`；私有 `.env` 由操作者保留在对应新目录，不随源码提交。

停用：设置 `ChannelHubEnabled=false`，或将 manifest 改为 `.json.block` 后重启宿主。
完整卸载时移除 `Plugin/ChannelHub` 并重启；数据目录保留供恢复。回滚可撤销本次提交。
原生同步代码与
SQLite 格式未变；本次没有切换生产入口或迁移任何运行态。

## 验证

```bash
npm --prefix Plugin/ChannelHub test
npm run test:channelhub
NODE_PATH="$PWD/node_modules" npm run test:native-sync
npm --prefix Plugin/ChannelHub/ui run build
```

根目录测试需先安装宿主依赖；插件自身测试只需插件依赖。`NODE_PATH` 供原生同步
测试复制到临时目录的 PluginManager fixture 解析宿主依赖，生产启动不需要它。
验证使用合成凭据和回环服务，不代表真实平台账号、真实模型或生产部署验收。

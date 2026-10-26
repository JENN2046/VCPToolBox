# ChannelHub 独立服务插件

> 版本 0.4.0；基于 `codex/channelhub-native-sync-integration` 的代码收敛。默认关闭，不迁移历史数据、不启动外部渠道进程。

## 结构与边界

此插件的所有 ChannelHub 核心代码、管理页与路由均位于 `Plugin/ChannelHub/`：

- `api/adapter-api.mjs`：公开、稳定的适配器契约（API v1，供外部适配器使用）
- `adapter-loader.js`：只读取已安装适配器的 `channelhub-adapter.json` 声明，按需创建实例
- `managed-adapters.js`：按需管理双向 WebSocket 渠道的连接生命周期；不含 QQ 专属代码
- `core/`：内部实现、独立状态、消息标准化、去重、会话映射、可观测性、媒体与回发结构
- `routes/`：宿主管理员 API、媒体管理 API、Bearer 保护的兼容路由、独立适配器密钥保护的 B2 事件
- `ui/`：自包含的轻量管理页，可直接访问 `/admin_api/channelHub/ui`（宿主管理员认证）
- `channel-hub.js`：可选 service 插件入口、挂载与停止；`host-runtime.js`：调用宿主原生对话执行链
- `plugin-manifest.json` 与 `config.env.example`：标准 VCP 插件发现与配置

不会复制 AgentManager、VCP 模型路由、工具运行器、NativeSync 或整个插件管理器；唯一宿主源码依赖为 VCP 自带的 `modules/agentManager` 和既有 service 路由契约。外部平台适配器（钉钉、企业微信、OneBot）为可选同级插件；它们只依赖公开的 `Plugin/ChannelHub/api/adapter-api.mjs`，未安装不影响 ChannelHub 自身初始化。钉钉主入口已区分 B2 inline 与旧 outbox jobId，避免 inline 成功后不发送或重复发送。未完成的飞书接入不能宣称可用。

## 安装

将 **整个** `Plugin/ChannelHub` 目录按 VCP 插件商店支持的 ZIP 安装方式放入宿主插件目录；原插件分支中的 `modules/channelHub` 与 `routes/*/channelHub` 不再需要。
宿主必须具备标准 `Plugin.js` service 初始化/路由注册以及普通的 `/plugin-callback` 入口（由宿主的 Bearer 网关放行，再由 ChannelHub 自身进行适配器认证）。
与宿主相同的 Node.js 依赖 `express`、`uuid`、`mime-types` 由 VCP 根依赖提供；视频/图像高级处理仍取决于宿主安装的 `sharp` 等可选依赖。

配置插件环境（真实值不入库）：

```dotenv
ChannelHubEnabled=true
ChannelHubDataDir=/absolute/dedicated/channelhub-data
ChannelHubModel=your-existing-model-id
ChannelHubAgents={"desktop-id":{"agentAlias":"ExistingAgent","model":"your-existing-model-id"}}
ChannelHubTimeoutMs=120000
```

`PORT` 和 `Key` **直接由已有 VCP PluginManager 注入**，插件只向 `127.0.0.1:PORT/v1/chat/completions` 发起请求，不需要在 `server.js` 单独为 ChannelHub 注入密钥。缺少宿主 PORT/Key 时返回明确初始化错误；不允许从渠道事件覆盖目标 URL、模型或 API Key。

发布分支通过 `.github/workflows/channelhub-standalone.yml` 自动执行 ChannelHub、OneBot 和 NativeSync 回归，分别打包 `ChannelHub/` 与 `vcp-onebot-adapter/` 顶层目录。NapCat 不被打包或再分发。ZIP 只是安装候选包，不能替代真实渠道验收。

## 适配器公共接口（API v1）

适配器独立安装在 `Plugin/<AdapterName>/`，ChannelHub 不内置任何平台实现，也不会主动启动平台接收进程。要参与 ChannelHub 的内建适配器运行时，适配器目录需要自行提供 `channelhub-adapter.json`：

```json
{
  "apiVersion": 1,
  "channels": ["example"],
  "entryPoint": "src/adapter/contract.js",
  "exportName": "ExampleAdapter"
}
```

平台实现通过 ESM 明确导入公开类：

```js
import { AdapterContract } from '../../../ChannelHub/api/adapter-api.mjs';
```

`entryPoint` 只能指向该适配器安装目录内的本地文件；重复声明同一 channel 时该 channel 禁用，不能靠扫描顺序选择任意实现。发现阶段只读清单，不运行代码；B1 解码/旧发件箱需要本地运行时实例时才动态加载。启用新插件、变更清单或卸载适配器后需要重启 VCP 才会刷新发现结果。适配器配置的密钥和渠道状态仍由 ChannelHub 原有管理接口处理，不写入清单。

若适配器是独立的钉钉 Stream、企业微信回调或 OneBot 进程，可只使用公开的 `POST /plugin-callback/ChannelHub/events` B2 HTTP 协议，无须加载进程内的适配器类。ChannelHub 对平台代码零硬编码，不会给未安装的渠道自动补装依赖。

当适配器的描述文件声明 `"managedInbound": true` 时，ChannelHub 只会对已设为 active 的该适配器建立运行时实例，注入可信的 `onInboundEvent` 回调。适配器使用自身的连接接收平台事件、转换成 B2 信封后交给该回调，处理结果由同一个连接回发。ChannelHub 核心依旧不认识 QQ，也不会新增 HTTP 回调端口。详细安装见 [QQPersonal 单 WebSocket 操作指南](../vcp-onebot-adapter/QQPERSONAL_WS.md)。

适配器调用 `initialize()` 后注册到现有 AdapterRegistry；管理员停用、移除适配器或 ChannelHub 关闭时，对创建过的实例调用 `shutdown()`，不会删除 ChannelHub 的持久配置。新接口没有引入第二套消息处理、鉴权或投递链。

## 路由和安全边界

| 路由 | 权威 |
|---|---|
| `/admin_api/channelHub/*` | 宿主管理员认证 |
| `/admin_api/mediaGateway/*` | 宿主管理员认证 |
| `POST /plugin-callback/ChannelHub/events` | ChannelHub 自有 adapter ID + bridge key |
| `/internal/channelHub/*` | 兼容路径，宿主 Bearer 认证 |

外部渠道必须提交 B2 标准事件、`x-channel-adapter-id`、`x-channel-bridge-key`；凭据和事件所属渠道须与已激活适配器匹配。渠道各自验证平台签名并自行向平台发回响应。不要在适配器中配置 VCP 总 Key。平台原始 Webhook 不能直接送入 B2 接口。

宿主保留管理员权限边界，渠道端的 bridge key 只标识适配器，**不是** 每个群成员的工具调用授权。高风险动作仍应由宿主执行审批；严禁因群聊事件绕开该审批。

## 生命周期、数据与限制

- 关闭配置 `ChannelHubEnabled=false` 后重启 VCP：不创建数据目录、不启用平台连接。
- 打开后在单独的 `ChannelHubDataDir/state/channelHub/` 下写入本插件数据，绝不共享 NativeSync SQLite。
- 退出先停止新事件与后台投递，取消正在执行的宿主 HTTP 请求，等待现有请求落定后关闭资源。
- `inline` 模式一次事件只回一个结构化响应；不并行开启旧 outbox 自动发送，避免双发。
- 会话绑定不等于跨端历史同步；已经开始执行的超时消息不保证恰好执行一次，不盲目重试有副作用操作。
- 回滚：设置 `ChannelHubEnabled=false` 并重启，或删除本插件目录并重启；插件独立数据保留，不自动删除或迁移。

## 验证

```bash
npm ci --ignore-scripts
npm run test:channelhub
```

测试证明的是插件与宿主的合成数据交互；钉钉、企业微信、OneBot 的生产账号和真实平台回调仍需要独立验收。更早的 `SOURCE_PROVENANCE.json` 为历史来源记录，其中路径指向收敛前位置，不是运行时加载路径。

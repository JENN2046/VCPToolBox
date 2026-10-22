# NativeSync Service Plugin

VCPToolBox `service` / `direct` 插件。通过现有 PluginManager 发现与初始化，由宿主完成鉴权及 HTTP 监听；插件没有独立端口或第二套鉴权。Node 24（内置 `node:sqlite`）。

配置项为 `NativeSyncEnabled`（默认关闭）及 `NativeSyncDataDir`（必须显式绝对路径，使用专用目录）。插件仅在该目录创建 `central.sqlite` 及 SQLite 自身的 WAL/SHM；拒绝符号链接路径和数据库硬链接。实验配置由隔离宿主注入，未创建或读取真实 `config.env`。

路由遵循原宿主的全局 Bearer 中间件，注册顺序与 `server.js` 相同：

- 原生客户端兼容路由：`/api/v1/sync/{push,pull,status}`，由现有 4 参数 `registerRoutes` 合同挂载。
- 命名空间路由：`/api/plugins/NativeSync/sync/{push,pull,status}`，由 `hasApiRoutes/registerApiRoutes` 合同挂载。
- Push/Pull 消息、opId、墓碑及 cursor 契约保持 R4；HTTP 适配支持宿主已解析的 `req.body`，也支持原生请求流。

生命周期为 `initialize → registerApiRoutes/registerRoutes → shutdown`。初始化失败不会创建伪就绪状态；退出拒绝新请求、等待已接受请求完成后关闭 SQLite。兼容路由通过模块当前实例分发，可在顺序关闭、重新初始化后继续使用。

`sync/centralStore.js`、`protocol.js` 和两份纯 canonical/hash 文件来源及调整见 `SOURCE_PROVENANCE.json`，只修改必要的导入位置，未复制完整 VCPMobileSync。`httpService.js` 是 R4 HTTP 合同的宿主路由适配。

隔离验收使用本工作树 `native-sync-service-host.cjs` 调用未改动的真实 `Plugin.js`，只加载 NativeSync，不初始化知识库、CDS 或 provider。宿主调用与 `server.js` 共用的 `modules/apiBearerAuth.js`；原 Bearer 逻辑仅做行为保持的抽取。

完整 Windows/Ubuntu 验收在相邻 VCPChat 工作树执行 `npm run test:native-sync-r5`。插件定向测试为本工作树 `npm run test:native-sync`，依赖放在实验区 sidecar，通过 `NODE_PATH` 解析。交接位于相邻 VCPChat 的 `docs/NATIVE_SYNC_R5_HANDOFF.md`。

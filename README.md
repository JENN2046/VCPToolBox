# VCPToolBox NativeSync R6 完整服务隔离工作树

基于 R5 `a73d00d` 建立独立工作树，保留原插件和共用鉴权，从 wp08 `/home/admin/VCPKF/vcp/versions/vcptoolbox-dev` 补齐已筛选的完整服务源码。逐文件核对见 `P:\VCPKF\vcp\artifacts\native-sync-r6\FULL_SOURCE_COMPARISON.json`；未复制真实配置、用户数据、依赖或生产原生二进制。原开发快照没有上游 Git 元数据，不给它填入未经验证的作者 SHA。

实际验收入口为 Ubuntu 的 `node --require ./scripts/native-sync-r6-preload.cjs server.js`。完整 server.js 的初始化、Rust 知识库、插件注册、HTTP/WebSocket 和 gracefulShutdown 均实际执行。预加载脚本只做 I/O 边界、观测和合成日志值屏蔽，没有替换应用模块或原生实现。

本轮产品代码的最小修复是 server.js 支持显式 `SERVER_BIND_HOST`；未设置时保留原绑定行为，实验固定为 127.0.0.1。其他插件在运行副本中通过现有 `.json.block` 机制关闭，TDB/心跳/分布式同步使用现有配置关闭。强制启动的知识库使用独立空目录、独立数据库、32 维索引并关闭启动扫描；NativeSync SQLite 使用另一个专用目录。

真实 Rust Vexus 从未修改的源码和锁文件离线构建，工具链、243 个校验过的官方 crate、Node 依赖、编译输出都在实验 artifacts 中；没有修改系统工具链或 Rust CDS。

在相邻 `vcpchat-native-sync-r6` 工作树运行 `npm run test:native-sync-r6`，会创建新的独占运行目录，执行完整应用闭环及插件关闭对照，并关闭所有本轮进程。当前已准备的 R6 实验依赖可直接复用；初次构建说明、完整日志、数据与关闭证明见相邻工作树 `docs/NATIVE_SYNC_R6_HANDOFF.md`。

R5 的 `native-sync-service-host.cjs` 保留供回归；R6 验收没有使用它。生产 `/app/VCPToolBox`、原开发快照和 R5 两笔提交保持不动；没有 Push、Merge 或正式安装。

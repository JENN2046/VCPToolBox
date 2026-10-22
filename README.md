# VCPToolBox NativeSync R5 隔离源码工作区

来源是 wp08 `/home/admin/VCPKF/vcp/versions/vcptoolbox-dev` 已筛选的开发源码快照。这里保留真实 PluginManager 的 13 文件本地依赖闭包、`server.js`（用于共用鉴权抽取）、必要清单和文档，再加入 NativeSync 插件及隔离验收宿主。

这是限定 Service Plugin 任务的部分源码工作区，当前可执行入口为 `native-sync-service-host.cjs` 的隔离实验配置；没有复制完整业务目录、真实配置、状态、生产依赖或生产数据。完整业务服务器的 `npm start` 不属于本工作区的验收入口。

本地源快照提交为 `1d0f87b`；原快照没有 Git 元数据，不能把它描述为已验证的作者上游 SHA。逐文件来源清单保存在 `P:\VCPKF\vcp\artifacts\native-sync-r5\TOOLBOX_SOURCE_PROVENANCE.json`。

实际插件入口、配置与路由见 `Plugin/NativeSync/README.md`。定向测试使用 `npm run test:native-sync`；完整 VCPChat 联调由相邻 VCPChat 的 `npm run test:native-sync-r5` 自动创建远端实验目录、启动真实 PluginManager 生命周期并清理进程。

生产 `/app/VCPToolBox` 和原开发快照保持不动；没有正式安装、Push 或 Merge。

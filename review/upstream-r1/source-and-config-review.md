# 源码、依赖及配置边界

- 固定Fork: fef48db3e0bea997e99d7e7bd9c8551ae2ddb593，Tree 8ce2e27e04a68e1a7686cd42515e16cfeac6e0a4。
- 固定上游: 393dc5e408f1dd521b4150946f77781ebabce399，Tree a8a71f97805905acb1ab8d9c6b6c5130839679cd。
- 共同祖先已实证 d9f61c0d0faedc62c6b0a6e9fc93151c51b1ad80；上游相对Fork可达的143提交全部通过merge祖先关系保留，没有追入后续main。
- 原Jenn本地master: e2373b3ef922cdee9796d53638f035be3f01c893，Tree a1008725056f160a082523524296b6fa401492a0；初始干净。master保持不动。本轮分支另起于固定fef48db3。
- 本机runtime/VCPToolBox工作区: 028bb4747c148cddf7545421aeced5a261bba8b7，Tree 39af1a74f336e9a86542fd9e8ece84afee79eced，带大量未提交运行改动；未纳入、未修改。本轮未检查其进程、配置或生产状态，不能把该Git HEAD解释为生产运行版本。
- runtime/VCPChat HEAD: 1f86d5912c6acb3588577945e19045edc1256731，dirty；仅14个无配置源码模块冻结只读取样，均与HEAD字节一致。未修改仓库。

## 语义复核范围

both-modified-files.txt列出双方都改过的全部路径。重点检查自动合并成功的Plugin.js、server.js、stream/nonStream handlers、OneRing和toolExecutor；冲突的chatCompletionHandler/Jev按双方契约合并。详见jenn-boundary-review.md及core-review.diff。

Plugin/FileOperator、agentManager、外部插件allowlist/safety gate/注册与env沙箱、Trusted Action/native transport等保护模块保持冻结Fork实现；实测守护见validation-results.json。OneRing未触发放行修复保留伪system消息、通知及Resident元数据；已覆盖未触发、触发、request-local临时前端契约。所有mock/合成测试不构成人类确认、真实provider或生产验收。

## 依赖与配置

根package-lock.json与冻结Fork无差异，runtime dependencies没有新增；package.json吸收ensure:admin/build:admin命令。根及AdminPanel npm ci固定锁、禁生命周期脚本后，仅在候选node_modules构建better-sqlite3。管理面板依赖锁与源码保留完整merge结果。

Rust Cargo.toml/Cargo.lock吸收上游reqwest/json/rustls、dotenvy、tiktoken-rs等以及workspace/geometry依赖变化，全部--locked构建，源码/产物hash和工具链见native-report.md及候选receipt。DeedPage保留自身package-lock但禁用manifest；VTrade没有额外npm依赖。

rag_params.json吸收上游contextWeights、base64MemoLimit、hydrationBatchSize、slowLogMs、minimumInjectedCurrent；preprocessor_order.json按上游加入MemoryThinkingTray。各新增工具/外访默认值的保守处理见upstream-exceptions.md。

未读取或输出真实config.env/.env内容。LinuxShell冲突配置通过Git固定对象恢复且与冻结Fork无diff；没有修改任何运行环境、身份、游标、真实记忆或数据库。所有隔离SQLite/HTTP测试使用临时合成数据及loopback绑定。

现有Linux CI仅将receipt精确指向已实际固定镜像双构建对应的新Linux记录；镜像、工具链、双构建cmp和GLIBC门不变。Windows/ARM等仍保持原有门，不能用Linuxreceipt冒充其他平台通过。没有触发远程CI。

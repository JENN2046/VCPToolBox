# Clean Upstream Core + Jenn External Runtime 对照验收计划

日期：2026-06-18

状态：PLAN_ONLY

## 0. 目的

本计划用于评估并约束一条新的 Jenn 外置化路线：

```text
Clean Upstream Core
  基于 lioensky/VCPToolBox upstream/main
  只保留通用桥接、契约接口、路径解析与安全策略

Jenn External Runtime
  承载 Jenn 插件、Agent、AdminPanel 扩展、AI Image adapter、摄影工作流

Jenn LocalState
  承载私有记忆、.agent_board、本地项目数据、真实配置与运行状态

Current Jenn Fork
  作为只读 inventory / parity reference
```

根本目标不是删除 Jenn 功能，而是让 core 重新接近 upstream，让 Jenn 自定义功能以外部 runtime 的形式挂载，让私有状态退出主仓跟踪范围。

## 1. 基本原则

1. 新 core 必须从干净 `upstream/main` 建立，不从当前厚 fork 继续堆业务逻辑。
2. core 只允许留下通用 contract / loader / resolver / safety policy。
3. Jenn 业务逻辑、固定 trial 数据、本地路径、插件实现、Agent 内容、摄影数据不得写回 clean core。
4. 外置内容必须 copy-first，生成 checksum 后再考虑 stub、untrack 或 remove。
5. 外部高权限能力默认 disabled，不得因外置化自动获得执行权。
6. 当前厚 fork 只作为行为参照，不再作为长期主施工面。
7. 每个迁移领域都必须有对照验收、验证命令、未验证项和 rollback 方式。

## 2. 状态标记

```text
PASS      已满足
PARTIAL   部分满足，可继续但必须记录风险
BLOCK     不满足且会阻断下一步
DEFERRED  明确延期，不作为当前阶段失败
N/A       不适用
```

## 3. 总体验收表

| 编号 | 验收项 | 通过标准 | 阻断条件 | 状态 |
| --- | --- | --- | --- | --- |
| A0 | 基线来源 | 新 core 来自已验证的 `upstream/main`，记录 remote URL、fetch 后 commit hash、创建方式 | 来源不清，remote 不是 `lioensky/VCPToolBox`，或混入当前 Jenn fork 历史改动 | TODO |
| A1 | 旧 fork 定位 | 当前厚 fork 只作为 inventory / parity reference | 继续在旧 `main` 上扩大源码改动 | TODO |
| A2 | core 改动性质 | core 只出现 loader / contract / path resolver / safety policy | core 出现 Jenn 业务名、私有路径、具体 trial id、大量业务逻辑 | TODO |
| A3 | patch 面积 | 长期 core patch 控制在少数核心文件，目标小于 10 个 | 为接 Jenn 功能改动大量 core/runtime/frontend 文件 | TODO |
| A4 | 外部目录职责 | Extensions 与 LocalState 职责清楚 | 插件、私有状态、配置、生成物混放 | TODO |
| A5 | copy-first | 外置内容先复制、生成 checksum，再考虑 stub/remove | 先删旧内容，或无 checksum 证明 | TODO |
| A6 | 默认安全 | 外部插件和高权限能力默认不自动启用 | 外部 shell/file/bridge/git 类能力默认启用 | TODO |
| A7 | secret 安全 | `.env`、`config.env`、token/key 不复制、不输出、不提交 | 任一真实 secret 进入外部包、日志、文档或提交 | TODO |
| A8 | 行为对照 | 每个领域都有旧 fork 对照项和验证方式 | 新 core 干净但无法证明旧功能是否保留 | TODO |
| A9 | upstream 追踪 | upstream merge 冲突集中在少量 contract/core patch | 冲突仍大量落在 Jenn 插件、Agent、状态、Admin 页面 | TODO |
| A10 | 回滚 | 每个领域能回退到 core fallback 或禁用外部包 | 迁移后只能依赖大范围 revert | TODO |

## 4. 推荐目录形态

以下路径使用占位写法，避免把本机绝对路径固化为治理规范。

```text
%WORKSPACE_PARENT%/VCPToolBox-upstream-core
  Clean upstream core 工作目录
  只做通用 contract / loader patch

%WORKSPACE_PARENT%/VCPToolBox-JENN-Extensions
  Jenn 插件、Agent、AdminPanel 扩展、AI Image adapter、摄影工作流

%WORKSPACE_PARENT%/VCPToolBox-JENN-LocalState
  私有记忆、.agent_board、本地状态、私有配置、项目数据

%WORKSPACE_PARENT%/VCPToolBox
  当前厚 fork，只读参考源与行为对照来源
```

当前本机可将 `%WORKSPACE_PARENT%` 映射为 `A:\AGENTS_OS_Workspace\runtime`，但该映射只用于本机执行，不作为跨环境规范。

## 5. 分域验收表

| 领域 | Clean Upstream Core 应留下什么 | Jenn External Runtime 应放什么 | 通过标准 | 状态 |
| --- | --- | --- | --- | --- |
| Plugin | `VCP_PLUGIN_DIRS` loader、manifest 合并、安全禁用规则 | Jenn 自定义插件目录 | 外部插件可发现；默认 disabled；不覆盖 upstream 同名插件 | TODO |
| Agent | `VCP_AGENT_DIRS`、`VCP_AGENT_OVERRIDE_DIRS` | Jenn Agent、AgentOverrides | upstream Agent 不被直接改；override 顺序明确 | TODO |
| LocalState | `VCP_LOCAL_STATE_DIR` path resolver | `.agent_board`、`MEMORY.md`、摄影数据、私有配置 | 未设置 env 时保持 upstream 行为；设置后读外部状态；不写入 core | TODO |
| AdminPanel | extension manifest contract、route/api 注册口 | Jenn 页面、API 扩展、菜单配置 | upstream 页面正常；Jenn 页面通过 manifest 注册；build 通过 | TODO |
| AI Image | 通用 adapter contract、默认关闭 gating | Jenn fixture、binding、trial data、provider-specific adapter | core 不含具体 Jenn trial 常量；route/server 只依赖通用接口 | TODO |
| Codex/Memory | 通用桥接接口或无 core 改动 | CodexMemoryBridge、Jenn memory 工具 | 不读取真实记忆内容做测试；只验证路径/manifest | TODO |
| PhotoStudio | 通用插件加载能力 | PhotoStudio 插件、数据、任务模板 | 摄影项目数据不进 core；插件默认不自动外写 | TODO |
| Governance Docs | 最少必要迁移记录 | 详细 Jenn 迁移台账、proof、checksum | core 不堆大量历史 proof；证据在外部治理目录可追溯 | TODO |

## 6. 单项迁移验收模板

每迁移一个领域，必须填写：

```text
领域：
旧 fork 来源路径：
旧 fork reference commit：
source manifest：
新 external 目标路径：
core contract 文件：
是否 copy-first：
checksum：
默认启用状态：
旧行为对照：
parity cases：
expected disabled/enabled behavior：
known gaps：
验证命令：
未验证项：
rollback：
是否可 stub/remove 旧 core：
结论：PASS / PARTIAL / BLOCK
```

## 7. 阶段计划

### Phase 0：只读基线确认

目标：

```text
确认 `upstream` remote URL 指向 `https://github.com/lioensky/VCPToolBox.git`
执行 `git fetch upstream` 后记录 `git rev-parse upstream/main`
确认 clean core 目录创建方式：独立 clone / git worktree / 其他，并记录命令
确认当前 Jenn fork 只作为参考源
确认 external runtime / localstate 目标目录尚未混入 secret
确认不在当前厚 fork 上继续扩大源码改动
```

产出：

```text
upstream remote URL 记录
fetch 后 `upstream/main` commit 记录
clean core 目录创建方式记录
旧 fork inventory 清单
初版迁移台账
secret-risk paths only 扫描结果
```

禁止：

```text
commit
push
deploy
删除旧文件
复制 secret
启动生产服务
运行真实 shell/file/bridge/provider 外写
```

### Phase 1：Clean Core Contract Skeleton

目标是在 clean upstream core 中添加最小通用契约。

候选 contract：

```text
VCP_PLUGIN_DIRS
VCP_AGENT_DIRS
VCP_AGENT_OVERRIDE_DIRS
VCP_LOCAL_STATE_DIR
VCP_ADMIN_EXTENSION_DIRS
AI Image adapter contract
```

通过标准：

```text
core diff 很薄
没有 Jenn 业务常量
没有私有路径
没有 provider/trial 具体数据
没有高权限默认启用
```

### Phase 2：External Runtime Skeleton

目标：

```text
建立 Jenn Extensions / Jenn LocalState 骨架
写入 .gitignore
建立 manifests/ 与 checksum 规则
选择第一个 shadow 试点
```

推荐 `.gitignore` 基线：

```gitignore
.env
.env.*
config.env
**/config.env
*.key
*.pem
*.p12
*.sqlite
*.db
node_modules/
dist/
.cache/
```

### Phase 3：第一个试点

推荐试点：

```text
AIGentOrchestrator external shadow load
```

原因：

```text
最能验证插件外置机制
与原外置化计划高度相关
可保持默认 disabled
可保留 core fallback
不必先触碰 AdminPanel build 或 LocalState 私有数据
```

通过标准：

```text
从旧 fork copy-first 到 external runtime
生成 checksum
clean core 可发现外部插件 manifest
外部插件默认 disabled
不覆盖 upstream 同名插件
不执行插件
不写 LocalState
不接触 provider / bridge / shell / file 外写
rollback 可通过禁用外部目录或保留 core fallback 完成
```

### Phase 4：Shadow Validation

目标：

```text
证明外部 runtime 可被发现但不会自动执行
证明 clean core 默认行为仍接近 upstream
证明旧 fork 行为有对照，不是凭感觉迁移
```

最小验证：

```text
git status --short
git diff --stat
node --check changed-js-files
targeted manifest/loader tests
secret-risk paths only scan
checksum verification
```

不得声称：

```text
全量行为兼容，除非已经有完整 parity 测试
生产可用，除非经过单独生产前置审批
已完成外置化，除非旧 core stub/remove 与 upstream merge 验证都完成
```

### Phase 5：Stub / Untrack / Remove Decision

只有满足以下条件，才进入 stub 或 untrack：

```text
copy-first 完成
checksum 完成
外部 runtime shadow validation 通过
core fallback 或 rollback 仍可用
无 secret 泄漏
目标测试通过
人工确认该领域可以离开 core
```

禁止：

```text
无 checksum 删除旧文件
无 parity 证明宣称完成
将 LocalState 私有数据留在 core
将 Jenn 业务逻辑重新写回 clean core
```

## 8. 第一试点验收表：AIGentOrchestrator

| 项目 | 目标 | 状态 |
| --- | --- | --- |
| 来源路径 | 当前厚 fork 的 `Plugin/AIGentOrchestrator/` | TODO |
| external 目标路径 | `../VCPToolBox-JENN-Extensions/Plugin/AIGentOrchestrator/` | TODO |
| core contract | `VCP_PLUGIN_DIRS` 外部插件发现能力 | TODO |
| 默认状态 | disabled / not auto-enabled | TODO |
| `.disabled` 语义 | copy-first 必须保留 `.disabled`，或在 external manifest / loader policy 中提供等价禁用证据 | TODO |
| copy-first | 先复制，不删除旧副本 | TODO |
| checksum | 生成 external manifest checksum | TODO |
| secret 安全 | 不复制 `.env` / `config.env` / token/key | TODO |
| fallback | core 旧副本或禁用 external dir 可回退 | TODO |
| validation | manifest discovery targeted test | TODO |
| disabled validation | targeted test 必须证明 external 副本被发现后仍不会自动启用或执行 | TODO |
| 禁止项 | 不执行插件，不启动服务，不外写 | TODO |

## 9. 红线

出现以下任一情况，当前阶段判定为 BLOCK：

```text
core 写入 Jenn 专用业务逻辑
core 写入私有本地路径或具体 trial id
外部高权限插件默认自动启用
真实 secret 被复制、打印或提交
没有 checksum 就删除旧文件
没有 parity checklist 就宣称迁移完成
为了接外部包大改 Plugin.js / server.js / AdminPanel
外部 repo / remote / release / deploy 未授权执行
```

## 10. 当前建议

建议采用：

```text
Clean upstream core 作为新战略主线
当前厚 fork 作为只读参考源
94D 作为临时桥接证据保留，但不继续把 core 内整理当作最终外置化
第一个试点选择 AIGentOrchestrator external shadow load
```

下一步不是执行迁移，而是先做只读基线确认和第一试点任务书。

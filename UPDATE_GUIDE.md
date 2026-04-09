# VCPToolBox 分支与更新指南

> 本文档说明本仓库的分支结构、自定义内容分布，以及如何安全地从上游合并更新。

---

## 一、分支结构

| 分支 | 说明 |
|------|------|
| `upstream/main` | 作者官方仓库最新状态，所有更新以此为基准 |
| `main` | 本仓库的 main 分支，跟踪上游更新 |
| `safe-upstream-main-*` | 自定义功能分支，保留所有本地开发内容 |

---

## 二、自定义内容清单（upstream 没有的）

### 核心自研模块

| 模块 | 文件数 | 说明 |
|------|--------|------|
| **ChannelHub 消息通道系统** | ~35 | 完整的多渠道消息路由、会话绑定、审计日志、媒体网关 |
| **IM 适配器（4 套）** | ~38 | 钉钉 / 飞书 / OneBot(QQ) / 企业微信 |
| **SheetAI 电子表格** | ~5 | 工作簿数据 + 路由 |
| **adminServer.js** | 1 | 独立管理面板进程 |
| **vcp-panel-extension** | 4 | VS Code 面板扩展 |

### 自定义插件

| 插件 | 文件数 | 说明 |
|------|--------|------|
| WeeklyReportGenerator | 4 | 周报生成器 |
| WorkLogScheduler | 4 | 工作日志调度器 |
| RAGMonitor / Express / Widget | 5 | RAG 监控组件 |
| MCPO / MCPOMonitor | 2 | MCP 兼容协议 manifest |
| SynapsePusher | 1 | 记忆推送 |
| TagFolder | 1 | 标签文件夹 |

### Agent 角色文件

- `AuditMaster.txt` / `MemoriaSorter.txt` / `clawclaw`
- `动物园管理员.txt` / `卡拉卡拉猎手.txt` / `小芸.txt` / `诺亚.txt`

### 对话数据

- `Plugin/DailyNote/dailynote/Nova/` — Nova 的对话日记

---

## 三、更新流程

### 前置检查

```bash
# 确保工作目录干净
git status

# 查看 upstream 最新状态
git fetch upstream
git log --oneline upstream/main -3
```

### 步骤 1：创建备份分支

```bash
git branch backup-$(date +%Y%m%d)
```

> 保险措施，任何时候都可以 `git reset --hard backup-xxx` 回滚。

### 步骤 2：执行合并

```bash
git merge main
```

### 步骤 3：处理冲突

冲突分两类：

#### A 类：删除冲突（你保留的文件被 main 删除了）

约 60 个文件。一键保留你的版本：

```bash
# 保留所有"你独有但 main 已删除"的文件
git diff --name-only --diff-filter=DU | xargs git checkout --ours
```

也可以逐个处理：
```bash
git checkout --ours <文件路径>
git add <文件路径>
```

#### B 类：修改冲突（双方都改了）

约 40 个文件。查看列表：

```bash
git diff --name-only --diff-filter=U
```

每个文件三种选择：

| 操作 | 命令 | 适用场景 |
|------|------|----------|
| 保留你的版本 | `git checkout --ours <file>` | 你的改动是关键自定义逻辑 |
| 保留 main 版本 | `git checkout --theirs <file>` | upstream 的更新更重要 |
| 手动合并 | 编辑文件，删除 `<<<<<<<` 标记 | 需要保留两边的改动 |

**重点关注文件**：
- `server.js` — 核心启动逻辑
- `Plugin.js` — 插件管理器
- `WebSocketServer.js` — 通信骨架
- `modules/messageProcessor.js` — 消息处理
- `modules/chatCompletionHandler.js` — 对话补全
- `modules/handlers/streamHandler.js` — 流式处理

### 步骤 4：完成合并

```bash
# 确认没有未解决的冲突
git diff --name-only --diff-filter=U

# 如果有未解决的，逐个处理后再继续
# ...

# 提交合并
git add -A
git commit
```

### 步骤 5：验证

```bash
# 启动服务器确认一切正常
node server.js
```

---

## 四、回滚

如果合并后出现问题：

```bash
# 方式 1：撤销合并（刚合并完还没 push 时）
git merge --abort

# 方式 2：回退到备份点
git reset --hard backup-20260409
```

---

## 五、冲突处理速查表

```bash
# 查看所有冲突文件
git diff --name-only --diff-filter=U

# 保留你的版本
git checkout --ours <file>

# 保留 upstream 版本
git checkout --theirs <file>

# 查看某个文件的具体冲突
git diff <file>

# 标记某个文件已解决
git add <file>

# 查看还有哪些文件没解决
git status --short | grep UU
```

---

## 六、注意事项

1. **合并前先备份** — `git branch backup-$(date +%Y%m%d)`
2. **不要使用 `git merge --no-edit`** — 合并提交信息很重要
3. **核心文件不要盲目 `--theirs`** — 特别是 `server.js` 和 `Plugin.js`
4. **合并后务必测试启动** — `node server.js` 确认无报错
5. **自定义插件的 manifest 注意 API 变更** — upstream 可能改了插件接口

---

*最后更新：2026-04-09*
*基于 upstream commit: af39bcf (PaperReader Rust PR)*

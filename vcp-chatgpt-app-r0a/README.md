# VCP-APP

当前正式项目名为 **VCP-APP**。历史 `R0-A` acceptance 名称、commit、service/path 与 schema literal 继续作为 provenance 保留，不做追溯改写。

目标只有一个：

```text
ChatGPT / Codex
      ↓
MCP Streamable HTTP
      ↓
VCP-APP :3010/mcp
      ↓
VCPToolBox 主服务器 :6005
```

**当前主链不经过 VCPBridgeServer。**

如果 R0-A 的真实测试证明直接 `:6005` 存在无法解决的兼容问题，才进入 R0-B（VCPBridgeServer fallback）。

## 暴露的 MCP tools

| Tool | VCP 入口 | 用途 |
|---|---|---|
| `vcp_status` | `GET /v1/models` | 验证 VCP 认证与连通性 |
| `vcp_memory_search` | `POST /v1/human/tool` → `LightMemo` | 语义召回 Hot Memory / Cold TDB |
| `vcp_memory_read` | server-authorized DailyNote root | 按 exact `folder + file_name` 稳定读取一个 Hot Memory 正文，不进入 native tool loop |
| `vcp_memory_create` | `POST /v1/human/tool` → `DailyNote create` | 明确授权后写长期记忆 |
| `vcp_memory_update` | `POST /v1/human/tool` → `DailyNote update` | 唯一目标预检后更新 server-owned 长期记忆 |
| `vcp_call_tool` | `POST /v1/human/tool` | 调任意已知 VCP native tool |
| `vcp_chat` | `POST /v1/chat/completions` | 进入完整 VCP chat / preprocessor / tool-loop 主链 |

`vcp_chat` 会把 `VCP_SYSTEM_PROMPT_FILE` / `VCP_SYSTEM_PROMPT` 中配置的固定 system prompt
一起发给 VCP。只要其中使用了你的真实记忆占位符，VCP 主链即可按自身配置触发
RAGDiaryPlugin、TagMemo/RiverMemo、OneRing、VCPTimeLine、ContextFoldingV2 等预处理能力。

---

## 0. 要求

- Node.js >= 20.6
- VCPToolBox 主服务已经运行
- 默认 VCP 地址：`http://127.0.0.1:6005`
- 你知道 VCP `config.env` 中的 `Key=...`
- `Key` 不是上游模型的 `API_Key`

---

## 1. 安装

```bash
unzip vcp-chatgpt-app-r0a.zip
cd vcp-chatgpt-app-r0a

cp .env.example .env
```

编辑 `.env`：

```env
VCP_BASE_URL=http://127.0.0.1:6005
VCP_API_KEY=你的VCP配置里的Key
```

安装依赖（按 `package-lock.json` 做可复现安装）：

```bash
npm ci
```

本地开发若明确需要更新 lockfile，才使用 `npm install`。

依赖固定为：

- `@modelcontextprotocol/sdk 1.30.0`
- `express 5.2.1`
- `zod 3.25.26`

---

## 2. 先跑不依赖真实 VCP 的测试

### 2.1 Direct adapter unit test

```bash
npm test
```

覆盖：

- VCP `TOOL_REQUEST` framing
- framing injection 拒绝
- `GET /v1/models`
- `POST /v1/human/tool`
- `POST /v1/chat/completions`
- Bearer Key
- system prompt 进入 VCP chat body

### 2.2 完整 MCP → Mock VCP E2E

```bash
npm run e2e:mock
```

它会临时启动：

```text
MCP :13010
  ↓
Mock VCP :16005
```

并通过 MCP client 真正执行：

1. initialize
2. tools/list
3. `vcp_status`
4. `vcp_memory_search`
5. `vcp_memory_read`
6. `vcp_memory_create`
7. `vcp_memory_update`
8. `vcp_call_tool`
9. `vcp_chat`

成功终点：

```text
PASS_R0A_FULL_MOCK_E2E
```

---

## 3. 真实 VCP :6005 — 第一阶段只测连通

保持 `.env`：

```env
VCP_SMOKE_MEMORY=false
VCP_SMOKE_CHAT=false
```

运行：

```bash
npm run smoke:vcp
```

成功终点：

```text
PASS_R0A_DIRECT_VCP_SMOKE
```

这一步只证明：

```text
R0-A process
   ↓
VCP :6005
   ↓
Bearer Key accepted
```

---

## 4. 真实主动记忆测试：LightMemo

把 `.env` 改为：

```env
VCP_SMOKE_MEMORY=true
VCP_SMOKE_QUERY=你确定在记忆里存在的一个查询
VCP_SMOKE_K=3
```

如果知道具体日记目录，优先填：

```env
VCP_SMOKE_FOLDER=你的真实日记文件夹
```

或者：

```env
VCP_SMOKE_MAID=你的真实Agent署名
```

`vcp_memory_search` 的作用域字段是显式分层的：`folder` / `maid` 只用于 Hot DailyNote；Cold TDB 使用一等参数 `knowledge_base`。`folder` 不会被自动解释为 Cold library。多个 Cold library 可继续使用 LightMemo 原生的逗号分隔库名语义。

再运行：

```bash
npm run smoke:vcp
```

这一门证明：

```text
R0-A
 ↓
:6005/v1/human/tool
 ↓
PluginManager.processToolCall
 ↓
LightMemo
 ↓
VCP memory result
```

---

## 5. 真实完整 VCP cognition / passive-memory pipeline

### 5.1 配置你的 VCP system profile

项目附带：

```text
profiles/vcp-memory.example.txt
```

先复制并替换为你的真实 Agent / 日记本名称，然后在 `.env` 指向它：

```env
VCP_SYSTEM_PROMPT_FILE=profiles/你的真实profile.txt
VCP_DEFAULT_MODEL=你在VCP里实际可用的模型
VCP_SMOKE_CHAT=true
```

`VCP_SYSTEM_PROMPT_FILE` 只定义 VCP chat/cognition persona。持久记忆写权限使用独立配置：

```env
VCP_MEMORY_MAID=NuobaoChatGPT
VCP_MEMORY_OWNED_FOLDERS=NuobaoChatGPT,NuobaoChatGPT的知识,Nobao-Episodes,Nobao-Projects,Nobao-Profile,Nobao-Lessons,Nobao-Archive
VCP_DAILYNOTE_ROOT=/absolute/path/to/VCPToolBox/dailynote
```

`vcp_memory_read` 只读取 Hot DailyNote：`folder` 必须是 configured owned folder，`file_name` 必须是该目录下 exact、安全的 `.txt/.md` 文件名；可选 `maid` 仅作 owner compatibility assertion，不能切换 server-configured owner。成功时返回 exact body、SHA-256、size 与 mtime，并且不调用 `/v1/human/tool`。

`vcp_memory_update` 不接受 `maid`、native tool、command 或文件路径。它只允许 exact owned folder，
并在调用 `DailyNote/update` 前按 native 匹配规则确认全局只有一个候选且该候选是目标目录中的逐字匹配。

这个 profile 可以包含例如：

```text
[[ContextFoldingV2]]
[[OneRing::你的Agent::VCPChat]]
[[VCPTimeLine::你的Agent]]
[[你的日记本::Time::Group::TagMemo]]
```

运行：

```bash
npm run smoke:vcp
```

这一门验证：

```text
R0-A
 ↓
:6005/v1/chat/completions
 ↓
VCP message-preprocessor chain
 ↓
RAG / OneRing / Timeline / ContextFolding / ...
 ↓
VCP model + tool loop
```

---

## 6. 启动 MCP Server

终端 A：

```bash
npm start
```

默认：

```text
http://127.0.0.1:3010/mcp
```

本地健康检查：

```bash
curl http://127.0.0.1:3010/healthz
curl http://127.0.0.1:3010/readyz
```

### 6.1 当前生产 user-systemd 恢复

仓库中的 `deploy/systemd/vcp-r0a.service` 是当前生产主机使用的 exact unit；当前安装位置为：

```text
~/.config/systemd/user/vcp-r0a.service
```

同一主机/同一路径恢复时，在完成 `npm ci` 与 `.env` 配置后：

```bash
mkdir -p ~/.config/systemd/user
cp deploy/systemd/vcp-r0a.service ~/.config/systemd/user/vcp-r0a.service
systemctl --user daemon-reload
systemctl --user enable --now vcp-r0a
systemctl --user is-active vcp-r0a
```

应返回：

```text
active
```

随后确认：

```bash
curl http://127.0.0.1:3010/readyz
```

当前 unit 精确绑定：

```text
WorkingDirectory=/mnt/datadisk0/apps/AGENTS_OS_Workspace/runtime/VCPToolBox-upstream-core/vcp-chatgpt-app-r0a
ExecStart=/home/ubuntu/.local/node/bin/node --env-file=.env src/server.mjs
```

如果 checkout 路径、运行用户或 Node 安装路径不同，必须先修改 unit 中对应路径，再复制到 user-systemd；不要把当前生产主机绑定误当成跨主机通用路径。

`deploy/systemd/` 还保存 tunnel / healthcheck 支持单元。它们属于可恢复部署资产，但只有在对应 tunnel/profile/healthcheck 前置配置已经具备时才应启用。

---

## 7. 真正验证 MCP → VCP :6005

终端 B：

```bash
npm run smoke:mcp
```

成功终点：

```text
PASS_R0A_MCP_TO_VCP_SMOKE
```

如果 `.env` 已打开：

```env
VCP_SMOKE_MEMORY=true
VCP_SMOKE_CHAT=true
```

这个 smoke 会继续通过 MCP 调：

- `vcp_memory_search`
- `vcp_chat`

因此完整验证：

```text
MCP Client
  ↓
R0-A MCP Server
  ↓
VCP :6005
  ↓
memory / cognition
```

---

## 8. MCP Inspector

OpenAI 当前建议在连接 ChatGPT 前先用 MCP Inspector 检查 Streamable HTTP：

```bash
npx @modelcontextprotocol/inspector
```

选择 **Streamable HTTP**：

```text
http://127.0.0.1:3010/mcp
```

至少确认：

1. initialize 成功
2. tools/list 能看到 7 个 VCP tools
3. `vcp_status` 成功
4. `vcp_memory_search` 成功
5. `vcp_memory_read` schema 为 `folder/file_name/maid?`，且标注 read-only
6. `vcp_memory_update` schema 只包含 `folder/target/replace`
7. `vcp_chat` 成功

---

## 9. 让 ChatGPT 访问本机 MCP

不要把 VCP `:6005` 暴露到公网。

推荐链：

```text
ChatGPT
   ↓
OpenAI Secure MCP Tunnel
   ↓
127.0.0.1:3010/mcp
   ↓
127.0.0.1:6005
```

`tunnel-client` 应与 MCP Server 运行在同一台能访问 `127.0.0.1:3010/mcp` 的机器/网络里。

先按 OpenAI Platform 的 Tunnel 设置创建 tunnel，然后：

```bash
tunnel-client help quickstart
tunnel-client doctor --profile <你的profile> --explain
tunnel-client run --profile <你的profile>
```

该 profile 的 MCP server URL 指向：

```text
http://127.0.0.1:3010/mcp
```

之后在 ChatGPT 的 developer-mode app 创建流程中选择 **Tunnel**。

---

## R0-A PASS 条件

只有下面全部成立，才算“GPT → MCP App → VCP :6005 跑通”：

```text
PASS A1  real VCP auth/connectivity
PASS A2  LightMemo through /v1/human/tool
PASS A3  VCP full chat pipeline
PASS A4  MCP initialize + tools/list + tool calls
PASS A5  ChatGPT developer-mode app can call the MCP tools
```

A1–A4 不通过时，先修 R0-A。

只有证明直接 `:6005` 的失败点必须由代理/协议转换层解决，才进入：

```text
R0-B
GPT
 ↓
MCP App
 ↓
VCPBridgeServer
 ↓
VCP :6005
```

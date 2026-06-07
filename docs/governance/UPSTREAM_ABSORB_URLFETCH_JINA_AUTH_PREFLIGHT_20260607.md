# UrlFetch JinA Auth Preflight - 2026-06-07

本文件记录 upstream `09fdab2a`（"为URLFetch引入JinA鉴权访问模式"）在当前
`JENN2046/VCPToolBox:main` 上的只读 preflight 结论。

本 preflight 不吸收代码，不修改 `Plugin/UrlFetch/*`，不修改真实
`config.env`，不运行真实 URL/Jina/代理/Puppeteer 请求，不写入
`knowledge/` 或任何运行态文件。

## 1. 基线

| 项目 | 值 |
|------|----|
| 本地分支 | `codex/urlfetch-jina-auth-preflight-20260607` |
| 本地基线 | `1c93663c Merge pull request #193 from JENN2046/codex/role-divider-array-metadata-20260607` |
| upstream 来源 | `upstream/main` |
| 本轮 fetch | `upstream/main` 从 `9a80e4dd` 更新到 `a8250db3` |
| 目标 upstream commit | `09fdab2a` |
| 工作树 | preflight 开始前 clean |

## 2. Upstream `09fdab2a` 内容

`09fdab2a` 修改 3 个文件：

| 文件 | upstream 意图 |
|------|---------------|
| `Plugin/UrlFetch/UrlFetch.js` | 新增 `https` 请求路径、`JINA_API_KEY` / `JINA_READER_TIMEOUT_MS` 读取、`requestJinaReader()`、`fetchWithJinaReader()`，并在 `mode === 'jina'` 时使用 Jina Reader。 |
| `Plugin/UrlFetch/config.env.example` | 增加 `JINA_API_KEY=` 和 `JINA_READER_TIMEOUT_MS=20000` 示例说明。 |
| `Plugin/UrlFetch/plugin-manifest.json` | 把 `mode: jina` 写进插件描述和示例。 |

上游行为策略：

- `JINA_API_KEY` 可选；
- key 看起来可用时先走 Authorization Bearer 鉴权；
- 鉴权失败后回退免费 `https://r.jina.ai/` 模式；
- 免费模式失败后抛出合并错误；
- `mode: jina` 是显式模式，不改变默认 `text` 路径。

## 3. 当前 main 对照

当前 `main` 已有这些对应实现：

| 检查点 | 当前 main 状态 | 证据 |
|--------|----------------|------|
| `JINA_API_KEY` / `JINA_READER_TIMEOUT_MS` env 读取 | 已存在 | `Plugin/UrlFetch/UrlFetch.js` lines near env block；`git blame` 指向 `b5fd3a33` |
| `requestJinaReader(targetUrl, apiKey)` | 已存在 | 使用 `https.get()` 访问 `https://r.jina.ai/<targetUrl>`，设置 Accept/User-Agent，并在有 key 时设置 `Authorization: Bearer ...` |
| 鉴权失败回退免费模式 | 已存在 | `fetchWithJinaReader()` 先尝试 api key，再尝试无 key 免费模式 |
| `mode === 'jina'` 显式调用 | 已存在 | main request dispatch 中 `mode === 'jina'` 调 `fetchWithJinaReader(url)` |
| `config.env.example` 示例 | 已存在 | 已包含 `JINA_API_KEY=` 与 `JINA_READER_TIMEOUT_MS=20000` |
| manifest 文档 | 已存在且更宽 | 当前 manifest 已描述 `text` / `jina` / `download` / `snapshot` / `image` / `file:///` |

当前 main 还比 `09fdab2a` 更进一步：

- `mode: text` 已有 direct HTTP fast path，失败后回退 Puppeteer；
- `mode: download` 支持 `sourceMode: jina`，默认先 Jina 后 text fallback；
- `config.env.example` 仍保留 cookies / proxy 说明；
- manifest 已包含 download 相关参数和示例。

## 4. 风险判断

不建议 raw cherry-pick `09fdab2a`：

1. 当前 main 已覆盖核心 Jina 鉴权行为，raw cherry-pick 没有新增价值。
2. upstream commit 基于更旧的 UrlFetch 形态，不包含本地后续 `download`、direct HTTP fast path、安全保存与 fallback 改造。
3. raw cherry-pick 可能倒退 manifest 描述，漏掉当前本地 `download` / `sourceMode` 能力。
4. 真实 Jina 请求会产生外部网络访问，不适合在 preflight 中运行。
5. `JINA_API_KEY` 属于可选 secret-like 配置，只能记录 example，不得读取或打印真实值。

## 5. 结论

`09fdab2a` 不需要再开行为实现包。

当前状态应从主台账里的“已审未吸收 / 如需要单独开 UrlFetch JinA auth 包”
修正为：

> 已由当前 main 覆盖。Jina Reader 鉴权模式、免费模式回退、timeout env、
> config.env.example 和 manifest 说明均已存在；实现主要来自本地
> `b5fd3a33` 之后的 UrlFetch 吸收线，并与后续 download/direct fast path
> 改造共存。无需 raw cherry-pick `09fdab2a`。

## 6. 后续建议

| 后续动作 | 建议 |
|----------|------|
| 台账核销 | 可开单文件台账修正包，把 `09fdab2a` 从“已审未吸收”改为“当前 main 已覆盖”。 |
| 代码实现 | 暂不需要。除非后续要改变 Jina 行为，否则不要修改 `Plugin/UrlFetch/UrlFetch.js`。 |
| 测试补强 | 如需更强证据，可后续单独做纯静态/可 mock 的 UrlFetch Jina helper 测试设计；不得在默认测试中访问真实 Jina。 |
| 配置 | 不修改真实 `Plugin/UrlFetch/config.env` 或根 `config.env`。 |

## 7. 本轮验证边界

允许：

```powershell
git diff --check
rg -n "JINA_API_KEY|JINA_READER_TIMEOUT_MS|fetchWithJinaReader|mode === 'jina'" Plugin\UrlFetch
```

不允许：

- 真实访问 `https://r.jina.ai/`;
- 使用真实 `JINA_API_KEY`;
- 启动 Puppeteer 访问外网；
- 写入 `knowledge/`;
- 修改 `Plugin/UrlFetch/config.env`;
- 修改 `Plugin/UrlFetch/*` 行为文件。

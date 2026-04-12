# CodexMemoryBridge - Codex 专用记忆写入通道

**版本:** 1.0.0  
**最后更新:** 2026-04-12  
**适用范围:** `Plugin/CodexMemoryBridge/`

---

## 1. 概述

CodexMemoryBridge 是 `Codex` 的专用记忆写入通道。它把普通记忆写入从“提示词约束”升级为“工具层强约束”，并保留审计日志，方便追溯每一次写入决策。

它不属于 RAG 检索链路，不参与上下文召回，也不替代梦境系统。

在整套 VCP 记忆闭环里，CodexMemoryBridge 处于“入口治理层”。总览关系图见 [`MEMORY_SYSTEM.md`](./MEMORY_SYSTEM.md) 中的 `VCP Agent Memory Loop`。

## 2. 写入目标

- `process`
- `knowledge`

`process` 用于阶段结论、风险、待办、检查点等过程性记忆。  
`knowledge` 用于稳定、可复用、已验证的知识性记忆。

## 3. 约束规则

- `sensitivity` 必须是 `none`
- `content` 和 `evidence` 不能为空
- `target=knowledge` 时必须同时满足 `validated=true` 和 `reusable=true`
- `target=process` 时内容中必须显式包含 `checkpoint`、`risk`、`todo`、`pending` 或 `stage-conclusion`
- 任意不满足条件时都走 `fail-closed`

## 4. 执行上下文

CodexMemoryBridge 依赖工具层注入的执行上下文来识别调用者。

主进程链路现在会把 `executionContext` 继续传到子进程，并通过环境变量暴露：

- `VCP_EXECUTION_CONTEXT`
- `VCP_AGENT_ALIAS`
- `VCP_AGENT_ID`
- `VCP_REQUEST_SOURCE`

如果 `agentAlias` 不是 `Codex`，桥接器会拒绝写入。

## 5. 审计日志

每次桥接器决策都会追加到 `logs/codex-memory-bridge.jsonl`，字段如下：

- `timestamp`
- `agentAlias`
- `agentId`
- `decision`
- `target`
- `reason`
- `filePath`

## 6. 与梦系统的边界

- 梦系统保持独立写入通道
- 梦日记可以继续使用 `DailyNote` / `DailyNoteWrite`
- CodexMemoryBridge 只限制 Codex 的普通记忆写入，不限制梦通道

## 7. 相关文件

- [`Plugin/CodexMemoryBridge/plugin-manifest.json`](../Plugin/CodexMemoryBridge/plugin-manifest.json)
- [`Plugin/CodexMemoryBridge/codex-memory-bridge.js`](../Plugin/CodexMemoryBridge/codex-memory-bridge.js)
- [`modules/vcpLoop/toolExecutor.js`](../modules/vcpLoop/toolExecutor.js)
- [`Plugin.js`](../Plugin.js)

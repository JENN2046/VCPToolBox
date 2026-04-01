# DingTalkTable 插件

> 钉钉 AI 表格写入插件 - 将 AI 生成的日报/周报写入钉钉 AI 表格

---

## 功能特性

- **写入日报**: 将 AI 生成的日报内容写入钉钉 AI 表格
- **写入周报**: 将 AI 生成的周报内容写入钉钉 AI 表格
- **MCP 工具调用**: 直接调用底层钉钉 MCP 工具
- **列出表格**: 获取可用的钉钉 AI 表格列表

---

## 配置

复制 `config.env.example` 为 `config.env`:

```bash
cp config.env.example config.env
```

编辑 `config.env`:

```env
# MCP 服务器地址
DINGTALK_MCP_URL=http://127.0.0.1:9000

# MCP 服务器 API 密钥
DINGTALK_MCP_KEY=vcp-mcpo-secret

# 默认表格 UUID（可选）
DINGTALK_TABLE_UUID=your_table_uuid

# 时区设置
DEFAULT_TIMEZONE=Asia/Shanghai
```

---

## 使用方法

### 1. 写入日报

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」DingTalkTable「末」,
action:「始」write_daily_report「末」,
content:「始」今日完成：1.项目评审 2.功能开发 3.Bug 修复「末」,
report_date:「始」2026-03-30「末」
<<<[END_TOOL_REQUEST]>>>
```

### 2. 写入周报

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」DingTalkTable「末」,
action:「始」write_weekly_report「末」,
content:「始」本周完成：项目 A 上线、项目 B 开发中...「末」,
summary:「始」第 13 周工作总结「末」
<<<[END_TOOL_REQUEST]>>>
```

### 3. 列出可用表格

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」DingTalkTable「末」,
action:「始」list_tables「末」
<<<[END_TOOL_REQUEST]>>>
```

### 4. 调用 MCP 工具

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」DingTalkTable「末」,
action:「始」call_mcp_tool「末」,
tool_name:「始」add_record「末」,
arguments:「始」{"table_uuid": "xxx", "data": {"field1": "value1"}}「末」
<<<[END_TOOL_REQUEST]>>>
```

---

## 架构

```
用户请求 → VCP 服务器 → DingTalkTable 插件 → MCP 客户端 → 钉钉 AI 表格 API
                                      ↓
                              MCP 服务器 (mcporter)
```

---

## 依赖

- Node.js 18+
- MCP 服务器 (mcporter)
- 钉钉 AI 表格访问权限

---

## 故障排除

### 问题：MCP 连接失败

**解决方案**:
1. 检查 MCP 服务器是否运行
2. 确认 `DINGTALK_MCP_URL` 配置正确
3. 验证 API 密钥是否正确

### 问题：表格 UUID 无效

**解决方案**:
1. 使用 `list_tables` 命令查看可用表格
2. 确认表格 UUID 格式正确
3. 检查表格访问权限

---

## 相关文档

- [工作日志系统实现方案](../../docs/VCP 交互联通钉钉文档系统/01-工作日志系统实现方案.md)
- [适配器架构文档](../../docs/VCP 交互联通钉钉文档系统/02-适配器架构文档.md)

---

_版本：1.0.0_
_创建日期：2026-03-30_

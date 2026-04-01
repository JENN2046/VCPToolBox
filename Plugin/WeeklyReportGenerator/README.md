# WeeklyReportGenerator 插件

> 周报生成器 - 基于 AI 自动生成结构化周报

---

## 功能特性

- **从日志生成**: 自动读取工作记录生成周报
- **从日记生成**: 支持从 VCP 日记系统读取数据
- **AI 智能整理**: 调用 AI 将零散记录整理为结构化周报
- **多格式输出**: 支持 Markdown、Text、JSON 格式
- **导出表格**: 支持导出到钉钉 AI 表格

---

## 配置

复制 `config.env.example` 为 `config.env`:

```bash
cp config.env.example config.env
```

编辑 `config.env`:

```env
# VCP API 配置
VCP_API_URL=http://127.0.0.1:6005
VCP_API_KEY=your_vcp_api_key
DEFAULT_MODEL=Nova

# 钉钉 AI 表格配置（可选）
DINGTALK_TABLE_UUID=your_table_uuid
DINGTALK_MCP_URL=http://127.0.0.1:9000
DINGTALK_MCP_KEY=vcp-mcpo-secret
```

---

## 使用方法

### 1. 从工作记录生成周报

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」WeeklyReportGenerator「末」,
action:「始」generate_from_logs「末」,
week_start:「始」2026-03-24「末」,
week_end:「始」2026-03-30「末」
<<<[END_TOOL_REQUEST]>>>
```

**响应示例**:
```json
{
  "status": "success",
  "result": {
    "report": "# 第 13 周周报\n\n## 工作摘要\n本周主要完成了...\n\n## 完成情况\n1. 项目 A 开发\n2. 项目 B 评审\n\n## 经验教训\n- ...\n\n## 下周计划\n- ...",
    "format": "markdown",
    "logCount": 15,
    "dayCount": 5
  }
}
```

### 2. 从日记系统生成周报

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」WeeklyReportGenerator「末」,
action:「始」generate_from_diary「末」,
diary_name:「始」工作日志「末」
<<<[END_TOOL_REQUEST]>>>
```

### 3. 导出周报到钉钉 AI 表格

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」WeeklyReportGenerator「末」,
action:「始」export_to_table「末」,
content:「始」# 第 13 周周报\n\n本周完成...\n\n## 完成情况\n1. ...\n\n## 经验教训\n- ...\n\n## 下周计划\n- ...「末」,
summary:「始」第 13 周工作总结「末」
<<<[END_TOOL_REQUEST]>>>
```

---

## 周报模板

生成的周报包含以下部分:

```markdown
# 第 X 周周报

## 本周工作摘要
一句话总结本周重点

## 完成情况
1. 项目/任务 A
   - 具体完成内容
   - 进度：100%
2. 项目/任务 B
   - 具体完成内容
   - 进度：80%

## 关键数据
| 指标 | 数值 | 说明 |
|------|------|------|
| UV   | 5000 | 首日数据 |
| ...  | ...  | ... |

## 经验教训
- 遇到的问题及解决方案
- 可以改进的地方

## 下周计划
- [ ] 任务 1
- [ ] 任务 2
```

---

## 与 WorkLogScheduler 配合使用

```
# 定时触发生成周报
1. WorkLogScheduler 定时触发 (周五 17:00)
   ↓
2. WeeklyReportGenerator 生成周报
   ↓
3. DingTalkTable 导出到钉钉表格
   ↓
4. 用户确认并推送
```

---

## 相关文档

- [WorkLogScheduler 插件](../WorkLogScheduler/README.md)
- [DingTalkTable 插件](../DingTalkTable/README.md)
- [工作日志系统实现方案](../../docs/VCP 交互联通钉钉文档系统/01-工作日志系统实现方案.md)

---

_版本：1.0.0_
_创建日期：2026-03-30_

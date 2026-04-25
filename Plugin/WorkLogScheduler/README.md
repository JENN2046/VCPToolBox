# WorkLogScheduler 插件

> 工作日志调度器 - 定时触发日报/周报生成

---

## 功能特性

- **定时触发**: 支持配置每日/每周定时任务
- **日报生成**: 自动读取当日工作记录，触发 AI 生成日报
- **周报生成**: 自动读取本周工作记录，触发 AI 生成周报
- **工作记录存储**: 支持工作记录的保存和查询
- **钉钉推送**: 通过 VCP 发送消息到钉钉

---

## 配置

复制 `config.env.example` 为 `config.env`:

```bash
cp config.env.example config.env
```

编辑 `config.env`:

```env
# 日报触发时间 (HH:mm)
DAILY_REPORT_TIME=18:00

# 周报触发时间 (HH:mm)
WEEKLY_REPORT_TIME=17:00

# 周报触发星期 (5=周五)
WEEKLY_REPORT_DAY=5

# VCP API 地址
VCP_API_URL=http://127.0.0.1:6005

# VCP API 密钥
VCP_API_KEY=your_vcp_api_key

# 钉钉渠道 Agent 名称
DINGTALK_AGENT_NAME=Nova
```

---

## 使用方法

### 1. 触发日报生成

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」WorkLogScheduler「末」,
action:「始」trigger_daily_report「末」
<<<[END_TOOL_REQUEST]>>>
```

**响应示例**:
```json
{
  "status": "success",
  "result": {
    "message": "日报触发成功",
    "logCount": 3,
    "hasRecord": true
  }
}
```

### 2. 触发周报生成

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」WorkLogScheduler「末」,
action:「始」trigger_weekly_report「末」
<<<[END_TOOL_REQUEST]>>>
```

### 3. 检查调度状态

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」WorkLogScheduler「末」,
action:「始」check_schedule「末」
<<<[END_TOOL_REQUEST]>>>
```

**响应示例**:
```json
{
  "status": "success",
  "result": {
    "currentTime": "2026-03-30T10:00:00.000Z",
    "dailyReport": {
      "scheduledTime": "18:00",
      "nextRun": "2026-03-30T18:00:00.000Z",
      "enabled": true
    },
    "weeklyReport": {
      "scheduledDay": 5,
      "scheduledTime": "17:00",
      "nextRun": "2026-04-03T17:00:00.000Z",
      "enabled": true
    }
  }
}
```

### 4. 保存工作记录

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」WorkLogScheduler「末」,
action:「始」save_work_log「末」,
content:「始」今天完成了项目评审会议「末」,
metadata:「始」{"type": "会议", "project": "XXX"}「末」
<<<[END_TOOL_REQUEST]>>>
```

---

## 工作流程

### 日报流程

```
1. 定时触发 (18:00)
   ↓
2. 读取今日工作记录
   ↓
3. 生成日报提示消息
   ↓
4. 通过 VCP 发送到钉钉
   ↓
5. 用户确认/修改
   ↓
6. 调用 DingTalkTable 写入表格
```

### 周报流程

```
1. 定时触发 (周五 17:00)
   ↓
2. 读取本周工作记录
   ↓
3. 生成周报提示消息
   ↓
4. 通过 VCP 发送到钉钉
   ↓
5. 用户确认/修改
   ↓
6. 调用 DingTalkTable 写入表格
```

---

## 数据存储

工作记录存储在 `state/worklog/` 目录下，按日期命名:

```
state/worklog/
├── 2026-03-30.json
├── 2026-03-31.json
└── 2026-04-01.json
```

每条记录格式:

```json
[
  {
    "id": "1743321600000",
    "content": "今天完成了项目评审会议",
    "timestamp": "2026-03-30T10:00:00.000Z",
    "metadata": {
      "type": "会议",
      "project": "XXX"
    }
  }
]
```

---

## 相关文档

- [DingTalkTable 插件](../DingTalkTable/README.md)
- [工作日志系统实现方案](../../docs/VCP 交互联通钉钉文档系统/01-工作日志系统实现方案.md)

---

_版本：1.0.0_
_创建日期：2026-03-30_

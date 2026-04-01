# VCP 钉钉工作日志系统实现方案

## 1. 概述

本方案旨在用 VCP 系统替代 OpenClaw，实现钉钉渠道的**工作记录 → 日报 → 周报**自动化流程。

### 1.1 功能对照表

| OpenClaw 功能 | VCP 对应方案 | 状态 |
|---|---|---|
| 钉钉渠道接入 | `vcp-dingtalk-adapter` | ✅ 已有 |
| 自然语言对话 | VCPChat | ✅ 已有 |
| 工作记录存储 | `DailyNoteWrite` + 日记系统 | ✅ 已有 |
| 定时任务触发 | 需开发 `WorkLogScheduler` 插件 | ⚠️ 需开发 |
| 钉钉 AI 表格写入 | 通过 MCP 工具桥接 | ⚠️ 需配置 |
| 周报自动生成 | 需开发 `WeeklyReportGenerator` 插件 | ⚠️ 需开发 |

---

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                       用户侧 (钉钉)                              │
│                    钉钉客户端 / 钉钉 AI 表格                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP Stream / Webhook
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   VCP 钉钉适配器层                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ vcp-dingtalk-adapter                                    │   │
│  │ - 消息解码 (decodeInbound)                              │   │
│  │ - 会话管理 (SessionBinding)                              │   │
│  │ - 回复编码 (encodeOutbound)                              │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ VCP Channel Hub B2 Protocol
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   VCP 核心处理层                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ ChannelHub      │  │ RuntimeGateway  │  │ DeliveryOutbox  │ │
│  │ - 事件路由       │  │ - AI 调用编排     │  │ - 回复投递      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ DailyNoteWrite  │  │ WorkLogScheduler│  │ WeeklyReport    │ │
│  │ - 日记存储       │  │ - 定时触发       │  │ - 周报生成      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐                        │
│  │ MCPO            │  │ DingTalkTable   │                        │
│  │ - MCP 工具桥接    │  │ - 钉钉表格写入   │                        │
│  └─────────────────┘  └─────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 实现步骤

### 3.1 第一步：配置钉钉适配器（已有）

**文件位置**: `Plugin/vcp-dingtalk-adapter/`

**配置步骤**:

1. 复制配置文件：
```bash
cp Plugin/vcp-dingtalk-adapter/.env.example Plugin/vcp-dingtalk-adapter/.env
```

2. 编辑 `.env` 文件，填入钉钉应用凭证：
```env
DING_APP_KEY=your_app_key
DING_APP_SECRET=your_app_secret
VCP_USE_CHANNEL_BRIDGE=true
VCP_CHANNEL_BRIDGE_URL=http://127.0.0.1:6010/internal/channel-hub/events
VCP_API_KEY=your_vcp_api_key
VCP_AGENT_NAME=Nova
```

3. 启动适配器：
```bash
cd Plugin/vcp-dingtalk-adapter
npm install
npm start
```

---

### 3.2 第二步：开发工作日志调度插件

**文件位置**: `Plugin/WorkLogScheduler/`

**功能**:
- 定时触发日报/周报提醒
- 读取指定时间段内的工作记录
- 触发 AI 生成日报/周报

**plugin-manifest.json**:
```json
{
  "manifestVersion": "1.0.0",
  "name": "WorkLogScheduler",
  "version": "1.0.0",
  "displayName": "工作日志调度器",
  "description": "定时触发工作日志的收集、日报生成和周报生成",
  "author": "VCP Team",
  "pluginType": "asynchronous",
  "entryPoint": {
    "type": "nodejs",
    "command": "node WorkLogScheduler.js"
  },
  "communication": {
    "protocol": "stdio",
    "timeout": 300000
  },
  "configSchema": {
    "DAILY_REPORT_TIME": {
      "type": "string",
      "description": "日报触发时间 (HH:mm)",
      "default": "18:00"
    },
    "WEEKLY_REPORT_TIME": {
      "type": "string",
      "description": "周报触发时间 (HH:mm)",
      "default": "17:00"
    },
    "WEEKLY_REPORT_DAY": {
      "type": "integer",
      "description": "周报触发星期 (5=周五)",
      "default": 5
    }
  },
  "capabilities": {
    "invocationCommands": [
      {
        "commandIdentifier": "trigger_daily_report",
        "description": "手动触发日报生成流程",
        "example": "<<<[TOOL_REQUEST]>>>\ntool_name:「始」WorkLogScheduler「末」,\naction:「始」trigger_daily_report「末」\n<<<[END_TOOL_REQUEST]>>>"
      },
      {
        "commandIdentifier": "trigger_weekly_report",
        "description": "手动触发周报生成流程",
        "example": "<<<[TOOL_REQUEST]>>>\ntool_name:「始」WorkLogScheduler「末」,\naction:「始」trigger_weekly_report「末」\n<<<[END_TOOL_REQUEST]>>>"
      }
    ]
  }
}
```

**WorkLogScheduler.js** (核心逻辑):
```javascript
const fs = require('fs');
const path = require('path');

// 工作日志目录
const WORKLOG_DIR = path.join(__dirname, '..', '..', 'state', 'worklog');

/**
 * 获取今日工作记录
 */
async function getTodayWorkLogs() {
  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(WORKLOG_DIR, `${today}.json`);

  if (!fs.existsSync(logFile)) {
    return [];
  }

  const data = fs.readFileSync(logFile, 'utf-8');
  return JSON.parse(data);
}

/**
 * 获取本周工作记录
 */
async function getWeeklyWorkLogs() {
  const logs = [];
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);

  // 遍历本周每一天
  for (let i = 0; i < 5; i++) { // 周一到周五
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const logFile = path.join(WORKLOG_DIR, `${dateStr}.json`);

    if (fs.existsSync(logFile)) {
      const data = fs.readFileSync(logFile, 'utf-8');
      logs.push(...JSON.parse(data));
    }
  }

  return logs;
}

/**
 * 触发日报生成
 */
async function triggerDailyReport(agentName) {
  const logs = await getTodayWorkLogs();

  const prompt = `🦞 日报时间到！

今天共记录到 ${logs.length} 条工作内容：
${logs.map((log, i) => `${i + 1}. ${log.content}`).join('\n')}

请整理成结构化日报格式，确认写入日报吗？需要补充或修改吗？`;

  // 通过 VCP API 发送消息
  await sendToVCP(agentName, prompt);
}

/**
 * 触发周报生成
 */
async function triggerWeeklyReport(agentName) {
  const logs = await getWeeklyWorkLogs();

  const prompt = `🦞 周报时间到！

本周共记录 ${logs.length} 条工作内容，正在生成周报总结...

请根据以下工作记录生成周报：
${JSON.stringify(logs, null, 2)}

确认写入周报吗？`;

  // 通过 VCP API 发送消息
  await sendToVCP(agentName, prompt);
}

/**
 * 发送消息到 VCP
 */
async function sendToVCP(agentName, message) {
  const response = await fetch('http://127.0.0.1:6005/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VCP_API_KEY}`
    },
    body: JSON.stringify({
      model: 'Nova',
      messages: [{ role: 'user', content: message }],
      agentName: agentName
    })
  });

  return response.json();
}

// 主处理逻辑
async function main() {
  let inputData = '';

  process.stdin.on('data', chunk => inputData += chunk);

  process.stdin.on('end', async () => {
    try {
      const request = JSON.parse(inputData);
      const { action, agentName } = request;

      let result;

      if (action === 'trigger_daily_report') {
        result = await triggerDailyReport(agentName || 'Nova');
      } else if (action === 'trigger_weekly_report') {
        result = await triggerWeeklyReport(agentName || 'Nova');
      } else {
        result = { status: 'error', error: '未知操作' };
      }

      console.log(JSON.stringify({ status: 'success', result }));
    } catch (e) {
      console.log(JSON.stringify({ status: 'error', error: e.message }));
    }

    process.exit(0);
  });
}

main();
```

---

### 3.3 第三步：开发钉钉 AI 表格写入插件

**文件位置**: `Plugin/DingTalkTable/`

**功能**:
- 连接钉钉 AI 表格 MCP 服务器
- 写入日报/周报数据

**plugin-manifest.json**:
```json
{
  "manifestVersion": "1.0.0",
  "name": "DingTalkTable",
  "version": "1.0.0",
  "displayName": "钉钉 AI 表格写入器",
  "description": "将日报/周报数据写入钉钉 AI 表格",
  "author": "VCP Team",
  "pluginType": "synchronous",
  "entryPoint": {
    "type": "nodejs",
    "command": "node DingTalkTable.js"
  },
  "communication": {
    "protocol": "stdio",
    "timeout": 60000
  },
  "configSchema": {
    "DINGTALK_TABLE_UUID": {
      "type": "string",
      "description": "钉钉 AI 表格 UUID"
    },
    "DINGTALK_MCP_URL": {
      "type": "string",
      "description": "钉钉 MCP 服务器 URL"
    }
  }
}
```

---

### 3.4 第四步：配置 MCP 钉钉 AI 表格连接

1. 安装 `mcporter`:
```bash
npm install -g mcporter
```

2. 配置 MCP 服务器:
```bash
mcporter config add dingtalk-ai-table --url "https://mcp-gw.dingtalk.com/server/xxx?key=xxx"
```

3. 在 VCP 中通过 `MCPO` 插件调用钉钉表格能力。

---

### 3.5 第五步：配置 HEARTBEAT.md 定时任务

在工作区创建 `HEARTBEAT.md`:

```markdown
# 工作日报周报定时任务

## 任务配置
- **日报时间**: 每天 18:00
- **周报时间**: 每周五 17:00
- **目标表格**: 📝 工作周日报记录
- **表格 UUID**: `你的表格 UUID`

## 日报执行清单
- [ ] 读取今日的工作记录
- [ ] 调用 AI 整理成结构化格式
- [ ] 写入"日报记录"子表
- [ ] 确认写入成功并回复用户

## 周报执行清单
- [ ] 读取本周所有日报记录
- [ ] 调用 AI 生成周报总结
- [ ] 写入"周报记录"子表
- [ ] 推送到指定群聊 (如配置)
```

---

## 4. 使用流程

### 4.1 随时记录工作

通过钉钉向 AI 发送消息:
```
今天完成了 XX 项目的需求评审
XX 功能已上线，数据表现不错
和 XX 客户开了会，确定了合作意向
```

AI 会自动调用 `DailyNoteWrite` 将记录存储到日记系统。

### 4.2 日报生成 (18:00 自动触发)

AI 主动发送:
```
🦞 日报时间到！

今天记录到的工作内容：
1. XX 项目需求评审
2. XX 功能上线
3. XX 客户会议

确认写入日报吗？需要补充或修改吗？
```

用户确认后，调用 `DingTalkTable` 插件写入钉钉表格。

### 4.3 周报生成 (周五 17:00 自动触发)

AI 主动发送:
```
🦞 周报时间到！

本周共记录 5 条日报：
- 周一：XX 项目启动
- 周二：需求评审
- 周三：开发完成
- 周四：测试上线
- 周五：客户演示

正在生成周报总结...
✅ 已完成：
- 本周工作摘要
- 关键数据汇总
- 经验教训 3 条

确认写入周报吗？
```

---

## 5. 开发清单

| 任务 | 负责人 | 状态 |
|---|---|---|
| 钉钉适配器配置测试 | | ⏳ |
| WorkLogScheduler 开发 | | ⏳ |
| DingTalkTable 开发 | | ⏳ |
| MCP 配置与测试 | | ⏳ |
| HEARTBEAT.md 配置 | | ⏳ |
| 端到端测试 | | ⏳ |

---

## 6. 注意事项

1. **安全性**: 钉钉凭证和 MCP 密钥需妥善保管，不要提交到代码库
2. **容错处理**: 需处理网络异常、API 限流等边界情况
3. **日志记录**: 所有操作需记录日志便于排查问题
4. **数据备份**: 定期备份工作记录数据

---

_版本：1.0_
_创建日期：2026-03-30_

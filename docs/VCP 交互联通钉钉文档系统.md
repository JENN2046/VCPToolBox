# VCP 交互联通钉钉文档系统

> VCP 与钉钉平台深度集成的完整文档系统，实现钉钉渠道消息互通、AI 表格写入、工作日志自动化等功能。

---

## 📚 文档目录

### 1. 架构设计文档
- [VCP 钉钉适配器架构](#vcp-钉钉适配器架构)
- [ChannelHub B2 协议规范](#channelhub-b2-协议规范)
- [消息流转流程](#消息流转流程)

### 2. 配置指南
- [钉钉应用创建与配置](#钉钉应用创建与配置)
- [适配器环境配置](#适配器环境配置)
- [MCP 工具配置](#mcp 工具配置)

### 3. 开发文档
- [钉钉适配器开发指南](#钉钉适配器开发指南)
- [插件开发规范](#插件开发规范)
- [API 参考](#api 参考)

### 4. 应用场景
- [工作日志自动化系统](#工作日志自动化系统)
- [钉钉 AI 表格集成](#钉钉 ai 表格集成)
- [定时任务管理](#定时任务管理)

---

## VCP 钉钉适配器架构

### 组件概述

```
┌─────────────────────────────────────────────────────────────┐
│                    钉钉客户端层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ 钉钉 PC 客户端  │  │ 钉钉移动端   │  │ 钉钉 Web 端   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS / Stream
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 VCP 钉钉适配器层 (vcp-dingtalk-adapter)        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Adapter Contract 层                                      ││
│  │ - decodeInbound()  - 解码入站消息                        ││
│  │ - encodeOutbound() - 编码出站消息                        ││
│  │ - healthCheck()    - 健康检查                            ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Stream Receiver 层     │  Webhook Receiver 层            ││
│  │ - 长连接保活            │  - 事件回调接收                  ││
│  │ - 心跳维护             │  - 签名验证                     ││
│  └─────────────────────────────────────────────────────────┘│
└───────────────────────────┬─────────────────────────────────┘
                            │ VCP Channel Hub B2 Protocol
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   VCP 核心处理层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ ChannelHub  │  │ RuntimeGateway│  │ DeliveryOutbox│      │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 核心模块

| 模块 | 路径 | 说明 |
|------|------|------|
| 适配器入口 | `Plugin/vcp-dingtalk-adapter/src/index.js` | 主启动入口 |
| 协议实现 | `Plugin/vcp-dingtalk-adapter/src/adapter/contract.js` | Adapter Contract 标准接口 |
| VCP 客户端 | `Plugin/vcp-dingtalk-adapter/src/adapters/vcp/client.js` | VCP Channel Hub 客户端 |
| 流式接收器 | `Plugin/vcp-dingtalk-adapter/src/adapters/dingtalk/streamReceiver.js` | 钉钉 Stream 消息接收 |

---

## 配置指南

### 钉钉应用创建与配置

1. 登录 [钉钉开放平台](https://open.dingtalk.com/)
2. 创建企业内部应用
3. 获取 `AppKey` 和 `AppSecret`
4. 配置事件订阅（机器人消息）

### 适配器环境配置

编辑 `Plugin/vcp-dingtalk-adapter/.env`:

```env
# 钉钉应用凭证
DING_APP_KEY=your_app_key
DING_APP_SECRET=your_app_secret

# VCP Channel Hub 配置
VCP_USE_CHANNEL_BRIDGE=true
VCP_CHANNEL_BRIDGE_URL=http://127.0.0.1:6010/internal/channel-hub/events
VCP_CHANNEL_BRIDGE_KEY=
VCP_CHANNEL_HUB_VERSION=b2
VCP_ADAPTER_ID=dingtalk-adapter-01

# VCP 回退配置
VCP_BASE_URL=http://127.0.0.1:6005
VCP_API_KEY=your_vcp_api_key
VCP_AGENT_NAME=Nova
VCP_MODEL=Nova
VCP_TIMEOUT_MS=120000

# 调试选项
LOG_LEVEL=info
```

### MCP 工具配置

```bash
# 安装 mcporter
npm install -g mcporter

# 配置钉钉 AI 表格 MCP 服务器
mcporter config add dingtalk-ai-table \
  --url "https://mcp-gw.dingtalk.com/server/xxx?key=xxx"
```

---

## 消息流转流程

### 入站消息流程 (钉钉 → VCP)

```
1. 用户发送消息
   ↓
2. 钉钉服务端推送 (Stream/Webhook)
   ↓
3. vcp-dingtalk-adapter 接收
   ↓
4. decodeInbound() 解码为标准事件
   ↓
5. 发送到 ChannelHub
   ↓
6. RuntimeGateway 调用 AI
   ↓
7. AI 生成回复
```

### 出站消息流程 (VCP → 钉钉)

```
1. AI 生成回复内容
   ↓
2. ReplyNormalizer 标准化
   ↓
3. DeliveryOutbox 投递队列
   ↓
4. CapabilityDowngrader 能力降级
   ↓
5. MediaGateway 处理多媒体
   ↓
6. encodeOutbound() 编码
   ↓
7. 发送到钉钉 API
```

---

## 工作日志自动化系统

### 系统架构

```
用户钉钉消息 → DailyNoteWrite → 日记存储
                          ↓
              WorkLogScheduler (定时触发)
                          ↓
              AI 整理生成 → DingTalkTable → 钉钉 AI 表格
```

### 功能特性

| 功能 | 说明 | 插件 |
|------|------|------|
| 随时记录 | 通过对话记录工作内容 | DailyNoteWrite |
| 定时提醒 | 每日 18:00 提醒写日报 | WorkLogScheduler |
| 自动整理 | AI 自动整理为结构化格式 | - |
| 周报生成 | 每周五自动生成周报 | WeeklyReportGenerator |
| 表格写入 | 写入钉钉 AI 表格 | DingTalkTable / MCPO |

### 使用示例

**随时记录工作:**
```
用户：今天完成了 XX 项目的需求评审
AI：✅ 已记录：今天完成了 XX 项目的需求评审
```

**日报提醒:**
```
🦞 日报时间到！

今天记录到的工作内容：
1. XX 项目需求评审
2. XX 功能上线
3. XX 客户会议

确认写入日报吗？需要补充或修改吗？
```

**周报生成:**
```
🦞 周报时间到！

本周共记录 5 条日报：
- 周一：XX 项目启动
- 周二：需求评审
- 周三：开发完成
- 周四：测试上线
- 周五：客户演示

正在生成周报总结...
```

---

## 开发文档

### 插件开发规范

VCP 插件遵循统一的 manifest 规范：

```json
{
  "manifestVersion": "1.0.0",
  "name": "plugin-name",
  "version": "1.0.0",
  "displayName": "插件显示名称",
  "description": "插件描述",
  "pluginType": "synchronous|asynchronous|static|service",
  "entryPoint": {
    "type": "nodejs|python",
    "command": "node index.js"
  }
}
```

### API 参考

#### ChannelHub 内部 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/internal/channel-hub/events` | POST | 接收外部事件 |
| `/internal/channel-hub/outbound` | POST | 投递出站消息 |

#### VCP API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/v1/chat/completions` | POST | 标准聊天完成接口 |

---

## 相关文档

- [ChannelHub 用户指南](./interaction-middleware/CHANNEL_HUB_USER_GUIDE.md)
- [VCP 交互中间件架构](./interaction-middleware/VCP_INTERACTION_MIDDLEWARE_SCHEMA.md)
- [VCP 配置指南](./CONFIGURATION.md)

---

_最后更新：2026-03-30_

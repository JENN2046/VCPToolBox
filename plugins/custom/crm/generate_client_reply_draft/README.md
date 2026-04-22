# PhotoStudioReplyDraft — 摄影工作室客户沟通草稿插件

基于客户和项目上下文生成客户沟通草稿，缺上下文时降级使用占位符。

## 1. 功能

- 自动读取项目关联的客户信息
- 按 context_type 选择草稿模板 (报价/档期/交付/通用)
- 支持指定语气 (formal/friendly/warm)
- key_points 注入草稿正文
- 客户信息不完整时使用占位符降级，meta 标记 degraded: true
- 不硬编任何客户数据，只使用上下文中实际存在的值

## 2. 输入输出

**输入字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| project_id | string | 是 | 项目ID |
| customer_id | string | 否 | 不提供时从项目取 |
| context_type | string | 是 | quotation/schedule/delivery/general |
| key_points | string | 否 | 草稿要点 |
| tone | string | 否 | formal/friendly/warm，默认 warm |

**成功输出:**

```json
{
  "success": true,
  "data": {
    "project_id": "proj_x2y5z8w1",
    "customer_name": "张三",
    "context_type": "quotation",
    "draft_content": "尊敬的张三先生/女士，...",
    "generation_time": "2026-04-20T17:00:00.000+08:00"
  },
  "error": null,
  "meta": { "plugin_name": "generate_client_reply_draft", "version": "1.0.0", "timestamp": "...", "degraded": false }
}
```

## 3. 文档索引

- 快速开始: [docs/01-quickstart.md](./docs/01-quickstart.md)
- 配置说明: [docs/02-config.md](./docs/02-config.md)
- 发布清单: [docs/03-release-checklist.md](./docs/03-release-checklist.md)

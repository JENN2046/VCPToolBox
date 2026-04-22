# PhotoStudioProjectRecord — 摄影工作室项目建档插件

为摄影工作室创建项目记录，关联客户ID，支持项目名查重。

## 1. 功能

- 接收项目信息，关联已有 customer_id，生成 `proj_` 前缀唯一 ID
- 校验 customer_id 存在，不存在返回 RESOURCE_NOT_FOUND
- 同一 customer_id 下 project_name 完全匹配时返回 CONFLICT
- 新建项目默认状态为 inquiry
- project_type 不合法时返回 INVALID_INPUT

## 2. 输入输出

**输入字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| customer_id | string | 是 | 关联的客户ID |
| project_name | string | 是 | 项目名称 |
| project_type | string | 是 | wedding/portrait/commercial/event/other |
| start_date | string | 否 | ISO8601 日期 |
| due_date | string | 否 | ISO8601 日期 |
| budget | number | 否 | 预算金额 |
| remark | string | 否 | 备注 |

**成功输出:**

```json
{
  "success": true,
  "data": {
    "project_id": "proj_x2y5z8w1",
    "customer_id": "cust_a3b7k9m2",
    "project_name": "张三婚礼跟拍",
    "project_type": "wedding",
    "status": "inquiry",
    "is_new": true,
    "created_at": "2026-04-20T15:35:00.000+08:00"
  },
  "error": null,
  "meta": { "plugin_name": "create_project_record", "version": "1.0.0", "timestamp": "..." }
}
```

## 3. 配置

见 [docs/02-config.md](./docs/02-config.md)

## 4. 文档索引

- 快速开始: [docs/01-quickstart.md](./docs/01-quickstart.md)
- 配置说明: [docs/02-config.md](./docs/02-config.md)
- 发布清单: [docs/03-release-checklist.md](./docs/03-release-checklist.md)

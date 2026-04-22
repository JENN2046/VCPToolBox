# PhotoStudioProjectStatus — 摄影工作室项目状态流转插件

更新项目状态，校验转换合法性，记录变更日志。

## 1. 功能

- 校验 project_id 存在，不存在返回 RESOURCE_NOT_FOUND
- 校验 new_status 属于合法状态枚举
- 校验从当前状态到新状态的转换是否合法，非法返回 INVALID_TRANSITION
- 更新项目状态并写入 status_log.json
- 记录 previous_status、new_status、transition_time

## 2. 合法状态转换

```
inquiry    → quoted, cancelled
quoted     → confirmed, cancelled
confirmed  → preparing, cancelled
preparing  → shooting, cancelled
shooting   → editing, cancelled
editing    → reviewing, delivered
reviewing  → editing, delivered
delivered  → completed
completed  → archived
```

## 3. 输入输出

**输入字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| project_id | string | 是 | 项目ID |
| new_status | string | 是 | 目标状态 |
| remark | string | 否 | 变更备注 |

**成功输出:**

```json
{
  "success": true,
  "data": {
    "project_id": "proj_x2y5z8w1",
    "previous_status": "inquiry",
    "new_status": "quoted",
    "transition_time": "2026-04-20T16:00:00.000+08:00",
    "remark": "客户确认报价方案"
  },
  "error": null,
  "meta": { "plugin_name": "update_project_status", "version": "1.0.0", "timestamp": "..." }
}
```

## 4. 文档索引

- 快速开始: [docs/01-quickstart.md](./docs/01-quickstart.md)
- 配置说明: [docs/02-config.md](./docs/02-config.md)
- 发布清单: [docs/03-release-checklist.md](./docs/03-release-checklist.md)

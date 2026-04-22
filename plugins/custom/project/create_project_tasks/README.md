# PhotoStudioProjectTasks — 摄影工作室项目任务拆解插件

根据项目类型自动生成标准任务列表，或接收自定义任务列表。

## 1. 功能

- 校验 project_id 存在
- 支持预设模板自动生成任务 (wedding_standard, portrait_basic 等)
- 支持自定义任务列表
- 两者都未提供时，按 project_type 使用默认模板
- override_existing=false 时跳过已有未完成任务
- 每个任务生成 task_id 前缀唯一 ID

## 2. 预设模板

### wedding_standard (婚礼标准流程)
1. 前期沟通 (communication)
2. 场地勘察 (shooting)
3. 婚礼拍摄 (shooting)
4. 精修选片 (review)
5. 后期精修 (editing)
6. 交付成品 (delivery)

### portrait_basic (人像基础流程)
1. 前期沟通 (communication)
2. 拍摄执行 (shooting)
3. 选片确认 (review)
4. 后期修图 (editing)
5. 交付成品 (delivery)

### commercial_standard (商业标准流程)
1. 需求对接 (communication)
2. 拍摄策划 (preparing)
3. 拍摄执行 (shooting)
4. 后期处理 (editing)
5. 客户审片 (review)
6. 交付成品 (delivery)

### event_basic (活动基础流程)
1. 活动沟通 (communication)
2. 现场拍摄 (shooting)
3. 后期处理 (editing)
4. 交付成品 (delivery)

## 3. 输入输出

**输入字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| project_id | string | 是 | 项目ID |
| task_template | string | 否 | 预设模板名 |
| tasks | array | 否 | 自定义任务列表 |
| override_existing | boolean | 否 | 默认 false |

**成功输出:**

```json
{
  "success": true,
  "data": {
    "project_id": "proj_x2y5z8w1",
    "created_tasks": [
      { "task_id": "task_m4n7p1q3", "task_name": "前期沟通", "task_type": "communication", "sort_order": 1, "status": "pending" }
    ],
    "created_count": 5,
    "skipped_count": 0
  },
  "error": null,
  "meta": { "plugin_name": "create_project_tasks", "version": "1.0.0", "timestamp": "..." }
}
```

## 4. 文档索引

- 快速开始: [docs/01-quickstart.md](./docs/01-quickstart.md)
- 配置说明: [docs/02-config.md](./docs/02-config.md)
- 发布清单: [docs/03-release-checklist.md](./docs/03-release-checklist.md)

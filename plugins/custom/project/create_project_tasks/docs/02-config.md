# PhotoStudio 项目任务拆解 - 配置说明

## config.env 变量

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| DebugMode | boolean | false | 启用调试日志 |
| PhotoStudioDataPath | string | Plugin/PhotoStudioData | 数据存储根路径 |

## 数据存储

任务数据保存在 `PhotoStudioData/tasks.json`，以 project_id 为 key，值为任务数组。

## 预设模板

| 模板名 | 适用项目类型 | 任务数 |
|--------|-------------|--------|
| wedding_standard | wedding | 6 |
| portrait_basic | portrait | 5 |
| commercial_standard | commercial | 6 |
| event_basic | event | 4 |
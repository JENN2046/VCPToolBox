# PhotoStudio 项目建档 - 配置说明

## config.env 变量

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| DebugMode | boolean | false | 启用调试日志 |
| PhotoStudioDataPath | string | Plugin/PhotoStudioData | 数据存储根路径 |

## 数据存储

项目数据保存在 `PhotoStudioData/projects.json`，以 project_id 为 key 的 JSON 对象。

# PhotoStudio 项目状态流转 - 配置说明

## config.env 变量

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| DebugMode | boolean | false | 启用调试日志 |
| PhotoStudioDataPath | string | Plugin/PhotoStudioData | 数据存储根路径 |

## 数据存储

状态变更记录保存在 `PhotoStudioData/status_log.json`，每次合法转换追加一条。

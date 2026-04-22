# PhotoStudio 项目状态流转 - 快速开始

## 前置条件

- 已通过 create_project_record 创建项目，持有 project_id

## 调用示例

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」update_project_status「末」,
project_id:「始」proj_x2y5z8w1「末」,
new_status:「始」quoted「末」,
remark:「始」客户确认报价方案「末」
<<<[END_TOOL_REQUEST]>>>
```

## 验证

检查 `data.previous_status` 和 `data.new_status`，确认转换符合预期。

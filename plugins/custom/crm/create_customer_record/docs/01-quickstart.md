# PhotoStudio 客户建档 - 快速开始

## 前置条件

- VCPToolBox 正常运行
- `Plugin/PhotoStudioData/` 目录可写

## 调用示例

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」create_customer_record「末」,
customer_name:「始」张三「末」,
customer_type:「始」individual「末」,
contact_phone:「始」13800138000「末」,
source:「始」referral「末」
<<<[END_TOOL_REQUEST]>>>
```

## 验证

调用后检查返回的 `success` 字段和 `data.customer_id`。

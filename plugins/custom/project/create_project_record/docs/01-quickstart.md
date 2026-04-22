# PhotoStudio 项目建档 - 快速开始

## 前置条件

- VCPToolBox 正常运行
- 已通过 create_customer_record 创建客户记录，持有 customer_id

## 调用示例

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」create_project_record「末」,
customer_id:「始」cust_a3b7k9m2「末」,
project_name:「始」张三婚礼跟拍「末」,
project_type:「始」wedding「末」,
budget:「始」8000「末」
<<<[END_TOOL_REQUEST]>>>
```

## 验证

检查返回的 `data.project_id` 和 `data.status` (应为 inquiry)。

# PhotoStudio 客户沟通草稿 - 快速开始

## 前置条件

- 已创建客户和项目记录

## 调用示例

生成报价草稿：

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」generate_client_reply_draft「末」,
project_id:「始」proj_x2y5z8w1「末」,
context_type:「始」quotation「末」,
key_points:「始」婚礼全天跟拍含精修50张，总价8000元「末」,
tone:「始」warm「末」
<<<[END_TOOL_REQUEST]>>>
```

生成档期草稿：

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」generate_client_reply_draft「末」,
project_id:「始」proj_x2y5z8w1「末」,
context_type:「始」schedule「末」,
key_points:「始」下周末（4月26日）有空档「末」,
tone:「始」friendly「末」
<<<[END_TOOL_REQUEST]>>>
```

## 降级说明

若客户信息不完整，草稿中使用 `[客户姓名]` 等占位符，meta 中 degraded=true。
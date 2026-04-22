# PhotoStudio 项目任务拆解 - 快速开始

## 前置条件

- 已通过 create_project_record 创建项目，持有 project_id

## 使用预设模板

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」create_project_tasks「末」,
project_id:「始」proj_x2y5z8w1「末」,
task_template:「始」wedding_standard「末」
<<<[END_TOOL_REQUEST]>>>
```

## 使用自定义任务

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」create_project_tasks「末」,
project_id:「始」proj_x2y5z8w1「末」,
tasks:「始」[{"task_name":"外景拍摄","task_type":"shooting","sort_order":1},{"task_name":"精修交付","task_type":"editing","sort_order":2}]「末」
<<<[END_TOOL_REQUEST]>>>
```

## 不指定模板

未提供 task_template 和 tasks 时，自动按 project_type 选择默认模板。
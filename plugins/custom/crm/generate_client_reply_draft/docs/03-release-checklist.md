# PhotoStudio 客户沟通草稿 - 发布清单

## 发布前检查

- [ ] 4 种 context_type 模板内容正确
- [ ] 3 种 tone 语气格式正确
- [ ] project_id 不存在返回 RESOURCE_NOT_FOUND
- [ ] context_type 非法返回 INVALID_INPUT
- [ ] 客户信息缺失时降级，degraded=true
- [ ] key_points 正确注入草稿正文

## Staging 验证

- [ ] quotation 草稿包含报价相关内容
- [ ] schedule 草稿包含档期相关内容
- [ ] delivery 草稿包含交付相关内容
- [ ] 无客户名时使用占位符
- [ ] 不同 tone 产生不同语气

## 生产发布

- [ ] 备份 PhotoStudioData 目录
- [ ] 部署固定版本
# PhotoStudio 项目建档 - 发布清单

## 发布前检查

- [ ] plugin.json 的 name、version 正确
- [ ] README.md 已更新
- [ ] customer_id 不存在时返回 RESOURCE_NOT_FOUND
- [ ] 同客户下项目名重复时返回 CONFLICT
- [ ] project_type 非法时返回 INVALID_INPUT
- [ ] 新建项目默认状态为 inquiry

## Staging 验证

- [ ] 正常建档成功
- [ ] 无效 customer_id 返回错误
- [ ] 重复项目名返回 CONFLICT
- [ ] 非法 project_type 返回错误

## 生产发布

- [ ] 备份 PhotoStudioData 目录
- [ ] 部署固定版本

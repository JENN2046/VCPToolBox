# PhotoStudio 项目任务拆解 - 发布清单

## 发布前检查

- [ ] 4 个预设模板内容正确
- [ ] 自定义任务列表校验完整
- [ ] project_id 不存在返回 RESOURCE_NOT_FOUND
- [ ] 有未完成任务且 override=false 时返回跳过信息
- [ ] override=true 时正常创建

## Staging 验证

- [ ] wedding_standard 模板生成 6 个任务
- [ ] portrait_basic 模板生成 5 个任务
- [ ] 自定义任务列表正常创建
- [ ] 不指定模板时按 project_type 选择默认
- [ ] 重复调用不覆盖（override=false）

## 生产发布

- [ ] 备份 PhotoStudioData 目录
- [ ] 部署固定版本
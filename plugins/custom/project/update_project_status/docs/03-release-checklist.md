# PhotoStudio 项目状态流转 - 发布清单

## 发布前检查

- [ ] 合法转换全部可执行
- [ ] 非法转换返回 INVALID_TRANSITION
- [ ] project_id 不存在返回 RESOURCE_NOT_FOUND
- [ ] 同状态幂等返回成功
- [ ] 状态日志正确记录

## Staging 验证

- [ ] inquiry → quoted 成功
- [ ] inquiry → confirmed 失败（跳步）
- [ ] cancelled → 任意状态 失败
- [ ] 重复设置同状态幂等成功

## 生产发布

- [ ] 备份 PhotoStudioData 目录
- [ ] 部署固定版本

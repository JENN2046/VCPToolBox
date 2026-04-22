# PhotoStudio 客户建档 - 发布清单

## 发布前检查

- [ ] plugin.json 的 name、version 正确
- [ ] README.md 已更新
- [ ] 输入输出 schema 与冻结文档一致
- [ ] 查重逻辑覆盖 customer_name + phone/wechat
- [ ] 缺字段时返回 MISSING_REQUIRED_FIELD
- [ ] customer_type 非法时返回 INVALID_INPUT
- [ ] 数据文件原子写入

## Staging 验证

- [ ] 新客户建档成功
- [ ] 重复客户返回 CONFLICT
- [ ] 缺 customer_name 返回错误
- [ ] 缺 customer_type 返回错误
- [ ] 非法 customer_type 返回错误

## 生产发布

- [ ] 备份现有 PhotoStudioData 目录
- [ ] 部署固定版本
- [ ] 发布后观察日志无异常

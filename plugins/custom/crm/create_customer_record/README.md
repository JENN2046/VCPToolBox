# PhotoStudioCustomerRecord — 摄影工作室客户建档插件

为摄影工作室创建客户记录，支持查重防止重复建档。

## 1. 功能

- 接收客户信息，生成 `cust_` 前缀的唯一 ID
- 按 customer_name + contact_phone 或 customer_name + contact_wechat 查重
- 重复时返回 CONFLICT 错误码及已有记录摘要
- 缺必填字段时返回 MISSING_REQUIRED_FIELD
- customer_type 不合法时返回 INVALID_INPUT

## 2. 目录结构

```
Plugin/PhotoStudioCustomerRecord/
  README.md
plugin.json
  index.js
  config.env
  docs/
    01-quickstart.md
    02-config.md
    03-release-checklist.md
```

## 3. 安装与启用

1. 确认本插件位于 `Plugin/PhotoStudioCustomerRecord/`
2. 确认 `Plugin/PhotoStudioData/PhotoStudioDataStore.js` 存在
3. 重启 VCPToolBox，检查日志中出现 `Loaded manifest: 摄影工作室·客户建档`

## 4. 输入输出

**输入字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| customer_name | string | 是 | 客户姓名/公司名 |
| customer_type | string | 是 | individual / corporate |
| contact_phone | string | 否 | 联系电话 |
| contact_wechat | string | 否 | 微信号 |
| contact_email | string | 否 | 邮箱 |
| source | string | 否 | 来源渠道 |
| remark | string | 否 | 备注 |

**成功输出:**

```json
{
  "success": true,
  "data": {
    "customer_id": "cust_a3b7k9m2",
    "customer_name": "张三",
    "customer_type": "individual",
    "is_new": true,
    "created_at": "2026-04-20T15:30:00.000+08:00"
  },
  "error": null,
  "meta": { "plugin_name": "create_customer_record", "version": "1.0.0", "timestamp": "..." }
}
```

**查重冲突输出:**

```json
{
  "success": false,
  "data": { "customer_id": "cust_existed", "customer_name": "张三", "is_new": false },
  "error": { "code": "CONFLICT", "message": "客户已存在", "field": "customer_name" },
  "meta": { "plugin_name": "create_customer_record", "version": "1.0.0", "timestamp": "..." }
}
```

## 5. 配置

见 [docs/02-config.md](./docs/02-config.md)

## 6. 故障排除

- 插件未加载: 检查目录名和 manifest 文件
- 建档失败: 检查 customer_name 和 customer_type 是否提供
- 数据写入失败: 检查 PhotoStudioData 目录权限

## 7. 文档索引

- 快速开始: [docs/01-quickstart.md](./docs/01-quickstart.md)
- 配置说明: [docs/02-config.md](./docs/02-config.md)
- 发布清单: [docs/03-release-checklist.md](./docs/03-release-checklist.md)

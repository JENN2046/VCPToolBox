# PhotoStudio 客户沟通草稿 - 配置说明

## config.env 变量

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| DebugMode | boolean | false | 启用调试日志 |
| PhotoStudioDataPath | string | Plugin/PhotoStudioData | 数据存储根路径 |

## 草稿模板

| context_type | 用途 | 模板 |
|-------------|------|------|
| quotation | 报价沟通 | 报价方案模板 |
| schedule | 档期沟通 | 档期安排模板 |
| delivery | 交付通知 | 交付通知模板 |
| general | 通用沟通 | 通用事项模板 |

## 语气选项

| tone | 称呼 | 结尾 |
|------|------|------|
| formal | 尊敬的 | 此致敬礼 |
| friendly | 你好， | 祝好 |
| warm | 亲爱的 | 期待与您的合作 |
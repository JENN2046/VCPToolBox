# WeeklyReportGenerator 改造实施计划

> **版本：** 1.1.0  
> **创建日期：** 2026-04-13  
> **状态：** 进行中  
> **负责人：** VCP Team

---

## 一、改造背景

### 1.1 问题描述

原 `WeeklyReportGenerator` 插件的 `export_to_table` 功能直接调用 MCP HTTP 接口：
```javascript
// 改造前：直接 HTTP 调用
const req = http.request(`${CONFIG.DINGTALK_MCP_URL}/tools/add_record/invoke`, { ... })
```

**存在问题：**
- 写表逻辑分散，无法复用 `DingTalkTable` 插件的重试、日志和错误处理能力
- 需要维护两套 MCP 配置（`DINGTALK_MCP_URL`、`DINGTALK_MCP_KEY` 等）
- 不符合项目统一的插件调用规范

### 1.2 改造目标

将 `WeeklyReportGenerator` 的导出功能改为通过 `DingTalkTable` 插件调用：

```javascript
// 改造后：通过 PluginManager 调用插件
const result = await pluginManager.executePlugin('DingTalkTable', JSON.stringify(dingTalkRequest), null, null);
```

**预期收益：**
- ✅ 统一写表逻辑到 `DingTalkTable` 插件
- ✅ 简化 `WeeklyReportGenerator` 配置项
- ✅ 符合项目插件调用规范
- ✅ 便于后续统一重试、日志和错误处理

---

## 二、修改文件清单

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `Plugin/WeeklyReportGenerator/WeeklyReportGenerator.js` | 主逻辑修改 | 重写 `exportToTable()` 函数，移除 HTTP 直连逻辑 |
| `Plugin/WeeklyReportGenerator/plugin-manifest.json` | 版本升级 | 版本从 `1.0.0` 升级至 `1.1.0`，更新描述 |
| `Plugin/WeeklyReportGenerator/config.env.example` | 配置简化 | 移除 `DINGTALK_MCP_URL` 和 `DINGTALK_MCP_KEY` |
| `Plugin/WeeklyReportGenerator/README.md` | 文档更新 | 更新功能特性和配置说明 |

---

## 三、执行任务清单

### 任务总览

| # | 任务名称 | 负责人 | 状态 | 验收标准 |
|---|----------|--------|------|----------|
| 1 | 验证 DingTalkTable 配置 | | 待执行 | `config.env` 存在且关键参数已配置 |
| 2 | 更新 WeeklyReportGenerator 配置 | | 待执行 | `config.env` 文件存在且 `DINGTALK_TABLE_UUID` 已填写 |
| 3 | 验证插件依赖和启用状态 | | 待执行 | 两个插件均无 `.block` 后缀 |
| 4 | 测试周报导出功能 | | 待执行 | 成功返回 `record_id`，钉钉表格可见记录 |
| 5 | 更新协作者文档 | | 待执行 | 通知相关人员并记录变更 |

---

### 任务 1：验证 DingTalkTable 配置

**执行人：** ______________  
**预计时间：** 10 分钟

**步骤：**
```powershell
# 1. 检查配置文件是否存在
ls Plugin/DingTalkTable/config.env

# 2. 确认配置内容
cat Plugin/DingTalkTable/config.env
```

**配置检查清单：**
- [ ] `DINGTALK_MCP_URL` 已配置（如 `http://127.0.0.1:9000`）
- [ ] `DINGTALK_MCP_KEY` 已配置
- [ ] `DINGTALK_TABLE_UUID` 已配置

**验收标准：** 配置文件存在且三个关键参数已填写

---

### 任务 2：更新 WeeklyReportGenerator 配置

**执行人：** ______________  
**预计时间：** 5 分钟

**步骤：**
```powershell
# 1. 复制配置模板
cp Plugin/WeeklyReportGenerator/config.env.example Plugin/WeeklyReportGenerator/config.env

# 2. 编辑配置文件（填入实际的 table UUID）
# 编辑 Plugin/WeeklyReportGenerator/config.env
# 设置 DINGTALK_TABLE_UUID=your_table_uuid_here
```

**配置模板：**
```env
# 周报生成器配置

# VCP API 配置
VCP_API_URL=http://127.0.0.1:6005
VCP_API_KEY=your_vcp_api_key
DEFAULT_MODEL=Nova

# 钉钉 AI 表格配置（可选）
# 通过 DingTalkTable 插件调用，需确保 DingTalkTable 插件已启用
DINGTALK_TABLE_UUID=your_table_uuid_here
```

**验收标准：** `config.env` 文件存在，`DINGTALK_TABLE_UUID` 已填写

---

### 任务 3：验证插件依赖和启用状态

**执行人：** ______________  
**预计时间：** 5 分钟

**步骤：**
```powershell
# 1. 检查 DingTalkTable 是否启用（不应有 .block 后缀）
ls Plugin/DingTalkTable/plugin-manifest.json*

# 2. 检查 WeeklyReportGenerator 是否启用
ls Plugin/WeeklyReportGenerator/plugin-manifest.json*

# 3. 确认 DingTalkTable 插件可正常加载
# 启动服务器后查看日志中是否有 DingTalkTable 相关错误
```

**验收标准：**
- [ ] `Plugin/DingTalkTable/plugin-manifest.json` 存在（无 `.block` 后缀）
- [ ] `Plugin/WeeklyReportGenerator/plugin-manifest.json` 存在（无 `.block` 后缀）
- [ ] 服务器日志中无插件加载错误

---

### 任务 4：测试周报导出功能

**执行人：** ______________  
**预计时间：** 15 分钟

**前置条件：**
- 任务 1-3 已完成
- VCP 服务器已启动

**测试步骤：**

1. 通过 VCP 调用测试：
```text
<<<[TOOL_REQUEST]>>>
tool_name:「始」WeeklyReportGenerator「末」,
action:「始」export_to_table「末」,
content:「始」# 测试周报

本周完成:
- 完成 DingTalkTable 插件调用改造
- 优化配置结构

## 下周计划
- 完成测试验证
「末」,
summary:「始」测试周报 - 改造验证「末」,
table_uuid:「始」your_table_uuid_here「末」
<<<[END_TOOL_REQUEST]>>>
```

2. 检查返回结果：
```json
{
  "status": "success",
  "result": {
    "message": "周报已导出到钉钉 AI 表格",
    "recordId": "rec_xxx",
    "tableUuid": "your_table_uuid_here"
  }
}
```

3. 登录钉钉表格，确认记录已成功写入

**验收标准：**
- [ ] 返回状态为 `success`
- [ ] 返回 `record_id` 字段
- [ ] 钉钉表格中可看到新记录

---

### 任务 5：更新协作者文档

**执行人：** ______________  
**预计时间：** 10 分钟

**步骤：**

1. 通知使用 `WeeklyReportGenerator` 的团队成员以下变更：
   - 配置项变更（移除 `DINGTALK_MCP_URL` 等）
   - 新增依赖（需启用 `DingTalkTable` 插件）
   - 调用方式变更（内部实现，不影响接口）

2. 更新相关文档：
   - [ ] `Plugin/WorkLogScheduler/README.md`（如有引用）
   - [ ] 团队协作文档/变更记录

3. 提交变更说明：
```bash
git add Plugin/WeeklyReportGenerator/
git commit -m "feat: WeeklyReportGenerator 改为通过 DingTalkTable 插件调用

- 重构 exportToTable() 函数，通过 PluginManager 调用 DingTalkTable 插件
- 移除 DINGTALK_MCP_URL 和 DINGTALK_MCP_KEY 配置项
- 简化配置结构，统一写表逻辑到 DingTalkTable 插件
- 版本升级至 1.1.0
"
```

**验收标准：**
- [ ] 相关人员已收到变更通知
- [ ] 文档已更新
- [ ] 代码已提交

---

## 四、回滚方案

如遇问题需回滚，执行以下操作：

```powershell
# 1. 恢复代码
git checkout HEAD -- Plugin/WeeklyReportGenerator/WeeklyReportGenerator.js
git checkout HEAD -- Plugin/WeeklyReportGenerator/plugin-manifest.json
git checkout HEAD -- Plugin/WeeklyReportGenerator/config.env.example
git checkout HEAD -- Plugin/WeeklyReportGenerator/README.md

# 2. 恢复配置（如已修改）
# 重新配置 DINGTALK_MCP_URL 和 DINGTALK_MCP_KEY
```

---

## 五、联系方式

| 角色 | 人员 | 联系方式 |
|------|------|----------|
| 开发负责人 | | |
| 测试负责人 | | |
| 运维支持 | | |

---

## 六、变更记录

| 日期 | 版本 | 变更内容 | 变更人 |
|------|------|----------|--------|
| 2026-04-13 | 1.1.0 | 初始版本，改为通过 DingTalkTable 插件调用 | VCP Team |

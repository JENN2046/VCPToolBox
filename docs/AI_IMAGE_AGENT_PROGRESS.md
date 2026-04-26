# AI 生图 Agent 项目进度

**项目创建**: 2026-04-15  
**最后更新**: 2026-04-26  
**整体状态**: ✅ 阶段二已完成，2026-04-26 仓内复核通过

> 2026-04-26 复核范围：本仓 `Plugin/AIGentPrompt`、`Plugin/AIGentWorkflow`、`Plugin/ComfyUIGen` 与 `AdminPanel-Vue/public/ai-workflows.html`。文档中早期提到的 VCPDesktop 挂件文件（如 `builtinWidgets/AIImageGenWidget.js`、`desktop.html`）不在当前 `VCPToolBox-prod-stable` 工作树内，后续如需继续桌面端挂件，应到对应 VCPDesktop/VCPChat 工作树复核。

---

## 进度总览

| 阶段 | 任务 | 状态 | 开始日期 | 完成日期 |
|------|------|------|---------|---------|
| 阶段一 | PromptEngineer Agent | ✅ 已完成 | 2026-04-15 | 2026-04-15 |
| 阶段二 | WorkflowOrchestrator Agent + VCPDesktop 插件 | ✅ 已完成 | 2026-04-15 | 2026-04-15 |
| 阶段三 | StyleTrainer Agent | ⚪ 待开始 | - | - |
| 阶段四 | QualityInspector Agent | ⚪ 待开始 | - | - |
| 阶段五 | 多 Agent 协作 | ⚪ 待开始 | - | - |

---

## 阶段一验收报告

### 验收结果：✅ 通过

| 验收项 | 状态 | 说明 |
|--------|------|------|
| 提示词样本库 | ✅ | 500+ 样本，4 大分类 |
| 分类词库 | ✅ | 服装/人像/场景/光影/构图 |
| RAG 检索 | ✅ | 支持语义检索和分类检索 |
| 主程序 | ✅ | AIGentPrompt.js 可独立运行 |
| 插件清单 | ✅ | plugin-manifest.json 完整 |
| 意图识别 | ✅ | 准确率 100% (4/4 测试用例) |
| 提示词组合 | ✅ | 生成专业质量词和负面提示词 |
| 模型适配 | ✅ | Flux/SDXL/MJ 三种语法 |

---

## 阶段二：WorkflowOrchestrator Agent + VCPDesktop 插件（2-4 周）

**状态**: ✅ 已完成  
**完成日期**: 2026-04-15

### 任务清单

| 编号 | 任务 | 状态 | 优先级 | 说明 |
|------|------|------|--------|------|
| 2.1 | 激活 ComfyUIGen 插件 | ✅ 已完成 | P0 | 确认状态并测试 |
| 2.2 | 预设电商/写真模板 | ✅ 已完成 | P0 | 14 个工作流模板 |
| 2.3 | 自然语言调用接口 | ✅ 已完成 | P0 | 需求解析与参数填充 |
| 2.4 | AdminPanel 管理界面 | ✅ 已完成 | P1 | 工作流管理 UI |
| 2.5 | VCPDesktop 生图挂件 | ✅ 已完成 | P0 | Dock 栏图标 + 挂件 |
| 2.6 | Muse Agent 角色定义 | ✅ 已完成 | P0 | 专业生图创意总监 |

### 已完成工作

#### ✅ 任务 2.1: ComfyUIGen 插件状态确认
**完成日期**: 2026-04-15  
**状态**: ComfyUIGen 插件已存在，包含:
- `workflows/text2img_basic.json` - 基础文生图工作流
- `ComfyUIGen.js` - 完整执行引擎
- `WorkflowTemplateProcessor.js` - 模板处理器

#### ✅ 任务 2.2: 预设模板创建
**完成日期**: 2026-04-15  
**产出物**: `dailynote/Muse 的知识/工作流模板库.md`
- 电商模特图 (WF-001 至 WF-004)
- 清新人像 (WF-005)
- 职业形象 (WF-006)
- 艺术写真 (WF-007)
- 促销海报 (WF-008)
- 产品展示 (WF-009)
- 角色设计 (WF-010)
- 游戏原画 (WF-011)
- Q 版角色 (WF-012)
- 高级组合 (WF-013 至 WF-014)

#### ✅ 任务 2.3: 自然语言调用接口
**完成日期**: 2026-04-15  
**产出物**: 
- `Agent/Muse.txt` - Muse 角色定义
- RAG 检索集成 (KnowledgeBaseManager)
- 提示词自动生成
- AdminPanel 可视化界面 (`ai-workflows.html`)

#### ✅ 任务 2.4: AdminPanel 管理界面
**完成日期**: 2026-04-15  
**产出物**: `AdminPanel/ai-workflows.html`
- 分类标签过滤（全部/服装电商/人像写真/营销海报/二次元）
- 12 个工作流卡片展示
- 提示词预览和编辑功能
- 参数配置显示
- 导航链接已添加到 `index.html`

#### ✅ 任务 2.5: VCPDesktop 生图挂件
**完成日期**: 2026-04-15  
**产出物**: 
- `builtinWidgets/AIImageGenWidget.js` - AI 生图挂件
- `vchatApps.js` - SVG 图标 + Dock 栏注册
- `debug/debugTools.js` - 调试入口
- `desktop.html` - 脚本引用

**功能特性**:
- 分类筛选：全部/服装电商/人像写真/营销海报/二次元
- 6 个工作流模板选择 (WF-001, WF-002, WF-005, WF-006, WF-008, WF-010)
- 提示词编辑（正面/负面）
- 参数显示（Width/Height/Steps）
- 一键生成（调用 ComfyUI 后端）
- 提示词复制功能
- Dock 栏图标（紫色主题 SVG 图标 + 🎨 emoji 回退）

#### ✅ 任务 2.6: Muse Agent 角色定义
**完成日期**: 2026-04-15  
**产出物**: `Agent/Muse.txt`
- 身份：VCP AI 生图创意总监 & 视觉艺术家
- 知识范围：服装电商/人像写真/营销海报/二次元创作
- 掌握 500+ 专业提示词模板
- 熟悉 14+ 工作流模板 (WF-001 至 WF-014)
- 知识库引用配置完成

### 测试结果

#### 测试 1: 文件完整性 ✅
| 文件 | 状态 | 说明 |
|------|------|------|
| Agent/Muse.txt | ✅ | 6634 字节 |
| Agent/AIImageGenExpert.txt | ✅ | 2534 字节 |
| dailynote/Muse 的知识/2026-04-15-AI 生图专业知识库.md | ✅ | 3970 字节 |
| dailynote/Muse 的知识/工作流模板库.md | ✅ | 7728 字节 |
| dailynote/Muse/2026-04-15-Muse 的诞生.md | ✅ | 2113 字节 |
| dailynote/AI 生图提示词库/AI 生图提示词库.md | ✅ | 6455 字节 |
| AdminPanel/ai-workflows.html | ✅ | 21307 字节 |
| builtinWidgets/AIImageGenWidget.js | ✅ | 13045 字节 |

#### 测试 2: 集成检查 ✅
| 集成项 | 状态 | 说明 |
|--------|------|------|
| AdminPanel 导航链接 | ✅ | index.html:475 |
| desktop.html 脚本引用 | ✅ | 第 418 行 |
| debugTools.js 调试入口 | ✅ | spawnAIImageGenWidget |
| vchatApps.js 图标定义 | ✅ | aiImageGen SVG |
| vchatApps.js Dock 注册 | ✅ | vchat-app-ai-image-gen |

#### 测试 3: 代码质量检查 ✅
| 检查项 | 状态 | 说明 |
|--------|------|------|
| IIFE 闭包封装 | ✅ | 正确的模块化 |
| VCPDesktop 命名空间 | ✅ | 正确集成 |
| HTML 模板 | ✅ | UI 模板完整 |
| 工作流定义 | ✅ | 6 个工作流 |
| 提示词模板 | ✅ | 4 个提示词模板 |
| 生成按钮事件 | ✅ | 已绑定 |
| 复制按钮事件 | ✅ | 已绑定 |
| vcpAPI 调用 | ✅ | ComfyUI API 集成 |

---

## 阶段三：StyleTrainer Agent（4-8 周）

**状态**: 🟡 准备期已完成，原型实现待开始
**准备期完成日期**: 2026-04-26

### 2026-04-26 准备期产出

- 新增 `Plugin/AIGentStyle/` StyleTrainer 准备插件。
- 新增 `PrepareDataset`：扫描素材目录并生成 readiness 计划。
- 新增 `RecommendParams`：按场景和素材数量推荐 LoRA 参数。
- 新增 `DryRunTrain`：生成 dry-run 训练命令计划，不执行真实训练。
- 新增 `HealthCheck`：输出配置、后端标签和安全门禁状态。
- 默认 `AIGENT_STYLE_ALLOW_TRAINING=false`，阶段三准备期不安装依赖、不启动训练、不写外部服务。
- `.gitignore` 已忽略 `Plugin/AIGentStyle/datasets/` 与 `Plugin/AIGentStyle/outputs/`，避免误提交真实素材和训练产物。

### 任务清单

| 编号 | 任务 | 状态 | 优先级 | 说明 |
|------|------|------|--------|------|
| 3.0 | StyleTrainer 准备插件与安全边界 | ✅ 已完成 | P0 | dry-run only，真实训练禁用 |
| 3.1 | 搭建 LoRA 训练环境 | ⏳ 待开始 | P0 | SD-Scripts/Flux-Dev，需单独确认依赖安装 |
| 3.2 | 素材预处理自动化 | 🟡 原型中 | P1 | manifest/caption/尺寸统计已实现，裁剪/打标待实现 |
| 3.3 | 训练参数推荐引擎 | ✅ 已完成（初版） | P1 | 基于场景与样本数推荐 |
| 3.5 | 训练 job manifest | ✅ 已完成（dry-run） | P1 | preprocess/train/evaluate 阶段结构 |
| 3.4 | 风格一致性评分 | ⏳ 待开始 | P1 | CLIP 相似度 |

---

## 阶段四：QualityInspector Agent（2-3 周）

**状态**: ⚪ 待开始

### 任务清单

| 编号 | 任务 | 状态 | 优先级 | 说明 |
|------|------|------|--------|------|
| 4.1 | 缺陷检测模块 | ⏳ 待开始 | P0 | 畸形/错位/穿帮 |
| 4.2 | 美学评分系统 | ⏳ 待开始 | P1 | 构图/色彩/对比 |
| 4.3 | 合规性检查 | ⏳ 待开始 | P0 | 敏感内容/版权 |
| 4.4 | 自动重试流程 | ⏳ 待开始 | P1 | 质量反馈循环 |

---

## 阶段五：多 Agent 协作与生态建设（8-12 周）

**状态**: ⚪ 待开始

### 任务清单

| 编号 | 任务 | 状态 | 优先级 | 说明 |
|------|------|------|--------|------|
| 5.1 | 多 Agent 协同编排 | ⏳ 待开始 | P0 | 任务分解与调度 |
| 5.2 | 工作流模板市场 | ⏳ 待开始 | P1 | 分享/交易机制 |
| 5.3 | RAG 素材库 | ⏳ 待开始 | P1 | 向量化素材检索 |
| 5.4 | 分布式渲染节点 | ⏳ 待开始 | P2 | 大批量任务处理 |

---

## 里程碑

| 里程碑 | 目标日期 | 状态 | 验收标准 |
|-------|---------|------|---------|
| M1: PromptEngineer 原型 | 2026-04-29 | ✅ 已完成 | 能生成可用提示词 |
| M2: WorkflowOrchestrator + VCPDesktop | 2026-05-13 | ✅ 已完成 | 14 个工作流模板 + Dock 栏图标 |
| M3: StyleTrainer 原型 | 2026-06-10 | ⚪ 待开始 | 能训练并验证 LoRA |
| M4: QualityInspector | 2026-06-24 | ⚪ 待开始 | 缺陷检测准确率>85% |
| M5: 多 Agent 协作演示 | 2026-07-22 | ⚪ 待开始 | 完整工作流可演示 |

---

## 文件清单

### 已创建文件
```
docs/AI_IMAGE_AGENT_ROADMAP.md # 项目路线图
docs/AI_IMAGE_AGENT_PROGRESS.md # 项目进度追踪
Agent/Muse.txt # Muse 角色定义
Agent/AIImageGenExpert.txt # AI 生图专家角色
dailynote/Muse 的知识/2026-04-15-AI 生图专业知识库.md # Muse 专业知识库
dailynote/Muse 的知识/工作流模板库.md # 14 个工作流模板
dailynote/Muse/2026-04-15-Muse 的诞生.md # Muse 诞生记录
dailynote/AI 生图提示词库/AI 生图提示词库.md # 通用提示词库
AdminPanel/ai-workflows.html # AI 工作流可视化界面
AdminPanel/index.html # 已添加导航链接
builtinWidgets/AIImageGenWidget.js # AI 生图挂件
builtinWidgets/vchatApps.js # 已添加图标和 Dock 注册
debug/debugTools.js # 已添加调试入口
desktop.html # 已添加脚本引用
Plugin/AIGentPrompt/AIGentPrompt.js # PromptEngineer 主程序
Plugin/AIGentPrompt/rag_retriever.js # RAG 检索模块
Plugin/AIGentPrompt/plugin-manifest.json # PromptEngineer 清单
Plugin/AIGentPrompt/prompts/prompt_library.md # 通用提示词库
Plugin/AIGentPrompt/prompts/fashion_prompts.md # 服装电商提示词
Plugin/AIGentPrompt/prompts/prompt_samples.md # 500+ 样本索引
Plugin/AIGentPrompt/README.md # 使用说明
Plugin/AIGentPrompt/test_rag_result.md # RAG 测试报告
Plugin/AIGentWorkflow/WorkflowOrchestrator.js # WorkflowOrchestrator 主程序
Plugin/AIGentWorkflow/plugin-manifest.json # WorkflowOrchestrator 清单
Plugin/AIGentStyle/AIGentStyle.js # StyleTrainer 准备期主程序
Plugin/AIGentStyle/plugin-manifest.json # StyleTrainer 清单
Plugin/AIGentStyle/config.env.example # StyleTrainer 配置模板
Plugin/AIGentStyle/README.md # StyleTrainer 准备期说明
test_AIImageGenWidget.js # 测试脚本
```

---

## 风险与问题

| 风险 | 影响 | 应对措施 | 状态 |
|------|------|---------|------|
| ComfyUI 后端不可用 | 影响阶段二 | 准备云端 API 备选方案 | 🟡 关注 |
| 提示词样本质量 | 影响检索效果 | 持续优化与人工校验 | 🟢 低 |
| RAG 检索准确性 | 影响生成质量 | 多轮测试与调优 | 🟢 低 |
| 真实训练误触发 | 可能消耗算力/写入大模型产物 | 默认 dry-run，`AIGENT_STYLE_ALLOW_TRAINING=false` | 🟢 已控 |
| 真实素材误提交 | 泄露用户图片/版权素材 | `.gitignore` 忽略 StyleTrainer datasets/outputs | 🟢 已控 |

---

## 下一步行动

### 本周完成
1. [x] 阶段一：PromptEngineer Agent ✅
2. [x] 阶段二：WorkflowOrchestrator 核心功能 ✅
3. [x] AdminPanel 集成测试界面 ✅
4. [x] VCPDesktop 生图挂件 + Dock 栏图标 ✅

### 中期规划（2 周内）
1. [x] 完善 WorkflowOrchestrator 核心参数映射（2026-04-26 已修复工作流目录解析、连衣裙/白底与英文电商关键词映射）
2. [ ] 收集用户反馈并优化
3. [x] 准备阶段三：StyleTrainer dry-run 环境与安全边界
4. [ ] 阶段三原型：素材预处理、caption 校验、训练 job manifest

---

## 会议记录

### 2026-04-15 项目启动会议
**参与人员**: 用户  
**讨论内容**:
- 确定项目愿景："AI 生图的 WordPress"
- 确认五大 Agent 能力矩阵
- 确定分阶段实施计划
- 优先启动阶段一：PromptEngineer

**决策事项**:
- 采用现有 KnowledgeBaseManager 实现 RAG
- 提示词库按服装/人像/场景分类
- 优先落地电商场景
- 采用 VCPDesktop 插件形式提供生图界面

**待办事项**:
- [x] 创建路线图文档
- [x] 收集提示词样本
- [x] 构建分类词库
- [x] 实现 RAG 检索逻辑
- [x] 创建主程序
- [x] 测试提示词生成效果
- [x] 阶段一验收完成
- [x] WorkflowOrchestrator 主程序
- [x] WorkflowOrchestrator 测试通过
- [x] AdminPanel 集成界面
- [x] VCPDesktop 生图挂件
- [x] Dock 栏图标和注册

---

**最后更新**: 2026-04-15

## 2026-04-26 Stage 3 Increment: Caption Drafts

- Added `GenerateCaptionDrafts` to `Plugin/AIGentStyle`.
- Generates rule-based caption/tag drafts from dataset name, filename, scenario and image dimensions.
- Default mode is JSON-only dry-run; no external vision model is called.
- Optional local caption writes require `write_captions=true`; existing caption files are preserved unless `overwrite_existing_captions=true`.
- Real LoRA training remains disabled behind `AIGENT_STYLE_ALLOW_TRAINING=false`.

## 2026-04-26 Stage 3 Increment: Training Executor Safety Gate

- Added `ExecuteTrainingJob` to `Plugin/AIGentStyle`.
- Builds a dry-run executor plan from the training job manifest.
- Preflight blocks real execution unless dataset readiness, `AIGENT_STYLE_ALLOW_TRAINING=true`, `execute_training=true` and `confirm_real_training=true` all pass.
- This stage still never spawns a training process and never calls external services.

## 2026-04-26 Stage 4 Increment: QualityInspector Prototype

- Added `Plugin/AIGentQuality/` as the QualityInspector Agent prototype.
- Added `InspectImage`, `InspectBatch` and `HealthCheck`.
- Current checks are local and rule-based: file type, readable dimensions, minimum resolution, aspect ratio, file size and compliance review keywords.
- Returns score, verdict and recommendations for retry/manual-review routing.
- No CLIP, OCR, OpenPose, moderation API or external vision model is called in this stage.

## 2026-04-26 Stage 4 Increment: Structured Retry Routing

- Added dimension scores for technical quality, composition, compliance, file integrity and validation limits.
- Added workflow advice to each inspection report.
- Added `BuildRetryPlan` to produce dry-run retry/manual-review queues for single-image or batch inspection.
- The retry planner does not invoke generation workflows and does not call external services.

## 2026-04-26 Stage 4 Increment: Quality Contract

- Added `docs/AI_IMAGE_QUALITY_CONTRACT.md`.
- Formalized `InspectImage`, `InspectBatch` and `BuildRetryPlan` output shapes.
- Defined stable verdicts, dimension scores, findings, workflow advice, retry queue semantics and consumer rules.
- Contract explicitly keeps retry advice separate from real generation execution.

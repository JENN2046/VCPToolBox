# VCPToolBox AI 生图 Agent 路线图

**创建日期**: 2026-04-15  
**最后更新**: 2026-04-15  
**状态**: 规划阶段

---

## 一、愿景与定位

### 愿景
**让 VCPToolBox 成为"AI 生图的 WordPress"** —— 让中小商家/设计师/内容创作者能像搭建博客一样搭建自己的生图工作流。

### 核心定位
```
闭云厂商 API ←→ VCP 中间层 ←→ 终端用户/企业
(Flux/MJ/SD)   (编排/管理/批处理)   (电商/设计/内容)
```

### 差异化价值
| 维度 | Midjourney/DALL-E | VCPToolBox |
|------|------------------|-----------|
| 部署方式 | 纯云端 API | 本地/私有云/混合 |
| 可控性 | 黑盒生成 | 完全可编程 |
| 批量能力 | 弱 | 强（插件化队列） |
| 集成性 | 封闭 | 可对接企业系统 |
| 数据隐私 | 数据出域 | 本地处理 |
| 成本模型 | 按张计费 | 一次性部署 |

---

## 二、核心能力架构

```
┌─────────────────────────────────────────────────────────┐
│ 应用层 (Application) │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ 电商批图 │ │ 人像写真 │ │ 营销海报 │ │ 定制插件 │ │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
├─────────────────────────────────────────────────────────┤
│ 编排层 (Orchestration) - VCP Agent 核心 │
│ ┌──────────────────────────────────────────────────┐ │
│ │ ComfyUI 工作流 + VCP 插件调度 + RAG 素材检索 │ │
│ └──────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ 模型层 (Model Backend) │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│ │ Flux.1 │ │ SDXL │ │ Ideogram│ │ 自训 LoRA│ │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 三、Agent 能力矩阵

### 五大核心 Agent

| Agent | 职责 | 训练方式 | 优先级 |
|-------|------|---------|-------|
| **PromptEngineer** | 提示词专家 | RAG 检索 + 模板组合 | ⭐⭐⭐⭐⭐ |
| **WorkflowOrchestrator** | 工作流编排 | 规则引擎 + 经验库 | ⭐⭐⭐⭐⭐ |
| **StyleTrainer** | 风格训练师 | LoRA 微调 | ⭐⭐⭐⭐ |
| **QualityInspector** | 质量检测员 | 规则 + CLIP 评分 | ⭐⭐⭐⭐ |
| **ParamTuner** | 参数调优师 | 规则引擎 | ⭐⭐⭐ |

### Agent 能力详解

#### 1. PromptEngineer（提示词工程师）
- **能力**: 意图理解 → 提示词转换 → 多模型语法适配
- **知识库**: Flux/SDXL/MJ 提示词规范、服装/人像/场景专属词库
- **训练数据**: 1000+ 优质提示词样本、提示词 - 结果对

#### 2. WorkflowOrchestrator（工作流编排师）
- **能力**: 需求解析 → 模板匹配 → 参数填充 → 执行调度 → 结果聚合
- **模板库**: 电商模特、人像写真、营销海报、二次元创作
- **依赖**: ComfyUI 后端、RAG 素材检索

#### 3. StyleTrainer（风格训练师）
- **能力**: 素材预处理 → 自动打标 → 训练参数推荐 → LoRA 训练 → 效果验证
- **训练方式**: Dreambooth/LoRA 微调
- **数据需求**: 15-50 张风格样本/LoRA

#### 4. QualityInspector（质量检测员）
- **检测维度**:
  - 解剖学：手指/五官/肢体 (OpenPose 校验)
  - 物理一致性：光影/透视/重力 (规则引擎)
  - 文字准确性：拼写/排版 (OCR 校验)
  - 品牌合规：Logo/商标 (图像检索)
  - 美学质量：构图/色彩/对比 (CLIP 评分)

#### 5. ParamTuner（参数调优师）
- **参数空间**: steps, cfg_scale, width/height, seed, ControlNet weight, IP-Adapter weight
- **决策逻辑**: 质量评估 → 参数诊断 → 调整建议 → 自动重试

---

## 四、分阶段实施计划

### 阶段一：PromptEngineer Agent（1-2 周）
**目标**: 让 Agent 能理解需求并生成专业提示词

**交付物**:
- [ ] 收集 500+ 优质提示词样本
- [ ] 构建服装/人像/场景分类词库
- [ ] 实现 RAG 检索 + 组合生成逻辑
- [ ] 集成到 AdminPanel 测试界面

**技术要点**:
```javascript
// Plugin/AIGentPrompt/
class PromptEngineerAgent {
  async generate(prompt, context) {
    const intent = await this.identifyIntent(prompt);
    const similarPrompts = await this.knowledgeBase.search(prompt);
    const engineeredPrompt = this.composePrompt(intent, similarPrompts);
    return this.adaptToModel(engineeredPrompt, context.model);
  }
}
```

---

### 阶段二：WorkflowOrchestrator Agent（2-4 周）
**目标**: 让 Agent 能编排 ComfyUI 工作流

**交付物**:
- [ ] 激活 `ComfyUIGen` 插件
- [ ] 预设 3-5 个电商/写真模板
- [ ] 实现自然语言调用接口
- [ ] AdminPanel 工作流管理界面

**预设模板**:
- 电商模特（平铺→模特）
- 同款多色批量生成
- 人像写真（多风格切换）
- 场景化穿搭合成

**技术要点**:
```javascript
// Plugin/AIGentWorkflow/
class WorkflowAgent {
  async execute(naturalLanguageRequest) {
    const requirements = await this.parseRequest(naturalLanguageRequest);
    const template = await this.matchTemplate(requirements);
    const workflow = this.fillTemplate(template, requirements);
    return await this.comfyUI.execute(workflow);
  }
}
```

---

### 阶段三：StyleTrainer Agent（4-8 周）
**目标**: 让 Agent 能辅助训练专属风格 LoRA

**交付物**:
- [ ] 搭建 LoRA 训练环境
- [ ] 素材预处理自动化
- [ ] 训练参数推荐引擎
- [ ] 风格一致性评分系统
- [ ] 首个垂直风格 LoRA（电商/二次元）

**训练 SOP**:
1. 收集素材 (15-50 张风格样本)
2. 自动裁剪/打标
3. 训练参数推荐
4. 执行训练 (SD-Scripts / Flux-Dev)
5. 效果验证 (生成测试集)

---

### 阶段四：QualityInspector Agent（2-3 周）
**目标**: 建立质量检测与自动筛选能力

**交付物**:
- [ ] 缺陷检测（畸形/错位/穿帮）
- [ ] 美学评分系统
- [ ] 合规性检查（敏感内容/版权元素）
- [ ] 自动重试与人工审核流程

**检测维度**:
| 维度 | 检测内容 | 技术方案 |
|------|---------|---------|
| 解剖学 | 手指/五官/肢体 | OpenPose 校验 |
| 物理一致性 | 光影/透视/重力 | 规则引擎 |
| 文字准确性 | 拼写/排版 | OCR 校验 |
| 品牌合规 | Logo/商标 | 图像检索 |
| 美学质量 | 构图/色彩/对比 | CLIP 评分 |

---

### 阶段五：多 Agent 协作与生态建设（8-12 周）
**目标**: 构建完整的 Agent 协作生态

**交付物**:
- [ ] 多 Agent 协同编排引擎
- [ ] 工作流模板市场（可分享/交易）
- [ ] RAG 素材库（向量化检索）
- [ ] 分布式渲染节点调度
- [ ] 用户权限与审计日志

---

## 五、技术架构

### 推荐技术栈
- **主引擎**: Flux.1 Dev（开源质量最佳）
- **控制层**: ControlNet Union（支持多条件）
- **批处理**: ComfyUI API
- **向量检索**: 现有 KnowledgeBaseManager
- **前端**: AdminPanel 集成

### 插件目录规划
```
Plugin/
├── AIGentPrompt/          # PromptEngineer Agent
├── AIGentWorkflow/        # WorkflowOrchestrator Agent
├── AIGentStyle/           # StyleTrainer Agent
├── AIGentQuality/         # QualityInspector Agent
├── AIGentParam/           # ParamTuner Agent
├── ComfyUIGen/            # ComfyUI 后端集成（已有）
├── ImageProcessor/        # 图像处理中台（已有）
└── AIGentOrchestrator/    # 多 Agent 编排总控
```

---

## 六、风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| 模型迭代快 | 今天训练的 Agent 明天过时 | 保持 Agent 与模型解耦，快速适配 |
| 训练数据少 | 垂直场景样本不足 | 合成数据增强 + 社区共建 |
| 效果不稳定 | Agent 决策失误 | 保留人工审核环节 |
| 算力成本高 | LoRA 训练耗时 | 云端训练 + 本地推理 |
| 版权争议 | 训练数据/生成内容纠纷 | 建立素材溯源机制，支持授权管理 |
| 监管政策 | 深度合成管理规定 | 内置"AI 生成"水印与审计日志 |

---

## 七、里程碑与验收标准

| 里程碑 | 时间 | 验收标准 |
|-------|------|---------|
| M1: PromptEngineer 原型 | 2026-04-29 | 能生成可用提示词 |
| M2: WorkflowOrchestrator | 2026-05-13 | 能执行电商/写真模板 |
| M3: StyleTrainer 原型 | 2026-06-10 | 能训练并验证 LoRA |
| M4: QualityInspector | 2026-06-24 | 缺陷检测准确率>85% |
| M5: 多 Agent 协作 | 2026-07-22 | 完整工作流可演示 |

---

## 八、参考资源

- **PromptBase**: https://promptbase.com/ - 优质提示词来源
- **CivitAI**: https://civitai.com/ - LoRA 模型与训练样本
- **ComfyUI Examples**: https://comfyanonymous.github.io/ - 工作流参考
- **Flux.1 GitHub**: https://github.com/black-forest-labs/flux

---

## 九、下一步行动

1. **立即可做** - 激活 `ComfyUIGen` 插件，确认当前状态
2. **本周完成** - 收集 500+ 提示词样本，构建基础词库
3. **两周内** - 实现 PromptEngineer 原型并集成到 AdminPanel
4. **持续进行** - 积累垂直场景样本，建立 RAG 知识库

---

**文档维护**: 本路线图应随项目进展持续更新，每次里程碑完成后同步修订。

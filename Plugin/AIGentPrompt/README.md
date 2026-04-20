# AIGentPrompt - AI 生图提示词工程师

**版本**: 0.1.0  
**创建日期**: 2026-04-15  
**状态**: 开发完成

---

## 概述

AIGentPrompt 是 VCPToolBox AI 生图 Agent 系统的第一个核心组件，负责：
1. 理解用户自然语言需求
2. 从 RAG 知识库检索专业提示词
3. 组合生成高质量提示词
4. 适配不同模型语法（Flux/SDXL/Midjourney）

---

## 文件结构

```
Plugin/AIGentPrompt/
├── plugin-manifest.json      # 插件清单
├── AIGentPrompt.js           # 主程序
├── rag_retriever.js          # RAG 检索模块
├── prompts/
│   ├── prompt_library.md     # 通用提示词库
│   ├── fashion_prompts.md    # 服装电商提示词
│   └── prompt_samples.md     # 500+ 样本索引
└── README.md                 # 本文档
```

---

## 功能特性

### 1. RAG 检索
- 基于 KnowledgeBaseManager 语义检索
- 从 dailynote 知识库检索相似提示词
- 支持 Top-K 结果返回

### 2. 意图识别
- 自动识别场景分类（服装/人像/营销/二次元）
- 识别子分类（连衣裙/衬衫/外套等）
- 识别风格（商业/艺术/休闲）

### 3. 提示词组合
- 从相似样本提取基础
- 添加质量增强词
- 生成负面提示词

### 4. 模型适配
- Flux.1 语法
- SDXL 语法
- Midjourney 语法

---

## 使用方法

### API 调用

#### 1. 生成提示词
```javascript
const result = await aIGentPrompt.generatePrompt(
  '生成一张女装连衣裙的电商模特图，白色背景',
  { modelType: 'flux', quality: 'ultra' }
);
```

#### 2. 搜索模板
```javascript
const templates = await retriever.searchPrompts(
  '连衣裙 模特 电商',
  'fashion',
  10
);
```

### 工具调用

```
<<<[TOOL_REQUEST]>>>
maid:「始」AIGentPrompt「末」,
tool_name:「始」GenerateImagePrompt「末」,
user_input:「始」生成一张女装连衣裙的电商模特图，白色背景「末」,
model_type:「始」flux「末」,
quality:「始」ultra「末」
<<<[END_TOOL_REQUEST]>>>
```

---

## 提示词库

### 分类体系
| 分类 | 代码 | 说明 |
|------|------|------|
| 服装电商 | fashion | 连衣裙/上衣/外套/裤装等 |
| 人像写真 | portrait | 清新/职业/艺术/情侣 |
| 营销海报 | marketing | 促销/展示/品牌 |
| 二次元 | anime | 日系/游戏/Q 版 |

### 质量等级
| 等级 | 说明 |
|------|------|
| base | masterpiece, best quality |
| ultra | ultra-detailed, 8k, highres |
| photorealistic | photorealistic, professional |
| artistic | cinematic, dramatic |

---

## 依赖

- KnowledgeBaseManager.js - 向量检索
- RAGDiaryPlugin - 嵌入向量化
- dailynote/AI 生图提示词库 - 提示词数据

---

## 测试

待添加单元测试。

---

## 下一步

1. [ ] 添加单元测试
2. [ ] AdminPanel 集成界面
3. [ ] 提示词历史记录
4. [ ] 提示词评分反馈

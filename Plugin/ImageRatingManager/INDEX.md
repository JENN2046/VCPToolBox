# 图片评分管理系统 - 完整索引

## 文档导航

### 📖 核心文档
| 文档 | 说明 | 用途 |
|------|------|------|
| [QUICKSTART.md](QUICKSTART.md) | 快速开始指南 | 首次使用 |
| [README.md](README.md) | 使用文档 | 功能说明 |
| [EXAMPLES.md](EXAMPLES.md) | 使用示例 | 代码参考 |

### 📋 项目文档
| 文档 | 说明 |
|------|------|
| [TASKS.md](TASKS.md) | 任务清单和进度 |
| [SUMMARY.md](SUMMARY.md) | 项目总结 |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | 实现说明 |

---

## 快速链接

### 核心功能
- [API 接口文档](#api-接口)
- [Agent 工具列表](#agent-工具)
- [数据库结构](#数据库结构)

### 使用指南
1. 查看 [QUICKSTART.md](QUICKSTART.md) 快速上手
2. 参考 [EXAMPLES.md](EXAMPLES.md) 编写代码
3. 查看 [TASKS.md](TASKS.md) 了解进度

---

## API 接口

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/image-rating/stats` | 统计信息 |
| GET | `/api/image-rating/images` | 搜索图片 |
| PUT | `/api/image-rating/image/:id/rating` | 设置评分 |
| PUT | `/api/image-rating/image/:id/favorite` | 设置收藏 |
| POST | `/api/image-rating/image/:id/tags` | 添加标签 |
| DELETE | `/api/image-rating/image/:id/tags` | 删除标签 |

---

## Agent 工具

```javascript
const ratingTools = require('./Plugin/ImageRatingManager/agent-tools.js');

// 搜索
await ratingTools.agentSearchImages(options);
await ratingTools.agentGetHighRatedImages(minScore, limit);
await ratingTools.agentGetFavorites();

// 操作
await ratingTools.agentSetImageRating(imagePath, score, comment);
await ratingTools.agentAddImageTags(imagePath, tags);

// 分析
await ratingTools.agentGetStats();
await ratingTools.agentAnalyzeScoreDistribution();
```

---

## 数据库结构

```
images ────── ratings (1:1)
   │
   └── image_tags ─── tags (N:M)
```

---

## 文件清单

```\nPlugin/ImageRatingManager/\n├── image-rating-manager.js   # 核心模块\n├── agent-tools.js             # Agent 工具\n├── test-rating-system.js      # 测试脚本\n├── README.md                  # 主文档\n├── QUICKSTART.md              # 快速开始\n├── EXAMPLES.md                # 使用示例\n├── TASKS.md                   # 任务清单\n├── SUMMARY.md                 # 项目总结\n├── IMPLEMENTATION.md          # 实现说明\n└── INDEX.md                   # 本文件\n```\n\n---

## 相关项目

- [VCPToolBox](../../README.md) - 主项目
- [AdminPanel](../../AdminPanel/README.md) - 管理面板
- [ImageAutoRegister](../ImageAutoRegister/README.md) - 自动注册监听器（覆盖所有生图插件）

---

## 更新日期

2026-04-16

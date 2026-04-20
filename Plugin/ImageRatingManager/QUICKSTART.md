# 图片评分管理系统 - 快速开始指南

## 概述

AI 生图评分管理系统，用于对 VCP 中 AI 生成的图片进行**1-10 分评分**、**评价**、**标签**和**收藏**管理。

---

## 快速使用

### 1. 访问管理面板

服务启动后，在浏览器中访问：
```
http://localhost:3001/AdminPanel/image-management.html
```

### 2. 基本操作

- **评分**：点击图片卡片的"编辑"按钮，输入 1-10 分评分
- **标签**：在标签输入框输入标签名，逗号分隔
- **收藏**：点击星星图标收藏/取消收藏
- **筛选**：使用顶部筛选器按评分、标签、来源筛选图片

---

## Agent 集成

### 在代码中调用

```javascript
const ratingTools = require('./Plugin/ImageRatingManager/agent-tools.js');

// 获取高分图片作为参考
const highRated = await ratingTools.agentGetHighRatedImages(7, 10);

// 为图片设置评分
await ratingTools.agentSetImageRating('image/zimagegen/xxx.png', 9, '很好的效果');

// 添加标签
await ratingTools.agentAddImageTags('image/zimagegen/xxx.png', ['高质量', '推荐']);

// 获取统计信息
const stats = await ratingTools.agentGetStats();
```

### 典型使用场景

#### 场景 1：生成前参考历史高分图片
```javascript
const highRated = await ratingTools.agentGetHighRatedImages(8, 5);
if (highRated.success) {
  // 分析高分图片的特征和标签
  const tags = highRated.images.flatMap(img => img.tags || []);
  // 在提示词中参考这些标签
}
```

#### 场景 2：分析某类标签的图片质量
```javascript
const landscapeImages = await ratingTools.agentSearchImages({
  tags: ['风景'],
  limit: 100
});
```

#### 场景 3：获取收藏的图片
```javascript
const favorites = await ratingTools.agentGetFavorites();
```

---

## API 端点

| 端点 | 说明 |
|------|------|
| `GET /api/image-rating/stats` | 统计信息 |
| `GET /api/image-rating/images` | 搜索图片 |
| `PUT /api/image-rating/image/:id/rating` | 设置评分 |
| `PUT /api/image-rating/image/:id/favorite` | 设置收藏 |
| `POST /api/image-rating/image/:id/tags` | 添加标签 |

---

## 文件结构

```
Plugin/ImageRatingManager/
├── image-rating-manager.js   # 核心模块
├── agent-tools.js             # Agent 工具
├── README.md                  # 完整文档
├── EXAMPLES.md                # 使用示例
├── QUICKSTART.md              # 本文件
└── test-rating-system.js      # 测试脚本
```

---

## 故障排除

### 数据库初始化失败
检查 `better-sqlite3` 是否已安装：
```bash
npm install better-sqlite3
```

### API 无法访问
确认服务已启动且路由已加载：
```bash
grep "image-rating" server.js
```

### 标签不显示
检查数据库中标签是否正确插入：
```javascript
const db = require('better-sqlite3')('image_ratings.sqlite');
console.log(db.prepare('SELECT * FROM tags').all());
```

---

## 更多信息

- 完整文档：`README.md`
- 使用示例：`EXAMPLES.md`
- 任务清单：`TASKS.md`

# 图片评分管理系统

AI 生图评分管理系统，用于对 VCP 中 AI 生成的图片进行评分、评价、标签和收藏管理。

## 功能特性

- **1-10 分评分系统** - 为每张图片提供精确的评分
- **收藏功能** - 标记喜欢的图片
- **标签系统** - 自定义标签分类，支持多标签
- **SQLite 数据库存储** - 持久化存储，支持大数据量
- **Agent 集成** - Agent 可读取评分数据生成参考
- **独立管理面板** - 浏览器访问，可视化管理

## 文件结构

```
VCPToolBox/
├── Plugin/ImageRatingManager/
│   ├── image-rating-manager.js   # 核心数据库模块
│   └── agent-tools.js             # Agent 工具集成
├── routes/
│   └── image-rating-api.js        # REST API 路由
└── AdminPanel/
    └── image-management.html      # 图片管理面板
```

## API 接口

### 统计信息
```
GET /api/image-rating/stats
```

### 搜索图片
```
GET /api/image-rating/images?minScore=7&favoriteOnly=true&tags=tag1,tag2
```

### 注册图片
```
POST /api/image-rating/image/register
Body: { "imagePath": "image/xxx.png", "pluginSource": "ZImageGen" }
```

### 设置评分
```
PUT /api/image-rating/image/:id/rating
Body: { "score": 8, "comment": "很好的生成效果" }
```

### 设置收藏
```
PUT /api/image-rating/image/:id/favorite
Body: { "isFavorite": true }
```

### 添加标签
```
POST /api/image-rating/image/:id/tags
Body: { "tags": ["标签 1", "标签 2"] }
```

### 获取所有标签
```
GET /api/image-rating/tags
```

## Agent 使用示例

### 在 Agent 中调用评分工具

```javascript
const ratingTools = require('./Plugin/ImageRatingManager/agent-tools.js');

// 获取高分图片作为参考
const highRated = await ratingTools.agentGetHighRatedImages(7, 10);
console.log('高分图片:', highRated.images);

// 搜索特定标签的图片
const tagged = await ratingTools.agentGetImagesByTags(['风景', '日落']);

// 设置评分
await ratingTools.agentSetImageRating('image/test.png', 9, '非常棒的生成效果');

// 添加标签
await ratingTools.agentAddImageTags('image/test.png', ['高质量', '推荐']);

// 获取统计
const stats = await ratingTools.agentGetStats();
console.log('统计:', stats);
```

### Agent 工作流示例

```javascript
// 1. 生成新图前，先查看历史高分图片
const highRated = await ratingTools.agentGetHighRatedImages(8, 5);

// 2. 分析高分图片的特征
// - 标签分析
// - 评分分布
// - 用户评价关键词

// 3. 根据分析结果调整生成参数
// - 参考高分图片的风格标签
// - 避免低分图片的问题

// 4. 生成后自动为新图注册
await ratingTools.agentSetImageRating(newImagePath, autoScore, '自动生成');
```

## 管理面板使用

### 访问方式
```
http://localhost:3001/AdminPanel/image-management.html
```
（假设主服务端口为 3000，AdminPanel 端口为 3001）

### 功能说明
1. **图片列表** - 网格显示所有已注册的图片
2. **筛选过滤** - 按评分、标签、来源插件筛选
3. **批量操作** - 批量添加标签、删除等
4. **统计视图** - 查看评分分布、标签使用频率

## 数据库结构

### images 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| image_path | TEXT | 图片路径 |
| plugin_source | TEXT | 来源插件 |
| width | INTEGER | 宽度 |
| height | INTEGER | 高度 |
| generated_at | TEXT | 生成时间 |

### ratings 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| image_id | TEXT | 图片 ID |
| score | INTEGER | 评分 (1-10) |
| comment | TEXT | 评价 |
| is_favorite | INTEGER | 是否收藏 |

### tags 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 标签名 |

### image_tags 表
| 字段 | 类型 | 说明 |
|------|------|------|
| image_id | TEXT | 图片 ID |
| tag_id | INTEGER | 标签 ID |

## 与现有插件集成

### 自动注册（推荐）

已创建 `ImageAutoRegister` 通用监听插件，无需修改任何生图插件源码：
- 通过 `fs.watch` 实时监听 `image/` 目录变化
- 覆盖 10+ 个生图插件（ZImageGen、FluxGen、ComfyUI、DoubaoGen 等）
- 新图片生成后自动注册到评分数据库
- 启用方式：在管理面板启用 `ImageAutoRegister` 插件

### 手动集成（可选）

如果需要在生图插件中自定义注册逻辑，可参考：

```javascript
const ratingTools = require('../ImageRatingManager/agent-tools.js');

// 生成完成后
if (success) {
  await ratingTools.agentSetImageRating(imagePath, 0, '待评分');
}
```

## 注意事项

1. **数据库初始化** - 首次启动时会自动创建数据库
2. **路径格式** - 图片路径使用相对于 `PROJECT_BASE_PATH` 的路径
3. **性能优化** - 大量图片时建议使用筛选和分页
4. **备份** - 定期备份 `image_ratings.sqlite` 数据库文件

## 未来扩展

- [ ] 自动评分（AI 辅助评分）
- [ ] 批量导入/导出
- [ ] 图片对比功能
- [ ] 评分趋势分析
- [ ] 与 AdminPanel 深度集成

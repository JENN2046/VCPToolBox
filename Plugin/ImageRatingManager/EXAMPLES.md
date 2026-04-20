# 图片评分系统使用示例

## 场景 1: Agent 生成新图时参考历史高分图片

```javascript
// 在 Agent 生成请求前添加
const ratingTools = require('./Plugin/ImageRatingManager/agent-tools.js');

// 1. 获取历史高分图片（评分 >= 7）
const highRated = await ratingTools.agentGetHighRatedImages(7, 10);

if (highRated.success && highRated.images.length > 0) {
  // 2. 分析高分图片的特征
  const tags = highRated.images.flatMap(img => img.tags || []);
  const tagCounts = {};
  tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });

  // 3. 提取高频标签
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  // 4. 在生成提示词中参考
  const prompt = `参考以下标签风格：${topTags.join(', ')}\n${originalPrompt}`;
}
```

## 场景 2: 批量分析某类标签的图片质量

```javascript
// 分析"风景"标签的图片评分分布
const landscapeImages = await ratingTools.agentSearchImages({
  tags: ['风景'],
  limit: 100
});

if (landscapeImages.success) {
  const scores = landscapeImages.images.map(img => img.score);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  console.log(`风景类图片平均评分：${avgScore.toFixed(2)}/10`);

  // 低分图片需要改进
  const lowRated = landscapeImages.images.filter(img => img.score < 5);
  console.log(`低分图片数量：${lowRated.length}`);
}
```

## 场景 3: 自动生成报告

```javascript
// 获取统计信息
const stats = await ratingTools.agentGetStats();
const distribution = await ratingTools.agentAnalyzeScoreDistribution();

if (stats.success && distribution.success) {
  const report = `
## 图片质量报告

### 基础数据
- 总图片数：${stats.stats.total_images}
- 已评分：${stats.stats.rated_images}
- 收藏数：${stats.stats.favorites}
- 平均评分：${stats.stats.average_score?.toFixed(2) || 0}/10

### 评分分布
${distribution.message}

### 建议
- 高分图片 (${distribution.distribution.excellent} 张): 可作为训练样本
- 低分图片 (${distribution.distribution.poor} 张): 需要分析改进
`;

  console.log(report);
}
```

## 场景 4: 为图片管理面板添加快捷入口

在 `AdminPanel` 首页添加链接：

```html
<a href="/AdminPanel/image-management.html" class="card">
  <h3>图片管理</h3>
  <p>管理 AI 生图评分、标签和收藏</p>
</a>
```

## 场景 5: 在图片查看器中集成评分

在图片查看器 HTML 中添加引用：

```html
<!-- 在 image-viewer.html 中添加 -->
<script src="../Plugin/ImageRatingManager/agent-tools.js"></script>
```

## 场景 6: Agent 自动为生成的图片打分

```javascript
// 在图片生成插件中
async function onImageGenerated(imagePath, pluginName) {
  const ratingTools = require('../ImageRatingManager/agent-tools.js');

  // 1. 注册图片
  await ratingTools.agentSearchImages({ imagePath });

  // 2. 可选：使用 AI 自动评分
  // const autoScore = await aiScoreImage(imagePath);
  // await ratingTools.agentSetImageRating(imagePath, autoScore, 'AI 自动评分');

  // 3. 或者等待用户评分
  console.log(`图片已注册：${imagePath}，请在管理面板中评分`);
}
```

## 场景 7: 查询特定插件的生成质量

```javascript
// 分析 ZImageGen 的生成质量
const zimageStats = await ratingTools.agentSearchImages({
  pluginSource: 'ZImageGen',
  limit: 1000
});

if (zimageStats.success) {
  const scores = zimageStats.images.map(img => img.score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  console.log(`ZImageGen 平均评分：${avg.toFixed(2)}`);
}

// 分析 FluxGen 的生成质量
const fluxStats = await ratingTools.agentSearchImages({
  pluginSource: 'FluxGen',
  limit: 1000
});

if (fluxStats.success) {
  const scores = fluxStats.images.map(img => img.score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  console.log(`FluxGen 平均评分：${avg.toFixed(2)}`);
}
```

## 场景 8: 标签管理

```javascript
// 获取所有标签
const tagsResult = await ratingTools.agentGetAllTags();

if (tagsResult.success) {
  console.log('标签使用频率:');
  tagsResult.tags.forEach(tag => {
    console.log(`  ${tag.name}: ${tag.usage_count} 次`);
  });
}

// 为图片添加标签
await ratingTools.agentAddImageTags('image/zimagegen/xxx.png', ['高质量', '推荐']);

// 移除标签
const removeTagRes = await fetch('/api/image-rating/image/:id/tags', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tags: ['低质量'] })
});
```

## 场景 9: 收藏管理

```javascript
// 获取所有收藏的图片
const favorites = await ratingTools.agentGetFavorites();

if (favorites.success) {
  console.log('收藏的图片:');
  favorites.images.forEach(img => {
    console.log(`  - ${img.image_path} (评分：${img.score}/10)`);
  });
}

// 收藏/取消收藏
await fetch('/api/image-rating/image/:id/favorite', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ isFavorite: true })
});
```

## 场景 10: 高级搜索

```javascript
// 组合搜索：查找评分 7 分以上、带"风景"标签、非收藏的图片
const results = await ratingTools.agentSearchImages({
  minScore: 7,
  tags: ['风景'],
  favoriteOnly: false,
  limit: 50,
  orderBy: 'score',
  order: 'DESC'
});

if (results.success) {
  console.log(`找到 ${results.count} 张符合条件的图片`);
  results.images.forEach(img => {
    console.log(`${img.image_path} - 评分：${img.score}`);
  });
}
```

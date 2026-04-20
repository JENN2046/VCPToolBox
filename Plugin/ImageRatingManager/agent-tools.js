// Plugin/ImageRatingManager/agent-tools.js
// Agent 工具集成模块 - 供 Agent 调用的工具函数

const path = require('path');
let ratingManager = null;

// 延迟加载 rating manager
function getRatingManager() {
  if (!ratingManager) {
    ratingManager = require('./image-rating-manager.js');
    if (ratingManager.initDatabase && !ratingManager.db) {
      ratingManager.initDatabase();
    }
  }
  return ratingManager;
}

/**
 * Agent 工具：搜索图片
 * @param {object} options - 搜索选项
 * @returns {Promise<object>} 搜索结果
 */
async function agentSearchImages(options = {}) {
  try {
    const manager = getRatingManager();
    const result = manager.searchImages(options);

    if (result.success) {
      return {
        success: true,
        images: result.images.map(img => ({
          id: img.id,
          path: img.image_path,
          score: img.score || 0,
          comment: img.comment || '',
          is_favorite: !!img.is_favorite,
          tags: img.tags || [],
          plugin_source: img.plugin_source,
          generated_at: img.generated_at
        })),
        count: result.images.length,
        message: `找到 ${result.images.length} 张图片`
      };
    }
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Agent 工具：获取高分图片（用于参考学习）
 * @param {number} minScore - 最低评分 (默认 7)
 * @param {number} limit - 返回数量限制 (默认 10)
 * @returns {Promise<object>} 高分图片列表
 */
async function agentGetHighRatedImages(minScore = 7, limit = 10) {
  return await agentSearchImages({ minScore, limit, order: 'DESC', orderBy: 'score' });
}

/**
 * Agent 工具：获取低分图片（用于分析问题）
 * @param {number} maxScore - 最高评分 (默认 4)
 * @param {number} limit - 返回数量限制 (默认 10)
 * @returns {Promise<object>} 低分图片列表
 */
async function agentGetLowRatedImages(maxScore = 4, limit = 10) {
  return await agentSearchImages({ maxScore, limit, order: 'ASC', orderBy: 'score' });
}

/**
 * Agent 工具：获取特定标签的图片
 * @param {string[]} tags - 标签列表
 * @returns {Promise<object>} 匹配的图片
 */
async function agentGetImagesByTags(tags) {
  return await agentSearchImages({ tags, limit: 50 });
}

/**
 * Agent 工具：获取收藏的图片
 * @returns {Promise<object>} 收藏的图片列表
 */
async function agentGetFavorites() {
  return await agentSearchImages({ favoriteOnly: true, limit: 100 });
}

/**
 * Agent 工具：获取统计信息
 * @returns {Promise<object>} 统计数据
 */
async function agentGetStats() {
  try {
    const manager = getRatingManager();
    const result = manager.getStats();
    if (result.success) {
      return {
        success: true,
        ...result.stats,
        message: `共 ${result.stats.total_images} 张图片，平均评分 ${result.stats.average_score?.toFixed(1) || 0}`
      };
    }
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Agent 工具：为图片设置评分
 * @param {string} imagePath - 图片路径
 * @param {number} score - 评分 (1-10)
 * @param {string} comment - 评价
 * @returns {Promise<object>} 操作结果
 */
async function agentSetImageRating(imagePath, score, comment = '') {
  try {
    const manager = getRatingManager();

    // 先查找是否已注册
    let imageId = manager.getImageIdByPath(imagePath);

    if (!imageId) {
      // 自动注册图片
      const registerResult = manager.registerImage(imagePath, 'Agent');
      if (registerResult.success) {
        imageId = registerResult.id;
      } else {
        return registerResult;
      }
    }

    const result = manager.setRating(imageId, score, comment);
    if (result.success) {
      return {
        success: true,
        message: `已为图片 ${path.basename(imagePath)} 设置评分为 ${score}/10`
      };
    }
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Agent 工具：为图片添加标签
 * @param {string} imagePath - 图片路径
 * @param {string|string[]} tags - 标签
 * @returns {Promise<object>} 操作结果
 */
async function agentAddImageTags(imagePath, tags) {
  try {
    const manager = getRatingManager();
    let imageId = manager.getImageIdByPath(imagePath);

    if (!imageId) {
      const registerResult = manager.registerImage(imagePath, 'Agent');
      if (registerResult.success) {
        imageId = registerResult.id;
      } else {
        return registerResult;
      }
    }

    const result = manager.addTags(imageId, tags);
    if (result.success) {
      return {
        success: true,
        message: `已为图片添加标签：${Array.isArray(tags) ? tags.join(', ') : tags}`
      };
    }
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Agent 工具：获取所有标签
 * @returns {Promise<object>} 标签列表
 */
async function agentGetAllTags() {
  try {
    const manager = getRatingManager();
    return manager.getAllTags();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Agent 工具：分析评分趋势
 * 返回不同评分区间的图片数量和特征
 * @returns {Promise<object>} 分析结果
 */
async function agentAnalyzeScoreDistribution() {
  try {
    const manager = getRatingManager();
    const statsResult = manager.getStats();

    if (!statsResult.success) return statsResult;

    const distribution = statsResult.stats.score_distribution || [];
    const total = statsResult.stats.rated_images || 0;

    const analysis = {
      excellent: distribution.filter(s => s.score >= 9).reduce((sum, s) => sum + s.count, 0),
      good: distribution.filter(s => s.score >= 7 && s.score < 9).reduce((sum, s) => sum + s.count, 0),
      average: distribution.filter(s => s.score >= 5 && s.score < 7).reduce((sum, s) => sum + s.count, 0),
      poor: distribution.filter(s => s.score < 5).reduce((sum, s) => sum + s.count, 0)
    };

    return {
      success: true,
      distribution: analysis,
      total_rated: total,
      average_score: statsResult.stats.average_score,
      message: `优秀 (9-10): ${analysis.excellent}, 良好 (7-8): ${analysis.good}, 一般 (5-6): ${analysis.average}, 需改进 (<5): ${analysis.poor}`
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Agent 工具：获取相似标签的高分图片（用于推荐参考）
 * @param {string[]} referenceTags - 参考标签
 * @param {number} limit - 返回数量
 * @returns {Promise<object>} 推荐的高分图片
 */
async function agentGetSimilarHighRated(referenceTags, limit = 5) {
  if (!referenceTags || referenceTags.length === 0) {
    return { success: false, error: '需要提供参考标签' };
  }

  const result = await agentSearchImages({
    tags: referenceTags,
    minScore: 7,
    limit: limit * 2,
    orderBy: 'score',
    order: 'DESC'
  });

  if (result.success) {
    return {
      success: true,
      images: result.images.slice(0, limit),
      message: `找到 ${result.images.length} 张相似高分图片`
    };
  }
  return result;
}

// 导出所有工具函数
module.exports = {
  // 搜索工具
  agentSearchImages,
  agentGetHighRatedImages,
  agentGetLowRatedImages,
  agentGetImagesByTags,
  agentGetFavorites,

  // 操作工具
  agentSetImageRating,
  agentAddImageTags,

  // 分析工具
  agentGetStats,
  agentGetAllTags,
  agentAnalyzeScoreDistribution,
  agentGetSimilarHighRated
};

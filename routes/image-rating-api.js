// routes/image-rating-api.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// 延迟加载 image-rating-manager
let ratingManager = null;
function getRatingManager() {
  if (!ratingManager) {
    ratingManager = require('../Plugin/ImageRatingManager/image-rating-manager.js');
    // 初始化数据库
    if (ratingManager.initDatabase && typeof ratingManager.initDatabase === 'function') {
      ratingManager.initDatabase();
    }
  }
  return ratingManager;
}

// 初始化数据库（模块加载时即初始化）
try {
  ratingManager = require('../Plugin/ImageRatingManager/image-rating-manager.js');
  if (ratingManager.initDatabase && typeof ratingManager.initDatabase === 'function') {
    ratingManager.initDatabase();
  }
} catch (e) {
  console.error('[ImageRatingAPI] Failed to initialize rating manager:', e.message);
}

// === 工具函数 ===
function imageExists(imagePath) {
  try {
    // 处理相对路径
    if (!path.isAbsolute(imagePath)) {
      const projectBase = path.join(__dirname, '..');
      imagePath = path.join(projectBase, imagePath);
    }
    return fs.existsSync(imagePath);
  } catch (error) {
    return false;
  }
}

function normalizeImagePath(imagePath) {
  // 标准化路径格式
  if (!imagePath) return '';
  // 处理 /image/xxx 格式
  if (imagePath.startsWith('/image/')) {
    return imagePath.replace('/image/', 'image\\');
  }
  return imagePath;
}

// ==================== API 路由 ====================

/**
 * GET /api/image-rating/stats
 * 获取统计信息
 */
router.get('/stats', (req, res) => {
  try {
    const manager = getRatingManager();
    const result = manager.getStats();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/image-rating/images
 * 搜索/列出图片
 * 参数：minScore, maxScore, favoriteOnly, tags, pluginSource, limit, orderBy, order
 */
router.get('/images', (req, res) => {
  try {
    const manager = getRatingManager();
    const options = {};

    if (req.query.minScore) options.minScore = parseInt(req.query.minScore);
    if (req.query.maxScore) options.maxScore = parseInt(req.query.maxScore);
    if (req.query.favoriteOnly) options.favoriteOnly = req.query.favoriteOnly === 'true';
    if (req.query.pluginSource) options.pluginSource = req.query.pluginSource;
    if (req.query.orderBy) options.orderBy = req.query.orderBy;
    if (req.query.order) options.order = req.query.order;
    if (req.query.limit) options.limit = parseInt(req.query.limit);

    if (req.query.tags) {
      options.tags = req.query.tags.split(',').map(t => t.trim());
    }

    const result = manager.searchImages(options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/image-rating/image/:id
 * 获取单个图片信息
 */
router.get('/image/:id', (req, res) => {
  try {
    const manager = getRatingManager();
    const result = manager.getImageInfo(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/image-rating/image/register
 * 注册/更新图片
 * Body: { imagePath, pluginSource, metadata }
 */
router.post('/image/register', (req, res) => {
  try {
    const { imagePath, pluginSource, metadata = {} } = req.body;

    if (!imagePath || !pluginSource) {
      return res.status(400).json({ success: false, error: 'Missing imagePath or pluginSource' });
    }

    const manager = getRatingManager();
    const result = manager.registerImage(imagePath, pluginSource, metadata);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/image-rating/image/:id/rating
 * 设置评分
 * Body: { score, comment }
 */
router.put('/image/:id/rating', (req, res) => {
  try {
    const { score, comment } = req.body;
    const manager = getRatingManager();

    if (score === undefined || (score < 1 || score > 10)) {
      return res.status(400).json({ success: false, error: 'Score must be between 1 and 10' });
    }

    const result = manager.setRating(req.params.id, score, comment || '');
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/image-rating/image/:id/favorite
 * 设置收藏状态
 * Body: { isFavorite }
 */
router.put('/image/:id/favorite', (req, res) => {
  try {
    const { isFavorite } = req.body;
    const manager = getRatingManager();
    const result = manager.setFavorite(req.params.id, isFavorite);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/image-rating/image/:id/tags
 * 添加标签
 * Body: { tags } - string or string[]
 */
router.post('/image/:id/tags', (req, res) => {
  try {
    const { tags } = req.body;
    if (!tags || (Array.isArray(tags) && tags.length === 0)) {
      return res.status(400).json({ success: false, error: 'Tags required' });
    }

    const manager = getRatingManager();
    const result = manager.addTags(req.params.id, tags);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/image-rating/image/:id/tags
 * 删除标签
 * Body: { tags } - string or string[]
 */
router.delete('/image/:id/tags', (req, res) => {
  try {
    const { tags } = req.body;
    if (!tags || (Array.isArray(tags) && tags.length === 0)) {
      return res.status(400).json({ success: false, error: 'Tags required' });
    }

    const manager = getRatingManager();
    const result = manager.removeTags(req.params.id, tags);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/image-rating/tags
 * 获取所有标签
 */
router.get('/tags', (req, res) => {
  try {
    const manager = getRatingManager();
    const result = manager.getAllTags();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/image-rating/tags/:name
 * 删除标签
 */
router.delete('/tags/:name', (req, res) => {
  try {
    const manager = getRatingManager();
    const result = manager.deleteTag(req.params.name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/image-rating/tags/suggest?q=xxx
 * 标签搜索/建议
 */
router.get('/tags/suggest', (req, res) => {
  try {
    const manager = getRatingManager();
    const query = req.query.q || '';
    const result = manager.getAllTags();

    if (result.success) {
      let tags = result.tags;
      if (query) {
        tags = tags.filter(t => t.name.toLowerCase().includes(query.toLowerCase()));
      }
      res.json({ success: true, tags });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/image-rating/widget
 * 获取 Desktop Widget HTML 内容
 */
router.get('/widget', (req, res) => {
  try {
    const widgetPath = path.join(__dirname, '../Plugin/ImageAutoRegister/widget.html');
    res.sendFile(widgetPath);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/image-rating/auto-register/status
 * 获取自动注册监听器状态
 */
router.get('/auto-register/status', (req, res) => {
  try {
    const autoRegisterPath = path.join(__dirname, '../Plugin/ImageAutoRegister/image-auto-register.js');
    const autoRegister = require(autoRegisterPath);
    const status = autoRegister.getStatus();
    res.json(status);
  } catch (error) {
    res.json({ success: false, error: error.message, watching: false });
  }
});

/**
 * POST /api/image-rating/auto-register/scan
 * 手动触发图片扫描
 */
router.post('/auto-register/scan', (req, res) => {
  try {
    const autoRegisterPath = path.join(__dirname, '../Plugin/ImageAutoRegister/image-auto-register.js');
    const autoRegister = require(autoRegisterPath);
    const result = autoRegister.scan();
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

module.exports = router;

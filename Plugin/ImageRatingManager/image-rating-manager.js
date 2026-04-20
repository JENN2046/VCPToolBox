// Plugin/ImageRatingManager/image-rating-manager.js
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

let db = null;
let pluginConfig = {};

// === 数据库初始化 ===
function initDatabase() {
  try {
    const dbPath = path.join(__dirname, 'image_ratings.sqlite');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

    // 创建图片主表
    db.exec(`
      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        image_path TEXT NOT NULL UNIQUE,
        plugin_source TEXT,
        width INTEGER,
        height INTEGER,
        generated_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_images_path ON images(image_path);
      CREATE INDEX IF NOT EXISTS idx_images_plugin ON images(plugin_source);
    `);

    // 创建评分表
    db.exec(`
      CREATE TABLE IF NOT EXISTS ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id TEXT NOT NULL UNIQUE,
        score INTEGER CHECK(score >= 1 AND score <= 10),
        comment TEXT,
        is_favorite INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_ratings_score ON ratings(score);
      CREATE INDEX IF NOT EXISTS idx_ratings_favorite ON ratings(is_favorite);
    `);

    // 创建标签表
    db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
    `);

    // 创建图片 - 标签关联表
    db.exec(`
      CREATE TABLE IF NOT EXISTS image_tags (
        image_id TEXT NOT NULL,
        tag_id INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (image_id, tag_id),
        FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_image_tags_image ON image_tags(image_id);
      CREATE INDEX IF NOT EXISTS idx_image_tags_tag ON image_tags(tag_id);
    `);

    // 创建视图：带评分和标签的图片列表
    db.exec(`
      CREATE VIEW IF NOT EXISTS images_with_ratings AS
      SELECT
        i.id,
        i.image_path,
        i.plugin_source,
        i.width,
        i.height,
        i.generated_at,
        i.created_at,
        COALESCE(r.score, 0) as score,
        r.comment,
        COALESCE(r.is_favorite, 0) as is_favorite,
        (SELECT GROUP_CONCAT(t.name, ', ')
         FROM image_tags it
         JOIN tags t ON it.tag_id = t.id
         WHERE it.image_id = i.id) as tags
      FROM images i
      LEFT JOIN ratings r ON i.id = r.image_id
    `);

    console.log(`[ImageRatingManager] SQLite database initialized at ${dbPath}`);
    return true;
  } catch (error) {
    console.error('[ImageRatingManager] Failed to initialize database:', error);
    return false;
  }
}

// === 工具函数 ===
function calculateHash(data) {
  return crypto.createHash('md5').update(data).digest('hex');
}

function generateImageId(imagePath, pluginSource) {
  // 使用路径和插件名生成唯一 ID
  return calculateHash(`${imagePath}|${pluginSource}|${Date.now()}`);
}

// === 核心功能函数 ===

/**
 * 注册或更新一张图片
 * @param {string} imagePath - 图片路径
 * @param {string} pluginSource - 来源插件名
 * @param {object} metadata - 可选的元数据 {width, height, generated_at}
 */
function registerImage(imagePath, pluginSource, metadata = {}) {
  try {
    const id = generateImageId(imagePath, pluginSource);
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO images (id, image_path, plugin_source, width, height, generated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      imagePath,
      pluginSource,
      metadata.width || null,
      metadata.height || null,
      metadata.generated_at || new Date().toISOString()
    );
    console.log(`[ImageRatingManager] Registered image: ${imagePath} from ${pluginSource}`);
    return { success: true, id, image_path: imagePath };
  } catch (error) {
    console.error('[ImageRatingManager] Failed to register image:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 为图片设置评分（1-10 分）
 * @param {string} imageId - 图片 ID
 * @param {number} score - 评分 (1-10)
 * @param {string} comment - 可选的评价文字
 */
function setRating(imageId, score, comment = '') {
  try {
    if (score < 1 || score > 10) {
      return { success: false, error: 'Score must be between 1 and 10' };
    }

    const stmt = db.prepare(`
      INSERT INTO ratings (image_id, score, comment, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(image_id) DO UPDATE SET
        score = excluded.score,
        comment = excluded.comment,
        updated_at = datetime('now')
    `);
    stmt.run(imageId, score, comment);
    console.log(`[ImageRatingManager] Set rating for ${imageId}: score=${score}`);
    return { success: true, image_id: imageId, score, comment };
  } catch (error) {
    console.error('[ImageRatingManager] Failed to set rating:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 设置收藏状态
 * @param {string} imageId - 图片 ID
 * @param {boolean} isFavorite - 是否收藏
 */
function setFavorite(imageId, isFavorite) {
  try {
    const stmt = db.prepare(`
      INSERT INTO ratings (image_id, is_favorite, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(image_id) DO UPDATE SET
        is_favorite = excluded.is_favorite,
        updated_at = datetime('now')
    `);
    stmt.run(imageId, isFavorite ? 1 : 0);
    console.log(`[ImageRatingManager] Set favorite for ${imageId}: ${isFavorite}`);
    return { success: true, image_id: imageId, is_favorite: isFavorite };
  } catch (error) {
    console.error('[ImageRatingManager] Failed to set favorite:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 为图片添加标签
 * @param {string} imageId - 图片 ID
 * @param {string|string[]} tags - 标签名或标签数组
 */
function addTags(imageId, tags) {
  try {
    const tagList = Array.isArray(tags) ? tags : [tags];
    const results = [];

    for (const tagName of tagList) {
      const trimmedTag = tagName.trim();
      if (!trimmedTag) continue;

      // 插入标签（如果不存在）
      const tagStmt = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
      tagStmt.run(trimmedTag);

      // 获取标签 ID
      const tagRow = db.prepare('SELECT id FROM tags WHERE name = ?').get(trimmedTag);
      if (tagRow) {
        // 关联图片和标签（如果不存在）
        const linkStmt = db.prepare('INSERT OR IGNORE INTO image_tags (image_id, tag_id) VALUES (?, ?)');
        linkStmt.run(imageId, tagRow.id);
        results.push({ tag: trimmedTag, added: true });
      }
    }

    console.log(`[ImageRatingManager] Added tags to ${imageId}: ${tagList.join(', ')}`);
    return { success: true, image_id: imageId, tags: tagList };
  } catch (error) {
    console.error('[ImageRatingManager] Failed to add tags:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 移除图片的标签
 * @param {string} imageId - 图片 ID
 * @param {string|string[]} tags - 标签名或标签数组
 */
function removeTags(imageId, tags) {
  try {
    const tagList = Array.isArray(tags) ? tags : [tags];

    db.transaction(() => {
      for (const tagName of tagList) {
        db.prepare(`
          DELETE FROM image_tags
          WHERE image_id = ? AND tag_id = (SELECT id FROM tags WHERE name = ?)
        `).run(imageId, tagName.trim());
      }
    });

    console.log(`[ImageRatingManager] Removed tags from ${imageId}: ${tagList.join(', ')}`);
    return { success: true, image_id: imageId, tags: tagList };
  } catch (error) {
    console.error('[ImageRatingManager] Failed to remove tags:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 获取图片的完整信息（包含评分、标签）
 * @param {string} imageId - 图片 ID
 */
function getImageInfo(imageId) {
  try {
    const image = db.prepare('SELECT * FROM images WHERE id = ?').get(imageId);
    if (!image) {
      return { success: false, error: 'Image not found' };
    }

    const rating = db.prepare('SELECT * FROM ratings WHERE image_id = ?').get(imageId);
    const tags = db.prepare(`
      SELECT t.name FROM tags t
      JOIN image_tags it ON t.id = it.tag_id
      WHERE it.image_id = ?
    `).all(imageId);

    return {
      success: true,
      image,
      rating: rating || null,
      tags: tags.map(t => t.name)
    };
  } catch (error) {
    console.error('[ImageRatingManager] Failed to get image info:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 根据路径获取图片 ID
 * @param {string} imagePath - 图片路径
 */
function getImageIdByPath(imagePath) {
  try {
    const row = db.prepare('SELECT id FROM images WHERE image_path = ?').get(imagePath);
    return row ? row.id : null;
  } catch (error) {
    return null;
  }
}

/**
 * 搜索图片（支持多种条件）
 * @param {object} options - 搜索条件
 * @param {number} options.minScore - 最低评分
 * @param {number} options.maxScore - 最高评分
 * @param {boolean} options.favoriteOnly - 只看收藏
 * @param {string[]} options.tags - 包含指定标签
 * @param {string} options.pluginSource - 来源插件
 * @param {number} options.limit - 返回数量限制
 * @param {string} options.orderBy - 排序字段 (score, created_at, generated_at)
 * @param {string} options.order - 排序方向 (ASC, DESC)
 */
function searchImages(options = {}) {
  try {
    let conditions = [];
    let params = [];

    if (options.minScore !== undefined) {
      conditions.push('r.score >= ?');
      params.push(options.minScore);
    }
    if (options.maxScore !== undefined) {
      conditions.push('r.score <= ?');
      params.push(options.maxScore);
    }
    if (options.favoriteOnly) {
      conditions.push('r.is_favorite = 1');
    }
    if (options.pluginSource) {
      conditions.push('i.plugin_source = ?');
      params.push(options.pluginSource);
    }
    if (options.tags && options.tags.length > 0) {
      const tagConditions = options.tags.map(t => `?`);
      conditions.push(`i.id IN (
        SELECT it.image_id FROM image_tags it
        JOIN tags t ON it.tag_id = t.id
        WHERE t.name IN (${tagConditions.join(',')})
        GROUP BY it.image_id
        HAVING COUNT(DISTINCT t.name) >= ?
      )`);
      options.tags.forEach(t => params.push(t));
      params.push(options.tags.length); // 确保匹配所有标签
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = options.orderBy || 'i.created_at';
    const order = (options.order || 'DESC').toUpperCase();
    const limit = options.limit || 100;

    const query = `
      SELECT
        i.id,
        i.image_path,
        i.plugin_source,
        i.width,
        i.height,
        i.generated_at,
        i.created_at,
        COALESCE(r.score, 0) as score,
        r.comment,
        COALESCE(r.is_favorite, 0) as is_favorite,
        (SELECT GROUP_CONCAT(t.name, ', ')
         FROM image_tags it
         JOIN tags t ON it.tag_id = t.id
         WHERE it.image_id = i.id) as tags
      FROM images i
      LEFT JOIN ratings r ON i.id = r.image_id
      ${whereClause}
      ORDER BY ${orderBy} ${order}
      LIMIT ?
    `;

    params.push(limit);
    const images = db.prepare(query).all(...params);

    // 解析 tags 字符串为数组
    images.forEach(img => {
      if (img.tags) {
        img.tags = img.tags.split(', ').map(t => t.trim());
      } else {
        img.tags = [];
      }
    });

    return { success: true, images, count: images.length };
  } catch (error) {
    console.error('[ImageRatingManager] Failed to search images:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 获取所有标签列表
 */
function getAllTags() {
  try {
    const tags = db.prepare('SELECT name, COUNT(it.image_id) as usage_count FROM tags t LEFT JOIN image_tags it ON t.id = it.tag_id GROUP BY t.id ORDER BY usage_count DESC').all();
    return { success: true, tags };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 删除标签
 */
function deleteTag(tagName) {
  try {
    db.prepare('DELETE FROM tags WHERE name = ?').run(tagName);
    console.log(`[ImageRatingManager] Deleted tag: ${tagName}`);
    return { success: true, tag: tagName };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 获取统计信息
 */
function getStats() {
  try {
    const stats = {
      total_images: db.prepare('SELECT COUNT(*) as count FROM images').get().count,
      rated_images: db.prepare('SELECT COUNT(*) as count FROM ratings WHERE score > 0').get().count,
      favorites: db.prepare('SELECT COUNT(*) as count FROM ratings WHERE is_favorite = 1').get().count,
      total_tags: db.prepare('SELECT COUNT(*) as count FROM tags').get().count,
      average_score: db.prepare('SELECT AVG(score) as avg FROM ratings WHERE score > 0').get().avg || 0,
      score_distribution: db.prepare('SELECT score, COUNT(*) as count FROM ratings WHERE score > 0 GROUP BY score ORDER BY score').all()
    };
    return { success: true, stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// === 插件导出 ===
module.exports = {
  initDatabase,
  registerImage,
  setRating,
  setFavorite,
  addTags,
  removeTags,
  getImageInfo,
  getImageIdByPath,
  searchImages,
  getAllTags,
  deleteTag,
  getStats,
  db: () => db
};

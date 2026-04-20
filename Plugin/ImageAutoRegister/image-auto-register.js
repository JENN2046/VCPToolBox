const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// === 配置 ===
const IMAGE_BASE_DIR = path.join(__dirname, '../../image');
const RATING_MANAGER_PATH = path.join(__dirname, '../ImageRatingManager/image-rating-manager.js');

// 已知生图插件的目录映射
const PLUGIN_PATH_MAP = {
    'zimagegen': 'ZImageGen',
    'zimagegen2': 'ZImageGen2',
    'zimageturbogen': 'ZImageTurboGen',
    'fluxgen': 'FluxGen',
    'geminiimagegen': 'GeminiImageGen',
    'nanobananagen': 'NanoBananaGen',
    'qwenimagegen': 'QwenImageGen',
    'doubaogen': 'DoubaoGen',
    'comfyuigen': 'ComfyUIGen',
    'comfycloud': 'ComfyCloudGen'
};

// 状态
let ratingManager = null;
let knownFiles = new Set();
let watchers = [];

console.log('[ImageAutoRegister] 插件加载');

/**
 * 初始化数据库
 */
function initDatabase() {
    try {
        ratingManager = require(RATING_MANAGER_PATH);
        ratingManager.initDatabase();
        console.log('[ImageAutoRegister] 评分数据库已连接');
    } catch (err) {
        console.error('[ImageAutoRegister] 无法加载评分管理器:', err.message);
        ratingManager = null;
    }
}

/**
 * 扫描目录下所有已有图片
 */
function scanExistingFiles() {
    if (!fs.existsSync(IMAGE_BASE_DIR)) {
        console.log('[ImageAutoRegister] 图片目录不存在:', IMAGE_BASE_DIR);
        return;
    }

    const subdirs = fs.readdirSync(IMAGE_BASE_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

    for (const subdir of subdirs) {
        const dirPath = path.join(IMAGE_BASE_DIR, subdir);
        try {
            const files = fs.readdirSync(dirPath);
            for (const file of files) {
                if (isImageFile(file)) {
                    knownFiles.add(`${subdir}/${file}`);
                }
            }
        } catch (err) {
            // 忽略无法读取的目录
        }
    }

    console.log(`[ImageAutoRegister] 已扫描 ${knownFiles.size} 张现有图片`);
}

/**
 * 判断是否为图片文件
 */
function isImageFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].includes(ext);
}

/**
 * 注册单张图片
 */
function registerImageFile(subdir, filename) {
    if (!ratingManager) {
        console.log('[ImageAutoRegister] 评分管理器未初始化，跳过');
        return;
    }

    const serverPath = `image/${subdir}/${filename}`;

    // 避免重复注册
    if (knownFiles.has(`${subdir}/${filename}`)) {
        return;
    }

    // 解析来源插件
    const pluginSource = PLUGIN_PATH_MAP[subdir.toLowerCase()] || 'Unknown';

    try {
        // 获取文件信息
        const filePath = path.join(IMAGE_BASE_DIR, subdir, filename);
        const stats = fs.statSync(filePath);

        const registerResult = ratingManager.registerImage(
            serverPath,
            pluginSource,
            {
                generated_at: stats.birthtime.toISOString()
            }
        );

        if (registerResult.success) {
            ratingManager.setRating(registerResult.id, 0, '待评分');
            knownFiles.add(`${subdir}/${filename}`);
            console.log(`[ImageAutoRegister] 已注册: ${serverPath} (来源: ${pluginSource})`);
        } else {
            console.log(`[ImageAutoRegister] 注册失败: ${serverPath} - ${registerResult.error}`);
        }
    } catch (err) {
        console.error(`[ImageAutoRegister] 注册异常 ${serverPath}: ${err.message}`);
    }
}

/**
 * 设置目录监听
 */
function setupWatchers() {
    if (!fs.existsSync(IMAGE_BASE_DIR)) {
        console.log('[ImageAutoRegister] 图片目录不存在，稍后重试');
        setTimeout(setupWatchers, 5000);
        return;
    }

    const subdirs = fs.readdirSync(IMAGE_BASE_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

    for (const subdir of subdirs) {
        const dirPath = path.join(IMAGE_BASE_DIR, subdir);
        try {
            const watcher = fs.watch(dirPath, (eventType, filename) => {
                if (eventType === 'rename' && filename && isImageFile(filename)) {
                    // 文件创建或重命名完成
                    setTimeout(() => {
                        registerImageFile(subdir, filename);
                    }, 500); // 延迟等待文件写入完成
                }
            });
            watchers.push(watcher);
            console.log(`[ImageAutoRegister] 已监听目录: ${subdir}`);
        } catch (err) {
            console.error(`[ImageAutoRegister] 无法监听目录 ${subdir}: ${err.message}`);
        }
    }
}

/**
 * 清理资源
 */
function shutdown() {
    console.log('[ImageAutoRegister] 关闭所有监听器');
    for (const watcher of watchers) {
        try { watcher.close(); } catch (e) {}
    }
    watchers = [];
}

/**
 * 对外接口
 */
module.exports = {
    initialize() {
        console.log('[ImageAutoRegister] 初始化...');
        initDatabase();
        scanExistingFiles();
        setupWatchers();
    },
    shutdown,
    // 工具方法：手动触发扫描
    scan() {
        knownFiles = new Set();
        scanExistingFiles();
        return { success: true, knownCount: knownFiles.size };
    },
    // 工具方法：获取已注册图片数量
    getStatus() {
        return {
            success: true,
            knownFiles: knownFiles.size,
            watchingDirs: watchers.length,
            ratingManagerLoaded: !!ratingManager
        };
    }
};

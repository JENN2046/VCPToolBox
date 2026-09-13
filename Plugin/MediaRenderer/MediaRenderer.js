const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const puppeteer = require('puppeteer');
const sharp = require('sharp');
const browserRuntimeManager = require('../../modules/browserRuntimeManager.js');
const {
    CORE_CURSOR_ROLES,
    OPTIONAL_CURSOR_ROLES,
    DEFAULT_CURSOR_SIZES,
    sanitizeThemeName,
    sanitizePackageStem,
    parseHotspot,
    scaleHotspot,
    validateCursorRoles,
    encodeCur,
    encodeAni,
    buildThemeZip
} = require('./CursorThemePackager.js');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_SUBDIR = 'media-renderer';
const MIN_DIMENSION = 64;
const MAX_DIMENSION = 4096;
const MAX_PIXELS = MAX_DIMENSION * MAX_DIMENSION;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_BATCH_SIZE = 16;
const DEFAULT_TIMEOUT_MS = 45000;
const MAX_TIMEOUT_MS = 120000;
const IMAGE_FORMATS = new Set(['png', 'jpg', 'jpeg', 'webp']);
const ANIMATION_FORMATS = new Set(['gif', 'mp4', 'webm']);
const SUPPORTED_FORMATS = new Set([...IMAGE_FORMATS, ...ANIMATION_FORMATS]);
const MAX_ASSET_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_ASSET_BYTES = 100 * 1024 * 1024;
const MAX_ASSET_COUNT = 24;
const MAX_FFMPEG_ERROR_BYTES = 64 * 1024;
const DEFAULT_DURATION_MS = 5000;
const DEFAULT_FPS = 30;
const DEFAULT_MAX_FRAMES = 600;
const DEFAULT_AUDIO_DURATION_MS = 10000;
const DEFAULT_AUDIO_SAMPLE_RATE = 44100;
const DEFAULT_AUDIO_TIMEOUT_MS = 30000;
const MAX_AUDIO_CODE_BYTES = 1024 * 1024;
const MAX_AUDIO_TOTAL_SAMPLES = 30 * 1000 * 1000;
const MAX_AUDIO_OUTPUT_BYTES = 128 * 1024 * 1024;
const MAX_AUDIO_PROCESS_OUTPUT_BYTES = 256 * 1024;
const AUDIO_WORKER_PATH = path.join(__dirname, 'AudioSynthesisWorker.js');
const MAX_CURSOR_THEME_FRAMES = 240;
const MAX_CURSOR_ROLE_FRAMES = 120;
const DEFAULT_CURSOR_FPS = 24;
const CURSOR_PREVIEW_CELL_WIDTH = 168;
const CURSOR_PREVIEW_CELL_HEIGHT = 132;
const TRUSTED_LIBRARY_CDN_HOSTS = new Set([
    'cdn.jsdelivr.net',
    'unpkg.com',
    'cdnjs.cloudflare.com'
]);
const BUILTIN_LIBRARIES = Object.freeze({
    anime: {
        path: path.join(PROJECT_ROOT, 'AdminPanel-Vue', 'vendor', 'anime.min.js'),
        global: 'anime'
    },
    animejs: {
        path: path.join(PROJECT_ROOT, 'AdminPanel-Vue', 'vendor', 'anime.min.js'),
        global: 'anime'
    },
    three: {
        path: path.join(PROJECT_ROOT, 'AdminPanel-Vue', 'vendor', 'three.min.js'),
        global: 'THREE'
    },
    threejs: {
        path: path.join(PROJECT_ROOT, 'AdminPanel-Vue', 'vendor', 'three.min.js'),
        global: 'THREE'
    }
});
const ASSET_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const MEDIA_RENDERER_BOOTSTRAP = `
<script>
(() => {
    const state = {
        ready: false,
        readyPromise: null,
        readyResolve: null,
        frameRenderer: null
    };
    state.readyPromise = new Promise(resolve => { state.readyResolve = resolve; });
    window.__MEDIA_RENDERER__ = {
        get ready() { return state.ready; },
        setReady() {
            if (!state.ready) {
                state.ready = true;
                state.readyResolve();
            }
        },
        waitUntilReady() { return state.readyPromise; },
        setFrameRenderer(renderer) {
            if (typeof renderer !== 'function') throw new Error('frameRenderer 必须是函数。');
            state.frameRenderer = renderer;
        },
        async renderFrame(timeMs, frameIndex, fps) {
            if (state.frameRenderer) {
                await state.frameRenderer(timeMs, frameIndex, fps);
            } else if (typeof window.__MEDIA_RENDERER_RENDER_FRAME__ === 'function') {
                await window.__MEDIA_RENDERER_RENDER_FRAME__(timeMs, frameIndex, fps);
            } else {
                for (const animation of document.getAnimations()) {
                    animation.pause();
                    animation.currentTime = timeMs;
                }
            }
            await new Promise(resolve => requestAnimationFrame(() =>
                requestAnimationFrame(resolve)
            ));
        }
    };
})();
</script>`;
const CURSOR_THEME_BOOTSTRAP = `
<script>
(() => {
    const state = {
        ready: false,
        readyPromise: null,
        readyResolve: null,
        renderer: null
    };
    state.readyPromise = new Promise(resolve => { state.readyResolve = resolve; });
    window.__CURSOR_THEME__ = {
        get ready() { return state.ready; },
        setReady() {
            if (!state.ready) {
                state.ready = true;
                state.readyResolve();
            }
        },
        waitUntilReady() { return state.readyPromise; },
        setRenderer(renderer) {
            if (typeof renderer !== 'function') {
                throw new Error('Cursor theme renderer 必须是函数。');
            }
            state.renderer = renderer;
        },
        async render(role, timeMs, root) {
            if (state.renderer) {
                await state.renderer(role, timeMs, root);
            } else {
                for (const animation of root.getAnimations({ subtree: true })) {
                    animation.pause();
                    animation.currentTime = timeMs;
                }
            }
            await new Promise(resolve => requestAnimationFrame(() =>
                requestAnimationFrame(resolve)
            ));
        }
    };
})();
</script>`;

let pluginConfig = {};
let debugMode = false;
let renderQueue = Promise.resolve();
let acceptingRenders = false;
const pendingRenders = new Set();

function initialize(config = {}) {
    pluginConfig = config;
    debugMode = parseBoolean(config.DebugMode ?? process.env.DebugMode, false);
    acceptingRenders = true;
    if (pendingRenders.size === 0) renderQueue = Promise.resolve();
}

function parseBoolean(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') return defaultValue;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
    return defaultValue;
}

function parseInteger(value, fallback, min, max, fieldName) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
        if (fallback !== undefined) return fallback;
        throw new Error(`${fieldName} 必须是整数。`);
    }
    if (parsed < min || parsed > max) {
        throw new Error(`${fieldName} 必须在 ${min}-${max} 之间，当前值为 ${parsed}。`);
    }
    return parsed;
}

function normalizeFormat(value, transparent) {
    let format = String(value || (transparent ? 'png' : 'jpg')).trim().toLowerCase();
    if (format === 'jpeg') format = 'jpg';
    if (!SUPPORTED_FORMATS.has(format)) {
        throw new Error(`不支持输出格式 ${format}，可选 png、jpg、webp。`);
    }
    if (transparent && format === 'jpg') {
        format = 'png';
    }
    return format;
}

function normalizeColor(value, fallback) {
    const color = String(value || fallback).trim();
    if (!color || color.length > 100) {
        throw new Error('background 必须是有效且不超过 100 字符的 CSS 颜色。');
    }
    return color;
}

function sanitizeFileStem(value) {
    const stem = String(value || '')
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
        .replace(/\s+/g, '-')
        .replace(/^\.+|\.+$/g, '')
        .slice(0, 80);
    return stem || crypto.randomUUID();
}

function normalizeSourceImage(value) {
    const sourceImage = String(value || '').trim();
    if (!sourceImage) return null;
    if (
        sourceImage.startsWith('data:image/') ||
        sourceImage.startsWith('http://') ||
        sourceImage.startsWith('https://') ||
        sourceImage.startsWith('file://')
    ) {
        return sourceImage;
    }
    throw new Error('sourceImage 仅支持 data:image、http://、https:// 或 file://。');
}

function normalizeRequest(raw = {}) {
    const html = typeof raw.html === 'string' ? raw.html : '';
    const svg = typeof raw.svg === 'string' ? raw.svg : '';
    if ((!html && !svg) || (html && svg)) {
        throw new Error('每一步必须且只能提供 html 或 svg 参数之一。');
    }

    const source = html || svg;
    if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
        throw new Error(`源码超过 ${MAX_SOURCE_BYTES / 1024 / 1024}MB 限制。`);
    }

    const width = parseInteger(raw.width, undefined, MIN_DIMENSION, MAX_DIMENSION, 'width');
    const height = parseInteger(raw.height, undefined, MIN_DIMENSION, MAX_DIMENSION, 'height');
    if (width * height > MAX_PIXELS) {
        throw new Error(`总像素数不能超过 ${MAX_PIXELS}。`);
    }

    const transparent = parseBoolean(raw.transparent ?? raw.transparentBackground, false);
    const format = normalizeFormat(raw.format || raw.imageFormat, transparent);
    const quality = parseInteger(raw.quality, 90, 1, 100, 'quality');
    const timeoutMs = parseInteger(raw.timeoutMs, DEFAULT_TIMEOUT_MS, 1000, MAX_TIMEOUT_MS, 'timeoutMs');
    const background = normalizeColor(raw.background || raw.backgroundColor, '#ffffff');
    const showBase64 = parseBoolean(raw.showBase64 ?? raw.showbase64, false);
    const allowJavaScript = parseBoolean(raw.allowJavaScript, false);
    const waitMs = parseInteger(raw.waitMs, 0, 0, 10000, 'waitMs');

    return {
        sourceType: html ? 'html' : 'svg',
        source,
        width,
        height,
        transparent,
        format,
        requestedFormat: String(raw.format || raw.imageFormat || '').toLowerCase() || null,
        quality,
        timeoutMs,
        background,
        showBase64,
        allowJavaScript,
        waitMs,
        sourceImage: normalizeSourceImage(
            raw.sourceImage || raw.source_image || raw.image || raw.image_url
        ),
        fileStem: sanitizeFileStem(raw.fileName || raw.filename || raw.name)
    };
}

function escapeHtmlAttribute(value) {
    return String(value)
        .replace(/&/g, '&')
        .replace(/"/g, '"')
        .replace(/</g, '<')
        .replace(/>/g, '>');
}

async function resolveSourceImage(request) {
    if (!request.sourceImage) {
        return { resolvedSourceImage: null, allowedRemoteUrl: null };
    }

    if (request.sourceImage.startsWith('data:image/')) {
        if (Buffer.byteLength(request.sourceImage, 'utf8') > MAX_SOURCE_IMAGE_BYTES * 1.5) {
            throw new Error(`sourceImage Data URI 超过约 ${MAX_SOURCE_IMAGE_BYTES / 1024 / 1024}MB 限制。`);
        }
        return {
            resolvedSourceImage: request.sourceImage,
            allowedRemoteUrl: null
        };
    }

    if (request.sourceImage.startsWith('http://') || request.sourceImage.startsWith('https://')) {
        return {
            resolvedSourceImage: request.sourceImage,
            allowedRemoteUrl: request.sourceImage
        };
    }

    const fileUrl = new URL(request.sourceImage);
    let localPath = decodeURIComponent(fileUrl.pathname);
    if (process.platform === 'win32' && /^\/[A-Za-z]:/.test(localPath)) {
        localPath = localPath.slice(1);
    }

    const stat = await fs.stat(localPath);
    if (!stat.isFile()) {
        throw new Error('sourceImage 的 file:// 地址不是普通文件。');
    }
    if (stat.size > MAX_SOURCE_IMAGE_BYTES) {
        throw new Error(`sourceImage 文件超过 ${MAX_SOURCE_IMAGE_BYTES / 1024 / 1024}MB 限制。`);
    }

    const imageBuffer = await fs.readFile(localPath);
    const metadata = await sharp(imageBuffer, { limitInputPixels: MAX_PIXELS }).metadata();
    const mimeMap = {
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        tiff: 'image/tiff',
        avif: 'image/avif'
    };
    const mimeType = mimeMap[metadata.format];
    if (!mimeType) {
        throw new Error(`sourceImage 文件不是受支持的图片格式: ${metadata.format || 'unknown'}`);
    }

    return {
        resolvedSourceImage: `data:${mimeType};base64,${imageBuffer.toString('base64')}`,
        allowedRemoteUrl: null
    };
}

function applySourceImagePlaceholder(source, resolvedSourceImage) {
    if (!resolvedSourceImage) return source;
    if (!source.includes('{{SOURCE_IMAGE}}')) {
        throw new Error('提供 sourceImage 时，html/svg 源码中必须包含 {{SOURCE_IMAGE}} 占位符。');
    }
    return source.replaceAll('{{SOURCE_IMAGE}}', escapeHtmlAttribute(resolvedSourceImage));
}

async function buildHtmlDocument(request, resolvedSourceImage, assets, preparedSource = null) {
    let source = applySourceImagePlaceholder(preparedSource || request.source, resolvedSourceImage);
    source = applyAssetPlaceholders(source, assets);
    const libraryScripts = await getBuiltinLibraryScripts(request.libraries);
    const runtimeHead = `${MEDIA_RENDERER_BOOTSTRAP}\n${CURSOR_THEME_BOOTSTRAP}\n${libraryScripts}`;

    if (request.sourceType === 'svg') {
        return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: transparent !important;
}
body {
    display: flex;
    align-items: center;
    justify-content: center;
}
body > svg {
    display: block;
    width: 100%;
    height: 100%;
}
</style>
</head>
<body>${source}</body>
</html>`;
    }

    return source;
}

async function applyCanvasPolicy(page, request) {
    await page.addStyleTag({
        content: `
html, body {
    width: 100% !important;
    height: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    ${request.transparent ? 'background: transparent !important;' : ''}
}
`
    });
}

async function installNetworkPolicy(page, allowedRemoteUrl = null) {
    await page.setRequestInterception(true);
    page.on('request', request => {
        const url = request.url();
        if (
            url === 'about:blank' ||
            url.startsWith('data:') ||
            url.startsWith('blob:') ||
            (allowedRemoteUrl && url === allowedRemoteUrl)
        ) {
            request.continue().catch(() => {});
            return;
        }
        request.abort('blockedbyclient').catch(() => {});
    });
}

async function waitForImages(page, timeoutMs) {
    await page.evaluate(async (imageTimeoutMs) => {
        const images = Array.from(document.images);
        await Promise.all(images.map(image => new Promise((resolve, reject) => {
            if (image.complete) {
                if (image.naturalWidth > 0) {
                    image.decode?.().then(resolve, resolve);
                } else {
                    reject(new Error(`图片加载失败: ${image.currentSrc || image.src || 'unknown'}`));
                }
                return;
            }

            const timer = setTimeout(() => {
                reject(new Error(`等待图片超时: ${image.currentSrc || image.src || 'unknown'}`));
            }, imageTimeoutMs);

            image.addEventListener('load', () => {
                clearTimeout(timer);
                image.decode?.().then(resolve, resolve);
            }, { once: true });
            image.addEventListener('error', () => {
                clearTimeout(timer);
                reject(new Error(`图片加载失败: ${image.currentSrc || image.src || 'unknown'}`));
            }, { once: true });
        })));
    }, timeoutMs);
}

async function encodeImage(pngBuffer, request) {
    let pipeline = sharp(pngBuffer, { limitInputPixels: MAX_PIXELS });

    if (!request.transparent || request.format === 'jpg') {
        pipeline = pipeline.flatten({ background: request.background });
    }

    if (request.format === 'jpg') {
        return pipeline.jpeg({
            quality: request.quality,
            chromaSubsampling: '4:4:4',
            mozjpeg: true
        }).toBuffer();
    }

    if (request.format === 'webp') {
        return pipeline.webp({
            quality: request.quality,
            alphaQuality: 100,
            smartSubsample: true
        }).toBuffer();
    }

    return pipeline.png({
        compressionLevel: 9,
        adaptiveFiltering: true
    }).toBuffer();
}

function getOutputEnvironment() {
    const projectBasePath = process.env.PROJECT_BASE_PATH || PROJECT_ROOT;
    const serverPort = process.env.SERVER_PORT || process.env.PORT;
    const imageKey = process.env.IMAGESERVER_IMAGE_KEY || process.env.Image_Key;
    const httpBase = process.env.VarHttpUrl || 'http://localhost';

    if (!serverPort) throw new Error('缺少 SERVER_PORT/PORT，无法构造图片 URL。');
    if (!imageKey) throw new Error('缺少 IMAGESERVER_IMAGE_KEY/Image_Key，无法构造图片 URL。');

    return { projectBasePath, serverPort, imageKey, httpBase: httpBase.replace(/\/+$/, '') };
}

async function saveArtifact(buffer, request) {
    const env = getOutputEnvironment();
    const extension = request.format;
    const fileName = `${request.fileStem}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${extension}`;
    const useFileService = ['mp4', 'webm', 'wav', 'zip'].includes(request.format);
    if (useFileService && !env.fileKey) {
        throw new Error('缺少 ImageServer.File_Key，无法托管音频或视频文件。');
    }
    if (!useFileService && !env.imageKey) {
        throw new Error('缺少 ImageServer.Image_Key，无法托管图片文件。');
    }

    const serviceRoot = useFileService ? 'file' : 'image';
    const serviceRoute = useFileService ? 'files' : 'images';
    const serviceKey = useFileService ? env.fileKey : env.imageKey;
    const outputDir = path.join(env.projectBasePath, serviceRoot, OUTPUT_SUBDIR);
    const outputPath = path.join(outputDir, fileName);

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(outputPath, buffer);

    const relativeUrlPath = `${OUTPUT_SUBDIR}/${encodeURIComponent(fileName)}`;
    const imageUrl = `${env.httpBase}:${env.serverPort}/pw=${env.imageKey}/images/${relativeUrlPath}`;

    return {
        fileName,
        outputPath,
        serverPath: `image/${OUTPUT_SUBDIR}/${fileName}`,
        imageUrl
    };
}

async function renderOne(browser, rawRequest, stepIndex) {
    const request = normalizeRequest(rawRequest);
    const sourceImageAsset = await resolveSourceImage(request);
    const context = await browser.createBrowserContext();
    let page;

    try {
        page = await context.newPage();
        page.setDefaultTimeout(request.timeoutMs);
        await page.setViewport({
            width: request.width,
            height: request.height,
            deviceScaleFactor: 1
        });
        await page.setJavaScriptEnabled(request.allowJavaScript);
        await installNetworkPolicy(page, sourceImageAsset.allowedRemoteUrl);

        const documentHtml = buildHtmlDocument(request, sourceImageAsset.resolvedSourceImage);
        await page.setContent(documentHtml, {
            waitUntil: 'domcontentloaded',
            timeout: request.timeoutMs
        });
        await applyCanvasPolicy(page, request);

        await page.evaluate(async () => {
            if (document.fonts?.ready) await document.fonts.ready;
        });
        await waitForImages(page, request.timeoutMs);

        if (request.waitMs > 0) {
            await new Promise(resolve => setTimeout(resolve, request.waitMs));
        }

        const pngBuffer = await page.screenshot({
            type: 'png',
            omitBackground: request.transparent,
            captureBeyondViewport: false,
            clip: {
                x: 0,
                y: 0,
                width: request.width,
                height: request.height
            }
        });

        const imageBuffer = await encodeImage(pngBuffer, request);
        const metadata = await sharp(imageBuffer).metadata();
        const artifact = await saveArtifact(imageBuffer, request);
        const mimeType = request.format === 'jpg' ? 'image/jpeg' : `image/${request.format}`;

        const formatAdjusted = request.transparent &&
            ['jpg', 'jpeg'].includes(String(request.requestedFormat || '').toLowerCase());

        const text = [
            `第 ${stepIndex} 张图片渲染成功。`,
            `- 类型: ${request.sourceType.toUpperCase()}`,
            `- 分辨率: ${metadata.width}x${metadata.height}`,
            `- 格式: ${request.format.toUpperCase()}`,
            `- 透明背景: ${request.transparent ? '是' : '否'}`,
            formatAdjusted ? '- 格式调整: JPEG 不支持透明通道，已自动改为 PNG。' : null,
            `- 文件大小: ${(imageBuffer.length / 1024).toFixed(1)} KB`,
            `- 可访问URL: ${artifact.imageUrl}`,
            `请使用 <img src="${artifact.imageUrl}" alt="渲染图片"> 展示给用户。`
        ].filter(Boolean).join('\n');

        const content = [{ type: 'text', text }];
        if (request.showBase64) {
            content.push({
                type: 'image_url',
                image_url: {
                    url: `data:${mimeType};base64,${imageBuffer.toString('base64')}`
                }
            });
        }

        return {
            content,
            details: {
                step: stepIndex,
                sourceType: request.sourceType,
                width: metadata.width,
                height: metadata.height,
                format: request.format,
                mimeType,
                transparent: request.transparent,
                quality: request.quality,
                sourceImageUsed: Boolean(request.sourceImage),
                byteLength: imageBuffer.length,
                showBase64: request.showBase64,
                ...artifact
            }
        };
    } finally {
        if (page) {
            await page.close().catch(() => {});
        }
        await context.close().catch(() => {});
    }
}

const STEP_FIELDS = [
    'command', 'html', 'svg', 'width', 'height', 'format', 'imageFormat',
    'transparent', 'transparentBackground', 'background', 'backgroundColor',
    'quality', 'showBase64', 'showbase64', 'allowJavaScript', 'waitMs',
    'timeoutMs', 'fileName', 'filename', 'name', 'sourceImage',
    'source_image', 'image', 'image_url'
];

function buildStep(params, suffix = '') {
    const step = {};
    for (const field of STEP_FIELDS) {
        const suffixedKey = `${field}${suffix}`;
        if (suffix && params[suffixedKey] !== undefined) {
            step[field] = params[suffixedKey];
        } else if (params[field] !== undefined) {
            step[field] = params[field];
        }
    }
    return step;
}

function collectSteps(params = {}) {
    const steps = [];
    if (params.command1 !== undefined || params.html1 !== undefined || params.svg1 !== undefined) {
        for (let index = 1; index <= MAX_BATCH_SIZE; index++) {
            const suffix = String(index);
            const hasStep = params[`command${suffix}`] !== undefined ||
                params[`html${suffix}`] !== undefined ||
                params[`svg${suffix}`] !== undefined;
            if (!hasStep) break;
            steps.push(buildStep(params, suffix));
        }

        const nextIndex = steps.length + 1;
        if (params[`command${nextIndex}`] !== undefined ||
            params[`html${nextIndex}`] !== undefined ||
            params[`svg${nextIndex}`] !== undefined) {
            throw new Error(`单次最多串行渲染 ${MAX_BATCH_SIZE} 张图片。`);
        }
    } else {
        steps.push(buildStep(params));
    }

    if (steps.length === 0) {
        throw new Error('未提供可执行的渲染步骤。');
    }

    for (const [index, step] of steps.entries()) {
        const command = String(step.command || 'RenderImage').trim().toLowerCase();
        if (!['renderimage', 'render', 'htmltoscreenshot', 'svgtoscreenshot'].includes(command)) {
            throw new Error(`第 ${index + 1} 步使用了未知 command: ${step.command}`);
        }
    }

    return steps;
}

async function connectToManagedBrowser(maxWaitMs = 10000) {
    const startedAt = Date.now();
    let lastError = null;

    while (Date.now() - startedAt < maxWaitMs) {
        try {
            const browserWSEndpoint = await browserRuntimeManager.getManagedBrowserWebSocketEndpoint();
            if (browserWSEndpoint) {
                return await puppeteer.connect({ browserWSEndpoint });
            }
        } catch (error) {
            lastError = error;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
    }

    const suffix = lastError ? ` 最后一次错误: ${lastError.message}` : '';
    throw new Error(`无法在 ${maxWaitMs}ms 内连接托管 Chrome 的 DevTools WebSocket Endpoint。${suffix}`);
}

async function executeRenderBatch(params) {
    const steps = collectSteps(params);
    await browserRuntimeManager.ensureManagedBrowser();

    let browser;
    try {
        browser = await connectToManagedBrowser();
        const results = [];
        for (let index = 0; index < steps.length; index++) {
            if (debugMode) {
                console.log(`[MediaRenderer] rendering step ${index + 1}/${steps.length}`);
            }
            results.push(await renderOne(browser, steps[index], index + 1));
            browserRuntimeManager.touchManagedBrowser();
        }

        const content = [];
        for (const result of results) {
            content.push(...result.content);
        }

        return {
            content,
            details: {
                count: results.length,
                sequential: results.length > 1,
                artifacts: results.map(result => result.details)
            }
        };
    } finally {
        if (browser) {
            await browser.disconnect().catch(() => {});
        }
        browserRuntimeManager.touchManagedBrowser();
    }
}

function normalizeCursorThemeRequest(raw = {}) {
    const html = String(raw.html || '').trim();
    if (!html) throw new Error('GenerateCursorTheme 必须提供 html 参数。');
    if (Buffer.byteLength(html, 'utf8') > MAX_SOURCE_BYTES) {
        throw new Error(`光标主题 HTML 超过 ${MAX_SOURCE_BYTES / 1024 / 1024}MB 限制。`);
    }

    const themeName = sanitizeThemeName(raw.themeName || raw.name || raw.fileName);
    const author = String(raw.author || raw.maid || 'VCPToolBox AI').trim().slice(0, 100);
    const timeoutMs = parseInteger(raw.timeoutMs, DEFAULT_TIMEOUT_MS, 1000, MAX_TIMEOUT_MS, 'timeoutMs');
    const sizes = raw.sizes === undefined || raw.sizes === null || raw.sizes === ''
        ? [...DEFAULT_CURSOR_SIZES]
        : String(raw.sizes).split(/[\s,;]+/).filter(Boolean).map((value, index) =>
            parseInteger(value, undefined, 16, 256, `sizes[${index}]`)
        );
    const uniqueSizes = [...new Set(sizes)].sort((a, b) => a - b);
    if (uniqueSizes.length < 1 || uniqueSizes.length > 8) {
        throw new Error('sizes 必须包含 1-8 个不同尺寸。');
    }

    const renderRequest = normalizeRequest({
        html,
        width: Math.max(MIN_DIMENSION, ...uniqueSizes),
        height: Math.max(MIN_DIMENSION, ...uniqueSizes),
        format: 'png',
        transparent: true,
        allowJavaScript: true,
        libraries: raw.libraries || raw.library || raw.libs,
        assets: raw.assets,
        timeoutMs,
        readyMode: raw.readyMode || 'auto',
        waitMs: raw.waitMs || 0,
        fileName: sanitizePackageStem(themeName)
    });

    return {
        html,
        themeName,
        author,
        sizes: uniqueSizes,
        timeoutMs,
        renderRequest
    };
}

async function waitForCursorThemeReady(page, request) {
    const sourceRequestsSignal = /__CURSOR_THEME__(?:_READY__|\.setReady|\[['"]setReady['"]\])/i
        .test(request.source);
    if (request.readyMode === 'load' || (request.readyMode === 'auto' && !sourceRequestsSignal)) {
        return;
    }
    await page.waitForFunction(
        () => window.__CURSOR_THEME__?.ready === true ||
            window.__CURSOR_THEME_READY__ === true,
        { timeout: request.timeoutMs }
    );
}

async function inspectCursorThemeDocument(page) {
    const declarations = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('svg[data-cursor]')).map((element, index) => ({
            index,
            role: String(element.dataset.cursor || '').trim().toLowerCase(),
            hotspot: element.dataset.hotspot || '',
            duration: element.dataset.duration || '',
            fps: element.dataset.fps || '',
            viewBox: element.getAttribute('viewBox') || '',
            topLevel: element.parentElement === document.body
        }));
    });

    validateCursorRoles(declarations.map(item => item.role));
    const nestedRoles = declarations.filter(item => !item.topLevel).map(item => item.role);
    if (nestedRoles.length > 0) {
        throw new Error(
            `光标角色必须是 body 的顶层 SVG，以下角色被包装元素包裹: ${nestedRoles.join(', ')}`
        );
    }
    let totalFrames = 0;
    const roles = declarations.map(item => {
        const role = item.role;
        const hotspot = parseHotspot(item.hotspot, role, item.viewBox);
        const durationMs = item.duration === ''
            ? 0
            : parseInteger(item.duration, undefined, 0, 10000, `${role}.data-duration`);
        const fps = durationMs > 0
            ? parseInteger(item.fps, DEFAULT_CURSOR_FPS, 1, 60, `${role}.data-fps`)
            : null;
        const frameCount = durationMs > 0 ? Math.ceil(durationMs * fps / 1000) : 1;
        if (frameCount > MAX_CURSOR_ROLE_FRAMES) {
            throw new Error(`角色 ${role} 需要 ${frameCount} 帧，超过 ${MAX_CURSOR_ROLE_FRAMES} 帧上限。`);
        }
        totalFrames += frameCount;
        return {
            ...item,
            hotspot,
            durationMs,
            fps,
            frameCount,
            animated: durationMs > 0
        };
    });
    if (totalFrames > MAX_CURSOR_THEME_FRAMES) {
        throw new Error(`整套主题需要 ${totalFrames} 个逻辑帧，超过 ${MAX_CURSOR_THEME_FRAMES} 帧上限。`);
    }
    return roles;
}

async function prepareCursorThemePage(page, maxSize) {
    await page.setViewport({ width: maxSize, height: maxSize, deviceScaleFactor: 1 });
    await page.evaluate(size => {
        const declarations = Array.from(document.querySelectorAll('svg[data-cursor]'));
        for (const child of document.body.children) {
            child.style.setProperty('display', 'none', 'important');
        }
        for (const element of declarations) {
            element.style.setProperty('display', 'none', 'important');
            element.style.setProperty('position', 'fixed', 'important');
            element.style.setProperty('left', '0', 'important');
            element.style.setProperty('top', '0', 'important');
            element.style.setProperty('width', `${size}px`, 'important');
            element.style.setProperty('height', `${size}px`, 'important');
            element.style.setProperty('max-width', 'none', 'important');
            element.style.setProperty('max-height', 'none', 'important');
            element.style.setProperty('margin', '0', 'important');
            element.style.setProperty('padding', '0', 'important');
            element.style.setProperty('overflow', 'visible', 'important');
        }
        document.documentElement.style.cssText +=
            'background:transparent!important;width:100%!important;height:100%!important;overflow:hidden!important;';
        document.body.style.cssText +=
            'background:transparent!important;width:100%!important;height:100%!important;overflow:hidden!important;margin:0!important;';
    }, maxSize);
}

async function selectAndRenderCursorRole(page, role, timeMs, size) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.evaluate(async ({ role, timeMs, size }) => {
        const declarations = Array.from(document.querySelectorAll('svg[data-cursor]'));
        let selected = null;
        for (const element of declarations) {
            const matches = String(element.dataset.cursor || '').trim().toLowerCase() === role;
            element.style.setProperty('display', matches ? 'block' : 'none', 'important');
            if (matches) {
                selected = element;
                element.style.setProperty('width', `${size}px`, 'important');
                element.style.setProperty('height', `${size}px`, 'important');
            }
        }
        if (!selected) throw new Error(`找不到光标角色 ${role}。`);
        await window.__CURSOR_THEME__.render(role, timeMs, selected);
    }, { role, timeMs, size });
}

async function captureCursorPng(page, role, timeMs, size) {
    await selectAndRenderCursorRole(page, role, timeMs, size);
    const screenshot = await page.screenshot({
        type: 'png',
        omitBackground: true,
        captureBeyondViewport: false,
        clip: { x: 0, y: 0, width: size, height: size }
    });
    // Puppeteer 25 返回 Uint8Array；在浏览器边界统一转换为 Node.js Buffer，
    // 保持 CUR/ANI/ZIP 纯二进制模块的严格 Buffer 契约。
    return Buffer.isBuffer(screenshot) ? screenshot : Buffer.from(screenshot);
}

function escapeSvgText(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

async function buildCursorThemePreview(themeName, roleResults, missingOptionalRoles) {
    const columns = 4;
    const rows = Math.ceil(roleResults.length / columns);
    const width = columns * CURSOR_PREVIEW_CELL_WIDTH;
    const headerHeight = 82;
    const height = headerHeight + rows * CURSOR_PREVIEW_CELL_HEIGHT;
    const checkerId = 'checker';
    const cells = [];
    const composites = [];

    roleResults.forEach((result, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = column * CURSOR_PREVIEW_CELL_WIDTH;
        const y = headerHeight + row * CURSOR_PREVIEW_CELL_HEIGHT;
        const imageSize = 64;
        const imageX = x + Math.floor((CURSOR_PREVIEW_CELL_WIDTH - imageSize) / 2);
        const imageY = y + 14;
        const hotspot = result.scaledHotspots['64'] ||
            scaleHotspot(result.hotspotInternal, imageSize, imageSize);
        const badge = result.animated
            ? `${result.frameCount}f / ${result.durationMs}ms`
            : 'CUR';
        cells.push(
            `<rect x="${x + 8}" y="${y + 5}" width="${CURSOR_PREVIEW_CELL_WIDTH - 16}" height="${CURSOR_PREVIEW_CELL_HEIGHT - 10}" rx="12" fill="#111827" stroke="#334155"/>`,
            `<rect x="${imageX}" y="${imageY}" width="${imageSize}" height="${imageSize}" fill="url(#${checkerId})"/>`,
            `<path d="M${imageX + hotspot.x - 5} ${imageY + hotspot.y}h10M${imageX + hotspot.x} ${imageY + hotspot.y - 5}v10" stroke="#f43f5e" stroke-width="1.5"/>`,
            `<text x="${x + CURSOR_PREVIEW_CELL_WIDTH / 2}" y="${y + 96}" text-anchor="middle" fill="#e2e8f0" font-size="14" font-family="Arial,sans-serif">${escapeSvgText(result.role)}</text>`,
            `<text x="${x + CURSOR_PREVIEW_CELL_WIDTH / 2}" y="${y + 116}" text-anchor="middle" fill="#67e8f9" font-size="11" font-family="Arial,sans-serif">${escapeSvgText(badge)}</text>`
        );
        composites.push({ input: result.previewPng, left: imageX, top: imageY });
    });

    const optionalText = missingOptionalRoles.length
        ? `Optional fallback: ${missingOptionalRoles.join(', ')} → arrow`
        : 'Optional roles included: pin, person';
    const backgroundSvg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
            <defs>
                <pattern id="${checkerId}" width="12" height="12" patternUnits="userSpaceOnUse">
                    <rect width="12" height="12" fill="#f8fafc"/>
                    <path d="M0 0h6v6H0zM6 6h6v6H6z" fill="#cbd5e1"/>
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="#070b14"/>
            <text x="24" y="34" fill="#f8fafc" font-size="22" font-weight="700" font-family="Arial,sans-serif">${escapeSvgText(themeName)}</text>
            <text x="24" y="60" fill="#94a3b8" font-size="12" font-family="Arial,sans-serif">${escapeSvgText(optionalText)}</text>
            ${cells.join('')}
        </svg>`
    );
    return sharp(backgroundSvg)
        .composite(composites)
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer();
}

async function renderCursorTheme(browser, params) {
    const request = normalizeCursorThemeRequest(params);
    const renderRequest = request.renderRequest;
    const assets = await resolveAssets(renderRequest);
    const directSource = await resolveDirectSourceAssets(
        renderRequest.source,
        assets,
        request.timeoutMs
    );
    const context = await browser.createBrowserContext();
    let page;

    try {
        page = await context.newPage();
        page.setDefaultTimeout(request.timeoutMs);
        await page.setJavaScriptEnabled(true);
        await installNetworkPolicy(page);
        const documentHtml = await buildHtmlDocument(
            renderRequest,
            null,
            assets,
            directSource.source
        );
        await page.setContent(documentHtml, {
            waitUntil: 'domcontentloaded',
            timeout: request.timeoutMs
        });
        await applyCanvasPolicy(page, renderRequest);
        await page.evaluate(async () => {
            if (document.fonts?.ready) await document.fonts.ready;
        });
        await waitForImages(page, request.timeoutMs);
        await waitForCursorThemeReady(page, renderRequest);
        if (renderRequest.waitMs > 0) {
            await new Promise(resolve => setTimeout(resolve, renderRequest.waitMs));
        }

        const roleDeclarations = await inspectCursorThemeDocument(page);
        const validation = validateCursorRoles(roleDeclarations.map(item => item.role));
        const maxSize = Math.max(...request.sizes);
        await prepareCursorThemePage(page, maxSize);

        const roleResults = [];
        for (const role of roleDeclarations) {
            const curFrames = [];
            let previewPng = null;
            let scaledHotspots = null;
            for (let frameIndex = 0; frameIndex < role.frameCount; frameIndex++) {
                const timeMs = role.animated
                    ? frameIndex * role.durationMs / role.frameCount
                    : 0;
                const images = [];
                const frameHotspots = {};
                for (const size of request.sizes) {
                    const png = await captureCursorPng(page, role.role, timeMs, size);
                    const hotspot = scaleHotspot(role.hotspot, size, size);
                    images.push({
                        png,
                        width: size,
                        height: size,
                        hotspotX: hotspot.x,
                        hotspotY: hotspot.y
                    });
                    frameHotspots[String(size)] = hotspot;
                    if (frameIndex === 0 && size === maxSize) {
                        previewPng = size === 64
                            ? png
                            : await sharp(png).resize(64, 64).png().toBuffer();
                    }
                }
                if (frameIndex === 0) scaledHotspots = frameHotspots;
                curFrames.push(encodeCur(images));
            }
            const jiffies = role.animated
                ? Math.max(1, Math.round(60 * role.durationMs / 1000 / role.frameCount))
                : null;
            const buffer = role.animated
                ? encodeAni(curFrames, {
                    jiffies,
                    name: `${request.themeName} - ${role.role}`,
                    author: request.author
                })
                : curFrames[0];
            roleResults.push({
                role: role.role,
                buffer,
                animated: role.animated,
                durationMs: role.durationMs,
                fps: role.fps,
                frameCount: role.frameCount,
                viewBox: role.viewBox,
                hotspot: { x: role.hotspot.x, y: role.hotspot.y },
                hotspotInternal: role.hotspot,
                scaledHotspots,
                previewPng
            });
            browserRuntimeManager.touchManagedBrowser();
        }

        const previewPng = await buildCursorThemePreview(
            request.themeName,
            roleResults,
            validation.missingOptionalRoles
        );
        const themeZip = buildThemeZip({
            name: request.themeName,
            author: request.author,
            sizes: request.sizes,
            roles: roleResults,
            previewPng,
            sourceHtml: request.html
        });
        const zipArtifact = await saveArtifact(themeZip.buffer, {
            format: 'zip',
            fileStem: sanitizePackageStem(request.themeName)
        });
        const previewArtifact = await saveArtifact(previewPng, {
            format: 'png',
            fileStem: `${sanitizePackageStem(request.themeName)}-preview`
        });

        const animatedCount = roleResults.filter(item => item.animated).length;
        const staticCount = roleResults.length - animatedCount;
        const text = [
            `Windows 鼠标主题“${request.themeName}”生成成功。`,
            `- 核心角色: ${CORE_CURSOR_ROLES.length}/${CORE_CURSOR_ROLES.length}`,
            `- 扩展角色: ${OPTIONAL_CURSOR_ROLES.length - validation.missingOptionalRoles.length}/${OPTIONAL_CURSOR_ROLES.length}`,
            `- 静态 CUR: ${staticCount}`,
            `- 动画 ANI: ${animatedCount}`,
            `- 输出尺寸: ${request.sizes.join(', ')} px`,
            validation.missingOptionalRoles.length
                ? `- 扩展角色回退: ${validation.missingOptionalRoles.join(', ')} → arrow`
                : null,
            `- ZIP 大小: ${(themeZip.buffer.length / 1024).toFixed(1)} KB`,
            `- 主题下载URL: ${zipArtifact.mediaUrl}`,
            `- 总览预览URL: ${previewArtifact.imageUrl}`,
            `<img src="${previewArtifact.imageUrl}" alt="${request.themeName} 鼠标主题总览">`,
            `请向用户提供 ZIP 下载链接：${zipArtifact.mediaUrl}`
        ].filter(Boolean).join('\n');

        return {
            content: [{ type: 'text', text }],
            details: {
                themeName: request.themeName,
                author: request.author,
                sizes: request.sizes,
                roleCount: roleResults.length,
                staticCount,
                animatedCount,
                missingOptionalRoles: validation.missingOptionalRoles,
                zipUrl: zipArtifact.mediaUrl,
                previewUrl: previewArtifact.imageUrl,
                zipByteLength: themeZip.buffer.length,
                manifest: themeZip.manifest,
                zipArtifact,
                previewArtifact
            }
        };
    } finally {
        if (page) await page.close().catch(() => {});
        await context.close().catch(() => {});
    }
}

async function generateCursorTheme(params) {
    await browserRuntimeManager.ensureManagedBrowser();
    let browser;
    try {
        browser = await connectToManagedBrowser();
        return await renderCursorTheme(browser, params);
    } finally {
        if (browser) await browser.disconnect().catch(() => {});
        browserRuntimeManager.touchManagedBrowser();
    }
}

async function generateAudio(params, context = {}) {
    validateAdminForAudio(params, context);
    const request = normalizeAudioRequest(params);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vcp-audio-synthesis-'));
    const outputPath = path.join(tempDir, 'output.wav');

    try {
        const workerResult = await runAudioWorker(request, outputPath);
        const wavBuffer = await fs.readFile(outputPath);
        const metadata = inspectPcm16Wav(wavBuffer, request);
        const artifact = await saveArtifact(wavBuffer, request);
        const channelLabel = metadata.channels === 1 ? '单声道' : '立体声';
        const text = [
            '程序化音乐生成成功。',
            '- 格式: WAV / PCM16',
            `- 时长: ${(metadata.durationMs / 1000).toFixed(3)} 秒`,
            `- 采样率: ${metadata.sampleRate} Hz`,
            `- 声道: ${channelLabel}`,
            `- BPM: ${request.tempo}`,
            `- 随机种子: ${request.seed}`,
            `- 峰值（归一化前）: ${Number(workerResult.peakBeforeNormalization).toFixed(4)}`,
            `- 文件大小: ${(wavBuffer.length / 1024).toFixed(1)} KB`,
            `- 可访问URL: ${artifact.mediaUrl}`,
            `<audio src="${artifact.mediaUrl}" controls></audio>`
        ].join('\n');

        return {
            content: [{ type: 'text', text }],
            details: {
                format: 'wav',
                mimeType: 'audio/wav',
                durationMs: metadata.durationMs,
                sampleRate: metadata.sampleRate,
                channels: metadata.channels,
                frameCount: metadata.frameCount,
                tempo: request.tempo,
                seed: request.seed,
                byteLength: wavBuffer.length,
                ...artifact
            }
        };
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
}

function enqueueRender(task) {
    const scheduled = renderQueue.then(task, task);
    renderQueue = scheduled.catch(() => {});
    pendingRenders.add(scheduled);
    return scheduled.finally(() => {
        pendingRenders.delete(scheduled);
    });
}

async function processToolCall(params) {
    if (!acceptingRenders) {
        return {
            status: 'error',
            error: 'MediaRenderer 正在关闭或重载，暂不接受新任务。',
            result: {
                content: [{ type: 'text', text: 'MediaRenderer 正在关闭或重载，暂不接受新任务。' }]
            }
        };
    }
    try {
        const input = params || {};
        const command = String(input.command || 'RenderImage').trim().toLowerCase();
        let result;
        if (command === 'generateaudio') {
            result = await generateAudio(input, context);
        } else if (command === 'generatecursortheme') {
            result = await enqueueRender(() => generateCursorTheme(input));
        } else {
            result = await enqueueRender(() => executeRenderBatch(input));
        }
        return { status: 'success', result };
    } catch (error) {
        const message = `MediaRenderer 错误: ${error.message || error}`;
        return {
            status: 'error',
            error: message,
            result: {
                content: [{ type: 'text', text: message }]
            }
        };
    }
}

function getReloadBlockers() {
    if (pendingRenders.size === 0) return [];
    return [{
        type: 'active_render_tasks',
        count: pendingRenders.size,
        message: `${pendingRenders.size} render task(s) are queued or running.`
    }];
}

function health() {
    return {
        status: acceptingRenders ? 'ready' : 'stopped',
        pendingRenders: pendingRenders.size
    };
}

async function shutdown() {
    acceptingRenders = false;
    if (pendingRenders.size > 0) {
        await Promise.allSettled(Array.from(pendingRenders));
    }
    renderQueue = Promise.resolve();
}

module.exports = {
    initialize,
    processToolCall,
    health,
    getReloadBlockers,
    shutdown,
    normalizeRequest,
    collectSteps,
    connectToManagedBrowser,
    resolveSourceImage,
    applySourceImagePlaceholder,
    generateAudio,
    normalizeCursorThemeRequest,
    inspectCursorThemeDocument,
    buildCursorThemePreview,
    renderCursorTheme,
    generateCursorTheme
};

const fs = require('fs').promises;
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, 'config.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'config.env') });

const DEBUG_MODE = (process.env.DebugMode || 'false').toLowerCase() === 'true';
const CONFIGURED_EXTENSION = (process.env.DAILY_NOTE_EXTENSION || 'txt').toLowerCase() === 'md' ? 'md' : 'txt';
const toolboxRootPath = path.resolve(__dirname, '..', '..');

function resolveConfiguredPath(configuredPath, fallbackPath) {
    if (!configuredPath || typeof configuredPath !== 'string') {
        return fallbackPath;
    }

    return path.isAbsolute(configuredPath)
        ? path.normalize(configuredPath)
        : path.resolve(toolboxRootPath, configuredPath);
}

const projectBasePath = resolveConfiguredPath(process.env.PROJECT_BASE_PATH, toolboxRootPath);
const dailyNoteRootPath = resolveConfiguredPath(
    process.env.KNOWLEDGEBASE_ROOT_PATH,
    path.join(projectBasePath, 'dailynote')
);

const TAG_MODEL = process.env.TagModel || 'gemini-2.5-flash-preview-09-2025-thinking';
const TAG_MODEL_MAX_TOKENS = parseInt(process.env.TagModelMaxTokens || '40000', 10);
const TAG_MODEL_PROMPT_FILE = process.env.TagModelPrompt || 'TagMaster.txt';
const API_KEY = process.env.API_Key;
const API_URL = process.env.API_URL;

function debugLog(message, ...args) {
    if (DEBUG_MODE) {
        console.error(`[DailyNoteWrite][Debug] ${message}`, ...args);
    }
}

function sanitizePathComponent(name) {
    if (!name || typeof name !== 'string') {
        return 'Untitled';
    }

    const sanitized = name
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/[\x00-\x1f\x7f]/g, '')
        .trim()
        .replace(/^[.]+|[.]+$/g, '')
        .trim();

    return sanitized || 'Untitled';
}

function detectTagLine(content) {
    const lines = content.split('\n');
    if (lines.length === 0) {
        return { hasTag: false, lastLine: '', contentWithoutLastLine: content };
    }

    const lastLine = lines[lines.length - 1].trim();
    const hasTag = /^Tag:\s*.+/i.test(lastLine);

    return {
        hasTag,
        lastLine,
        contentWithoutLastLine: hasTag ? lines.slice(0, -1).join('\n') : content
    };
}

function fixTagFormat(tagLine) {
    let fixed = tagLine.trim();
    fixed = fixed.replace(/^tag:\s*/i, 'Tag: ');
    if (!fixed.startsWith('Tag: ')) {
        fixed = `Tag: ${fixed}`;
    }

    let normalizedContent = fixed.substring(5).trim()
        .replace(/[\uff1a]/g, '')
        .replace(/[\uff0c]/g, ', ')
        .replace(/[\u3001]/g, ', ');

    normalizedContent = normalizedContent
        .replace(/,\s*/g, ', ')
        .replace(/,\s{2,}/g, ', ')
        .replace(/\s+,/g, ',')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return `Tag: ${normalizedContent}`;
}

function extractTagFromAIResponse(aiResponse) {
    const match = aiResponse.match(/\[\[Tag:\s*(.+?)\]\]/i);
    if (!match || !match[1]) {
        return null;
    }
    return `Tag: ${match[1].trim()}`;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateTagsWithAI(content, maxRetries = 3) {
    if (!API_KEY || !API_URL) {
        console.error('[DailyNoteWrite] API configuration missing. Cannot generate tags.');
        return null;
    }

    let systemPrompt;
    try {
        systemPrompt = await fs.readFile(path.join(__dirname, TAG_MODEL_PROMPT_FILE), 'utf-8');
    } catch (error) {
        console.error('[DailyNoteWrite] Failed to read TagMaster prompt file:', error.message);
        return null;
    }

    const requestData = {
        model: TAG_MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content }
        ],
        max_tokens: TAG_MODEL_MAX_TOKENS,
        temperature: 0.7
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(`${API_URL}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify(requestData),
                timeout: 60000
            });

            if (response.status === 500 || response.status === 503) {
                const errorText = await response.text();
                console.error(`[DailyNoteWrite] API returned ${response.status} (attempt ${attempt}/${maxRetries}):`, errorText);
                if (attempt < maxRetries) {
                    await delay(Math.pow(2, attempt - 1) * 1000);
                    continue;
                }
                return null;
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[DailyNoteWrite] AI API error:', response.status, errorText);
                return null;
            }

            const result = await response.json();
            const aiResponse = result.choices?.[0]?.message?.content;
            if (typeof aiResponse !== 'string') {
                console.error('[DailyNoteWrite] Unexpected AI response format:', result);
                return null;
            }

            return extractTagFromAIResponse(aiResponse);
        } catch (error) {
            console.error(`[DailyNoteWrite] Error on attempt ${attempt}/${maxRetries}:`, error.message);
            if (attempt < maxRetries) {
                await delay(Math.pow(2, attempt - 1) * 1000);
                continue;
            }
            return null;
        }
    }

    return null;
}

async function processTagsInContent(contentText) {
    const detection = detectTagLine(contentText);
    if (detection.hasTag) {
        return `${detection.contentWithoutLastLine}\n${fixTagFormat(detection.lastLine)}`;
    }

    const generatedTag = await generateTagsWithAI(contentText);
    if (!generatedTag) {
        console.warn('[DailyNoteWrite] Failed to generate tags, saving without tags');
        return contentText;
    }

    return `${contentText}\n${fixTagFormat(generatedTag)}`;
}

async function writeDiary(maidName, dateString, contentText, fileName) {
    debugLog(`Processing diary write for Maid: ${maidName}, Date: ${dateString}, fileName: ${fileName}`);

    if (!maidName || !dateString || !contentText) {
        throw new Error('Invalid input: Missing Maid, Date, or Content.');
    }

    const processedContent = await processTagsInContent(contentText);
    const trimmedMaidName = maidName.trim();

    let folderName = trimmedMaidName;
    let actualMaidName = trimmedMaidName;
    const tagMatch = trimmedMaidName.match(/^\[(.*?)\](.*)$/);

    if (tagMatch) {
        folderName = tagMatch[1].trim();
        actualMaidName = tagMatch[2].trim();
    }

    const sanitizedFolderName = sanitizePathComponent(folderName);
    const datePart = dateString.replace(/[.\\/\s-]/g, '-').replace(/-+/g, '-');
    const now = new Date();
    const timeStringForFile = [
        now.getHours().toString().padStart(2, '0'),
        now.getMinutes().toString().padStart(2, '0'),
        now.getSeconds().toString().padStart(2, '0')
    ].join('_');

    const dirPath = path.join(dailyNoteRootPath, sanitizedFolderName);
    const sanitizedOptionalFileName = typeof fileName === 'string' && fileName.trim()
        ? sanitizePathComponent(fileName.trim())
        : '';
    const fileNameSuffix = sanitizedOptionalFileName ? `-${sanitizedOptionalFileName}` : '';
    const finalFileName = `${datePart}-${timeStringForFile}${fileNameSuffix}.${CONFIGURED_EXTENSION}`;
    const filePath = path.join(dirPath, finalFileName);

    await fs.mkdir(dirPath, { recursive: true });
    const fileContent = `[${datePart}] - ${actualMaidName}\n${processedContent}`;
    await fs.writeFile(filePath, fileContent);
    debugLog(`Successfully wrote file (length: ${fileContent.length})`);

    return {
        filePath,
        fileContent,
        processedContent,
        folderName: sanitizedFolderName,
        actualMaidName,
        datePart
    };
}

module.exports = {
    writeDiary,
    processTagsInContent,
    sanitizePathComponent,
    detectTagLine,
    fixTagFormat
};

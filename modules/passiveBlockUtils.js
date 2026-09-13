'use strict';

// 控制边界约定：
// - VCP_RAG_BLOCK 是外部记忆正文；
// - VCP_PASSIVE_BLOCK 是预处理器生成、仍需展示给模型的正文。
// 两者都对模型可见，但内部文本不得再次被解释为预处理器控制指令。
const VCP_RAG_BLOCK_REGEX = /<!--\s*VCP_RAG_BLOCK_START\b[\s\S]*?<!--\s*VCP_RAG_BLOCK_END\s*-->/gi;
const VCP_PASSIVE_BLOCK_REGEX = /<!--\s*VCP_PASSIVE_BLOCK_START\b[\s\S]*?<!--\s*VCP_PASSIVE_BLOCK_END\s*-->/gi;
const VCP_PASSIVE_BLOCK_START = '<!-- VCP_PASSIVE_BLOCK_START';
const VCP_PASSIVE_BLOCK_END = '<!-- VCP_PASSIVE_BLOCK_END -->';

function collectRanges(text, regex) {
    const ranges = [];
    const re = new RegExp(regex.source, regex.flags);
    let match;
    while ((match = re.exec(text)) !== null) {
        ranges.push({ start: match.index, end: match.index + match[0].length });
        if (match[0].length === 0) re.lastIndex += 1;
    }
    return ranges;
}

function mergeRanges(ranges) {
    const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
    const merged = [];
    for (const range of sorted) {
        const previous = merged[merged.length - 1];
        if (!previous || range.start > previous.end) {
            merged.push({ ...range });
        } else if (range.end > previous.end) {
            previous.end = range.end;
        }
    }
    return merged;
}

function getPassiveBlockRanges(text) {
    if (typeof text !== 'string' || !text) return [];
    return mergeRanges([
        ...collectRanges(text, VCP_RAG_BLOCK_REGEX),
        ...collectRanges(text, VCP_PASSIVE_BLOCK_REGEX)
    ]);
}

function overlapsAnyRange(start, end, ranges) {
    return ranges.some(range => start < range.end && end > range.start);
}

function stripPassiveBlocks(text) {
    if (typeof text !== 'string' || !text) return text;
    const ranges = getPassiveBlockRanges(text);
    if (ranges.length === 0) return text;

    let result = '';
    let cursor = 0;
    for (const range of ranges) {
        result += text.slice(cursor, range.start);
        cursor = range.end;
    }
    return result + text.slice(cursor);
}

function findMatchesOutsidePassiveBlocks(text, regex) {
    if (typeof text !== 'string' || !(regex instanceof RegExp)) return [];
    const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
    const re = new RegExp(regex.source, flags);
    const ranges = getPassiveBlockRanges(text);
    const matches = [];
    let match;

    while ((match = re.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (!overlapsAnyRange(start, end, ranges)) matches.push(match);
        if (match[0].length === 0) re.lastIndex += 1;
    }
    return matches;
}

function replaceOutsidePassiveBlocks(text, regex, replacement) {
    if (typeof text !== 'string' || !(regex instanceof RegExp)) return text;
    const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
    const re = new RegExp(regex.source, flags);
    const ranges = getPassiveBlockRanges(text);
    let result = '';
    let cursor = 0;
    let match;

    while ((match = re.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (!overlapsAnyRange(start, end, ranges)) {
            result += text.slice(cursor, start);
            result += typeof replacement === 'function'
                ? replacement(...match, start, text)
                : replacement;
            cursor = end;
        }
        if (match[0].length === 0) re.lastIndex += 1;
    }
    return result + text.slice(cursor);
}

function replaceLastLiteralOutsidePassiveBlocks(text, search, replacement) {
    if (typeof text !== 'string' || !search) return text;
    const ranges = getPassiveBlockRanges(text);
    let index = text.lastIndexOf(search);
    while (index >= 0) {
        const end = index + search.length;
        if (!overlapsAnyRange(index, end, ranges)) {
            return text.slice(0, index) + replacement + text.slice(end);
        }
        index = text.lastIndexOf(search, index - 1);
    }
    return text;
}

function escapePassiveBlockSentinels(content) {
    return String(content || '').replace(
        /VCP_PASSIVE_BLOCK_(START|END)/gi,
        'VCP_PASSIVE_BLOCK\\_$1'
    );
}

function buildPassiveBlock(content, metadata = {}) {
    const safeMetadata = JSON.stringify(metadata && typeof metadata === 'object' ? metadata : {})
        .replace(/-->/g, '--\\>');
    return `${VCP_PASSIVE_BLOCK_START} ${safeMetadata} -->`
        + `${escapePassiveBlockSentinels(content)}`
        + VCP_PASSIVE_BLOCK_END;
}

module.exports = {
    VCP_RAG_BLOCK_REGEX,
    VCP_PASSIVE_BLOCK_REGEX,
    getPassiveBlockRanges,
    overlapsAnyRange,
    stripPassiveBlocks,
    findMatchesOutsidePassiveBlocks,
    replaceOutsidePassiveBlocks,
    replaceLastLiteralOutsidePassiveBlocks,
    buildPassiveBlock
};

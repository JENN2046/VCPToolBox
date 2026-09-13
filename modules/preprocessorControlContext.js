'use strict';

const crypto = require('crypto');
const { getPassiveBlockRanges } = require('./passiveBlockUtils');

function cloneJsonLike(value) {
    if (Array.isArray(value)) return value.map(cloneJsonLike);
    if (!value || typeof value !== 'object') return value;
    const copy = {};
    for (const [key, child] of Object.entries(value)) copy[key] = cloneJsonLike(child);
    return copy;
}

function createOpaqueToken(index) {
    return `\uE000VCP_OPAQUE_${index}_${crypto.randomBytes(12).toString('hex')}\uE001`;
}

function transformString(text, blocks) {
    const ranges = getPassiveBlockRanges(text);
    if (ranges.length === 0) return text;

    let result = '';
    let cursor = 0;
    for (const range of ranges) {
        const token = createOpaqueToken(blocks.length);
        blocks.push({
            token,
            content: text.slice(range.start, range.end)
        });
        result += text.slice(cursor, range.start);
        result += token;
        cursor = range.end;
    }
    return result + text.slice(cursor);
}

function transformContent(value, blocks) {
    if (typeof value === 'string') return transformString(value, blocks);
    if (Array.isArray(value)) return value.map(item => transformContent(item, blocks));
    if (!value || typeof value !== 'object') return value;
    const copy = {};
    for (const [key, child] of Object.entries(value)) {
        copy[key] = transformContent(child, blocks);
    }
    return copy;
}

function countLiteral(text, needle) {
    if (!needle) return 0;
    let count = 0;
    let cursor = 0;
    while ((cursor = text.indexOf(needle, cursor)) >= 0) {
        count += 1;
        cursor += needle.length;
    }
    return count;
}

function restoreContent(value, blocks, seen) {
    if (typeof value === 'string') {
        let restored = value;
        for (const block of blocks) {
            const count = countLiteral(restored, block.token);
            if (count > 1 || (count === 1 && seen.has(block.token))) {
                const error = new Error('A protected passive block token was duplicated.');
                error.code = 'PASSIVE_BLOCK_BOUNDARY_VIOLATION';
                throw error;
            }
            if (count === 1) {
                seen.add(block.token);
                restored = restored.replace(block.token, block.content);
            }
        }
        return restored;
    }
    if (Array.isArray(value)) return value.map(item => restoreContent(item, blocks, seen));
    if (!value || typeof value !== 'object') return value;
    const copy = {};
    for (const [key, child] of Object.entries(value)) {
        copy[key] = restoreContent(child, blocks, seen);
    }
    return copy;
}

function createPreprocessorControlContext(messages, metadata = {}) {
    const blocks = [];
    const controlMessages = (Array.isArray(messages) ? messages : []).map(message => {
        const copy = cloneJsonLike(message);
        if (Object.prototype.hasOwnProperty.call(copy, 'content')) {
            copy.content = transformContent(copy.content, blocks);
        }
        return copy;
    });

    let patchedMessages = null;
    const patch = Object.freeze({
        replaceMessageContent(index, content) {
            if (!Number.isInteger(index) || index < 0 || index >= controlMessages.length) {
                throw new RangeError('Message patch index is out of bounds.');
            }
            const next = cloneJsonLike(patchedMessages || controlMessages);
            next[index].content = cloneJsonLike(content);
            patchedMessages = next;
        },
        applyMessages(nextMessages) {
            if (!Array.isArray(nextMessages)) {
                throw new TypeError('Preprocessor patch must be an array of messages.');
            }
            patchedMessages = cloneJsonLike(nextMessages);
        }
    });

    function restoreAndValidate(candidateMessages) {
        const candidate = candidateMessages === undefined || candidateMessages === null
            ? (patchedMessages || controlMessages)
            : candidateMessages;
        if (!Array.isArray(candidate)) {
            const error = new Error('Control-syntax preprocessor returned a non-array message value.');
            error.code = 'INVALID_PREPROCESSOR_PATCH';
            throw error;
        }

        const seen = new Set();
        const restored = restoreContent(cloneJsonLike(candidate), blocks, seen);
        const missing = blocks.filter(block => !seen.has(block.token));
        if (missing.length) {
            const error = new Error(
                `Control-syntax preprocessor removed or rewrote ${missing.length} protected passive block(s).`
            );
            error.code = 'PASSIVE_BLOCK_BOUNDARY_VIOLATION';
            error.details = { protectedBlocks: blocks.length, missingBlocks: missing.length };
            throw error;
        }
        return restored;
    }

    return Object.freeze({
        pluginName: metadata.pluginName || null,
        generation: metadata.generation || null,
        messages: controlMessages,
        patch,
        protectedBlockCount: blocks.length,
        restoreAndValidate
    });
}

module.exports = {
    createPreprocessorControlContext
};

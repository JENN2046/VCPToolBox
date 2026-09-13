'use strict';
const d = require('./durable');
function crc32(bytes) {
    let c = 4294967295;
    for (const b of bytes) {
        c ^= b;
        for (let i = 0; i < 8; i++)
            c = c >>> 1 ^ (c & 1 ? 3988292384 : 0);
    }
    return (c ^ 4294967295) >>> 0;
}
function inspect(root, main, {
    maxBytes = 256 * 1024 * 1024
} = {}) {
    const text = main + '.text', meta = main + '.text.meta';
    const result = {
        main_exists: d.fs.existsSync(main),
        text_exists: d.fs.existsSync(text),
        meta_exists: d.fs.existsSync(meta),
        valid: false
    };
    if (!result.main_exists || !result.text_exists || !result.meta_exists)
        return result;
    try {
        if (d.fs.statSync(text).size > maxBytes)
            d.fail('INSPECTION_BUDGET_EXCEEDED');
        const b = d.read(root, text), m = d.read(root, meta);
        if (m.length !== 28 || m.toString('ascii', 0, 4) !== 'TMET' || m.readUInt32LE(4) !== 1 || Number(m.readBigUInt64LE(8)) !== d.fs.statSync(main).size || Number(m.readBigUInt64LE(16)) !== b.length || m.readUInt32LE(24) !== crc32(b))
            d.fail('TEXT_META_INVALID');
        if (b.length < 8 || b.toString('ascii', 0, 4) !== 'TIDX' || b.readUInt32LE(4) !== 2)
            d.fail('TEXT_FORMAT_UNSUPPORTED');
        let pos = 8;
        function u() {
            if (pos + 8 > b.length)
                d.fail('TEXT_TRUNCATED');
            const n = Number(b.readBigUInt64LE(pos));
            pos += 8;
            if (!Number.isSafeInteger(n))
                d.fail('TEXT_INTEGER');
            return n;
        }
        function count() {
            const n = u();
            if (n > (b.length - pos) / 8)
                d.fail('TEXT_COUNT');
            return n;
        }
        function str() {
            const n = u();
            if (n > b.length - pos)
                d.fail('TEXT_TRUNCATED');
            const s = new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(pos, pos + n));
            pos += n;
            return s;
        }
        function pairs() {
            const map = new Map();
            for (let n = count(); n--;) {
                const k = u(), v = u();
                if (map.has(k))
                    d.fail('DUPLICATE_POSTING');
                map.set(k, v);
            }
            return map;
        }
        const keywords = new Map();
        for (let n = count(); n--;) {
            const key = str();
            if (keywords.has(key))
                d.fail('DUPLICATE_TERM');
            const ids = [];
            for (let k = count(); k--;)
                ids.push(u());
            keywords.set(key, ids);
        }
        const postings = new Map();
        for (let n = count(); n--;) {
            const key = str();
            if (postings.has(key))
                d.fail('DUPLICATE_TERM');
            postings.set(key, pairs());
        }
        const lengths = pairs();
        if (pos !== b.length)
            d.fail('TEXT_TRAILING_DATA');
        return {
            ...result,
            valid: true,
            keywords,
            postings,
            lengths,
            docIds: [...lengths.keys()].sort((a, b) => a - b)
        };
    } catch (e) {
        return {
            ...result,
            error: e.code || 'TEXT_INVALID'
        };
    }
}
module.exports = { inspect };

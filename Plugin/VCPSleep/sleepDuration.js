'use strict';

const MAX_SLEEP_MS = 12 * 60 * 60 * 1000;

function getArgument(args, ...names) {
    for (const name of names) {
        if (Object.prototype.hasOwnProperty.call(args, name) && args[name] !== undefined) return args[name];
    }
    const normalizedNames = names.map(name => name.toLowerCase());
    for (const [key, value] of Object.entries(args)) {
        if (normalizedNames.includes(key.toLowerCase()) && value !== undefined) return value;
    }
    return undefined;
}

function parseSleepDuration(value) {
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new Error('睡觉时间必须是有限数字。');
        return Math.round(value * 1000);
    }
    if (typeof value !== 'string' || !value.trim()) throw new Error('缺少必需参数：睡觉时间。');
    const input = value.trim().toLowerCase();
    if (/^\d+(?:\.\d+)?$/.test(input)) return Math.round(Number(input) * 1000);
    const unitMatch = input.match(/^(\d+(?:\.\d+)?)\s*(ms|毫秒|s|秒|m|min|分钟|h|hr|小时)$/i);
    if (unitMatch) {
        const multiplier = {
            ms: 1, 毫秒: 1, s: 1000, 秒: 1000,
            m: 60 * 1000, min: 60 * 1000, 分钟: 60 * 1000,
            h: 60 * 60 * 1000, hr: 60 * 60 * 1000, 小时: 60 * 60 * 1000
        }[unitMatch[2].toLowerCase()];
        return Math.round(Number(unitMatch[1]) * multiplier);
    }
    const compoundMatch = input.match(/^(?:(\d+(?:\.\d+)?)\s*(?:小时|h|hr))?\s*(?:(\d+(?:\.\d+)?)\s*(?:分钟|min|m))?\s*(?:(\d+(?:\.\d+)?)\s*(?:秒|s))?$/i);
    if (compoundMatch && compoundMatch.slice(1).some(part => part !== undefined)) {
        return Math.round((Number(compoundMatch[1] || 0) * 3600 + Number(compoundMatch[2] || 0) * 60 + Number(compoundMatch[3] || 0)) * 1000);
    }
    throw new Error('无法识别睡觉时间。请使用秒数或 30s、10m、2h、1小时30分钟 等格式。');
}

function getSleepDurationMs(args) {
    const durationMs = parseSleepDuration(getArgument(args, '睡觉时间', 'sleepTime', 'duration', 'durationSeconds', 'seconds'));
    if (durationMs <= 0) throw new Error('睡觉时间必须大于 0。');
    if (durationMs > MAX_SLEEP_MS) throw new Error('单次睡觉时间不能超过 12 小时。');
    return durationMs;
}

module.exports = { getArgument, getSleepDurationMs };

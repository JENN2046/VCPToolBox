#!/usr/bin/env node

const DEFAULT_TIMEZONE = 'Asia/Shanghai';
const { getArgument, getSleepDurationMs } = require('./sleepDuration');

function resolveTimezone() {
    const timezone = String(process.env.DEFAULT_TIMEZONE || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
    try {
        new Intl.DateTimeFormat('zh-CN', { timeZone: timezone }).format(new Date());
        return timezone;
    } catch (_) {
        return DEFAULT_TIMEZONE;
    }
}

function formatWakeTime(date, timezone) {
    const parts = new Intl.DateTimeFormat('zh-CN', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
        timeZoneName: 'longOffset'
    }).formatToParts(date);

    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const offset = values.timeZoneName || timezone;
    return {
        date: `${values.year}-${values.month}-${values.day}`,
        time: `${values.hour}:${values.minute}:${values.second}`,
        offset
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function sendResponse(response) {
    process.stdout.write(JSON.stringify(response));
}

async function main(args) {
    const tipsValue = getArgument(
        args,
        '睡觉tips',
        '睡觉提示',
        'sleepTips',
        'tips',
        'tip',
        'message'
    );

    const durationMs = getSleepDurationMs(args);

    const tips = tipsValue === undefined || tipsValue === null
        ? ''
        : String(tipsValue).trim();

    const timezone = resolveTimezone();
    const startedAt = new Date();

    await sleep(durationMs);

    const wokeAt = new Date();
    const localWakeTime = formatWakeTime(wokeAt, timezone);
    const tipsMessage = tips ? `睡前留下的小纸条：${tips}\n` : '';
    const message = `休息结束了。\n${tipsMessage}现在是 ${localWakeTime.date} ${localWakeTime.time}（${timezone}，${localWakeTime.offset}）。`;

    sendResponse({
        status: 'success',
        result: {
            content: [
                {
                    type: 'text',
                    text: message
                }
            ],
            details: {
                requestedDurationMs: durationMs,
                actualDurationMs: wokeAt.getTime() - startedAt.getTime(),
                tips,
                timezone,
                startedAt: startedAt.toISOString(),
                wokeAt: wokeAt.toISOString(),
                localWakeTime: `${localWakeTime.date} ${localWakeTime.time}`,
                utcOffset: localWakeTime.offset
            }
        }
    });
}

let inputData = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
    inputData += chunk;
});
process.stdin.on('end', async () => {
    try {
        if (!inputData.trim()) {
            throw new Error('未从 stdin 接收到调用参数。');
        }
        const args = JSON.parse(inputData);
        await main(args);
    } catch (error) {
        sendResponse({
            status: 'error',
            error: `VCPSleep 插件错误：${error.message}`
        });
        process.exitCode = 1;
    }
});

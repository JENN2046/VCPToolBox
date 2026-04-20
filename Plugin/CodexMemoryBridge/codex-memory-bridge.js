const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { writeDiary } = require('../DailyNoteWrite/writer-core');

const DEBUG_MODE = (process.env.DebugMode || 'false').toLowerCase() === 'true';
const projectBasePath = process.env.PROJECT_BASE_PATH || path.join(__dirname, '..', '..');
const logsDir = path.join(projectBasePath, 'logs');
const auditLogPath = path.join(logsDir, 'codex-memory-bridge.jsonl');
const HIGH_RISK_SENSITIVITY_PATTERN = /\b(secret|unsafe|credential|credentials|password|passwd|token|api[-_ ]?key|access[-_ ]?key|private[-_ ]?key|secret[-_ ]?key)\b/i;

function debugLog(message, ...args) {
    if (DEBUG_MODE) {
        console.error(`[CodexMemoryBridge][Debug] ${message}`, ...args);
    }
}

function sendOutput(data) {
    process.stdout.write(JSON.stringify(data));
}

function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeBoolean(value) {
    if (typeof value === 'boolean') return value;
    const normalized = normalizeString(value).toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function getDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function generateMemoryId(target) {
    const prefix = target === 'knowledge' ? 'knowledge' : 'process';
    const randomPart = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '')
        : crypto.randomBytes(12).toString('hex');
    return `codex-${prefix}-${randomPart}`;
}

function getExecutionContext(payload) {
    const envContext = normalizeString(process.env.VCP_EXECUTION_CONTEXT);
    if (envContext) {
        try {
            return JSON.parse(envContext);
        } catch (error) {
            debugLog('Failed to parse VCP_EXECUTION_CONTEXT:', error.message);
        }
    }

    if (payload && typeof payload.__executionContext === 'object' && payload.__executionContext) {
        return payload.__executionContext;
    }

    return {
        agentAlias: normalizeString(process.env.VCP_AGENT_ALIAS) || null,
        agentId: normalizeString(process.env.VCP_AGENT_ID) || null,
        requestSource: normalizeString(process.env.VCP_REQUEST_SOURCE) || 'unknown'
    };
}

function buildRejectedResult(reason, executionContext, target = null) {
    return {
        success: false,
        decision: 'rejected',
        targetDiary: null,
        reason,
        title: null,
        memoryId: null,
        filePath: null,
        agentAlias: executionContext.agentAlias || null,
        agentId: executionContext.agentId || null,
        requestSource: executionContext.requestSource || 'unknown',
        target
    };
}

function validateProcessEntry(title, content) {
    const combined = `${title}\n${content}`;
    const allowedSignals = /\b(checkpoint|risk|todo|pending|stage-conclusion)\b/i;
    const guessSignals = /\b(maybe|perhaps|guess|assume|estimate)\b/i;

    if (!allowedSignals.test(combined)) {
        return 'process memory must include checkpoint, risk, todo, pending, or stage-conclusion.';
    }

    if (guessSignals.test(combined) && !/\b(risk|todo|pending)\b/i.test(combined)) {
        return 'pure guesses are not written to Codex memory; keep them as pending/risk or add evidence first.';
    }

    return null;
}

function getSensitivityRejectionReason(target, sensitivity) {
    if (!sensitivity || sensitivity === 'none') {
        return null;
    }

    if (target === 'knowledge') {
        return 'knowledge memory only accepts sensitivity=none.';
    }

    if (HIGH_RISK_SENSITIVITY_PATTERN.test(sensitivity)) {
        return 'high-risk sensitive content will not be written to Codex memory.';
    }

    return null;
}

function buildDiaryPayload(payload) {
    const lines = [
        `Title: ${payload.title}`,
        `Memory-ID: ${payload.memoryId}`,
        `Record-Type: ${payload.target === 'knowledge' ? 'knowledge' : 'process'}`,
        `Validated: ${payload.validated ? 'yes' : 'no'}`,
        `Reusable: ${payload.reusable ? 'yes' : 'no'}`,
        '',
        'Content:',
        payload.content,
        '',
        'Evidence:',
        payload.evidence
    ];

    if (payload.tags) {
        lines.push('', `Tag: ${payload.tags}`);
    }

    return lines.join('\n');
}

async function appendAuditLog(entry) {
    await fs.mkdir(logsDir, { recursive: true });
    await fs.appendFile(auditLogPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

async function handleRecord(payload) {
    const executionContext = getExecutionContext(payload);
    const target = normalizeString(payload.target).toLowerCase();
    const title = normalizeString(payload.title);
    const content = normalizeString(payload.content);
    const evidence = normalizeString(payload.evidence);
    const tags = normalizeString(payload.tags);
    const sensitivity = normalizeString(payload.sensitivity).toLowerCase();
    const validated = normalizeBoolean(payload.validated);
    const reusable = normalizeBoolean(payload.reusable);

    if (executionContext.agentAlias !== 'Codex') {
        return buildRejectedResult('CodexMemoryBridge only allows writes from the Codex agent context.', executionContext, target || null);
    }

    if (target !== 'process' && target !== 'knowledge') {
        return buildRejectedResult('target must be process or knowledge.', executionContext, target || null);
    }

    if (!title || !content || !evidence) {
        return buildRejectedResult('title, content, and evidence are required.', executionContext, target);
    }

    const sensitivityError = getSensitivityRejectionReason(target, sensitivity);
    if (sensitivityError) {
        return buildRejectedResult(sensitivityError, executionContext, target);
    }

    if (target === 'knowledge' && !(validated && reusable)) {
        return buildRejectedResult('knowledge memory requires validated=true and reusable=true.', executionContext, target);
    }

    if (target === 'process') {
        const processError = validateProcessEntry(title, content);
        if (processError) {
            return buildRejectedResult(processError, executionContext, target);
        }
    }

    const memoryId = generateMemoryId(target);
    const targetDiary = target === 'knowledge' ? 'Codex knowledge' : 'Codex';
    const maidName = target === 'knowledge' ? '[Codex的知识]Codex' : '[Codex]Codex';
    const diaryContent = buildDiaryPayload({
        target,
        title,
        memoryId,
        content,
        evidence,
        tags,
        validated,
        reusable
    });
    const writeResult = await writeDiary(maidName, getDateString(), diaryContent, title);

    return {
        success: true,
        decision: 'accepted',
        targetDiary,
        reason: `written to ${targetDiary}.`,
        title,
        memoryId,
        filePath: writeResult.filePath,
        agentAlias: executionContext.agentAlias,
        agentId: executionContext.agentId || null,
        requestSource: executionContext.requestSource || 'unknown',
        target
    };
}

async function main() {
    let inputData = '';
    process.stdin.setEncoding('utf8');

    process.stdin.on('readable', () => {
        let chunk;
        while ((chunk = process.stdin.read()) !== null) {
            inputData += chunk;
        }
    });

    process.stdin.on('end', async () => {
        try {
            if (!inputData) {
                throw new Error('No input data received via stdin.');
            }

            const payload = JSON.parse(inputData);
            const result = await handleRecord(payload);
            await appendAuditLog({
                timestamp: new Date().toISOString(),
                agentAlias: result.agentAlias || null,
                agentId: result.agentId || null,
                decision: result.decision,
                target: result.target || null,
                title: result.title || null,
                memoryId: result.memoryId || null,
                reason: result.reason,
                filePath: result.filePath || null
            });

            sendOutput({
                status: 'success',
                result
            });
        } catch (error) {
            console.error('[CodexMemoryBridge] Error:', error.message);
            sendOutput({
                status: 'error',
                error: error.message || 'An unknown error occurred.'
            });
            process.exitCode = 1;
        }
    });

    process.stdin.on('error', (error) => {
        console.error('[CodexMemoryBridge] Stdin error:', error);
        sendOutput({ status: 'error', error: 'Error reading input.' });
        process.exitCode = 1;
    });
}

main();


#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const CONFIG = {
  VCP_API_URL: process.env.VCP_API_URL || 'http://127.0.0.1:6005',
  VCP_API_KEY: process.env.VCP_API_KEY || 'vcp-secret',
  DEFAULT_MODEL: process.env.DEFAULT_MODEL || 'Nova',
  WORKLOG_DIR: path.join(__dirname, '..', '..', 'state', 'worklog')
};

const Logger = {
  info(message, data = {}) {
    console.error(`[INFO] ${new Date().toISOString()} ${message}`, JSON.stringify(data));
  },
  warn(message, data = {}) {
    console.error(`[WARN] ${new Date().toISOString()} ${message}`, JSON.stringify(data));
  },
  error(message, data = {}) {
    console.error(`[ERROR] ${new Date().toISOString()} ${message}`, JSON.stringify(data));
  }
};

const GRAY_STAGE = {
  QUERY_ONLY: 'query_only',
  LOW_RISK_WRITE: 'low_risk_write',
  FULL_WRITE: 'full_write'
};

function normalizeGrayStage(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();

  if (!raw) {
    return GRAY_STAGE.FULL_WRITE;
  }

  const aliases = {
    query: GRAY_STAGE.QUERY_ONLY,
    query_only: GRAY_STAGE.QUERY_ONLY,
    phase1: GRAY_STAGE.QUERY_ONLY,
    p1: GRAY_STAGE.QUERY_ONLY,
    low_risk: GRAY_STAGE.LOW_RISK_WRITE,
    low_risk_write: GRAY_STAGE.LOW_RISK_WRITE,
    phase2: GRAY_STAGE.LOW_RISK_WRITE,
    p2: GRAY_STAGE.LOW_RISK_WRITE,
    full: GRAY_STAGE.FULL_WRITE,
    full_write: GRAY_STAGE.FULL_WRITE,
    phase3: GRAY_STAGE.FULL_WRITE,
    p3: GRAY_STAGE.FULL_WRITE
  };

  return aliases[raw] || GRAY_STAGE.FULL_WRITE;
}

function canWriteAITableByGrayStage(stage) {
  return stage === GRAY_STAGE.FULL_WRITE;
}

function toDateText(date) {
  return date.toISOString().split('T')[0];
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getFriday(date) {
  const monday = getMonday(date);
  monday.setDate(monday.getDate() + 4);
  monday.setHours(23, 59, 59, 999);
  return monday;
}

async function getWorkLogsByDateRange(weekStart, weekEnd) {
  const logs = [];
  const start = new Date(weekStart);
  const end = new Date(weekEnd);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return logs;
  }

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = toDateText(d);
    const logFile = path.join(CONFIG.WORKLOG_DIR, `${dateStr}.json`);

    if (!fs.existsSync(logFile)) {
      continue;
    }

    try {
      const data = fs.readFileSync(logFile, 'utf8');
      const dayLogs = JSON.parse(data);
      if (Array.isArray(dayLogs) && dayLogs.length > 0) {
        logs.push({ date: dateStr, logs: dayLogs });
      }
    } catch (error) {
      Logger.warn('读取工作日志失败', { file: logFile, error: error.message });
    }
  }

  return logs;
}

function getThisWeekLogs() {
  const now = new Date();
  return getWorkLogsByDateRange(toDateText(getMonday(now)), toDateText(getFriday(now)));
}

function stringifyLogItem(item) {
  if (typeof item === 'string') {
    return item;
  }
  if (item && typeof item === 'object') {
    if (item.content) {
      return String(item.content);
    }
    return JSON.stringify(item, null, 2);
  }
  return String(item || '');
}

function buildPrompt(logs, format) {
  const logSummary = logs
    .map((day) => {
      const items = (day.logs || []).map((entry) => `- ${stringifyLogItem(entry)}`).join('\n');
      return `${day.date}\n${items}`;
    })
    .join('\n\n');

  const formatHint =
    format === 'json'
      ? '请输出标准 JSON 字符串。'
      : format === 'text'
      ? '请输出纯文本。'
      : '请输出 Markdown。';

  return [
    '请根据以下本周工作记录生成结构化周报：',
    '',
    logSummary,
    '',
    '请包含以下部分：',
    '1. 本周工作摘要',
    '2. 完成情况（分项目/分主题）',
    '3. 关键数据与结果',
    '4. 风险与问题',
    '5. 下周计划',
    '',
    formatHint,
    '语气要求：专业、简洁、可执行。'
  ].join('\n');
}

async function generateReportWithAI(logs, format = 'markdown') {
  const totalLogs = logs.reduce((sum, day) => sum + ((day.logs && day.logs.length) || 0), 0);
  if (totalLogs === 0) {
    return {
      status: 'error',
      error: '本周没有可用工作记录，无法生成周报'
    };
  }

  const prompt = buildPrompt(logs, format);
  const url = new URL(CONFIG.VCP_API_URL);
  const apiPath = '/v1/chat/completions';
  const baseUrl = `${url.protocol}//${url.host}`;

  const body = JSON.stringify({
    model: CONFIG.DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content: '你是专业周报助手，擅长将工作记录整理为结构化周报。'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    agentName: CONFIG.DEFAULT_MODEL
  });

  return new Promise((resolve, reject) => {
    const req = http.request(
      `${baseUrl}${apiPath}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CONFIG.VCP_API_KEY}`,
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          const fallbackText = responseData || '生成失败';
          try {
            const parsed = JSON.parse(responseData);
            const content = parsed.choices && parsed.choices[0] && parsed.choices[0].message
              ? parsed.choices[0].message.content
              : parsed.raw || fallbackText;

            if (res.statusCode >= 400) {
              return resolve({
                status: 'error',
                error: `调用 VCP API 失败: HTTP ${res.statusCode}`,
                details: parsed
              });
            }

            return resolve({
              status: 'success',
              result: {
                report: content,
                format,
                logCount: totalLogs,
                dayCount: logs.length
              }
            });
          } catch (_error) {
            if (res.statusCode >= 400) {
              return resolve({
                status: 'error',
                error: `调用 VCP API 失败: HTTP ${res.statusCode}`,
                details: fallbackText
              });
            }

            return resolve({
              status: 'success',
              result: {
                report: fallbackText,
                format,
                logCount: totalLogs,
                dayCount: logs.length
              }
            });
          }
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function exportToTable(content, summary = '', tableUuid = '') {
  const grayStage = normalizeGrayStage(process.env.DWS_GRAY_STAGE);
  if (!canWriteAITableByGrayStage(grayStage)) {
    return {
      status: 'error',
      error: `weekly report export blocked by gray stage policy: ${grayStage}`,
      hint: 'phase-1/phase-2 only allow query or low-risk writes; aitable writes are enabled in full_write only'
    };
  }

  const targetTable = tableUuid || process.env.DINGTALK_TABLE_UUID || '';
  const baseId = process.env.DINGTALK_BASE_ID || '';
  const tableId = process.env.DINGTALK_TABLE_ID || '';
  if (!targetTable) {
    if (!baseId || !tableId) {
      return {
        status: 'error',
        error: 'set DINGTALK_BASE_ID + DINGTALK_TABLE_ID (preferred) or DINGTALK_TABLE_UUID (legacy fallback)'
      };
    }
  }

  const pluginManager = require('../../Plugin.js');
  const payload = {
    '周报内容': content,
    摘要: summary,
    '记录类型': '周报',
    '生成时间': new Date().toISOString()
  };

  try {
    Logger.info('Calling DingTalkCLI execute_tool', { tableUuid: targetTable });
    const writeTool = process.env.DINGTALK_WEEKLY_TABLE_WRITE_TOOL || 'record create';
    const useRecordCreate = baseId && tableId && writeTool === 'record create';
    const cliArgs = useRecordCreate
      ? {
          base_id: baseId,
          table_id: tableId,
          records: [
            {
              cells: payload
            }
          ]
        }
      : {
          table_uuid: targetTable,
          data: payload,
          fields: payload
        };

    const primary = await pluginManager.executePlugin(
      'DingTalkCLI',
      JSON.stringify({
        action: 'execute_tool',
        product: 'aitable',
        tool: writeTool,
        args: cliArgs,
        apply: true,
        dry_run: false,
        yes: true,
        format: 'json'
      }),
      null,
      null
    );

    if (primary && primary.status === 'success') {
      return {
        status: 'success',
        result: {
          message: 'weekly report exported via DingTalkCLI',
          provider: 'DingTalkCLI',
          tableUuid: targetTable,
          raw: primary.result
        }
      };
    }

    const primaryError = primary && primary.error ? primary.error : null;
    if (primaryError && primaryError.category === 'security') {
      return {
        status: 'error',
        error: primaryError.reason || 'weekly report export blocked by security policy',
        hint: primaryError.hint || 'adjust gray stage policy before enabling write'
      };
    }

    Logger.warn('DingTalkCLI export failed, fallback to DingTalkTable', { error: primaryError || 'unknown_error' });
  } catch (error) {
    Logger.warn('DingTalkCLI export threw error, fallback to DingTalkTable', { error: error.message });
  }

  try {
    if (!targetTable) {
      return {
        status: 'error',
        error: 'DingTalkCLI write failed and legacy fallback requires DINGTALK_TABLE_UUID'
      };
    }

    const fallback = await pluginManager.executePlugin(
      'DingTalkTable',
      JSON.stringify({
        action: 'add_record',
        table_uuid: targetTable,
        data: payload,
        apply: true,
        dry_run: false,
        yes: true
      }),
      null,
      null
    );

    if (fallback && fallback.status === 'success') {
      return {
        status: 'success',
        result: {
          message: 'weekly report exported via DingTalkTable fallback',
          provider: 'DingTalkTable',
          tableUuid: targetTable,
          raw: fallback.result
        }
      };
    }

    return {
      status: 'error',
      error: (fallback && fallback.error) || 'failed to export by DingTalkCLI and DingTalkTable'
    };
  } catch (error) {
    Logger.error('Fallback export failed', { error: error.message });
    return {
      status: 'error',
      error: `export failed: ${error.message}`
    };
  }
}

async function handleRequest(request) {
  const {
    action,
    week_start,
    week_end,
    weekStart,
    weekEnd,
    format = 'markdown',
    content,
    summary,
    table_uuid
  } = request;

  switch (action) {
    case 'generate_from_logs': {
      const start = week_start || weekStart || toDateText(getMonday(new Date()));
      const end = week_end || weekEnd || toDateText(getFriday(new Date()));
      const logs = await getWorkLogsByDateRange(start, end);
      return generateReportWithAI(logs, format);
    }

    case 'generate_from_diary': {
      const logs = await getThisWeekLogs();
      return generateReportWithAI(logs, format);
    }

    case 'export_to_table': {
      if (!content) {
        return { status: 'error', error: '缺少必需参数: content（周报内容）' };
      }
      return exportToTable(content, summary || '', table_uuid || '');
    }

    default:
      return { status: 'error', error: `未知操作: ${action}` };
  }
}

async function main() {
  let inputData = '';

  process.stdin.on('data', (chunk) => {
    inputData += chunk;
  });

  process.stdin.on('end', async () => {
    try {
      if (!inputData.trim()) {
        console.log(
          JSON.stringify({
            status: 'error',
            error: '无输入数据'
          })
        );
        process.exit(0);
      }

      const request = JSON.parse(inputData);
      Logger.info('收到请求', request);

      const response = await handleRequest(request);
      console.log(JSON.stringify(response));
    } catch (error) {
      Logger.error('处理请求失败', { error: error.message });
      console.log(
        JSON.stringify({
          status: 'error',
          error: `处理请求失败: ${error.message}`
        })
      );
    }

    process.exit(0);
  });
}

Logger.info('WeeklyReportGenerator plugin starting...');
main();

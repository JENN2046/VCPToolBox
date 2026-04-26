#!/usr/bin/env node
/**
 * WeeklyReportGenerator - 周报生成器插件
 *
 * 功能:
 * 1. 从工作记录生成周报
 * 2. 从日记系统生成周报
 * 3. 导出周报到钉钉 AI 表格
 * 4. 支持多种格式输出 (Markdown/Text/JSON)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// ============ 配置 ============

const CONFIG = {
  VCP_API_URL: process.env.VCP_API_URL || 'http://127.0.0.1:6005',
  VCP_API_KEY: process.env.VCP_API_KEY || 'vcp-secret',
  DEFAULT_MODEL: process.env.DEFAULT_MODEL || 'Nova',
  WORKLOG_DIR: path.join(__dirname, '..', '..', 'state', 'worklog'),
  DINGTALK_TABLE_UUID: process.env.DINGTALK_TABLE_UUID || '',
  DINGTALK_MCP_URL: process.env.DINGTALK_MCP_URL || 'http://127.0.0.1:9000',
  DINGTALK_MCP_KEY: process.env.DINGTALK_MCP_KEY || 'vcp-mcpo-secret',
  DWS_GRAY_STAGE: process.env.DWS_GRAY_STAGE || 'full_write',
};

// ============ 日志记录 ============

const Logger = {
  info: (msg, data = {}) => {
    const timestamp = new Date().toISOString();
    console.error(`[INFO] ${timestamp} ${msg}`, JSON.stringify(data));
  },
  warn: (msg, data = {}) => {
    const timestamp = new Date().toISOString();
    console.error(`[WARN] ${timestamp} ${msg}`, JSON.stringify(data));
  },
  error: (msg, data = {}) => {
    const timestamp = new Date().toISOString();
    console.error(`[ERROR] ${timestamp} ${msg}`, JSON.stringify(data));
  },
};

// ============ 数据读取 ============

/**
 * 获取指定日期范围的工作记录
 */
async function getWorkLogsByDateRange(weekStart, weekEnd) {
  const logs = [];
  const start = new Date(weekStart);
  const end = new Date(weekEnd);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const logFile = path.join(CONFIG.WORKLOG_DIR, `${dateStr}.json`);

    if (fs.existsSync(logFile)) {
      try {
        const data = fs.readFileSync(logFile, 'utf-8');
        const dayLogs = JSON.parse(data);
        if (Array.isArray(dayLogs) && dayLogs.length > 0) {
          logs.push({
            date: dateStr,
            logs: dayLogs
          });
        }
      } catch (error) {
        Logger.warn('读取工作日志失败', { file: logFile, error: error.message });
      }
    }
  }

  return logs;
}

/**
 * 获取本周工作记录
 */
function getThisWeekLogs() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const weekStart = monday.toISOString().split('T')[0];
  const weekEnd = new Date(monday);
  weekEnd.setDate(monday.getDate() + 4); // 周五
  weekEnd.setHours(23, 59, 59, 999);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  return getWorkLogsByDateRange(weekStart, weekEndStr);
}

/**
 * 获取上周工作记录
 */
function getLastWeekLogs() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset - 7); // 上周一
  monday.setHours(0, 0, 0, 0);

  const weekStart = monday.toISOString().split('T')[0];
  const weekEnd = new Date(monday);
  weekEnd.setDate(monday.getDate() + 4); // 上周五
  weekEnd.setHours(23, 59, 59, 999);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  return getWorkLogsByDateRange(weekStart, weekEndStr);
}

// ============ AI 调用 ============

/**
 * 调用 VCP AI 生成周报
 */
async function generateReportWithAI(logs, format = 'markdown') {
  const totalLogs = logs.reduce((sum, day) => sum + (day.logs?.length || 0), 0);

  if (totalLogs === 0) {
    return {
      status: 'error',
      error: '本周没有工作记录，无法生成周报'
    };
  }

  // 构建日志摘要
  const logSummary = logs.map(day => {
    const logContents = day.logs.map(log => `  - ${log.content}`).join('\n');
    return `${day.date}:\n${logContents}`;
  }).join('\n\n');

  // 构建 AI 提示词
  const prompt = `请根据以下本周工作记录生成一份结构化周报：

${logSummary}

请生成一份专业的周报，包含以下部分：
1. **本周工作摘要** - 一句话总结本周重点
2. **完成情况** - 按类别或项目整列完成的工作
3. **关键数据** - 如有数据支撑请列出
4. **经验教训** - 本周学到的经验或遇到的问题
5. **下周计划** - 基于本周进度的下周计划

格式要求：${format === 'json' ? 'JSON 格式' : format === 'text' ? '纯文本格式' : 'Markdown 格式'}
语气：专业、简洁、有数据支撑`;

  // 调用 VCP API
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.VCP_API_URL);
    const apiPath = '/v1/chat/completions';
    const baseUrl = `${url.protocol}//${url.host}`;

    const body = JSON.stringify({
      model: CONFIG.DEFAULT_MODEL,
      messages: [
        { role: 'system', content: '你是一个专业的周报生成助手，擅长将工作记录整理成结构化、专业的周报。' },
        { role: 'user', content: prompt }
      ],
      agentName: CONFIG.DEFAULT_MODEL,
    });

    const req = http.request(`${baseUrl}${apiPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.VCP_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          const content = result.choices?.[0]?.message?.content || result.raw || '生成失败';
          resolve({
            status: 'success',
            result: {
              report: content,
              format: format,
              logCount: totalLogs,
              dayCount: logs.length
            }
          });
        } catch (e) {
          resolve({
            status: 'success',
            result: {
              report: responseData,
              format: format,
              logCount: totalLogs,
              dayCount: logs.length
            }
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });
    req.write(body);
    req.end();
  });
}

// ============ 导出功能 ============

/**
 * 导出周报到钉钉 AI 表格
 */
async function exportToTable(content, summary = '', tableUuid = '') {
  const grayStage = String(CONFIG.DWS_GRAY_STAGE || '').trim().toLowerCase();
  if (grayStage !== 'full_write') {
    return {
      status: 'error',
      error: `周报导出被灰度策略阻断：DWS_GRAY_STAGE=${grayStage || 'unset'}。仅 full_write 阶段允许写入钉钉 AI 表格。`
    };
  }

  // 这里调用 DingTalkTable 插件
  // 由于是插件间调用，我们通过 VCP 内部 API 进行
  const targetTable = tableUuid || CONFIG.DINGTALK_TABLE_UUID;

  // 构建 MCP 调用
  const mcpBody = JSON.stringify({
    tool_name: 'add_record',
    table_uuid: targetTable,
    data: {
      '周报内容': content,
      '摘要': summary,
      '记录类型': '周报',
      '生成时间': new Date().toISOString()
    }
  });

  return new Promise((resolve, reject) => {
    const req = http.request(`${CONFIG.DINGTALK_MCP_URL}/tools/add_record/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.DINGTALK_MCP_KEY}`,
        'Content-Length': Buffer.byteLength(mcpBody),
      },
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve({
            status: 'success',
            result: {
              message: '周报已导出到钉钉 AI 表格',
              recordId: result.id,
              tableUuid: targetTable
            }
          });
        } catch (e) {
          resolve({
            status: 'success',
            result: {
              message: '周报导出成功（未获取到记录 ID）',
              raw: responseData
            }
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        status: 'error',
        error: `导出失败：${error.message}`
      });
    });
    req.write(mcpBody);
    req.end();
  });
}

// ============ 主处理逻辑 ============

async function handleRequest(request) {
  const { action, week_start, week_end, weekStart, weekEnd, format = 'markdown', content, summary, table_uuid } = request;

  switch (action) {
    case 'generate_from_logs':
      // 从工作记录生成周报
      const start = week_start || weekStart || getMonday(new Date()).toISOString().split('T')[0];
      const end = week_end || weekEnd || getFriday(new Date()).toISOString().split('T')[0];
      const logs = await getWorkLogsByDateRange(start, end);
      return await generateReportWithAI(logs, format);

    case 'generate_from_diary':
      // 从日记系统生成周报（待实现日记系统对接）
      const diaryLogs = getThisWeekLogs();
      return await generateReportWithAI(diaryLogs, format);

    case 'export_to_table':
      if (!content) {
        return { status: 'error', error: '缺少必需参数：content（周报内容）' };
      }
      return await exportToTable(content, summary || '', table_uuid || '');

    default:
      return { status: 'error', error: `未知操作：${action}` };
  }
}

// 辅助函数：获取周一
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// 辅助函数：获取周五
function getFriday(date) {
  const d = getMonday(date);
  d.setDate(d.getDate() + 4);
  return d;
}

// ============ 主函数 ============

async function main() {
  let inputData = '';

  process.stdin.on('data', chunk => {
    inputData += chunk;
  });

  process.stdin.on('end', async () => {
    try {
      if (!inputData.trim()) {
        console.log(JSON.stringify({
          status: 'error',
          error: '无输入数据'
        }));
        process.exit(0);
      }

      const request = JSON.parse(inputData);
      Logger.info('收到请求', request);

      const response = await handleRequest(request);
      console.log(JSON.stringify(response));
    } catch (e) {
      Logger.error('处理请求失败', { error: e.message });
      console.log(JSON.stringify({
        status: 'error',
        error: `处理请求失败：${e.message}`
      }));
    }

    process.exit(0);
  });
}

// 启动时输出信息
Logger.info('WeeklyReportGenerator 插件启动中...');

main();

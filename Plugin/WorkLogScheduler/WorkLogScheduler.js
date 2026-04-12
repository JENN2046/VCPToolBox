#!/usr/bin/env node
/**
 * WorkLogScheduler - 工作日志调度插件
 *
 * 功能:
 * 1. 定时触发日报/周报生成
 * 2. 读取工作记录数据
 * 3. 通过钉钉渠道推送消息
 * 4. 支持异步任务处理
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// ============ 配置 ============

const CONFIG = {
  DAILY_REPORT_TIME: process.env.DAILY_REPORT_TIME || '18:00',
  WEEKLY_REPORT_TIME: process.env.WEEKLY_REPORT_TIME || '17:00',
  WEEKLY_REPORT_DAY: parseInt(process.env.WEEKLY_REPORT_DAY || '5', 10),
  VCP_API_URL: process.env.VCP_API_URL || 'http://127.0.0.1:6005',
  VCP_API_KEY: process.env.VCP_API_KEY || 'vcp-secret',
  DINGTALK_AGENT_NAME: process.env.DINGTALK_AGENT_NAME || 'Nova',
  // 工作记录存储目录
  WORKLOG_DIR: path.join(__dirname, '..', '..', 'state', 'worklog'),
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
 * 获取今日工作记录
 */
async function getTodayWorkLogs() {
  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(CONFIG.WORKLOG_DIR, `${today}.json`);

  if (!fs.existsSync(logFile)) {
    return [];
  }

  try {
    const data = fs.readFileSync(logFile, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    Logger.warn('读取工作日志失败', { file: logFile, error: error.message });
    return [];
  }
}

/**
 * 获取本周工作记录
 */
async function getWeeklyWorkLogs() {
  const logs = [];
  const now = new Date();
  const dayOfWeek = now.getDay();
  // 计算周一的日期
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);

  // 遍历本周一到周五
  for (let i = 0; i < 5; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const logFile = path.join(CONFIG.WORKLOG_DIR, `${dateStr}.json`);

    if (fs.existsSync(logFile)) {
      try {
        const data = fs.readFileSync(logFile, 'utf-8');
        const dayLogs = JSON.parse(data);
        logs.push({
          date: dateStr,
          logs: dayLogs
        });
      } catch (error) {
        Logger.warn('读取工作日志失败', { file: logFile, error: error.message });
      }
    }
  }

  return logs;
}

/**
 * 保存工作记录
 */
async function saveWorkLog(content, metadata = {}) {
  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(CONFIG.WORKLOG_DIR, `${today}.json`);

  // 确保目录存在
  if (!fs.existsSync(CONFIG.WORKLOG_DIR)) {
    fs.mkdirSync(CONFIG.WORKLOG_DIR, { recursive: true });
  }

  // 读取现有记录
  let logs = [];
  if (fs.existsSync(logFile)) {
    try {
      logs = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
    } catch (e) {
      logs = [];
    }
  }

  // 添加新记录
  logs.push({
    id: Date.now().toString(),
    content: content,
    timestamp: new Date().toISOString(),
    ...metadata
  });

  // 写入文件
  fs.writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf-8');

  return { id: logs[logs.length - 1].id };
}

// ============ VCP 交互 ============

/**
 * 发送消息到 VCP (通过内部 API)
 */
async function sendToVCP(agentName, message, conversationId = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.VCP_API_URL);
    const apiPath = url.pathname === '/' ? '/v1/chat/completions' : url.pathname.replace(/\/$/, '') + '/v1/chat/completions';
    const baseUrl = `${url.protocol}//${url.host}`;

    const body = JSON.stringify({
      model: agentName,
      messages: [{ role: 'user', content: message }],
      agentName: agentName,
      ...(conversationId && { conversationId })
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
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve({ raw: responseData });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * 通过 VCP 发送钉钉消息
 */
async function sendDingTalkMessage(agentName, message) {
  try {
    const response = await sendToVCP(agentName, message);
    Logger.info('VCP 响应', response);
    return response;
  } catch (error) {
    Logger.error('发送钉钉消息失败', { error: error.message });
    throw error;
  }
}

// ============ 日报周报触发 ============

/**
 * 触发日报生成
 */
async function triggerDailyReport() {
  const logs = await getTodayWorkLogs();
  const logCount = logs.length;

  let message = '🦞 日报时间到！\n\n';

  if (logCount === 0) {
    message += '今天还没有工作记录哦~\n';
    message += '今天有什么工作内容需要记录吗？或者回复"无"跳过。';
  } else {
    message += `今天共记录到 ${logCount} 条工作内容：\n\n`;
    message += logs.map((log, i) => `${i + 1}. ${log.content}`).join('\n');
    message += '\n\n请整理成结构化日报格式，确认写入日报吗？需要补充或修改吗？';
  }

  // 通过 VCP 发送到钉钉
  await sendDingTalkMessage(CONFIG.DINGTALK_AGENT_NAME, message);

  return {
    status: 'success',
    result: {
      message: '日报触发成功',
      logCount: logCount,
      hasRecord: logCount > 0
    }
  };
}

/**
 * 触发周报生成
 */
async function triggerWeeklyReport() {
  const weeklyLogs = await getWeeklyWorkLogs();
  const totalLogs = weeklyLogs.reduce((sum, day) => sum + (day.logs?.length || 0), 0);

  let message = '🦞 周报时间到！\n\n';

  if (totalLogs === 0) {
    message += '本周还没有工作记录哦~\n';
    message += '本周有什么工作内容需要补充吗？';
  } else {
    message += `本周共 ${weeklyLogs.length} 天有工作记录，${totalLogs} 条内容：\n\n`;

    weeklyLogs.forEach(day => {
      if (day.logs && day.logs.length > 0) {
        message += `- ${day.date}: ${day.logs.length} 条\n`;
      }
    });

    message += '\n正在生成周报总结...\n';
    message += '请根据本周工作记录生成周报，包含:\n';
    message += '1. 本周工作摘要\n';
    message += '2. 关键数据汇总\n';
    message += '3. 经验教训\n';
    message += '\n确认写入周报吗？';
  }

  // 通过 VCP 发送到钉钉
  await sendDingTalkMessage(CONFIG.DINGTALK_AGENT_NAME, message);

  return {
    status: 'success',
    result: {
      message: '周报触发成功',
      dayCount: weeklyLogs.length,
      totalLogs: totalLogs
    }
  };
}

/**
 * 检查调度状态
 */
function checkSchedule() {
  const now = new Date();
  const dailyTime = CONFIG.DAILY_REPORT_TIME.split(':');
  const weeklyTime = CONFIG.WEEKLY_REPORT_TIME.split(':');

  // 计算下次日报时间
  const nextDaily = new Date();
  nextDaily.setHours(parseInt(dailyTime[0]), parseInt(dailyTime[1]), 0, 0);
  if (nextDaily <= now) {
    nextDaily.setDate(nextDaily.getDate() + 1);
  }

  // 计算下次周报时间
  const nextWeekly = new Date();
  nextWeekly.setHours(parseInt(weeklyTime[0]), parseInt(weeklyTime[1]), 0, 0);
  const daysUntilWeekly = (CONFIG.WEEKLY_REPORT_DAY - nextWeekly.getDay() + 7) % 7;
  if (daysUntilWeekly === 0 && nextWeekly <= now) {
    nextWeekly.setDate(nextWeekly.getDate() + 7);
  } else if (daysUntilWeekly > 0) {
    nextWeekly.setDate(nextWeekly.getDate() + daysUntilWeekly);
  }

  return {
    status: 'success',
    result: {
      currentTime: now.toISOString(),
      dailyReport: {
        scheduledTime: CONFIG.DAILY_REPORT_TIME,
        nextRun: nextDaily.toISOString(),
        enabled: true
      },
      weeklyReport: {
        scheduledDay: CONFIG.WEEKLY_REPORT_DAY,
        scheduledTime: CONFIG.WEEKLY_REPORT_TIME,
        nextRun: nextWeekly.toISOString(),
        enabled: true
      }
    }
  };
}

// ============ 请求处理 ============

async function handleRequest(request) {
  const { action } = request;

  switch (action) {
    case 'trigger_daily_report':
      return await triggerDailyReport();

    case 'trigger_weekly_report':
      return await triggerWeeklyReport();

    case 'check_schedule':
      return checkSchedule();

    case 'save_work_log':
      const { content, metadata } = request;
      if (!content) {
        return { status: 'error', error: '缺少必需参数：content' };
      }
      const result = await saveWorkLog(content, metadata);
      return { status: 'success', result };

    default:
      return { status: 'error', error: `未知操作：${action}` };
  }
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
Logger.info('WorkLogScheduler 插件启动中...');

main();

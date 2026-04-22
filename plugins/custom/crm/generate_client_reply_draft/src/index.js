/**
 * PhotoStudioReplyDraft — 摄影工作室客户沟通草稿插件
 *
 * hybridservice + direct 协议
 * 基于客户+项目上下文生成草稿，缺上下文时降级
 */

const path = require('path');
const store = require(path.join(__dirname, '..', '..', '..', 'shared', 'photo_studio_data', 'PhotoStudioDataStore'));

const VALID_CONTEXT_TYPES = ['quotation', 'schedule', 'delivery', 'general'];
const VALID_TONES = ['formal', 'friendly', 'warm'];

const TONE_GREETINGS = {
  formal: '尊敬的',
  friendly: '你好，',
  warm: '亲爱的'
};

const TONE_CLOSINGS = {
  formal: '此致\n敬礼',
  friendly: '祝好',
  warm: '期待与您的合作'
};

const CONTEXT_TEMPLATES = {
  quotation: {
    subject: '报价方案',
    body: (ctx) => `感谢您对我们摄影服务的关注。关于${ctx.projectName}，我们为您提供以下报价方案：\n\n${ctx.keyPoints}\n\n如需进一步了解详情或有任何疑问，请随时与我们联系。`
  },
  schedule: {
    subject: '档期安排',
    body: (ctx) => `关于${ctx.projectName}的档期安排，${ctx.keyPoints || '目前有以下时间可选'}。\n\n请确认您方便的时间，我们将为您预留档期。`
  },
  delivery: {
    subject: '交付通知',
    body: (ctx) => `${ctx.projectName}的后期处理已完成，${ctx.keyPoints || '成品已准备就绪'}。\n\n我们将尽快安排交付，如有特殊要求请提前告知。`
  },
  general: {
    subject: '沟通事项',
    body: (ctx) => `关于${ctx.projectName}，${ctx.keyPoints || '有以下事项需要与您沟通'}。\n\n期待您的回复。`
  }
};

const PLUGIN_NAME = 'generate_client_reply_draft';
const PLUGIN_VERSION = '1.0.0';

let config = { DebugMode: false };

function _timestamp() {
  return new Date().toISOString();
}

function _meta(extra) {
  return { plugin_name: PLUGIN_NAME, version: PLUGIN_VERSION, timestamp: _timestamp(), ...extra };
}

function _success(data, extraMeta) {
  return { success: true, data, error: null, meta: _meta(extraMeta || {}) };
}

function _error(code, message, field) {
  return { success: false, data: null, error: { code, message, field: field || null }, meta: _meta() };
}

function _validateInput(args) {
  if (!args.project_id || typeof args.project_id !== 'string' || args.project_id.trim() === '') {
    return _error('MISSING_REQUIRED_FIELD', 'project_id is required', 'project_id');
  }
  if (!args.context_type || !VALID_CONTEXT_TYPES.includes(args.context_type)) {
    return _error('INVALID_INPUT', `context_type must be one of: ${VALID_CONTEXT_TYPES.join(', ')}`, 'context_type');
  }
  if (args.tone && !VALID_TONES.includes(args.tone)) {
    return _error('INVALID_INPUT', `tone must be one of: ${VALID_TONES.join(', ')}`, 'tone');
  }
  return null;
}

async function processToolCall(args, executionContext) {
  if (config.DebugMode) {
    console.log(`[${PLUGIN_NAME}] processToolCall called with:`, JSON.stringify(args).substring(0, 300));
  }

  const validationError = _validateInput(args);
  if (validationError) return validationError;

  const projectId = args.project_id.trim();

  // 校验项目存在
  const project = store.getProject(projectId);
  if (!project) {
    return _error('RESOURCE_NOT_FOUND', `项目 ${projectId} 不存在`, 'project_id');
  }

  // 获取客户信息
  let customerId = args.customer_id || project.customer_id;
  let customer = customerId ? store.getCustomer(customerId) : null;

  let degraded = false;
  let customerName = '客户';
  if (customer && customer.customer_name) {
    customerName = customer.customer_name;
  } else {
    degraded = true;
    customerName = '[客户姓名]';
  }

  // 构建草稿上下文
  const tone = args.tone || 'warm';
  const contextType = args.context_type;
  const template = CONTEXT_TEMPLATES[contextType];

  const draftContext = {
    projectName: project.project_name || '[项目名称]',
    keyPoints: args.key_points || ''
  };

  // 组装草稿
  const greeting = TONE_GREETINGS[tone];
  const closing = TONE_CLOSINGS[tone];
  const subjectLine = `[${template.subject}] ${draftContext.projectName}`;
  const bodyContent = template.body(draftContext);

  const draftContent = `${greeting}${customerName}：\n\n${bodyContent}\n\n${closing}\n\n——${draftContext.projectName}·摄影工作室`;

  if (config.DebugMode) {
    console.log(`[${PLUGIN_NAME}] Draft generated for ${projectId}, degraded: ${degraded}`);
  }

  return _success({
    project_id: projectId,
    customer_name: customerName,
    context_type: contextType,
    draft_title: subjectLine,
    draft_body: draftContent,
    draft_content: draftContent,
    subject: subjectLine,
    generation_time: _timestamp()
  }, { degraded });
}

async function initialize(initialConfig, dependencies) {
  config = initialConfig || {};
  if (config.PhotoStudioDataPath) {
    store.configureDataRoot(config.PhotoStudioDataPath);
  }
  if (config.DebugMode) {
    console.log(`[${PLUGIN_NAME}] Initialized. DebugMode: ${config.DebugMode}`);
  }
}

function shutdown() {
  if (config.DebugMode) console.log(`[${PLUGIN_NAME}] Shutdown.`);
}

module.exports = {
  initialize,
  processToolCall,
  shutdown
};

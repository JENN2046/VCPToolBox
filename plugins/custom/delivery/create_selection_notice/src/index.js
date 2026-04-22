const path = require('path');

const store = require(path.join(__dirname, '..', '..', '..', 'shared', 'photo_studio_data', 'PhotoStudioDataStore'));

const VALID_TONES = ['formal', 'friendly', 'warm'];
const ALLOWED_SELECTION_NOTICE_PROJECT_STATUSES = ['shot', 'selection_pending'];
const DEFAULT_SELECTION_METHOD = 'shared online gallery';
const FALLBACK_CUSTOMER_NAME = '[客户姓名]';

const PLUGIN_NAME = 'create_selection_notice';
const PLUGIN_VERSION = '2.0.0';

const TONE_PRESETS = {
  formal: {
    greeting: '您好',
    intro: '当前项目已经进入选片准备阶段。',
    selectionLead: '请在以下时间前完成选片',
    methodLead: '选片方式',
    noteLead: '补充说明',
    closing: '收到您的选片结果后，我们会继续后续精修与交付流程。'
  },
  friendly: {
    greeting: '你好',
    intro: '项目已经准备好进入选片阶段啦。',
    selectionLead: '方便的话请在以下时间前完成选片',
    methodLead: '选片方式',
    noteLead: '小提醒',
    closing: '拿到选片结果后，我们就继续往下一步推进。'
  },
  warm: {
    greeting: '亲爱的',
    intro: '这次项目的选片环节已经准备好了。',
    selectionLead: '等你有空时，请在以下时间前完成选片',
    methodLead: '选片方式',
    noteLead: '给你的备注',
    closing: '感谢配合，收到选片结果后我们会尽快继续后续制作。'
  }
};

let config = { DebugMode: false };

function _timestamp() {
  return new Date().toISOString();
}

function _meta(extra) {
  return {
    plugin_name: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    timestamp: _timestamp(),
    ...extra
  };
}

function _success(data, extraMeta) {
  return {
    success: true,
    data,
    error: null,
    meta: _meta(extraMeta || {})
  };
}

function _error(code, message, field, details) {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      field: field || null,
      details: details || {}
    },
    meta: _meta()
  };
}

function _validateInput(args) {
  if (!args.project_id || typeof args.project_id !== 'string' || args.project_id.trim() === '') {
    return _error('MISSING_REQUIRED_FIELD', 'project_id is required', 'project_id');
  }

  if (args.tone && !VALID_TONES.includes(args.tone)) {
    return _error('INVALID_INPUT', `tone must be one of: ${VALID_TONES.join(', ')}`, 'tone');
  }

  return null;
}

function _buildSelectionNotice({ customerName, projectName, tone, selectionDeadline, selectionMethod, noteToClient }) {
  const preset = TONE_PRESETS[tone] || TONE_PRESETS.warm;
  const deadlineLine = selectionDeadline
    ? `${preset.selectionLead}：${selectionDeadline}`
    : `${preset.selectionLead}。`;

  return [
    `${preset.greeting}${customerName}：`,
    `${preset.intro}\n项目：《${projectName}》。`,
    deadlineLine,
    `${preset.methodLead}：${selectionMethod}。`,
    noteToClient ? `${preset.noteLead}：${noteToClient}` : null,
    preset.closing
  ].filter(Boolean).join('\n\n');
}

async function processToolCall(args) {
  const validationError = _validateInput(args);
  if (validationError) {
    return validationError;
  }

  const projectId = args.project_id.trim();
  const project = store.getProject(projectId);
  if (!project) {
    return _error('RESOURCE_NOT_FOUND', `project ${projectId} not found`, 'project_id');
  }

  if (!ALLOWED_SELECTION_NOTICE_PROJECT_STATUSES.includes(project.status)) {
    return _error(
      'CONFLICT',
      `create_selection_notice requires project status ${ALLOWED_SELECTION_NOTICE_PROJECT_STATUSES.join(' or ')}, received ${project.status}.`,
      'project_id',
      {
        allowed_statuses: ALLOWED_SELECTION_NOTICE_PROJECT_STATUSES,
        project_status: project.status
      }
    );
  }

  const customer = project.customer_id ? store.getCustomer(project.customer_id) : null;
  const degraded = !customer || !customer.customer_name;
  const customerName = degraded ? FALLBACK_CUSTOMER_NAME : customer.customer_name;
  const selectionDeadline = args.selection_deadline || project.delivery_deadline || project.due_date || null;
  const selectionMethod = args.selection_method || DEFAULT_SELECTION_METHOD;
  const tone = args.tone || 'warm';
  const draftTitle = `选片通知 | ${project.project_name}`;
  const draftBody = _buildSelectionNotice({
    customerName,
    projectName: project.project_name,
    tone,
    selectionDeadline,
    selectionMethod,
    noteToClient: args.note_to_client || ''
  });

  return _success({
    project_id: project.project_id,
    customer_name: customerName,
    selection_deadline: selectionDeadline,
    selection_method: selectionMethod,
    draft_title: draftTitle,
    draft_body: draftBody,
    generation_time: _timestamp()
  }, {
    entity: 'selection_notice',
    degraded,
    project_status: project.status
  });
}

async function initialize(initialConfig) {
  config = initialConfig || {};
  if (config.PhotoStudioDataPath) {
    store.configureDataRoot(config.PhotoStudioDataPath);
  }
}

function shutdown() {}

module.exports = {
  ALLOWED_SELECTION_NOTICE_PROJECT_STATUSES,
  initialize,
  processToolCall,
  shutdown
};

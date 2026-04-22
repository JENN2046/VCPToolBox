/**
 * PhotoStudioCustomerRecord — 摄影工作室客户建档插件
 *
 * hybridservice + direct 协议
 * 通过 PhotoStudioDataStore 读写客户数据
 */

const path = require('path');
const store = require(path.join(__dirname, '..', '..', '..', 'shared', 'photo_studio_data', 'PhotoStudioDataStore'));

const VALID_CUSTOMER_TYPES = ['individual', 'corporate'];
const VALID_SOURCES = ['referral', 'social_media', 'returning', 'walk_in', 'other'];

const PLUGIN_NAME = 'create_customer_record';
const PLUGIN_VERSION = '1.0.0';

let config = { DebugMode: false };

function _timestamp() {
  return new Date().toISOString();
}

function _meta() {
  return { plugin_name: PLUGIN_NAME, version: PLUGIN_VERSION, timestamp: _timestamp() };
}

function _success(data) {
  return { success: true, data, error: null, meta: _meta() };
}

function _error(code, message, field) {
  return { success: false, data: null, error: { code, message, field: field || null }, meta: _meta() };
}

function _validateInput(args) {
  if (!args.customer_name || typeof args.customer_name !== 'string' || args.customer_name.trim() === '') {
    return _error('MISSING_REQUIRED_FIELD', 'customer_name is required', 'customer_name');
  }
  if (!args.customer_type || !VALID_CUSTOMER_TYPES.includes(args.customer_type)) {
    return _error('INVALID_INPUT', `customer_type must be one of: ${VALID_CUSTOMER_TYPES.join(', ')}`, 'customer_type');
  }
  if (args.source && !VALID_SOURCES.includes(args.source)) {
    return _error('INVALID_INPUT', `source must be one of: ${VALID_SOURCES.join(', ')}`, 'source');
  }
  return null;
}

/**
 * processToolCall — hybridservice 直接调用入口
 */
async function processToolCall(args, executionContext) {
  if (config.DebugMode) {
    console.log(`[${PLUGIN_NAME}] processToolCall called with:`, JSON.stringify(args).substring(0, 200));
  }

  // 输入校验
  const validationError = _validateInput(args);
  if (validationError) return validationError;

  // 查重: customer_name + (contact_phone 或 contact_wechat)
  const phone = args.contact_phone || '';
  const wechat = args.contact_wechat || '';
  const email = args.contact_email || '';
  const existing = store.findCustomerByNameAndContact(args.customer_name.trim(), phone, wechat, email);
  if (existing) {
    if (config.DebugMode) console.log(`[${PLUGIN_NAME}] Duplicate customer found: ${existing.customer_id}`);
    return {
      success: false,
      data: {
        customer_id: existing.customer_id,
        customer_name: existing.customer_name,
        customer_type: existing.customer_type,
        is_new: false
      },
      error: { code: 'CONFLICT', message: '客户已存在', field: 'customer_name' },
      meta: _meta()
    };
  }

  // 建档
  const customerData = {
    customer_name: args.customer_name.trim(),
    customer_type: args.customer_type,
    contact_phone: phone,
    contact_wechat: wechat,
    contact_email: email,
    source: args.source || 'other',
    source_channel: args.source_channel || args.source || 'other',
    project_type_preference: args.project_type_preference || '',
    budget_range: args.budget_range || '',
    notes: args.notes || args.remark || '',
    remark: args.remark || args.notes || ''
  };

  try {
    const record = store.createCustomer(customerData);
    if (config.DebugMode) console.log(`[${PLUGIN_NAME}] Customer created: ${record.customer_id}`);
    return _success({
      customer_id: record.customer_id,
      customer_name: record.customer_name,
      customer_type: record.customer_type,
      contact_value: record.contact_value,
      normalized_contact_key: record.normalized_contact_key,
      status: record.status,
      is_new: true,
      created_at: record.created_at
    });
  } catch (e) {
    console.error(`[${PLUGIN_NAME}] Error creating customer:`, e.message);
    return _error('UNKNOWN_ERROR', e.message);
  }
}

/**
 * initialize — 插件初始化 (PluginManager 调用)
 */
async function initialize(initialConfig, dependencies) {
  config = initialConfig || {};
  if (config.PhotoStudioDataPath) {
    store.configureDataRoot(config.PhotoStudioDataPath);
  }
  if (config.DebugMode) {
    console.log(`[${PLUGIN_NAME}] Initialized. DebugMode: ${config.DebugMode}`);
  }
}

/**
 * shutdown — 插件关闭
 */
function shutdown() {
  if (config.DebugMode) console.log(`[${PLUGIN_NAME}] Shutdown.`);
}

module.exports = {
  initialize,
  processToolCall,
  shutdown
};

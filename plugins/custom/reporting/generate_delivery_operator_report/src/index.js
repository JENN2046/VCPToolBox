const path = require('path');

const store = require(path.join(__dirname, '..', '..', '..', 'shared', 'photo_studio_data', 'PhotoStudioDataStore'));
const service = require(path.join(__dirname, '..', '..', '..', 'shared', 'photo_studio_data', 'DeliveryReportingService'));

const PLUGIN_NAME = 'generate_delivery_operator_report';
const PLUGIN_VERSION = '2.0.0';

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

async function processToolCall(args) {
  try {
    const data = service.generateDeliveryOperatorReport(args || {});
    return _success(data, {
      entity: 'delivery_operator_report',
      sync_mode: 'local_shadow',
      matched_records: data.summary.total_records,
      stalled_count: data.summary.stalled_count
    });
  } catch (error) {
    return _error(
      error.code || 'INTERNAL_ERROR',
      error.message || 'Failed to generate delivery operator report.',
      error.field || null,
      error.details || {}
    );
  }
}

async function initialize(initialConfig) {
  config = initialConfig || {};
  if (config.PhotoStudioDataPath) {
    store.configureDataRoot(config.PhotoStudioDataPath);
  }
}

function shutdown() {}

module.exports = {
  initialize,
  processToolCall,
  shutdown
};

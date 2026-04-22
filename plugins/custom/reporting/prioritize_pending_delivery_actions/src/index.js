const path = require('path');

const store = require(path.join(__dirname, '..', '..', '..', 'shared', 'photo_studio_data', 'PhotoStudioDataStore'));
const service = require(path.join(__dirname, '..', '..', '..', 'shared', 'photo_studio_data', 'DeliverySchedulingService'));

const PLUGIN_NAME = 'prioritize_pending_delivery_actions';
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
    const data = service.prioritizePendingDeliveryActions(args || {});
    return _success(data, {
      entity: 'delivery_queue_priority',
      sync_mode: 'local_shadow',
      matched_records: data.summary.total_records,
      priority_items: data.summary.priority_items
    });
  } catch (error) {
    return _error(
      error.code || 'INTERNAL_ERROR',
      error.message || 'Failed to prioritize pending delivery actions.',
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

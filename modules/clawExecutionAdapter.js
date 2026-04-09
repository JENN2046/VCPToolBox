/**
 * clawExecutionAdapter - Stub module
 *
 * Placeholder for the external claw-code integration.
 * Provides no-op implementations so the server can start
 * without the actual claw-code dependency installed.
 */

let injectedLogFunctions = null;

function injectVcpLogFunctions(logFunctions) {
  injectedLogFunctions = logFunctions;
}

async function startTask(options) {
  return { success: false, error: 'clawExecutionAdapter not installed' };
}

async function getStatus(taskId) {
  return null;
}

async function getStatusByTopic(topic) {
  return null;
}

async function stopTask(taskId) {
  return { success: false, error: 'clawExecutionAdapter not installed' };
}

function injectTopicHooks() {
  // no-op
}

module.exports = {
  startTask,
  getStatus,
  getStatusByTopic,
  stopTask,
  injectVcpLogFunctions,
  injectTopicHooks,
};

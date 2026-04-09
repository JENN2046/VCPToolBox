/**
 * OneBot Adapter 的 SessionBindingStore 集成
 *
 * 提供会话绑定的持久化存储，支持进程重启后会话恢复
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// 使用 CommonJS 方式导入 SessionBindingStore（因为它是 CommonJS 模块）
const SessionBindingStore = require('../../../../modules/channelHub/SessionBindingStore.js');
const StateStore = require('../../../../modules/channelHub/StateStore.js');

/**
 * 创建带 SessionBindingStore 的消息管道增强器
 * @param {Object} options - 配置选项
 * @param {Object} options.logger - 日志器
 * @param {boolean} options.debugMode - 调试模式
 * @returns {Object} SessionBindingStore 实例及装饰器方法
 */
export function createSessionBindingEnhancer({
  logger = console,
  debugMode = false,
} = {}) {
  const stateStore = new StateStore({
    baseDir: process.cwd(),
    debugMode,
  });

  const sessionBindingStore = new SessionBindingStore({
    stateStore,
    debugMode,
  });

  let initialized = false;

  /**
   * 初始化 SessionBindingStore
   */
  async function initialize() {
    if (initialized) return;

    logger.info('[SessionBinding] Initializing...');
    await stateStore.initialize();
    await sessionBindingStore.initialize();
    initialized = true;
    logger.info('[SessionBinding] Initialized successfully');
  }

  /**
   * 获取或创建会话绑定
   * @param {Object} envelope - ChannelEventEnvelope
   * @returns {Promise<Object>} 绑定记录
   */
  async function getOrCreateBinding(envelope) {
    if (!initialized) {
      await initialize();
    }

    try {
      const binding = await sessionBindingStore.resolveBinding(envelope);
      return binding;
    } catch (error) {
      logger.error('[SessionBinding] Failed to resolve binding:', error);
      // 返回内存中的临时绑定
      return {
        bindingKey: envelope.session?.bindingKey || `temp:${Date.now()}`,
        externalSessionKey: envelope.session?.externalSessionKey || null,
        topicId: envelope.session?.currentTopicId || null,
        agentId: envelope.target?.agentId || null,
        isTemporary: true,
      };
    }
  }

  /**
   * 更新会话活跃时间
   * @param {string} bindingKey - 绑定键
   */
  async function touchSession(bindingKey) {
    if (!initialized) return;

    try {
      await sessionBindingStore.touchSession(bindingKey);
    } catch (error) {
      logger.debug('[SessionBinding] Failed to touch session:', error);
    }
  }

  /**
   * 绑定会话
   * @param {Object} record - 绑定记录
   */
  async function bindSession(record) {
    if (!initialized) return;

    try {
      await sessionBindingStore.bindSession(record);
    } catch (error) {
      logger.error('[SessionBinding] Failed to bind session:', error);
    }
  }

  /**
   * 查询会话绑定
   * @param {Object} filter - 过滤条件
   * @returns {Promise<Array>} 绑定记录列表
   */
  async function queryBindings(filter = {}) {
    if (!initialized) {
      await initialize();
    }

    try {
      return await sessionBindingStore.queryBindings(filter);
    } catch (error) {
      logger.error('[SessionBinding] Failed to query bindings:', error);
      return [];
    }
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  function getStats() {
    return {
      initialized,
      cacheSize: sessionBindingStore.cache?.size || 0,
    };
  }

  return {
    initialize,
    getOrCreateBinding,
    touchSession,
    bindSession,
    queryBindings,
    getStats,
  };
}

export default createSessionBindingEnhancer;

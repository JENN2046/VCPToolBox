/**
 * 主动消息发送器
 *
 * 支持 AI 代理主动向 QQ 用户/群组发送消息
 * 适用于：定时任务、事件触发、告警通知等场景
 */

/**
 * 创建主动消息发送器
 * @param {Object} options - 配置选项
 * @param {Object} options.onebotClient - OneBot 客户端
 * @param {Object} options.logger - 日志器
 */
export function createProactiveSender({ onebotClient, logger = console }) {
  /**
   * 发送私聊消息
   * @param {number} userId - 用户 QQ 号
   * @param {string|Array} content - 消息内容（文本或消息段数组）
   * @returns {Promise<Object>} 发送结果
   */
  async function sendPrivateMessage(userId, content) {
    try {
      const message = typeof content === 'string'
        ? [{ type: 'text', data: { text: content } }]
        : content;

      const result = await onebotClient.sendPrivateMessage(userId, message);
      logger.info('[proactive] Private message sent:', { userId, messageId: result?.message_id });
      return { success: true, messageId: result?.message_id, type: 'private' };
    } catch (error) {
      logger.error('[proactive] Failed to send private message:', error);
      return { success: false, error: error.message, type: 'private' };
    }
  }

  /**
   * 发送群消息
   * @param {number} groupId - 群号
   * @param {string|Array} content - 消息内容
   * @returns {Promise<Object>} 发送结果
   */
  async function sendGroupMessage(groupId, content) {
    try {
      const message = typeof content === 'string'
        ? [{ type: 'text', data: { text: content } }]
        : content;

      const result = await onebotClient.sendGroupMessage(groupId, message);
      logger.info('[proactive] Group message sent:', { groupId, messageId: result?.message_id });
      return { success: true, messageId: result?.message_id, type: 'group' };
    } catch (error) {
      logger.error('[proactive] Failed to send group message:', error);
      return { success: false, error: error.message, type: 'group' };
    }
  }

  /**
   * 发送群消息（@全体成员）
   * @param {number} groupId - 群号
   * @param {string} content - 消息内容
   * @returns {Promise<Object>} 发送结果
   */
  async function sendGroupAtAll(groupId, content) {
    const message = [
      { type: 'at', data: { qq: 'all' } },
      { type: 'text', data: { text: ' ' + content } }
    ];
    return sendGroupMessage(groupId, message);
  }

  /**
   * 发送群消息（@指定用户）
   * @param {number} groupId - 群号
   * @param {number} userId - 要 @ 的用户 QQ 号
   * @param {string} content - 消息内容
   * @returns {Promise<Object>} 发送结果
   */
  async function sendGroupAtUser(groupId, userId, content) {
    const message = [
      { type: 'at', data: { qq: userId } },
      { type: 'text', data: { text: ' ' + content } }
    ];
    return sendGroupMessage(groupId, message);
  }

  /**
   * 批量发送消息（带限流）
   * @param {Array} targets - 目标列表 [{type: 'private'|'group', id: number}]
   * @param {string|Array} content - 消息内容
   * @param {number} interval - 发送间隔（毫秒）
   * @returns {Promise<Array>} 发送结果
   */
  async function sendBatch(targets, content, interval = 1000) {
    const results = [];
    for (const target of targets) {
      try {
        let result;
        if (target.type === 'private') {
          result = await sendPrivateMessage(target.id, content);
        } else if (target.type === 'group') {
          result = await sendGroupMessage(target.id, content);
        }
        results.push(result);

        // 限流
        if (interval > 0) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      } catch (error) {
        results.push({ success: false, error: error.message, target });
      }
    }
    return results;
  }

  /**
   * 发送图片消息
   * @param {string} type - 'private' 或 'group'
   * @param {number} targetId - 用户 ID 或群 ID
   * @param {string} imageUrl - 图片 URL 或本地路径
   * @returns {Promise<Object>} 发送结果
   */
  async function sendImage(type, targetId, imageUrl) {
    const message = [{ type: 'image', data: { file: imageUrl } }];
    if (type === 'private') {
      return sendPrivateMessage(targetId, message);
    } else {
      return sendGroupMessage(targetId, message);
    }
  }

  return {
    sendPrivateMessage,
    sendGroupMessage,
    sendGroupAtAll,
    sendGroupAtUser,
    sendBatch,
    sendImage,
  };
}

export default createProactiveSender;

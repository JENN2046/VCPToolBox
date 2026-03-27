/**
 * modules/channelHub/AdapterContract.js
 *
 * Adapter Contract Standard
 *
 * 定义平台适配器必须实现的标准接口契约。
 * VCP 核心层只依赖契约，不依赖平台实现细节。
 *
 * 契约分为两部分：
 * 1. Meta - 元信息（同步，无需异步调用）
 * 2. Codec - 编解码器（处理入站/出站消息）
 * 3. Transport - 传输层（发送消息到平台）
 * 4. Health - 健康检查（诊断）
 *
 * 参考文档：docs/interaction-middleware/VCP_INTERACTION_MIDDLEWARE_SCHEMA.md 第 7 节
 */

const { AdapterContractError } = require('./errors');

// ==================== 类型定义 ====================

/**
 * @typedef {Object} AdapterMetadata
 * @property {string} id - 适配器唯一标识
 * @property {string} channel - 平台类型 (dingtalk, wecom, feishu, qq, wechat)
 * @property {string} displayName - 适配器显示名称
 * @property {string} transportMode - 传输模式 (forward_ws, reverse_ws, http_webhook, polling, internal)
 * @property {string} sessionGrammar - 会话键语法规则 (e.g., "onebot:{conversationType}:{conversationId}")
 * @property {Object} capabilities - 能力矩阵
 */

/**
 * @typedef {Object} CapabilityProfile
 * @property {boolean} supportsText - 支持文本消息
 * @property {boolean} supportsMarkdown - 支持 Markdown
 * @property {boolean} supportsImage - 支持图片
 * @property {boolean} supportsAudio - 支持音频
 * @property {boolean} supportsVideo - 支持视频
 * @property {boolean} supportsFile - 支持文件
 * @property {boolean} supportsCard - 支持卡片消息
 * @property {boolean} supportsAction - 支持动作按钮
 * @property {boolean} supportsQuoteReply - 支持引用回复
 * @property {boolean} supportsForwardMessage - 支持转发消息
 * @property {boolean} supportsStreaming - 支持流式消息
 * @property {boolean} supportsGroupChat - 支持群聊
 * @property {boolean} supportsPrivateChat - 支持私聊
 * @property {boolean} supportsThread - 支持线程
 * @property {boolean} supportsProactivePush - 支持主动推送
 * @property {number} maxMessageLength - 最大消息长度
 * @property {number} maxMediaSize - 最大媒体文件大小（字节）
 */

/**
 * @typedef {Object} PlatformMessage
 * 平台原生消息格式（由 encodeOutbound 生成）
 * 具体结构由各适配器定义
 */

/**
 * @typedef {Object} SessionDescriptor
 * 会话描述符（出站投递使用）
 * @property {string} bindingKey - VCP 内部绑定键
 * @property {string} externalSessionKey - 平台原生会话键
 * @property {string} adapterId - 适配器ID
 * @property {string} channel - 平台类型
 * @property {string} conversationId - 会话ID
 * @property {string} conversationType - 会话类型 (private/group/channel)
 * @property {string} userId - 用户ID（可选）
 * @property {string} [topicId] - 主题ID（可选）
 * @property {string} [agentId] - Agent ID（可选）
 */

/**
 * @typedef {Object} AdapterContext
 * 适配器上下文
 * @property {string} traceId - 追踪ID
 * @property {Object} [headers] - 原始请求头（仅入站时使用）
 * @property {string} [sourceIp] - 来源IP（仅鉴权时使用）
 */

// ==================== 标准错误 ====================

class AdapterContractError extends AdapterContractError {
  constructor(message, options = {}) {
    super(message, {
      code: 'ADAPTER_CONTRACT_ERROR',
      httpStatus: 500,
      ...options
    });
    this.name = 'AdapterContractError';
  }
}

class UnsupportedCapabilityError extends AdapterContractError {
  constructor(capability, adapterId) {
    super(`Adapter ${adapterId} does not support capability: ${capability}`, {
      code: 'UNSUPPORTED_CAPABILITY',
      httpStatus: 500,
      details: { capability, adapterId },
      retryable: false
    });
    this.name = 'UnsupportedCapabilityError';
  }
}

class AdapterNotImplementedError extends AdapterContractError {
  constructor(methodName, adapterId) {
    super(`Adapter ${adapterId} does not implement required method: ${methodName}`, {
      code: 'METHOD_NOT_IMPLEMENTED',
      httpStatus: 500,
      details: { method: methodName, adapterId },
      retryable: false
    });
    this.name = 'AdapterNotImplementedError';
  }
}

// ==================== Adapter Contract 接口 ====================

/**
 * 适配器契约基类
 *
 * 所有平台适配器必须实现以下接口：
 *
 * 1. 元信息方法（同步）
 *    - getMetadata()
 *    - getCapabilities()
 *
 * 2. 安全方法
 *    - authenticate(requestContext)
 *    - verifySignature(requestContext)
 *
 * 3. 编解码方法
 *    - decodeInbound(rawPayload, context) -> Event
 *    - encodeOutbound(reply, context) -> PlatformMessage[]
 *
 * 4. 传输方法
 *    - sendBySession(sessionDescriptor, platformMessages, context)
 *
 * 5. 诊断方法
 *    - healthCheck()
 *    - getStats()
 */
class AdapterContract {
  /**
   * @param {AdapterMetadata} metadata - 适配器元信息
   */
  constructor(metadata) {
    if (!metadata?.id) {
      throw new AdapterContractError('Adapter metadata must include id');
    }
    if (!metadata?.channel) {
      throw new AdapterContractError('Adapter metadata must include channel');
    }

    this._metadata = metadata;
    this._capabilities = metadata.capabilities || {};
    this._stats = {
      messagesIn: 0,
      messagesOut: 0,
      successes: 0,
      failures: 0,
      lastActivityAt: null
    };
    this._initialized = false;
  }

  // ==================== 元信息方法 ====================

  /**
   * 获取适配器元信息（同步）
   * @returns {AdapterMetadata}
   */
  getMetadata() {
    return { ...this._metadata };
  }

  /**
   * 获取适配器能力矩阵（同步）
   * @returns {CapabilityProfile}
   */
  getCapabilities() {
    return { ...this._capabilities };
  }

  /**
   * 检查是否支持某能力（同步）
   * @param {string} capability - 能力名称
   * @returns {boolean}
   */
  supports(capability) {
    return this._capabilities[capability] === true;
  }

  /**
   * 断言支持某能力（抛出错误如果不支持）
   * @param {string} capability - 能力名称
   * @throws {UnsupportedCapabilityError}
   */
  assertSupports(capability) {
    if (!this.supports(capability)) {
      throw new UnsupportedCapabilityError(capability, this._metadata.id);
    }
  }

  // ==================== 安全方法 ====================

  /**
   * 适配器级鉴权（认证）
   * 检查请求来源是否合法（IP白名单、适配器密钥等）
   *
   * @param {Object} requestContext - 请求上下文
   * @param {Object} [requestContext.headers] - 请求头
   * @param {string} [requestContext.sourceIp] - 来源IP
   * @returns {Promise<{authenticated: boolean, adapterId?: string, error?: string}>}
   */
  async authenticate(requestContext = {}) {
    // 默认实现：允许所有（由 AdapterAuthManager 处理）
    // 子类可以重写以实现更严格的认证
    return { authenticated: true, adapterId: this._metadata.id };
  }

  /**
   * 平台签名验证
   * 验证平台回调的签名（防篡改、防重放）
   *
   * @param {Object} requestContext - 请求上下文
   * @param {Object} [requestContext.headers] - 请求头
   * @param {string|Buffer} [requestContext.rawBody] - 原始请求体
   * @param {string} [requestContext.timestamp] - 时间戳
   * @param {string} [requestContext.nonce] - 随机串
   * @param {string} [requestContext.signature] - 签名
   * @returns {Promise<{valid: boolean, reason?: string}>}
   */
  async verifySignature(requestContext = {}) {
    // 默认实现：跳过签名验证（由 SignatureValidator 统一处理）
    // 子类可以重写以实现平台特定的签名验证
    return { valid: true };
  }

  // ==================== 编解码方法 ====================

  /**
   * 解码入站消息（平台原始 payload -> 标准 Event）
   *
   * @param {*} rawPayload - 平台原始 payload
   * @param {AdapterContext} context - 上下文
   * @returns {Promise<Object>} 标准 Event 对象
   *
   * Event 结构参考：docs/interaction-middleware/VCP_INTERACTION_MIDDLEWARE_SCHEMA.md 第 3 节
   */
  async decodeInbound(rawPayload, context = {}) {
    throw new AdapterNotImplementedError('decodeInbound', this._metadata.id);
  }

  /**
   * 编码出站消息（标准 NormalizedReply -> 平台原生消息）
   *
   * @param {Object} reply - 标准 NormalizedReply
   * @param {AdapterContext} context - 上下文
   * @returns {Promise<PlatformMessage[]>} 平台原生消息数组
   *
   * NormalizedReply 结构参考：docs/interaction-middleware/VCP_INTERACTION_MIDDLEWARE_SCHEMA.md 第 5 节
   */
  async encodeOutbound(reply, context = {}) {
    throw new AdapterNotImplementedError('encodeOutbound', this._metadata.id);
  }

  // ==================== 传输方法 ====================

  /**
   * 通过会话发送消息
   *
   * @param {SessionDescriptor} sessionDescriptor - 会话描述符
   * @param {PlatformMessage[]} platformMessages - 平台原生消息数组
   * @param {AdapterContext} context - 上下文
   * @returns {Promise<Object>} 发送结果
   *
   * SessionDescriptor 结构参考：docs/interaction-middleware/VCP_INTERACTION_MIDDLEWARE_SCHEMA.md 第 4 节
   */
  async sendBySession(sessionDescriptor, platformMessages, context = {}) {
    throw new AdapterNotImplementedError('sendBySession', this._metadata.id);
  }

  /**
   * 通过Conversation ID发送消息（备用方法）
   *
   * @param {string} conversationId - 会话ID
   * @param {string} conversationType - 会话类型
   * @param {PlatformMessage[]} platformMessages - 平台原生消息数组
   * @param {AdapterContext} context - 上下文
   * @returns {Promise<Object>} 发送结果
   */
  async sendByConversationId(conversationId, conversationType, platformMessages, context = {}) {
    // 默认实现：调用 sendBySession
    const sessionDescriptor = {
      bindingKey: `${this._metadata.channel}:${conversationType}:${conversationId}`,
      externalSessionKey: `${this._metadata.sessionGrammar || this._metadata.channel}:${conversationType}:${conversationId}`,
      adapterId: this._metadata.id,
      channel: this._metadata.channel,
      conversationId,
      conversationType
    };
    return this.sendBySession(sessionDescriptor, platformMessages, context);
  }

  // ==================== 诊断方法 ====================

  /**
   * 健康检查
   * @returns {Promise<{healthy: boolean, [key: string]: any}>}
   */
  async healthCheck() {
    return { healthy: true, adapterId: this._metadata.id };
  }

  /**
   * 获取适配器统计信息
   * @returns {Object}
   */
  getStats() {
    return { ...this._stats };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this._stats = {
      messagesIn: 0,
      messagesOut: 0,
      successes: 0,
      failures: 0,
      lastActivityAt: null
    };
  }

  // ==================== 统计辅助方法 ====================

  /**
   * 记录入站消息
   */
  recordInbound() {
    this._stats.messagesIn += 1;
    this._stats.lastActivityAt = Date.now();
  }

  /**
   * 记录出站消息
   * @param {number} count - 消息数量
   * @param {boolean} success - 是否成功
   */
  recordOutbound(count = 1, success = true) {
    this._stats.messagesOut += count;
    this._stats.lastActivityAt = Date.now();
    if (success) {
      this._stats.successes += count;
    } else {
      this._stats.failures += count;
    }
  }

  // ==================== 生命周期 ====================

  /**
   * 初始化适配器
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) return;
    this._initialized = true;
    this._stats.createdAt = Date.now();
  }

  /**
   * 关闭适配器
   * @returns {Promise<void>}
   */
  async shutdown() {
    this._initialized = false;
  }

  /**
   * 检查是否已初始化
   * @returns {boolean}
   */
  isInitialized() {
    return this._initialized;
  }
}

// ==================== 工具函数 ====================

/**
 * 验证适配器是否实现了所有必需方法
 * @param {AdapterContract} adapter - 适配器实例
 * @returns {Promise<{valid: boolean, missing?: string[], errors?: Object}>}
 */
async function validateAdapterContract(adapter) {
  const requiredMethods = [
    'decodeInbound',
    'encodeOutbound',
    'sendBySession'
  ];

  const errors = {};
  const missing = [];

  for (const method of requiredMethods) {
    if (typeof adapter[method] !== 'function') {
      missing.push(method);
      errors[method] = 'Method not implemented';
    }
  }

  // 验证必需的元信息
  const metadata = adapter.getMetadata();
  const requiredMetaFields = ['id', 'channel', 'displayName', 'transportMode'];

  for (const field of requiredMetaFields) {
    if (!metadata[field]) {
      errors[`metadata.${field}`] = 'Missing required field';
      missing.push(`metadata.${field}`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    errors
  };
}

/**
 * 创建标准化的出站消息（辅助函数）
 * @param {Object} options
 * @returns {PlatformMessage}
 */
function createPlatformMessage(options = {}) {
  return {
    messageId: options.messageId || null,
    type: options.type || 'text',
    content: options.content || '',
    metadata: options.metadata || {}
  };
}

// ==================== 默认实现（可作为基类） ====================

/**
 * HTTP Webhook 模式适配器基类
 * 适用于钉钉、企业微信、飞书等 webhook 模式
 */
class HttpWebhookAdapterBase extends AdapterContract {
  constructor(metadata) {
    super(metadata);
    this.transportMode = 'http_webhook';
  }

  /**
   * 解码入站消息（Webhook 模式）
   * 预处理：提取必要的字段
   */
  async decodeInbound(rawPayload, context = {}) {
    this.recordInbound();

    if (!rawPayload) {
      throw new AdapterContractError('Empty payload', {
        code: 'EMPTY_PAYLOAD',
        adapterId: this._metadata.id
      });
    }

    // 提取基础字段
    const eventId = this._extractEventId(rawPayload);
    const eventType = this._extractEventType(rawPayload);
    const occurredAt = this._extractOccurredAt(rawPayload);

    return {
      version: '2.0',
      eventId,
      adapterId: this._metadata.id,
      channel: this._metadata.channel,
      eventType,
      occurredAt,
      traceId: context.traceId || null,
      sender: this._extractSender(rawPayload),
      client: this._extractClient(rawPayload),
      session: this._extractSession(rawPayload),
      payload: this._extractPayload(rawPayload),
      target: this._extractTarget(rawPayload),
      runtime: this._extractRuntime(rawPayload),
      metadata: {
        platformData: this._extractPlatformData(rawPayload),
        raw: rawPayload,
        sourceIp: context.sourceIp || null
      }
    };
  }

  /**
   * 编码出站消息（Webhook 模式）
   * 预处理：根据能力降级
   */
  async encodeOutbound(reply, context = {}) {
    this.recordOutbound(reply.messages?.length || 1);

    const messages = [];

    for (const msg of reply.messages || []) {
      for (const part of msg.content || []) {
        const message = await this._encodeContentPart(part, context);
        if (message) {
          messages.push(message);
        }
      }
    }

    // 如果没有消息（全部被降级），生成兜底消息
    if (messages.length === 0) {
      messages.push({
        type: 'text',
        content: '[无法发送的消息：平台能力不足]'
      });
    }

    return messages;
  }

  // ==================== 消息发送（Webhook 模式） ====================

  async sendBySession(sessionDescriptor, platformMessages, context = {}) {
    this.recordOutbound(platformMessages.length);

    if (!platformMessages || platformMessages.length === 0) {
      throw new AdapterContractError('No messages to send', {
        code: 'EMPTY_MESSAGES',
        adapterId: this._metadata.id
      });
    }

    // 根据会话类型选择发送方法
    const { conversationId, conversationType } = sessionDescriptor;
    let result;

    if (conversationType === 'private') {
      result = await this._sendToPrivateChat(conversationId, platformMessages, context);
    } else if (conversationType === 'group') {
      result = await this._sendToGroupChat(conversationId, platformMessages, context);
    } else {
      result = await this._sendToConversation(conversationId, conversationType, platformMessages, context);
    }

    return {
      success: true,
      messageId: result?.messageId || null,
      sentAt: Date.now()
    };
  }

  // ==================== 需要子类实现的抽象方法 ====================

  /**
   * 提取消息ID
   */
  _extractEventId(rawPayload) {
    return rawPayload?.msgId || rawPayload?.messageId || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 提取事件类型
   */
  _extractEventType(rawPayload) {
    return 'message.created';
  }

  /**
   * 提取时间戳
   */
  _extractOccurredAt(rawPayload) {
    return rawPayload?.timestamp || Date.now();
  }

  /**
   * 提取发送方信息
   */
  _extractSender(rawPayload) {
    return {
      userId: rawPayload?.senderStaffId || rawPayload?.senderId || 'unknown',
      nick: rawPayload?.senderNick || 'User',
      displayName: rawPayload?.senderNick || 'User',
      isAdmin: Boolean(rawPayload?.isAdmin),
      roles: ['user'],
      tenantId: null,
      organizationId: null
    };
  }

  /**
   * 提取客户端信息
   */
  _extractClient(rawPayload) {
    return {
      clientType: this._metadata.channel,
      conversationId: rawPayload?.conversationId || rawPayload?.cid || '',
      conversationType: this._normalizeConversationType(rawPayload?.conversation?.conversationType || rawPayload?.chatType || rawPayload?.conversationType),
      messageId: rawPayload?.msgId || rawPayload?.messageId || null,
      messageThreadId: null,
      replyToMessageId: null
    };
  }

  /**
   * 提取会话信息
   */
  _extractSession(rawPayload) {
    const cid = rawPayload?.conversationId || rawPayload?.cid || '';
    const ctype = this._normalizeConversationType(rawPayload?.conversation?.conversationType || rawPayload?.chatType || rawPayload?.conversationType);
    const uid = rawPayload?.senderStaffId || rawPayload?.senderId || '';

    return {
      externalSessionKey: `${this._metadata.channel}:${ctype}:${cid}`,
      bindingKey: uid ? `${this._metadata.channel}:${ctype}:${cid}:${uid}` : `${this._metadata.channel}:${ctype}:${cid}`,
      currentTopicId: null,
      allowCreateTopic: true,
      allowSwitchTopic: true
    };
  }

  /**
   * 提取payload
   */
  _extractPayload(rawPayload) {
    return {
      messages: [
        {
          role: 'user',
          content: this._extractContent(rawPayload)
        }
      ]
    };
  }

  /**
   * 提取target
   */
  _extractTarget(rawPayload) {
    return null; // 由路由层解析
  }

  /**
   * 提取runtime
   */
  _extractRuntime(rawPayload) {
    return {
      stream: false,
      model: null,
      timeoutMs: 120000,
      overrides: {}
    };
  }

  /**
   * 提取平台原始数据
   */
  _extractPlatformData(rawPayload) {
    return rawPayload;
  }

  /**
   * 解析内容
   */
  _extractContent(rawPayload) {
    const text = rawPayload?.text?.content || rawPayload?.content || rawPayload?.msgContent?.text || '';

    return [{
      type: 'text',
      text: String(text || '').trim()
    }];
  }

  /**
   * 归一化会话类型
   */
  _normalizeConversationType(type) {
    if (!type) return 'group';
    const t = String(type).toLowerCase();
    if (t.includes('single') || t.includes('private') || t === '1') return 'private';
    if (t.includes('group') || t.includes('chat') || t === '2') return 'group';
    if (t.includes('channel')) return 'channel';
    return 'group';
  }

  /**
   * 编码内容部分
   */
  async _encodeContentPart(part, context) {
    switch (part.type) {
      case 'text':
        return {
          type: 'text',
          content: part.text || ''
        };
      case 'image_url':
        return {
          type: 'image',
          url: part.image_url?.url,
          fileName: part.image_url?.fileName || null
        };
      case 'file':
        return {
          type: 'file',
          url: part.url,
          fileName: part.fileName || null
        };
      default:
        // 不支持的类型，返回 null 表示降级
        return null;
    }
  }

  /**
   * 发送到私聊
   */
  async _sendToPrivateChat(conversationId, platformMessages, context) {
    throw new AdapterNotImplementedError('_sendToPrivateChat', this._metadata.id);
  }

  /**
   * 发送到群聊
   */
  async _sendToGroupChat(conversationId, platformMessages, context) {
    throw new AdapterNotImplementedError('_sendToGroupChat', this._metadata.id);
  }

  /**
   * 发送到会话（通用）
   */
  async _sendToConversation(conversationId, conversationType, platformMessages, context) {
    throw new AdapterNotImplementedError('_sendToConversation', this._metadata.id);
  }
}

/**
 * 构建适配器实例的工厂函数
 * @param {Object} config - 适配器配置
 * @returns {AdapterContract}
 */
function createAdapter(config) {
  const { adapterClass, metadata, options = {} } = config;

  if (!adapterClass) {
    throw new AdapterContractError('adapterClass is required');
  }

  if (!metadata?.id) {
    throw new AdapterContractError('metadata.id is required');
  }

  if (!metadata?.channel) {
    throw new AdapterContractError('metadata.channel is required');
  }

  const adapter = new adapterClass(metadata, options);

  return adapter;
}

// ==================== 导出 ====================

module.exports = {
  // 接口类
  AdapterContract,
  HttpWebhookAdapterBase,

  // 工厂函数
  createAdapter,
  validateAdapterContract,

  // 工具函数
  createPlatformMessage,

  // 错误类
  AdapterContractError,
  UnsupportedCapabilityError,
  AdapterNotImplementedError,

  // 类型定义
  AdapterMetadata: /** @type {AdapterMetadata} */ ({}),
  CapabilityProfile: /** @type {CapabilityProfile} */ ({}),
  PlatformMessage: /** @type {PlatformMessage} */ ({}),
  SessionDescriptor: /** @type {SessionDescriptor} */ ({}),
  AdapterContext: /** @type {AdapterContext} */ ({})
};

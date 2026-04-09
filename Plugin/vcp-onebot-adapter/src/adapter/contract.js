/**
 * OneBot 适配器实现 VCP 适配器合约
 *
 * 实现 VCP AdapterContract 标准接口，用于 OneBot (QQ) 集成
 * 使用 OneBot 11 WebSocket 协议，通过 go-cqhttp、NapCat、LLOneBot 等实现
 *
 * 参考文档：docs/interaction-middleware/VCP_INTERACTION_MIDDLEWARE_SCHEMA.md
 * OneBot 11 协议：https://github.com/botuniverse/onebot-11
 */

import { createOneBotClient } from '../adapters/onebot/client.js';
import WebSocket from 'ws';

// 动态导入 AdapterContract（运行时路径解析）
const { AdapterContract } = await import(
  new URL('../../../../modules/channelHub/AdapterContract.js', import.meta.url)
);

// OneBot 适配器的能力配置
const ONEBOT_CAPABILITIES = {
  supportsText: true,
  supportsMarkdown: false,
  supportsImage: true,
  supportsAudio: true,
  supportsVideo: true,
  supportsFile: false,
  supportsCard: false,
  supportsAction: false,
  supportsQuoteReply: true,
  supportsForwardMessage: false,
  supportsStreaming: false,
  supportsGroupChat: true,
  supportsPrivateChat: true,
  supportsThread: false,
  supportsProactivePush: true,
  maxMessageLength: 4096,
  maxMediaSize: 50 * 1024 * 1024 // 50MB
};

// QQ 表情 ID 映射表 (OneBot face id -> emoji)
const FACE_EMOJI_MAP = {
  '1': '😄', '2': '😃', '3': '😁', '4': '😂', '5': '😅',
  '6': '😆', '7': '😇', '8': '😉', '9': '😊', '10': '😋',
  '11': '😌', '12': '😍', '13': '😘', '14': '😙', '15': '😚',
  '16': '😜', '17': '😝', '18': '😛', '19': '😳', '20': '😠',
  '21': '😡', '22': '😔', '23': '😕', '24': '😒', '25': '😞',
  '26': '😟', '27': '😢', '28': '😣', '29': '😖', '30': '😪',
  '31': '😫', '32': '😨', '33': '😰', '34': '😱', '35': '😷',
  '36': '😵', '41': '😶', '42': '😏', '43': '😑', '44': '😒',
  '45': '😓', '46': '😔', '47': '😕', '48': '😖', '49': '😗',
  '50': '😘', '51': '😙', '52': '😚', '53': '😛', '54': '😜',
  '55': '😝', '56': '😞', '57': '😟', '58': '😠', '59': '😡',
  '60': '😢', '61': '😣', '62': '😤', '63': '😥', '64': '😦',
  '65': '😧', '66': '😨', '67': '😩', '68': '😪', '69': '😫',
  '70': '😬', '71': '😭', '72': '😮', '73': '😯', '74': '😰',
  '75': '😱', '76': '😲', '77': '😳', '78': '😴', '79': '😵',
  '80': '😶', '81': '😷', '82': '😸', '83': '😹', '84': '😺',
  '85': '😻', '86': '😼', '87': '😽', '88': '😾', '89': '😿',
  '90': '🙀', '91': '🙁', '92': '🙂', '93': '🙃', '94': '🙄',
  '95': '🙅', '96': '🙆', '97': '🙇', '98': '🙈', '99': '🙉',
  '100': '🙊', '101': '🙋', '102': '🙌', '103': '🙍', '104': '🙎'
};

/**
 * OneBot 适配器实现 AdapterContract
 */
export class OneBotAdapter extends AdapterContract {
  /**
   * @param {Object} config - 适配器配置
   * @param {Object} config.metadata - 适配器元数据
   * @param {Object} config.options - 适配器选项
   * @param {string} config.options.wsUrl - WebSocket URL (例如 ws://127.0.0.1:3001)
   * @param {string} config.options.accessToken - WebSocket 认证令牌
   * @param {Object} config.options.logger - 日志器实例
   */
  constructor(config = {}) {
    const metadata = config.metadata || {
      id: 'onebot-websocket',
      channel: 'qq',
      displayName: 'OneBot 适配器',
      transportMode: 'forward_ws',
      sessionGrammar: 'onebot:{conversationType}:{conversationId}',
      capabilities: ONEBOT_CAPABILITIES
    };

    super(metadata);

    this.options = {
      wsUrl: process.env.ONEBOT_WS_URL || 'ws://127.0.0.1:3001',
      accessToken: process.env.ONEBOT_ACCESS_TOKEN || '',
      logger: console,
      ...config.options
    };

    this.client = createOneBotClient({
      wsUrl: this.options.wsUrl,
      accessToken: this.options.accessToken,
      logger: this.options.logger
    });

    this._initialized = false;
    this._selfId = null;
    this._connectionState = 'disconnected';

    // 绑定事件处理器
    this.client.on('connect', ({ selfId }) => {
      this._selfId = selfId;
      this._connectionState = 'connected';
      this.options.logger.info('[OneBotAdapter] 已连接，self_id:', selfId);
    });

    this.client.on('close', (code, reason) => {
      this._connectionState = 'disconnected';
      this.options.logger.warn('[OneBotAdapter] WebSocket 关闭:', { code, reason });
    });

    this.client.on('error', (error) => {
      this._connectionState = 'error';
      this.options.logger.error('[OneBotAdapter] WebSocket 错误:', error);
    });
  }

  /**
   * 初始化适配器
   */
  async initialize() {
    if (this._initialized) return;

    this.options.logger.info('[OneBotAdapter] 初始化中...');

    // 验证必要配置
    if (!this.options.wsUrl) {
      throw new Error('ONEBOT_WS_URL 是必需的');
    }

    // 连接到 OneBot
    try {
      await this.client.connect();
      this._initialized = true;
      this._connectionState = 'connected';
      this.options.logger.info('[OneBotAdapter] 初始化成功');
    } catch (error) {
      this.options.logger.error('[OneBotAdapter] 连接失败:', error);
      throw error;
    }
  }

  /**
   * 关闭适配器
   */
  async shutdown() {
    if (!this._initialized) return;

    this._initialized = false;
    try {
      await this.client.disconnect();
    } catch (error) {
      this.options.logger.error('[OneBotAdapter] 断开连接错误:', error);
    }
    this._connectionState = 'disconnected';
    this.options.logger.info('[OneBotAdapter] 已关闭');
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    return {
      healthy: this._connectionState === 'connected',
      adapterId: this._metadata.id,
      channel: this._metadata.channel,
      selfId: this._selfId,
      connectionState: this._connectionState,
      initialized: this._initialized
    };
  }

  // ==================== 认证 ====================

  /**
   * 适配器级认证
   */
  async authenticate(requestContext = {}) {
    // OneBot 使用 WebSocket 头部的 access_token 进行认证
    // 尝试通过 API 调用来检查 token 是否有效
    if (!this.options.accessToken) {
      // 未配置 token，跳过认证
      return { authenticated: true, adapterId: this._metadata.id };
    }

    // 检查客户端是否已连接
    if (!this.client.isConnected) {
      return {
        authenticated: false,
        adapterId: this._metadata.id,
        error: '未连接到 OneBot'
      };
    }

    return { authenticated: true, adapterId: this._metadata.id };
  }

  /**
   * 验证 OneBot 签名（Hook md5 签名）
   */
  async verifySignature(requestContext = {}) {
    const { headers, rawBody } = requestContext;

    // OneBot 11 可以使用 X-OneBot-Auth 头部或 md5 签名
    const authHeader = headers?.['x-onebot-auth'];
    const signature = headers?.['x-signature'];

    if (!authHeader && !signature) {
      // 无认证签名
      return { valid: true };
    }

    // 验证 access token
    if (authHeader) {
      if (authHeader !== this.options.accessToken) {
        return { valid: false, reason: '认证 token 无效' };
      }
    }

    // 验证 md5 签名
    if (signature) {
      const crypto = await import('crypto');
      const secret = process.env.ONEBOT_SECRET || this._metadata.authConfig?.secret;

      if (secret) {
        const computedSignature = crypto
          .createHash('md5')
          .update(JSON.stringify(rawBody) + secret)
          .digest('hex');

        if (computedSignature !== signature) {
          return { valid: false, reason: '签名不匹配' };
        }
      }
    }

    return { valid: true };
  }

  // ==================== 入站解码 ====================

  /**
   * 将入站原始负载解码为标准 Event
   */
  async decodeInbound(rawPayload, context = {}) {
    this.recordInbound();

    if (!rawPayload) {
      throw new Error('空负载');
    }

    // OneBot 11 消息结构
    const postType = rawPayload.post_type || '';
    const subType = rawPayload.sub_type || '';
    const messageType = rawPayload.message_type || '';
    const message = rawPayload.message || '';
    const rawMessage = rawPayload.raw_message || '';
    const sender = rawPayload.sender || {};
    const time = parseInt(rawPayload.time || 0) * 1000; // 转换为毫秒

    // 构建发送者信息
    const senderNick = sender.card || sender.nickname || '用户';
    const senderId = String(rawPayload.user_id || 'unknown');

    const senderInfo = {
      userId: senderId,
      nick: senderNick,
      displayName: senderNick,
      isAdmin: Boolean(sender.role === 'admin' || sender.role === 'owner'),
      roles: sender.role ? [sender.role, 'user'] : ['user'],
      tenantId: null,
      organizationId: null
    };

    // 确定会话类型和 ID
    let conversationType = 'private';
    let conversationId = null;

    if (messageType === 'group') {
      conversationType = 'group';
      conversationId = String(rawPayload.group_id);
    } else if (messageType === 'private') {
      conversationType = 'private';
      conversationId = senderId;
    }

    // 构建客户端信息
    const clientId = String(rawPayload.self_id || 'onebot');

    const client = {
      clientType: 'qq',
      conversationId,
      conversationType,
      messageId: String(rawPayload.message_id || null),
      messageThreadId: null,
      replyToMessageId: rawPayload.reply_to_message_id ? String(rawPayload.reply_to_message_id) : null,
      timestamp: time || Date.now()
    };

    // 构建会话
    const session = {
      externalSessionKey: `onebot:${conversationType}:${conversationId}`,
      bindingKey: conversationType === 'private'
        ? `onebot:${conversationType}:${conversationId}:${senderId}`
        : `onebot:${conversationType}:${conversationId}:${senderId}`,
      currentTopicId: null,
      allowCreateTopic: true,
      allowSwitchTopic: true
    };

    // 构建负载消息
    const payload = {
      messages: []
    };

    // 解析 OneBot CQ 代码格式
    const content = this._parseMessageContent(message);
    payload.messages.push({
      role: 'user',
      content
    });

    // 构建事件
    const event = {
      version: '2.0',
      eventId: String(rawPayload.message_id || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`),
      adapterId: this._metadata.id,
      channel: this._metadata.channel,
      eventType: 'message.created',
      occurredAt: Date.now(),
      traceId: context.traceId || null,
      requestId: String(rawPayload.message_id || null),
      sender: senderInfo,
      client,
      session,
      payload,
      target: null, // 由路由层解析
      runtime: {
        stream: false,
        model: null,
        timeoutMs: 120000,
        overrides: {}
      },
      metadata: {
        platformData: {
          postType,
          subType,
          onebotData: rawPayload,
          rawMessage,
          selfId: clientId
        },
        raw: rawPayload,
        sourceIp: context.sourceIp || null
      }
    };

    return event;
  }

  // ==================== 出站编码 ====================

  /**
   * 将标准 NormalizedReply 编码为平台特定消息
   */
  async encodeOutbound(reply, context = {}) {
    this.recordOutbound(reply.messages?.length || 1);

    const messages = [];

    for (const msg of reply.messages || []) {
      for (const part of msg.content || []) {
        const platformMsg = await this._encodeContentPart(part, context);
        if (platformMsg) {
          messages.push(platformMsg);
        }
      }
    }

    // 如果消息被降级（空），提供回退
    if (messages.length === 0) {
      messages.push({
        type: 'text',
        content: '[消息负载在能力降级后为空]'
      });
    }

    return messages;
  }

  // ==================== 消息发送 ====================

  /**
   * 通过会话描述符发送消息
   */
  async sendBySession(sessionDescriptor, platformMessages, context = {}) {
    this.recordOutbound(platformMessages.length);

    if (!platformMessages || platformMessages.length === 0) {
      throw new Error('没有要发送的消息');
    }

    if (!this._initialized) {
      throw new Error('适配器未初始化');
    }

    const { conversationId, conversationType } = sessionDescriptor;

    // 发送每个平台消息作为单独的 API 调用
    const results = [];
    for (const msg of platformMessages) {
      const result = await this._sendPlatformMessage(conversationId, conversationType, msg);
      results.push(result);
    }

    return {
      success: true,
      messageId: results[0]?.msgId || null,
      sentAt: Date.now()
    };
  }

  /**
   * 发送主动消息（通知）
   */
  async sendProactiveMessage(sessionDescriptor, message) {
    this.assertSupports('supportsProactivePush');

    if (!this._initialized) {
      throw new Error('适配器未初始化');
    }

    const { conversationType, conversationId } = sessionDescriptor;
    const text = typeof message === 'string' ? message : JSON.stringify(message);

    // 解析文本为消息段
    const messageSegments = this._parseTextToSegments(text);

    try {
      if (conversationType === 'group') {
        const result = await this.client.sendGroupMessage(conversationId, messageSegments);
        return {
          success: true,
          msgId: String(result.message_id),
          sentAt: Date.now()
        };
      } else {
        const result = await this.client.sendPrivateMessage(conversationId, messageSegments);
        return {
          success: true,
          msgId: String(result.message_id),
          sentAt: Date.now()
        };
      }
    } catch (error) {
      this.options.logger.error('[OneBotAdapter] 主动消息失败:', error);
      throw error;
    }
  }

  // ==================== 平台特定助手 ====================

  /**
   * 发送平台消息到目标
   */
  async _sendPlatformMessage(conversationId, conversationType, platformMessage) {
    if (platformMessage.type === 'text') {
      const messageSegments = this._parseTextToSegments(platformMessage.content);
      let result;
      if (conversationType === 'group') {
        result = await this.client.sendGroupMessage(conversationId, messageSegments);
      } else {
        result = await this.client.sendPrivateMessage(conversationId, messageSegments);
      }
      return {
        success: true,
        msgId: String(result.message_id),
        sentAt: Date.now()
      };
    } else if (platformMessage.type === 'image') {
      const messageSegments = [];
      const imageUrl = platformMessage.url;

      // 检查 URL 是否为本地（使用 CQ 代码格式）
      if (imageUrl && !imageUrl.startsWith('http')) {
        messageSegments.push({ type: 'image', data: { file: imageUrl } });
      } else {
        // 对于 HTTP URL，直接使用
        messageSegments.push({ type: 'image', data: { url: imageUrl } });
      }

      let result;
      if (conversationType === 'group') {
        result = await this.client.sendGroupMessage(conversationId, messageSegments);
      } else {
        result = await this.client.sendPrivateMessage(conversationId, messageSegments);
      }
      return {
        success: true,
        msgId: String(result.message_id),
        sentAt: Date.now()
      };
    }

    throw new Error(`不支持的消息类型：${platformMessage.type}`);
  }

  /**
   * 将内容部分编码为平台消息
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
          fileName: part.image_url?.fileName || null,
          mediaType: 'image'
        };

      default:
        // 不支持的类型 - 将被降级
        return null;
    }
  }

  /**
   * 解析 OneBot CQ 代码格式为内容数组
   */
  _parseMessageContent(message) {
    const content = [];

    // 处理纯文本
    if (typeof message === 'string') {
      content.push({
        type: 'text',
        text: this._decodeCqCode(message)
      });
      return content;
    }

    // 处理消息数组（OneBot 11 标准格式）
    if (Array.isArray(message)) {
      for (const segment of message) {
        if (segment.type === 'text') {
          content.push({
            type: 'text',
            text: segment.data?.text || ''
          });
        } else if (segment.type === 'image') {
          content.push({
            type: 'image_url',
            image_url: {
              url: segment.data?.url || segment.data?.file || null
            }
          });
        } else if (segment.type === 'face') {
          // QQ 表情 - 使用 emoji 映射
          const faceId = segment.data?.id || segment.data?.qq || '0';
          const emoji = FACE_EMOJI_MAP[faceId] || '🙂';
          content.push({
            type: 'text',
            text: emoji
          });
        } else if (segment.type === 'at') {
          const atText = segment.data?.qq === 'all' ? '@全体成员' : `@${segment.data?.qq}`;
          content.push({
            type: 'text',
            text: atText
          });
        } else if (segment.type === 'reply') {
          // 回复消息 - 添加引用标记
          content.push({
            type: 'text',
            text: `[回复] `
          });
        } else if (segment.type === 'video') {
          content.push({
            type: 'video',
            url: segment.data?.url || segment.data?.file || null
          });
        } else if (segment.type === 'record') {
          content.push({
            type: 'audio',
            url: segment.data?.url || segment.data?.file || null
          });
        } else if (segment.type === 'file') {
          content.push({
            type: 'file',
            fileName: segment.data?.file || null,
            url: segment.data?.url || null
          });
        } else if (segment.type === 'forward') {
          // 转发消息
          content.push({
            type: 'text',
            text: '[转发消息]'
          });
        } else if (segment.type === 'json' || segment.type === 'xml') {
          // 结构化消息
          content.push({
            type: 'text',
            text: `[${segment.type === 'json' ? 'JSON 卡片' : 'XML 卡片'}]`
          });
        } else {
          // 未知类型，添加为文本
          content.push({
            type: 'text',
            text: JSON.stringify(segment)
          });
        }
      }
    }

    return content;
  }

  /**
   * 解码文本中的 CQ 代码
   */
  _decodeCqCode(text) {
    if (!text) return '';

    // 替换 CQ 代码为可读文本
    // [CQ:image,file=xxx] -> [图片]
    // [CQ:face,id=123] -> [表情]
    return text.replace(/\[CQ:(\w+)[^\]]*\]/g, (match, type) => {
      switch (type) {
        case 'image':
          return '[图片]';
        case 'face':
          const faceId = match.match(/id=([^,\]]+)/);
          return faceId ? FACE_EMOJI_MAP[faceId[1]] || '[表情]' : '[表情]';
        case 'video':
          return '[视频]';
        case 'record':
          return '[语音]';
        case 'at':
          return '[提及]';
        case 'reply':
          return '[回复]';
        default:
          return `[${type.toUpperCase()}]`;
      }
    });
  }

  /**
   * 解析文本为消息段
   */
  _parseTextToSegments(text) {
    const segments = [];
    const lines = String(text).split('\n');

    for (const line of lines) {
      // 处理 URL - 如果看起来像图片 URL 则转换为图片
      if (this._looksLikeImageUrl(line)) {
        segments.push({ type: 'image', data: { url: line.trim() } });
      } else {
        segments.push({ type: 'text', data: { text: line } });
      }
    }

    return segments;
  }

  /**
   * 检查字符串是否像图片 URL
   */
  _looksLikeImageUrl(str) {
    const trimmed = String(str).trim();
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
    return imageExtensions.some(ext => trimmed.toLowerCase().endsWith(ext)) ||
      trimmed.includes('http') && (trimmed.includes('png') || trimmed.includes('jpg'));
  }

  /**
   * 标准化会话类型
   */
  _normalizeConversationType(type) {
    if (!type) return 'private';
    const t = String(type).toLowerCase();
    if (t.includes('private') || t === '1' || t === 'friend') return 'private';
    if (t.includes('group') || t === '2' || t === 'discuss') return 'group';
    if (t.includes('channel')) return 'channel';
    return 'private';
  }

  /**
   * IP 匹配 CIDR
   */
  _ipMatchCIDR(ip, cidr) {
    try {
      const [network, bits] = cidr.split('/');
      if (!network || !bits) return false;

      const ipNum = this._ipToNumber(ip);
      const networkNum = this._ipToNumber(network);

      if (!ipNum || !networkNum) return false;

      const mask = (0xFFFFFFFF << (32 - parseInt(bits))) >>> 0;
      return (ipNum & mask) === (networkNum & mask);
    } catch {
      return false;
    }
  }

  /**
   * 将 IP 转换为数字
   */
  _ipToNumber(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;

    return parts.reduce((acc, part) => {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0 || num > 255) return null;
      return (acc << 8) + num;
    }, 0);
  }
}

// 创建适配器工厂函数
export function createOneBotAdapter(config = {}) {
  return new OneBotAdapter(config);
}

export default {
  OneBotAdapter,
  createOneBotAdapter
};

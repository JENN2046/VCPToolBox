/**
 * DingTalk Adapter Implementation of VCP AdapterContract
 *
 * This adapter implements the standard AdapterContract interface for DingTalk integration.
 * It uses the DingTalk OpenAPI and Webhook mechanisms.
 *
 * Reference: docs/interaction-middleware/VCP_INTERACTION_MIDDLEWARE_SCHEMA.md
 */
import { AdapterContract } from '../../../../modules/channelHub/AdapterContract.js';
import { createDingAuthClient } from '../adapters/dingtalk/auth.js';
import { createMediaUploader, isPublicHttpUrl } from '../adapters/dingtalk/mediaUploader.js';

// Capability profile for DingTalk adapter
const DINGTALK_CAPABILITIES = {
  supportsText: true,
  supportsMarkdown: true,
  supportsImage: true,
  supportsAudio: false,
  supportsVideo: false,
  supportsFile: true,
  supportsCard: true,
  supportsAction: true,
  supportsQuoteReply: false,
  supportsForwardMessage: false,
  supportsStreaming: false,
  supportsGroupChat: true,
  supportsPrivateChat: true,
  supportsThread: false,
  supportsProactivePush: true,
  maxMessageLength: 4096,
  maxMediaSize: 20 * 1024 * 1024 // 20MB
};

/**
 * DingTalk Adapter implementing AdapterContract
 */
export class DingTalkAdapter extends AdapterContract {
  /**
   * @param {Object} config - Adapter configuration
   * @param {Object} config.metadata - Adapter metadata
   * @param {Object} config.options - Adapter options
   * @param {string} config.options.appKey - DingTalk app key
   * @param {string} config.options.appSecret - DingTalk app secret
   * @param {Object} config.options.logger - Logger instance
   */
  constructor(config = {}) {
    const metadata = config.metadata || {
      id: 'dingtalk-stream',
      channel: 'dingtalk',
      displayName: 'DingTalk Adapter',
      transportMode: 'http_webhook',
      sessionGrammar: 'dingtalk:{conversationType}:{conversationId}',
      capabilities: DINGTALK_CAPABILITIES
    };

    super(metadata);

    this.options = {
      appKey: process.env.DING_APP_KEY || '',
      appSecret: process.env.DING_APP_SECRET || '',
      logger: console,
      ...config.options
    };

    this.authClient = createDingAuthClient({
      appKey: this.options.appKey,
      appSecret: this.options.appSecret,
      logger: this.options.logger
    });

    this.mediaUploader = createMediaUploader({
      authClient: this.authClient,
      logger: this.options.logger
    });

    this._initialized = false;
    this._senderCache = null;
  }

  /**
   * Initialize the adapter
   */
  async initialize() {
    if (this._initialized) return;

    this.options.logger.info('[DingTalkAdapter] Initializing...');

    // Validate required config
    if (!this.options.appKey || !this.options.appSecret) {
      throw new Error('DING_APP_KEY and DING_APP_SECRET are required');
    }

    // Test authentication client
    try {
      await this.authClient.getAccessToken();
      this.options.logger.info('[DingTalkAdapter] Authentication client ready');
    } catch (error) {
      this.options.logger.warn('[DingTalkAdapter] Initial auth test failed:', error.message);
    }

    this._initialized = true;
    this.options.logger.info('[DingTalkAdapter] Initialized successfully');
  }

  /**
   * Shutdown the adapter
   */
  async shutdown() {
    this._initialized = false;
    this._senderCache = null;
    this.options.logger.info('[DingTalkAdapter] Shutdown complete');
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const accessToken = await this.authClient.getAccessToken();
      return {
        healthy: true,
        adapterId: this._metadata.id,
        channel: this._metadata.channel,
        accessTokenValid: !!accessToken,
        initialized: this._initialized
      };
    } catch (error) {
      return {
        healthy: false,
        adapterId: this._metadata.id,
        error: error.message
      };
    }
  }

  // ==================== Authentication ====================

  /**
   * Adapter-level authentication
   */
  async authenticate(requestContext = {}) {
    const sourceIp = requestContext.sourceIp || null;

    // Check IP whitelist if configured
    const ipWhitelist = this._metadata.ipWhitelist || [];
    if (ipWhitelist.length > 0 && sourceIp) {
      const allowed = ipWhitelist.some(pattern => {
        if (pattern === sourceIp) return true;
        if (pattern.includes('/')) {
          // CIDR support (simplified)
          return this._ipMatchCIDR(sourceIp, pattern);
        }
        return false;
      });

      if (!allowed) {
        return {
          authenticated: false,
          adapterId: this._metadata.id,
          error: 'IP not in whitelist'
        };
      }
    }

    return { authenticated: true, adapterId: this._metadata.id };
  }

  /**
   * Verify DingTalk signature
   */
  async verifySignature(requestContext = {}) {
    const { headers, rawBody } = requestContext;

    const timestamp = headers?.timestamp;
    const sign = headers?.sign;
    const appSecret = this.options.appSecret;

    if (!timestamp || !sign) {
      return { valid: false, reason: 'Missing timestamp or sign header' };
    }

    // Timestamp validation
    const timestampNum = parseInt(timestamp, 10);
    const now = Date.now();
    const tolerance = 300000; // 5 minutes

    if (Math.abs(now - timestampNum) > tolerance) {
      return { valid: false, reason: 'Timestamp expired' };
    }

    if (!appSecret) {
      // No secret configured, skip signature verification
      return { valid: true };
    }

    // Calculate signature: sha256(timestamp + "\n" + appSecret)
    const crypto = await import('crypto');
    const stringToSign = timestamp + '\n' + appSecret;
    const computedSign = crypto
      .createHmac('sha256', appSecret)
      .update(stringToSign)
      .digest('base64');

    if (computedSign !== sign) {
      return { valid: false, reason: 'Signature mismatch' };
    }

    return { valid: true };
  }

  // ==================== Inbound Decoding ====================

  /**
   * Decode inbound raw payload to standard Event
   */
  async decodeInbound(rawPayload, context = {}) {
    this.recordInbound();

    if (!rawPayload) {
      throw new Error('Empty payload');
    }

    // Extract message type
    const msgtype = rawPayload?.msgtype || rawPayload?.messageType || '';
    const data = rawPayload?.data || rawPayload;

    // Extract text content
    const text = this._extractTextContent(data, msgtype);
    const conversationId = this._extractConversationId(data);
    const userId = this._extractUserId(data);
    const senderNick = data?.senderNick || data?.senderStaffId || 'User';

    if (!conversationId) {
      throw new Error('Missing conversationId in payload');
    }

    // Extract media if present
    const media = this._extractMedia(data, msgtype);

    // Build sender
    const sender = {
      userId: userId || 'unknown',
      nick: senderNick,
      displayName: senderNick,
      isAdmin: Boolean(data?.isAdmin),
      roles: ['user'],
      tenantId: null,
      organizationId: data?.senderCorpId || null
    };

    // Build client
    const conversationType = this._normalizeConversationType(data?.conversationType || data?.chatType);
    const clientId = data?.senderStaffId || data?.senderId || 'dingtalk';

    const client = {
      clientType: 'dingtalk',
      conversationId,
      conversationType,
      messageId: rawPayload?.msgId || rawPayload?.messageId || null,
      messageThreadId: null,
      replyToMessageId: null,
      timestamp: Date.now()
    };

    // Build session
    // [Nova Fix] 将 sessionWebhook, sessionWebhookExpiredTime, robotCode 编码进 externalSessionKey
    // 格式：dingtalk:{type}:{id}:{base64(json)}
    const sessionMetadata = JSON.stringify({
      sessionWebhook: data?.sessionWebhook || null,
      sessionWebhookExpiredTime: data?.sessionWebhookExpiredTime || 0,
      robotCode: data?.robotCode || null
    });
    const encodedMetadata = Buffer.from(sessionMetadata).toString('base64');

    const session = {
      externalSessionKey: `dingtalk:${conversationType}:${conversationId}:${encodedMetadata}`,
      bindingKey: userId
        ? `dingtalk:${conversationType}:${conversationId}:${userId}`
        : `dingtalk:${conversationType}:${conversationId}`,
      currentTopicId: null,
      allowCreateTopic: true,
      allowSwitchTopic: true
    };

    // Build payload
    const payload = {
      messages: [
        {
          role: 'user',
          content: [{
            type: 'text',
            text: text
          }]
        }
      ]
    };

    // Add media content if present
    if (media?.type) {
      const msg = payload.messages[0];
      if (media.type === 'image') {
        msg.content.push({
          type: 'image_url',
          image_url: {
            url: media.url,
            fileName: media.fileName || 'image.jpg'
          }
        });
      } else if (media.type === 'file') {
        msg.content.push({
          type: 'file',
          fileName: media.fileName,
          url: media.url || null
        });
      } else if (media.type === 'audio') {
        msg.content.push({
          type: 'audio',
          url: media.url || null
        });
      }
    }

    // Build event
    const event = {
      version: '2.0',
      eventId: rawPayload?.msgId || rawPayload?.messageId || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      adapterId: this._metadata.id,
      channel: this._metadata.channel,
      eventType: 'message.created',
      occurredAt: Date.now(),
      traceId: context.traceId || null,
      requestId: rawPayload?.msgId || null,
      sender,
      client,
      session,
      payload,
      target: null, // Will be resolved by routing layer
      runtime: {
        stream: false,
        model: null,
        timeoutMs: 120000,
        overrides: {}
      },
      metadata: {
        platformData: {
          msgtype,
          dingtalkData: data,
          sessionWebhook: data?.sessionWebhook || null,
          sessionWebhookExpiredTime: data?.sessionWebhookExpiredTime || 0,
          robotCode: data?.robotCode || null,
          conversationTitle: data?.conversationTitle || null
        },
        raw: rawPayload,
        sourceIp: context.sourceIp || null
      }
    };

    return event;
  }

  // ==================== Outbound Encoding ====================

  /**
   * Encode standard NormalizedReply to platform-specific messages
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

    // If messages were downgraded (empty), provide fallback
    if (messages.length === 0) {
      messages.push({
        type: 'text',
        content: '[Message payload empty after capability downgrades]'
      });
    }

    return messages;
  }

  // ==================== Message Sending ====================

  /**
   * Send messages by session descriptor
   */
  async sendBySession(sessionDescriptor, platformMessages, context = {}) {
    this.recordOutbound(platformMessages.length);

    if (!platformMessages || platformMessages.length === 0) {
      throw new Error('No messages to send');
    }

    const {
      conversationId,
      conversationType,
      bindingKey,
      externalSessionKey
    } = sessionDescriptor;

    // [Nova Fix] 从 externalSessionKey 中解码 session 元数据
    let robotCode = null;
    let sessionWebhook = null;
    let sessionWebhookExpiredTime = 0;

    if (externalSessionKey) {
      const parts = externalSessionKey.split(':');
      if (parts.length >= 4) {
        try {
          // 最后一段是 base64 编码的 JSON
          const jsonStr = Buffer.from(parts[3], 'base64').toString('utf-8');
          const meta = JSON.parse(jsonStr);
          sessionWebhook = meta.sessionWebhook || null;
          sessionWebhookExpiredTime = meta.sessionWebhookExpiredTime || 0;
          robotCode = meta.robotCode || null;
        } catch (e) {
          this.options.logger.warn('[DingTalkAdapter] Failed to parse session metadata from externalSessionKey', e);
        }
      }
    }

    // Fallback to context.metadata if available (for backward compatibility)
    if (!sessionWebhook && context.metadata?.platformData?.sessionWebhook) {
      sessionWebhook = context.metadata.platformData.sessionWebhook;
    }
    if (!robotCode && context.metadata?.platformData?.robotCode) {
      robotCode = context.metadata.platformData.robotCode;
    }
    if (!sessionWebhookExpiredTime && context.metadata?.platformData?.sessionWebhookExpiredTime) {
      sessionWebhookExpiredTime = context.metadata.platformData.sessionWebhookExpiredTime;
    }

    // Get user ID from binding key for single chat
    let userId = null;
    if (conversationType === 'private' && bindingKey) {
      const parts = bindingKey.split(':');
      userId = parts[3] || null;
    }

    // Prepare message args
    const messageArgs = {
      robotCode,
      sessionWebhook,
      sessionWebhookExpiredTime,
      conversationId,
      userId
    };

    // Determine reply method based on message types
    const hasRichContent = platformMessages.some(m =>
      m.type === 'image' || m.type === 'file' || m.type === 'card'
    );

    if (hasRichContent) {
      // Use rich reply for media content
      const richData = this._prepareRichContent(platformMessages);
      const result = await this._replyRich(messageArgs, richData, conversationType);
      return { success: true, messageId: result?.msgId || null, sentAt: Date.now() };
    } else {
      // Use text reply
      const text = this._joinTextContent(platformMessages);
      const result = await this._replyText(messageArgs, text, conversationType);
      return { success: true, messageId: result?.msgId || null, sentAt: Date.now() };
    }
  }

  /**
   * Send proactive message (notification)
   */
  async sendProactiveMessage(sessionDescriptor, message) {
    this.assertSupports('supportsProactivePush');

    const { conversationId, conversationType } = sessionDescriptor;
    const robotCode = sessionDescriptor.metadata?.platformData?.robotCode || null;

    if (!robotCode) {
      throw new Error('robotCode is required for proactive messages');
    }

    if (conversationType === 'group') {
      return this._sendGroupMessage(conversationId, robotCode, message);
    } else {
      // For single chat, we need userId from binding key
      const bindingKey = sessionDescriptor.bindingKey;
      let userId = null;
      if (bindingKey) {
        const parts = bindingKey.split(':');
        userId = parts[3] || null;
      }

      if (!userId) {
        throw new Error('userId is required for proactive single chat messages');
      }

      return this._sendSingleMessage(userId, robotCode, message);
    }
  }

  // ==================== Adapter Contract Implementation Helpers ====================

  /**
   * Get sender instance (lazy init)
   */
  async _getSender() {
    if (!this._senderCache) {
      const { createDingSender } = await import('../adapters/dingtalk/sender.js');
      this._senderCache = createDingSender({
        logger: this.options.logger,
        appKey: this.options.appKey,
        appSecret: this.options.appSecret
      });
    }
    return this._senderCache;
  }

  /**
   * Reply text message
   */
  async _replyText(args, text, chatType) {
    const sender = await this._getSender();

    if (chatType === 'group') {
      return sender.replyText({
        conversationId: args.conversationId,
        userId: null,
        robotCode: args.robotCode,
        sessionWebhook: args.sessionWebhook,
        sessionWebhookExpiredTime: args.sessionWebhookExpiredTime,
        text
      });
    } else {
      return sender.replyText({
        conversationId: args.conversationId,
        userId: args.userId,
        robotCode: args.robotCode,
        sessionWebhook: args.sessionWebhook,
        sessionWebhookExpiredTime: args.sessionWebhookExpiredTime,
        text
      });
    }
  }

  /**
   * Reply rich content (text + media)
   */
  async _replyRich(args, richData, chatType) {
    const sender = await this._getSender();

    if (chatType === 'group') {
      return sender.replyRich({
        chatType: 'group',
        conversationId: args.conversationId,
        userId: null,
        robotCode: args.robotCode,
        sessionWebhook: args.sessionWebhook,
        sessionWebhookExpiredTime: args.sessionWebhookExpiredTime,
        text: richData.text || '',
        images: richData.images || [],
        files: richData.files || []
      });
    } else {
      return sender.replyRich({
        chatType: 'single',
        conversationId: args.conversationId,
        userId: args.userId,
        robotCode: args.robotCode,
        sessionWebhook: args.sessionWebhook,
        sessionWebhookExpiredTime: args.sessionWebhookExpiredTime,
        text: richData.text || '',
        images: richData.images || [],
        files: richData.files || []
      });
    }
  }

  /**
   * Send group message
   */
  async _sendGroupMessage(openConversationId, robotCode, message) {
    const sender = await this._getSender();

    if (typeof message === 'string') {
      return sender.sendGroupMessage({
        openConversationId,
        robotCode,
        msgKey: 'sampleText',
        msgParam: JSON.stringify({ content: message })
      });
    } else {
      return sender.sendGroupMessage({
        openConversationId,
        robotCode,
        msgKey: message.msgKey || 'sampleText',
        msgParam: JSON.stringify(message.msgParam || {})
      });
    }
  }

  /**
   * Send single message
   */
  async _sendSingleMessage(userId, robotCode, message) {
    const sender = await this._getSender();

    if (typeof message === 'string') {
      return sender.sendSingleMessage({
        userId,
        robotCode,
        text: message
      });
    } else {
      return sender.sendSingleMessage({
        userId,
        robotCode,
        text: JSON.stringify(message)
      });
    }
  }

  // ==================== Platform-Specific Helpers ====================

  /**
   * Extract conversation ID from payload
   */
  _extractConversationId(data) {
    return data?.conversationId ||
      data?.conversation?.conversationId ||
      data?.cid ||
      data?.openConversationId ||
      null;
  }

  /**
   * Extract user ID from payload
   */
  _extractUserId(data) {
    return data?.senderStaffId ||
      data?.senderId ||
      data?.userId ||
      null;
  }

  /**
   * Extract text content from payload
   */
  _extractTextContent(data, msgtype) {
    // Handle different message types
    if (msgtype === 'text') {
      return data?.text?.content || data?.content || '';
    } else if (msgtype === 'markdown') {
      return data?.markdown?.text || '';
    } else if (msgtype === 'interactiveCard') {
      try {
        const cardData = JSON.parse(data?.interactiveCard?.cardData || '{}');
        const elements = cardData?.elements || [];
        return elements.map(e => e.text?.content).filter(Boolean).join('\n');
      } catch {
        return '';
      }
    } else if (msgtype === 'image' || msgtype === 'picture') {
      return '[Image]';
    } else if (msgtype === 'file') {
      return `[File: ${data?.fileName || 'unknown'}]`;
    } else {
      return data?.text?.content || data?.content || '';
    }
  }

  /**
   * Extract media from payload
   */
  _extractMedia(data, msgtype) {
    if (msgtype === 'image' || msgtype === 'picture') {
      const content = data?.content || data?.msgContent || {};
      const picURL = content?.picURL || content?.picUrl || content?.url || '';
      const downloadCode = content?.downloadCode || data?.downloadCode || '';

      if (picURL || downloadCode) {
        return {
          type: 'image',
          url: picURL,
          downloadCode,
          fileName: content?.fileName || `image_${Date.now()}.jpg`
        };
      }
    } else if (msgtype === 'file') {
      const content = data?.content || data?.msgContent || {};
      const downloadCode = content?.downloadCode || data?.downloadCode || '';
      const fileName = content?.fileName || data?.fileName || 'unknown_file';

      if (downloadCode) {
        return {
          type: 'file',
          downloadCode,
          fileName,
          fileSize: content?.fileSize || 0
        };
      }
    } else if (msgtype === 'voice' || msgtype === 'audio') {
      const content = data?.content || data?.msgContent || {};
      const downloadCode = content?.downloadCode || data?.downloadCode || '';

      if (downloadCode) {
        return {
          type: 'audio',
          downloadCode,
          duration: content?.duration || 0,
          fileName: `voice_${Date.now()}.amr`
        };
      }
    }

    return null;
  }

  /**
   * Encode content part
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

      case 'file':
        return {
          type: 'file',
          url: part.url,
          fileName: part.fileName || null,
          fileSize: part.fileSize || 0,
          mediaType: part.mimeType || 'application/octet-stream'
        };

      case 'audio':
        return {
          type: 'audio',
          url: part.url,
          fileName: part.fileName || null,
          duration: part.duration || 0,
          mediaType: part.mimeType || 'audio/mpeg'
        };

      case 'action':
        // Convert action to interactive card button
        return {
          type: 'card',
          content: {
            title: part.action?.label || '',
            buttons: [{
              text: part.action?.label || '',
              value: part.action?.name || ''
            }]
          }
        };

      case 'card':
        return {
          type: 'card',
          content: part.card || part
        };

      default:
        // Unsupported type - will be downgraded
        return null;
    }
  }

  /**
   * Prepare rich content from platform messages
   */
  _prepareRichContent(messages) {
    const result = {
      text: '',
      images: [],
      files: []
    };

    for (const msg of messages) {
      if (msg.type === 'text') {
        result.text += (result.text ? '\n' : '') + msg.content;
      } else if (msg.type === 'image') {
        result.images.push({
          source: msg.url,
          fileName: msg.fileName || null
        });
      } else if (msg.type === 'file') {
        result.files.push({
          source: msg.url,
          fileName: msg.fileName || null
        });
      }
    }

    return result;
  }

  /**
   * Join text content from messages
   */
  _joinTextContent(messages) {
    return messages
      .filter(m => m.type === 'text')
      .map(m => m.content)
      .join('\n')
      .trim();
  }

  /**
   * Normalize conversation type
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
   * IP matching for CIDR
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
   * Convert IP to number
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

  /**
   * Extract user ID from binding key
   */
  _extractUserIdFromBindingKey(bindingKey) {
    if (!bindingKey) return null;
    const parts = bindingKey.split(':');
    return parts[3] || null;
  }
}

// Create adapter factory function
export function createDingTalkAdapter(config = {}) {
  return new DingTalkAdapter(config);
}

export default {
  DingTalkAdapter,
  createDingTalkAdapter
};
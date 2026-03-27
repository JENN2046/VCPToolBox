/**
 * WeCom (WeChat Work) Adapter Implementation of VCP AdapterContract
 *
 * This adapter implements the standard AdapterContract interface for WeCom (企业微信) integration.
 * It uses the WeCom Webhook callback and OpenAPI mechanisms.
 *
 * Reference: docs/interaction-middleware/VCP_INTERACTION_MIDDLEWARE_SCHEMA.md
 */

import { AdapterContract } from '../../../modules/channelHub/AdapterContract.js';
import { createWecomSender } from '../adapters/wecom/sender.js';

// Capability profile for WeCom adapter
const WECOM_CAPABILITIES = {
  supportsText: true,
  supportsMarkdown: true,
  supportsImage: true,
  supportsAudio: false,
  supportsVideo: false,
  supportsFile: false,
  supportsCard: true,
  supportsAction: false,
  supportsQuoteReply: false,
  supportsForwardMessage: false,
  supportsStreaming: false,
  supportsGroupChat: true,
  supportsPrivateChat: true,
  supportsThread: false,
  supportsProactivePush: true,
  maxMessageLength: 8192,
  maxMediaSize: 20 * 1024 * 1024 // 20MB
};

/**
 * WeCom Adapter implementing AdapterContract
 */
export class WecomAdapter extends AdapterContract {
  /**
   * @param {Object} config - Adapter configuration
   * @param {Object} config.metadata - Adapter metadata
   * @param {Object} config.options - Adapter options
   * @param {string} config.options.corpId - WeCom corp ID
   * @param {string} config.options.corpSecret - WeCom corp secret
   * @param {string} config.options.agentId - WeCom agent ID
   * @param {Object} config.options.logger - Logger instance
   */
  constructor(config = {}) {
    const metadata = config.metadata || {
      id: 'wecom-callback',
      channel: 'wework',
      displayName: 'WeCom Adapter',
      transportMode: 'http_webhook',
      sessionGrammar: 'wework:{conversationType}:{conversationId}',
      capabilities: WECOM_CAPABILITIES
    };

    super(metadata);

    this.options = {
      corpId: process.env.WECORP_ID || '',
      corpSecret: process.env.WECORP_SECRET || '',
      agentId: process.env.WECORP_AGENT_ID || '',
      logger: console,
      ...config.options
    };

    this.sender = createWecomSender({
      logger: this.options.logger,
      corpId: this.options.corpId,
      corpSecret: this.options.corpSecret,
      agentId: this.options.agentId
    });

    this._initialized = false;
  }

  /**
   * Initialize the adapter
   */
  async initialize() {
    if (this._initialized) return;

    this.options.logger.info('[WecomAdapter] Initializing...');

    // Validate required config
    if (!this.options.corpId || !this.options.corpSecret || !this.options.agentId) {
      throw new Error('WECORP_ID, WECORP_SECRET, and WECORP_AGENT_ID are required');
    }

    // Test authentication
    try {
      await this.sender.getAccessToken();
      this.options.logger.info('[WecomAdapter] Authentication ready');
    } catch (error) {
      this.options.logger.warn('[WecomAdapter] Initial auth test failed:', error.message);
    }

    this._initialized = true;
    this.options.logger.info('[WecomAdapter] Initialized successfully');
  }

  /**
   * Shutdown the adapter
   */
  async shutdown() {
    this._initialized = false;
    this.options.logger.info('[WecomAdapter] Shutdown complete');
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const accessToken = await this.sender.getAccessToken();
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
   * Verify WeCom callback signature
   */
  async verifySignature(requestContext = {}) {
    const { headers, query, rawBody } = requestContext;

    const timestamp = query?.timestamp;
    const nonce = query?.nonce;
    const msgSignature = query?.msg_signature;

    if (!timestamp || !nonce || !msgSignature) {
      return { valid: false, reason: 'Missing signature parameters' };
    }

    // Signature validation uses the WeCom callback token
    // This is configured separately from the adapter secret
    const callbackToken = process.env.WECORP_CALLBACK_TOKEN || this._metadata.authConfig?.secret;

    if (!callbackToken) {
      // No token configured, skip signature verification
      return { valid: true };
    }

    // Calculate signature: sha1(token + timestamp + nonce)
    const crypto = await import('crypto');
    const str = [callbackToken, timestamp, nonce].sort().join('');
    const computedSignature = crypto.createHash('sha1').update(str).digest('hex');

    if (computedSignature !== msgSignature) {
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

    // WeCom callback payload structure
    // https://work.weixin.qq.com/api/doc/90000/90136/91774
    const eventType = rawPayload.Event || rawPayload.msgtype || '';
    const content = rawPayload.Content || '';
    const userId = rawPayload.FromUserName || rawPayload.userId || null;
    const toUser = rawPayload.ToUserName || null; // The bot's user ID
    const time = parseInt(rawPayload.Time || 0) * 1000; // Convert to ms

    // Determine conversation type
    // In WeCom callbacks, private messages come from the bot to user
    // Group messages come from group chat
    const conversationType = this._normalizeConversationType(rawPayload.ChatType || 'private');
    const conversationId = rawPayload.ChatID || rawPayload.conversationId || null;

    // Build sender
    const sender = {
      userId: userId || 'unknown',
      nick: rawPayload.Sender || rawPayload.SenderUserName || 'User',
      displayName: rawPayload.Sender || rawPayload.SenderUserName || 'User',
      isAdmin: Boolean(rawPayload.IsAdmin),
      roles: ['user'],
      tenantId: null,
      organizationId: null
    };

    // Build client
    const clientId = toUser || 'wecom';

    const client = {
      clientType: 'wework',
      conversationId,
      conversationType,
      messageId: rawPayload.MsgId || null,
      messageThreadId: null,
      replyToMessageId: null,
      timestamp: time || Date.now()
    };

    // Build session
    const session = {
      externalSessionKey: `wework:${conversationType}:${conversationId || userId}`,
      bindingKey: userId ? `wework:${conversationType}:${conversationId || userId}:${userId}` : null,
      currentTopicId: null,
      allowCreateTopic: true,
      allowSwitchTopic: true
    };

    // Build payload messages
    const payload = {
      messages: []
    };

    // Handle different message types
    if (eventType === 'text') {
      payload.messages.push({
        role: 'user',
        content: [{
          type: 'text',
          text: content
        }]
      });
    } else if (eventType === 'image') {
      payload.messages.push({
        role: 'user',
        content: [{
          type: 'image_url',
          image_url: {
            url: rawPayload.PicUrl || null,
            fileName: 'image.jpg'
          }
        }]
      });
    } else if (eventType === 'voice') {
      payload.messages.push({
        role: 'user',
        content: [{
          type: 'audio',
          url: rawPayload.MediaId || null,
          fileName: rawPayload.MediaId ? `voice_${rawPayload.MediaId}.amr` : null,
          duration: rawPayload.Recognition || 0
        }]
      });
    } else if (eventType === 'video') {
      payload.messages.push({
        role: 'user',
        content: [{
          type: 'video',
          url: rawPayload.MediaId || null,
          fileName: rawPayload.MediaId ? `video_${rawPayload.MediaId}.mp4` : null
        }]
      });
    } else if (eventType === 'location') {
      payload.messages.push({
        role: 'user',
        content: [{
          type: 'text',
          text: `[Location: ${rawPayload.Location_X}, ${rawPayload.Location_Y}]`
        }]
      });
    } else if (eventType === 'link') {
      payload.messages.push({
        role: 'user',
        content: [{
          type: 'text',
          text: `[Link: ${rawPayload.Title} - ${rawPayload.Url}]`
        }]
      });
    } else if (eventType === 'event' && rawPayload.EventKey) {
      // Event messages (scan, menu click, etc.)
      payload.messages.push({
        role: 'user',
        content: [{
          type: 'text',
          text: `[Event: ${rawPayload.Event} - ${rawPayload.EventKey}]`
        }]
      });
    } else {
      // Fallback for unknown message types
      payload.messages.push({
        role: 'user',
        content: [{
          type: 'text',
          text: content || `[Unknown message type: ${eventType}]`
        }]
      });
    }

    // Build event
    const event = {
      version: '2.0',
      eventId: rawPayload.MsgId || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      adapterId: this._metadata.id,
      channel: this._metadata.channel,
      eventType: 'message.created',
      occurredAt: Date.now(),
      traceId: context.traceId || null,
      requestId: rawPayload.MsgId || null,
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
          eventType,
          wecomData: rawPayload,
          toUser,
          timestamp: time
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

    const { conversationId, conversationType, bindingKey } = sessionDescriptor;

    // Extract platform-specific data
    const toUser = context.metadata?.platformData?.toUser || null;
    const agentId = context.metadata?.platformData?.agentId || this.options.agentId;

    // Determine target user for private chat
    let userId = null;
    if (conversationType === 'private' && bindingKey) {
      const parts = bindingKey.split(':');
      userId = parts[3] || null;
    }

    // Group messages use conversationId (ChatID)
    const targetId = conversationType === 'group' ? conversationId : userId;

    // Determine message type and send
    const hasRichContent = platformMessages.some(m =>
      m.type === 'image' || m.type === 'card'
    );

    if (hasRichContent) {
      // For rich content, send each message separately
      const results = [];
      for (const msg of platformMessages) {
        const result = await this._sendMessageToUser(targetId, agentId, msg);
        results.push(result);
      }
      return { success: true, messageId: results[0]?.msgId || null, sentAt: Date.now() };
    } else {
      // Join text content and send as single text message
      const text = this._joinTextContent(platformMessages);
      const result = await this._sendTextMessage(targetId, agentId, text);
      return { success: true, messageId: result?.msgId || null, sentAt: Date.now() };
    }
  }

  /**
   * Send proactive message (notification)
   */
  async sendProactiveMessage(sessionDescriptor, message) {
    this.assertSupports('supportsProactivePush');

    const { conversationType, bindingKey } = sessionDescriptor;

    // For proactive messages, we need userId from binding key
    let userId = null;
    if (bindingKey) {
      const parts = bindingKey.split(':');
      userId = parts[3] || null;
    }

    if (!userId) {
      throw new Error('userId is required for proactive messages');
    }

    const agentId = this.options.agentId;
    const text = typeof message === 'string' ? message : JSON.stringify(message);

    return this._sendTextMessage(userId, agentId, text);
  }

  // ==================== Platform-Specific Helpers ====================

  /**
   * Send text message to user
   */
  async _sendTextMessage(userId, agentId, text) {
    try {
      const result = await this.sender.sendText({
        toUser: userId,
        agentId,
        content: text,
        safe: '0'
      });

      return {
        success: true,
        msgId: result.msgid || null,
        sentAt: Date.now()
      };
    } catch (error) {
      this.options.logger.error('[WecomAdapter] sendText failed:', error);
      throw error;
    }
  }

  /**
   * Send platform message to user
   */
  async _sendMessageToUser(targetId, agentId, platformMessage) {
    if (platformMessage.type === 'text') {
      return this._sendTextMessage(targetId, agentId, platformMessage.content);
    } else if (platformMessage.type === 'image') {
      // For images, we need to upload first and get mediaId
      // This is a simplified implementation
      const mediaId = platformMessage.mediaId || platformMessage.url;
      if (!mediaId) {
        throw new Error('Image mediaId is required for WeCom');
      }

      try {
        const result = await this.sender.sendImage({
          toUser: targetId,
          agentId,
          mediaId
        });
        return { success: true, msgId: result.msgid || null, sentAt: Date.now() };
      } catch (error) {
        this.options.logger.error('[WecomAdapter] sendImage failed:', error);
        throw error;
      }
    } else if (platformMessage.type === 'card') {
      // WeCom supports textcard message type
      try {
        const result = await this.sender.sendCard({
          toUser: targetId,
          agentId,
          title: platformMessage.content?.title || 'Message',
          description: platformMessage.content?.description || '',
          url: platformMessage.content?.url || '',
          btnTxt: platformMessage.content?.btnText || 'Details'
        });
        return { success: true, msgId: result.msgid || null, sentAt: Date.now() };
      } catch (error) {
        this.options.logger.error('[WecomAdapter] sendCard failed:', error);
        throw error;
      }
    }

    throw new Error(`Unsupported message type: ${platformMessage.type}`);
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
    if (!type) return 'private';
    const t = String(type).toLowerCase();
    if (t.includes('single') || t.includes('private') || t === '1') return 'private';
    if (t.includes('group') || t.includes('chat') || t === '2') return 'group';
    if (t.includes('channel')) return 'channel';
    return 'private';
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
}

// Create adapter factory function
export function createWecomAdapter(config = {}) {
  return new WecomAdapter(config);
}

export default {
  WecomAdapter,
  createWecomAdapter
};

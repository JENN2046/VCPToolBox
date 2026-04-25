/**
 * OneBot Adapter Implementation of VCP AdapterContract
 *
 * This adapter implements the standard AdapterContract interface for OneBot (QQ) integration.
 * It uses the OneBot 11 WebSocket protocol via go-cqhttp, NapCat, LLOneBot, etc.
 *
 * Reference: docs/interaction-middleware/VCP_INTERACTION_MIDDLEWARE_SCHEMA.md
 * OneBot 11 Protocol: https://github.com/botuniverse/onebot-11
 */

import { AdapterContract } from '../../../../modules/channelHub/AdapterContract.js';
import { createOneBotClient } from '../adapters/onebot/client.js';
import WebSocket from 'ws';

// Capability profile for OneBot adapter
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

/**
 * OneBot Adapter implementing AdapterContract
 */
export class OneBotAdapter extends AdapterContract {
  /**
   * @param {Object} config - Adapter configuration
   * @param {Object} config.metadata - Adapter metadata
   * @param {Object} config.options - Adapter options
   * @param {string} config.options.wsUrl - WebSocket URL (e.g., ws://127.0.0.1:3001)
   * @param {string} config.options.accessToken - Access token for WebSocket auth
   * @param {Object} config.options.logger - Logger instance
   */
  constructor(config = {}) {
    const metadata = config.metadata || {
      id: 'onebot-websocket',
      channel: 'qq',
      displayName: 'OneBot Adapter',
      transportMode: 'forward_ws',
      sessionGrammar: 'qq:{conversationType}:{conversationId}',
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

    // Bind event handlers
    this.client.on('connect', ({ selfId }) => {
      this._selfId = selfId;
      this._connectionState = 'connected';
      this.options.logger.info('[OneBotAdapter] Connected, self_id:', selfId);
    });

    this.client.on('close', (code, reason) => {
      this._connectionState = 'disconnected';
      this.options.logger.warn('[OneBotAdapter] WebSocket closed:', { code, reason });
    });

    this.client.on('error', (error) => {
      this._connectionState = 'error';
      this.options.logger.error('[OneBotAdapter] WebSocket error:', error);
    });
  }

  /**
   * Initialize the adapter
   */
  async initialize() {
    if (this._initialized) return;

    this.options.logger.info('[OneBotAdapter] Initializing...');

    // Validate required config
    if (!this.options.wsUrl) {
      throw new Error('ONEBOT_WS_URL is required');
    }

    // Connect to OneBot
    try {
      await this.client.connect();
      this._initialized = true;
      this._connectionState = 'connected';
      this.options.logger.info('[OneBotAdapter] Initialized successfully');
    } catch (error) {
      this.options.logger.error('[OneBotAdapter] Connection failed:', error);
      throw error;
    }
  }

  /**
   * Shutdown the adapter
   */
  async shutdown() {
    if (!this._initialized) return;

    this._initialized = false;
    try {
      await this.client.disconnect();
    } catch (error) {
      this.options.logger.error('[OneBotAdapter] Disconnect error:', error);
    }
    this._connectionState = 'disconnected';
    this.options.logger.info('[OneBotAdapter] Shutdown complete');
  }

  /**
   * Health check
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

  // ==================== Authentication ====================

  /**
   * Adapter-level authentication
   */
  async authenticate(requestContext = {}) {
    // OneBot uses access_token in WebSocket header for auth
    // Check if token is valid by attempting an API call
    if (!this.options.accessToken) {
      // No token configured, skip auth
      return { authenticated: true, adapterId: this._metadata.id };
    }

    // Check if client is connected
    if (!this.client.isConnected) {
      return {
        authenticated: false,
        adapterId: this._metadata.id,
        error: 'Not connected to OneBot'
      };
    }

    return { authenticated: true, adapterId: this._metadata.id };
  }

  /**
   * Verify OneBot signature ( Hook md5 signature )
   */
  async verifySignature(requestContext = {}) {
    const { headers, rawBody } = requestContext;

    // OneBot 11 can use X-OneBot-Auth header or md5 signature
    const authHeader = headers?.['x-onebot-auth'];
    const signature = headers?.['x-signature'];

    if (!authHeader && !signature) {
      // No auth signature present
      return { valid: true };
    }

    // Validate access token if provided
    if (authHeader) {
      if (authHeader !== this.options.accessToken) {
        return { valid: false, reason: 'Invalid auth token' };
      }
    }

    // Validate md5 signature if provided
    if (signature) {
      const crypto = await import('crypto');
      const secret = process.env.ONEBOT_SECRET || this._metadata.authConfig?.secret;

      if (secret) {
        const computedSignature = crypto
          .createHash('md5')
          .update(JSON.stringify(rawBody) + secret)
          .digest('hex');

        if (computedSignature !== signature) {
          return { valid: false, reason: 'Signature mismatch' };
        }
      }
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

    // OneBot 11 message structure
    const postType = rawPayload.post_type || '';
    const subType = rawPayload.sub_type || '';
    const message_type = rawPayload.message_type || '';
    const message = rawPayload.message || '';
    const rawMessage = rawPayload.raw_message || '';
    const sender = rawPayload.sender || {};
    const time = parseInt(rawPayload.time || 0) * 1000; // Convert to ms

    // Build sender
    const senderNick = sender.card || sender.nickname || 'User';
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

    // Determine conversation type and ID
    let conversationType = 'private';
    let conversationId = null;

    if (message_type === 'group') {
      conversationType = 'group';
      conversationId = String(rawPayload.group_id);
    } else if (message_type === 'private') {
      conversationType = 'private';
      conversationId = senderId;
    }

    // Build client
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

    // Build session
    const session = {
      externalSessionKey: `qq:${conversationType}:${conversationId}`,
      bindingKey: conversationType === 'private'
        ? `qq:${conversationType}:${conversationId}:${senderId}`
        : `qq:${conversationType}:${conversationId}`,
      currentTopicId: null,
      allowCreateTopic: true,
      allowSwitchTopic: true
    };

    // Build payload messages from message sequence
    const payload = {
      messages: []
    };

    // Parse OneBot CQ code format
    const content = this._parseMessageContent(message);
    payload.messages.push({
      role: 'user',
      content
    });

    // Build event
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
      target: null, // Will be resolved by routing layer
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

    if (!this._initialized) {
      throw new Error('Adapter not initialized');
    }

    const { conversationId, conversationType } = sessionDescriptor;

    // Send each platform message as a separate API call
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
   * Send proactive message (notification)
   */
  async sendProactiveMessage(sessionDescriptor, message) {
    this.assertSupports('supportsProactivePush');

    if (!this._initialized) {
      throw new Error('Adapter not initialized');
    }

    const { conversationType, conversationId } = sessionDescriptor;
    const text = typeof message === 'string' ? message : JSON.stringify(message);

    // Parse text into message segments
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
      this.options.logger.error('[OneBotAdapter] proactive message failed:', error);
      throw error;
    }
  }

  // ==================== Platform-Specific Helpers ====================

  /**
   * Send platform message to destination
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

      // Check if URL is local (use CQ code format)
      if (imageUrl && !imageUrl.startsWith('http')) {
        messageSegments.push({ type: 'image', data: { file: imageUrl } });
      } else {
        // For HTTP URLs, use the URL directly
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

    throw new Error(`Unsupported message type: ${platformMessage.type}`);
  }

  /**
   * Encode content part to platform message
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
        // Unsupported type - will be downgraded
        return null;
    }
  }

  /**
   * Parse OneBot CQ code format to content array
   */
  _parseMessageContent(message) {
    const content = [];

    // Handle plain text
    if (typeof message === 'string') {
      content.push({
        type: 'text',
        text: this._decodeCqCode(message)
      });
      return content;
    }

    // Handle message array (OneBot 11 standard format)
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
          content.push({
            type: 'text',
            text: `[Face: ${segment.data?.id || segment.data?.qq}]`
          });
        } else if (segment.type === 'at') {
          const atText = segment.data?.qq === 'all' ? '@全体成员' : `@${segment.data?.qq}`;
          content.push({
            type: 'text',
            text: atText
          });
        } else if (segment.type === 'reply') {
          content.push({
            type: 'text',
            text: `[Reply to message ${segment.data?.id}] `
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
        } else {
          // Unknown segment type, add as text
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
   * Decode CQ code from text
   */
  _decodeCqCode(text) {
    if (!text) return '';

    // Replace CQ code with readable text
    // [CQ:image,file=xxx] -> [Image]
    // [CQ:face,id=123] -> [Face: 123]
    return text.replace(/\[CQ:(\w+)[^\]]*\]/g, (match, type) => {
      switch (type) {
        case 'image':
          return '[Image]';
        case 'face':
          const faceId = match.match(/id=([^,\]]+)/);
          return faceId ? `[Face: ${faceId[1]}]` : '[Face]';
        case 'video':
          return '[Video]';
        case 'record':
          return '[Audio]';
        case 'at':
          return '[At]';
        case 'reply':
          return '[Reply]';
        default:
          return `[${type.toUpperCase()}]`;
      }
    });
  }

  /**
   * Parse text to message segments
   */
  _parseTextToSegments(text) {
    const segments = [];
    const lines = String(text).split('\n');

    for (const line of lines) {
      // Handle URLs - convert to image if it looks like an image URL
      if (this._looksLikeImageUrl(line)) {
        segments.push({ type: 'image', data: { url: line.trim() } });
      } else {
        segments.push({ type: 'text', data: { text: line } });
      }
    }

    return segments;
  }

  /**
   * Check if string looks like an image URL
   */
  _looksLikeImageUrl(str) {
    const trimmed = String(str).trim();
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
    return imageExtensions.some(ext => trimmed.toLowerCase().endsWith(ext)) ||
           trimmed.includes('http') && (trimmed.includes('png') || trimmed.includes('jpg'));
  }

  /**
   * Normalize conversation type
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
export function createOneBotAdapter(config = {}) {
  return new OneBotAdapter(config);
}

export default {
  OneBotAdapter,
  createOneBotAdapter
};

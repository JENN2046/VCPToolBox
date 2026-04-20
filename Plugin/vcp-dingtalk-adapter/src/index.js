/**
 * VCP DingTalk Adapter - Entry Point (New Architecture)
 * 
 * Based on AdapterContract standard interface
 * Supports VCP Channel Hub B2 Protocol
 */

import dotenv from 'dotenv';
dotenv.config();

import { DingTalkAdapter, createDingTalkAdapter } from './adapter/contract.js';
import { createVcpClient } from './adapters/vcp/client.js';

const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  debug: (...args) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[DEBUG]', ...args);
    }
  },
};

async function main() {
  logger.info('='.repeat(60));
  logger.info('🚀 VCP DingTalk Adapter (New Architecture) Starting...');
  logger.info('='.repeat(60));

  // ==================== 配置加载 ====================
  const config = {
    // 钉钉配置
    appKey: process.env.DING_APP_KEY,
    appSecret: process.env.DING_APP_SECRET,
    
    // VCP Channel Hub 配置
    useBridge: process.env.VCP_USE_CHANNEL_BRIDGE === 'true',
    bridgeUrl: process.env.VCP_CHANNEL_BRIDGE_URL,
    bridgeKey: process.env.VCP_CHANNEL_BRIDGE_KEY,
    bridgeAuthToken: process.env.VCP_CHANNEL_BRIDGE_BEARER || process.env.VCP_SERVER_KEY || '',
    bridgeVersion: process.env.VCP_CHANNEL_HUB_VERSION || 'b2',
    adapterId: process.env.VCP_ADAPTER_ID || 'dingtalk-adapter-01',
    
    // Agent 配置
    agentName: process.env.VCP_AGENT_NAME,
    agentDisplayName: process.env.VCP_AGENT_DISPLAY_NAME,
    
    // 回退配置
    baseUrl: process.env.VCP_BASE_URL,
    apiKey: process.env.VCP_API_KEY,
    model: process.env.VCP_MODEL || 'Nova',
    timeoutMs: parseInt(process.env.VCP_TIMEOUT_MS || '120000', 10),
  };

  // 验证必要配置
  if (!config.appKey || !config.appSecret) {
    throw new Error('Missing DING_APP_KEY or DING_APP_SECRET');
  }

  logger.info('📋 Configuration loaded:', {
    adapterId: config.adapterId,
    bridgeVersion: config.bridgeVersion,
    agentName: config.agentName,
    useBridge: config.useBridge,
  });

  // ==================== 初始化组件 ====================
  
  // 1. 创建 DingTalk 适配器实例
  const adapter = createDingTalkAdapter({
    options: {
      appKey: config.appKey,
      appSecret: config.appSecret,
      logger,
    },
  });

  // 2. 创建 VCP 客户端实例
  const vcpClient = createVcpClient({
    useBridge: config.useBridge,
    bridgeUrl: config.bridgeUrl,
    bridgeKey: config.bridgeKey,
    bridgeAuthToken: config.bridgeAuthToken,
    bridgeVersion: config.bridgeVersion,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    defaultAgentName: config.agentName,
    defaultAgentDisplayName: config.agentDisplayName,
    timeoutMs: config.timeoutMs,
    logger,
  });

  // 调试：输出 token 状态
  logger.info('[DEBUG] bridgeAuthToken from config:', config.bridgeAuthToken ? 'SET' : 'EMPTY');
  logger.info('[DEBUG] process.env.VCP_CHANNEL_BRIDGE_BEARER:', process.env.VCP_CHANNEL_BRIDGE_BEARER ? 'SET' : 'EMPTY');
  logger.info('[DEBUG] config.bridgeAuthToken value:', config.bridgeAuthToken);
  logger.info('[DEBUG] process.env.VCP_CHANNEL_BRIDGE_BEARER value:', process.env.VCP_CHANNEL_BRIDGE_BEARER);

  // 3. 初始化适配器
  logger.info('🔧 Initializing DingTalk Adapter...');
  await adapter.initialize();
  logger.info('✓ DingTalk Adapter initialized successfully');

  // 4. 健康检查
  const health = await adapter.healthCheck();
  logger.info('🏥 Health check:', health);

  if (!health.healthy) {
    logger.warn('⚠️ Adapter health check failed, but continuing...');
  }

  // ==================== 消息处理回调 ====================
  
  /**
   * 处理钉钉消息 → 转发到 VCP
   */
  async function handleDingTalkMessage(rawPayload) {
    const requestId = rawPayload?.msgId || rawPayload?.messageId || `dt_${Date.now()}`;
    
    try {
      logger.info('📨 Received DingTalk message:', {
        requestId,
        msgtype: rawPayload?.msgtype,
        conversationId: rawPayload?.data?.conversationId,
      });

      // 1. 使用适配器解码入站消息
      const event = await adapter.decodeInbound(rawPayload, {
        sourceIp: null,
        traceId: requestId,
      });

      logger.info('📦 Decoded event:', {
        eventId: event.eventId,
        eventType: event.eventType,
        sessionKey: event.session?.externalSessionKey,
        messageCount: event.payload?.messages?.length,
      });

      // 2. 提取消息内容
      const userMessage = event.payload.messages[0];
      const messageContent = userMessage?.content || [];

      // 3. 发送到 VCP Channel Hub
      logger.info('📤 Sending to VCP Channel Hub...');
      const vcpResponse = await vcpClient.sendMessage({
        agentName: config.agentName,
        agentDisplayName: config.agentDisplayName,
        externalSessionKey: event.session.externalSessionKey,
        message: messageContent,
        metadata: {
          ...event.metadata.platformData,
          conversationId: event.client.conversationId,
          conversationType: event.client.conversationType,
          userId: event.sender.userId,
          senderNick: event.sender.nick,
          messageId: event.client.messageId,
        },
      });

      logger.info('📥 VCP response received');

      // 4. 提取回复内容
      const richReply = vcpClient.extractRichReply(vcpResponse);
      
      logger.info('💬 Reply content:', {
        textLength: richReply.text?.length || 0,
        imageCount: richReply.images?.length || 0,
        fileCount: richReply.files?.length || 0,
      });

      // 5. Bridge 模式下由 ChannelHub DeliveryOutbox 负责出站投递，避免本地重复发送
      if (config.useBridge) {
        logger.info('↪ Reply delivery delegated to ChannelHub outbound pipeline', {
          requestId,
          status: vcpResponse?.status || 'unknown',
          jobId: vcpResponse?.jobId || null,
        });
      } else if (richReply.text || richReply.images?.length > 0 || richReply.files?.length > 0) {
        await sendReplyToDingTalk(event, richReply);
      }

      return { success: true, requestId };
    } catch (error) {
      logger.error('❌ Failed to process message:', error);
      // 发送错误通知
      await sendErrorNotification(rawPayload, error.message);
      return { success: false, requestId, error: error.message };
    }
  }

  /**
   * 发送回复到钉钉
   */
  async function sendReplyToDingTalk(event, richReply) {
    try {
      // 构建标准回复格式
      const messages = [];

      // 添加文本
      if (richReply.text) {
        messages.push({
          type: 'text',
          content: richReply.text,
        });
      }

      // 添加图片
      if (richReply.images && richReply.images.length > 0) {
        for (const img of richReply.images) {
          messages.push({
            type: 'image_url',
            image_url: {
              url: img.source,
              fileName: img.fileName || 'image.jpg',
            },
          });
        }
      }

      // 添加文件
      if (richReply.files && richReply.files.length > 0) {
        for (const file of richReply.files) {
          messages.push({
            type: 'file',
            url: file.source,
            fileName: file.fileName || 'file',
          });
        }
      }

      // 构建会话描述符
      const sessionDescriptor = {
        conversationId: event.client.conversationId,
        conversationType: event.client.conversationType,
        bindingKey: event.session.bindingKey,
        externalSessionKey: event.session.externalSessionKey,
        metadata: event.metadata.platformData,
      };

      logger.info('📮 Sending reply to DingTalk:', {
        conversationId: sessionDescriptor.conversationId,
        conversationType: sessionDescriptor.conversationType,
        messageCount: messages.length,
      });

      // 通过适配器发送
      const sendResult = await adapter.sendBySession(sessionDescriptor, messages, {
        metadata: event.metadata.platformData,
      });

      logger.info('✓ Reply sent successfully:', sendResult);
      return sendResult;
    } catch (error) {
      logger.error('❌ Failed to send reply:', error);
      throw error;
    }
  }

  /**
   * 发送错误通知
   */
  async function sendErrorNotification(rawPayload, errorMessage) {
    try {
      const sessionWebhook = rawPayload?.data?.sessionWebhook;

      if (!sessionWebhook) {
        logger.warn('⚠️ Cannot send error notification: no sessionWebhook');
        return;
      }

      // 使用简单的 sessionWebhook 发送错误消息
      const errorPayload = {
        msgtype: 'text',
        text: {
          content: `⚠️ 消息处理失败：${errorMessage}`,
        },
      };

      await fetch(sessionWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorPayload),
      });

      logger.info('✓ Error notification sent');
    } catch (error) {
      logger.error('❌ Failed to send error notification:', error);
    }
  }

  // ==================== 启动 Stream 接收器 ====================
  
  logger.info('🔌 Starting DingTalk Stream connection...');
  
  const { startStreamReceiver } = await import('./adapters/dingtalk/streamReceiver.js');
  
  const streamClient = await startStreamReceiver({
    onMessage: async (message) => {
      await handleDingTalkMessage(message);
    },
    onCardAction: async (action) => {
      logger.info('🎴 Card action received:', action);
    },
    logger,
  });

  // ==================== 完成启动 ====================
  
  logger.info('='.repeat(60));
  logger.info('✅ VCP DingTalk Adapter is ready!');
  logger.info('📡 Waiting for DingTalk messages...');
  logger.info('='.repeat(60));

  // 优雅退出处理
  process.on('SIGINT', async () => {
    logger.info('👋 Shutting down...');
    await adapter.shutdown();
    streamClient.close?.();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('👋 Shutting down...');
    await adapter.shutdown();
    streamClient.close?.();
    process.exit(0);
  });
}

// 启动应用
main().catch((error) => {
  console.error('[FATAL] Adapter failed to start:', error);
  process.exit(1);
});

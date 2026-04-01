/**
 * ChannelHubService.js
 * 
 * ChannelHub主编排服务 - 统一入口点
 * 
 * 职责：
 * - 统一初始化所有子模块
 * - 协调入站事件处理流水线
 * - 协调出站消息投递流水线
 * - 提供健康检查和状态查询接口
 * - 管理适配器生命周期
 * - 提供优雅关闭机制
 * 
 * 流水线：
 * Inbound: Webhook -> AdapterAuth -> B1CompatTranslator -> EventSchemaValidator
 *          -> EventDeduplicator -> MessageNormalizer -> SessionBindingStore 
 *          -> AgentRoutingPolicy -> RuntimeGateway -> ReplyNormalizer -> DeliveryOutbox
 * 
 * Outbound: DeliveryOutbox -> CapabilityDowngrader -> MediaGateway -> Adapter
 */

const EventEmitter = require('events');
const path = require('path');

// 导入所有子模块
const Constants = require('./constants');
const Errors = require('./errors');
const Utils = require('./utils');
const StateStore = require('./StateStore');
const AdapterRegistry = require('./AdapterRegistry');
const AdapterAuthManager = require('./AdapterAuthManager');
const SignatureValidator = require('./SignatureValidator');
const EventSchemaValidator = require('./EventSchemaValidator');
const B1CompatTranslator = require('./B1CompatTranslator');
const EventDeduplicator = require('./EventDeduplicator');
const MessageNormalizer = require('./MessageNormalizer');
const SessionBindingStore = require('./SessionBindingStore');
const IdentityMappingStore = require('./IdentityMappingStore');
const AgentRoutingPolicy = require('./AgentRoutingPolicy');
const RuntimeGateway = require('./RuntimeGateway');
const ReplyNormalizer = require('./ReplyNormalizer');
const CapabilityRegistry = require('./CapabilityRegistry');
const CapabilityDowngrader = require('./CapabilityDowngrader');
const MediaGateway = require('./MediaGateway');
const DeliveryOutbox = require('./DeliveryOutbox');
const AuditLogger = require('./AuditLogger');
const MetricsCollector = require('./MetricsCollector');

/**
 * ChannelHubService 主服务类
 */
class ChannelHubService extends EventEmitter {
  /**
   * @param {Object} options - 配置选项
   * @param {Object} options.config - 全局配置
   * @param {Object} options.logger - 日志实例
   * @param {Object} options.chatCompletionHandler - VCP ChatCompletionHandler 实例
   * @param {Object} options.pluginManager - VCP PluginManager 实例
   */
  constructor(options = {}) {
    super();
    
    this.options = options;
    this.config = options.config || {};
    // 规范化 logger：兼容 VCP logger 模块（无 .log）和原生 console（有 .log）
    const rawLogger = options.logger || console;
    this.logger = rawLogger.log
      ? rawLogger  // console 或已有 .log 的 logger，直接用
      : Object.assign(Object.create(rawLogger), {
          log: (...args) => rawLogger.info(...args)  // VCP logger 没有 .log，代理到 .info
        });
    this.chatCompletionHandler = options.chatCompletionHandler;
    this.pluginManager = options.pluginManager;
    
    // 服务状态
    this.initialized = false;
    this.starting = false;
    this.stopping = false;
    
    // 子模块实例（公开访问，供路由层使用）
    this.stateStore = null;
    this.adapterRegistry = null;
    this.adapterAuthManager = null;
    this.signatureValidator = null;
    this.eventSchemaValidator = null;
    this.b1CompatTranslator = null;
    this.eventDeduplicator = null;
    this.messageNormalizer = null;
    this.sessionBindingStore = null;
    this.identityMappingStore = null;
    this.agentRoutingPolicy = null;
    this.runtimeGateway = null;
    this.replyNormalizer = null;
    this.capabilityRegistry = null;
    this.capabilityDowngrader = null;
    this.mediaGateway = null;
    this.deliveryOutbox = null;
    this.auditLogger = null;
    this.metricsCollector = null;
    
    // 绑定方法
    this.handleInboundEvent = this.handleInboundEvent.bind(this);
    this.processOutboundJob = this.processOutboundJob.bind(this);
  }

  /**
   * 向后兼容：admin 路由仍按 channelHubService.modules.xxx 取模块
   */
  get modules() {
    return {
      stateStore: this.stateStore,
      adapterRegistry: this.adapterRegistry,
      adapterAuthManager: this.adapterAuthManager,
      signatureValidator: this.signatureValidator,
      eventSchemaValidator: this.eventSchemaValidator,
      b1CompatTranslator: this.b1CompatTranslator,
      eventDeduplicator: this.eventDeduplicator,
      messageNormalizer: this.messageNormalizer,
      sessionBindingStore: this.sessionBindingStore,
      identityMappingStore: this.identityMappingStore,
      agentRoutingPolicy: this.agentRoutingPolicy,
      runtimeGateway: this.runtimeGateway,
      replyNormalizer: this.replyNormalizer,
      capabilityRegistry: this.capabilityRegistry,
      capabilityDowngrader: this.capabilityDowngrader,
      mediaGateway: this.mediaGateway,
      deliveryOutbox: this.deliveryOutbox,
      auditLogger: this.auditLogger,
      metricsCollector: this.metricsCollector
    };
  }

  getModule(moduleName) {
    if (!moduleName) {
      return null;
    }

    return this[moduleName] || this.modules[moduleName] || null;
  }
  
  /**
   * 初始化服务
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      throw new Errors.ChannelHubError('Service already initialized');
    }
    
    if (this.starting) {
      throw new Errors.ChannelHubError('Service is starting');
    }
    
    this.starting = true;
    this.logger.log('[ChannelHub] Starting initialization...');
    
    try {
      // 1. 初始化基础设施层
      await this._initializeInfrastructure();
      
      // 2. 初始化安全与验证层
      this._initializeSecurity();
      
      // 3. 初始化入站处理层
      this._initializeInboundPipeline();
      
      // 4. 初始化上下文与路由层
      await this._initializeContextRouting();
      
      // 5. 初始化出站处理层
      await this._initializeOutboundPipeline();
      
      // 6. 初始化监控与审计层
      await this._initializeMonitoring();
      
      this.initialized = true;
      this.starting = false;
      
      this.logger.log('[ChannelHub] Initialization complete');
      this.emit('initialized');
      
    } catch (error) {
      this.starting = false;
      this.logger.error('[ChannelHub] Initialization failed:', error);
      throw error;
    }
  }
  
  // ==================== 初始化各层 ====================
  
  async _initializeInfrastructure() {
    this.logger.log('[ChannelHub] Initializing infrastructure...');
    
    this.stateStore = new StateStore({
      baseDir: this.config.baseDir,
      debugMode: this.config.debugMode
    });
    await this.stateStore.initialize();
    
    this.adapterRegistry = new AdapterRegistry({
      stateStore: this.stateStore,
      logger: this.logger,
      debugMode: this.config.debugMode
    });
    await this.adapterRegistry.initialize();
    
    this.adapterAuthManager = new AdapterAuthManager({
      adapterRegistry: this.adapterRegistry,
      stateStore: this.stateStore,
      config: this.config,
      debugMode: this.config.debugMode
    });
    await this.adapterAuthManager.initialize();
  }
  
  _initializeSecurity() {
    this.logger.log('[ChannelHub] Initializing security...');
    
    this.signatureValidator = new SignatureValidator({
      stateStore: this.stateStore,
      adapterRegistry: this.adapterRegistry,
      config: {
        timestampTolerance: this.config.timestampTolerance || 300000,
        nonceTTL: this.config.nonceTTL || 300000
      }
    });
    
    this.eventSchemaValidator = new EventSchemaValidator({
      strictMode: this.config.strictSchemaMode || false
    });
    
    this.b1CompatTranslator = new B1CompatTranslator({
      debugMode: this.config.debugMode
    });
    
    this.eventDeduplicator = new EventDeduplicator({
      stateStore: this.stateStore,
      ttlMs: this.config.dedupTTL || Constants.DEDUP_TTL_MS,
      debugMode: this.config.debugMode
    });
  }
  
  _initializeInboundPipeline() {
    this.logger.log('[ChannelHub] Initializing inbound pipeline...');
    
    this.messageNormalizer = new MessageNormalizer({
      debugMode: this.config.debugMode
    });
  }
  
  async _initializeContextRouting() {
    this.logger.log('[ChannelHub] Initializing context and routing...');
    
    this.sessionBindingStore = new SessionBindingStore({
      stateStore: this.stateStore,
      debugMode: this.config.debugMode
    });
    await this.sessionBindingStore.initialize();
    
    this.identityMappingStore = new IdentityMappingStore({
      stateStore: this.stateStore,
      debugMode: this.config.debugMode
    });
    
    this.agentRoutingPolicy = new AgentRoutingPolicy({
      sessionBindingStore: this.sessionBindingStore,
      debugMode: this.config.debugMode
    });
    
    this.runtimeGateway = new RuntimeGateway({
      chatCompletionHandler: this.chatCompletionHandler,
      pluginManager: this.pluginManager,
      config: this.config,
      debugMode: this.config.debugMode
    });
    
    this.replyNormalizer = new ReplyNormalizer({
      debugMode: this.config.debugMode
    });
  }
  
  async _initializeOutboundPipeline() {
    this.logger.log('[ChannelHub] Initializing outbound pipeline...');
    
    this.capabilityRegistry = new CapabilityRegistry({
      adapterRegistry: this.adapterRegistry,
      logger: this.logger
    });
    
    this.capabilityDowngrader = new CapabilityDowngrader({
      capabilityRegistry: this.capabilityRegistry,
      logger: this.logger
    });
    
    this.mediaGateway = new MediaGateway({
      storagePath: this.config.mediaStoragePath || './state/channelHub/media',
      baseUrl: this.config.mediaBaseUrl || '/media'
    });
    await this.mediaGateway.initialize();
    
    this.deliveryOutbox = new DeliveryOutbox({
      store: this.stateStore,
      logger: this.logger,
      maxAttempts: this.config.maxDeliveryAttempts || 5,
      baseRetryDelay: this.config.baseRetryDelay || 1000,
      maxRetryDelay: this.config.maxRetryDelay || 60000
    });
    await this.deliveryOutbox.initialize();

    // 将出站队列与实际处理逻辑接通
    this.deliveryOutbox.on('batch:ready', async (jobs) => {
      for (const job of jobs) {
        try {
          await this.deliveryOutbox.markProcessing(job.jobId);
          const result = await this.processOutboundJob(job);
          await this.deliveryOutbox.markSuccess(job.jobId, result || { success: true });
        } catch (error) {
          this.logger.error('[ChannelHub] Outbound job failed:', error);
          await this.deliveryOutbox.markFailed(job.jobId, error);
        }
      }
    });
  }
  
  async _initializeMonitoring() {
    this.logger.log('[ChannelHub] Initializing monitoring...');
    
    this.auditLogger = new AuditLogger({
      logDir: this.config.auditLogDir || './state/channelHub/logs',
      enableConsole: this.config.debugMode || false
    });
    await this.auditLogger.initialize();
    
    this.metricsCollector = new MetricsCollector({
      logger: this.logger
    });
    await this.metricsCollector.initialize();
  }
  
  // ==================== 入站处理主流程 ====================

  /**
   * 处理入站事件 - 主入口
   *
   * @param {string} adapterId - 适配器ID
   * @param {Object} rawEvent - 原始事件数据（B1 或 B2 格式）
   * @param {Object} context - 请求上下文
   * @param {string} [context.traceId] - 追踪 ID
   * @param {Object} [context.headers] - 原始请求头
   * @param {string} [context.sourceIp] - 来源 IP
   * @returns {Promise<Object>} 处理结果
   */
  async handleInboundEvent(adapterId, rawEvent, context = {}) {
    const startTime = Date.now();
    const traceId = context.traceId || this.auditLogger.generateTraceId();

    try {
      // 记录入站事件
      this.metricsCollector.recordEventReceived(adapterId, rawEvent.channel || 'unknown');

      // 1. B1 兼容翻译（如果需要）
      let envelope = rawEvent;
      if (this._isB1Format(rawEvent)) {
        envelope = this.b1CompatTranslator.translateRequest(rawEvent, context.headers || {});
      }

      // 2. 使用 AdapterContract 解码（如果可用）
      envelope = await this._decodeInboundWithAdapter(adapterId, envelope, context);

      // 3. 验证适配器签名（如果可用）
      await this._verifyAdapterSignature(adapterId, envelope, context);

      // 4. Schema 校验与归一化
      const validation = this.eventSchemaValidator.validateAndNormalize(envelope);
      if (!validation.valid) {
        throw new Errors.EventValidationError(
          `Schema validation failed: ${validation.errors.join('; ')}`,
          { details: validation.errors }
        );
      }
      envelope = validation.envelope;

      // 5. 事件去重
      const dedupResult = await this.eventDeduplicator.checkAndMark(envelope);
      if (dedupResult.isDuplicate) {
        this.logger.log(`[ChannelHub] Duplicate event detected: ${envelope.eventId}`);
        this.metricsCollector.incrementCounter('events_deduplicated', 1, { adapterId });
        return { status: 'duplicate', eventId: envelope.eventId };
      }

      // 6. 消息归一化
      const normalizedMessages = this.messageNormalizer.normalizeMessages(envelope);
      envelope.payload.messages = normalizedMessages;

      // 7. 解析/创建会话绑定
      const sessionBinding = await this.sessionBindingStore.resolveBinding(envelope);

      // 8. 解析/创建身份映射
      const identityMapping = await this.identityMappingStore.findOrCreateIdentity({
        platform: envelope.channel,
        platformUserId: envelope.sender?.userId || 'unknown',
        displayName: envelope.sender?.nick || 'User',
        metadata: { adapterId }
      });

      // 9. Agent 路由决策
      const routeDecision = await this.agentRoutingPolicy.resolveRoute(envelope, sessionBinding);

      // 10. 审计：记录入站事件
      this.auditLogger.logInboundEvent(envelope, traceId, {
        adapterId,
        routeDecision: {
          agentId: routeDecision.agentId,
          topicId: routeDecision.topicId,
          reason: routeDecision.routeReason
        }
      });

      // 11. 调用 Runtime
      const runtimeResponse = await this.runtimeGateway.invoke(envelope, routeDecision);

      // 12. 归一化回复
      const normalizedReply = this.replyNormalizer.normalize(runtimeResponse, {
        requestId: envelope.requestId || envelope.eventId,
        agentId: routeDecision.agentId,
        sessionKey: sessionBinding.bindingKey,
        resolvedTopicId: routeDecision.topicId
      });

      // 13. 更新会话活跃时间
      await this.sessionBindingStore.touchSession(sessionBinding.bindingKey);

      // 14. 投递到出站队列
      const jobId = await this.deliveryOutbox.enqueue({
        adapterId,
        channel: envelope.channel,
        payload: normalizedReply,
        session: {
          bindingKey: sessionBinding.bindingKey,
          externalSessionKey: sessionBinding.externalSessionKey || envelope.session?.externalSessionKey || sessionBinding.bindingKey,
          conversationId: sessionBinding.conversationId || envelope.client?.conversationId || null,
          conversationType: sessionBinding.conversationType || envelope.client?.conversationType || null,
          userId: sessionBinding.userId || envelope.sender?.userId || null
        },
        target: {
          agentId: routeDecision.agentId || null,
          topicId: routeDecision.topicId || null
        },
        metadata: {
          traceId,
          requestId: envelope.requestId || envelope.eventId,
          sourceMessageId: envelope.client?.messageId || null
        },
        priority: Constants.PRIORITY.NORMAL
      });
      
      // 记录成功
      const duration = Date.now() - startTime;
      this.auditLogger.logRuntimeInvocation(
        traceId, routeDecision.agentId, sessionBinding.bindingKey,
        { model: routeDecision.model, messageCount: normalizedMessages.length },
        { success: true, finishReason: 'stop', usage: normalizedReply.usage },
        duration
      );
      this.metricsCollector.recordEventProcessed(adapterId, envelope.channel, duration);
      
      return {
        status: 'success',
        jobId,
        eventId: envelope.eventId,
        sessionId: sessionBinding.bindingKey,
        reply: normalizedReply
      };
      
    } catch (error) {
      // 记录失败
      const duration = Date.now() - startTime;
      this.auditLogger.logError(traceId, error, { adapterId, phase: 'inbound' });
      this.metricsCollector.recordEventFailed(adapterId, rawEvent.channel || 'unknown', error);
      
      this.logger.error(`[ChannelHub] Inbound event error: ${error.message}`, error);
      
      throw error;
    }
  }
  
  // ==================== 出站处理主流程 ====================

  /**
   * 处理出站任务
   * @param {Object} job - 出站任务
   * @returns {Promise<Object>}
   */
  async processOutboundJob(job) {
    const startTime = Date.now();
    const traceId = this.auditLogger.generateTraceId();

    try {
      this.metricsCollector.incrementCounter('outbound_jobs_total', 1, { adapterId: job.adapterId });

      const adapterConfig = await this.adapterRegistry.getAdapter(job.adapterId);
      if (!adapterConfig) {
        throw new Errors.AdapterNotFoundError(`Adapter not found: ${job.adapterId}`);
      }

      let adapterInstance = this.adapterRegistry.getAdapterInstance(job.adapterId);
      if (!adapterInstance) {
        // 尝试从 AdapterContract 动态创建实例
        this.logger.log(`[ChannelHub] Adapter instance not found, attempting to create from contract: ${job.adapterId}`);
        adapterInstance = await this._createAdapterInstanceFromContract(adapterConfig);
        if (!adapterInstance) {
          throw new Errors.DeliveryError(`Adapter runtime instance not found and could not be created: ${job.adapterId}`, {
            code: 'NOT_FOUND',
            retryable: false,
            details: { adapterId: job.adapterId }
          });
        }
      }

      const capabilities = await this.capabilityRegistry.getProfile(job.adapterId);
      const deliverySession = await this._resolveDeliverySession(job);
      const deliverableReply = JSON.parse(JSON.stringify(job.payload || {}));

      if (Array.isArray(deliverableReply.messages)) {
        for (const msg of deliverableReply.messages) {
          if (!Array.isArray(msg.content)) continue;

          msg.content = msg.content.map((part) => {
            const result = this.capabilityDowngrader.downgradePart(part, job.channel, capabilities);
            return result.part;
          });
        }
      }

      this.auditLogger.logOutboundDelivery(traceId, job, 'PROCESSING');
      this.metricsCollector.recordOutboundMessage(job.adapterId, job.channel, {
        parts: deliverableReply.messages?.length || 0
      });

      const deliveryResult = await this._deliverViaAdapterInstance(adapterInstance, {
        traceId,
        job,
        adapterConfig,
        reply: deliverableReply,
        session: deliverySession,
        capabilities
      });

      const duration = Date.now() - startTime;
      this.auditLogger.logOutboundDelivery(traceId, job, 'DELIVERED', {
        success: true,
        duration,
        result: deliveryResult || null
      });
      this.metricsCollector.incrementCounter('outbound_jobs_success', 1, { adapterId: job.adapterId });

      return deliveryResult || { success: true, deliveredAt: new Date().toISOString() };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.auditLogger.logOutboundDelivery(traceId, job, 'FAILED', {
        success: false,
        error: error.message,
        duration
      });
      this.metricsCollector.incrementCounter('outbound_jobs_error', 1, { adapterId: job.adapterId });
      throw error;
    }
  }

  async _resolveDeliverySession(job) {
    if (job.session?.bindingKey && this.sessionBindingStore?.get) {
      const persisted = await this.sessionBindingStore.get(job.session.bindingKey);
      if (persisted) {
        return {
          ...persisted,
          ...job.session
        };
      }
    }

    return job.session || null;
  }

  async _deliverViaAdapterInstance(adapterInstance, payload) {
    const candidateMethods = ['sendBySession', 'deliver', 'sendReply', 'sendMessage'];

    for (const methodName of candidateMethods) {
      if (typeof adapterInstance?.[methodName] !== 'function') {
        continue;
      }

      let outboundPayload = payload.reply;
      if (methodName === 'sendBySession' && typeof adapterInstance?.encodeOutbound === 'function') {
        outboundPayload = await adapterInstance.encodeOutbound(payload.reply, payload);
      }

      if (adapterInstance[methodName].length >= 2) {
        return adapterInstance[methodName](payload.session, outboundPayload, payload);
      }

      return adapterInstance[methodName](payload);
    }

    throw new Errors.DeliveryError('Adapter instance does not implement a supported outbound method', {
      code: 'NOT_FOUND',
      retryable: false,
      details: {
        supportedMethods: candidateMethods,
        availableMethods: Object.keys(adapterInstance || {}).filter(
          (key) => typeof adapterInstance[key] === 'function'
        )
      }
    });
  }

  /**
   * 从 AdapterContract 动态创建适配器实例
   * @param {Object} adapterConfig - 适配器配置
   * @returns {Promise<Object|null>} AdapterContract 实例或 null
   */
  async _createAdapterInstanceFromContract(adapterConfig) {
    if (!adapterConfig?.adapterId || !adapterConfig?.channel) {
      return null;
    }

    const { adapterId, channel } = adapterConfig;

    try {
      let adapterModulePath;
      let adapterExportName;

      // 根据 channel 确定适配器路径和导出名称
      switch (channel) {
        case 'dingtalk':
          adapterModulePath = '../../Plugin/vcp-dingtalk-adapter/src/adapter/contract.js';
          adapterExportName = 'DingTalkAdapter';
          break;
        case 'wecom':
        case 'wework':
          adapterModulePath = '../../Plugin/vcp-wecom-adapter/src/adapter/contract.js';
          adapterExportName = 'WecomAdapter';
          break;
        case 'qq':
        case 'onebot':
          adapterModulePath = '../../Plugin/vcp-onebot-adapter/src/adapter/contract.js';
          adapterExportName = 'OneBotAdapter';
          break;
        default:
          return null;
      }

      // 使用动态 import 加载适配器模块
      // 注意：Node.js require 不支持动态路径，使用 import() 需要绝对路径
      const absoluteModulePath = path.resolve(__dirname, adapterModulePath);
const moduleUrl = `file://${absoluteModulePath}`;
      const module = await import(moduleUrl);

      const AdapterClass = module[adapterExportName] || module.default?.[adapterExportName];
      if (!AdapterClass) {
        this.logger.warn(`[ChannelHub] Adapter class ${adapterExportName} not found in ${adapterModulePath}`);
        return null;
      }

      // 创建实例
      const adapterInstance = new AdapterClass({
        metadata: {
          id: adapterId,
          channel,
          displayName: adapterConfig.displayName || adapterConfig.name || `${channel}-adapter`,
          transportMode: adapterConfig.transportMode || 'http_webhook',
          sessionGrammar: adapterConfig.sessionGrammar || `${channel}:{conversationType}:{conversationId}`,
          capabilities: adapterConfig.capabilities || adapterConfig.capabilityProfile || {}
        },
        options: {
          logger: this.logger,
          ...(adapterConfig.config || {}),
          ...(adapterConfig.options || {})
        }
      });

      // 初始化适配器
      await adapterInstance.initialize();

      // 注册到适配器注册中心
      this.adapterRegistry.registerAdapterInstance(adapterId, adapterInstance);

      this.logger.log(`[ChannelHub] Created adapter instance for ${adapterId} (${channel})`);
      return adapterInstance;
    } catch (error) {
      this.logger.error(`[ChannelHub] Failed to create adapter instance for ${adapterId}:`, error);
      return null;
    }
  }

  _isB1Format(event) {
    // B1 格式特征：没有 version 字段，有 platform/payload 或直接有 agentId + messages
    return event && !event.version && (
      (event.platform && event.payload) ||
      (event.agentId && event.messages)
    );
  }

  /**
   * 使用 AdapterContract 解码入站事件
   * @param {string} adapterId - 适配器ID
   * @param {Object} envelope - 事件信封
   * @param {Object} context - 请求上下文
   * @returns {Promise<Object>} 解码后的事件信封
   */
  async _decodeInboundWithAdapter(adapterId, envelope, context = {}) {
    // 如果已经是 B2 格式（有 version 字段），跳过 AdapterContract 解码
    if (envelope.version) {
      return envelope;
    }

    try {
      const adapterConfig = await this.adapterRegistry.getAdapter(adapterId);
      if (!adapterConfig) {
        this.logger.warn(`[ChannelHub] Adapter not found: ${adapterId}, skipping decodeInbound`);
        return envelope;
      }

      const adapterInstance = this.adapterRegistry.getAdapterInstance(adapterId);
      if (!adapterInstance) {
        // 尝试动态创建实例
        this.logger.log(`[ChannelHub] Adapter instance not found, attempting to create for decode: ${adapterId}`);
        const createdInstance = await this._createAdapterInstanceFromContract(adapterConfig);
        if (createdInstance) {
          // 使用新创建的实例解码
          return await createdInstance.decodeInbound(envelope, context);
        }
        this.logger.warn(`[ChannelHub] Could not create adapter instance for decode: ${adapterId}`);
        return envelope;
      }

      // 使用现有实例解码
      return await adapterInstance.decodeInbound(envelope, context);
    } catch (error) {
      this.logger.error(`[ChannelHub] decodeInbound failed for ${adapterId}:`, error);
      // 解码失败时返回原始 envelope，让后续流程处理
      return envelope;
    }
  }

  /**
   * 验证适配器签名
   * @param {string} adapterId - 适配器ID
   * @param {Object} envelope - 事件信封
   * @param {Object} context - 请求上下文
   * @returns {Promise<void>}
   */
  async _verifyAdapterSignature(adapterId, envelope, context = {}) {
    try {
      const adapterInstance = this.adapterRegistry.getAdapterInstance(adapterId);
      if (!adapterInstance?.verifySignature) {
        // 适配器未加载或不支持签名验证，跳过
        return;
      }

      // 构建 requestContext 用于签名验证
      const requestContext = {
        headers: context.headers || {},
        query: context.query || {},
        rawBody: context.rawBody || null,
        sourceIp: context.sourceIp || null
      };

      const result = await adapterInstance.verifySignature(requestContext);
      if (!result.valid) {
        this.logger.warn(`[ChannelHub] Signature validation failed for ${adapterId}: ${result.reason}`);
        // 签名验证失败，但不阻断流程（由业务层决定）
      } else {
        this.logger.debug(`[ChannelHub] Signature validation passed for ${adapterId}`);
      }
    } catch (error) {
      this.logger.error(`[ChannelHub] verifySignature failed for ${adapterId}:`, error);
      // 签名验证异常不影响主流程
    }
  }
  
  /**
   * 注册适配器
   */
  async registerAdapter(adapterId, config) {
    const result = await this.adapterRegistry.upsertAdapter({
      adapterId,
      ...config
    });
    this.auditLogger.logAdapterStatusChange(adapterId, 'registered', config);
    return result;
  }
  
  /**
   * 注销适配器
   */
  async unregisterAdapter(adapterId) {
    await this.adapterRegistry.disableAdapter(adapterId);
    this.auditLogger.logAdapterStatusChange(adapterId, 'unregistered');
  }
  
  /**
   * 获取服务健康状态
   */
  getHealthStatus() {
    return {
      initialized: this.initialized,
      uptime: process.uptime(),
      modules: {
        stateStore: !!this.stateStore,
        adapterRegistry: !!this.adapterRegistry,
        adapterAuthManager: !!this.adapterAuthManager,
        signatureValidator: !!this.signatureValidator,
        eventSchemaValidator: !!this.eventSchemaValidator,
        b1CompatTranslator: !!this.b1CompatTranslator,
        eventDeduplicator: !!this.eventDeduplicator,
        messageNormalizer: !!this.messageNormalizer,
        sessionBindingStore: !!this.sessionBindingStore,
        identityMappingStore: !!this.identityMappingStore,
        agentRoutingPolicy: !!this.agentRoutingPolicy,
        runtimeGateway: !!this.runtimeGateway,
        replyNormalizer: !!this.replyNormalizer,
        capabilityRegistry: !!this.capabilityRegistry,
        capabilityDowngrader: !!this.capabilityDowngrader,
        mediaGateway: !!this.mediaGateway,
        deliveryOutbox: !!this.deliveryOutbox,
        auditLogger: !!this.auditLogger,
        metricsCollector: !!this.metricsCollector
      },
      metrics: this.metricsCollector?.getSummary() || {},
      adapters: this.adapterRegistry?._cache?.size || 0,
      sessions: this.sessionBindingStore?.getStats() || {},
      outbox: this.deliveryOutbox?.getStats() || {}
    };
  }
  
  /**
   * 优雅关闭
   */
  async shutdown() {
    if (!this.initialized) return;
    if (this.stopping) {
      throw new Errors.ChannelHubError('Service is already stopping');
    }
    
    this.stopping = true;
    this.logger.log('[ChannelHub] Starting graceful shutdown...');
    
    try {
      this.emit('stopping');
      
      // 停止出站队列
      if (this.deliveryOutbox) {
        this.deliveryOutbox.stop();
      }
      
      // 关闭审计日志
      if (this.auditLogger) {
        await this.auditLogger.close();
      }
      
      // 关闭指标收集器
      if (this.metricsCollector) {
        await this.metricsCollector.shutdown();
      }
      
      this.initialized = false;
      this.stopping = false;
      
      this.logger.log('[ChannelHub] Shutdown complete');
      this.emit('shutdown');
      
    } catch (error) {
      this.stopping = false;
      this.logger.error('[ChannelHub] Shutdown error:', error);
      throw error;
    }
  }
}

// 导出
module.exports = {
  ChannelHubService,
  Constants,
  Errors,
  Utils
};

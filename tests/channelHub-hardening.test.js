const test = require('node:test');
const assert = require('node:assert/strict');

const AdapterAuthManager = require('../modules/channelHub/AdapterAuthManager');
const EventSchemaValidatorV2 = require('../modules/channelHub/EventSchemaValidatorV2');
const { ChannelHubService } = require('../modules/channelHub/ChannelHubService');
const RuntimeGateway = require('../modules/channelHub/RuntimeGateway');
const channelHubRoutes = require('../routes/internal/channelHub');

function createMockRes() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    }
  };
}

async function captureDingtalkBridgeRequest({
  envBridgeVersion,
  clientOptions = {},
  sendMessageOptions = {}
} = {}) {
  const previousVersion = process.env.VCP_CHANNEL_HUB_VERSION;
  const previousFetch = global.fetch;
  const requests = [];

  if (envBridgeVersion === undefined) {
    delete process.env.VCP_CHANNEL_HUB_VERSION;
  } else {
    process.env.VCP_CHANNEL_HUB_VERSION = envBridgeVersion;
  }

  global.fetch = async (url, options = {}) => {
    requests.push({
      url,
      body: JSON.parse(options.body)
    });
    return {
      ok: true,
      headers: { get: () => 'application/json' },
      async text() {
        return JSON.stringify({ ok: true, status: 'success' });
      }
    };
  };

  try {
    const { createVcpClient } = await import('../Plugin/vcp-dingtalk-adapter/src/adapters/vcp/client.js');
    const client = createVcpClient({
      bridgeUrl: 'http://127.0.0.1:6005/internal/channel-ingest',
      useBridge: true,
      baseUrl: 'http://127.0.0.1:6005',
      apiKey: 'local-vcp-key',
      model: 'Nova',
      timeoutMs: 120000,
      logger: console,
      ...clientOptions
    });

    await client.sendMessage({
      agentName: 'agent-1',
      agentDisplayName: 'Agent 1',
      message: [{ type: 'text', text: 'hello' }],
      metadata: {
        conversationId: 'conv-1',
        conversationType: 'group',
        userId: 'user-1',
        messageId: 'msg-1'
      },
      ...sendMessageOptions
    });

    assert.equal(requests.length, 1);
    return requests[0];
  } finally {
    global.fetch = previousFetch;
    if (previousVersion === undefined) {
      delete process.env.VCP_CHANNEL_HUB_VERSION;
    } else {
      process.env.VCP_CHANNEL_HUB_VERSION = previousVersion;
    }
  }
}

test.afterEach(() => {
  delete process.env.CHANNEL_HUB_AUTH_MODE;
  delete process.env.CHANNEL_HUB_SIGNATURE_MODE;
});

test('AdapterAuthManager: uses status as primary enable switch and supports secret priority', async () => {
  const registry = {
    async getAdapter(id) {
      if (id === 'a-active') {
        return {
          adapterId: id,
          status: 'active',
          config: { bridgeKey: 'bridge-secret', adapterKey: 'adapter-secret' }
        };
      }
      if (id === 'a-inactive') {
        return {
          adapterId: id,
          status: 'inactive',
          enabled: true,
          config: { bridgeKey: 'bridge-secret' }
        };
      }
      return null;
    }
  };

  process.env.CHANNEL_HUB_AUTH_MODE = 'enforce';
  const manager = new AdapterAuthManager({ adapterRegistry: registry, config: {} });

  const active = await manager.authenticate(
    { 'x-channel-adapter-id': 'a-active', 'x-channel-bridge-key': 'bridge-secret' },
    '127.0.0.1'
  );
  assert.equal(active.authenticated, true);
  assert.equal(active.adapterId, 'a-active');

  const inactive = await manager.authenticate(
    { 'x-channel-adapter-id': 'a-inactive', 'x-channel-bridge-key': 'bridge-secret' },
    '127.0.0.1'
  );
  assert.equal(inactive.authenticated, false);
  assert.equal(inactive.reasonCode, 'ADAPTER_DISABLED');
});

test('AdapterAuthManager: supports adapterIdHint and observe mode pass-through', async () => {
  const registry = {
    async getAdapter(id) {
      if (id !== 'hint-adapter') return null;
      return {
        adapterId: id,
        status: 'active',
        config: { bridgeKey: 'expected-secret' }
      };
    }
  };

  process.env.CHANNEL_HUB_AUTH_MODE = 'observe';
  const manager = new AdapterAuthManager({ adapterRegistry: registry, config: {} });

  const result = await manager.authenticate(
    { 'x-channel-bridge-key': 'wrong-secret' },
    '127.0.0.1',
    'hint-adapter'
  );

  assert.equal(result.authenticated, true);
  assert.equal(result.observed, true);
  assert.equal(result.observation.type, 'AUTH_OBSERVED_FAIL');
  assert.equal(result.observation.reasonCode, 'INVALID_ADAPTER_KEY');
});

test('EventSchemaValidatorV2: accepts B2 and normalizes to 2.0 with warnings', () => {
  const validator = new EventSchemaValidatorV2();
  const input = {
    version: 'B2',
    eventId: 'evt-1',
    adapterId: 'adapter-1',
    channel: 'dingtalk',
    eventType: 'message.created',
    occurredAt: Date.now(),
    target: { agentId: 'Nova' },
    client: { messageId: 'msg-1' },
    payload: { messages: [{ role: 'user', content: 'hello' }] }
  };

  const result = validator.validateAndNormalize(input);
  assert.equal(result.valid, true);
  assert.equal(result.envelope.version, '2.0');
  assert.ok(Array.isArray(result.warnings));
  assert.equal(result.warnings.length > 0, true);
  assert.equal(
    result.envelope.metadata.compatibilityWarnings.includes('Version normalized from B2 to 2.0'),
    true
  );
});

test('signature middleware supports observe/enforce modes', async () => {
  const fakeService = {
    initialized: true,
    config: {},
    signatureValidator: {
      async validate() {
        return { valid: false, reason: 'bad-signature' };
      }
    },
    adapterRegistry: {
      async getAdapter() {
        return { adapterId: 'adapter-1', channel: 'dingtalk' };
      }
    },
    metricsCollector: {
      incrementCounter() {}
    }
  };
  channelHubRoutes.initialize({ channelHubService: fakeService });

  const middleware = channelHubRoutes.__test__.createSignatureMiddleware('dingtalk');

  process.env.CHANNEL_HUB_SIGNATURE_MODE = 'observe';
  {
    const req = {
      _traceId: 'trace-1',
      _adapterId: 'adapter-1',
      headers: {},
      body: { hello: 'world' },
      path: '/internal/channel-hub/dingtalk/callback',
      params: { channel: 'dingtalk' }
    };
    const res = createMockRes();
    let nextCalled = false;
    await middleware(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(Array.isArray(req._securityObservations), true);
    assert.equal(req._securityObservations[0].type, 'SIGNATURE_OBSERVED_FAIL');
  }

  process.env.CHANNEL_HUB_SIGNATURE_MODE = 'enforce';
  {
    const req = {
      _traceId: 'trace-2',
      _adapterId: 'adapter-1',
      headers: {},
      body: { hello: 'world' },
      path: '/internal/channel-hub/dingtalk/callback',
      params: { channel: 'dingtalk' }
    };
    const res = createMockRes();
    let nextCalled = false;
    await middleware(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error.code, 'SIGNATURE_INVALID');
  }
});

test('adapter auth middleware passes body adapterId as hint', async () => {
  let capturedHint = null;
  const fakeService = {
    initialized: true,
    adapterAuthManager: {
      async authenticate(headers, sourceIp, adapterIdHint) {
        capturedHint = adapterIdHint;
        return { authenticated: true, adapterId: adapterIdHint || 'none' };
      }
    }
  };
  channelHubRoutes.initialize({ channelHubService: fakeService });

  const middleware = channelHubRoutes.__test__.adapterAuthMiddleware;
  const req = {
    headers: {},
    ip: '127.0.0.1',
    body: { adapterId: 'hint-from-body' }
  };
  const res = createMockRes();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(capturedHint, 'hint-from-body');
  assert.equal(req._adapterId, 'hint-from-body');
});

test('adapter auth middleware records AUTH_OBSERVED_FAIL and allows request', async () => {
  const fakeService = {
    initialized: true,
    metricsCollector: { incrementCounter() {} },
    adapterRegistry: {
      async listAdapters(filter = {}) {
        if (filter.channel === 'dingtalk' && filter.enabled === true) {
          return [{ adapterId: 'adapter-1', channel: 'dingtalk', status: 'active' }];
        }
        return [];
      }
    },
    adapterAuthManager: {
      async authenticate() {
        return {
          authenticated: true,
          adapterId: 'adapter-1',
          observed: true,
          observation: {
            type: 'AUTH_OBSERVED_FAIL',
            reasonCode: 'INVALID_ADAPTER_KEY',
            message: 'Invalid adapter key',
            adapterId: 'adapter-1'
          }
        };
      }
    }
  };
  channelHubRoutes.initialize({ channelHubService: fakeService });

  const middleware = channelHubRoutes.__test__.adapterAuthMiddleware;
  const req = {
    _traceId: 'trace-auth-observe',
    headers: {},
    ip: '127.0.0.1',
    path: '/events',
    body: { channel: 'dingtalk' }
  };
  const res = createMockRes();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req._adapterId, 'adapter-1');
  assert.equal(Array.isArray(req._securityObservations), true);
  assert.equal(req._securityObservations[0].type, 'AUTH_OBSERVED_FAIL');
  assert.ok(String(res.getHeader('X-ChannelHub-Security-Observe')).includes('AUTH_OBSERVED_FAIL'));
});

test('adapter auth middleware rejects when auth manager returns unauthenticated', async () => {
  const fakeService = {
    initialized: true,
    adapterAuthManager: {
      async authenticate() {
        return {
          authenticated: false,
          reasonCode: 'ADAPTER_DISABLED',
          error: 'Adapter is disabled'
        };
      }
    }
  };
  channelHubRoutes.initialize({ channelHubService: fakeService });

  const middleware = channelHubRoutes.__test__.adapterAuthMiddleware;
  const req = {
    headers: {},
    ip: '127.0.0.1',
    body: { adapterId: 'adapter-1' }
  };
  const res = createMockRes();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, 'AUTH_FAILED');
});

test('processOutboundJob still supports dynamic adapter instance creation', async () => {
  const service = new ChannelHubService({ logger: console, config: { debugMode: false } });
  service.initialized = true;
  service.adapterRegistry = {
    async getAdapter() {
      return { adapterId: 'd1', channel: 'dingtalk' };
    },
    getAdapterInstance() {
      return null;
    },
    registerAdapterInstance() {}
  };
  service.capabilityRegistry = { async getProfile() { return {}; } };
  service.capabilityDowngrader = { downgradePart(part) { return { part }; } };
  service.sessionBindingStore = { async get() { return null; } };
  service.auditLogger = {
    generateTraceId() { return 'trace-1'; },
    logOutboundDelivery() {}
  };
  service.metricsCollector = {
    incrementCounter() {},
    recordOutboundMessage() {}
  };
  service._createAdapterInstanceFromContract = async () => ({
    async sendBySession() {
      return { success: true, messageId: 'm1' };
    }
  });

  const result = await service.processOutboundJob({
    jobId: 'job-1',
    adapterId: 'd1',
    channel: 'dingtalk',
    payload: { messages: [{ content: [{ type: 'text', text: 'hello' }] }] },
    session: { bindingKey: 'binding-1' }
  });

  assert.equal(result.success, true);
  assert.equal(result.messageId, 'm1');
});

test('processOutboundJob encodes normalized reply before sendBySession', async () => {
  const service = new ChannelHubService({ logger: console, config: { debugMode: false } });
  service.initialized = true;
  service.adapterRegistry = {
    async getAdapter() {
      return { adapterId: 'd1', channel: 'dingtalk' };
    },
    getAdapterInstance() {
      return {
        async encodeOutbound(reply) {
          return [{ type: 'text', content: reply.messages[0].content[0].text }];
        },
        async sendBySession(session, platformMessages) {
          assert.equal(Array.isArray(platformMessages), true);
          assert.equal(platformMessages[0].type, 'text');
          return { success: true, messageId: 'm2' };
        }
      };
    }
  };
  service.capabilityRegistry = { async getProfile() { return {}; } };
  service.capabilityDowngrader = { downgradePart(part) { return { part }; } };
  service.sessionBindingStore = { async get() { return null; } };
  service.auditLogger = {
    generateTraceId() { return 'trace-2'; },
    logOutboundDelivery() {}
  };
  service.metricsCollector = {
    incrementCounter() {},
    recordOutboundMessage() {}
  };

  const result = await service.processOutboundJob({
    jobId: 'job-2',
    adapterId: 'd1',
    channel: 'dingtalk',
    payload: { messages: [{ content: [{ type: 'text', text: 'hello' }] }] },
    session: { bindingKey: 'binding-2' }
  });

  assert.equal(result.success, true);
  assert.equal(result.messageId, 'm2');
});

test('RuntimeGateway mock response supports res.send', async () => {
  const gateway = new RuntimeGateway({
    chatCompletionHandler: {
      async handle(req, res) {
        res.send(Buffer.from(JSON.stringify({
          choices: [
            {
              message: {
                content: 'OK'
              }
            }
          ]
        })));
      }
    },
    config: {},
    debugMode: false
  });

  const result = await gateway.invoke(
    {
      eventId: 'evt-1',
      payload: {
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }]
      },
      session: {}
    },
    {
      agentId: 'agent-1',
      agentName: 'Agent 1'
    }
  );

  assert.equal(result.messages[0].content[0].text, 'OK');
});

test('RuntimeGateway forwards agentId placeholder for real VCP agent expansion', async () => {
  let capturedBody = null;
  const gateway = new RuntimeGateway({
    chatCompletionHandler: {
      async handle(req, res) {
        capturedBody = req.body;
        res.json({
          choices: [
            {
              message: {
                content: 'OK'
              }
            }
          ]
        });
      }
    },
    config: {},
    debugMode: false
  });

  await gateway.invoke(
    {
      eventId: 'evt-agent-1',
      payload: {
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hello agent' }] }]
      },
      session: {
        externalSessionKey: 'dingtalk:group:conv-1:meta'
      }
    },
    {
      agentId: '动力猛兽',
      agentName: '动力猛兽'
    }
  );

  assert.ok(capturedBody);
  assert.equal(capturedBody.messages[0].role, 'system');
  assert.equal(capturedBody.messages[0].content, '{{动力猛兽}}');
  assert.equal(capturedBody.messages[1].content, 'hello agent');
  assert.equal(capturedBody.externalSessionKey, 'dingtalk:group:conv-1:meta');
});

test('dingtalk vcp client hides duplicate control response text', async () => {
  const { createVcpClient } = await import('../Plugin/vcp-dingtalk-adapter/src/adapters/vcp/client.js');
  const client = createVcpClient({
    bridgeUrl: 'http://127.0.0.1:6005/internal/channelHub/events',
    useBridge: true,
    logger: console
  });

  const text = client.extractDisplayText({
    ok: true,
    status: 'duplicate',
    requestId: 'req-1',
    eventId: 'evt-1'
  });

  assert.equal(text, '');
});

test('dingtalk pipeline skips reply when ChannelHub returns duplicate control response', async () => {
  const { createMessagePipeline } = await import('../Plugin/vcp-dingtalk-adapter/src/core/pipeline.js');

  const dingSender = {
    async replyText() {
      throw new Error('replyText should not be called for duplicate control response');
    }
  };

  const logger = {
    info() {},
    warn() {},
    error() {}
  };

  const handleIncomingMessage = createMessagePipeline({
    vcpClient: {
      async sendMessage() {
        return {
          ok: true,
          status: 'duplicate',
          requestId: 'req-1',
          eventId: 'evt-1'
        };
      }
    },
    dingSender,
    logger,
    defaultAgentName: 'agent-1',
    defaultAgentDisplayName: 'Agent 1'
  });

  await handleIncomingMessage({
    headers: {
      topic: '/v1.0/im/bot/messages/get'
    },
    data: {
      conversationId: 'conv-1',
      conversationType: '2',
      msgId: 'msg-1',
      senderStaffId: 'user-1',
      senderNick: 'Tester',
      text: { content: ' hello ' },
      robotCode: 'robot-1',
      isInAtList: true,
      sessionWebhook: 'https://example.com/webhook',
      sessionWebhookExpiredTime: Date.now() + 60000
    }
  });
});

test('dingtalk B2 bridge payload does not recurse into VCP as upstream API override', async () => {
  const previousVersion = process.env.VCP_CHANNEL_HUB_VERSION;
  const previousFetch = global.fetch;
  const requests = [];

  process.env.VCP_CHANNEL_HUB_VERSION = 'b2';
  global.fetch = async (url, options = {}) => {
    requests.push({
      url,
      body: JSON.parse(options.body)
    });
    return {
      ok: true,
      headers: { get: () => 'application/json' },
      async text() {
        return JSON.stringify({ ok: true, status: 'success' });
      }
    };
  };

  try {
    const { createVcpClient } = await import('../Plugin/vcp-dingtalk-adapter/src/adapters/vcp/client.js');
    const client = createVcpClient({
      bridgeUrl: 'http://127.0.0.1:6005/internal/channelHub/events',
      useBridge: true,
      baseUrl: 'http://127.0.0.1:6005',
      apiKey: 'local-vcp-key',
      model: 'Nova',
      timeoutMs: 120000,
      logger: console
    });

    await client.sendMessage({
      agentName: '动力猛兽',
      agentDisplayName: '动力猛兽',
      externalSessionKey: 'dingtalk:group:conv:test',
      message: [{ type: 'text', text: 'hello' }],
      metadata: {
        conversationId: 'conv-1',
        conversationType: 'group',
        userId: 'user-1',
        messageId: 'msg-1'
      }
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'http://127.0.0.1:6005/internal/channelHub/events');
    assert.equal(requests[0].body.runtime.overrides.model, 'Nova');
    assert.equal(requests[0].body.runtime.overrides.timeoutMs, 120000);
    assert.equal('apiBase' in requests[0].body.runtime.overrides, false);
    assert.equal('apiKey' in requests[0].body.runtime.overrides, false);
  } finally {
    global.fetch = previousFetch;
    if (previousVersion === undefined) {
      delete process.env.VCP_CHANNEL_HUB_VERSION;
    } else {
      process.env.VCP_CHANNEL_HUB_VERSION = previousVersion;
    }
  }
});

test('dingtalk bridgeVersion option forces B2 payload when env is unset', async () => {
  const request = await captureDingtalkBridgeRequest({
    clientOptions: {
      bridgeVersion: 'b2'
    }
  });

  assert.equal(request.url, 'http://127.0.0.1:6005/internal/channelHub/events');
  assert.equal(request.body.version, '2.0');
  assert.equal(request.body.client.conversationType, 'group');
  assert.match(request.body.session.bindingKey, /^dingtalk:group:/);
  assert.equal(request.body.metadata.chatType, 'group');
  assert.equal(request.body.metadata.conversationType, 'group');
  assert.equal(request.body.runtime.overrides.model, 'Nova');
  assert.equal(request.body.runtime.overrides.timeoutMs, 120000);
  assert.equal('apiBase' in request.body.runtime.overrides, false);
  assert.equal('apiKey' in request.body.runtime.overrides, false);
});

test('dingtalk B2 bridge payload still works from env fallback', async () => {
  const request = await captureDingtalkBridgeRequest({
    envBridgeVersion: 'b2'
  });

  assert.equal(request.url, 'http://127.0.0.1:6005/internal/channelHub/events');
  assert.equal(request.body.version, '2.0');
  assert.equal(request.body.client.conversationType, 'group');
});

test('dingtalk B2 bridge normalizes private conversationType', async () => {
  const request = await captureDingtalkBridgeRequest({
    clientOptions: {
      bridgeVersion: 'b2'
    },
    sendMessageOptions: {
      metadata: {
        conversationId: 'conv-private',
        conversationType: 'private',
        userId: 'user-2',
        messageId: 'msg-2'
      }
    }
  });

  assert.equal(request.body.client.conversationType, 'private');
  assert.match(request.body.session.bindingKey, /^dingtalk:private:/);
  assert.equal(request.body.metadata.chatType, 'private');
  assert.equal(request.body.metadata.conversationType, 'private');
});

test('dingtalk B2 bridge normalizes legacy single chatType to private', async () => {
  const request = await captureDingtalkBridgeRequest({
    clientOptions: {
      bridgeVersion: 'b2'
    },
    sendMessageOptions: {
      metadata: {
        conversationId: 'conv-single',
        chatType: 'single',
        userId: 'user-3',
        messageId: 'msg-3'
      }
    }
  });

  assert.equal(request.body.client.conversationType, 'private');
  assert.match(request.body.session.bindingKey, /^dingtalk:private:/);
  assert.equal(request.body.metadata.chatType, 'private');
  assert.equal(request.body.metadata.conversationType, 'private');
});

test('dingtalk B2 bridge keeps legacy group chatType compatible', async () => {
  const request = await captureDingtalkBridgeRequest({
    clientOptions: {
      bridgeVersion: 'b2'
    },
    sendMessageOptions: {
      metadata: {
        conversationId: 'conv-group-legacy',
        chatType: 'group',
        userId: 'user-4',
        messageId: 'msg-4'
      }
    }
  });

  assert.equal(request.body.client.conversationType, 'group');
  assert.match(request.body.session.bindingKey, /^dingtalk:group:/);
  assert.equal(request.body.metadata.chatType, 'group');
  assert.equal(request.body.metadata.conversationType, 'group');
});

test('ChannelHubService loads DingTalk adapter contract from Plugin directory and passes stored config', async () => {
  const previousFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes('/oauth2/accessToken')) {
      return {
        ok: true,
        async text() {
          return JSON.stringify({ accessToken: 'token-1', expireIn: 7200 });
        }
      };
    }

    throw new Error(`Unexpected fetch url: ${url}`);
  };

  try {
    const service = new ChannelHubService({ logger: console, config: { debugMode: false } });
    service.adapterRegistry = {
      registerAdapterInstance() {}
    };

    const instance = await service._createAdapterInstanceFromContract({
      adapterId: 'dingtalk-adapter-01',
      channel: 'dingtalk',
      name: 'DingTalk Adapter',
      config: {
        appKey: 'app-key-1',
        appSecret: 'app-secret-1'
      },
      capabilityProfile: {
        supportsText: true
      }
    });

    assert.ok(instance);
    assert.equal(instance.getMetadata().id, 'dingtalk-adapter-01');
    assert.equal(instance.options.appKey, 'app-key-1');
    assert.equal(instance.options.appSecret, 'app-secret-1');
    assert.equal(instance.getCapabilities().supportsText, true);
  } finally {
    global.fetch = previousFetch;
  }
});

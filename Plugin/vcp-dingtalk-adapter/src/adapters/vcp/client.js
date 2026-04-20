function joinUrl(base, path) {
  if (/^https?:\/\//i.test(String(path || ''))) {
    return String(path);
  }
  return `${String(base).replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`;
}

function decodeEntities(text = '') {
  return String(text)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function stripHtml(html = '') {
  return decodeEntities(
    String(html)
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
  ).trim();
}

function isDebugRawResponseEnabled() {
  return String(process.env.VCP_DEBUG_RAW_RESPONSE || '').toLowerCase() === 'true';
}

function summarizeValue(value, depth = 0) {
  if (depth > 2) return '[MaxDepth]';

  if (value == null) return value;
  if (typeof value === 'string') {
    return value.length > 300 ? `${value.slice(0, 300)}...[${value.length}]` : value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      sample: value.slice(0, 3).map((v) => summarizeValue(v, depth + 1)),
    };
  }

  const out = {};
  for (const [k, v] of Object.entries(value).slice(0, 20)) {
    out[k] = summarizeValue(v, depth + 1);
  }
  return out;
}

function logRawResponse(data, logger = console) {
  try {
    logger.info('[vcpClient] raw response summary =>', summarizeValue(data));
    if (isDebugRawResponseEnabled()) {
      logger.info(`[vcpClient] RAW RESPONSE >>>\n${JSON.stringify(data, null, 2)}`);
    }
  } catch (error) {
    logger.warn?.('[vcpClient] raw response logging failed', error);
  }
}

async function parseResponse(resp) {
  const raw = await resp.text();
  const contentType = resp.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function isControlStatusResponse(vcpResponse) {
  if (!vcpResponse || typeof vcpResponse !== 'object') return false;
  if (vcpResponse.ok !== true) return false;

  const status = String(vcpResponse.status || '').toLowerCase();
  return status === 'duplicate';
}

function resolveBridgeVersion(explicitBridgeVersion, envBridgeVersion = process.env.VCP_CHANNEL_HUB_VERSION) {
  const candidate = explicitBridgeVersion ?? envBridgeVersion ?? 'b1';
  return String(candidate).trim().toLowerCase() === 'b2' ? 'b2' : 'b1';
}

function resolveConversationType(metadata = {}) {
  const rawType = metadata.conversationType ?? metadata.chatType ?? '';
  const normalized = String(rawType).trim().toLowerCase();

  if (!normalized) return 'private';
  if (normalized === '2' || normalized.includes('group') || normalized.includes('chat')) return 'group';
  if (normalized === '1' || normalized.includes('single') || normalized.includes('private')) return 'private';
  if (normalized.includes('channel')) return 'channel';
  return 'private';
}

function collectTextFromOpenAIMessage(message) {
  if (!message) return '';

  if (typeof message.content === 'string') {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((item) => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        if (item.type === 'text' && item.text) return item.text;
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }

  return '';
}

function collectTextFromContent(content) {
  if (!Array.isArray(content)) return '';

  return content
    .filter((item) => item && item.type === 'text' && item.text)
    .map((item) => item.text)
    .join('\n\n');
}

function isSourceLike(value = '') {
  return /^(https?:\/\/|file:\/\/|data:)/i.test(String(value || ''));
}

function isImageSource(value = '') {
  const v = String(value || '');
  return (
    /^data:image\//i.test(v) ||
    /\.(png|jpe?g|gif|bmp|webp|svg)(?:[?#].*)?$/i.test(v) ||
    /\/images?\//i.test(v)
  );
}

function isFileSource(value = '') {
  const v = String(value || '');
  return (
    /^data:(application|audio|video)\//i.test(v) ||
    /\.(pdf|docx?|xlsx?|zip|rar|txt|md|csv|json|mp3|wav|ogg|amr|mp4)(?:[?#].*)?$/i.test(v)
  );
}

function pushUnique(list, entry) {
  if (!entry?.source) return;
  if (list.some((item) => item.source === entry.source)) return;
  list.push(entry);
}

function classifySource(value, hintKey, container) {
  if (!isSourceLike(value)) return;

  if (
    String(hintKey || '').toLowerCase().includes('image') ||
    String(hintKey || '').toLowerCase().includes('photo') ||
    isImageSource(value)
  ) {
    pushUnique(container.images, { source: value });
    return;
  }

  if (
    String(hintKey || '').toLowerCase().includes('file') ||
    isFileSource(value)
  ) {
    pushUnique(container.files, { source: value });
  }
}

function walkNode(node, container, hintKey = '') {
  if (!node) return;

  if (Array.isArray(node)) {
    for (const item of node) {
      walkNode(item, container, hintKey);
    }
    return;
  }

  if (typeof node === 'string') {
    classifySource(node, hintKey, container);
    return;
  }

  if (typeof node !== 'object') return;

  if (node.type === 'image_url' && node.image_url?.url) {
    pushUnique(container.images, {
      source: node.image_url.url,
      fileName: node.image_url.fileName || '',
    });
  }

  if (node.type === 'file_url' && node.file_url?.url) {
    pushUnique(container.files, {
      source: node.file_url.url,
      fileName: node.file_url.fileName || '',
    });
  }

  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'string') {
      classifySource(value, key, container);
    } else {
      walkNode(value, container, key);
    }
  }
}

export function createVcpClient({
  bridgeUrl = '',
  bridgeKey = '',
  bridgeAuthToken = '',
  useBridge = true,
  bridgeVersion, // 'b1' | 'b2'

  baseUrl,
  chatPath = '/v1/chat/completions',
  apiKey = '',
  model = 'Nova',
  defaultAgentName = 'Nova',
  defaultAgentDisplayName = 'Nova',
  timeoutMs = 120000,
  logger = console,
}) {
  const endpoint = joinUrl(baseUrl, chatPath);
  const resolvedBridgeAuthToken = String(
    bridgeAuthToken ||
      process.env.VCP_CHANNEL_BRIDGE_BEARER ||
      process.env.VCP_SERVER_KEY ||
      apiKey ||
      ''
  ).trim();
  // 默认使用 B2 协议
  const bridgeVersionEnv = process.env.VCP_CHANNEL_HUB_VERSION;
  const isB2 = bridgeVersionEnv
    ? String(bridgeVersionEnv).toLowerCase() === 'b2'
    : false; // 默认 b1 以保持向后兼容

  // B2 适配器配置
  const adapterId = process.env.VCP_ADAPTER_ID || 'dingtalk-stream';

  // B2 模式下，自动调整 bridgeUrl 到正确的 endpoint
  const useB2Bridge =
    bridgeVersion === undefined
      ? isB2
      : resolveBridgeVersion(bridgeVersion) === 'b2';
  const b2BridgeUrl = useB2Bridge
    ? bridgeUrl.replace(/(\/internal\/channel-ingest)$/, '/internal/channel-hub/events')
    : bridgeUrl;

  async function sendViaBridge({
    agentName = defaultAgentName,
    agentDisplayName = defaultAgentDisplayName,
    externalSessionKey,
    message,
    metadata = {},
  }) {
    const requestId = `dt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const conversationType = resolveConversationType(metadata);
    const normalizedMetadata = {
      ...metadata,
      chatType: conversationType,
      conversationType,
    };
    const bindingKey =
      externalSessionKey ||
      `dingtalk:${conversationType}:${normalizedMetadata.conversationId || ''}:${normalizedMetadata.userId || 'anonymous'}`;

    // B2 模式：使用 ChannelEventEnvelope 格式
    if (useB2Bridge) {
      logger.info('[vcpClient] Using B2 protocol (ChannelEventEnvelope)');
      return sendViaBridgeB2({
        agentName,
        agentDisplayName,
        externalSessionKey,
        message,
        metadata: normalizedMetadata,
        requestId,
      });
    }

    // B1 模式：使用旧版格式（兼容 channel-ingest）
    const payload = {
      channel: 'dingtalk',
      agentId: agentName,
      agentName: agentDisplayName,
      itemType: 'agent',
      itemId: agentName,
      requestId,
      stream: false,

      client: {
        clientType: 'dingtalk',
        clientId: 'dingtalk',
        conversationId: normalizedMetadata.conversationId || '',
        conversationType,
        conversationTitle: normalizedMetadata.conversationTitle || '',
        messageId: normalizedMetadata.messageId || requestId,
        timestamp: Date.now(),
      },

      sender: {
        userId: normalizedMetadata.userId || '',
        nick: normalizedMetadata.senderNick || '',
        isAdmin: Boolean(normalizedMetadata.isAdmin),
        corpId: normalizedMetadata.senderCorpId || '',
      },

      topicControl: {
        bindingKey,
        currentTopicId: normalizedMetadata.topicId || null,
        allowCreateTopic: true,
        allowSwitchTopic: true,
        hintTopicId: normalizedMetadata.hintTopicId || null,
      },

      messages: [
        {
          role: 'user',
          content: Array.isArray(message)
            ? message
            : [{ type: 'text', text: String(message || '') }],
        },
      ],

      modelConfig: {
        model: model || agentName || defaultAgentName || 'Nova',
        stream: false,
      },

      metadata: {
        platform: 'dingtalk',
        conversationId: normalizedMetadata.conversationId,
        userId: normalizedMetadata.userId,
        senderNick: normalizedMetadata.senderNick,
        senderCorpId: normalizedMetadata.senderCorpId,
        isAdmin: normalizedMetadata.isAdmin,
        robotCode: normalizedMetadata.robotCode,
        chatType: conversationType,
        conversationType,
        messageId: normalizedMetadata.messageId,
        conversationTitle: normalizedMetadata.conversationTitle,
        sessionWebhook: normalizedMetadata.sessionWebhook,
        sessionWebhookExpiredTime: normalizedMetadata.sessionWebhookExpiredTime,
        agentId: agentName,
        agentName: agentDisplayName,
      },

      vcpConfig: {
        runtimeOverrides: {
          model: model || agentName || defaultAgentName || 'Nova',
          timeoutMs,
        },
      },
    };

    logger.info('[vcpClient] bridge request =>', {
      bridgeUrl,
      agentId: agentName,
      agentDisplayName,
      externalSessionKey: bindingKey,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      if (resolvedBridgeAuthToken) {
        headers.Authorization = `Bearer ${resolvedBridgeAuthToken}`;
      }

      if (bridgeKey) {
        headers['x-channel-bridge-key'] = bridgeKey;
      }

      const resp = await fetch(bridgeUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await parseResponse(resp);
      logRawResponse(data, logger);

      if (!resp.ok) {
        throw new Error(
          `Bridge HTTP ${resp.status}: ${
            typeof data === 'string' ? data : JSON.stringify(data)
          }`
        );
      }

      return data;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`Bridge request timeout after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  // B2 模式专用发送函数
  async function sendViaBridgeB2({
    agentName,
    agentDisplayName,
    externalSessionKey,
    message,
    metadata,
    requestId,
  }) {
    const conversationType = resolveConversationType(metadata);
    const normalizedMetadata = {
      ...metadata,
      chatType: conversationType,
      conversationType,
    };
    const bindingKey =
      externalSessionKey ||
      `dingtalk:${conversationType}:${normalizedMetadata.conversationId || ''}:${normalizedMetadata.userId || 'anonymous'}`;

    const payload = {
      version: '2.0',
      eventId: requestId,
      adapterId: adapterId,
      channel: 'dingtalk',
      eventType: 'message.created',
      occurredAt: Date.now(),
      requestId,
      target: {
        agentId: agentName,
        itemType: 'agent',
        itemId: agentName,
      },
      client: {
        clientType: 'dingtalk',
        conversationId: normalizedMetadata.conversationId || '',
        conversationType,
        messageId: normalizedMetadata.messageId || requestId,
      },
      sender: {
        userId: normalizedMetadata.userId || '',
        nick: normalizedMetadata.senderNick || '',
        corpId: normalizedMetadata.senderCorpId || '',
        isAdmin: Boolean(normalizedMetadata.isAdmin),
      },
      session: {
        bindingKey,
        externalSessionKey: bindingKey,
        currentTopicId: normalizedMetadata.topicId || null,
        allowCreateTopic: true,
        allowSwitchTopic: true,
      },
      payload: {
        messages: [
          {
            role: 'user',
            content: Array.isArray(message)
              ? message
              : [{ type: 'text', text: String(message || '') }],
          },
        ],
      },
      runtime: {
        stream: false,
        model: model || agentName || defaultAgentName || 'Nova',
        overrides: {
          timeoutMs,
          model: model || agentName || defaultAgentName || 'Nova',
        },
      },
      metadata: {
        platform: 'dingtalk',
        robotCode: normalizedMetadata.robotCode,
        sessionWebhook: normalizedMetadata.sessionWebhook,
        sessionWebhookExpiredTime: normalizedMetadata.sessionWebhookExpiredTime,
        conversationTitle: normalizedMetadata.conversationTitle,
        chatType: conversationType,
        conversationType,
        agentDisplayName,
      },
    };

    logger.info('[vcpClient:B2] bridge request =>', {
      bridgeUrl: b2BridgeUrl,
      eventId: requestId,
      agentId: agentName,
      bindingKey,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-channel-adapter-id': adapterId,
      };

      if (resolvedBridgeAuthToken) {
        headers.Authorization = `Bearer ${resolvedBridgeAuthToken}`;
      }

      if (bridgeKey) {
        headers['x-channel-bridge-key'] = bridgeKey;
      }

      const resp = await fetch(b2BridgeUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await parseResponse(resp);
      logRawResponse(data, logger);

      if (!resp.ok) {
        throw new Error(
          `Bridge HTTP ${resp.status}: ${
            typeof data === 'string' ? data : JSON.stringify(data)
          }`
        );
      }

      return data;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`Bridge request timeout after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function sendViaOpenAICompat({
    agentName = defaultAgentName,
    externalSessionKey,
    message,
  }) {
    const payload = {
      model: model || agentName || defaultAgentName || 'Nova',
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
      stream: false,
      user: externalSessionKey,
    };

    logger.info('[vcpClient] request =>', {
      endpoint,
      model: payload.model,
      user: externalSessionKey,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      if (externalSessionKey) {
        headers['X-Session-Id'] = externalSessionKey;
      }
      if (agentName) {
        headers['X-Agent-Name'] = agentName;
      }

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await parseResponse(resp);
      logRawResponse(data, logger);

      if (!resp.ok) {
        throw new Error(
          `VCP HTTP ${resp.status}: ${
            typeof data === 'string' ? data : JSON.stringify(data)
          }`
        );
      }

      return data;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`VCP request timeout after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function sendMessage(args) {
    if (useBridge && bridgeUrl) {
      return sendViaBridge(args);
    }
    return sendViaOpenAICompat(args);
  }

  function extractDisplayText(vcpResponse) {
    if (!vcpResponse) return '';

    if (isControlStatusResponse(vcpResponse)) {
      return '';
    }

    if (typeof vcpResponse === 'string') {
      return stripHtml(vcpResponse);
    }

    if (typeof vcpResponse?.reply?.text === 'string') {
      return stripHtml(vcpResponse.reply.text);
    }

    if (Array.isArray(vcpResponse?.reply?.content)) {
      const text = collectTextFromContent(vcpResponse.reply.content);
      if (text) return stripHtml(text);
    }

    if (Array.isArray(vcpResponse.choices) && vcpResponse.choices.length > 0) {
      const first = vcpResponse.choices[0];
      const text =
        collectTextFromOpenAIMessage(first?.message) ||
        first?.text ||
        '';
      if (text) return stripHtml(text);
    }

    if (typeof vcpResponse.reply === 'string') {
      return stripHtml(vcpResponse.reply);
    }

    if (typeof vcpResponse.result === 'string') {
      return stripHtml(vcpResponse.result);
    }

    if (typeof vcpResponse.text === 'string') {
      return stripHtml(vcpResponse.text);
    }

    if (typeof vcpResponse.message === 'string') {
      return stripHtml(vcpResponse.message);
    }

    const contentText =
      collectTextFromContent(vcpResponse?.result?.content) ||
      collectTextFromContent(vcpResponse?.content);

    if (contentText) {
      return stripHtml(contentText);
    }

    return stripHtml(JSON.stringify(vcpResponse, null, 2));
  }

  function extractOptions(vcpResponse) {
    // VCP 返回选项的可能格式：
    // 1. reply.options: [{ label, value }]
    // 2. reply.choices: [{ text, index }]
    // 3. choices[].message.tool_calls 或自定义格式
    const options = [];

    if (Array.isArray(vcpResponse?.reply?.options)) {
      for (const opt of vcpResponse.reply.options) {
        if (opt?.label || opt?.text || opt?.value) {
          options.push({
            label: String(opt.label || opt.text || opt.value || ''),
            value: String(opt.value || opt.label || opt.text || ''),
          });
        }
      }
    }

    if (Array.isArray(vcpResponse?.reply?.choices)) {
      for (const opt of vcpResponse.reply.choices) {
        if (opt?.text || opt?.label || opt?.value) {
          options.push({
            label: String(opt.text || opt.label || opt.value || ''),
            value: String(opt.value || opt.text || opt.label || ''),
          });
        }
      }
    }

    // OpenAI 格式的 choices 中的 finish_reason 可能包含选项
    if (Array.isArray(vcpResponse?.choices) && vcpResponse.choices.length > 0) {
      const first = vcpResponse.choices[0];
      if (Array.isArray(first?.message?.options)) {
        for (const opt of first.message.options) {
          if (opt?.label || opt?.text || opt?.value) {
            options.push({
              label: String(opt.label || opt.text || opt.value || ''),
              value: String(opt.value || opt.label || opt.text || ''),
            });
          }
        }
      }
    }

    return options;
  }

  function extractRichReply(vcpResponse) {
    const rich = {
      text: extractDisplayText(vcpResponse),
      images: [],
      files: [],
      options: extractOptions(vcpResponse),
    };

    if (Array.isArray(vcpResponse?.reply?.content)) {
      walkNode(vcpResponse.reply.content, rich);
    }

    walkNode(vcpResponse, rich);

    return rich;
  }

  return {
    sendMessage,
    extractDisplayText,
    extractRichReply,
  };
}

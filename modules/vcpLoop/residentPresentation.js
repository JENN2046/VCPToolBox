'use strict';

const { randomBytes } = require('crypto');

const RESIDENT_TOOL_NAME = 'AGENTSOSResident';
const DISCOVERY_BOOTSTRAP_SCHEMA = 'agents-os-resident.discovery-bootstrap.v1';
const HOST_PRESENTATION_SCHEMA = 'agents-os-resident.host-presentation.v1';
const HOST_PRESENTATION_KIND = 'OWNER_CONSENT_CHALLENGE';
const PRESENTATION_CHANNEL_HEADER = 'x-agents-os-resident-presentation-channel';
const PRESENTATION_DELTA_FIELD = 'vcp_ephemeral_presentation';
const NON_STREAM_PRESENTATIONS_FIELD = 'vcp_ephemeral_presentations';
const PRESENTATION_WRITE_TIMEOUT_MS = 5000;
const PROPOSAL_OPERATIONS = new Set([
  'PROPOSE_GOAL_MUTATION',
  'PROPOSE_TASK_MUTATION'
]);
const PROPOSAL_FAILURE_CATEGORIES = new Set([
  'PROPOSAL_DISPATCH_FAILED',
  'PROPOSAL_EXECUTION_FAILED',
  'PROPOSAL_INPUT_REJECTED',
  'PROPOSAL_PREPARE_FAILED',
  'PROPOSAL_PRESENTATION_FAILED',
  'PROPOSAL_RESULT_REJECTED'
]);
const MUTATION_CONFIRMATION_PREFIX = Object.freeze({
  CREATE_GOAL_BUNDLE: '确认创建，',
  START_GOAL: '确认变更，',
  PAUSE_GOAL: '确认变更，',
  RESUME_GOAL: '确认变更，',
  REQUEST_COMPLETION_REVIEW: '确认变更，',
  COMPLETE_TASK_MANUALLY: '确认完成，',
  CLOSE_GOAL_ACHIEVED: '确认关闭，',
  START_TASK: '确认变更，',
  PAUSE_TASK: '确认变更，',
  RESUME_TASK: '确认变更，'
});
const CHALLENGE_WORDS_PATTERN = /^[^、，,\s。！？!?]{1,16}(?:、[^、，,\s。！？!?]{1,16}){2}$/u;
const HOST_PRESENTATION_KEYS = Object.freeze([
  'challenge',
  'expiresInSeconds',
  'kind',
  'mutationType',
  'schema',
  'title'
]);

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null);
}

function exactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index]);
}

function messageText(message) {
  if (!message || typeof message !== 'object') return '';
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return '';
  return message.content
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n');
}

function hasResidentDiscoveryBootstrap(messages) {
  return Array.isArray(messages)
    && messages.some((message) => message?.role === 'system'
      && messageText(message).includes(DISCOVERY_BOOTSTRAP_SCHEMA));
}

function hasResidentProposalSurface(messages) {
  return Array.isArray(messages)
    && messages.some((message) => messageText(message).includes(RESIDENT_TOOL_NAME));
}

function isResidentProposalToolCall(toolCall) {
  return toolCall?.name === RESIDENT_TOOL_NAME
    && toolCall.archery === false
    && PROPOSAL_OPERATIONS.has(toolCall.args?.operation);
}

function residentProposalFailureCategory(toolResult) {
  if (toolResult?.success === true) return null;
  const category = toolResult?.residentProposalFailureCategory;
  return PROPOSAL_FAILURE_CATEGORIES.has(category)
    ? category
    : 'PROPOSAL_EXECUTION_FAILED';
}

function extractToolBlocks(content, ToolCallParser) {
  const blocks = [];
  let offset = 0;
  while (offset < content.length) {
    const block = ToolCallParser.extractNextToolBlock(content, offset);
    if (!block) break;
    blocks.push({ ...block, parsed: ToolCallParser.parseBlock(block.blockContent) });
    offset = block.nextOffset;
  }
  return blocks;
}

function frameResidentProposalTurn(content, ToolCallParser) {
  if (typeof content !== 'string' || content.length === 0) {
    return Object.freeze({ clientContent: content || '', kind: 'NONE', loopContent: content || '', toolCalls: Object.freeze([]) });
  }

  const toolCalls = ToolCallParser.parse(content);
  const residentCalls = toolCalls.filter(isResidentProposalToolCall);
  const exactStartMarker = ToolCallParser?.MARKERS?.START || '<<<[TOOL_REQUEST]>>>';
  const firstStartIndex = content.indexOf(exactStartMarker);
  const residentProposalIntent = toolCalls.some((toolCall) =>
    toolCall?.name === RESIDENT_TOOL_NAME
      && typeof toolCall.args?.operation === 'string'
      && toolCall.args.operation.startsWith('PROPOSE_'))
    || (firstStartIndex >= 0
      && content.slice(firstStartIndex).includes(RESIDENT_TOOL_NAME)
      && /PROPOSE_(?:GOAL|TASK)_MUTATION/u.test(content.slice(firstStartIndex)));

  if (residentCalls.length === 0) {
    if (residentProposalIntent) {
      return Object.freeze({
        clientContent: firstStartIndex >= 0 ? content.slice(0, firstStartIndex).trimEnd() : '',
        kind: 'INVALID',
        loopContent: '',
        toolCalls: Object.freeze(toolCalls)
      });
    }
    return Object.freeze({ clientContent: content, kind: 'NONE', loopContent: content, toolCalls: Object.freeze(toolCalls) });
  }

  const blocks = extractToolBlocks(content, ToolCallParser);
  const residentBlocks = blocks.filter((block) => isResidentProposalToolCall(block.parsed));
  const firstBlock = blocks[0] || null;
  const clientContent = firstBlock === null ? '' : content.slice(0, firstBlock.startIndex).trimEnd();

  if (toolCalls.length !== 1
    || residentCalls.length !== 1
    || blocks.length !== 1
    || residentBlocks.length !== 1) {
    return Object.freeze({ clientContent, kind: 'INVALID', loopContent: '', toolCalls: Object.freeze(toolCalls) });
  }

  const residentBlock = residentBlocks[0];
  return Object.freeze({
    clientContent,
    kind: 'RESIDENT_PROPOSAL',
    loopContent: content.slice(0, residentBlock.nextOffset),
    toolCalls: Object.freeze(toolCalls)
  });
}

function validateHostPresentation(value) {
  if (!exactKeys(value, HOST_PRESENTATION_KEYS)
    || value.schema !== HOST_PRESENTATION_SCHEMA
    || value.kind !== HOST_PRESENTATION_KIND
    || value.title !== 'AGENTSOSResident · Owner Consent'
    || typeof value.mutationType !== 'string'
    || value.mutationType.length === 0
    || value.mutationType.length > 80
    || !Number.isSafeInteger(value.expiresInSeconds)
    || value.expiresInSeconds < 1
    || value.expiresInSeconds > 300
    || typeof value.challenge !== 'string'
    || value.challenge.length === 0
    || value.challenge.length > 200
    || value.challenge.normalize('NFC') !== value.challenge
    || /[\r\n\0]/u.test(value.challenge)) {
    throw new Error('RESIDENT_HOST_PRESENTATION_REJECTED');
  }
  const expectedPrefix = MUTATION_CONFIRMATION_PREFIX[value.mutationType];
  if (!expectedPrefix
    || !value.challenge.startsWith(expectedPrefix)
    || !CHALLENGE_WORDS_PATTERN.test(value.challenge.slice(expectedPrefix.length))) {
    throw new Error('RESIDENT_HOST_PRESENTATION_REJECTED');
  }
  return Object.freeze({
    challenge: value.challenge,
    expiresInSeconds: value.expiresInSeconds,
    kind: value.kind,
    mutationType: value.mutationType,
    schema: value.schema,
    title: value.title
  });
}

function createPresentationChannel(res, enabled) {
  if (!enabled) return null;
  const channelId = randomBytes(16).toString('hex');
  if (!res || res.headersSent || typeof res.setHeader !== 'function') {
    throw new Error('RESIDENT_PRESENTATION_CHANNEL_UNAVAILABLE');
  }
  res.setHeader(PRESENTATION_CHANNEL_HEADER, channelId);
  return channelId;
}

function presentationEnvelope(channelId, presentation) {
  if (!/^[0-9a-f]{32}$/u.test(channelId)) {
    throw new Error('RESIDENT_PRESENTATION_CHANNEL_UNAVAILABLE');
  }
  return Object.freeze({ channelId, presentation: validateHostPresentation(presentation) });
}

function createStreamPresentationSink({ channelId, model, res }) {
  let emitted = false;
  return async (presentation) => {
    if (emitted || !res || res.writableEnded || res.destroyed || typeof res.write !== 'function') {
      throw new Error('RESIDENT_HOST_PRESENTATION_FAILED');
    }
    const envelope = presentationEnvelope(channelId, presentation);
    const payload = {
      id: `chatcmpl-resident-presentation-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: model || 'unknown',
      choices: [{ index: 0, delta: { [PRESENTATION_DELTA_FIELD]: envelope }, finish_reason: null }]
    };
    res.__vcpDisableReplayCache?.();
    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        res.off?.('error', onError);
        if (error) reject(error); else resolve();
      };
      const onError = () => finish(new Error('RESIDENT_HOST_PRESENTATION_FAILED'));
      const timeoutId = setTimeout(() => finish(new Error('RESIDENT_HOST_PRESENTATION_FAILED')), PRESENTATION_WRITE_TIMEOUT_MS);
      res.once?.('error', onError);
      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`, (error) => finish(error ? new Error('RESIDENT_HOST_PRESENTATION_FAILED') : null));
      } catch {
        finish(new Error('RESIDENT_HOST_PRESENTATION_FAILED'));
      }
    });
    if (res.writableEnded || res.destroyed) throw new Error('RESIDENT_HOST_PRESENTATION_FAILED');
    emitted = true;
    return true;
  };
}

function createNonStreamPresentationSink({ channelId, presentations, res }) {
  return async (presentation) => {
    if (!Array.isArray(presentations) || presentations.length !== 0 || !res || res.writableEnded || res.destroyed) {
      throw new Error('RESIDENT_HOST_PRESENTATION_FAILED');
    }
    presentations.push(presentationEnvelope(channelId, presentation));
    res.__vcpDisableReplayCache?.();
    return true;
  };
}

function attachNonStreamPresentations(response, presentations) {
  if (!isPlainObject(response) || !Array.isArray(presentations) || presentations.length === 0) return response;
  response[NON_STREAM_PRESENTATIONS_FIELD] = presentations;
  return response;
}

module.exports = Object.freeze({
  DISCOVERY_BOOTSTRAP_SCHEMA,
  HOST_PRESENTATION_KIND,
  HOST_PRESENTATION_SCHEMA,
  NON_STREAM_PRESENTATIONS_FIELD,
  PRESENTATION_CHANNEL_HEADER,
  PRESENTATION_DELTA_FIELD,
  RESIDENT_TOOL_NAME,
  attachNonStreamPresentations,
  createNonStreamPresentationSink,
  createPresentationChannel,
  createStreamPresentationSink,
  frameResidentProposalTurn,
  hasResidentDiscoveryBootstrap,
  hasResidentProposalSurface,
  isResidentProposalToolCall,
  residentProposalFailureCategory,
  validateHostPresentation
});

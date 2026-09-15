\
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const resident = require('../modules/vcpLoop/residentPresentation.js');

function validPresentation() {
  return {
    challenge: '确认变更，山、河、星',
    expiresInSeconds: 90,
    kind: 'OWNER_CONSENT_CHALLENGE',
    mutationType: 'START_TASK',
    schema: 'agents-os-resident.host-presentation.v1',
    title: 'AGENTSOSResident · Owner Consent'
  };
}

test('Resident host presentation accepts only exact bounded challenge envelopes', () => {
  const accepted = resident.validateHostPresentation(validPresentation());
  assert.equal(accepted.challenge, '确认变更，山、河、星');
  assert.throws(() => resident.validateHostPresentation({ ...validPresentation(), extra: true }));
  assert.throws(() => resident.validateHostPresentation({ ...validPresentation(), challenge: 'wrong' }));
});

test('Resident proposal framer hides proposal tool block from client content', () => {
  const parsed = { name: 'AGENTSOSResident', archery: false, args: { operation: 'PROPOSE_TASK_MUTATION' } };
  const parser = {
    MARKERS: { START: '[[START]]' },
    parse() { return [parsed]; },
    extractNextToolBlock(content, offset) {
      if (offset > 0) return null;
      return { startIndex: 7, nextOffset: content.length, blockContent: 'resident-proposal' };
    },
    parseBlock() { return parsed; }
  };
  const framed = resident.frameResidentProposalTurn('visible[[START]]private-payload', parser);
  assert.equal(framed.kind, 'RESIDENT_PROPOSAL');
  assert.equal(framed.clientContent, 'visible');
  assert.equal(framed.loopContent, 'visible[[START]]private-payload');
});

test('Resident presentation sinks are host-only and disable replay cache', async () => {
  class FakeResponse extends EventEmitter {
    constructor() {
      super();
      this.headersSent = false;
      this.writableEnded = false;
      this.destroyed = false;
      this.headers = {};
      this.writes = [];
      this.cacheDisabled = false;
    }
    setHeader(k, v) { this.headers[k] = v; }
    write(chunk, cb) { this.writes.push(String(chunk)); if (cb) cb(); return true; }
    __vcpDisableReplayCache() { this.cacheDisabled = true; }
  }
  const res = new FakeResponse();
  const channelId = resident.createPresentationChannel(res, true);
  const streamSink = resident.createStreamPresentationSink({ channelId, model: 'test', res });
  await streamSink(validPresentation());
  assert.equal(res.cacheDisabled, true);
  assert.match(res.writes.join(''), /vcp_ephemeral_presentation/);

  const list = [];
  const res2 = new FakeResponse();
  const channel2 = resident.createPresentationChannel(res2, true);
  const nonStreamSink = resident.createNonStreamPresentationSink({ channelId: channel2, presentations: list, res: res2 });
  await nonStreamSink(validPresentation());
  const response = {};
  resident.attachNonStreamPresentations(response, list);
  assert.equal(response.vcp_ephemeral_presentations.length, 1);
  assert.equal(res2.cacheDisabled, true);
});

test('P4 keeps exact Resident admission narrow and all other external direct plugins fail closed', () => {
  const plugin = fs.readFileSync('Plugin.js', 'utf8');
  assert.match(plugin, /classification\?\.pluginName === RESIDENT_TOOL_NAME/);
  assert.match(plugin, /policyDecision\?\.decision === 'would_allow'/);
  assert.match(plugin, /code: 'resident_external_direct_runtime_allowed'/);
  assert.match(plugin, /external_hybrid_runtime_denied/);
  assert.match(plugin, /external_direct_runtime_denied/);
  assert.match(plugin, /Object\.defineProperty\(directContext, 'emitEphemeralPresentation'/);
});

test('P4 host seams pass proposal presentation without serializing it as ordinary tool content', () => {
  const tool = fs.readFileSync('modules/vcpLoop/toolExecutor.js', 'utf8');
  const non = fs.readFileSync('modules/handlers/nonStreamHandler.js', 'utf8');
  const stream = fs.readFileSync('modules/handlers/streamHandler.js', 'utf8');
  assert.match(tool, /residentPresentationSink/);
  assert.match(tool, /residentProposalFailureCategory/);
  assert.match(non, /frameResidentProposalTurn/);
  assert.match(non, /attachNonStreamPresentations/);
  assert.match(stream, /deferredClientWrites/);
  assert.match(stream, /frameResidentProposalTurn/);
  assert.match(stream, /discardDeferredClientWrites/);
});

test('P4 provider path retains exact-body seal and fail-closed presence binding', () => {
  const handler = fs.readFileSync('modules/chatCompletionHandler.js', 'utf8');
  assert.match(handler, /RESIDENT_PROVIDER_ATTEMPT_DENIED/);
  assert.match(handler, /result\.body === input\.finalBodyText/);
  assert.match(handler, /sealProviderAttempt/);
  assert.match(handler, /providerAttemptNamespace/);
  assert.match(handler, /!residentPresenceRequested[\s\S]{0,160}responseReplayCache\.replay/);
});

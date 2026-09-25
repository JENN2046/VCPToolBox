'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const test = require('node:test');

const handler = fs.readFileSync('modules/chatCompletionHandler.js', 'utf8');
const oneRing = fs.readFileSync('Plugin/OneRing/OneRing.js', 'utf8');
const pluginManager = fs.readFileSync('Plugin.js', 'utf8');

function loadPresenceValidators() {
  const start = handler.indexOf('function isPlainRecord(value)');
  const end = handler.indexOf('function parseBooleanEnv', start);
  assert.ok(start >= 0 && end > start, 'presence validator source slice must exist');
  const source = `${handler.slice(start, end)}\n` +
    `this.validateJson = json => validOneRingPresenceMeta(JSON.parse(json));\n` +
    `this.sameJson = (left, right) => sameOneRingPresenceMeta(JSON.parse(left), JSON.parse(right));`;
  const context = { Buffer, createHash };
  vm.runInNewContext(source, context, { filename: 'chatCompletionHandler.presence.validators.js' });
  return {
    valid(value) { return context.validateJson(JSON.stringify(value)); },
    same(left, right) { return context.sameJson(JSON.stringify(left), JSON.stringify(right)); }
  };
}

function meta(overrides = {}) {
  return {
    agentName: 'Nuobao',
    externalKeyDigest: null,
    frontendPlane: null,
    frontendPrincipalDigest: null,
    frontendSource: 'VCPChat',
    requestHash: '1'.repeat(64),
    turnId: 'turn:r1:test',
    ...overrides
  };
}

test('OneRing explicitly projects unknown authority metadata as null', () => {
  const marker = '_extractMetaFromMessages(messages) {';
  const start = oneRing.indexOf(marker);
  assert.ok(start >= 0, '_extractMetaFromMessages must exist');
  const next = oneRing.indexOf('_hasOneRingActivationSignal(messages)', start);
  const body = oneRing.slice(start, next > start ? next : start + 3200);
  for (const key of ['externalKeyDigest', 'frontendPlane', 'frontendPrincipalDigest']) {
    const match = body.match(new RegExp(`${key}:\\s*([^,\\n]+)`));
    assert.ok(match, `${key} must be explicitly projected`);
    assert.equal(match[1].trim(), 'null', `${key} must remain honest UNKNOWN`);
  }
});

test('Host admits honest UNKNOWN OneRing authority metadata for Resident evaluation', () => {
  const validators = loadPresenceValidators();
  assert.equal(validators.valid(meta()), true);
});

test('Host still admits exact non-null authority metadata when a trusted producer exists', () => {
  const validators = loadPresenceValidators();
  assert.equal(validators.valid(meta({
    externalKeyDigest: 'a'.repeat(64),
    frontendPlane: 'VCPCHAT',
    frontendPrincipalDigest: 'b'.repeat(64)
  })), true);
});

test('Host rejects malformed non-null authority metadata', () => {
  const validators = loadPresenceValidators();
  assert.equal(validators.valid(meta({ externalKeyDigest: 'not-a-digest' })), false);
  assert.equal(validators.valid(meta({ frontendPlane: 'vcpchat' })), false);
  assert.equal(validators.valid(meta({ frontendPrincipalDigest: 'xyz' })), false);
});

test('OneRing metadata equality treats UNKNOWN as a real stable contract value', () => {
  const validators = loadPresenceValidators();
  assert.equal(validators.same(meta(), meta()), true);
  assert.equal(validators.same(meta(), meta({ requestHash: '2'.repeat(64) })), false);
  assert.equal(validators.same(meta(), meta({ externalKeyDigest: 'a'.repeat(64) })), false);
});

test('Host passes OneRing authority fields through without synthesizing identity', () => {
  assert.match(handler, /externalKeyDigest:\s*presenceOneRingMeta\.externalKeyDigest/);
  assert.match(handler, /frontendPlane:\s*presenceOneRingMeta\.frontendPlane/);
  assert.match(handler, /frontendPrincipalDigest:\s*presenceOneRingMeta\.frontendPrincipalDigest/);
});

test('Resident remains an explicit external composition dependency and missing composition fails closed', () => {
  assert.match(pluginManager, /VCP_PLUGIN_DIRS/);
  assert.match(pluginManager, /VCP_EXTERNAL_PLUGIN_ALLOWLIST/);
  assert.match(handler, /messagePreprocessors\s*\.get\('AGENTSOSResident'\)/);
  assert.match(handler, /!residentModule[\s\S]{0,240}typeof residentModule\.processMessages !== 'function'/);
  assert.match(handler, /Object\.getOwnPropertyDescriptor\([\s\S]{0,500}'sealProviderAttempt'/);
  assert.match(handler, /throw residentProviderAttemptDenied\(\)/);
});

test('Presence-bound path keeps replay-cache bypass and bounded provider-seal gating', () => {
  assert.match(handler, /!residentPresenceRequested[\s\S]{0,120}responseReplayCache\.replay/);
  assert.match(handler, /__vcpDisableReplayCache/);
  assert.match(handler, /const sealed = await new Promise\(/);
  assert.match(handler, /sealTimeoutId = setTimeout\(\(\) => attemptController\.abort\(\), sealTimeoutMs\)/);
  assert.match(handler, /sealProviderAttempt/);
  assert.match(handler, /RESIDENT_PROVIDER_ATTEMPT_DENIED/);
});

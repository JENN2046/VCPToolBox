'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');

test('Resident host contract is wired without vendoring Resident source', () => {
  const plugin = fs.readFileSync(path.join(ROOT, 'Plugin.js'), 'utf8');
  const chat = fs.readFileSync(path.join(ROOT, 'modules/chatCompletionHandler.js'), 'utf8');
  const nonStream = fs.readFileSync(path.join(ROOT, 'modules/handlers/nonStreamHandler.js'), 'utf8');
  const stream = fs.readFileSync(path.join(ROOT, 'modules/handlers/streamHandler.js'), 'utf8');
  const executor = fs.readFileSync(path.join(ROOT, 'modules/vcpLoop/toolExecutor.js'), 'utf8');
  const presentation = fs.readFileSync(path.join(ROOT, 'modules/vcpLoop/residentPresentation.js'), 'utf8');

  assert.match(plugin, /AGENTSOSResident/);
  assert.match(plugin, /_isExactAdmittedResidentExternalDirect/);
  assert.match(plugin, /resident_external_direct_runtime_allowed/);
  assert.match(plugin, /external_direct_runtime_denied/);
  assert.match(plugin, /external_hybrid_runtime_denied/);
  assert.match(plugin, /hybridservice/);
  assert.match(plugin, /direct/);

  assert.match(chat, /RESIDENT_PRESENCE_BINDING_PROPERTY/);
  assert.match(chat, /result\.body === input\.finalBodyText/);
  assert.match(chat, /finalBodyText: attemptOptions\.body/);
  assert.match(chat, /RESIDENT_PROVIDER_ATTEMPT_DENIED/);
  assert.match(chat, /__vcpDisableReplayCache/);
  assert.match(chat, /beforeProviderAttempt/);

  assert.match(nonStream, /residentPresentation/);
  assert.match(stream, /residentPresentation/);
  assert.match(executor, /residentPresentationSink/);

  assert.match(presentation, /agents-os-resident\.host-presentation\.v1/);
  assert.match(presentation, /OWNER_CONSENT_CHALLENGE/);
  assert.match(presentation, /RESIDENT_HOST_PRESENTATION_REJECTED/);
});

test('Resident source remains external to the clean tracking tree', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'Plugin', 'AGENTSOSResident')), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'extensions', 'agents-os-resident')), false);
});

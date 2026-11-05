'use strict';

// Compile the actual executor with inert imports. No configuration, provider,
// database, scheduler filesystem or Resident daemon is used by these regressions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const filename = path.resolve(__dirname, '../modules/vcpLoop/toolExecutor.js');
const source = fs.readFileSync(filename, 'utf8');
const PRIVATE_DETAIL = 'synthetic-private-failure-detail';

function fixture(options = {}) {
  const calls = {detached: 0, scheduled: 0, dispatched: 0, broadcasts: [], records: [], order: []};
  const recorder = {
    beginRecord() { return {id: 'synthetic-record'}; },
    finishRecord(_handle, record) { calls.order.push('record'); calls.records.push(record); }
  };
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = module.paths;
  compiled.require = name => {
    if (name === '../../EmbeddingUtils') return {};
    if (name === '../toolCallRecordStore') return recorder;
    if (name === '../jevRiverReranker') return {isEnabled: () => false};
    if (name === '../jevToolCallExp') return {
      isVirtualToolName: name => name === 'JEV',
      plan: async () => options.expandedCalls || []
    };
    return require(name);
  };
  compiled._compile(source, filename);
  const resident = {async shutdown() {
    calls.order.push('detach'); calls.detached++;
    if (options.shutdownThrows) throw new Error(PRIVATE_DETAIL);
  }};
  const manager = {
    getPlugin() {
      if (options.lookupThrows) throw new Error(PRIVATE_DETAIL);
      return options.missing ? null : resident;
    },
    getServiceModule() { return options.fallback ? undefined : resident; },
    async processToolCall(...args) {
      calls.dispatched++;
      calls.executionOptions = args[4];
      if (options.error) throw options.error;
      return options.result || {content: [{type: 'text', text: 'canonical proposal observation'}]};
    }
  };
  const executor = new compiled.exports({pluginManager: manager,
    webSocketServer: {broadcast(value) { calls.order.push('broadcast'); calls.broadcasts.push(value); }},
    debugMode: false, vcpToolCode: !!options.auth,
    getRealAuthCode: async () => { throw new Error('authentication was not stubbed'); }});
  executor._verifyAuth = async () => {
    if (options.authThrows) throw new Error(PRIVATE_DETAIL);
    return {valid: false, message: PRIVATE_DETAIL};
  };
  executor._scheduleTimedToolCall = async call => {
    calls.scheduled++;
    calls.scheduledCall = call;
    return {success: true, content: [{type: 'text', text: 'scheduled'}]};
  };
  return {executor, calls};
}

function proposal(args = {}) {
  return {name: 'AGENTSOSResident', args: {operation: 'PROPOSE_GOAL_MUTATION', ...args}};
}

function checkFailure(result, calls, category) {
  assert.equal(result.success, false);
  assert.equal(calls.detached, 1);
  assert.equal(calls.scheduled, 0);
  assert.equal(result.residentProposalFailureCategory, category);
  assert.equal(result.error, category);
  assert.deepEqual(Object.getOwnPropertyDescriptor(result, 'residentProposalFailureCategory'), {
    value: category, configurable: false, enumerable: false, writable: false
  });
  assert.equal(JSON.stringify(result).includes('residentProposalFailureCategory'), false);
  assert.equal(result.recordId, 'synthetic-record');
  assert.equal(calls.records.at(-1).success, false);
  assert.equal(calls.records.at(-1).error, category);
  assert.doesNotMatch(JSON.stringify({result, broadcasts: calls.broadcasts, records: calls.records}), /synthetic-private/);
  assert.deepEqual(calls.order, ['detach', 'broadcast', 'record']);
}

for (const operation of ['PROPOSE_GOAL_MUTATION', 'PROPOSE_TASK_MUTATION']) {
  test(`${operation} cannot enter deferred scheduling`, async () => {
    const {executor, calls} = fixture();
    checkFailure(await executor.execute(proposal({operation, timely_contact: 'synthetic-time'})),
      calls, 'PROPOSAL_INPUT_REJECTED');
    assert.equal(calls.dispatched, 0);
  });
}

for (const [name, options] of [
  ['authentication rejection', {auth: true}],
  ['authentication failure', {auth: true, authThrows: true}],
  ['missing plugin', {missing: true}],
  ['lookup failure', {lookupThrows: true}]
]) test(`${name} invalidates before low-disclosure output`, async () => {
  const {executor, calls} = fixture(options);
  checkFailure(await executor.execute(proposal()), calls, 'PROPOSAL_DISPATCH_FAILED');
  assert.equal(calls.dispatched, 0);
});

for (const category of ['DISPATCH_FAILED', 'EXECUTION_FAILED', 'INPUT_REJECTED',
  'PREPARE_FAILED', 'PRESENTATION_FAILED', 'RESULT_REJECTED']) {
  for (const transport of ['code', 'json']) test(`${category} survives ${transport} error wrapping without details`, async () => {
    const code = `RESIDENT_PROPOSAL_${category}`;
    const error = new Error(transport === 'json'
      ? JSON.stringify({residentProposalFailure: code, detail: PRIVATE_DETAIL}) : PRIVATE_DETAIL);
    if (transport === 'code') error.code = code;
    const {executor, calls} = fixture({error});
    checkFailure(await executor.execute(proposal()), calls, `PROPOSAL_${category}`);
    assert.equal(calls.dispatched, 1);
  });
}

test('unrecognized failure code cannot select inherited object properties', async () => {
  const error = new Error(PRIVATE_DETAIL); error.code = 'constructor';
  const {executor, calls} = fixture({error});
  checkFailure(await executor.execute(proposal()), calls, 'PROPOSAL_EXECUTION_FAILED');
});

test('plugin fallback detaches when no service accessor is available', async () => {
  const {executor, calls} = fixture({fallback: true, error: new Error(PRIVATE_DETAIL)});
  checkFailure(await executor.execute(proposal()), calls, 'PROPOSAL_EXECUTION_FAILED');
});

test('teardown errors remain rejected and do not disclose their details', async () => {
  const {executor, calls} = fixture({shutdownThrows: true, error: new Error(PRIVATE_DETAIL)});
  checkFailure(await executor.execute(proposal()), calls, 'PROPOSAL_EXECUTION_FAILED');
});

test('successful proposals retain presentation context and record success', async () => {
  const {executor, calls} = fixture();
  const sink = async () => true;
  const result = await executor.execute(proposal(), null, [], {residentPresentationSink: sink});
  assert.equal(result.success, true);
  assert.equal(calls.detached, 0);
  assert.equal(calls.executionOptions.residentPresentationSink, sink);
  assert.equal(calls.records.at(-1).success, true);
});

test('ordinary deferred calls preserve scheduling and never detach Resident', async () => {
  const {executor, calls} = fixture();
  const call = {name: 'OrdinaryTool', args: {timely_contact: 'synthetic-time'}};
  assert.equal((await executor.execute(call)).success, true);
  assert.equal(calls.scheduledCall, call);
  assert.equal(calls.scheduled, 1);
  assert.equal(calls.detached, 0);
});

test('ordinary execution errors preserve readable approval feedback', async () => {
  const {executor, calls} = fixture({error: new Error(JSON.stringify({plugin_error: 'tool rejected', user_feedback: 'use the other file'}))});
  const result = await executor.execute({name: 'OrdinaryTool', args: {}});
  assert.equal(result.success, false);
  assert.match(result.content[0].text, /tool rejected\n用户反馈: use the other file/);
  assert.equal(calls.detached, 0);
});

test('ordinary explicit failures keep success:false and failed records', async () => {
  const {executor, calls} = fixture({result: {success: false, error: 'business failure'}});
  const result = await executor.execute({name: 'OrdinaryTool', args: {}});
  assert.equal(result.success, false);
  assert.equal(result.error, 'business failure');
  assert.equal(calls.records.at(-1).success, false);
  assert.equal(calls.detached, 0);
});

test('JEV expansion cannot bypass the Resident deferred-call rejection', async () => {
  const {executor, calls} = fixture({expandedCalls: [proposal({timely_contact: 'synthetic-time'})]});
  checkFailure(await executor.execute({name: 'JEV', args: {expression: 'synthetic'}}),
    calls, 'PROPOSAL_INPUT_REJECTED');
  assert.equal(calls.dispatched, 0);
});

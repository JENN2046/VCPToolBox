'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createStdioContext}=require('../modules/nativeConversationTransport');const {buildExternalPluginRuntimeEnv}=require('../modules/pluginRuntimeEnvSandbox');
test('JSON cannot mint host provenance and external environment policy remains unchanged',async()=>{
 const plugin={name:'Example',nativeConversation:{protocol:'trusted-conversation-v1'}};
 await assert.rejects(createStdioContext(plugin,{}, {human:true,approved:true,role:'user'}),/NATIVE_CONTEXT_REQUIRED/);
 const env=buildExternalPluginRuntimeEnv({},{JSO_LOCAL_AGENT_TOKEN:'synthetic-value'},{VCP_NATIVE_APPLICATION_AUTHORIZATION:'Bearer synthetic',VCP_EXECUTION_CONTEXT:'opaque-invocation-context'});
 assert.equal(env.JSO_LOCAL_AGENT_TOKEN,undefined);assert.equal(env.VCP_NATIVE_APPLICATION_AUTHORIZATION,undefined);assert.equal(env.VCP_EXECUTION_CONTEXT,'opaque-invocation-context');
});
test('temporary stdio broker rejects absent capability and has no Owner authority on model calls',async()=>{
 const context=await createStdioContext({name:'Example',nativeConversation:{protocol:'trusted-conversation-v1'}},{JSO_LOCAL_AGENT_ENDPOINT:'http://127.0.0.1:1/api/v2/agent/tools',JSO_LOCAL_AGENT_TOKEN:'synthetic'.padEnd(40,'x'),JSO_RESOURCE_IDS:'R'},undefined);
 const c=JSON.parse(context.env.VCP_EXECUTION_CONTEXT);
 try{
  assert.equal((await fetch(c.endpoint,{method:'POST',body:'{}'})).status,403);
  const r=await fetch(c.endpoint,{method:'POST',headers:{authorization:'Bearer '+c.capability},body:JSON.stringify({kind:'owner-session'})}).then(r=>r.json());assert.equal(r.code,'APPLICATION_SESSION_REQUIRED');
  assert.equal(JSON.stringify(context.env).includes('synthetic'),false);
 }finally{await context.close();}
 await assert.rejects(fetch(c.endpoint));
});
test('broker only releases scoped reschedule receipts, including when upstream identity is broader',async()=>{
 const {createServer}=require('node:http');let value;
 const upstream=createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(value));});await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 let context;try{context=await createStdioContext({name:'Example',nativeConversation:{protocol:'trusted-conversation-v1'}},{JSO_LOCAL_AGENT_ENDPOINT:`http://127.0.0.1:${upstream.address().port}/api/v2/agent/tools`,JSO_LOCAL_AGENT_TOKEN:'x'.repeat(40),JSO_RESOURCE_IDS:'OTHER'});const c=JSON.parse(context.env.VCP_EXECUTION_CONTEXT);
 for(const candidate of [{ok:true,kind:'reschedule',receipt:{resourceId:'OTHER'}},{ok:true,kind:'reschedule',receipt:{resourceId:'PHOTO'}},{ok:true,kind:'reschedule',receipt:{}},{ok:true,kind:'reschedule',receipt:{resourceId:''}},{ok:true,kind:'reschedule',receipt:{resourceId:null}},{ok:true,kind:'proposalDecision',receipt:{}},{ok:true,kind:'proposalGeneration',receipt:{}},{ok:false,code:'OPERATION_NOT_FOUND'}]){value=candidate;const result=await fetch(c.endpoint,{method:'POST',headers:{authorization:'Bearer '+c.capability},body:JSON.stringify({kind:'agent',args:{command:'read_receipt',payload_json:'{"operationId":"SYNTHETIC"}'}})}).then(r=>r.json());if(!value.ok)assert.equal(result.code,value.code);else assert.equal(result.ok,value.kind==='reschedule'&&value.receipt.resourceId==='OTHER');}
 }finally{await context?.close();await new Promise(r=>upstream.close(r));}
});

// Trusted Action v1 conformance additions live in the existing paired-profile file,
// so the immutable Extensions harness runs them without a second test runner/profile.
const crypto = require('node:crypto');
const { ApprovalReceiptAuthority, digest, INVALID_CODE } = require('../modules/approvalReceiptAuthority');
const { HumanClientAdmission } = require('../modules/humanClientAdmission');
const admissionCrypto = require('../modules/humanClientAdmissionCrypto');

function trustedActionFixture() {
 const clock = { now: 1800000000000 };
 const authority = new ApprovalReceiptAuthority({ now: () => clock.now, testOnly: true });
 const records = new Map();
 const store = {
  testOnly: true,
  add(record) { assert.equal(records.has(record.clientEnrollmentId), false); records.set(record.clientEnrollmentId, {...record}); return {...record}; },
  get(id) { const record = records.get(id); return record ? {...record} : null; },
  update(id, fields) { const record = records.get(id); assert.ok(record); Object.assign(record, fields); return {...record}; }
 };
 // Synthetic enrollment only. This exercises real proof verification and never
 // enables the production-disabled trusted-client implementation profile.
 const admission = new HumanClientAdmission({authority, store, now: () => clock.now,
  trustedHostOrigin: 'https://trusted-action.example.test', humanIntentVerifier: () => true});
 const {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519');
 const sign = proof => ({nonceId: proof.nonceId,
  signature: crypto.sign(null, admissionCrypto.transcript(proof.boundFields).bytes, privateKey).toString('base64url')});
 const enrollment = admission.begin({protocolVersion: 1,
  publicKeySpki: publicKey.export({format: 'der', type: 'spki'}).toString('base64url')});
 admission.recordEnrollmentDecision(enrollment.enrollmentId, 'approve', {});
 const session = admission.claim(enrollment.enrollmentId, sign(enrollment.proof));
 const payload = {command: 'write', requestId: 'synthetic-original-operation', target: {value: 7}};
 const request = {method: 'POST', url: '/v1/tools/execute'};
 const target = {method: request.method, path: request.url, bodyDigest: digest(payload)};
 const challenge = admission.httpChallenge(session.sessionId, target);
 admission.completeHttpRequest(request, session.sessionId, target, sign(challenge));
 const pending = authority.snapshot('Example', payload,
  {requiresApproval: true, matchedRule: 'Example:write', matchedCommand: 'write'}, {enabled: true, approveAll: false});
 const intent = {decision: 'approve', hostApprovalRequestId: 'synthetic-host-request', targetDigest: pending.argsDigest};
 const expected = {toolName: 'Example', command: payload.command, requestId: payload.requestId, payload};
 const approve = () => authority.approve(pending, authority.attestIntent(pending, intent, request));
 return {authority, admission, clock, session, request, payload, pending, intent, expected, approve};
}
const invalidReceipt = error => error.code === INVALID_CODE && error.message === INVALID_CODE;

for (const forged of [
 {role: 'user', human: true, approved: true},
 {sourceClass: 'authenticated_human_client_session', clientSurface: 'vcp_chat', sessionId: 'claimed'},
 {token: 'synthetic-token', grants: ['write'], principal: 'owner'}
]) test('TA-1/TA-9: serialized authority claims cannot replace authenticated object identity: '+Object.keys(forged)[0], () => {
 const f = trustedActionFixture();
 assert.equal(f.authority.isHuman(forged), false);
 assert.equal(f.authority.humanContext(forged), null);
 assert.throws(() => f.authority.attestIntent(f.pending, f.intent, forged), invalidReceipt);
 assert.throws(() => f.authority.approve(f.pending, {...f.intent, context: f.request, record: f.pending}), invalidReceipt);
 assert.throws(() => f.authority.attestIntent({...f.pending}, f.intent, f.request), invalidReceipt);
});

test('TA-1/TA-3/TA-4: exact immutable snapshot and real host proof yield only one consume', () => {
 const f = trustedActionFixture(), receipt = f.approve(), context = {};
 assert.ok(Object.isFrozen(f.pending.args.target));
 f.payload.target.value = 8;
 assert.equal(f.pending.args.target.value, 7);
 const original = f.pending.args;
 f.authority.bindInvocation(receipt, context, original);
 assert.deepEqual(Object.keys(context), [], 'receipt handles stay outside enumerable plugin data');
 const expected = {...f.expected, payload: original};
 const verified = f.authority.verifyAuthorization(expected, context);
 assert.equal(verified.payloadDigest, digest(original));
 assert.equal(verified.requestId, original.requestId);
 assert.equal(verified.authorityGateVerified, true);
 assert.equal(f.authority.invocationAudit(context).state, 'CONSUMED');
 assert.throws(() => f.authority.verifyAuthorization(expected, context), invalidReceipt);
 assert.throws(() => f.authority.bindInvocation(receipt, {}, original), invalidReceipt);
});

for (const field of ['targetDigest', 'hostApprovalRequestId', 'decision'])
 test('TA-3: malformed or changed confirmation cannot issue a receipt: '+field, () => {
  const f = trustedActionFixture();
  const altered = {...f.intent, [field]: field === 'targetDigest' ? '0'.repeat(64) : ''};
  assert.throws(() => f.authority.attestIntent(f.pending, altered, f.request), invalidReceipt);
 });

test('TA-3/TA-4: changed arguments invalidate the handle permanently, including a corrected retry', () => {
 const f = trustedActionFixture(), receipt = f.approve();
 assert.throws(() => f.authority.bindInvocation(receipt, {}, {...f.payload, target: {value: 8}}), invalidReceipt);
 assert.throws(() => f.authority.bindInvocation(receipt, {}, f.payload), invalidReceipt);
});

test('TA-4: duplicate bind invalidates the original eligibility instead of making a second authorization', () => {
 const f = trustedActionFixture(), receipt = f.approve(), first = {};
 f.authority.bindInvocation(receipt, first, f.payload);
 assert.throws(() => f.authority.bindInvocation(receipt, {}, f.payload), invalidReceipt);
 assert.throws(() => f.authority.verifyAuthorization(f.expected, first), invalidReceipt);
 assert.equal(f.authority.invocationAudit(first).state, 'INVALIDATED');
});

for (const field of ['toolName', 'command', 'requestId', 'payload'])
 test('TA-2/TA-3/TA-4: verifier binds '+field+' and rejects corrected replay after mismatch', () => {
  const f = trustedActionFixture(), receipt = f.approve(), context = {};
  f.authority.bindInvocation(receipt, context, f.payload);
  const altered = {...f.expected, [field]: field === 'payload' ? {...f.payload, target: {value: 8}} : 'different'};
  assert.throws(() => f.authority.verifyAuthorization(altered, context), invalidReceipt);
  assert.throws(() => f.authority.verifyAuthorization(f.expected, context), invalidReceipt);
 });

test('TA-1/TA-4: copied invocation handles do not transfer host context', () => {
 const f = trustedActionFixture(), receipt = f.approve(), context = {};
 f.authority.bindInvocation(receipt, context, f.payload);
 assert.throws(() => f.authority.verifyAuthorization(f.expected, {...receipt, humanApproved: true}), invalidReceipt);
 assert.equal(f.authority.verifyAuthorization(f.expected, context).authorityGateVerified, true);
});

for (const consumed of [false, true])
 test('TA-4/TA-5: invocation finalization cannot restore eligibility after an unknown outcome; consumed='+consumed, () => {
  const f = trustedActionFixture(), receipt = f.approve(), context = {};
  f.authority.bindInvocation(receipt, context, f.payload);
  if (consumed) f.authority.verifyAuthorization(f.expected, context);
  f.authority.finishInvocation(context);
  assert.equal(f.authority.invocationAudit(context), null);
  assert.throws(() => f.authority.verifyAuthorization(f.expected, context), invalidReceipt);
  assert.throws(() => f.authority.bindInvocation(receipt, {}, f.payload), invalidReceipt);
  const reconstructed = new ApprovalReceiptAuthority({testOnly: true});
  assert.throws(() => reconstructed.bindInvocation(receipt, {}, f.payload), invalidReceipt);
 });

test('TA-6: denied pending intent is terminal and cannot be changed to approve', () => {
 const f = trustedActionFixture();
 const denied = f.authority.attestIntent(f.pending, {...f.intent, decision: 'deny'}, f.request);
 assert.throws(() => f.authority.approve(f.pending, denied), invalidReceipt);
 assert.throws(() => f.authority.attestIntent(f.pending, f.intent, f.request), invalidReceipt);
 // This is in-memory receipt denial, not a claim of durable business cancellation.
});

test('TA-1/TA-9: revoked human context cannot approve an already attested intent', () => {
 const f = trustedActionFixture(), intent = f.authority.attestIntent(f.pending, f.intent, f.request);
 f.admission.revoke(f.session.sessionId);
 assert.equal(f.authority.isHuman(f.request), false);
 assert.throws(() => f.authority.approve(f.pending, intent), invalidReceipt);
});

test('TA-3/TA-9: expired receipt fails closed at the exact expiry', () => {
 const f = trustedActionFixture(), receipt = f.approve(), context = {};
 f.authority.bindInvocation(receipt, context, f.payload);
 f.clock.now += f.authority.receiptTtl;
 assert.throws(() => f.authority.verifyAuthorization(f.expected, context), invalidReceipt);
});

// Native transport validates framing/provenance; it cannot manufacture a target
// authorization. The target's denial remains a business result, without retry.
test('TA-8: admitted native invocation preserves independent target denial without automatic retry', async () => {
 const {executeNativeRequest} = require('../modules/nativeConversationTransport');
 const plugin = {name: 'Example', nativeConversation: {protocol: 'trusted-conversation-v1'}, communication: {protocol: 'stdio'}};
 let calls = 0;
 const denial = {ok: false, code: 'TARGET_SCOPE_DENIED'};
 const manager = {plugins: new Map([[plugin.name, plugin]]), async executePlugin(_name, args) {
  calls++;
  assert.deepEqual(JSON.parse(args), {nativeAction: 'execute', payload: {sourceId: 'synthetic-source'}});
  return {result: denial};
 }};
 const result = await executeNativeRequest(manager, plugin.name, 'Bearer '+'synthetic'.padEnd(40, 'x'),
  {action: 'execute', payload: {sourceId: 'synthetic-source'}});
 assert.deepEqual(result, denial);
 assert.equal(calls, 1);
});

// Keep the live NativeSync request context independent of JSO conversation
// provenance: preserving diagnostics/cancellation must not confer Owner access.
const nativeExecution = require('../modules/requestExecutionContext');
test('NativeSync bridge settlement and cancellation survive native host alignment', async () => {
 const controller = new AbortController(), seen = [];
 const bridge = {onToolDispatch: async x => seen.push(['dispatch',x]),
  onToolSettled: async x => seen.push(['settled',x]),
  onTaskAccepted: async () => {}, onTaskObserved: async () => {}};
 const unregister = nativeExecution.register('synthetic-native-sync', {}, bridge);
 try {
  await nativeExecution.run('synthetic-native-sync', controller.signal, async () => {
   const result = await nativeExecution.runToolInvocation({pluginName:'Example'}, async () => 'ok');
   assert.equal(result,'ok');assert.equal(seen[0][0],'dispatch');assert.equal(seen[1][0],'settled');
   assert.equal(seen[0][1].invocationId,seen[1][1].invocationId);
   assert.equal(seen[1][1].outcome,'returned');
   controller.abort();
   await assert.rejects(nativeExecution.runToolInvocation({pluginName:'Example'}, async () => assert.fail('cancelled dispatch')), {code:'NATIVE_EXECUTION_CANCELLED'});
   assert.equal(seen.length,2);
  });
 } finally {unregister();}
});
test('NativeSync settlement failure is unknown, never a successful return', async () => {
 const unregister=nativeExecution.register('synthetic-unconfirmed',{}, {
  onToolDispatch:async()=>{},onToolSettled:async()=>{throw Error('synthetic-lost-settlement');},
  onTaskAccepted:async()=>{},onTaskObserved:async()=>{}});
 try {await nativeExecution.run('synthetic-unconfirmed',new AbortController().signal,async()=>{
  await assert.rejects(nativeExecution.runToolInvocation({pluginName:'Example'},async()=> 'returned'),{code:'NATIVE_TOOL_SETTLEMENT_UNCONFIRMED',nativeOutcome:'returned'});
 });} finally {unregister();}
});
test('NativeSync request and tool arguments cannot mint native conversation provenance', async () => {
 const unregister=nativeExecution.register('synthetic-no-owner',{},undefined);
 try {await nativeExecution.run('synthetic-no-owner',new AbortController().signal,async()=>{
  await assert.rejects(createStdioContext({name:'Example',nativeConversation:{protocol:'trusted-conversation-v1'}},{}, {requestId:'synthetic-no-owner',human:true,approved:true}),/NATIVE_CONTEXT_REQUIRED/);
 });} finally {unregister();}
});

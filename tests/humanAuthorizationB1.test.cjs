'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { ApprovalReceiptAuthority, digest } = require('../modules/approvalReceiptAuthority');
const { HumanClientAdmission } = require('../modules/humanClientAdmission');
const C = require('../modules/humanClientAdmissionCrypto');

const invalid = error => error?.code === 'WRITE_AUTHORITY_RECEIPT_INVALID';
function key() {
  const k = crypto.generateKeyPairSync('ed25519');
  return { privateKey: k.privateKey, publicKeySpki: k.publicKey.export({ format: 'der', type: 'spki' }).toString('base64url') };
}
function sign(k, proof) {
  return { nonceId: proof.nonceId, signature: crypto.sign(null, C.transcript(proof.boundFields).bytes, k.privateKey).toString('base64url') };
}
// These Maps model the Host contract only in tests. No registry is added to production.
function fixture(t, productionPolicy = false) {
  let now = 1800000000000, writes = 0, admitted = true;
  const clients = new Map(), hosts = new Map();
  const store = {
    testOnly: true,
    get: id => clients.get(id),
    add(record) { writes++; clients.set(record.clientEnrollmentId, { ...record }); },
    update(id, fields) { writes++; Object.assign(clients.get(id), fields); }
  };
  const authority = new ApprovalReceiptAuthority({
    now: () => now, testOnly: !productionPolicy,
    hostPendingVerifier: binding => {
      const host = hosts.get(binding.hostApprovalRequestId);
      return host === binding.identity && host?.live === true
        && host.targetDigest === binding.targetDigest && host.operation === binding.operation;
    }
  });
  const admission = new HumanClientAdmission({
    authority, store, now: () => now, trustedHostOrigin: 'https://host.example.test',
    humanIntentVerifier: ({ context }) => context === 'explicit-test-human'
  });
  // Exercise the non-test authority's fresh admission predicate without enabling C2.
  if (productionPolicy) admission.productionHuman = lease => admitted && admission.validLease(lease);
  const begin = (k, decision = 'approve') => {
    const e = admission.begin({ protocolVersion: 1, publicKeySpki: k.publicKeySpki });
    admission.recordEnrollmentDecision(e.enrollmentId, decision, 'explicit-test-human');
    return e;
  };
  const k = key();
  const enrollment = begin(k);
  const session = admission.claim(enrollment.enrollmentId, sign(k, enrollment.proof));
  const channel = admission.mint(session.sessionId, sign(k, admission.nonce(session.sessionId, 'capability-mint')));
  const claim = authority.claimClientChannel(channel.capability);
  const ws = new EventEmitter();
  ws.close = () => ws.emit('close');
  admission.completeChannel(ws, sign(k, admission.beginChannel(ws, claim)));
  t.after(() => ws.close());
  let serial = 0;
  const issue = (operation = 'authorize', kind = 'decision') => {
    const payload = { command: 'decision', requestId: 'target-1', projectId: 'synthetic', revision: 1 };
    const id = 'host-' + ++serial;
    const identity = { live: true, targetDigest: digest(payload), operation };
    hosts.set(id, identity);
    const config = { enabled: true, operation, hostPending: {
      identity, hostApprovalRequestId: id, expiresAt: now + 60000
    } };
    const record = authority.snapshot('BoundedTool', payload,
      { requiresApproval: true, matchedRule: 'BoundedTool:decision', matchedCommand: 'decision' }, config);
    const intent = authority.attestIntent(record, {
      decision: operation === 'authorize' ? 'approve' : 'deny',
      hostApprovalRequestId: id, targetDigest: record.argsDigest
    }, ws);
    const handle = kind === 'execution' ? authority.approve(record, intent) : authority.issueDecisionReceipt(record, intent);
    const context = {};
    return { payload, identity, handle, context, record, intent, config,
      bind: () => authority.bindInvocation(handle, context, payload),
      expected: { toolName: 'BoundedTool', command: 'decision', requestId: payload.requestId,
        operation, hostPendingIdentity: identity, hostApprovalRequestId: id,
        targetDigest: digest(payload), payload }
    };
  };
  return { authority, admission, clients, hosts, store, k, session, begin, issue, ws,
    advance: ms => { now += ms; }, writes: () => writes,
    unadmit: () => { admitted = false; } };
}

for (const scenario of ['wrong-id', 'same-key-other-enrollment', 'different-key', 'bad-signature', 'replay', 'expired', 'denied', 'wrong-purpose']) {
  test('enrollment fail closed: ' + scenario, t => {
    const f = fixture(t), k = key();
    const e = f.begin(k, scenario === 'denied' ? 'deny' : 'approve');
    let target = e.enrollmentId, proof = sign(k, e.proof);
    if (scenario === 'wrong-id') target = 'nonexistent';
    if (scenario === 'same-key-other-enrollment') target = f.begin(k).enrollmentId;
    if (scenario === 'different-key') target = f.begin(key()).enrollmentId;
    if (scenario === 'bad-signature') proof = sign(key(), e.proof);
    if (scenario === 'replay') f.admission.claim(target, proof);
    if (scenario === 'expired') f.advance(300001);
    if (scenario === 'wrong-purpose') proof = sign(f.k, f.admission.sessionChallenge(f.session.clientEnrollmentId));
    const before = f.writes(), sessions = f.admission.counts().sessions;
    assert.throws(() => f.admission.claim(target, proof));
    assert.equal(f.writes(), before);
    assert.equal(f.admission.counts().sessions, sessions);
    if (scenario === 'same-key-other-enrollment' || scenario === 'different-key') {
      assert.equal(f.admission.enrollment(target).state, 'APPROVED_WAITING_PROOF');
      assert.equal(f.clients.has(target), false);
      assert.equal(f.admission.claim(e.enrollmentId, proof).clientEnrollmentId, e.enrollmentId);
    }
  });
}
test('one exact proof permits one concurrent claim only', async t => {
  const f = fixture(t), k = key(), e = f.begin(k), proof = sign(k, e.proof), before = f.writes();
  const result = await Promise.allSettled([0, 1].map(() => Promise.resolve().then(() => f.admission.claim(e.enrollmentId, proof))));
  assert.equal(result.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(f.writes(), before + 1);
  assert.equal(f.clients.get(e.enrollmentId).publicKeyFingerprint, e.publicKeyFingerprint);
});

for (const stage of ['ISSUED', 'BOUND_BUT_NOT_CONSUMED', 'WAITING_FOR_DISPATCH']) {
  for (const lifecycle of ['client-revoke', 'session-revoke', 'session-expiry', 'profile-invalid', 'profile-identity-changed', 'host-terminal']) {
    test(stage + ' cannot consume after ' + lifecycle, async t => {
      const f = fixture(t, lifecycle === 'profile-invalid'), r = f.issue();
      if (stage !== 'ISSUED') r.bind();
      if (stage === 'WAITING_FOR_DISPATCH') await Promise.resolve();
      if (lifecycle === 'client-revoke') f.admission.revoke(f.session.clientEnrollmentId);
      if (lifecycle === 'session-revoke') f.admission.revokeSession(f.session.sessionId);
      if (lifecycle === 'session-expiry') f.advance(15 * 60000);
      if (lifecycle === 'profile-invalid') f.unadmit();
      if (lifecycle === 'profile-identity-changed') f.clients.get(f.session.clientEnrollmentId).implementationProfileId = 'unadmitted';
      if (lifecycle === 'host-terminal') r.identity.live = false;
      if (stage === 'ISSUED') assert.throws(r.bind, invalid);
      else {
        if (lifecycle === 'client-revoke' || lifecycle === 'session-revoke') {
          assert.equal(f.authority.invocationAudit(r.context).state, 'INVALIDATED'); // active invalidation before consumption
        }
        let dispatched = 0;
        assert.throws(() => f.authority.dispatchDecision(r.expected, r.context, () => dispatched++), invalid);
        assert.equal(dispatched, 0);
      }
    });
  }
}
for (const operation of ['authorize', 'reject', 'revoke']) {
  test(operation + ' decision consumes once and never grants execution', t => {
    const f = fixture(t), r = f.issue(operation); r.bind();
    let calls = 0;
    const result = f.authority.dispatchDecision(r.expected, r.context, proof => {
      calls++;
      assert.equal(f.authority.invocationAudit(r.context).state, 'CONSUMED');
      assert.equal(proof.operation, operation);
      assert.equal(proof.humanDecision, operation === 'authorize' ? 'approve' : 'deny');
      assert.equal(proof.permitsAgentExecution, false);
      return 'bounded-dispatch';
    });
    assert.equal(result, 'bounded-dispatch');
    assert.throws(() => f.authority.dispatchDecision(r.expected, r.context, () => calls++), invalid);
    f.authority.finishInvocation(r.context);
    assert.equal(calls, 1);
    const other = f.issue(operation); other.bind();
    assert.throws(() => f.authority.verifyAuthorization(other.expected, other.context), invalid);
  });
}
for (const operation of ['reject', 'revoke']) {
  test(operation + ' intent cannot mint legacy approved execution receipt', t => {
    const f = fixture(t), r = f.issue(operation);
    assert.throws(() => f.authority.approve(r.record, r.intent), invalid);
  });
}
for (const change of ['target', 'args', 'operation', 'host-id', 'host-identity', 'invocation']) {
  test('decision rejects changed ' + change, t => {
    const f = fixture(t), r = f.issue(); r.bind();
    const expected = { ...r.expected };
    if (change === 'target') expected.targetDigest = '0'.repeat(64);
    if (change === 'args') expected.payload = { ...r.payload, revision: 2 };
    if (change === 'operation') expected.operation = 'revoke';
    if (change === 'host-id') expected.hostApprovalRequestId = 'other';
    if (change === 'host-identity') expected.hostPendingIdentity = { ...r.identity };
    let calls = 0;
    assert.throws(() => f.authority.dispatchDecision(expected, change === 'invocation' ? {} : r.context, () => calls++), invalid);
    assert.equal(calls, 0);
  });
}
test('uncertain dispatch outcome cannot restore or retry consumed receipt', async t => {
  const f = fixture(t), r = f.issue(); r.bind();
  let calls = 0;
  await assert.rejects(f.authority.dispatchDecision(r.expected, r.context, async () => { calls++; throw new Error('synthetic uncertain outcome'); }));
  assert.equal(f.authority.invocationAudit(r.context).state, 'CONSUMED');
  assert.throws(() => f.authority.dispatchDecision(r.expected, r.context, () => calls++), invalid);
  assert.equal(calls, 1);
});
test('legacy execution receipt is lease-aware too', t => {
  const f = fixture(t), r = f.issue('authorize', 'execution'); r.bind();
  f.admission.revokeSession(f.session.sessionId);
  assert.throws(() => f.authority.verifyAuthorization(r.expected, r.context), invalid);
});
test('Host binding required; nonempty ID alone is not authority', t => {
  const f = fixture(t), payload = { command: 'decision' };
  assert.throws(() => f.authority.snapshot('BoundedTool', payload,
    { requiresApproval: true, matchedRule: 'BoundedTool:decision', matchedCommand: 'decision' }), invalid);
  const r = f.issue();
  const record = f.authority.snapshot('BoundedTool', r.payload,
    { requiresApproval: true, matchedRule: 'BoundedTool:decision', matchedCommand: 'decision' }, r.config);
  assert.throws(() => f.authority.attestIntent(record, {
    decision: 'approve', hostApprovalRequestId: 'other', targetDigest: record.argsDigest
  }, f.ws), invalid);
});
test('new Host instance cannot bind old receipt or authenticate old session', t => {
  const f = fixture(t), r = f.issue(), restarted = fixture(t);
  assert.throws(() => restarted.authority.bindInvocation(r.handle, {}, r.payload), invalid);
  assert.throws(() => restarted.admission.nonce(f.session.sessionId, 'capability-mint'));
});


for (const field of ['clientEnrollmentId', 'publicKeyFingerprint', 'method', 'path', 'bodyDigest', 'trustedHostOrigin', 'hostBootId', 'purpose']) {
  test('enrollment rejects signature over changed bound field: ' + field, t => {
    const f = fixture(t), k = key(), e = f.begin(k);
    const fields = { ...e.proof.boundFields, [field]: field === 'purpose' ? 'session-authenticate' : 'changed' };
    const proof = sign(k, { nonceId: e.proof.nonceId, boundFields: fields });
    const before = f.writes(), sessions = f.admission.counts().sessions;
    assert.throws(() => f.admission.claim(e.enrollmentId, proof));
    assert.equal(f.writes(), before);
    assert.equal(f.admission.counts().sessions, sessions);
  });
}
test('admission lifecycle sweep actively invalidates profile-withdrawn receipts', t => {
  const f = fixture(t, true), r = f.issue(); r.bind();
  f.unadmit();
  f.admission.sweep();
  assert.equal(f.authority.invocationAudit(r.context).state, 'INVALIDATED');
  f.authority.finishInvocation(r.context);
});
test('session expiry sweep invalidates an already bound receipt', t => {
  const f = fixture(t), r = f.issue(); r.bind();
  f.advance(15 * 60000);
  f.admission.sweep();
  assert.equal(f.authority.invocationAudit(r.context).state, 'INVALIDATED');
});
test('binding changed args invalidates receipt permanently', t => {
  const f = fixture(t), r = f.issue();
  assert.throws(() => f.authority.bindInvocation(r.handle, {}, { ...r.payload, revision: 2 }), invalid);
  assert.throws(r.bind, invalid);
});
test('same receipt cannot bind multiple invocations', t => {
  const f = fixture(t), r = f.issue(); r.bind();
  assert.throws(() => f.authority.bindInvocation(r.handle, {}, r.payload), invalid);
  assert.throws(() => f.authority.dispatchDecision(r.expected, r.context, () => assert.fail()), invalid);
});
test('synchronous dispatch throw stays consumed', t => {
  const f = fixture(t), r = f.issue(); r.bind();
  assert.throws(() => f.authority.dispatchDecision(r.expected, r.context, () => { throw new Error('uncertain'); }), /uncertain/);
  assert.equal(f.authority.invocationAudit(r.context).state, 'CONSUMED');
  assert.throws(() => f.authority.dispatchDecision(r.expected, r.context, () => assert.fail()), invalid);
});
test('Host closure after attestation prevents receipt issuance', t => {
  const f = fixture(t), r = f.issue();
  const record = f.authority.snapshot('BoundedTool', r.payload,
    { requiresApproval: true, matchedRule: 'BoundedTool:decision', matchedCommand: 'decision' }, r.config);
  const intent = f.authority.attestIntent(record, { decision: 'approve',
    hostApprovalRequestId: r.expected.hostApprovalRequestId, targetDigest: record.argsDigest }, f.ws);
  r.identity.live = false;
  assert.throws(() => f.authority.issueDecisionReceipt(record, intent), invalid);
});
test('async Host verifier is rejected, not treated as truthy admission', t => {
  const f = fixture(t), r = f.issue();
  const authority = new ApprovalReceiptAuthority({ hostPendingVerifier: async () => true });
  assert.throws(() => authority.snapshot('BoundedTool', r.payload,
    { requiresApproval: true, matchedRule: 'BoundedTool:decision', matchedCommand: 'decision' }, r.config), invalid);
});

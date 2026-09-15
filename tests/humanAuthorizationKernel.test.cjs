'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  ApprovalReceiptAuthority,
  digest
} = require('../modules/approvalReceiptAuthority.js');
const C = require('../modules/humanClientAdmissionCrypto.js');
const {
  HumanClientAdmission,
  ROOT,
  WS_PATH
} = require('../modules/humanClientAdmission.js');
const {
  PROFILES,
  productionAdmitted
} = require('../modules/trustedClientImplementationProfile.js');
const {
  TrustedClientAuthorityStore,
  LOCKDOWN
} = require('../modules/trustedClientAuthorityStore.js');

function keyMaterial() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const der = publicKey.export({ format: 'der', type: 'spki' });
  return {
    privateKey,
    publicKeySpki: der.toString('base64url'),
    fingerprint: crypto.createHash('sha256').update(der).digest('hex')
  };
}

function signedProof(privateKey, proof) {
  const transcript = C.transcript(proof.boundFields);
  return {
    nonceId: proof.nonceId,
    signature: crypto.sign(null, transcript.bytes, privateKey).toString('base64url')
  };
}

function memoryStore(testOnly = true) {
  const clients = new Map();
  return {
    testOnly,
    add(record) {
      assert.equal(clients.has(record.clientEnrollmentId), false);
      clients.set(record.clientEnrollmentId, { ...record });
      return { ...record };
    },
    get(id) {
      const record = clients.get(id);
      return record ? { ...record } : null;
    },
    update(id, fields) {
      const record = clients.get(id);
      if (!record) throw new Error('SESSION_UNKNOWN');
      Object.assign(record, fields);
      return { ...record };
    }
  };
}

class FakeSocket extends EventEmitter {
  close(code, reason) {
    this.closed = { code, reason };
    this.emit('close');
  }
}

test('P5 production implementation profile remains explicitly disabled', () => {
  assert.equal(PROFILES['vcp_chat.c2'].activation, 'PRODUCTION_DISABLED');
  assert.equal(productionAdmitted({ implementationProfileId: 'vcp_chat.c2' }), false);
  assert.equal(ROOT, '/v1/human-client');
  assert.equal(WS_PATH, '/v1/human-client/ws');
});

test('P5 trusted client + explicit intent + exact target binds one execution only', () => {
  let now = 1_800_000_000_000;
  const authority = new ApprovalReceiptAuthority({ now: () => now, testOnly: true });
  const store = memoryStore(true);
  const admission = new HumanClientAdmission({
    authority,
    store,
    now: () => now,
    trustedHostOrigin: 'https://vcp.example.test',
    humanIntentVerifier: ({ kind, exactTarget, decision }) => (
      kind === 'TRUSTED_CLIENT_ENROLLMENT_DECISION'
      && typeof exactTarget === 'string'
      && decision === 'approve'
    )
  });
  const key = keyMaterial();

  const enrollment = admission.begin({
    protocolVersion: 1,
    publicKeySpki: key.publicKeySpki
  }, 'test-source');
  admission.recordEnrollmentDecision(enrollment.enrollmentId, 'approve', Object.freeze({ source: 'test' }));
  const session = admission.claim(
    enrollment.enrollmentId,
    signedProof(key.privateKey, enrollment.proof)
  );

  assert.equal(admission.productionHuman({
    sessionId: session.sessionId,
    clientEnrollmentId: session.clientEnrollmentId,
    sessionState: 'AUTHENTICATED',
    expiresAt: session.expiresAt
  }), false);

  const bodyDigest = digest({ command: 'write', requestId: 'req-1', value: 7 });
  const request = { method: 'POST', url: '/v1/tools/execute' };
  const httpProof = admission.httpChallenge(session.sessionId, {
    method: 'POST',
    path: '/v1/tools/execute',
    bodyDigest
  });
  const humanContext = admission.completeHttpRequest(
    request,
    session.sessionId,
    { method: 'POST', path: '/v1/tools/execute', bodyDigest },
    signedProof(key.privateKey, httpProof)
  );
  assert.equal(humanContext.sourceClass, 'authenticated_human_client_session');
  assert.equal(authority.isHuman(request), true);

  const payload = Object.freeze({ command: 'write', requestId: 'req-1', value: 7 });
  const pending = authority.snapshot(
    'SafeTool',
    payload,
    { requiresApproval: true, matchedRule: 'SafeTool:write', matchedCommand: 'write' },
    { enabled: true, approveAll: false }
  );
  assert.equal(pending.argsDigest, digest(payload));
  assert.throws(
    () => authority.attestIntent(pending, {
      decision: 'approve',
      hostApprovalRequestId: 'host-1',
      targetDigest: '0'.repeat(64)
    }, request),
    error => error?.code === 'WRITE_AUTHORITY_RECEIPT_INVALID'
  );

  const intent = authority.attestIntent(pending, {
    decision: 'approve',
    hostApprovalRequestId: 'host-1',
    targetDigest: pending.argsDigest
  }, request);
  const receipt = authority.approve(pending, intent);
  const executionContext = {};
  authority.bindInvocation(receipt, executionContext, payload);
  const verified = authority.verifyAuthorization({
    toolName: 'SafeTool',
    command: 'write',
    requestId: 'req-1',
    payload
  }, executionContext);
  assert.equal(verified.authorityGateVerified, true);
  assert.equal(verified.humanApproved, true);
  assert.equal(verified.authorityGate, 'SafeTool:write');
  assert.throws(
    () => authority.verifyAuthorization({
      toolName: 'SafeTool', command: 'write', requestId: 'req-1', payload
    }, executionContext),
    error => error?.code === 'WRITE_AUTHORITY_RECEIPT_INVALID'
  );

  const second = authority.snapshot(
    'SafeTool',
    payload,
    { requiresApproval: true, matchedRule: 'SafeTool:write', matchedCommand: 'write' },
    { enabled: true, approveAll: false }
  );
  const secondIntent = authority.attestIntent(second, {
    decision: 'approve',
    hostApprovalRequestId: 'host-2',
    targetDigest: second.argsDigest
  }, request);
  const secondReceipt = authority.approve(second, secondIntent);
  assert.throws(
    () => authority.bindInvocation(secondReceipt, {}, { ...payload, value: 8 }),
    error => error?.code === 'WRITE_AUTHORITY_RECEIPT_INVALID'
  );

  now += 1;
});

test('P5 WebSocket capability is proof-bound and revocation invalidates the trusted channel', () => {
  let now = 1_800_000_100_000;
  const authority = new ApprovalReceiptAuthority({ now: () => now, testOnly: true });
  const store = memoryStore(true);
  const admission = new HumanClientAdmission({
    authority,
    store,
    now: () => now,
    trustedHostOrigin: 'https://vcp.example.test',
    humanIntentVerifier: () => true
  });
  const key = keyMaterial();
  const enrollment = admission.begin({ protocolVersion: 1, publicKeySpki: key.publicKeySpki });
  admission.recordEnrollmentDecision(enrollment.enrollmentId, 'approve', {});
  const session = admission.claim(enrollment.enrollmentId, signedProof(key.privateKey, enrollment.proof));

  const capabilityProof = admission.nonce(session.sessionId, 'capability-mint');
  const capability = admission.mint(
    session.sessionId,
    signedProof(key.privateKey, capabilityProof)
  );
  assert.equal(capability.websocketUrl, 'wss://vcp.example.test/v1/human-client/ws');

  const claim = authority.claimClientChannel(capability.capability);
  const ws = new FakeSocket();
  const upgrade = admission.beginChannel(ws, claim);
  admission.completeChannel(ws, signedProof(key.privateKey, upgrade));
  assert.equal(authority.isHuman(ws), true);

  admission.revoke(session.sessionId);
  assert.equal(authority.isHuman(ws), false);
  assert.equal(ws.closed.code, 1008);
});

test('P5 durable trusted-client store anchors epochs and fails closed on attempted re-enrollment', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p5-authority-'));
  const registryRoot = path.join(tempRoot, 'registry');
  const anchorRoot = path.join(tempRoot, 'anchor');
  fs.mkdirSync(registryRoot);
  fs.mkdirSync(anchorRoot);

  try {
    const hostAuthorityId = 'A'.repeat(43);
    const registry = { version: 1, hostAuthorityId, epoch: 0, clients: [] };
    const anchor = {
      version: 1,
      hostAuthorityId,
      highestCommittedAuthorityEpoch: 0,
      authorityHeadCommitment: digest({ hostAuthorityId, epoch: 0, clients: [], version: 1 })
    };
    fs.writeFileSync(path.join(registryRoot, 'authority.json'), JSON.stringify(registry));
    fs.writeFileSync(path.join(anchorRoot, 'anchor.json'), JSON.stringify(anchor));

    const store = new TrustedClientAuthorityStore({ registryRoot, anchorRoot, testOnly: true });
    const key = keyMaterial();
    store.add({
      clientEnrollmentId: 'client-1',
      surface: 'vcp_chat',
      publicKeySpki: key.publicKeySpki,
      publicKeyAlgorithm: 'ED25519',
      publicKeyFingerprint: key.fingerprint,
      keyVersion: 1,
      enrollmentState: 'ENROLLED',
      admissionState: 'DENIED',
      createdAt: 1,
      implementationProfileId: 'vcp_chat.c1.fixture'
    });
    store.update('client-1', {
      enrollmentState: 'REVOKED',
      revokedAt: 2,
      revocationReason: 'TEST_REVOKE'
    });
    const current = store.get('client-1');
    assert.equal(current.enrollmentState, 'REVOKED');
    const persistedRegistry = JSON.parse(fs.readFileSync(path.join(registryRoot, 'authority.json'), 'utf8'));
    const persistedAnchor = JSON.parse(fs.readFileSync(path.join(anchorRoot, 'anchor.json'), 'utf8'));
    assert.equal(persistedRegistry.epoch, 2);
    assert.equal(persistedAnchor.highestCommittedAuthorityEpoch, 2);
    assert.equal(persistedAnchor.authorityHeadCommitment,
      digest({
        hostAuthorityId,
        epoch: persistedRegistry.epoch,
        clients: persistedRegistry.clients,
        version: 1
      }));
    assert.throws(
      () => store.update('client-1', { enrollmentState: 'ENROLLED' }),
      error => error?.code === LOCKDOWN
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

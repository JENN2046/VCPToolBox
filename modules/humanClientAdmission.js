'use strict';

const crypto = require('node:crypto');
const C = require('./humanClientAdmissionCrypto');
const { digest } = require('./approvalReceiptAuthority');
const { profile, productionAdmitted } = require('./trustedClientImplementationProfile');

const ROOT = '/v1/human-client';
const WS_PATH = '/v1/human-client/ws';
const LIMITS = Object.freeze({
  enrollmentMs: 5 * 60 * 1000,
  sessionMs: 15 * 60 * 1000,
  nonceMs: 60 * 1000,
  upgradeMs: 30 * 1000,
  enrollments: 256,
  sessions: 256,
  nonces: 4096,
  perSessionNonces: 32,
  sockets: 32,
  startsPerMinute: 32,
  terminal: 256
});

const id = () => crypto.randomBytes(32).toString('base64url');
const exactKeys = (value, expected) => {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
};

class HumanClientAdmission {
  #enrollments = new Map();
  #sessions = new Map();
  #nonces = new Map();
  #sockets = new Map();
  #starts = new Map();
  #terminal = [];

  constructor({ authority, store, now = Date.now, trustedHostOrigin, humanIntentVerifier }) {
    if (!authority || !store || typeof humanIntentVerifier !== 'function') C.fail('ADMISSION_DISABLED');
    this.authority = authority;
    this.store = store;
    this.now = now;
    this.hostOrigin = C.origin(trustedHostOrigin);
    this.humanIntentVerifier = humanIntentVerifier;
    this.implementationProfile = profile(store);
    authority.setHumanClientAdmission(this);
  }

  #safe(value) {
    return Object.freeze(JSON.parse(JSON.stringify(value, (key, item) => {
      if (['key', 'signingInput', 'signature'].includes(key)) return undefined;
      return item;
    })));
  }

  #rate(source) {
    const now = this.now();
    const current = (this.#starts.get(source) || []).filter(timestamp => timestamp > now - 60000);
    if (current.length >= LIMITS.startsPerMinute) C.fail('CAPACITY_REACHED');
    current.push(now);
    this.#starts.set(source, current);
  }

  #proof(purpose, fields, keyRecord, ttl = LIMITS.nonceMs) {
    this.sweep();
    const sessionId = fields.sessionId;
    if (this.#nonces.size >= LIMITS.nonces) C.fail('CAPACITY_REACHED');
    if (sessionId && [...this.#nonces.values()].filter(item => item.fields.sessionId === sessionId).length >= LIMITS.perSessionNonces) {
      C.fail('CAPACITY_REACHED');
    }
    const nonceId = id();
    const expiresAt = this.now() + Math.max(1, ttl);
    const boundFields = Object.freeze({
      protocolVersion: 1,
      purpose,
      hostBootId: this.hostOrigin,
      trustedHostOrigin: this.hostOrigin,
      nonceId,
      ...fields
    });
    const transcript = C.transcript(boundFields);
    const proof = Object.freeze({
      nonceId,
      purpose,
      expiresAt,
      publicKeyFingerprint: keyRecord.fingerprint,
      boundFields,
      boundFieldDigest: transcript.boundFieldDigest,
      signingInput: transcript.signingInput
    });
    this.#nonces.set(nonceId, { proof, fields: boundFields, key: keyRecord.key, algorithm: keyRecord.algorithm, used: false });
    return proof;
  }

  #consume(purpose, sessionId, proof, leaseCheck) {
    this.sweep();
    if (!exactKeys(proof, ['nonceId', 'signature'])) C.fail('PROOF_INVALID');
    const record = this.#nonces.get(proof.nonceId);
    if (!record || record.used) C.fail('PROOF_REPLAYED');
    if (record.proof.expiresAt <= this.now()) C.fail('PROOF_EXPIRED');
    if (record.fields.purpose !== purpose || (sessionId && record.fields.sessionId !== sessionId)) C.fail('PROOF_INVALID');
    leaseCheck?.();
    const transcript = C.transcript(record.fields);
    if (transcript.boundFieldDigest !== record.proof.boundFieldDigest) C.fail('PROOF_INVALID');
    if (!C.verifyHumanClientProof({
      publicKeyAlgorithm: record.algorithm,
      canonicalPublicKey: record.key,
      signingInput: transcript.bytes,
      signature: proof.signature
    })) C.fail('PROOF_INVALID');
    record.used = true;
    this.#nonces.delete(proof.nonceId);
    return record;
  }

  #session(sessionId) {
    const session = this.#sessions.get(sessionId);
    if (!session) C.fail('SESSION_UNKNOWN');
    if (session.sessionState !== 'AUTHENTICATED') C.fail('SESSION_REVOKED');
    if (session.expiresAt <= this.now()) {
      this.#retire(session, 'EXPIRED');
      C.fail('SESSION_REVOKED');
    }
    const client = this.store.get(session.clientEnrollmentId);
    if (!client || client.enrollmentState !== 'ENROLLED') {
      this.#retire(session, 'DISCONNECTED');
      C.fail('SESSION_REVOKED');
    }
    return session;
  }

  begin(body, source = 'unknown') {
    this.sweep();
    this.#rate(String(source));
    if (!exactKeys(body, ['protocolVersion', 'publicKeySpki']) || body.protocolVersion !== 1) C.fail('INVALID_ENROLLMENT');
    if (this.#enrollments.size >= LIMITS.enrollments) C.fail('CAPACITY_REACHED');
    const imported = C.importPublicKey(body.publicKeySpki);
    const enrollmentId = id();
    const record = {
      enrollmentId,
      state: 'PENDING_HUMAN',
      createdAt: this.now(),
      expiresAt: this.now() + LIMITS.enrollmentMs,
      key: imported.key,
      publicKeySpki: imported.spki,
      publicKeyFingerprint: imported.fingerprint,
      publicKeyAlgorithm: imported.publicKeyAlgorithm
    };
    this.#enrollments.set(enrollmentId, record);
    record.proof = this.#proof('enrollment-claim', {
      clientEnrollmentId: enrollmentId,
      publicKeyFingerprint: imported.fingerprint,
      method: 'POST',
      path: `${ROOT}/enrollments/${enrollmentId}/claim`,
      bodyDigest: digest({ clientEnrollmentId: enrollmentId })
    }, { key: imported.key, fingerprint: imported.fingerprint, algorithm: imported.publicKeyAlgorithm }, LIMITS.enrollmentMs);
    return this.#safe(record);
  }

  recordEnrollmentDecision(enrollmentId, decision, humanIntentContext) {
    this.sweep();
    const record = this.#enrollments.get(enrollmentId);
    if (!record || record.state !== 'PENDING_HUMAN' || !['approve', 'deny'].includes(decision)) C.fail('CLIENT_NOT_AUTHORIZED');
    const accepted = this.humanIntentVerifier(Object.freeze({
      kind: 'TRUSTED_CLIENT_ENROLLMENT_DECISION',
      exactTarget: enrollmentId,
      decision,
      context: humanIntentContext
    })) === true;
    if (!accepted) C.fail('CLIENT_NOT_AUTHORIZED');
    if (decision === 'deny') {
      record.state = 'DENIED';
      this.#rememberTerminal(record);
      this.#enrollments.delete(enrollmentId);
      return Object.freeze({ enrollmentId, state: 'DENIED' });
    }
    record.state = 'APPROVED_WAITING_PROOF';
    return Object.freeze({ enrollmentId, state: record.state });
  }

  claim(enrollmentId, proof) {
    this.sweep();
    const record = this.#enrollments.get(enrollmentId);
    if (!record || record.state !== 'APPROVED_WAITING_PROOF' || record.expiresAt <= this.now()) C.fail('PROOF_INVALID');
    if (this.#sessions.size >= LIMITS.sessions) C.fail('CAPACITY_REACHED');
    this.#consume('enrollment-claim', null, proof);
    const clientEnrollmentId = enrollmentId;
    const implementationProfileId = this.implementationProfile.id;
    this.store.add({
      clientEnrollmentId,
      surface: 'vcp_chat',
      publicKeySpki: record.publicKeySpki,
      publicKeyAlgorithm: record.publicKeyAlgorithm,
      publicKeyFingerprint: record.publicKeyFingerprint,
      keyVersion: 1,
      enrollmentState: 'ENROLLED',
      admissionState: productionAdmitted({ implementationProfileId }) ? 'ADMITTED' : 'DENIED',
      createdAt: this.now(),
      implementationProfileId
    });
    this.#enrollments.delete(enrollmentId);
    const session = this.#createSession(clientEnrollmentId, record);
    return this.#safe(session);
  }

  #createSession(clientEnrollmentId, keyRecord) {
    if (this.#sessions.size >= LIMITS.sessions) C.fail('CAPACITY_REACHED');
    const session = {
      sessionId: id(),
      clientEnrollmentId,
      fingerprint: keyRecord.publicKeyFingerprint || keyRecord.fingerprint,
      key: keyRecord.key,
      algorithm: keyRecord.publicKeyAlgorithm || keyRecord.algorithm,
      sessionState: 'AUTHENTICATED',
      createdAt: this.now(),
      expiresAt: this.now() + LIMITS.sessionMs
    };
    this.#sessions.set(session.sessionId, session);
    return session;
  }

  enrollment(enrollmentId) {
    const record = this.#enrollments.get(enrollmentId) || this.#terminal.find(entry => entry.enrollmentId === enrollmentId);
    return record ? this.#safe(record) : null;
  }

  client(clientEnrollmentId) {
    const client = this.store.get(clientEnrollmentId);
    return client ? Object.freeze({ ...client, productionAdmission: productionAdmitted(client) ? 'ADMITTED' : 'DENIED' }) : null;
  }

  sessionChallenge(clientEnrollmentId) {
    this.sweep();
    const client = this.store.get(clientEnrollmentId);
    if (!client || client.enrollmentState !== 'ENROLLED') C.fail('SESSION_UNKNOWN');
    const imported = C.importPublicKey(client.publicKeySpki);
    return this.#proof('session-authenticate', {
      clientEnrollmentId,
      publicKeyFingerprint: client.publicKeyFingerprint,
      method: 'POST',
      path: `${ROOT}/sessions/authenticate`,
      bodyDigest: digest({ clientEnrollmentId })
    }, { key: imported.key, fingerprint: imported.fingerprint, algorithm: imported.publicKeyAlgorithm });
  }

  authenticate(clientEnrollmentId, proof) {
    const client = this.store.get(clientEnrollmentId);
    if (!client || client.enrollmentState !== 'ENROLLED') C.fail('SESSION_UNKNOWN');
    const record = this.#consume('session-authenticate', null, proof);
    if (record.fields.clientEnrollmentId !== clientEnrollmentId || record.fields.publicKeyFingerprint !== client.publicKeyFingerprint) C.fail('PROOF_INVALID');
    const imported = C.importPublicKey(client.publicKeySpki);
    return this.#safe(this.#createSession(clientEnrollmentId, {
      key: imported.key,
      fingerprint: imported.fingerprint,
      algorithm: imported.publicKeyAlgorithm
    }));
  }

  nonce(sessionId, purpose) {
    if (!['capability-mint', 'self-revoke'].includes(purpose)) C.fail('SURFACE_NOT_ADMITTED');
    const session = this.#session(sessionId);
    return this.#proof(purpose, {
      sessionId,
      publicKeyFingerprint: session.fingerprint,
      method: 'POST',
      path: `${ROOT}/sessions/${sessionId}/${purpose === 'capability-mint' ? 'capability' : 'revoke'}`,
      bodyDigest: digest({ sessionId })
    }, session, Math.min(LIMITS.nonceMs, session.expiresAt - this.now()));
  }

  mint(sessionId, proof) {
    const session = this.#session(sessionId);
    this.authority.assertClientCapacity();
    this.#consume('capability-mint', sessionId, proof, () => this.#session(sessionId));
    return Object.freeze({
      capability: this.authority.issueClientChannel(session),
      expiresInMs: this.authority.channelTtl,
      websocketUrl: this.hostOrigin.replace(/^https:/u, 'wss:') + WS_PATH
    });
  }

  httpChallenge(sessionId, request) {
    const session = this.#session(sessionId);
    if (!request || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) || typeof request.path !== 'string' || !request.path.startsWith('/')) C.fail('PROOF_INVALID');
    if (!/^[0-9a-f]{64}$/u.test(request.bodyDigest)) C.fail('PROOF_INVALID');
    return this.#proof('http-request', {
      sessionId,
      publicKeyFingerprint: session.fingerprint,
      method: request.method,
      path: request.path,
      bodyDigest: request.bodyDigest
    }, session, Math.min(LIMITS.nonceMs, session.expiresAt - this.now()));
  }

  completeHttpRequest(requestObject, sessionId, expectedRequest, proof) {
    const session = this.#session(sessionId);
    const record = this.#consume('http-request', sessionId, proof, () => this.#session(sessionId));
    if (!expectedRequest || record.fields.method !== expectedRequest.method || record.fields.path !== expectedRequest.path || record.fields.bodyDigest !== expectedRequest.bodyDigest) C.fail('PROOF_INVALID');
    this.authority.bindHttpRequest(requestObject, session, { provenance: record.proof.boundFieldDigest });
    return this.authority.humanContext(requestObject);
  }

  beginChannel(ws, claim) {
    const session = this.authority.clientClaimLease(claim);
    if (!this.validLease(session)) C.fail('SESSION_REVOKED');
    if ([...this.#sockets.values()].filter(item => item.lease === session).length >= LIMITS.sockets) C.fail('CAPACITY_REACHED');
    const proof = this.#proof('channel-upgrade', {
      sessionId: session.sessionId,
      publicKeyFingerprint: session.fingerprint,
      capabilityDigest: claim.provenance,
      method: 'GET',
      path: WS_PATH,
      bodyDigest: digest({})
    }, session, Math.min(LIMITS.upgradeMs, session.expiresAt - this.now()));
    const connection = { lease: session, claim, proof, verified: false, timer: null };
    this.#sockets.set(ws, connection);
    const release = () => {
      clearTimeout(connection.timer);
      this.#nonces.delete(proof.nonceId);
      this.#sockets.delete(ws);
    };
    connection.timer = setTimeout(() => {
      release();
      try { ws.close(1008, 'Channel proof expired'); } catch (_) {}
    }, LIMITS.upgradeMs);
    connection.timer.unref?.();
    ws.once?.('close', release);
    return proof;
  }

  completeChannel(ws, proof) {
    const connection = this.#sockets.get(ws);
    if (!connection || connection.verified || proof?.nonceId !== connection.proof.nonceId) C.fail('PROOF_INVALID');
    this.#consume('channel-upgrade', connection.lease.sessionId, proof, () => {
      if (!this.validLease(connection.lease)) C.fail('SESSION_REVOKED');
    });
    connection.verified = true;
    clearTimeout(connection.timer);
    this.authority.bindClientChannel(ws, connection.claim);
  }

  channelVerified(ws, claim) {
    const connection = this.#sockets.get(ws);
    return !!connection && connection.claim === claim && connection.verified && this.validLease(connection.lease);
  }

  validLease(lease) {
    if (!lease || lease.sessionState !== 'AUTHENTICATED' || lease.expiresAt <= this.now()) return false;
    const current = this.#sessions.get(lease.sessionId);
    if (current !== lease) return false;
    const client = this.store.get(lease.clientEnrollmentId);
    return !!client && client.enrollmentState === 'ENROLLED';
  }

  productionHuman(lease) {
    if (!this.validLease(lease)) return false;
    const client = this.store.get(lease.clientEnrollmentId);
    return productionAdmitted(client);
  }

  #retire(session, state) {
    session.sessionState = state;
    this.authority.invalidateHumanLease(session);
    for (const [nonceId, nonce] of this.#nonces) if (nonce.fields.sessionId === session.sessionId) this.#nonces.delete(nonceId);
    for (const [ws, connection] of this.#sockets) {
      if (connection.lease === session) {
        this.#sockets.delete(ws);
        clearTimeout(connection.timer);
        try { ws.close(1008, 'Human session unavailable'); } catch (_) {}
      }
    }
  }

  revoke(identity) {
    const session = this.#sessions.get(identity);
    const clientEnrollmentId = session?.clientEnrollmentId || identity;
    this.store.update(clientEnrollmentId, {
      enrollmentState: 'REVOKED',
      revokedAt: this.now(),
      revocationReason: 'EXPLICIT_REVOKE'
    });
    for (const current of this.#sessions.values()) {
      if (current.clientEnrollmentId === clientEnrollmentId) this.#retire(current, 'DISCONNECTED');
    }
    return session ? this.#safe(session) : this.client(clientEnrollmentId);
  }

  selfRevoke(sessionId, proof) {
    this.#session(sessionId);
    this.#consume('self-revoke', sessionId, proof, () => this.#session(sessionId));
    return this.revoke(sessionId);
  }

  #rememberTerminal(record) {
    this.#terminal.push({ enrollmentId: record.enrollmentId, state: record.state, createdAt: record.createdAt, expiresAt: record.expiresAt });
    if (this.#terminal.length > LIMITS.terminal) this.#terminal.splice(0, this.#terminal.length - LIMITS.terminal);
  }

  sweep() {
    const now = this.now();
    for (const [enrollmentId, record] of this.#enrollments) {
      if (record.expiresAt <= now) {
        record.state = 'EXPIRED';
        this.#rememberTerminal(record);
        this.#enrollments.delete(enrollmentId);
      }
    }
    for (const [nonceId, nonce] of this.#nonces) if (nonce.proof.expiresAt <= now) this.#nonces.delete(nonceId);
    for (const [sessionId, session] of this.#sessions) {
      if (session.expiresAt <= now || this.store.get(session.clientEnrollmentId)?.enrollmentState !== 'ENROLLED') {
        this.#retire(session, 'EXPIRED');
        this.#sessions.delete(sessionId);
      }
    }
  }

  counts() {
    this.sweep();
    return Object.freeze({
      enrollments: this.#enrollments.size,
      sessions: this.#sessions.size,
      nonces: this.#nonces.size,
      sockets: this.#sockets.size,
      terminal: this.#terminal.length
    });
  }
}

module.exports = { HumanClientAdmission, LIMITS, ROOT, WS_PATH };

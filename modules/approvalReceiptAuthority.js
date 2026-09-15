'use strict';

const { createHash, randomBytes } = require('node:crypto');

const INVALID_CODE = 'WRITE_AUTHORITY_RECEIPT_INVALID';
const invalid = () => Object.assign(new Error(INVALID_CODE), { code: INVALID_CODE });

function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (Reflect.ownKeys(value).length !== value.length + 1) throw invalid();
    return '[' + Array.from({ length: value.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !('value' in descriptor)) throw invalid();
      return canonical(descriptor.value);
    }).join(',') + ']';
  }
  if (value && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    if (Reflect.ownKeys(value).some(key => typeof key !== 'string')) throw invalid();
    return '{' + Object.keys(value).sort().map(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) throw invalid();
      return JSON.stringify(key) + ':' + canonical(descriptor.value);
    }).join(',') + '}';
  }
  throw invalid();
}

const digest = value => createHash('sha256').update(canonical(value), 'utf8').digest('hex');

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

class ApprovalReceiptAuthority {
  #humanAdmission = null;
  #channels = new Map();
  #claims = new WeakSet();
  #connections = new Map();
  #pending = new WeakSet();
  #intents = new WeakSet();
  #receipts = new Map();
  #contexts = new WeakMap();

  constructor({ now = Date.now, testOnly = false } = {}) {
    this.now = now;
    this.testOnly = testOnly === true;
    this.channelTtl = 60000;
    this.connectionTtl = 15 * 60000;
    this.receiptTtl = 60000;
  }

  setHumanClientAdmission(admission) {
    if (!admission || (this.#humanAdmission && this.#humanAdmission !== admission)) throw invalid();
    this.#humanAdmission = admission;
  }

  #sweep() {
    const now = this.now();
    for (const [token, record] of this.#channels) {
      if (record.expiresAt <= now || !this.#live(record)) this.#channels.delete(token);
    }
    for (const [id, receipt] of this.#receipts) {
      if (receipt.expiresAt <= now) {
        if (receipt.state === 'ISSUED') receipt.state = 'EXPIRED';
        this.#receipts.delete(id);
      }
    }
    for (const [context, record] of this.#connections) {
      if (record.expiresAt <= now || !this.#live(record)) this.#connections.delete(context);
    }
  }

  #live(record) {
    return !!record?.lease && !!this.#humanAdmission?.validLease(record.lease);
  }

  #trusted(record) {
    if (!this.#live(record)) return false;
    if (this.testOnly === true) return true;
    return this.#humanAdmission?.productionHuman(record.lease) === true;
  }

  assertClientCapacity() {
    this.#sweep();
    if (this.#channels.size >= 1024) throw invalid();
  }

  issueClientChannel(lease) {
    if (!this.#humanAdmission?.validLease(lease)) throw invalid();
    this.assertClientCapacity();
    const token = randomBytes(32).toString('base64url');
    this.#channels.set(token, {
      expiresAt: Math.min(this.now() + this.channelTtl, lease.expiresAt),
      clientSurface: 'vcp_chat',
      lease
    });
    return token;
  }

  claimClientChannel(token) {
    this.#sweep();
    const channel = this.#channels.get(token);
    if (!channel || channel.clientSurface !== 'vcp_chat' || !this.#live(channel)) throw invalid();
    this.#channels.delete(token);
    const claim = Object.freeze({
      expiresAt: Math.min(this.now() + this.connectionTtl, channel.lease.expiresAt),
      provenance: createHash('sha256').update(token).digest('hex'),
      clientSurface: 'vcp_chat',
      lease: channel.lease
    });
    this.#claims.add(claim);
    return claim;
  }

  clientClaimLease(claim) {
    if (!this.#claims.has(claim) || claim.clientSurface !== 'vcp_chat' || claim.expiresAt <= this.now() || !this.#live(claim)) {
      throw invalid();
    }
    return claim.lease;
  }

  bindClientChannel(ws, claim) {
    this.clientClaimLease(claim);
    if (!ws || this.#connections.has(ws) || !this.#humanAdmission?.channelVerified(ws, claim)) throw invalid();
    this.#claims.delete(claim);
    this.#connections.set(ws, claim);
    if (typeof ws.close === 'function') {
      const timer = setTimeout(() => {
        this.#connections.delete(ws);
        try { ws.close(1008, 'Human authorization channel expired'); } catch (_) {}
      }, Math.max(1, claim.expiresAt - this.now()));
      timer.unref?.();
      ws.once?.('close', () => {
        clearTimeout(timer);
        this.#connections.delete(ws);
      });
    }
  }

  bindHttpRequest(request, lease, { provenance } = {}) {
    if (!request || this.#connections.has(request) || !this.#humanAdmission?.validLease(lease)) throw invalid();
    this.#connections.set(request, Object.freeze({
      expiresAt: Math.min(this.now() + 30000, lease.expiresAt),
      provenance: provenance || createHash('sha256').update(randomBytes(32)).digest('hex'),
      clientSurface: 'vcp_chat',
      lease
    }));
  }

  invalidateHumanLease(lease) {
    for (const [token, channel] of this.#channels) {
      if (channel.lease === lease) this.#channels.delete(token);
    }
    for (const [context, connection] of this.#connections) {
      if (connection.lease === lease) {
        this.#connections.delete(context);
        if (typeof context?.close === 'function') {
          try { context.close(1008, 'Human session unavailable'); } catch (_) {}
        }
      }
    }
  }

  isHuman(context) {
    this.#sweep();
    const connection = context && this.#connections.get(context);
    return !!connection && connection.clientSurface === 'vcp_chat' && connection.expiresAt > this.now() && this.#trusted(connection);
  }

  humanContext(context) {
    const connection = context && this.#connections.get(context);
    if (!this.isHuman(context)) return null;
    return Object.freeze({
      clientSurface: 'vcp_chat',
      sourceClass: 'authenticated_human_client_session',
      sessionId: connection.lease.sessionId
    });
  }

  snapshot(toolName, args, decision, config = {}) {
    if (decision?.requiresApproval !== true) return null;
    if (config.enabled === false || config.approveAll === true) throw invalid();
    if (typeof toolName !== 'string' || !toolName || !args || typeof args !== 'object') throw invalid();
    const command = args.command;
    if (typeof command !== 'string' || !command) throw invalid();
    const matchedRule = `${toolName}:${command}`;
    if (decision.matchedRule !== matchedRule || decision.matchedCommand !== command) throw invalid();
    const snapshot = freeze(JSON.parse(canonical(args)));
    const record = Object.freeze({
      canonicalToolName: toolName,
      command,
      matchedRule,
      args: snapshot,
      argsDigest: digest(snapshot),
      createdAt: this.now(),
      requiresTrustedHumanReceipt: true
    });
    this.#pending.add(record);
    return record;
  }

  attestIntent(record, intent, context) {
    if (!this.#pending.has(record) || !this.isHuman(context)) throw invalid();
    if (!intent || Object.getPrototypeOf(intent) !== Object.prototype) throw invalid();
    if (!['approve', 'deny'].includes(intent.decision)) throw invalid();
    if (typeof intent.hostApprovalRequestId !== 'string' || !intent.hostApprovalRequestId) throw invalid();
    if (intent.targetDigest !== record.argsDigest) throw invalid();
    const trusted = Object.freeze({
      record,
      decision: intent.decision,
      hostApprovalRequestId: intent.hostApprovalRequestId,
      targetDigest: intent.targetDigest,
      context,
      attestedAt: this.now()
    });
    this.#intents.add(trusted);
    return trusted;
  }

  approve(record, trustedIntent) {
    if (!this.#pending.has(record) || !this.#intents.has(trustedIntent) || trustedIntent.record !== record) throw invalid();
    this.#intents.delete(trustedIntent);
    this.#pending.delete(record);
    if (trustedIntent.decision !== 'approve' || !this.isHuman(trustedIntent.context)) throw invalid();
    this.#sweep();
    if (this.#receipts.size >= 4096) throw invalid();
    const connection = this.#connections.get(trustedIntent.context);
    const receiptId = randomBytes(32).toString('hex');
    const executionId = randomBytes(32).toString('hex');
    this.#receipts.set(receiptId, {
      ...record,
      hostApprovalRequestId: trustedIntent.hostApprovalRequestId,
      receiptId,
      executionId,
      decision: 'approved',
      approvedAt: this.now(),
      expiresAt: this.now() + this.receiptTtl,
      sourceClass: 'authenticated_human_client_session',
      clientSurface: 'vcp_chat',
      provenance: connection.provenance,
      state: 'ISSUED',
      bound: false
    });
    return Object.freeze({ approvalReceiptId: receiptId, approvalExecutionId: executionId });
  }

  bindInvocation(handle, context, args) {
    const receipt = this.#receipts.get(handle?.approvalReceiptId);
    if (!context || !receipt || receipt.state !== 'ISSUED' || receipt.executionId !== handle?.approvalExecutionId || receipt.expiresAt <= this.now() || receipt.argsDigest !== digest(args) || receipt.bound) {
      if (receipt?.state === 'ISSUED') receipt.state = 'INVALIDATED';
      throw invalid();
    }
    receipt.bound = true;
    this.#contexts.set(context, receipt);
    Object.defineProperties(context, {
      approvalReceiptId: { value: receipt.receiptId, enumerable: false },
      approvalExecutionId: { value: receipt.executionId, enumerable: false }
    });
  }

  finishInvocation(context) {
    const receipt = this.#contexts.get(context);
    if (receipt?.state === 'ISSUED') receipt.state = 'INVALIDATED';
    this.#contexts.delete(context);
  }

  invocationAudit(context) {
    const receipt = this.#contexts.get(context);
    return receipt ? Object.freeze({
      state: receipt.state,
      clientSurface: receipt.clientSurface,
      sourceClass: receipt.sourceClass,
      toolName: receipt.canonicalToolName,
      command: receipt.command,
      hostApprovalRequestId: receipt.hostApprovalRequestId
    }) : null;
  }

  verifyAuthorization(expected, context) {
    const receipt = context && this.#contexts.get(context);
    try {
      if (!receipt || receipt.state !== 'ISSUED' || receipt.expiresAt <= this.now()
        || receipt.sourceClass !== 'authenticated_human_client_session'
        || receipt.clientSurface !== 'vcp_chat'
        || receipt.decision !== 'approved'
        || receipt.canonicalToolName !== expected?.toolName
        || receipt.command !== expected?.command
        || receipt.matchedRule !== `${expected?.toolName}:${expected?.command}`
        || receipt.argsDigest !== digest(expected?.payload)
        || expected?.payload?.command !== expected?.command
        || expected?.payload?.requestId !== expected?.requestId
        || context.approvalReceiptId !== receipt.receiptId
        || context.approvalExecutionId !== receipt.executionId
        || !receipt.hostApprovalRequestId) {
        throw invalid();
      }
      receipt.state = 'CONSUMED';
      return Object.freeze({
        authorityGate: receipt.matchedRule,
        authorityGateVerified: true,
        humanApproved: true,
        requestId: expected.requestId,
        payloadDigest: receipt.argsDigest,
        authorizedAt: receipt.approvedAt
      });
    } catch (error) {
      if (receipt?.state === 'ISSUED') receipt.state = 'INVALIDATED';
      throw invalid();
    }
  }
}

module.exports = {
  ApprovalReceiptAuthority,
  canonical,
  digest,
  INVALID_CODE
};

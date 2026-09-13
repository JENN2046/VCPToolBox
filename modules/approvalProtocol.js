'use strict';

const { canonical, digest } = require('./approvalReceiptAuthority');

const LIMITS = Object.freeze({ pending: 256, targetBytes: 16384, terminalCount: 1024, terminalTtlMs: 900000 });
const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
};
const approvalError = (code, message) => Object.assign(new Error(JSON.stringify({ plugin_error: message, error_type: code, ...(code === 'approval_rejected' ? { rejected_by_user: true } : {}) })), { code });

// One instance per PluginManager. Only the host owns create/cancel; no client route exposes them.
class ApprovalProtocol {
    #pending = new Map();
    #terminal = new Map();
    constructor({ authority, now = Date.now, schedule = setTimeout, unschedule = clearTimeout, onTerminal = () => {}, onDeliveryError = () => {} }) {
        this.authority = authority;
        this.now = now;
        this.schedule = schedule;
        this.unschedule = unschedule;
        this.onTerminal = onTerminal;
        this.onDeliveryError = onDeliveryError;
    }
    get pendingCount() { return this.#pending.size; }
    #sweep() {
        for (const [id, t] of this.#terminal) if (this.now() > t.terminalAt + LIMITS.terminalTtlMs) this.#terminal.delete(id);
    }
    #view(p) { return { ...p.metadata, state: 'PENDING' }; }
    inspect(requestId) {
        this.#sweep();
        const p = this.#pending.get(requestId);
        return p ? this.#view(p) : this.#terminal.get(requestId) || null;
    }
    create({ requestId, toolName, args, sensitiveApproval, timeoutMs, notifyAiOnReject = true, signal }) {
        this.#sweep();
        if (typeof requestId !== 'string' || !requestId || requestId.length > 200 || this.#pending.has(requestId) || this.#terminal.has(requestId)) throw approvalError('INVALID_REQUEST', 'Invalid approval identity');
        if (this.#pending.size >= LIMITS.pending) throw approvalError('APPROVAL_CAPACITY', 'Approval capacity reached');
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 86400000) throw approvalError('INVALID_REQUEST', 'Invalid approval lifetime');
        const encoded = canonical(args);
        if (Buffer.byteLength(encoded) > LIMITS.targetBytes) throw approvalError('APPROVAL_CAPACITY', 'Approval target too large');
        const target = sensitiveApproval ? sensitiveApproval.args : freeze(JSON.parse(encoded));
        const createdAt = this.now();
        const metadata = Object.freeze({ requestId, toolName, command: target.command || null, matchedRule: sensitiveApproval?.matchedRule || null, args: target, argsDigest: digest(target), createdAt, expiresAt: createdAt + timeoutMs });
        let resolve, reject;
        const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
        // Creation can synchronously cancel (already-aborted owner). The caller still observes rejection.
        promise.catch(() => {});
        const p = { metadata, sensitiveApproval, notifyAiOnReject, resolve, reject, timer: null, detach: () => {} };
        this.#pending.set(requestId, p);
        const tick = () => {
            if (this.#pending.get(requestId) !== p) return;
            if (this.now() > metadata.expiresAt) this.#finish(p, 'EXPIRED');
            else arm();
        };
        const arm = () => { p.timer = this.schedule(tick, Math.max(1, metadata.expiresAt - this.now() + 1)); p.timer?.unref?.(); };
        arm();
        if (signal) {
            const abort = () => this.cancel(requestId);
            signal.addEventListener('abort', abort, { once: true });
            p.detach = () => signal.removeEventListener('abort', abort);
            if (signal.aborted) abort();
        }
        return Object.freeze({ metadata, promise });
    }
    #finish(p, state, { handle, reason = '', human } = {}) {
        const { requestId } = p.metadata;
        if (this.#pending.get(requestId) !== p) return null;
        this.#pending.delete(requestId);
        this.unschedule(p.timer);
        p.detach();
        const terminal = Object.freeze({ requestId, terminalState: state, terminalAt: this.now(), expiresAt: p.metadata.expiresAt, ...(human ? { clientSurface: human.clientSurface } : {}) });
        this.#terminal.set(requestId, terminal);
        while (this.#terminal.size > LIMITS.terminalCount) this.#terminal.delete(this.#terminal.keys().next().value);
        if (state === 'ALLOWED') p.resolve(handle);
        else if (state === 'DENIED' && !p.notifyAiOnReject) p.resolve({ silentRejected: true });
        else if (state === 'DENIED') p.reject(approvalError('approval_rejected', reason ? `Manual approval was REJECTED by user. User reason: ${reason}` : 'Manual approval was REJECTED by user.'));
        else p.reject(approvalError(state === 'EXPIRED' ? 'approval_expired' : 'approval_cancelled', `Manual approval for "${p.metadata.toolName}" ${state === 'EXPIRED' ? 'timed out' : 'was cancelled'}.`));
        try { this.onTerminal(terminal); } catch { this.onDeliveryError('APPROVAL_TERMINAL_DELIVERY_FAILED'); }
        return terminal;
    }
    cancel(requestId) { const p = this.#pending.get(requestId); return p ? this.#finish(p, 'CANCELLED') : null; }
    cancelAll() { for (const id of [...this.#pending.keys()]) this.cancel(id); }
    respond(data, connection) {
        this.#sweep();
        const id = typeof data?.requestId === 'string' && data.requestId.length <= 200 ? data.requestId : null;
        const ack = (outcome, terminal = null) => Object.freeze({ protocolVersion: 1, requestId: id, outcome, terminalState: terminal?.terminalState || null, ...(terminal ? { terminalAt: terminal.terminalAt } : {}) });
        const p = id && this.#pending.get(id);
        const terminal = id && this.#terminal.get(id);
        const expired = p && this.now() > p.metadata.expiresAt; // Read only until authentication succeeds.
        if (!id || typeof data.approved !== 'boolean' || (data.protocolVersion !== undefined && data.protocolVersion !== 1) || (data.reason !== undefined && (typeof data.reason !== 'string' || data.reason.length > 1000))) return ack('INVALID_RESPONSE');
        const human = this.authority.humanContext(connection);
        // Legacy unrelated tool approvals preserve their original channel semantics.
        if ((!p || p.sensitiveApproval) && !human) return ack('CLIENT_NOT_AUTHORIZED');
        if (!p) return terminal ? ack(terminal.terminalState === 'EXPIRED' ? 'REQUEST_EXPIRED' : 'ALREADY_TERMINAL', terminal) : ack('REQUEST_UNKNOWN');
        if (expired) return ack('REQUEST_EXPIRED', this.#finish(p, 'EXPIRED'));
        const m = p.metadata;
        if (data.argsDigest !== undefined && data.argsDigest !== m.argsDigest) return ack('TARGET_MISMATCH');
        if (p.sensitiveApproval) {
            const s = p.sensitiveApproval;
            if (s.canonicalToolName !== m.toolName || s.command !== m.command || s.argsDigest !== m.argsDigest || digest(m.args) !== m.argsDigest) return ack('TARGET_MISMATCH');
            if (data.approved && !((m.command === 'grant' && typeof m.args.projectRoot === 'string' && m.args.projectRoot.trim() && m.args.purpose === 'propose') || (m.command === 'revoke' && typeof m.args.grantId === 'string' && m.args.grantId.trim()))) return ack('TARGET_MISMATCH');
        }
        let handle;
        if (p.sensitiveApproval && data.approved) {
            try { handle = this.authority.approve(p.sensitiveApproval, id, connection); }
            catch { return ack('INTERNAL_ERROR', this.#finish(p, 'CANCELLED')); }
        }
        // No await between final admission, receipt mint and removal of the one pending entry.
        return ack('ACCEPTED', this.#finish(p, data.approved ? 'ALLOWED' : 'DENIED', { handle, reason: (data.reason || '').trim(), human }));
    }
    sync(connection) {
        if (!this.authority.humanContext(connection)) return { protocolVersion: 1, outcome: 'CLIENT_NOT_AUTHORIZED' };
        this.#sweep();
        for (const p of [...this.#pending.values()]) if (this.now() > p.metadata.expiresAt) this.#finish(p, 'EXPIRED');
        return { protocolVersion: 1, outcome: 'SYNCED', serverTime: this.now(), active: [...this.#pending.values()].map(p => this.#view(p)), terminal: [...this.#terminal.values()] };
    }
}

module.exports = { ApprovalProtocol, LIMITS };

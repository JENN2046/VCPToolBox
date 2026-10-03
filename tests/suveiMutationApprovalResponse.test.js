'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const pluginManager = require('../Plugin');
const PROJECT = '10000000-0000-4000-8000-000000000001';
const INTENT = '20000000-0000-4000-8000-000000000002';
function fixture(t, verify) {
    const manager = Object.create(Object.getPrototypeOf(pluginManager));
    const target = Object.freeze({ requestId: 'approve-fixture', toolName: 'SUVEIStudio', projectId: PROJECT, intentId: INTENT });
    const observed = { resolved: 0, rejected: 0, cancelled: 0 };
    const approval = { trustedAuthorization: target, timeoutId: setTimeout(() => {}, 10000),
        resolve() { observed.resolved++; }, reject() { observed.rejected++; } };
    manager.pendingApprovals = new Map([[target.requestId, approval]]);
    manager.serviceModules = new Map([['SUVEIStudio', { module: { verifyMutationGrantDecision: verify } }]]);
    manager.webSocketServer = { cancelVcpLogApprovalCache() { observed.cancelled++; } };
    t.after(() => clearTimeout(approval.timeoutId));
    return { manager, target, observed, approval };
}
function proof(target, proposalState = 'AUTHORIZED') {
    return { ...target, schemaVersion: 'suvei.mutation.grant.decision.v1', proposalState, revision: 1, requestFingerprint: 'a'.repeat(64) };
}
test('uncommitted or failed Core verification preserves the pending protected call and cache', async t => {
    for (const verify of [async () => null, async () => { throw new Error('Synthetic unavailable Core'); }]) {
        const f = fixture(t, verify);
        assert.equal(await f.manager.handleApprovalResponse(f.target.requestId, true), false);
        assert.equal(await f.manager.handleApprovalResponse(f.target.requestId, false), false);
        assert.equal(f.manager.pendingApprovals.get(f.target.requestId), f.approval);
        assert.deepEqual(f.observed, { resolved: 0, rejected: 0, cancelled: 0 });
    }
});
test('protected response requires strict boolean and exact request/project/intent proof', async t => {
    let checks = 0;
    const f = fixture(t, async target => { checks++; return proof(target); });
    assert.equal(await f.manager.handleApprovalResponse(f.target.requestId, 'true'), false);
    assert.equal(checks, 0);
    for (const change of [{requestId:'other'}, {projectId:INTENT}, {intentId:PROJECT}, {revision:0}, {requestFingerprint:'invalid'}, {proposalState:'PENDING'}]) {
        f.manager.serviceModules.get('SUVEIStudio').module.verifyMutationGrantDecision = async target => ({ ...proof(target), ...change });
        assert.equal(await f.manager.handleApprovalResponse(f.target.requestId, true), false);
        assert.equal(f.manager.pendingApprovals.has(f.target.requestId), true);
    }
    f.manager.serviceModules.clear();
    assert.equal(await f.manager.handleApprovalResponse(f.target.requestId, true), false);
});
test('Core AUTHORIzed proof releases only approval; terminal rejection/revocation only reject', async t => {
    for (const state of ['AUTHORIZED', 'REJECTED', 'REVOKED']) {
        const f = fixture(t, async target => proof(target, state));
        const approved = state === 'AUTHORIZED';
        assert.equal(await f.manager.handleApprovalResponse(f.target.requestId, !approved), false);
        assert.equal(await f.manager.handleApprovalResponse(f.target.requestId, approved), true);
        assert.equal(f.manager.pendingApprovals.size, 0);
        assert.deepEqual(f.observed, { resolved: approved ? 1 : 0, rejected: approved ? 0 : 1, cancelled: 1 });
        assert.equal(await f.manager.handleApprovalResponse(f.target.requestId, approved), false);
    }
});
test('concurrent responses share Core read and never settle after timeout or more than once', async t => {
    let finish, reads = 0;
    const f = fixture(t, target => { reads++; return new Promise(resolve => { finish = () => resolve(proof(target)); }); });
    const rejected = f.manager.handleApprovalResponse(f.target.requestId, false);
    const approved = f.manager.handleApprovalResponse(f.target.requestId, true);
    await Promise.resolve(); finish();
    assert.deepEqual(await Promise.all([rejected, approved]), [false, true]);
    assert.equal(reads, 1); assert.equal(f.observed.resolved, 1);
    const late = fixture(t, target => new Promise(resolve => { finish = () => resolve(proof(target)); }));
    const waiting = late.manager.handleApprovalResponse(late.target.requestId, true);
    await Promise.resolve(); late.manager.pendingApprovals.delete(late.target.requestId); finish();
    assert.equal(await waiting, false); assert.equal(late.observed.resolved, 0);
});
test('existing unprotected transport responses retain synchronous handling', t => {
    const f = fixture(t, async () => assert.fail('legacy path must not call mutation verifier'));
    f.approval.trustedAuthorization = null;
    assert.equal(f.manager.handleApprovalResponse(f.target.requestId, true), true);
    assert.equal(f.observed.resolved, 1);
});
test.after(() => pluginManager.toolApprovalManager.shutdown());

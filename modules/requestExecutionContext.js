'use strict';
const { AsyncLocalStorage } = require('node:async_hooks');
const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');

const local = new AsyncLocalStorage();
const events = new EventEmitter();
const registered = new Map();
const nativeTaskProviders = new Map();

function note(type, data) {
    const context = local.getStore();
    if (!context) return;
    try { events.emit(type, { requestId: context.requestId, ...data }); }
    catch { console.warn('[NativeExecution] OBSERVER_FAILED'); }
}
function cancellation() {
    return Object.assign(new Error('NATIVE_EXECUTION_CANCELLED'), { code: 'NATIVE_EXECUTION_CANCELLED', name: 'AbortError' });
}
function throwIfCancelled() {
    if (local.getStore()?.signal?.aborted) throw cancellation();
}
function middleware(req, res, next) {
    const requestId = req.body?.requestId, snapshot = registered.get(requestId);
    if (!snapshot) return next();
    const controller = new AbortController();
    const abort = () => { if (!res.writableEnded) controller.abort(); };
    req.once('aborted', abort);
    res.once('close', abort);
    res.once('finish', () => { req.removeListener('aborted', abort); res.removeListener('close', abort); });
    return local.run({ requestId, signal: controller.signal, ...snapshot }, next);
}
async function waitForApproval(promise, onCancel) {
    const context = local.getStore();
    if (!context) return promise;
    throwIfCancelled();
    note('approval', { waiting: true });
    let abort;
    const cancelled = new Promise((_resolve, reject) => {
        abort = () => { try { onCancel?.(); } finally { reject(cancellation()); } };
        context.signal.addEventListener('abort', abort, { once: true });
    });
    try { const result = await Promise.race([promise, cancelled]); throwIfCancelled(); return result; }
    finally { context.signal.removeEventListener('abort', abort); note('approval', { waiting: false }); }
}

// The bridge is supplied by the registered host request, never from tool arguments.
function register(requestId, config, bridge) {
    if (typeof requestId !== 'string' || registered.has(requestId)) throw new Error('NATIVE_EXECUTION_CONTEXT_CONFLICT');
    if (bridge && ['onToolDispatch', 'onToolSettled', 'onTaskAccepted', 'onTaskObserved'].some(key => typeof bridge[key] !== 'function')) {
        throw new Error('NATIVE_EXECUTION_BRIDGE_INVALID');
    }
    const prompt = config?.promptPolicy === 'native-alias-snapshot'
        ? { agentAlias: config.agentAlias, agentPrompt: config.systemPrompt } : {};
    registered.set(requestId, { ...prompt, bridge });
    return () => registered.delete(requestId);
}
function agentPrompt(alias) {
    const context = local.getStore();
    return context && context.agentAlias === alias ? context.agentPrompt : undefined;
}

async function runToolInvocation({ pluginName, recordId = null }, fn) {
    const context = local.getStore();
    if (!context?.bridge) return fn();
    throwIfCancelled();
    const invocation = Object.freeze({
        requestId: context.requestId,
        nativeRequestId: context.requestId,
        invocationId: randomUUID(),
        pluginName,
        recordId: typeof recordId === 'string' && recordId ? recordId : null
    });
    return local.run({ ...context, invocation }, async () => {
        // Failure here prevents dispatch. The lossy diagnostic emitter is not used.
        await context.bridge.onToolDispatch(invocation);
        throwIfCancelled();
        let value;
        try { value = await fn(); }
        catch (error) {
            await confirmToolSettlement(context.bridge, { ...invocation, outcome: 'error', errorCode: error?.code || 'NATIVE_TOOL_ERROR' });
            throw error;
        }
        await confirmToolSettlement(context.bridge, { ...invocation, outcome: 'returned', errorCode: null });
        return value;
    });
}

async function confirmToolSettlement(bridge, event) {
    try { await bridge.onToolSettled(event); }
    catch (cause) {
        throw Object.assign(new Error('NATIVE_TOOL_SETTLEMENT_UNCONFIRMED'), {
            code: 'NATIVE_TOOL_SETTLEMENT_UNCONFIRMED', nativeOutcome: event.outcome, cause
        });
    }
}

async function acceptNativeTask({ pluginName, nativeTaskId, agentBaseName }) {
    const context = local.getStore();
    if (!context?.bridge) return null;
    if (!context.invocation || context.invocation.pluginName !== pluginName) {
        throw Object.assign(new Error('NATIVE_TASK_INVOCATION_REQUIRED'), { code: 'NATIVE_TASK_INVOCATION_REQUIRED' });
    }
    throwIfCancelled();
    const identity = Object.freeze({ ...context.invocation, pluginName, nativeTaskId, agentBaseName });
    await context.bridge.onTaskAccepted(identity);
    // Keep this confirmed request's closure after the parent model response ends.
    return Object.freeze({ identity, observe: result => context.bridge.onTaskObserved({ ...result, ...identity }) });
}

function registerNativeTaskProvider(pluginName, provider) {
    if (typeof pluginName !== 'string' || typeof provider !== 'function') throw new Error('NATIVE_TASK_PROVIDER_INVALID');
    const entry = { provider };
    nativeTaskProviders.set(pluginName, entry);
    return () => { if (nativeTaskProviders.get(pluginName) === entry) nativeTaskProviders.delete(pluginName); };
}
async function queryNativeTask(pluginName, identity) {
    const entry = nativeTaskProviders.get(pluginName);
    if (!entry) return { ...identity, pluginName, state: 'unknown', revision: 0, code: 'NATIVE_TASK_PROVIDER_UNAVAILABLE' };
    return entry.provider({ ...identity, pluginName });
}

module.exports = {
    middleware, events, waitForApproval, throwIfCancelled, register, agentPrompt,
    runToolInvocation, acceptNativeTask, registerNativeTaskProvider, queryNativeTask,
    toolStarted: () => note('tool', { started: true }),
    run: (requestId, signal, fn) => local.run({ requestId, signal, ...registered.get(requestId) }, fn)
};

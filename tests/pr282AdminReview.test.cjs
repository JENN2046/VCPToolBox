'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../AdminPanel-Vue/node_modules/typescript');

const source = name => fs.readFileSync(path.join(__dirname, '../AdminPanel-Vue/src', name), 'utf8');
const transpile = text => ts.transpileModule(text, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;

function lookupHarness() {
    const view = source('views/PluginConfig.vue');
    const start = view.indexOf('let jevEntryRequestId =');
    const end = view.indexOf('\nconst {', start);
    assert.ok(start >= 0 && end > start);
    const pending = [];
    let unmount;
    const scope = {
        pluginName: { value: 'PluginA' }, manifestJev: { value: {} },
        jevEntry: { value: null }, jevEntryError: { value: '' },
        onBeforeUnmount: callback => { unmount = callback; },
        isHttpError: error => error?.name === 'HttpError',
        jevRegistryApi: { getEntry: name => new Promise((resolve, reject) => pending.push({ name, resolve, reject })) }
    };
    vm.runInNewContext(transpile(view.slice(start, end)) + '\nthis.load = loadJevEntry;', scope);
    return { scope, pending, unmount: () => unmount() };
}

test('optional registry lookup suppresses global errors by default but preserves explicit overrides', async () => {
    const calls = [];
    const scope = { exports: {}, require: name => {
        assert.equal(name, './requestWithUi');
        return { requestWithUi: async (request, options) => {
            calls.push({ request, options });
            throw Object.assign(new Error('missing'), { status: 404 });
        } };
    } };
    vm.runInNewContext(transpile(source('api/jevRegistry.ts')), scope);
    for (const options of [undefined, {}, { suppressErrorMessage: false }]) {
        await assert.rejects(scope.exports.jevRegistryApi.getEntry('Plugin A', options), { status: 404 });
    }
    assert.equal(calls[0].request.url, '/admin_api/jev/registry/Plugin%20A');
    assert.equal(calls[0].options.showLoader, false);
    assert.equal(calls[0].options.suppressErrorMessage, true);
    assert.equal(calls[1].options.suppressErrorMessage, true);
    assert.equal(calls[2].options.suppressErrorMessage, false);
});

test('out-of-order registry successes cannot overwrite the current plugin', async () => {
    const { scope, pending } = lookupHarness();
    const a = scope.load('PluginA');
    scope.pluginName.value = 'PluginB';
    const b = scope.load('PluginB');
    pending[1].resolve({ pluginName: 'PluginB' });
    await b;
    pending[0].resolve({ pluginName: 'PluginA' });
    await a;
    assert.equal(scope.jevEntry.value.pluginName, 'PluginB');
    assert.equal(scope.jevEntryError.value, '');
});

test('stale registry errors cannot overwrite a newer successful lookup', async () => {
    const { scope, pending } = lookupHarness();
    const a = scope.load('PluginA');
    scope.pluginName.value = 'PluginB';
    const b = scope.load('PluginB');
    pending[1].resolve({ pluginName: 'PluginB' });
    await b;
    pending[0].reject(new Error('old failure'));
    await a;
    assert.equal(scope.jevEntryError.value, '');
    assert.equal(scope.jevEntry.value.pluginName, 'PluginB');
});

test('navigation to a plugin without a declaration invalidates pending lookups', async () => {
    const { scope, pending } = lookupHarness();
    const a = scope.load('PluginA');
    scope.pluginName.value = 'PluginB';
    scope.manifestJev.value = null;
    await scope.load('PluginB');
    pending[0].resolve({ pluginName: 'PluginA' });
    await a;
    assert.equal(pending.length, 1);
    assert.equal(scope.jevEntry.value, null);
});

test('same-plugin refresh and declaration replacement invalidate earlier lookups', async () => {
    const { scope, pending } = lookupHarness();
    const a = scope.load('PluginA');
    const b = scope.load('PluginA');
    pending[1].resolve({ version: 'new' });
    await b;
    pending[0].resolve({ version: 'old' });
    await a;
    assert.equal(scope.jevEntry.value.version, 'new');
    const c = scope.load('PluginA');
    scope.manifestJev.value = {}; // Guard even before Vue runs the next watcher.
    pending[2].resolve({ version: 'stale declaration' });
    await c;
    assert.equal(scope.jevEntry.value, null);
});

test('route changes and unmount guard responses before another watcher runs', async () => {
    for (const invalidate of [h => { h.scope.pluginName.value = 'PluginB'; }, h => h.unmount()]) {
        const h = lookupHarness();
        const a = h.scope.load('PluginA');
        invalidate(h);
        h.pending[0].reject(new Error('stale'));
        await a;
        assert.equal(h.scope.jevEntry.value, null);
        assert.equal(h.scope.jevEntryError.value, '');
    }
});

test('current missing entries and genuine failures get distinct safe inline messages', async () => {
    for (const status of [404, 500]) {
        const { scope, pending } = lookupHarness();
        const a = scope.load('PluginA');
        pending[0].reject({ name: 'HttpError', status, message: 'must not echo provider payload' });
        await a;
        assert.match(scope.jevEntryError.value, status === 404 ? /未进入注册表/ : /暂时无法读取/);
        assert.doesNotMatch(scope.jevEntryError.value, /provider payload/);
    }
});

test('login owns viewport scrolling with overflow-safe vertical centering at every width', () => {
    const view = source('views/Login.vue');
    const page = view.match(/\.login-page\s*\{([^}]+)\}/)[1];
    const container = view.match(/\.login-container\s*\{([^}]+)\}/)[1];
    assert.match(page, /\bheight:\s*var\(--app-viewport-height, 100vh\)/);
    assert.match(page, /overflow-y:\s*auto/);
    assert.match(page, /align-items:\s*flex-start/);
    assert.match(container, /margin-block:\s*auto/);
    assert.match(container, /flex-shrink:\s*0/);
    assert.doesNotMatch(view, /align-items:\s*(?:center|stretch)/);
});

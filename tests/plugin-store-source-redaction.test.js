const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');

function createFakeRouter() {
    return {
        routes: [],
        get(routePath, ...handlers) {
            this.routes.push({ method: 'GET', path: routePath, handlers });
        },
        post(routePath, ...handlers) {
            this.routes.push({ method: 'POST', path: routePath, handlers });
        },
        delete(routePath, ...handlers) {
            this.routes.push({ method: 'DELETE', path: routePath, handlers });
        }
    };
}

const originalLoad = Module._load;
Module._load = function loadWithRouteDependencyStubs(request, parent, isMain) {
    if (request === 'express') {
        return { Router: createFakeRouter };
    }
    if (request === 'multer') {
        const multer = () => ({ array: () => (_req, _res, next) => next?.() });
        multer.diskStorage = () => ({});
        return multer;
    }
    if (request === 'extract-zip') {
        return async () => {};
    }
    if (request === 'tar') {
        return { x: async () => {} };
    }
    return originalLoad.call(this, request, parent, isMain);
};

let createPluginStoreRouter;
try {
    createPluginStoreRouter = require('../routes/admin/pluginStore');
} finally {
    Module._load = originalLoad;
}

const {
    redactSourceUrl,
    sanitizeSourceForApi,
    sanitizeSourcesForApi,
} = createPluginStoreRouter._test;

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
}

function assertNoRawSourceUrl(payload) {
    const serialized = JSON.stringify(payload);
    assert.equal(serialized.includes('super-secret'), false);
    assert.equal(serialized.includes('user:pass'), false);
    assert.equal(serialized.includes('access_token=abc'), false);
    assert.equal(serialized.includes('registry.example.test/feed?access_token=abc'), false);
}

test('redactSourceUrl removes credentials and token query values', () => {
    const redacted = redactSourceUrl('https://user:pass@registry.example.test/feed?access_token=abc&ok=1');

    assert.equal(redacted.includes('user:pass'), false);
    assert.equal(redacted.includes('access_token=abc'), false);
    assert.match(redacted, /access_token=%5Bredacted%5D/);
    assert.match(redacted, /ok=1/);
});

test('sanitizeSourceForApi omits raw url and exposes redacted display fields', () => {
    const source = sanitizeSourceForApi({
        id: 'src_tokenized',
        name: 'Private Registry',
        url: 'https://user:pass@registry.example.test/feed?access_token=abc',
        type: 'registry',
        builtin: false
    });

    assert.equal(Object.prototype.hasOwnProperty.call(source, 'url'), false);
    assert.equal(source.displayUrl, source.redactedUrl);
    assertNoRawSourceUrl(source);
});

test('GET /plugin-store/sources does not return raw source URLs', async () => {
    const originalReadFile = fs.promises.readFile;
    const originalMkdirSync = fs.mkdirSync;
    fs.mkdirSync = () => {};
    fs.promises.readFile = async (filePath, encoding) => {
        if (String(filePath).endsWith('pluginStoreSources.json')) {
            assert.equal(encoding, 'utf-8');
            return JSON.stringify([{
                id: 'src_private',
                name: 'Private Registry',
                url: 'https://user:pass@registry.example.test/feed?access_token=abc&secret=super-secret',
                type: 'registry',
                builtin: false
            }]);
        }
        return originalReadFile.call(fs.promises, filePath, encoding);
    };

    try {
        const router = createPluginStoreRouter({ pluginManager: null });
        const route = router.routes.find(item => item.method === 'GET' && item.path === '/plugin-store/sources');
        assert.ok(route, 'sources route should be registered');
        const res = createResponse();

        await route.handlers[0]({}, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.sources.length, 1);
        assert.equal(Object.prototype.hasOwnProperty.call(res.body.sources[0], 'url'), false);
        assert.equal(res.body.sources[0].displayUrl, res.body.sources[0].redactedUrl);
        assertNoRawSourceUrl(res.body);
    } finally {
        fs.promises.readFile = originalReadFile;
        fs.mkdirSync = originalMkdirSync;
    }
});

test('POST /plugin-store/sources duplicate response does not return raw source URL', async () => {
    const originalReadFile = fs.promises.readFile;
    const originalMkdirSync = fs.mkdirSync;
    fs.mkdirSync = () => {};
    fs.promises.readFile = async (filePath, encoding) => {
        if (String(filePath).endsWith('pluginStoreSources.json')) {
            assert.equal(encoding, 'utf-8');
            return JSON.stringify([{
                id: 'src_private',
                name: 'Private Registry',
                url: 'https://registry.example.test/feed?access_token=abc&secret=super-secret',
                type: 'registry',
                builtin: false
            }]);
        }
        return originalReadFile.call(fs.promises, filePath, encoding);
    };

    try {
        const router = createPluginStoreRouter({ pluginManager: null });
        const route = router.routes.find(item => item.method === 'POST' && item.path === '/plugin-store/sources');
        assert.ok(route, 'source create route should be registered');
        const res = createResponse();

        await route.handlers[0]({
            body: {
                name: 'Duplicate Registry',
                url: 'https://registry.example.test/feed?access_token=abc&secret=super-secret',
                type: 'registry'
            }
        }, res);

        assert.equal(res.statusCode, 409);
        assert.equal(Object.prototype.hasOwnProperty.call(res.body.source, 'url'), false);
        assertNoRawSourceUrl(res.body);
    } finally {
        fs.promises.readFile = originalReadFile;
        fs.mkdirSync = originalMkdirSync;
    }
});

test('aggregate source sanitizer used by /plugin-store output omits raw URLs', () => {
    const sources = sanitizeSourcesForApi([{
        id: 'src_private',
        name: 'Private Registry',
        url: 'https://registry.example.test/feed?token=super-secret',
        type: 'registry',
    }]);

    assert.equal(Object.prototype.hasOwnProperty.call(sources[0], 'url'), false);
    assertNoRawSourceUrl({ sources });
});

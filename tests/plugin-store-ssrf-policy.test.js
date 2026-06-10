const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function loadWithRouteDependencyStubs(request, parent, isMain) {
    if (request === 'express') {
        return { Router: () => ({ get() {}, post() {}, delete() {} }) };
    }
    if (request === 'multer') {
        const multer = () => ({ array: () => [] });
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

let pluginStoreRouter;
try {
    pluginStoreRouter = require('../routes/admin/pluginStore');
} finally {
    Module._load = originalLoad;
}

const {
    assertPublicHost,
    fetchWithGuard,
    isPrivateIp,
} = pluginStoreRouter._test;

function makeResponse(status, location = null) {
    return {
        status,
        ok: status >= 200 && status < 300,
        headers: {
            get(name) {
                if (String(name).toLowerCase() === 'location') return location;
                return null;
            }
        },
        async text() {
            return '';
        },
        async json() {
            return {};
        }
    };
}

function publicLookup() {
    return [{ address: '93.184.216.34', family: 4 }];
}

test('isPrivateIp blocks non-public IPv4 and IPv6 ranges', () => {
    for (const ip of [
        '0.0.0.0',
        '10.1.2.3',
        '100.64.0.1',
        '127.0.0.1',
        '169.254.1.1',
        '172.16.0.1',
        '192.0.2.1',
        '192.168.1.1',
        '198.18.0.1',
        '198.51.100.10',
        '203.0.113.10',
        '224.0.0.1',
        '::',
        '::1',
        '::ffff:127.0.0.1',
        'fc00::1',
        'fd12::1',
        'fe80::1',
        'fec0::1',
        'ff00::1',
        '2001:db8::1',
        '2001:0000::1',
        '2002:0a00:0001::1',
    ]) {
        assert.equal(isPrivateIp(ip), true, `${ip} should be blocked`);
    }

    assert.equal(isPrivateIp('93.184.216.34'), false);
    assert.equal(isPrivateIp('2606:4700:4700::1111'), false);
});

test('assertPublicHost fails closed when DNS lookup fails', async () => {
    const lookup = async () => {
        const error = new Error('ENOTFOUND');
        error.code = 'ENOTFOUND';
        throw error;
    };

    await assert.rejects(
        () => assertPublicHost('https://registry.example.test/plugins.json', { lookup }),
        error => error.code === 'plugin_store_url_dns_failed'
    );
});

test('assertPublicHost rejects hostnames resolving to private addresses', async () => {
    const lookup = async () => [{ address: '127.0.0.1', family: 4 }];

    await assert.rejects(
        () => assertPublicHost('https://registry.example.test/plugins.json', { lookup }),
        error => error.code === 'plugin_store_url_private_dns_blocked'
    );
});

test('fetchWithGuard rejects private redirect target before redirected fetch', async () => {
    const calls = [];
    const fetchImpl = async (url) => {
        calls.push(url);
        return makeResponse(302, 'http://127.0.0.1/admin');
    };

    await assert.rejects(
        () => fetchWithGuard('https://registry.example.test/plugins.json', {
            fetchImpl,
            lookup: publicLookup,
        }),
        error => error.code === 'plugin_store_url_private_host_blocked'
    );

    assert.deepEqual(calls, ['https://registry.example.test/plugins.json']);
});

test('fetchWithGuard follows public redirect after revalidation', async () => {
    const calls = [];
    const fetchImpl = async (url) => {
        calls.push(url);
        if (calls.length === 1) {
            return makeResponse(302, 'https://cdn.example.test/plugin.zip');
        }
        return makeResponse(200);
    };

    const response = await fetchWithGuard('https://registry.example.test/plugins.json', {
        fetchImpl,
        lookup: publicLookup,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [
        'https://registry.example.test/plugins.json',
        'https://cdn.example.test/plugin.zip',
    ]);
});

test('fetchWithGuard enforces redirect limit without leaking target URL', async () => {
    const fetchImpl = async () => makeResponse(302, 'https://registry.example.test/again');

    await assert.rejects(
        () => fetchWithGuard('https://registry.example.test/plugins.json', {
            fetchImpl,
            lookup: publicLookup,
            maxRedirects: 1,
        }),
        error => (
            error.code === 'plugin_store_url_redirect_limit'
            && !String(error.message).includes('registry.example.test')
        )
    );
});

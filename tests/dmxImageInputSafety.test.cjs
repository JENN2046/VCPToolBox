'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { fileURLToPath } = require('node:url');
const { createHttpImageReader } = require('../Plugin/DMXDoubaoGen/imageInputSafety.cjs');

const imageBytes = Buffer.from('synthetic-image-only');
const ownOrigin = 'http://image.test.invalid:6005';
const publicAddress = '93.184.216.34';

function fixture(overrides = {}) {
    const calls = { reads: [], realpaths: [], dns: [], downloads: [], posts: [] };
    const root = '/synthetic/project/image';
    const fakeFs = {
        realpath: async value => { calls.realpaths.push(value); return value; },
        stat: async () => ({ isFile: () => true, size: imageBytes.length }),
        readFile: async value => { calls.reads.push(value); return imageBytes; }
    };
    const lookup = async (hostname, options) => {
        calls.dns.push({ hostname, options });
        return [{ address: publicAddress, family: 4 }];
    };
    const axios = {
        get: async (url, options) => {
            calls.downloads.push({ url, options });
            return { status: 200, headers: { 'content-type': 'image/png; charset=binary' }, data: imageBytes };
        },
        create: () => ({ post: async (_url, payload) => {
            calls.posts.push(payload);
            throw new Error('MOCK_API_STOP');
        } })
    };
    const options = { axios, fs: fakeFs, lookup, projectBasePath: '/synthetic/project',
        serverPort: '6005', imageOrigins: ['http://image.test.invalid', 'https://image.test.invalid'],
        mimeLookup: () => 'image/png', ...overrides };
    return { calls, options, root, reader: createHttpImageReader(options) };
}

for (const imagePath of ['/images/folder/a%20b.png', '/pw=synthetic/images/folder/a%20b.png']) {
    test(`configured image host keeps local-image acceleration: ${imagePath}`, async () => {
        const { calls, reader, root } = fixture();
        assert.equal(await reader(ownOrigin + imagePath), `data:image/png;base64,${imageBytes.toString('base64')}`);
        assert.deepEqual(calls.reads, [path.join(root, 'folder/a b.png')]);
        assert.equal(calls.downloads.length, 0);
        assert.equal(calls.dns.length, 0);
    });
}

for (const value of ['..%2Fprivate-sentinel.txt', '%2Fetc%2Fsentinel', '..%5Csentinel',
    'C:%5Csentinel', 'nested/%00.png', '%ZZ']) {
    test(`reject encoded path escape or malformed path: ${value}`, async () => {
        const { calls, reader } = fixture();
        await assert.rejects(reader(`${ownOrigin}/images/${value}`), { code: 'DMX_IMAGE_INPUT_REJECTED' });
        assert.equal(calls.reads.length, 0);
        assert.equal(calls.downloads.length, 0);
    });
}

test('a symlink cannot disclose a synthetic file outside the image root', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dmx-image-safety-'));
    try {
        fs.mkdirSync(path.join(temp, 'image'));
        fs.writeFileSync(path.join(temp, 'private-sentinel.txt'), 'synthetic-only');
        fs.symlinkSync(path.join(temp, 'private-sentinel.txt'), path.join(temp, 'image', 'alias.png'));
        const { calls, reader } = fixture({ projectBasePath: temp, fs: fs.promises });
        await assert.rejects(reader(`${ownOrigin}/images/alias.png`), { code: 'DMX_IMAGE_INPUT_REJECTED' });
        assert.equal(calls.downloads.length, 0);
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('an unrelated host with /images/ cannot trigger local-file reads', async () => {
    const { calls, reader } = fixture();
    await reader('https://public.test.invalid/images/a.png');
    assert.equal(calls.reads.length, 0);
    assert.equal(calls.realpaths.length, 0);
    assert.equal(calls.downloads.length, 1);
});

for (const host of ['localhost', 'nested.localhost', 'host.local', '127.0.0.1', '2130706433',
    '0x7f000001', '10.2.3.4', '172.16.1.2', '192.168.1.2', '169.254.169.254',
    '100.100.100.200', '0.0.0.0', '[::1]', '[::ffff:127.0.0.1]', '[fe80::1]', '[fc00::1]']) {
    test(`reject non-public destination before download: ${host}`, async () => {
        const { calls, reader } = fixture();
        await assert.rejects(reader(`http://${host}/synthetic`), { code: 'DMX_IMAGE_INPUT_REJECTED' });
        assert.equal(calls.downloads.length, 0);
        assert.equal(calls.reads.length, 0);
    });
}

for (const records of [[], [{ address: '127.0.0.1', family: 4 }],
    [{ address: publicAddress, family: 4 }, { address: '10.0.0.1', family: 4 }],
    [{ address: '::ffff:192.168.1.1', family: 6 }]]) {
    test(`reject empty/private/mixed DNS records: ${JSON.stringify(records)}`, async () => {
        const { calls, reader } = fixture({ lookup: async () => records });
        await assert.rejects(reader('https://public.test.invalid/a.png'), { code: 'DMX_IMAGE_INPUT_REJECTED' });
        assert.equal(calls.downloads.length, 0);
    });
}

test('DNS failure is fail-closed, not an unsafe URL fallback', async () => {
    const { calls, reader } = fixture({ lookup: async () => { throw new Error('synthetic DNS failure'); } });
    await assert.rejects(reader('https://public.test.invalid/a.png'), { code: 'DMX_IMAGE_INPUT_REJECTED' });
    assert.equal(calls.downloads.length, 0);
});

test('public download pins DNS and disables inherited proxies and automatic redirects', async () => {
    const { calls, reader } = fixture();
    assert.equal(await reader('https://public.test.invalid/a.png'), `data:image/png;base64,${imageBytes.toString('base64')}`);
    const { options } = calls.downloads[0];
    assert.equal(options.proxy, false);
    assert.equal(options.maxRedirects, 0);
    assert.equal(calls.dns.length, 1);
    for (const agent of [options.httpAgent, options.httpsAgent]) {
        const pinned = await new Promise((resolve, reject) => agent.options.lookup('public.test.invalid', {},
            (error, address, family) => error ? reject(error) : resolve({ address, family })));
        assert.deepEqual(pinned, { address: publicAddress, family: 4 });
        const all = await new Promise((resolve, reject) => agent.options.lookup('public.test.invalid', { all: true },
            (error, records) => error ? reject(error) : resolve(records)));
        assert.deepEqual(all, [{ address: publicAddress, family: 4 }]);
    }
    assert.equal(calls.dns.length, 1, 'socket lookup must not resolve DNS again');
});

test('a public IPv6 image remains downloadable', async () => {
    const { calls, reader } = fixture();
    await reader('https://[2606:4700:4700::1111]/a.png');
    assert.equal(calls.downloads.length, 1);
});

for (const location of ['http://127.0.0.1/synthetic', 'http://169.254.169.254/synthetic',
    'http://image.test.invalid:6005/images/a.png', 'file:///synthetic/private', 'https://user:pass@public.test.invalid/a']) {
    test(`a redirect cannot pivot to a local file/service or credentials: ${location}`, async () => {
        const fx = fixture({ lookup: async hostname => [{ address: hostname === 'image.test.invalid' ? '127.0.0.1' : publicAddress, family: 4 }] });
        fx.options.axios.get = async (url, options) => {
            fx.calls.downloads.push({ url, options });
            return { status: 302, headers: { location } };
        };
        await assert.rejects(fx.reader('https://public.test.invalid/a.png'), { code: 'DMX_IMAGE_INPUT_REJECTED' });
        assert.equal(fx.calls.downloads.length, 1);
        assert.equal(fx.calls.reads.length, 0);
    });
}

test('relative public redirects preserve normal image downloading', async () => {
    const { calls, reader, options } = fixture();
    options.axios.get = async (url, opts) => {
        calls.downloads.push({ url, options: opts });
        return calls.downloads.length === 1 ? { status: 302, headers: { location: '/final.png' } }
            : { status: 200, headers: { 'content-type': 'image/png' }, data: imageBytes };
    };
    await reader('https://public.test.invalid/a.png');
    assert.equal(calls.downloads[1].url, 'https://public.test.invalid/final.png');
    assert.equal(calls.dns.length, 2);
});

test('public redirect loops are bounded', async () => {
    const { calls, reader, options } = fixture();
    options.axios.get = async (url, opts) => {
        calls.downloads.push({ url, options: opts });
        return { status: 302, headers: { location: '/loop' } };
    };
    await assert.rejects(reader('https://public.test.invalid/a.png'), { code: 'DMX_IMAGE_INPUT_REJECTED' });
    assert.equal(calls.downloads.length, 6);
});

test('verified public download failures retain URL fallback', async () => {
    const { reader, options } = fixture();
    options.axios.get = async () => { throw new Error('synthetic timeout'); };
    assert.equal(await reader('https://public.test.invalid/a.png'), 'https://public.test.invalid/a.png');
});

test('missing local image must not fall through to fetching a private image server', async () => {
    const { calls, reader } = fixture({ imageOrigins: ['http://127.0.0.1:6005'], fs: {
        realpath: async () => { throw Object.assign(new Error('missing synthetic image'), { code: 'ENOENT' }); }
    } });
    await assert.rejects(reader('http://127.0.0.1:6005/images/missing.png'), { code: 'DMX_IMAGE_INPUT_REJECTED' });
    assert.equal(calls.downloads.length, 0);
});

test('normal private-address image host still works through bounded local-file acceleration', async () => {
    const { calls, reader } = fixture({ imageOrigins: ['http://127.0.0.1:6005'] });
    await reader('http://127.0.0.1:6005/pw=synthetic/images/allowed.png');
    assert.equal(calls.reads.length, 1);
    assert.equal(calls.downloads.length, 0);
});

function pluginFixture() {
    const fx = fixture();
    const source = fs.readFileSync(path.join(__dirname, '../Plugin/DMXDoubaoGen/DoubaoGen.js'), 'utf8');
    const ctx = vm.createContext({ axios: fx.options.axios, fs: fx.options.fs, path, fileURLToPath, URL, Buffer,
        uuidv4: () => 'synthetic-only', mime: { lookup: () => 'image/png' },
        imageInputSafety: { createHttpImageReader: options => createHttpImageReader({ ...options, lookup: fx.options.lookup }) },
        console: { warn() {}, error() {}, log() {} }, process: { env: {
            VOLCENGINE_API_KEY: 'synthetic-not-a-real-credential', PROJECT_BASE_PATH: '/synthetic/project',
            SERVER_PORT: '6005', IMAGESERVER_IMAGE_KEY: 'synthetic-only', VarHttpUrl: 'http://image.test.invalid'
        } } });
    const body = source.slice(0, source.indexOf('async function main()')).replace(/^import[^\n]*\n/gm, '');
    vm.runInContext(`${body}\nglobalThis.generate=generateImageAndSave; globalThis.read=getImageData;`, ctx);
    return { ...fx, ctx };
}

for (const input of [`${ownOrigin}/images/..%2Fprivate-sentinel.txt`, 'http://127.0.0.1/synthetic']) {
    test(`edit and compose reject unsafe input before the external API: ${input}`, async () => {
        const { calls, ctx } = pluginFixture();
        for (const args of [{ command: 'DoubaoEditImage', image: input },
            { command: 'DoubaoComposeImage', image_1: input }]) {
            await assert.rejects(ctx.generate({ ...args, prompt: 'synthetic edit', resolution: 'adaptive' }), /Unsafe image input/);
        }
        assert.equal(calls.posts.length, 0);
        assert.equal(calls.reads.length, 0);
        assert.equal(calls.downloads.length, 0);
    });
}

test('plugin integration preserves valid own-image upload and explicit data/file inputs', async () => {
    const { calls, ctx } = pluginFixture();
    await assert.rejects(ctx.generate({ command: 'DoubaoEditImage', image: `${ownOrigin}/images/allowed.png`,
        prompt: 'synthetic edit', resolution: 'adaptive' }), /MOCK_API_STOP/);
    assert.equal(calls.posts[0].image, `data:image/png;base64,${imageBytes.toString('base64')}`);
    assert.equal(await ctx.read('data:image/png;base64,c3ludGhldGlj'), 'data:image/png;base64,c3ludGhldGlj');
    assert.match(await ctx.read('file:///synthetic/project/explicit-user-image.png'), /^data:image\/png;base64,/);
});

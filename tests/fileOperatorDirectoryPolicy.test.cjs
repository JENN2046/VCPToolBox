'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { EventEmitter } = require('node:events');
const ROOT = path.resolve(__dirname, '..');
const deps = createRequire(path.join(process.env.VCP_TEST_DEPENDENCY_ROOT || ROOT, 'package.json'));
const { syntheticDotenv } = require('./helpers/syntheticDotenv.cjs');
const { loadConfiguration } = require('../Plugin/FileOperator/configurationLoader');
const glob = deps('glob');
const policyApi = require('../Plugin/FileOperator/directoryPolicy');
const source = fs.readFileSync(path.join(ROOT, 'Plugin/FileOperator/FileOperator.js'), 'utf8');

function loadPolicy(text = '', env = {}, extra = {}) {
  const { dotenv } = syntheticDotenv(env, new Map([['/synthetic/config.env', text]]), {
    ioOverride: extra.io, parseOverride: extra.dotenv?.parse
  });
  return policyApi.createDirectoryPolicy(loadConfiguration({ configPath: '/synthetic/config.env', env, dotenv }));
}

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fileoperator-policy-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, 'project');
  const outside = path.join(base, 'project-sibling');
  fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(root, 'sub/file.txt'), 'inside');
  fs.writeFileSync(path.join(outside, 'file.txt'), 'fixture outside');
  return { base, root, outside, policy: loadPolicy(`ALLOWED_DIRECTORIES=${root}`) };
}

for (const text of ['', '# no directory field\nMAX_FILE_SIZE=123', 'ALLOWED_DIRECTORIES=', 'ALLOWED_DIRECTORIES: ', 'ALLOWED_DIRECTORIES=" , , "']) {
  test(`successfully parsed empty/missing field keeps unrestricted default: ${JSON.stringify(text)}`, () => {
    const policy = loadPolicy(text);
    assert.equal(policy.error, null);
    assert.deepEqual(policy.directories, []);
    assert.equal(policyApi.isPathAllowed(policy, '/synthetic/anything', {
      io: new Proxy({}, { get() { assert.fail('Unrestricted policy must not inspect paths'); } })
    }), true);
  });
}

test('dotenv quoting, comments, multiline fields, comma parsing and inherited precedence remain compatible', () => {
  const env = { ALLOWED_DIRECTORIES: '' };
  const policy = loadPolicy('export ALLOWED_DIRECTORIES="/one, /two" # comment\nOTHER="first\nsecond"', env);
  assert.deepEqual(policy.directories, []);
  assert.equal(env.OTHER, 'first\nsecond');
  assert.deepEqual(loadPolicy("ALLOWED_DIRECTORIES='/one, /two'\n").directories, ['/one', '/two']);
});

for (const [label, options, pattern] of [
  ['read error', { io: { readFileSync() { throw Object.assign(new Error('SYNTHETIC_SECRET'), { code: 'EACCES' }); } } }, /CONFIG_LOAD_FAILED/],
  ['missing file', { io: { readFileSync() { throw Object.assign(new Error('SYNTHETIC_SECRET'), { code: 'ENOENT' }); } } }, /CONFIG_LOAD_FAILED/],
  ['parse exception', { dotenv: { parse() { throw new Error('SYNTHETIC_SECRET'); } } }, /CONFIG_PARSE_FAILED/],
  ['malformed assignment', { text: 'ALLOWED_DIRECTORIES /one' }, /AMBIGUOUS_DIRECTORY_FIELD/],
  ['invalid colon assignment', { text: 'ALLOWED_DIRECTORIES : /one' }, /AMBIGUOUS_DIRECTORY_FIELD/],
  ['silently dropped field', { text: 'ALLOWED_DIRECTORIES=/one', dotenv: { parse: () => ({}) } }, /AMBIGUOUS_DIRECTORY_FIELD/],
  ['multiline selected directory field', { text: 'ALLOWED_DIRECTORIES="/one\n/two"' }, /INVALID_ALLOWED_DIRECTORIES/],
  ['non-string loaded field', { dotenv: { parse: () => ({ ALLOWED_DIRECTORIES: 123 }) } }, /INVALID_ALLOWED_DIRECTORIES/],
  ['undefined inherited field is not a missing field', { env: { ALLOWED_DIRECTORIES: undefined } }, /INVALID_ALLOWED_DIRECTORIES/],
  ['non-string parsed field', { dotenv: { parse: () => ({ ALLOWED_DIRECTORIES: [] }) } }, /INVALID_ALLOWED_DIRECTORIES/],
  ['non-object parse result', { dotenv: { parse: () => null } }, /CONFIG_PARSE_FAILED/],
  ['illegal inherited type', { env: { ALLOWED_DIRECTORIES: [] } }, /INVALID_ALLOWED_DIRECTORIES/],
  ['embedded NUL', { env: { ALLOWED_DIRECTORIES: '/one\0bad' } }, /INVALID_ALLOWED_DIRECTORIES/],
  ['embedded newline', { text: 'ALLOWED_DIRECTORIES="/one\\n/two"' }, /INVALID_ALLOWED_DIRECTORIES/],
  ['NUL in selected field', { text: 'ALLOWED_DIRECTORIES=bad\0text' }, /INVALID_ALLOWED_DIRECTORIES/],
  ['non-string inherited field even with key', { env: { DOTENV_KEY: 'SYNTHETIC_SECRET', ALLOWED_DIRECTORIES: [] } }, /INVALID_ALLOWED_DIRECTORIES/]
]) {
  test(`configuration ${label} never becomes unrestricted`, () => {
    const { text = '', env = {}, ...extra } = options;
    const policy = loadPolicy(text, env, extra);
    assert.equal(policy.directories, null);
    assert.match(policy.error.message, pattern);
    assert.ok(!policy.error.message.includes('SYNTHETIC_SECRET'));
    assert.throws(() => policyApi.isPathAllowed(policy, '/synthetic/anything'), pattern);
  });
}

test('nonempty policy accepts root, ordinary descendants and new descendants, rejects sibling prefix and traversal', t => {
  const { root, outside, policy } = fixture(t);
  for (const p of [root, path.join(root, 'sub/file.txt'), path.join(root, 'new/deep/file.txt')]) {
    assert.equal(policyApi.isPathAllowed(policy, p), true, p);
  }
  for (const p of [outside, path.join(outside, 'file.txt'), path.join(root, '../project-sibling/file.txt')]) {
    assert.equal(policyApi.isPathAllowed(policy, p), false, p);
  }
});

test('Linux case differences are distinct directories', { skip: process.platform !== 'linux' }, t => {
  const { base, root, policy } = fixture(t);
  const differentCase = path.join(base, 'PROJECT');
  fs.mkdirSync(differentCase);
  assert.equal(policyApi.isPathAllowed(policy, differentCase), false);
  assert.equal(policyApi.isPathAllowed(policy, root), true);
});

test('real symlinks: inside alias allowed; escape, dangling link and looping link denied', { skip: process.platform !== 'linux' }, t => {
  const { root, outside, policy } = fixture(t);
  fs.symlinkSync(path.join(root, 'sub'), path.join(root, 'inside'));
  fs.symlinkSync(outside, path.join(root, 'escape'));
  fs.symlinkSync(path.join(outside, 'missing'), path.join(root, 'dangling'));
  fs.symlinkSync('loop', path.join(root, 'loop'));
  assert.equal(policyApi.isPathAllowed(policy, path.join(root, 'inside/file.txt')), true);
  assert.equal(policyApi.isPathAllowed(policy, path.join(root, 'escape/file.txt')), false);
  assert.equal(policyApi.isPathAllowed(policy, path.join(root, 'escape/new/file.txt')), false);
  assert.throws(() => policyApi.isPathAllowed(policy, path.join(root, 'dangling/file.txt')), /verification failed/);
  assert.throws(() => policyApi.isPathAllowed(policy, path.join(root, 'loop')), /verification failed/);
});

for (const method of ['realpathSync', 'lstatSync', 'statSync']) {
  test(`${method} failure denies instead of using lexical fallback`, t => {
    const { root, policy } = fixture(t);
    const io = Object.create(fs);
    io[method] = () => { throw Object.assign(new Error('fixture denied'), { code: 'EACCES' }); };
    assert.throws(() => policyApi.isPathAllowed(policy, path.join(root, 'sub/file.txt'), { io }), /verification failed/);
  });
}

test('missing or non-directory configured roots fail closed', t => {
  const { root } = fixture(t);
  for (const allowed of [path.join(root, 'missing'), path.join(root, 'sub/file.txt')]) {
    assert.throws(() => policyApi.isPathAllowed(loadPolicy(`ALLOWED_DIRECTORIES=${allowed}`), allowed), /verification failed/);
  }
});

test('Windows path semantics: case-insensitive hierarchy, sibling boundaries and other drives (simulated)', () => {
  const win = path.win32;
  assert.equal(policyApi.isWithin('c:\\PROJECT\\child', 'C:\\project', win), true);
  assert.equal(policyApi.isWithin('C:\\project-sibling', 'C:\\project', win), false);
  assert.equal(policyApi.isWithin('D:\\project', 'C:\\project', win), false);
  const entries = new Map([
    ['c:\\project', 'C:\\Project'], ['c:\\project\\child', 'C:\\Project\\Child'],
    ['c:\\project\\junction', 'D:\\Outside']
  ]);
  const lookup = p => {
    if (!entries.has(p.toLowerCase())) throw Object.assign(new Error('not found'), { code: 'ENOENT' });
    return entries.get(p.toLowerCase());
  };
  const io = { realpathSync: lookup, lstatSync: p => { lookup(p); return {}; }, statSync: () => ({ isDirectory: () => true }) };
  const policy = loadPolicy('ALLOWED_DIRECTORIES=C:\\Project');
  assert.equal(policyApi.isPathAllowed(policy, 'c:\\PROJECT\\child', { io, pathApi: win }), true);
  assert.equal(policyApi.isPathAllowed(policy, 'C:\\Project\\junction\\new.txt', { io, pathApi: win }), false);
});

// Evaluate the entire stdio plugin with synthetic config and fixture-only I/O.
// No real config.env, services, providers, audit logs or business files are loaded.
function loadPlugin(f, { text = `ALLOWED_DIRECTORIES=${f.root}`, configExtra = {}, ioFailures = {} } = {}) {
  const calls = [];
  const wireMessages = [];
  const env = { PATH: '/usr/bin:/bin', WEB_FILE_DIR: path.join(f.outside, 'cache'), CANVAS_DIRECTORY: path.join(f.root, 'canvas') };
  function checked(name, fn) {
    return (p, ...args) => {
      assert.ok(typeof p === 'string' && policyApi.isWithin(path.resolve(p), f.base), `Fixture-only I/O: ${name}`);
      calls.push([name, p]);
      if (ioFailures[name]) throw Object.assign(new Error('fixture OS denied'), { code: 'EACCES' });
      return fn(p, ...args);
    };
  }
  const io = Object.create(fs);
  for (const method of ['lstatSync', 'realpathSync', 'statSync', 'existsSync', 'mkdirSync', 'createWriteStream']) {
    io[method] = checked(method, fs[method].bind(fs));
  }
  const asyncIo = Object.create(fs.promises);
  for (const method of ['stat', 'readFile', 'writeFile', 'appendFile', 'readdir', 'mkdir', 'rename', 'copyFile', 'unlink']) {
    asyncIo[method] = checked(method, fs.promises[method].bind(fs.promises));
  }
  const fsModule = Object.create(io);
  Object.defineProperty(fsModule, 'promises', { value: asyncIo });
  const processMock = new EventEmitter();
  processMock.env = env;
  processMock.stdin = new EventEmitter();
  processMock.stdin.setEncoding = () => {};
  const context = { __dirname: path.join(ROOT, 'Plugin/FileOperator'), process: processMock, Buffer, URL,
    console: { error() {}, log(value) { wireMessages.push(JSON.parse(value)); } },
    require(name) {
      if (name === 'fs') return fsModule;
      if (name === 'path') return path;
      if (name === 'glob') return glob;
      if (name === 'minimatch') return { minimatch: deps('minimatch') };
      if (name === './configurationLoader') return { loadConfiguration: () => {
        const { dotenv } = syntheticDotenv(env, new Map([['/synthetic/config.env', text]]), { ioOverride: configExtra.io, parseOverride: configExtra.dotenv?.parse });
        return loadConfiguration({ configPath: '/synthetic/config.env', env, dotenv });
      } };
      if (name === './directoryPolicy') return {
        createDirectoryPolicy: policyApi.createDirectoryPolicy,
        isPathAllowed: (policy, target) => policyApi.isPathAllowed(policy, target, { io })
      };
      if (name === './CodeValidator.js') return { validateCode: async () => [] };
      if (name === 'axios') return () => { calls.push(['NETWORK']); throw new Error('No network in tests'); };
      if (['pdf-parse', 'mammoth', 'exceljs'].includes(name)) return {};
      throw new Error(`Unexpected dependency: ${name}`);
    }
  };
  vm.runInNewContext(source + '\n globalThis.api = {processRequest, processBatchRequest, convertToVCPFormat};', context);
  return { api: context.api, calls, wireMessages, stdin: processMock.stdin };
}

test('ListAllowedDirectories empty state is explicit in single, batch and VCP output, without enumerating filesystem', async t => {
  const f = fixture(t);
  const { api, calls } = loadPlugin(f, { text: 'ALLOWED_DIRECTORIES=' });
  const result = await api.processRequest({ command: 'ListAllowedDirectories' });
  assert.equal(result.success, true);
  assert.equal(result.data.directoryPolicy, 'unrestricted');
  assert.equal(result.data.configurationParsing, 'legacy_tolerant');
  assert.equal(result.data.message, '允许目录为空，当前不限制目录范围');
  assert.equal(Object.keys(result.data.allowedRoots).length, 0);
  const wire = api.convertToVCPFormat(result);
  assert.equal(wire.status, 'success');
  assert.match(wire.result.content[0].text, /不代表所有文件均可访问/);
  const batch = await api.processRequest({ command1: 'ListAllowedDirectories' });
  assert.match(JSON.stringify(batch), /允许目录为空，当前不限制目录范围/);
  assert.deepEqual(calls, []);
});

test('unrestricted operations still reach OS permission checks', async t => {
  const f = fixture(t);
  const { api, calls } = loadPlugin(f, { text: '', ioFailures: { readFile: true } });
  const result = await api.processRequest({ command: 'ReadFile', path: path.join(f.outside, 'file.txt') });
  assert.equal(result.success, false);
  assert.match(result.error, /fixture OS denied/);
  assert.ok(calls.some(([method]) => method === 'readFile'));
});

test('valid empty configuration permits ordinary I/O outside a former root within the test fixture', async t => {
  const f = fixture(t);
  const { api } = loadPlugin(f, { text: 'ALLOWED_DIRECTORIES=' });
  for (const request of [
    { command: 'ReadFile', path: path.join(f.outside, 'file.txt') },
    { command: 'FileInfo', path: path.join(f.outside, 'file.txt') },
    { command: 'WriteFile', path: path.join(f.outside, 'new.txt'), content: 'unrestricted fixture' }
  ]) {
    const result = await api.processRequest(request);
    assert.equal(result.success, true, request.command + ': ' + result.error);
  }
  assert.equal(fs.readFileSync(path.join(f.outside, 'new.txt'), 'utf8'), 'unrestricted fixture');
});

const operations = outside => [
  { command: 'ReadFile', path: outside }, { command: 'FileInfo', path: outside },
  { command: 'WriteFile', path: outside, content: 'fixture' },
  { command: 'WriteEscapedFile', path: outside, content: 'fixture' },
  { command: 'AppendFile', path: outside, content: 'fixture' },
  { command: 'EditFile', path: outside, content: 'fixture' },
  { command: 'ListDirectory', path: outside }, { command: 'CreateDirectory', path: outside },
  { command: 'SearchFiles', path: outside, pattern: '*.txt' },
  { command: 'DeleteFile', path: outside },
  { command: 'UpdateHistory', path: outside, target: 'old', replace: 'new' },
  { command: 'ApplyDiff', path: outside, target: 'old', replace: 'new' },
  { command: 'CopyFile', sourcePath: outside, destinationPath: outside },
  { command: 'MoveFile', sourcePath: outside, destinationPath: outside },
  { command: 'RenameFile', sourcePath: outside, destinationPath: outside },
  { command: 'DownloadFile', url: 'https://fixture.invalid/file.txt', downloadDir: path.dirname(outside) },
  { command: 'WebReadFile', url: 'https://fixture.invalid/file.txt' },
  { command: 'CreateCanvas', fileName: '../../project-sibling/file.txt', content: 'fixture' }
];

test('all 18 local operation entries reject out-of-root paths before content I/O, mkdir or network', async t => {
  const f = fixture(t);
  for (const request of operations(path.join(f.outside, 'file.txt'))) {
    const { api, calls } = loadPlugin(f);
    const result = await api.processRequest(request);
    assert.equal(result.success, false, request.command);
    assert.match(result.error, /Access denied/, request.command);
    assert.ok(calls.every(([method]) => ['realpathSync', 'statSync', 'lstatSync'].includes(method)), request.command);
  }
});

test('invalid configuration rejects every operation and batch before any I/O', async t => {
  const f = fixture(t);
  for (const options of [
    { text: 'ALLOWED_DIRECTORIES /synthetic/ambiguous' },
    { configExtra: { io: { readFileSync() { throw new Error('fixture failure'); } } } },
    { configExtra: { dotenv: { parse: () => ({ ALLOWED_DIRECTORIES: [] }) } } }
  ]) {
    const { api, calls } = loadPlugin(f, options);
    for (const request of [...operations(path.join(f.root, 'sub/file.txt')), { command: 'ListAllowedDirectories' }, { command1: 'ReadFile' }]) {
      const result = await api.processRequest(request);
      assert.equal(result.success, false, request.command || request.command1);
      assert.match(result.error, /configuration error/);
    }
    assert.deepEqual(calls, []);
  }
});

test('single and batch aliases reach the same restricted policy', async t => {
  const f = fixture(t);
  const { api } = loadPlugin(f);
  for (const alias of ['path', 'filePath', 'directoryPath', 'Path']) {
    const result = await api.processRequest({ command: 'ReadFile', [alias]: path.join(f.outside, 'file.txt') });
    assert.equal(result.success, false, alias);
  }
  const batch = await api.processRequest({ command1: 'ReadFile', filePath1: path.join(f.outside, 'file.txt') });
  assert.match(JSON.stringify(batch), /Access denied/);
});

test('allowed local read, create, append, edit, copy and rename retain behavior and no-overwrite naming', async t => {
  const f = fixture(t);
  const { api } = loadPlugin(f);
  const created = path.join(f.root, 'new.txt');
  for (const request of [
    { command: 'ReadFile', path: path.join(f.root, 'sub/file.txt') },
    { command: 'FileInfo', path: path.join(f.root, 'sub/file.txt') },
    { command: 'WriteFile', path: created, content: 'one' },
    { command: 'WriteFile', path: created, content: 'two' },
    { command: 'AppendFile', path: created, content: ' three' },
    { command: 'EditFile', path: created, content: 'four' },
    { command: 'CreateDirectory', path: path.join(f.root, 'new/deep') },
    { command: 'CopyFile', source: created, destination: path.join(f.root, 'copy.txt') },
    { command: 'RenameFile', source: path.join(f.root, 'copy.txt'), destination: path.join(f.root, 'renamed.txt') }
  ]) {
    const result = await api.processRequest(request);
    assert.equal(result.success, true, request.command + ': ' + result.error);
  }
  assert.equal(fs.readFileSync(created, 'utf8'), 'four');
  assert.equal(fs.readFileSync(path.join(f.root, 'new(1).txt'), 'utf8'), 'two');
});

test('directory listings and search results do not follow escaping links or traversal patterns', { skip: process.platform !== 'linux' }, async t => {
  const f = fixture(t);
  fs.symlinkSync(f.outside, path.join(f.root, 'escape'));
  const { api } = loadPlugin(f);
  for (const request of [
    { command: 'ListDirectory', path: f.root }, { command: 'ListAllowedDirectories' },
    { command: 'SearchFiles', path: f.root, pattern: '*.txt' }
  ]) {
    const result = await api.processRequest(request);
    assert.equal(result.success, true, JSON.stringify(result));
    assert.ok(!JSON.stringify(result).includes('fixture outside'));
    if (result.data.items) assert.ok(!result.data.items.some(item => item.name === 'escape'));
    if (result.data.results) assert.ok(result.data.results.every(item => !item.path.includes('/escape/')));
  }
  const escaped = await api.processRequest({ command: 'SearchFiles', path: f.root, pattern: '../project-sibling/*.txt' });
  assert.ok(!escaped.success || escaped.data.results.length === 0);
});

test('copy/move/rename check both source and destination independently', async t => {
  const f = fixture(t);
  const inside = path.join(f.root, 'sub/file.txt');
  const outside = path.join(f.outside, 'file.txt');
  for (const command of ['CopyFile', 'MoveFile', 'RenameFile']) {
    for (const [source, destination] of [[inside, outside], [outside, inside]]) {
      const { api, calls } = loadPlugin(f);
      const result = await api.processRequest({ command, source, destination });
      assert.equal(result.success, false, command);
      assert.match(result.error, /Access denied/);
      assert.ok(!calls.some(([method]) => ['rename', 'copyFile'].includes(method)));
    }
  }
  assert.equal(fs.readFileSync(outside, 'utf8'), 'fixture outside');
});

test('generated no-overwrite names skip dangling links without creating their targets', { skip: process.platform !== 'linux' }, async t => {
  const f = fixture(t);
  const target = path.join(f.root, 'new.txt');
  const escapedTarget = path.join(f.outside, 'must-not-create.txt');
  fs.writeFileSync(target, 'keep existing');
  fs.symlinkSync(escapedTarget, path.join(f.root, 'new(1).txt'));
  const { api } = loadPlugin(f);
  const result = await api.processRequest({ command: 'WriteFile', path: target, content: 'new fixture' });
  assert.equal(result.success, true);
  assert.equal(result.data.path, path.join(f.root, 'new(2).txt'));
  assert.equal(fs.existsSync(escapedTarget), false);
  assert.equal(fs.readFileSync(target, 'utf8'), 'keep existing');
});

test('stdio handler exposes unrestricted state and configuration errors without loading real configuration', async t => {
  const f = fixture(t);
  for (const [text, expected] of [['ALLOWED_DIRECTORIES=', 'success'], ['ALLOWED_DIRECTORIES /synthetic/ambiguous', 'error']]) {
    const { stdin, wireMessages } = loadPlugin(f, { text });
    await stdin.listeners('data')[0](Buffer.from(JSON.stringify({ command: 'ListAllowedDirectories' }) + '\n'));
    assert.equal(wireMessages.length, 1);
    assert.equal(wireMessages[0].status, expected);
    assert.match(JSON.stringify(wireMessages[0]), expected === 'success' ? /允许目录为空，当前不限制目录范围/ : /AMBIGUOUS_DIRECTORY_FIELD/);
  }
});

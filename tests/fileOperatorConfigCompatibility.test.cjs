'use strict';

// Contract audit only. Actual installed loader source runs inside a VM with
// synthetic process.env and memory-only fs. Random synthetic keys never leave
// memory and are never assertion operands, test names, console output or records.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const { syntheticDotenv, syntheticVault } = require('./helpers/syntheticDotenv.cjs');
const managerSource = fs.readFileSync(path.join(ROOT, 'Plugin.js'), 'utf8');
const { loadConfiguration } = require('../Plugin/FileOperator/configurationLoader');
const policy = require('../Plugin/FileOperator/directoryPolicy');
const PLAIN = '/synthetic/fileoperator/config.env';
const VAULT = PLAIN + '.vault';
const loader = (env, files, patched = false) => syntheticDotenv(env, files, { patched });
const SAFE_CODES = new Set(['ENOENT', 'EACCES', 'INVALID_DOTENV_KEY', 'DECRYPTION_FAILED',
  'NOT_FOUND_DOTENV_ENVIRONMENT', 'CONFIG_PARSE_FAILED', 'CONFIG_LOAD_FAILED',
  'INVALID_ALLOWED_DIRECTORIES', 'AMBIGUOUS_DIRECTORY_FIELD']);
const safeCode = code => SAFE_CODES.has(code) ? code : 'UNEXPECTED_REDACTED_ERROR';

function kind(env) {
  if (!Object.hasOwn(env, 'ALLOWED_DIRECTORIES')) return 'absent';
  return env.ALLOWED_DIRECTORIES.split(',').some(p => p.trim()) ? 'nonempty' : 'empty';
}

function runLegacy(env, files, patched = false, options = {}) {
  const { dotenv, reads } = loader(env, files, patched);
  try {
    const result = dotenv.config({ path: PLAIN, ...options });
    if (result.error) return { status: 'returned_error', code: safeCode(result.error.code), reads };
    // Original FileOperator normalizes an absent field to the empty default.
    return { status: 'success', kind: kind(env) === 'absent' ? 'empty' : kind(env),
      field_present: Object.hasOwn(env, 'ALLOWED_DIRECTORIES'), reads };
  } catch (error) { return { status: 'thrown_error', code: safeCode(error.code), reads }; }
}

function runCandidate(env, files) {
  const { dotenv, reads } = loader(env, files);
  const configuration = loadConfiguration({ configPath: PLAIN, env, dotenv });
  const result = policy.createDirectoryPolicy(configuration);
  return { status: result.error ? 'rejected' : 'success',
    code: result.error ? safeCode(result.error.code || result.error.message.split(': ').at(-1)) : null,
    kind: result.error ? null : result.directories.length ? 'nonempty' : 'empty',
    null_directories_on_error: result.error ? result.directories === null : null,
    parsing: configuration.parsing, strictSyntaxValidated: configuration.strictSyntaxValidated, reads };
}

function compare(label, env, files, legacyExpected, candidateExpected) {
  const legacy = runLegacy({ ...env }, files);
  const candidate = runCandidate({ ...env }, files);
  for (const [key, expected] of Object.entries(legacyExpected)) assert.deepEqual(legacy[key], expected, `${label}: legacy ${key}`);
  for (const [key, expected] of Object.entries(candidateExpected)) assert.deepEqual(candidate[key], expected, `${label}: candidate ${key}`);
  return { legacy, candidate };
}

for (const [label, text, scope] of [
  ['explicit empty', 'ALLOWED_DIRECTORIES=\n', 'empty'],
  ['nonempty', 'ALLOWED_DIRECTORIES=/synthetic/project\n', 'nonempty'],
  ['missing field default', 'OTHER=fixture\n', 'empty']
]) {
  test(`no encryption key: ${label}`, () => {
    compare(`no key, ${label}`, {}, new Map([[PLAIN, text]]),
      { status: 'success', kind: scope }, { status: 'success', kind: scope });
  });
}

for (const [label, text, scope] of [
  ['valid empty', 'ALLOWED_DIRECTORIES=\n', 'empty'],
  ['valid nonempty', 'ALLOWED_DIRECTORIES=/synthetic/project\n', 'nonempty']
]) {
  test(`regression: ${label} encrypted vault loads in legacy and candidate`, () => {
    const vault = syntheticVault(text);
    const files = new Map([[PLAIN, 'ALLOWED_DIRECTORIES=/synthetic/plain-sentinel\n'], [VAULT, vault.text]]);
    compare(`valid inherited key, ${label} encrypted payload`, { DOTENV_KEY: vault.uri }, files,
      { status: 'success', kind: scope },
      { status: 'success', kind: scope });
  });
}

test('vault-only configuration does not require a plaintext file in either loader', () => {
  const vault = syntheticVault('ALLOWED_DIRECTORIES=\n');
  compare('valid key, vault only', { DOTENV_KEY: vault.uri }, new Map([[VAULT, vault.text]]),
    { status: 'success', kind: 'empty' }, { status: 'success', kind: 'empty' });
});

test('nonempty inherited key with no vault retains the plaintext fallback', () => {
  const vault = syntheticVault('ALLOWED_DIRECTORIES=\n');
  compare('valid key, missing vault, plaintext fallback', { DOTENV_KEY: vault.uri }, new Map([[PLAIN, 'ALLOWED_DIRECTORIES=\n']]),
    { status: 'success', kind: 'empty' }, { status: 'success', kind: 'empty' });
});

for (const [label, invalid, code] of [
  ['invalid URI', 'synthetic-invalid-uri', 'INVALID_DOTENV_KEY'],
  ['missing URI key', 'dotenv://fixture.invalid/vault/config.env.vault?environment=synthetic', 'INVALID_DOTENV_KEY'],
  ['missing environment selector', 'dotenv://:synthetic-invalid-length@fixture.invalid/vault/config.env.vault', 'INVALID_DOTENV_KEY'],
  ['invalid key size', 'dotenv://:short@fixture.invalid/vault/config.env.vault?environment=synthetic', 'INVALID_DOTENV_KEY']
]) {
  test(`invalid key format: ${label}`, () => {
    const vault = syntheticVault('ALLOWED_DIRECTORIES=\n');
    compare(label, { DOTENV_KEY: invalid }, new Map([[PLAIN, 'ALLOWED_DIRECTORIES=\n'], [VAULT, vault.text]]),
      { status: 'thrown_error', code }, { status: 'rejected', code, null_directories_on_error: true });
  });
}

test('invalid key without a vault is not validated by legacy plaintext fallback', () => {
  compare('invalid key, missing vault', { DOTENV_KEY: 'synthetic-invalid-uri' }, new Map([[PLAIN, 'ALLOWED_DIRECTORIES=\n']]),
    { status: 'success', kind: 'empty' }, { status: 'success', kind: 'empty' });
});

test('synthetic authentication failure does not become an empty list in either assessed failure path', () => {
  const vault = syntheticVault('ALLOWED_DIRECTORIES=\n', { authenticated: false });
  compare('ciphertext authentication failure', { DOTENV_KEY: vault.uri }, new Map([[VAULT, vault.text]]),
    { status: 'thrown_error', code: 'DECRYPTION_FAILED' },
    { status: 'rejected', null_directories_on_error: true, code: 'DECRYPTION_FAILED' });
});

test('vault envelope failure is explicit in both loaders', () => {
  const vault = syntheticVault('ALLOWED_DIRECTORIES=\n');
  compare('vault envelope missing selected payload', { DOTENV_KEY: vault.uri }, new Map([[VAULT, 'BROKEN ENVELOPE LINE\n']]),
    { status: 'thrown_error', code: 'NOT_FOUND_DOTENV_ENVIRONMENT' },
    { status: 'rejected', null_directories_on_error: true, code: 'NOT_FOUND_DOTENV_ENVIRONMENT' });
});

test('discarded decrypted directory declaration is classified as ambiguous, not a valid missing-field default', () => {
  const vault = syntheticVault('ALLOWED_DIRECTORIES /synthetic/invalid-assignment\n');
  compare('malformed decrypted assignment', { DOTENV_KEY: vault.uri }, new Map([[VAULT, vault.text]]),
    { status: 'success', kind: 'empty', field_present: false },
    { status: 'rejected', null_directories_on_error: true, code: 'AMBIGUOUS_DIRECTORY_FIELD' });
});

test('plain malformed assignment with no key is rejected by candidate rather than becoming empty', () => {
  compare('plain malformed assignment', {}, new Map([[PLAIN, 'ALLOWED_DIRECTORIES /synthetic/invalid-assignment\n']]),
    { status: 'success', kind: 'empty', field_present: false },
    { status: 'rejected', code: 'AMBIGUOUS_DIRECTORY_FIELD', null_directories_on_error: true });
});

test('plain read failure with no key is rejected explicitly rather than becoming empty', () => {
  compare('plain file read failure', {}, new Map(),
    { status: 'returned_error', code: 'ENOENT' },
    { status: 'rejected', code: 'CONFIG_LOAD_FAILED', null_directories_on_error: true });
});

test('existing dotenv option key precedence remains unchanged', () => {
  const vault = syntheticVault('ALLOWED_DIRECTORIES=\n');
  const env = { DOTENV_KEY: 'synthetic-invalid-uri' };
  const result = runLegacy(env, new Map([[VAULT, vault.text]]), false, { DOTENV_KEY: vault.uri });
  assert.equal(result.status, 'success');
  assert.equal(result.kind, 'empty');
});

test('key rotation is a real legacy contract, not a directory-policy feature', () => {
  const vault = syntheticVault('ALLOWED_DIRECTORIES=/synthetic/project\n');
  const result = runLegacy({ DOTENV_KEY: 'synthetic-invalid-uri,' + vault.uri }, new Map([[VAULT, vault.text]]));
  assert.equal(result.status, 'success');
  assert.equal(result.kind, 'nonempty');
  const candidate = runCandidate({ DOTENV_KEY: 'synthetic-invalid-uri,' + vault.uri }, new Map([[VAULT, vault.text]]));
  assert.equal(candidate.status, 'success');
  assert.equal(candidate.kind, 'nonempty');
});

for (const [label, inherited, expected] of [['empty', '', 'empty'], ['nonempty', '/synthetic/inherited', 'nonempty']]) {
  for (const encrypted of [false, true]) {
    test(`inherited ${label} field wins over conflicting ${encrypted ? 'vault' : 'plain'} field`, () => {
      const vault = syntheticVault('ALLOWED_DIRECTORIES=/synthetic/loaded\n');
      const env = { ALLOWED_DIRECTORIES: inherited, ...(encrypted ? { DOTENV_KEY: vault.uri } : {}) };
      const files = new Map([[PLAIN, 'ALLOWED_DIRECTORIES=/synthetic/loaded\n'], ...(encrypted ? [[VAULT, vault.text]] : [])]);
      compare('inherited field precedence', env, files,
        { status: 'success', kind: expected }, { status: 'success', kind: expected });
    });
  }
}

test('unrelated ignored syntax retains the missing-field default with an explicit tolerant classification', () => {
  const files = new Map([[PLAIN, 'UNRELATED BROKEN LINE\nOTHER@HOST=fixture\n']]);
  compare('unrelated ignored syntax', {}, files, { status: 'success', kind: 'empty' },
    { status: 'success', kind: 'empty', parsing: 'legacy_tolerant_with_ignored_syntax', strictSyntaxValidated: false });
});

test('directory-looking text inside a valid multiline value is not a discarded declaration', () => {
  const files = new Map([[PLAIN, 'OTHER="first\nALLOWED_DIRECTORIES /not-a-setting\nlast"\n']]);
  compare('multiline unrelated value', {}, files, { status: 'success', kind: 'empty' },
    { status: 'success', kind: 'empty', parsing: 'legacy_tolerant', strictSyntaxValidated: false });
});

test('an explicit inherited field remains selected despite an ignored local declaration', () => {
  compare('inherited field with ignored local declaration', { ALLOWED_DIRECTORIES: '' },
    new Map([[PLAIN, 'ALLOWED_DIRECTORIES /synthetic/ignored\n']]),
    { status: 'success', kind: 'empty' },
    { status: 'success', kind: 'empty', parsing: 'legacy_tolerant_with_ignored_syntax' });
});

for (const malformed of [false, true]) {
  test(`parse observation hook is restored after ${malformed ? 'failed' : 'successful'} load`, () => {
    const env = {};
    const { dotenv } = loader(env, new Map([[PLAIN, 'ALLOWED_DIRECTORIES=\n']]));
    if (malformed) dotenv.parse = () => { throw new Error('Synthetic parser failure'); };
    const original = dotenv.parse;
    const loaded = loadConfiguration({ configPath: PLAIN, env, dotenv });
    assert.ok(dotenv.parse === original);
    assert.equal(Boolean(loaded.error), malformed);
  });
}

test('loader error text containing a synthetic secret cannot enter failed assertions or serialized results', () => {
  const vault = syntheticVault('ALLOWED_DIRECTORIES=\n');
  const env = {};
  const { dotenv } = loader(env, new Map([[PLAIN, 'ALLOWED_DIRECTORIES=\n']]));
  dotenv.config = () => ({ error: new Error(vault.uri) });
  const loaded = loadConfiguration({ configPath: PLAIN, env, dotenv });
  assert.equal(loaded.error.code, 'CONFIG_LOAD_FAILED');
  let failure;
  try { assert.equal(false, true, loaded.error.message); } catch (error) { failure = error; }
  const rendered = String(failure);
  assert.ok(!rendered.includes(vault.uri));
  assert.match(rendered, /CONFIG_LOAD_FAILED/);
  const record = JSON.stringify({ code: loaded.error.code, parsing: loaded.parsing });
  assert.ok(!record.includes(vault.uri));
});

test('a loader claiming success without an observed parse cannot authorize an empty policy', () => {
  const loaded = loadConfiguration({ configPath: PLAIN, env: {}, dotenv: { parse: () => ({}), config: () => ({ parsed: {} }) } });
  const result = policy.createDirectoryPolicy(loaded);
  assert.equal(result.directories, null);
  assert.equal(result.error.code, 'CONFIG_PARSE_FAILED');
});

test('DOTENV_KEY declared only inside a plaintext file does not select vault for that initial legacy call', () => {
  const vault = syntheticVault('ALLOWED_DIRECTORIES=/synthetic/encrypted-sentinel\n');
  compare('key declaration inside plaintext only', {}, new Map([[PLAIN, 'DOTENV_KEY=' + vault.uri + '\nALLOWED_DIRECTORIES=\n'], [VAULT, vault.text]]),
    { status: 'success', kind: 'empty', reads: ['plain'] }, { status: 'success', kind: 'empty', reads: ['plain'] });
});

function parentMethods(env) {
  const slice = (start, end) => {
    const from = managerSource.indexOf(start), to = managerSource.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from);
    return managerSource.slice(from, to);
  };
  const methods = vm.runInNewContext('({' +
    slice('    _getPluginConfig(', '    getResolvedPluginConfigValue(') + ',' +
    slice('    _buildPluginProcessEnv(', '    async _loadPluginEnvConfig(') + '})', { process: { env } });
  methods._isExternalPluginManifest = () => false;
  return methods;
}

for (const [label, localText, scope] of [
  ['local field absent', 'OTHER=fixture\n', 'nonempty'],
  ['explicit local empty', 'ALLOWED_DIRECTORIES=\n', 'empty']
]) {
  test(`actual parent merge and fresh child: ${label}`, () => {
    const vault = syntheticVault('ALLOWED_DIRECTORIES=/synthetic/global\n');
    const parentEnv = { DOTENV_KEY: vault.uri };
    const globalFiles = new Map([['/synthetic/main/config.env.vault', vault.text]]);
    const parent = loader(parentEnv, globalFiles, true);
    parent.dotenv.config({ path: '/synthetic/main/config.env' });
    const manager = parentMethods(parentEnv);
    const manifest = { name: 'ServerFileOperator', configSchema: { ALLOWED_DIRECTORIES: 'string' },
      pluginSpecificEnvConfig: parent.dotenv.parse(localText) };
    const childEnv = manager._buildPluginProcessEnv(manifest, manager._getPluginConfig(manifest), {});
    assert.ok(childEnv.DOTENV_KEY === vault.uri, 'The actual core env merge retains the synthetic encryption key');
    assert.equal(kind(childEnv), scope);
    const files = new Map([[PLAIN, localText]]);
    compare(`actual parent merged env, ${label}`, childEnv, files,
      { status: 'success', kind: scope },
      { status: 'success', kind: scope });
  });
}

test('host dotenvPatch changes parse grammar, not AES-GCM or vault selection', () => {
  const vault = syntheticVault('ALLOWED_DIRECTORIES=\nOTHER@HOST=fixture\n');
  const env = { DOTENV_KEY: vault.uri };
  const result = runLegacy(env, new Map([[VAULT, vault.text]]), true);
  assert.equal(result.status, 'success');
  assert.equal(result.kind, 'empty');
  assert.ok(Object.hasOwn(env, 'OTHER@HOST'));
});

test('regression: host-valid special sibling key is tolerated without global strict validation', () => {
  compare('host special sibling key in plaintext', {}, new Map([[PLAIN, 'OTHER@HOST=fixture\nALLOWED_DIRECTORIES=\n']]),
    { status: 'success', kind: 'empty' },
    { status: 'success', kind: 'empty', parsing: 'legacy_tolerant_with_ignored_syntax', strictSyntaxValidated: false });
});

test('a thrown parser error after decryption propagates and candidate fails closed', () => {
  const plaintext = 'ALLOWED_DIRECTORIES=/synthetic/parser-fixture\n';
  const vault = syntheticVault(plaintext);
  const env = { DOTENV_KEY: vault.uri };
  const files = new Map([[PLAIN, 'ALLOWED_DIRECTORIES=\n'], [VAULT, vault.text]]);
  const legacy = loader({ ...env }, files);
  const parse = legacy.dotenv.parse;
  legacy.dotenv.parse = input => {
    if (input.toString() === plaintext) throw Object.assign(new Error('Synthetic parser failure'), { code: 'SYNTHETIC_PARSE_FAILED' });
    return parse(input);
  };
  let code = null;
  try { legacy.dotenv.config({ path: PLAIN }); } catch (error) { code = error.code; }
  assert.equal(code, 'SYNTHETIC_PARSE_FAILED');
  const candidateLoader = loader({ ...env }, files);
  const candidateParse = candidateLoader.dotenv.parse;
  candidateLoader.dotenv.parse = input => {
    if (input.toString() === plaintext) throw new Error(vault.uri); // synthetic secret failure path
    return candidateParse(input);
  };
  const configuration = loadConfiguration({ configPath: PLAIN, env: { ...env }, dotenv: candidateLoader.dotenv });
  const candidate = policy.createDirectoryPolicy(configuration);
  assert.ok(Boolean(candidate.error));
  assert.equal(candidate.directories, null);
  assert.equal(candidate.error.code, 'CONFIG_PARSE_FAILED');
  assert.ok(!candidate.error.message.includes(vault.uri));

});

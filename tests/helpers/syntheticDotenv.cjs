'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const ROOT = path.resolve(__dirname, '../..');
const deps = createRequire(path.join(process.env.VCP_TEST_DEPENDENCY_ROOT || ROOT, 'package.json'));
const source = fs.readFileSync(deps.resolve('dotenv'), 'utf8');
const version = deps('dotenv/package.json').version;

// Only this memory fs is visible to the actual installed dotenv implementation.
// No config, process environment, logger, provider or business entrypoint loads.
function syntheticDotenv(env, files, { ioOverride, parseOverride, patched = false } = {}) {
  const reads = [];
  const io = {
    existsSync(file) {
      if (!file.startsWith('/synthetic/')) throw new Error('Unexpected fixture path');
      return files.has(file);
    },
    readFileSync(file) {
      if (!file.startsWith('/synthetic/')) throw new Error('Unexpected fixture path');
      reads.push(file.endsWith('.vault') ? 'vault' : 'plain');
      if (ioOverride) return ioOverride.readFileSync(file);
      if (!files.has(file)) throw Object.assign(new Error('Synthetic read failure'), { code: 'ENOENT' });
      return files.get(file);
    }
  };
  const quiet = { log() {}, error() {}, warn() {} };
  const context = { module: { exports: {} }, Buffer, URL, console: quiet,
    process: { env, cwd: () => '/synthetic/project' },
    require(name) {
      if (name === 'fs') return io;
      if (name === 'path') return path;
      if (name === 'crypto') return crypto;
      if (name === 'os') return { homedir: () => '/synthetic/home' };
      if (name === '../package.json') return { version };
      throw new Error('Unexpected fixture dependency');
    }
  };
  context.exports = context.module.exports;
  vm.runInNewContext(source, context, { filename: 'synthetic-installed-dotenv.js' });
  const dotenv = context.module.exports;
  if (patched) vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'modules/dotenvPatch.js'), 'utf8'), {
    require: () => dotenv, console: quiet
  });
  if (parseOverride) dotenv.parse = parseOverride;
  return { dotenv, reads };
}

// Random URI/key/ciphertext are deliberately not serialized or used as assertion
// operands. Only memory fixtures receive ciphertext; there are no disk secrets.
function syntheticVault(plaintext, { authenticated = true } = {}) {
  const key = crypto.randomBytes(32), nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  if (!authenticated) tag[0] ^= 1;
  const text = `DOTENV_VAULT_SYNTHETIC="${Buffer.concat([nonce, encrypted, tag]).toString('base64')}"\n`;
  const uri = `dotenv://:${key.toString('hex')}@fixture.invalid/vault/config.env.vault?environment=synthetic`;
  key.fill(0); nonce.fill(0); encrypted.fill(0); tag.fill(0);
  return { uri, text };
}

module.exports = { syntheticDotenv, syntheticVault };

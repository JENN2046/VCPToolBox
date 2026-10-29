'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const entry = path.join(root, 'rust-vexus-lite/index.js');
const attempted = [];
assert.throws(() => vm.runInNewContext(fs.readFileSync(entry, 'utf8'), {
  process: { platform: 'win32', arch: 'x64' },
  __dirname: path.dirname(entry),
  require(name) {
    attempted.push(name);
    if (name === 'fs') return { existsSync: () => false };
    if (name === 'path') return path;
    throw new Error('Unexpected native fallback: ' + name);
  },
}), /VEXUS_CANDIDATE_BUILD_REQUIRED/);
assert.deepEqual(attempted, ['fs', 'path']);
console.log('PASS: Windows x64 absent candidate artifact rejects before package or generic fallback.');

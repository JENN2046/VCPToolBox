'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('copied plugin initializes and loads adapter contracts without host source files', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'channelhub-standalone-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const source = path.resolve(__dirname, '..');
    const target = path.join(root, 'ChannelHub');
    fs.cpSync(source, target, {
        recursive: true,
        filter: file => !path.relative(source, file).split(path.sep).some(part => ['node_modules', 'ui', 'tests'].includes(part))
    });
    // The temporary installation has only plugin code and its declared runtime
    // packages. Dependency lookup never supplies any host modules or routes.
    fs.mkdirSync(path.join(target, 'node_modules'));
    for (const name of ['express', 'mime-types', 'ws']) {
        fs.symlinkSync(path.dirname(require.resolve(`${name}/package.json`)), path.join(target, 'node_modules', name), 'dir');
    }
    const result = spawnSync(process.execPath, ['-e', `
      const assert = require('node:assert/strict');
      const plugin = require('./channel-hub');
      (async () => {
        await plugin.initialize({ ChannelHubEnabled: true, ChannelHubDataDir: ${JSON.stringify(path.join(root, 'data'))} }, {
          agentManager: { isAgent: () => true, getAgentPrompt: async () => 'synthetic' }
        });
        try {
          assert.equal(plugin.snapshot().ready, true);
          for (const channel of ['dingtalk', 'wecom', 'onebot']) {
            const contract = await import('./adapters/' + channel + '/src/adapter/contract.js');
            assert.ok(contract);
          }
        } finally { await plugin.shutdown(); }
        assert.equal(plugin.snapshot().ready, false);
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `], { cwd: target, encoding: 'utf8', env: { ...process.env, NODE_PATH: '' }, timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
});

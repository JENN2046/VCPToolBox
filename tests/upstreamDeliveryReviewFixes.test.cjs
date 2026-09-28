'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const { createDefaultExecutionBridgeRegistry } = require('../modules/pluginBridgeRegistry');
const createDailyNotesRouter = require('../routes/dailyNotesRoutes');

test('hybrid direct bridge preserves a resident presentation callback', async () => {
  const presentationSink = () => {};
  const plugin = {
    name: 'AGENTSOSResident',
    pluginType: 'hybridservice',
    communication: { protocol: 'direct' },
    requiresAdmin: false
  };
  const serviceModule = { processToolCall: async (_args, directContext) => directContext };
  const context = {
    toolName: plugin.name,
    requestIp: '127.0.0.1',
    sourceNode: 'test',
    emitEphemeralPresentation: presentationSink,
    debugLog: () => {},
    getServiceModule: () => serviceModule,
    executeDirectWithTimeout: async (_plugin, _name, module, args, directContext) => (
      module.processToolCall(args, directContext)
    )
  };

  const output = await createDefaultExecutionBridgeRegistry().execute(plugin, {}, context);
  assert.equal(output.result.emitEphemeralPresentation, presentationSink);
  assert.equal(Object.keys(output.result).includes('emitEphemeralPresentation'), false);
});

test('failed note rename removes the new destination and permits retry', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-note-rename-'));
  const folder = path.join(root, 'notes');
  const original = path.join(folder, 'old.txt');
  const destination = path.join(folder, 'new.txt');
  const unlink = fs.promises.unlink;
  const unlinkCalls = [];
  try {
    fs.mkdirSync(folder);
    fs.writeFileSync(original, 'original');
    const router = createDailyNotesRouter(root, false);
    const handler = router.stack.find(layer => (
      layer.route?.path === '/note/:folderName/:fileName' && layer.route.methods.post
    )).route.stack[0].handle;
    const request = {
      params: { folderName: 'notes', fileName: 'old.txt' },
      body: { content: 'edited', newFileName: 'new.txt' }
    };
    const response = () => ({
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    });

    fs.promises.unlink = async file => {
      unlinkCalls.push(file);
      if (file === original) throw Object.assign(new Error('locked'), { code: 'EPERM' });
      return unlink(file);
    };
    const failed = response();
    await handler(request, failed);
    assert.equal(failed.statusCode, 500);
    assert.deepEqual(unlinkCalls, [original, destination]);
    assert.equal(fs.readFileSync(original, 'utf8'), 'original');
    assert.equal(fs.existsSync(destination), false);

    fs.promises.unlink = unlink;
    const retried = response();
    await handler(request, retried);
    assert.equal(retried.statusCode, 200);
    assert.equal(fs.existsSync(original), false);
    assert.equal(fs.readFileSync(destination, 'utf8'), 'edited');
  } finally {
    fs.promises.unlink = unlink;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Doubao image alt text escapes HTML attribute metacharacters', () => {
  const source = fs.readFileSync(path.join(__dirname, '../Plugin/DoubaoGen/DoubaoGen.js'), 'utf8');
  const helper = source.match(/function escapeHtml\(str\) \{[\s\S]*?\n\}/u)?.[0];
  assert.ok(helper, 'escapeHtml helper must exist');
  const escapeHtml = vm.runInNewContext(`${helper}\nescapeHtml`);
  assert.equal(escapeHtml('A & "<tag>'), 'A &amp; &quot;&lt;tag&gt;');
});

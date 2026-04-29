const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const pluginDir = path.join(repoRoot, 'Plugin', 'GPTImageGen');
const pluginScript = path.join(pluginDir, 'GPTImageGen.js');

test('GPTImageGen is present but disabled by default on prod stable', () => {
  assert.equal(fs.existsSync(path.join(pluginDir, 'plugin-manifest.json.block')), true);
  assert.equal(fs.existsSync(path.join(pluginDir, 'plugin-manifest.json')), false);
  assert.equal(fs.existsSync(path.join(pluginDir, 'config.env.example')), true);
  assert.equal(fs.existsSync(path.join(pluginDir, 'config.env')), false);
});

test('GPTImageGen keeps local image reads bounded to project image directory', () => {
  const source = fs.readFileSync(pluginScript, 'utf8');

  assert.match(source, /PROJECT_IMAGE_ROOT/);
  assert.match(source, /isPathInside\(resolved, PROJECT_IMAGE_ROOT\)/);
  assert.match(source, /本地图片路径仅允许位于项目 image\/ 目录下/);
});

test('GPTImageGen blocks obvious local/private URL image inputs', () => {
  const source = fs.readFileSync(pluginScript, 'utf8');

  assert.match(source, /isBlockedLocalHostname/);
  assert.match(source, /localhost/);
  assert.equal(source.includes('192\\.168'), true);
  assert.match(source, /downloadImage\(input, MAX_IMAGE_SIZE\)/);
});

test('GPTImageGen exits before any API call when API key is absent', () => {
  const child = spawnSync(process.execPath, [pluginScript], {
    cwd: repoRoot,
    input: JSON.stringify({
      command: 'GPTGenerateImage',
      prompt: 'offline safety check',
      size: '1024x1024'
    }),
    encoding: 'utf8',
    env: {
      ...process.env,
      OPENAI_API_KEY: '',
      PROJECT_BASE_PATH: repoRoot,
      DebugMode: 'false'
    }
  });

  assert.notEqual(child.status, 0);
  const parsed = JSON.parse(child.stdout);
  assert.equal(parsed.status, 'error');
  assert.match(parsed.error, /OPENAI_API_KEY/);
  assert.equal(child.stderr, '');
});

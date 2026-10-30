'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
assert(process.argv[2], 'Pass the candidate executable explicitly');
const binary = path.resolve(process.argv[2]);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'r1-daily-gitignore-'));
const marker = 'r1_git_ignored_synthetic_diary_marker';
try {
  fs.mkdirSync(path.join(root, '.git'));
  fs.mkdirSync(path.join(root, 'ignored'));
  fs.writeFileSync(path.join(root, '.gitignore'), 'ignored/\n');
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  fs.writeFileSync(path.join(root, 'ignored', 'fixture.md'), marker + '\n');
  const result = spawnSync(binary, [], {
    cwd: root,
    env: { PATH: process.env.PATH || '', LANG: 'C.UTF-8', TEMP: root, TMP: root, DAILY_NOTE_ROOT: root },
    encoding: 'utf8', timeout: 10000,
    input: JSON.stringify({ query: marker, root_path: root }),
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, 'success');
  assert(JSON.stringify(payload.result).includes(marker), '.gitignore must not hide diary content');
  console.log('PASS: current-source DailyNoteSearcher finds synthetic diary under a Git-ignored folder.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

assert.ok(process.argv[2], 'Pass the rebuilt CodeSearcher executable explicitly');
const binary = path.resolve(process.argv[2]);
assert.ok(fs.statSync(binary).isFile());
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codesearcher-regression-'));
const marker = 'synthetic_fixture_marker';
let checks = 0;
function invoke(searchPath, extra = {}) {
    const env = { PATH: process.env.PATH || '', TEMP: root, TMP: root, LANG: 'C.UTF-8' };
    if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
    const child = spawnSync(binary, [], {
        cwd: root, env, encoding: 'utf8', windowsHide: true,
        input: JSON.stringify({ query: marker, search_path: searchPath, ...extra }),
        timeout: 15000, maxBuffer: 1024 * 1024,
    });
    assert.ifError(child.error);
    assert.equal(child.status, 0, child.stderr);
    checks++;
    return JSON.parse(child.stdout);
}
function text(result) {
    assert.equal(result.status, 'success');
    return result.result.content.map(part => part.text || '').join('\n');
}
try {
    fs.writeFileSync(path.join(root, 'package.json'), '{}');
    fs.writeFileSync(path.join(root, 'public.txt'), marker + '\n');
    assert.ok(text(invoke('public.txt')).includes(marker));
    for (const name of ['.env', '.env.local', 'config.env', 'config.env.local', 'config.env.bak', 'service.env.production']) {
        fs.writeFileSync(path.join(root, name), marker + '\n');
        const result = invoke(name);
        assert.equal(result.status, 'error', name);
        assert.ok(!JSON.stringify(result).includes(marker), name);
    }
    for (const name of ['config.env.example', 'config.env.sample', 'config.env.template']) {
        fs.writeFileSync(path.join(root, name), marker + '\n');
        assert.ok(text(invoke(name)).includes(marker), name);
    }
    fs.writeFileSync(path.join(root, 'dense.txt'), (marker + '\n').repeat(30));
    const rendered = text(invoke('dense.txt', { max_results: 1, context_lines: 20 }));
    assert.equal((rendered.match(/^\d+:\d+:synthetic_fixture_marker$/gm) || []).length, 1);
    assert.equal((rendered.match(/^\d+-synthetic_fixture_marker$/gm) || []).length, 20);
    assert.equal(invoke('../').status, 'error');
    console.log(`CodeSearcher native regression: ${checks} isolated checks passed.`);
} finally {
    fs.rmSync(root, { recursive: true, force: true });
}

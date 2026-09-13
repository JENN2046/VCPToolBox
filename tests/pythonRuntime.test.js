'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    resolvePythonExecutable,
    resolvePluginCommand
} = require('../modules/pythonRuntime');

test('explicit Python override is authoritative even when currently unavailable', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-python-'));
    try {
        assert.equal(resolvePythonExecutable({
            projectRoot: root,
            env: {
                ...process.env,
                VCP_PYTHON_EXECUTABLE: '/opt/vcp/custom-python'
            }
        }), '/opt/vcp/custom-python');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('Python manifest commands are rewritten to the selected interpreter', () => {
    assert.deepEqual(resolvePluginCommand({
        entryPoint: { command: 'python "worker script.py" --flag value' }
    }, '/project/.venv/bin/python'), {
        command: '/project/.venv/bin/python',
        args: ['worker script.py', '--flag', 'value']
    });
});

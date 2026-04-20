const assert = require('node:assert/strict');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

async function createTempWorkspace(prefix = 'photo-studio-') {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    const dataDir = path.join(workspaceRoot, 'data', 'photo-studio');

    return {
        workspaceRoot,
        dataDir
    };
}

async function cleanupWorkspace(workspaceRoot) {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
}

function runPlugin(scriptRelativePath, payload, env = {}) {
    const scriptPath = path.join(REPO_ROOT, scriptRelativePath);

    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [scriptPath], {
            cwd: path.dirname(scriptPath),
            env: {
                ...process.env,
                ...env
            },
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        child.on('error', reject);

        child.on('close', (code) => {
            const trimmedStdout = stdout.trim();
            let parsed = null;

            if (trimmedStdout) {
                try {
                    parsed = JSON.parse(trimmedStdout);
                } catch (error) {
                    reject(new Error(`Failed to parse plugin stdout: ${error.message}\nstdout=${trimmedStdout}\nstderr=${stderr}`));
                    return;
                }
            }

            resolve({
                code,
                json: parsed,
                stderr,
                stdout: trimmedStdout
            });
        });

        child.stdin.end(JSON.stringify(payload));
    });
}

async function readStoreJson(dataDir, fileName) {
    const raw = await fs.readFile(path.join(dataDir, fileName), 'utf8');
    return JSON.parse(raw);
}

function assertSuccessEnvelope(result) {
    assert.equal(result.code, 0, result.stderr || result.stdout);
    assert.ok(result.json, 'Expected JSON output');
    assert.equal(result.json.success, true, result.stdout);
    assert.equal(result.json.error, null);
}

function assertFailureEnvelope(result, expectedCode) {
    assert.equal(result.code, 1, result.stdout);
    assert.ok(result.json, 'Expected JSON output');
    assert.equal(result.json.success, false);
    assert.equal(result.json.error.code, expectedCode);
}

module.exports = {
    assertFailureEnvelope,
    assertSuccessEnvelope,
    cleanupWorkspace,
    createTempWorkspace,
    readStoreJson,
    runPlugin
};

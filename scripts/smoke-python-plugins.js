'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {
    resolvePythonExecutable,
    resolvePluginCommand
} = require('../modules/pythonRuntime');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PYTHON_PLUGIN_DIRS = [
    'ArtistMatcher',
    'BilibiliFetch',
    'DigitalOracle',
    'SciCalculator',
    'VideoGenerator'
];

const SMOKE_CASES = {
    ArtistMatcher: {
        input: { command: 'FindArtist', artist_name: '__vcp_smoke_unknown_artist__' },
        expectedStatus: 'success',
        expectedExitCodes: [0]
    },
    // Negative protocol cases avoid external network calls while still proving
    // the real entry point can import, read stdin, validate, and write JSON.
    BilibiliFetch: {
        input: {},
        expectedStatus: 'error',
        expectedExitCodes: [0]
    },
    DigitalOracle: {
        input: { command: 'ListProviders' },
        expectedStatus: 'success',
        expectedExitCodes: [0]
    },
    SciCalculator: {
        input: { expression: '1 + 1' },
        expectedStatus: 'success',
        expectedExitCodes: [0]
    },
    VideoGenerator: {
        input: { command: '__vcp_smoke_validation_only__' },
        expectedStatus: 'error',
        expectedExitCodes: [1],
        env: {
            SILICONFLOW_API_KEY: '__vcp_smoke_placeholder__'
        }
    }
};

function readManifest(pluginDir) {
    const manifestPath = path.join(PROJECT_ROOT, 'Plugin', pluginDir, 'plugin-manifest.json');
    return {
        ...JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
        basePath: path.dirname(manifestPath)
    };
}

function runSmoke(manifest, pluginDir, pythonExecutable) {
    const smokeCase = SMOKE_CASES[pluginDir];
    const { command, args } = resolvePluginCommand(manifest, pythonExecutable);
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: manifest.basePath,
            env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8',
                PROJECT_BASE_PATH: PROJECT_ROOT,
                ...(smokeCase.env || {})
            },
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true
        });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error(`${manifest.name} stdin/stdout smoke timed out.`));
        }, 20000);
        child.stdout.on('data', chunk => {
            stdout += chunk.toString('utf8');
        });
        child.stderr.on('data', chunk => {
            stderr += chunk.toString('utf8');
        });
        child.once('error', reject);
        child.once('exit', code => {
            clearTimeout(timer);
            let parsed = null;
            const trimmed = stdout.trim();
            try {
                // Several plugins pretty-print a multi-line JSON object.
                parsed = JSON.parse(trimmed);
            } catch (_) {
                // Other plugins may emit diagnostics before their final
                // one-line protocol response.
            }
            const lines = trimmed.split(/\r?\n/).filter(Boolean);
            for (const line of lines.reverse()) {
                if (parsed) break;
                try {
                    parsed = JSON.parse(line);
                    break;
                } catch (_) {
                    // Some plugins emit non-protocol diagnostics before JSON.
                }
            }
            if (!parsed || typeof parsed !== 'object') {
                reject(new Error(
                    `${manifest.name} emitted no JSON protocol response (exit=${code}): ${stderr.slice(0, 500)}`
                ));
                return;
            }
            const responseStatus = parsed.status || 'unknown';
            if (!smokeCase.expectedExitCodes.includes(code)
                || responseStatus !== smokeCase.expectedStatus) {
                reject(new Error(
                    `${manifest.name} returned an unexpected smoke result `
                    + `(exit=${code}, status=${responseStatus}): ${stderr.slice(0, 500)}`
                ));
                return;
            }
            resolve({
                pluginName: manifest.name,
                protocol: 'passed',
                responseStatus,
                exitCode: code,
                case: responseStatus === 'success' ? 'positive' : 'negative_validation'
            });
        });
        child.stdin.end(`${JSON.stringify(smokeCase.input)}\n`);
    });
}

(async () => {
    const pythonExecutable = resolvePythonExecutable({ projectRoot: PROJECT_ROOT });
    const results = [];
    for (const pluginDir of PYTHON_PLUGIN_DIRS) {
        results.push(await runSmoke(readManifest(pluginDir), pluginDir, pythonExecutable));
    }
    process.stdout.write(`${JSON.stringify({ pythonExecutable, results }, null, 2)}\n`);
})().catch(error => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
});

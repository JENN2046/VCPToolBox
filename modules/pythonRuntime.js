'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PYTHON_PLUGIN_IMPORTS = new Map([
    ['ArtistMatcher', ['rapidfuzz']],
    ['BilibiliFetch', ['requests', 'PIL']],
    ['DigitalOracle', ['yfinance']],
    ['SciCalculator', ['sympy', 'scipy', 'numpy']],
    ['Wan2.1VideoGen', ['requests', 'dotenv', 'PIL']]
]);

function isUsableFile(filePath) {
    try {
        fs.accessSync(filePath, fs.constants.X_OK);
        return fs.statSync(filePath).isFile();
    } catch (_) {
        return false;
    }
}

function resolveOnPath(command, env = process.env) {
    const pathValue = String(env.PATH || '');
    const extensions = process.platform === 'win32'
        ? String(env.PATHEXT || '.EXE;.CMD;.BAT').split(';')
        : [''];
    for (const directory of pathValue.split(path.delimiter).filter(Boolean)) {
        for (const extension of extensions) {
            const candidate = path.join(directory, process.platform === 'win32'
                ? `${command}${extension}`
                : command);
            if (isUsableFile(candidate)) return candidate;
        }
    }
    return null;
}

function resolvePythonExecutable(options = {}) {
    const projectRoot = options.projectRoot || path.resolve(__dirname, '..');
    const env = options.env || process.env;
    const explicit = String(env.VCP_PYTHON_EXECUTABLE || '').trim();
    // An explicit override is authoritative. Returning it even when it is
    // currently invalid lets the startup probe report the real missing path
    // instead of silently running plugins under a different interpreter.
    if (explicit) return explicit;

    const projectVenvPython = path.join(projectRoot, '.venv', 'bin', 'python');
    if (isUsableFile(projectVenvPython)) return projectVenvPython;

    return resolveOnPath('python3', env)
        || resolveOnPath('python', env)
        || 'python3';
}

function splitCommand(commandLine) {
    const tokens = [];
    const expression = /"([^"]*)"|'([^']*)'|([^\s]+)/g;
    let match;
    while ((match = expression.exec(String(commandLine || ''))) !== null) {
        tokens.push(match[1] ?? match[2] ?? match[3]);
    }
    return tokens;
}

function resolvePluginCommand(manifest, pythonExecutable) {
    const parts = splitCommand(manifest?.entryPoint?.command);
    if (parts.length === 0) return { command: '', args: [] };
    if (/^(?:python|python3|py)(?:\.exe)?$/i.test(parts[0])) {
        return { command: pythonExecutable, args: parts.slice(1) };
    }
    return { command: parts[0], args: parts.slice(1) };
}

function runProcess(command, args, options = {}) {
    const timeoutMs = options.timeoutMs || 15000;
    return new Promise(resolve => {
        let stdout = '';
        let stderr = '';
        let settled = false;
        const child = spawn(command, args, {
            cwd: options.cwd,
            env: options.env || process.env,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        const finish = result => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({ ...result, stdout, stderr });
        };
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            finish({ ok: false, code: null, error: `Timed out after ${timeoutMs}ms` });
        }, timeoutMs);
        timer.unref?.();
        child.stdout.on('data', chunk => {
            if (stdout.length < 4096) stdout += chunk.toString('utf8');
        });
        child.stderr.on('data', chunk => {
            if (stderr.length < 4096) stderr += chunk.toString('utf8');
        });
        child.once('error', error => finish({ ok: false, code: null, error: error.message }));
        child.once('exit', code => finish({
            ok: code === 0,
            code,
            error: code === 0 ? null : `Exited with code ${code}`
        }));
    });
}

function getPythonEntryScript(manifest) {
    const parts = splitCommand(manifest?.entryPoint?.command);
    const script = parts.find(part => /\.py$/i.test(part));
    return script ? path.resolve(manifest.basePath, script) : null;
}

async function validatePythonPlugin(manifest, options = {}) {
    const pythonExecutable = options.pythonExecutable || resolvePythonExecutable(options);
    const entryScript = getPythonEntryScript(manifest);
    const missing = [];

    if (!entryScript || !fs.existsSync(entryScript)) {
        missing.push({
            type: 'entry',
            value: entryScript || manifest?.entryPoint?.command || 'missing'
        });
    }

    const imports = options.imports || PYTHON_PLUGIN_IMPORTS.get(manifest.name) || [];
    const importProbe = [
        'import importlib.util, json, sys',
        `mods = ${JSON.stringify(imports)}`,
        'missing = [m for m in mods if importlib.util.find_spec(m) is None]',
        'print(json.dumps({"missing": missing}))',
        'sys.exit(1 if missing else 0)'
    ].join('; ');
    const probe = await runProcess(pythonExecutable, ['-c', importProbe], {
        cwd: manifest.basePath,
        timeoutMs: options.timeoutMs || 15000,
        env: options.env
    });

    if (!probe.ok) {
        let missingImports = imports;
        try {
            const parsed = JSON.parse(probe.stdout.trim());
            if (Array.isArray(parsed.missing)) missingImports = parsed.missing;
        } catch (_) {
            // Preserve the process-level diagnostic below.
        }
        if (missingImports.length > 0) {
            missing.push({ type: 'imports', value: missingImports });
        } else {
            missing.push({
                type: 'interpreter',
                value: probe.error || probe.stderr.trim() || pythonExecutable
            });
        }
    }

    if (entryScript && fs.existsSync(entryScript) && probe.ok) {
        const entryProbe = await runProcess(pythonExecutable, [
            '-c',
            'import runpy,sys; runpy.run_path(sys.argv[1], run_name="__vcp_import_probe__")',
            entryScript
        ], {
            cwd: manifest.basePath,
            timeoutMs: options.timeoutMs || 15000,
            env: options.env
        });
        if (!entryProbe.ok) {
            missing.push({
                type: 'entry_import',
                value: entryProbe.stderr.trim()
                    || entryProbe.error
                    || `Entry import exited with code ${entryProbe.code}`
            });
        }
    }

    return {
        pluginName: manifest.name,
        available: missing.length === 0,
        pythonExecutable,
        entryScript,
        missing
    };
}

async function validatePythonPlugins(manifests, options = {}) {
    const pythonExecutable = options.pythonExecutable || resolvePythonExecutable(options);
    const pythonManifests = Array.from(manifests).filter(manifest => {
        const entry = manifest?.entryPoint || {};
        return entry.type === 'python'
            || /^(?:python|python3|py)(?:\.exe)?\s/i.test(String(entry.command || ''))
            || /\.py(?:\s|$)/i.test(String(entry.command || ''));
    });

    const results = new Map();
    for (const manifest of pythonManifests) {
        results.set(manifest.name, await validatePythonPlugin(manifest, {
            ...options,
            pythonExecutable
        }));
    }
    return results;
}

module.exports = {
    PYTHON_PLUGIN_IMPORTS,
    resolvePythonExecutable,
    resolvePluginCommand,
    splitCommand,
    getPythonEntryScript,
    validatePythonPlugin,
    validatePythonPlugins,
    runProcess,
    resolveOnPath
};

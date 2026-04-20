#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { resolveDwsBin } = require('../lib/env');
const { resolveDwsInvocation } = require('../lib/dingtalk-executor');

function nowIso() {
  return new Date().toISOString();
}

function stamp() {
  return nowIso().replace(/[:.]/g, '-');
}

function runCommand(cmd, args, options = {}) {
  const timeoutMs = options.timeoutMs || 30000;
  const env = { ...process.env, ...(options.env || {}) };

  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let timeout = false;

    const child = spawn(cmd, args, {
      shell: false,
      windowsHide: true,
      env,
      cwd: options.cwd || process.cwd()
    });

    const timer = setTimeout(() => {
      timeout = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        command: `${cmd} ${args.join(' ')}`,
        code: null,
        stdout,
        stderr: stderr || error.message,
        timeout,
        durationMs: Date.now() - started
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        command: `${cmd} ${args.join(' ')}`,
        code,
        stdout,
        stderr,
        timeout,
        durationMs: Date.now() - started
      });
    });
  });
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function collectProxyDiagnostics() {
  return {
    HTTP_PROXY: process.env.HTTP_PROXY || '',
    HTTPS_PROXY: process.env.HTTPS_PROXY || '',
    ALL_PROXY: process.env.ALL_PROXY || '',
    warning: /127\.0\.0\.1:9|localhost:9/i.test(
      `${process.env.HTTP_PROXY || ''} ${process.env.HTTPS_PROXY || ''} ${process.env.ALL_PROXY || ''}`
    )
      ? 'proxy points to localhost:9 and may break dws auth login'
      : null
  };
}

async function main() {
  const withLogin = process.argv.includes('--login');
  const pluginBase = path.resolve(__dirname, '..');
  const docsReportDir = path.resolve(pluginBase, '..', '..', 'docs', 'dingtalk-cli', 'reports');
  fs.mkdirSync(docsReportDir, { recursive: true });
  const dwsBin = resolveDwsBin(process.env.DWS_BIN || 'dws');
  const invocation = resolveDwsInvocation(dwsBin);

  const envNoProxy = {
    HTTP_PROXY: '',
    HTTPS_PROXY: '',
    ALL_PROXY: ''
  };

  const report = {
    generatedAt: nowIso(),
    environment: {
      cwd: process.cwd(),
      resolved_dws_bin: dwsBin,
      invocation_command: invocation.command,
      invocation_prefix_args: invocation.prefixArgs,
      proxy: collectProxyDiagnostics()
    },
    checks: []
  };

  const version = await runCommand(invocation.command, [...invocation.prefixArgs, '--version'], { timeoutMs: 20000 });
  report.checks.push({ name: 'version', ...version, json: parseJson(version.stdout) });

  const authStatus = await runCommand(invocation.command, [...invocation.prefixArgs, 'auth', 'status', '--format', 'json'], {
    timeoutMs: 30000,
    env: envNoProxy
  });
  report.checks.push({ name: 'auth_status', ...authStatus, json: parseJson(authStatus.stdout) });

  const schema = await runCommand(invocation.command, [...invocation.prefixArgs, 'schema', '--format', 'json'], {
    timeoutMs: 30000,
    env: envNoProxy
  });
  report.checks.push({ name: 'schema', ...schema, json: parseJson(schema.stdout) });

  if (withLogin) {
    const login = await runCommand(invocation.command, [...invocation.prefixArgs, 'auth', 'login', '--format', 'json'], {
      timeoutMs: 5 * 60 * 1000,
      env: envNoProxy
    });
    report.checks.push({ name: 'auth_login', ...login, json: parseJson(login.stdout) });
  }

  const filename = `baseline-${stamp()}.json`;
  const fullPath = path.join(docsReportDir, filename);
  fs.writeFileSync(fullPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(path.join(docsReportDir, 'baseline-latest.json'), JSON.stringify(report, null, 2), 'utf8');

  const summaryLines = [];
  summaryLines.push(`# DWS Baseline (${report.generatedAt})`);
  summaryLines.push('');
  summaryLines.push(`- Proxy warning: ${report.environment.proxy.warning || 'none'}`);
  for (const item of report.checks) {
    summaryLines.push(`- ${item.name}: code=${item.code} timeout=${item.timeout} durationMs=${item.durationMs}`);
  }

  fs.writeFileSync(path.join(docsReportDir, 'baseline-latest.md'), `${summaryLines.join('\n')}\n`, 'utf8');
  process.stdout.write(`baseline report generated: ${fullPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});

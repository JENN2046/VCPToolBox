'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { compareSemver, pickVersion } = require('./helpers');

function resolveDwsInvocation(dwsBin) {
  const resolved = String(dwsBin || '').trim() || 'dws';
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(resolved)) {
    const npmBinDir = path.dirname(resolved);
    const jsEntry = path.join(npmBinDir, 'node_modules', 'dingtalk-workspace-cli', 'bin', 'dws.js');
    if (fs.existsSync(jsEntry)) {
      return {
        command: process.execPath || 'node',
        prefixArgs: [jsEntry],
        displayCommand: resolved
      };
    }
  }
  return {
    command: resolved,
    prefixArgs: [],
    displayCommand: resolved
  };
}

class DingTalkExecutor {
  constructor(options) {
    this.dwsBin = options.dwsBin;
    const invocation = resolveDwsInvocation(this.dwsBin);
    this.command = invocation.command;
    this.commandPrefixArgs = invocation.prefixArgs;
    this.displayCommand = invocation.displayCommand;
    this.dwsMinVersion = options.dwsMinVersion;
    this.timeoutMs = options.timeoutMs;
    this.logger = options.logger;
    this.auditLogger = options.auditLogger;
    this.cwd = options.cwd;
    this.env = options.env || process.env;
    this.spawnFn = options.spawnFn || spawn;
    this.binArgs = Array.isArray(options.binArgs) ? options.binArgs : [];
  }

  async checkHealth() {
    const versionResult = await this.runCommand(['--version'], { timeoutMs: 8000, skipAudit: true });
    if (versionResult.code !== 0) {
      return {
        ok: false,
        reason: 'dws binary unavailable',
        details: versionResult
      };
    }

    const detectedVersion = pickVersion(versionResult.stdout || versionResult.stderr || '');
    if (!detectedVersion) {
      return {
        ok: false,
        reason: 'unable to parse dws version',
        details: versionResult
      };
    }

    if (compareSemver(detectedVersion, this.dwsMinVersion) < 0) {
      return {
        ok: false,
        reason: `dws version too low: ${detectedVersion}`,
        details: {
          current: detectedVersion,
          required: this.dwsMinVersion
        }
      };
    }

    return {
      ok: true,
      version: detectedVersion,
      requiredVersion: this.dwsMinVersion
    };
  }

  runCommand(args, options = {}) {
    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : this.timeoutMs;
    const requestId = options.requestId || null;
    const startedAt = Date.now();
    const finalArgs = [...this.commandPrefixArgs, ...this.binArgs, ...(Array.isArray(args) ? args : [])];

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timeoutHit = false;

      const child = this.spawnFn(this.command, finalArgs, {
        cwd: options.cwd || this.cwd,
        env: this.env,
        shell: false,
        windowsHide: true
      });

      const timer = setTimeout(() => {
        timeoutHit = true;
        child.kill('SIGKILL');
      }, timeoutMs);

      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });

      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        const result = {
          ok: false,
          code: null,
          signal: null,
          stdout,
          stderr: stderr || error.message,
          timeoutHit,
          durationMs: Date.now() - startedAt,
          command: this.displayCommand,
          args: finalArgs
        };

        if (!options.skipAudit && this.auditLogger) {
          this.auditLogger.write({
            requestId,
            phase: 'executor',
            command: this.displayCommand,
            args: finalArgs,
            result: 'spawn_error',
            durationMs: result.durationMs,
            stderr: result.stderr
          });
        }

        resolve(result);
      });

      child.on('close', (code, signal) => {
        clearTimeout(timer);

        const durationMs = Date.now() - startedAt;
        const result = {
          ok: code === 0,
          code,
          signal,
          stdout,
          stderr,
          timeoutHit,
          durationMs,
          command: this.displayCommand,
          args: finalArgs
        };

        if (!options.skipAudit && this.auditLogger) {
          this.auditLogger.write({
            requestId,
            phase: 'executor',
            command: this.displayCommand,
            args: finalArgs,
            result: code === 0 ? 'success' : 'failed',
            code,
            durationMs,
            stderr: stderr ? stderr.slice(0, 800) : ''
          });
        }

        resolve(result);
      });
    });
  }
}

module.exports = {
  DingTalkExecutor,
  resolveDwsInvocation
};

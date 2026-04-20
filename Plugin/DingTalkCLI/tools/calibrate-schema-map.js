#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { resolveDwsBin } = require('../lib/env');
const { resolveDwsInvocation } = require('../lib/dingtalk-executor');

function run(invocation, args, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const finalArgs = [...invocation.prefixArgs, ...args];
    const child = spawn(invocation.command, finalArgs, { shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    let timeout = false;
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
      resolve({ code: null, stdout, stderr: stderr || error.message, timeout });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timeout });
    });
  });
}

function parseSubcommands(helpText) {
  const lines = String(helpText || '').split(/\r?\n/);
  const result = [];
  let inAvailable = false;

  for (const line of lines) {
    if (/^Available Commands:/i.test(line.trim())) {
      inAvailable = true;
      continue;
    }

    if (inAvailable && /^Flags:/i.test(line.trim())) {
      break;
    }

    if (!inAvailable) {
      continue;
    }

    const match = line.match(/^\s{2,}([a-z0-9_-]+)\s+/i);
    if (match) {
      result.push(match[1]);
    }
  }

  return result;
}

function pickByHints(commands, hints, fallback) {
  const first = commands.find((cmd) => hints.some((h) => cmd.includes(h)));
  return first || fallback || commands[0] || '';
}

async function main() {
  const pluginBase = path.resolve(__dirname, '..');
  const mapPath = path.join(pluginBase, 'state', 'capability-map.generated.json');
  const invocation = resolveDwsInvocation(resolveDwsBin(process.env.DWS_BIN || 'dws'));

  const top = await run(invocation, ['--help']);
  if (top.code !== 0) {
    throw new Error(`dws --help failed: ${top.stderr}`);
  }

  const services = [];
  for (const line of String(top.stdout).split(/\r?\n/)) {
    const match = line.match(/^\s{2}([a-z0-9_-]+)\s+/i);
    if (match) {
      services.push(match[1]);
    }
  }

  const targetServices = ['aitable', 'calendar', 'chat', 'ding', 'contact', 'todo', 'report', 'attendance', 'devdoc', 'workbench'];
  const map = {};

  for (const service of targetServices) {
    if (!services.includes(service)) {
      continue;
    }

    const help = await run(invocation, [service, '--help']);
    const l1 = parseSubcommands(help.stdout);

    let queryPath = service;
    let writePath = service;

    if (l1.length > 0) {
      const queryL1 = pickByHints(l1, ['list', 'search', 'get', 'query', 'summary'], l1[0]);
      const writeL1 = pickByHints(l1, ['create', 'send', 'message', 'record', 'task', 'event'], l1[0]);

      const queryHelp = await run(invocation, [service, queryL1, '--help']);
      const writeHelp = await run(invocation, [service, writeL1, '--help']);
      const q2 = parseSubcommands(queryHelp.stdout);
      const w2 = parseSubcommands(writeHelp.stdout);

      const queryL2 = pickByHints(q2, ['list', 'query', 'search', 'get', 'summary'], '');
      const writeL2 = pickByHints(w2, ['create', 'send', 'update'], '');

      queryPath = [queryL1, queryL2].filter(Boolean).join(' ');
      writePath = [writeL1, writeL2].filter(Boolean).join(' ');
    }

    map[service] = {
      query: queryPath,
      write: writePath
    };
  }

  fs.writeFileSync(mapPath, JSON.stringify(map, null, 2), 'utf8');
  process.stdout.write(`generated capability map: ${mapPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});

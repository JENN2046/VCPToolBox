#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { DingTalkCLIRuntime } = require('../lib/runtime');

function nowIso() {
  return new Date().toISOString();
}

function stamp() {
  return nowIso().replace(/[:.]/g, '-');
}

function loadCapabilityMap(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function runScenario(runtime, product, tool, scenario, args) {
  const req = {
    action: 'execute_tool',
    product,
    tool,
    args: args || {},
    apply: scenario === 'write_apply',
    dry_run: scenario !== 'write_apply',
    yes: scenario !== 'query',
    format: 'json'
  };

  const started = Date.now();
  const response = await runtime.handleRequest(req);
  return {
    scenario,
    request: req,
    status: response.status,
    durationMs: Date.now() - started,
    result: response.status === 'success' ? response.result : null,
    error: response.status === 'error' ? response.error : null
  };
}

async function main() {
  const pluginBase = path.resolve(__dirname, '..');
  const mapPath = path.join(pluginBase, 'state', 'capability-map.json');
  const reportDir = path.resolve(pluginBase, '..', '..', 'docs', 'dingtalk-cli', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });

  const runtime = new DingTalkCLIRuntime({ basePath: pluginBase });
  const capabilityMap = loadCapabilityMap(mapPath);

  const products = Object.keys(capabilityMap);
  const matrix = {
    generatedAt: nowIso(),
    products: []
  };

  for (const product of products) {
    const config = capabilityMap[product] || {};
    const queryTool = config.query || 'query';
    const writeTool = config.write || 'create';

    const row = {
      product,
      queryTool,
      writeTool,
      scenarios: []
    };

    row.scenarios.push(await runScenario(runtime, product, queryTool, 'query', config.queryArgs || {}));
    row.scenarios.push(await runScenario(runtime, product, writeTool, 'write_dry_run', config.writeArgs || {}));
    row.scenarios.push(await runScenario(runtime, product, writeTool, 'write_apply', config.writeArgs || {}));

    matrix.products.push(row);
  }

  const file = path.join(reportDir, `capability-matrix-${stamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(matrix, null, 2), 'utf8');
  fs.writeFileSync(path.join(reportDir, 'capability-matrix-latest.json'), JSON.stringify(matrix, null, 2), 'utf8');

  const summary = [];
  summary.push(`# DWS Capability Matrix (${matrix.generatedAt})`);
  summary.push('');
  for (const row of matrix.products) {
    const statuses = row.scenarios.map((item) => `${item.scenario}:${item.status}`).join(', ');
    summary.push(`- ${row.product}: ${statuses}`);
  }
  fs.writeFileSync(path.join(reportDir, 'capability-matrix-latest.md'), `${summary.join('\n')}\n`, 'utf8');

  process.stdout.write(`capability matrix generated: ${file}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
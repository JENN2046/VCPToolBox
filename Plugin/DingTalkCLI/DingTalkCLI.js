#!/usr/bin/env node
'use strict';

const path = require('path');
const { DingTalkCLIRuntime } = require('./lib/runtime');

async function readStdinJson() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('error', (error) => reject(error));
    process.stdin.on('end', () => {
      if (!input || !input.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(input));
      } catch (error) {
        reject(new Error(`invalid json input: ${error.message}`));
      }
    });
  });
}

async function main() {
  const runtime = new DingTalkCLIRuntime({
    basePath: __dirname
  });

  try {
    const request = await readStdinJson();
    const response = await runtime.handleRequest(request);
    process.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({
        status: 'error',
        error: {
          category: 'validation',
          reason: error.message,
          hint: 'provide valid JSON request input',
          actions: ['fix_request']
        }
      })}\n`
    );
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
  DingTalkCLIRuntime
};
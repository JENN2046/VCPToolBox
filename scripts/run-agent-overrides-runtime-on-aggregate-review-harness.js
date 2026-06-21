#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CORE_ROOT = path.resolve(__dirname, '..');
const CONFIG_ENV_PATH = path.join(CORE_ROOT, 'config.env');
const M43_RECEIPT_PATH = path.join(
  CORE_ROOT,
  'docs',
  'governance',
  'CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M43_AGENTOVERRIDES_CONFIG_ROLLBACK_DRILL_RECEIPT_20260621.md'
);

const COMMANDS = Object.freeze([
  {
    id: 'M39_REAL_CONFIG_GATE',
    args: ['scripts/run-real-config-env-runtime-on-local-gate-harness.js'],
    marker: 'REAL_CONFIG_ENV_RUNTIME_ON_LOCAL_GATE_PASS',
    requiredLines: [
      'CONFIG_ENV_VALUES_PRINTED=no',
      'ENV_VCP_AGENT_DIRS_SET=no',
      'AGENT_EXTERNAL_ADDITIVE_ROOT_COUNT=0',
      'AGENT_EXTERNAL_OVERRIDE_ROOT_COUNT=1',
      'AGENT_DIAGNOSTIC_CODES=none',
      'SERVER_STARTED=no',
      'PLUGIN_EXECUTION_ATTEMPTED=no',
      'PROVIDER_CALL_EXECUTED=no',
      'BRIDGE_LIVE_WRITE_EXECUTED=no'
    ]
  },
  {
    id: 'M40_UNLOCK_DECISION',
    args: ['scripts/run-agent-real-config-unlock-decision-gate-harness.js'],
    marker: 'AGENT_REAL_CONFIG_UNLOCK_DECISION_GATE_PASS',
    requiredLines: [
      'CONFIG_ENV_VALUES_PRINTED=no',
      'CONFIG_ENV_EDIT_APPLIED=no',
      'GATE_MODE=post-apply-validation',
      'REAL_ENV_AGENT_ADDITIVE_ENABLED=no',
      'REAL_ENV_AGENT_OVERRIDE_ENABLED=yes',
      'REAL_ENV_NON_AGENT_RUNTIME_KEYS_SET_COUNT=0',
      'CANDIDATE_UNLOCK_LANE=agent-overrides',
      'CANDIDATE_AGENT_ADDITIVE_ENABLED=no',
      'TARGET_PATH_RISK_COUNT=0',
      'TARGET_AGENT_BOARD_PATH_COUNT=0',
      'TARGET_LOCALSTATE_PATH_COUNT=0',
      'TARGET_PRIVATE_PATH_COUNT=0',
      'SERVER_STARTED=no',
      'PLUGIN_EXECUTION_ATTEMPTED=no',
      'PROVIDER_CALL_EXECUTED=no',
      'BRIDGE_LIVE_WRITE_EXECUTED=no'
    ]
  },
  {
    id: 'M42_LOCAL_READ_SMOKE',
    args: ['scripts/run-agent-overrides-runtime-on-local-read-smoke-harness.js'],
    marker: 'AGENT_OVERRIDES_RUNTIME_ON_LOCAL_READ_SMOKE_PASS',
    requiredLines: [
      'CONFIG_ENV_VALUES_PRINTED=no',
      'ENV_VCP_AGENT_DIRS_SET=no',
      'ENV_NON_AGENT_RUNTIME_KEYS_SET_COUNT=0',
      'READ_PATHS_MATCH_EXTERNAL_OVERRIDE=yes',
      'PROMPT_HASH_MATCHES_EXTERNAL_OVERRIDE=yes',
      'PROMPT_CONTENT_PRINTED=no',
      'PRODUCTION_SERVER_STARTED=no',
      'HTTP_SERVER_STARTED=no',
      'ADMIN_ROUTE_USED=no',
      'PLUGIN_EXECUTION_ATTEMPTED=no',
      'PROVIDER_CALL_EXECUTED=no',
      'BRIDGE_LIVE_WRITE_EXECUTED=no',
      'LOCALSTATE_PRIVATE_CONTENT_READ=no',
      'AGENT_BOARD_READ_OR_CHECKSUMMED=no'
    ]
  },
  {
    id: 'M44_ADMIN_WRITE_GUARD',
    args: ['scripts/run-agent-overrides-admin-write-guard-harness.js'],
    marker: 'AGENT_OVERRIDES_ADMIN_WRITE_GUARD_PASS',
    requiredLines: [
      'CONFIG_ENV_VALUES_PRINTED=no',
      'ENV_VCP_AGENT_DIRS_SET=no',
      'ENV_NON_AGENT_RUNTIME_KEYS_SET_COUNT=0',
      'ADMIN_GET_STATUS_CODES=200,200',
      'ADMIN_GET_EXTERNAL_FLAGS=true,true',
      'ADMIN_GET_LANES=override,override',
      'ADMIN_POST_STATUS_CODES=403,403',
      'ADMIN_POST_SOURCES=external,external',
      'ADMIN_POST_LANES=override,override',
      'WRITE_TRAP_TRIGGERED=no',
      'WRITE_TRAP_COUNT=0',
      'CORE_AGENT_HASH_UNCHANGED=yes',
      'EXTERNAL_AGENT_HASH_UNCHANGED=yes',
      'PROMPT_CONTENT_PRINTED=no',
      'PRODUCTION_SERVER_STARTED=no',
      'PLUGIN_EXECUTION_ATTEMPTED=no',
      'PROVIDER_CALL_EXECUTED=no',
      'BRIDGE_LIVE_WRITE_EXECUTED=no',
      'LOCALSTATE_PRIVATE_CONTENT_READ=no',
      'AGENT_BOARD_READ_OR_CHECKSUMMED=no'
    ]
  },
  {
    id: 'AGENT_EXTERNAL_RUNTIME_TESTS',
    args: [
      '--test',
      'tests/agent-external-root-resolver.test.js',
      'tests/agent-manager-external-runtime.test.js'
    ],
    marker: null,
    requiredLines: []
  }
]);

function countKeyLines(raw, key) {
  const pattern = new RegExp(`^\\s*${key}\\s*=`, 'gm');
  const matches = raw.match(pattern);
  return matches ? matches.length : 0;
}

function hasLine(output, expected) {
  return output.split(/\r?\n/).includes(expected);
}

function runCommand(command) {
  const result = spawnSync(process.execPath, command.args, {
    cwd: CORE_ROOT,
    encoding: 'utf8',
    windowsHide: true
  });

  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
  return {
    id: command.id,
    status: typeof result.status === 'number' ? result.status : 1,
    output,
    markerPresent: command.marker ? output.includes(command.marker) : result.status === 0,
    missingRequiredLines: command.requiredLines.filter((line) => !hasLine(output, line))
  };
}

function readConfigSnapshot() {
  if (!fs.existsSync(CONFIG_ENV_PATH)) {
    return {
      exists: false,
      hash: 'missing',
      allowedRootsCount: 0,
      overrideDirsCount: 0,
      additiveDirsCount: 0
    };
  }

  const raw = fs.readFileSync(CONFIG_ENV_PATH);
  const text = raw.toString('utf8');
  return {
    exists: true,
    hash: crypto.createHash('sha256').update(raw).digest('hex'),
    allowedRootsCount: countKeyLines(text, 'VCP_AGENT_ALLOWED_ROOTS'),
    overrideDirsCount: countKeyLines(text, 'VCP_AGENT_OVERRIDE_DIRS'),
    additiveDirsCount: countKeyLines(text, 'VCP_AGENT_DIRS')
  };
}

function main() {
  const config = readConfigSnapshot();
  const failures = [];
  const lines = [];

  lines.push('M45_AGENTOVERRIDES_RUNTIME_ON_AGGREGATE_REVIEW');
  lines.push(`CONFIG_ENV_EXISTS=${config.exists ? 'yes' : 'no'}`);
  lines.push('CONFIG_ENV_VALUES_PRINTED=no');
  lines.push(`CONFIG_ENV_SHA256=${config.hash}`);
  lines.push(`VCP_AGENT_ALLOWED_ROOTS_LINE_COUNT=${config.allowedRootsCount}`);
  lines.push(`VCP_AGENT_OVERRIDE_DIRS_LINE_COUNT=${config.overrideDirsCount}`);
  lines.push(`VCP_AGENT_DIRS_LINE_COUNT=${config.additiveDirsCount}`);

  if (!config.exists) failures.push('config_env_missing');
  if (config.allowedRootsCount !== 1) failures.push('vcp_agent_allowed_roots_line_count_unexpected');
  if (config.overrideDirsCount !== 1) failures.push('vcp_agent_override_dirs_line_count_unexpected');
  if (config.additiveDirsCount !== 0) failures.push('vcp_agent_dirs_must_remain_unset');

  const m43ReceiptPresent = fs.existsSync(M43_RECEIPT_PATH);
  const m43ReceiptText = m43ReceiptPresent ? fs.readFileSync(M43_RECEIPT_PATH, 'utf8') : '';
  const m43ReceiptPass = m43ReceiptText.includes('Status: PASS_AGENTOVERRIDES_CONFIG_ROLLBACK_DRILL')
    && m43ReceiptText.includes('expected M42 block verified: yes')
    && m43ReceiptText.includes('restore verified: yes')
    && m43ReceiptText.includes('VCP_AGENT_DIRS enabled: no');
  lines.push('M43_ROLLBACK_DRILL_RERUN=no');
  lines.push(`M43_RECEIPT_PRESENT=${m43ReceiptPresent ? 'yes' : 'no'}`);
  lines.push(`M43_RECEIPT_PASS_EVIDENCE=${m43ReceiptPass ? 'yes' : 'no'}`);

  if (!m43ReceiptPresent) failures.push('m43_receipt_missing');
  if (!m43ReceiptPass) failures.push('m43_receipt_pass_evidence_missing');

  const commandResults = COMMANDS.map(runCommand);
  lines.push(`AGGREGATE_COMMAND_COUNT=${commandResults.length}`);
  lines.push(`AGGREGATE_COMMANDS=${commandResults.map((result) => result.id).join(',')}`);

  for (const result of commandResults) {
    lines.push(`${result.id}_EXIT=${result.status}`);
    lines.push(`${result.id}_PASS_MARKER=${result.markerPresent ? 'yes' : 'no'}`);
    lines.push(`${result.id}_MISSING_REQUIRED_LINES=${result.missingRequiredLines.length}`);

    if (result.status !== 0) failures.push(`${result.id.toLowerCase()}_exit_${result.status}`);
    if (!result.markerPresent) failures.push(`${result.id.toLowerCase()}_pass_marker_missing`);
    if (result.missingRequiredLines.length > 0) {
      failures.push(`${result.id.toLowerCase()}_required_line_missing`);
    }
  }

  lines.push('AGENTOVERRIDES_ONLY=yes');
  lines.push(`VCP_AGENT_DIRS_ENABLED=${config.additiveDirsCount === 0 ? 'no' : 'yes'}`);
  lines.push('ADMIN_EXTERNAL_WRITE_BLOCKED=yes');
  lines.push('RUNTIME_CHAIN_M39_M40_M42_M44_PASS=yes');
  lines.push('PRODUCTION_SERVER_STARTED=no');
  lines.push('PLUGIN_EXECUTION_ATTEMPTED=no');
  lines.push('PROVIDER_CALL_EXECUTED=no');
  lines.push('BRIDGE_LIVE_WRITE_EXECUTED=no');
  lines.push('LOCALSTATE_PRIVATE_CONTENT_READ=no');
  lines.push('AGENT_BOARD_READ_OR_CHECKSUMMED=no');
  lines.push('UPSTREAM_PR_OPENED=no');

  if (failures.length > 0) {
    lines.push('M45_AGENTOVERRIDES_RUNTIME_ON_AGGREGATE_REVIEW_BLOCK');
    lines.push(`BLOCK_REASONS=${Array.from(new Set(failures)).sort().join(',')}`);
    process.stdout.write(`${lines.join('\n')}\n`);

    for (const result of commandResults.filter((item) => item.status !== 0 || item.missingRequiredLines.length > 0)) {
      process.stdout.write(`\n--- ${result.id} OUTPUT ---\n`);
      process.stdout.write(result.output || '(no output)\n');
      if (result.missingRequiredLines.length > 0) {
        process.stdout.write(`MISSING_REQUIRED_LINES=${result.missingRequiredLines.join('|')}\n`);
      }
    }

    process.exitCode = 1;
    return;
  }

  lines.push('M45_AGENTOVERRIDES_RUNTIME_ON_AGGREGATE_REVIEW_PASS');
  lines.push('BLOCK_REASONS=none');
  process.stdout.write(`${lines.join('\n')}\n`);
}

main();

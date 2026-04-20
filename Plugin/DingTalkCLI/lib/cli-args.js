'use strict';

function toFlagName(key) {
  return `--${String(key).trim().replace(/_/g, '-')}`;
}

function appendArg(result, key, value) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value === 'boolean') {
    if (value) {
      result.push(toFlagName(key));
    }
    return;
  }

  if (typeof value === 'number' || typeof value === 'string') {
    result.push(toFlagName(key), String(value));
    return;
  }

  result.push(toFlagName(key), JSON.stringify(value));
}

function buildToolCommandArgs(payload) {
  const pathTokens = Array.isArray(payload.toolTokens) && payload.toolTokens.length > 0
    ? payload.toolTokens
    : [String(payload.tool || '').trim()].filter(Boolean);
  const args = [payload.product, ...pathTokens];

  const data = payload.args || {};
  for (const key of Object.keys(data)) {
    if (key === '_positional') {
      continue;
    }
    appendArg(args, key, data[key]);
  }

  if (Array.isArray(data._positional)) {
    for (const token of data._positional) {
      args.push(String(token));
    }
  }

  if (payload.yes) {
    args.push('--yes');
  }

  if (payload.dryRun) {
    args.push('--dry-run');
  }

  if (payload.jq) {
    args.push('--jq', payload.jq);
  }

  if (payload.outputFormat) {
    args.push('--format', payload.outputFormat);
  }

  return args;
}

module.exports = {
  buildToolCommandArgs
};

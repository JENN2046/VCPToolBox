'use strict';

function withDefaults(payload) {
  return {
    category: payload.category || 'system',
    reason: payload.reason || 'unknown error',
    hint: payload.hint || 'check logs for details',
    actions: Array.isArray(payload.actions) ? payload.actions : ['retry'],
    details: payload.details || null
  };
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(String(text || ''));
  } catch (_) {
    return null;
  }
}

function matchByStructuredOutput(commandResult) {
  const parsed = parseJsonSafe(commandResult && commandResult.stdout);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const error = parsed.error && typeof parsed.error === 'object' ? parsed.error : null;
  if (!error) {
    return null;
  }

  return withDefaults({
    category: error.category || 'upstream',
    reason: error.message || error.reason || 'dws returned structured error',
    hint: error.hint || 'inspect dws response payload',
    actions: Array.isArray(error.actions) && error.actions.length > 0 ? error.actions : ['retry'],
    details: {
      code: commandResult.code,
      upstreamCode: Object.prototype.hasOwnProperty.call(error, 'code') ? error.code : null,
      upstreamReason: error.reason || null,
      stderr: String(commandResult.stderr || '').slice(0, 1000),
      stdout: String(commandResult.stdout || '').slice(0, 1000)
    }
  });
}

function mapExitCode(exitCode) {
  const code = Number(exitCode);
  if (code === 0) {
    return null;
  }

  const table = {
    1: { category: 'system', reason: 'dws command failed', hint: 'inspect stderr and command args' },
    2: { category: 'validation', reason: 'invalid command arguments', hint: 'check schema_tool and args payload' },
    3: { category: 'auth', reason: 'authentication failed', hint: 'run auth_login and verify credentials' },
    4: { category: 'authorization', reason: 'permission denied', hint: 'check tenant permissions and scope' },
    5: { category: 'business', reason: 'resource not found', hint: 'verify product/tool and resource ids' },
    6: { category: 'upstream', reason: 'rate limited', hint: 'retry with backoff' },
    7: { category: 'upstream', reason: 'upstream service unavailable', hint: 'retry later or switch to dry-run' },
    124: { category: 'timeout', reason: 'command timeout', hint: 'increase timeout or reduce payload size' }
  };

  return table[code] || {
    category: 'system',
    reason: `dws exited with code ${code}`,
    hint: 'inspect stderr for root cause'
  };
}

function matchByStderr(stderrText) {
  const text = String(stderrText || '').toLowerCase();
  if (!text) {
    return null;
  }

  if (text.includes('timeout')) {
    return withDefaults({
      category: 'timeout',
      reason: 'command timed out',
      hint: 'retry or increase DWS_TIMEOUT_MS',
      actions: ['retry', 'increase_timeout']
    });
  }

  if (text.includes('unauthorized') || text.includes('auth')) {
    return withDefaults({
      category: 'auth',
      reason: 'authentication required or invalid',
      hint: 'run auth_status/auth_login',
      actions: ['auth_login', 'check_credentials']
    });
  }

  if (text.includes('forbidden') || text.includes('permission')) {
    return withDefaults({
      category: 'authorization',
      reason: 'permission denied',
      hint: 'verify workspace scopes and org policy',
      actions: ['check_permission']
    });
  }

  if (text.includes('invalid') || text.includes('unknown option') || text.includes('usage')) {
    return withDefaults({
      category: 'validation',
      reason: 'invalid input or unsupported option',
      hint: 'check schema_tool output and request fields',
      actions: ['schema_tool', 'fix_args']
    });
  }

  if (text.includes('not found')) {
    return withDefaults({
      category: 'business',
      reason: 'target resource not found',
      hint: 'check ids and tenant context',
      actions: ['verify_resource']
    });
  }

  if (text.includes('429') || text.includes('rate')) {
    return withDefaults({
      category: 'upstream',
      reason: 'rate limited by upstream',
      hint: 'retry with exponential backoff',
      actions: ['retry_later']
    });
  }

  return null;
}

function fromCommandResult(commandResult) {
  const stderr = commandResult && commandResult.stderr ? commandResult.stderr : '';
  const stdout = commandResult && commandResult.stdout ? commandResult.stdout : '';

  const byStructured = matchByStructuredOutput(commandResult || {});
  if (byStructured) {
    return byStructured;
  }

  const byStderr = matchByStderr(stderr);
  if (byStderr) {
    byStderr.details = {
      code: commandResult.code,
      stderr: stderr.slice(0, 1000),
      stdout: stdout.slice(0, 1000)
    };
    return byStderr;
  }

  const byCode = mapExitCode(commandResult.code);
  return withDefaults({
    ...byCode,
    details: {
      code: commandResult.code,
      stderr: stderr.slice(0, 1000),
      stdout: stdout.slice(0, 1000)
    }
  });
}

function fromException(error, category = 'system') {
  return withDefaults({
    category,
    reason: error && error.message ? error.message : 'unexpected error',
    hint: 'check plugin logs and request payload',
    actions: ['retry', 'inspect_logs'],
    details: {
      stack: error && error.stack ? String(error.stack).slice(0, 1200) : null
    }
  });
}

function fromValidation(message, hint) {
  return withDefaults({
    category: 'validation',
    reason: message,
    hint: hint || 'check request fields and data types',
    actions: ['fix_request']
  });
}

function fromSecurity(message, hint) {
  return withDefaults({
    category: 'security',
    reason: message,
    hint: hint || 'request blocked by security policy',
    actions: ['adjust_policy', 'fix_request']
  });
}

function fromParse(message, rawOutput) {
  return withDefaults({
    category: 'parse',
    reason: message,
    hint: 'set format=raw or adjust jq expression',
    actions: ['format_raw', 'fix_jq'],
    details: {
      outputPreview: String(rawOutput || '').slice(0, 1000)
    }
  });
}

module.exports = {
  fromCommandResult,
  fromException,
  fromValidation,
  fromSecurity,
  fromParse
};

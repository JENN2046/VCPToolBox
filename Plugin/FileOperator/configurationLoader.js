'use strict';

const DIRECTORY_FIELD = 'ALLOWED_DIRECTORIES';

function configurationError(code) {
  // Never propagate loader exception text, URIs, keys or configuration values.
  const error = new Error(`FileOperator directory configuration error: ${code}`);
  error.code = code;
  return error;
}

// Observation only, not a replacement parser or a stricter dotenv dialect.
// These are the installed dotenv 16.x assignment spans. Unmatched unrelated
// lines stay tolerated; a discarded directory-field declaration is distinguished
// from a genuinely missing field before authorizing its unrestricted default.
function observeParse(source, parsed) {
  const text = source.toString().replace(/\r\n?/g, '\n');
  const assignment = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;
  let cursor = 0, ignored = false, discardedDirectoryField = false;
  function gap(value) {
    for (const line of value.split('\n')) {
      if (!line.trim() || line.trimStart().startsWith('#')) continue;
      ignored = true;
      if (/^\s*(?:export\s+)?ALLOWED_DIRECTORIES(?=\s|:|=|$)/.test(line)) discardedDirectoryField = true;
    }
  }
  for (const match of text.matchAll(assignment)) {
    gap(text.slice(cursor, match.index));
    if (match[1] === DIRECTORY_FIELD && !Object.hasOwn(parsed, DIRECTORY_FIELD)) discardedDirectoryField = true;
    cursor = match.index + match[0].length;
  }
  gap(text.slice(cursor));
  return { ignored, discardedDirectoryField };
}

function loadConfiguration({ configPath, env = process.env, dotenv = require('dotenv') }) {
  const inheritedField = Object.hasOwn(env, DIRECTORY_FIELD);
  const observations = [];
  const parse = dotenv.parse;
  let parseFailed = false;
  try {
    dotenv.parse = function (source) {
      try {
        const parsed = parse.call(this, source);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw configurationError('CONFIG_PARSE_FAILED');
        observations.push(observeParse(source, parsed));
        return parsed;
      } catch (_) {
        parseFailed = true;
        throw configurationError('CONFIG_PARSE_FAILED');
      }
    };
    // Keep the original config() contract: plaintext, inherited-key vault loading,
    // key rotation, no-vault plaintext fallback and no-override precedence.
    const loaded = dotenv.config({ path: configPath, processEnv: env });
    if (!loaded || typeof loaded !== 'object' || loaded.error) {
      throw configurationError(parseFailed ? 'CONFIG_PARSE_FAILED' : 'CONFIG_LOAD_FAILED');
    }
    if (!loaded.parsed || typeof loaded.parsed !== 'object' || Array.isArray(loaded.parsed) || observations.length === 0) {
      throw configurationError('CONFIG_PARSE_FAILED');
    }
    if (!inheritedField && Object.hasOwn(loaded.parsed, DIRECTORY_FIELD) && typeof loaded.parsed[DIRECTORY_FIELD] !== 'string') {
      throw configurationError('INVALID_ALLOWED_DIRECTORIES');
    }
    const fieldPresent = Object.hasOwn(env, DIRECTORY_FIELD);
    if (!fieldPresent && observations.at(-1).discardedDirectoryField) {
      throw configurationError('AMBIGUOUS_DIRECTORY_FIELD');
    }
    return {
      error: null, fieldPresent, fieldValue: fieldPresent ? env[DIRECTORY_FIELD] : undefined,
      fieldSource: inheritedField ? 'inherited' : fieldPresent ? 'loaded' : 'missing_default',
      parsing: observations.some(item => item.ignored) ? 'legacy_tolerant_with_ignored_syntax' : 'legacy_tolerant',
      strictSyntaxValidated: false
    };
  } catch (error) {
    const allowed = new Set(['CONFIG_PARSE_FAILED', 'CONFIG_LOAD_FAILED', 'INVALID_ALLOWED_DIRECTORIES', 'AMBIGUOUS_DIRECTORY_FIELD']);
    const code = parseFailed ? 'CONFIG_PARSE_FAILED' : allowed.has(error?.code) ? error.code :
      ['INVALID_DOTENV_KEY', 'DECRYPTION_FAILED', 'NOT_FOUND_DOTENV_ENVIRONMENT'].includes(error?.code) ? error.code : 'CONFIG_LOAD_FAILED';
    return { error: configurationError(code), fieldPresent: false, parsing: 'failed', strictSyntaxValidated: false };
  } finally {
    dotenv.parse = parse;
  }
}

module.exports = { loadConfiguration };

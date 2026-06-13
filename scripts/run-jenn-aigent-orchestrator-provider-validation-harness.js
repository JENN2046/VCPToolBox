#!/usr/bin/env node
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const STAGE6_ARG = '--stage6-bounded-provider-validation-probe';
const STAGE6_NAME = 'stage6-bounded-provider-validation-probe';
const PASS_CLASSIFICATION = 'BOUNDED_PROVIDER_VALIDATION_PASS';
const BLOCKED_CLASSIFICATION = 'BOUNDED_PROVIDER_VALIDATION_BLOCKED';
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_TIMEOUT_MS = 30000;
const MAX_RESPONSE_BYTES = 16 * 1024;
const PROJECT_ROOT = path.resolve(__dirname, '..');
const AUTHORIZED_EXTERNAL_PLUGIN_PATH = String.raw`A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator`;
const TARGET_EXTERNAL_PLUGIN_PATH = path.resolve(PROJECT_ROOT, '..', 'VCPToolBox-JENN-Extensions', 'Plugin', 'JennAIGentOrchestrator');
const CORE_FALLBACK_PATH = path.join(PROJECT_ROOT, 'Plugin', 'AIGentOrchestrator');

const ENV = Object.freeze({
  providerName: 'AIGENT_ORCHESTRATOR_PROVIDER_NAME',
  endpoint: 'AIGENT_ORCHESTRATOR_PROVIDER_VALIDATION_ENDPOINT',
  credential: 'AIGENT_ORCHESTRATOR_PROVIDER_VALIDATION_CREDENTIAL',
  authScheme: 'AIGENT_ORCHESTRATOR_PROVIDER_VALIDATION_AUTH_SCHEME',
  expectedStatus: 'AIGENT_ORCHESTRATOR_PROVIDER_VALIDATION_EXPECTED_STATUS',
  expectedJsonField: 'AIGENT_ORCHESTRATOR_PROVIDER_VALIDATION_EXPECTED_JSON_FIELD',
  expectedJsonValue: 'AIGENT_ORCHESTRATOR_PROVIDER_VALIDATION_EXPECTED_JSON_VALUE',
  timeoutMs: 'AIGENT_ORCHESTRATOR_PROVIDER_VALIDATION_TIMEOUT_MS'
});

const SECRET_PATTERNS = Object.freeze([
  { name: 'openai_key_prefix', pattern: /sk-[A-Za-z0-9_-]{10,}/ },
  { name: 'google_key_prefix', pattern: /AIza[0-9A-Za-z_-]{20,}/ },
  { name: 'aws_access_key_prefix', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'slack_token_prefix', pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'authorization_header_value', pattern: /^(?:Bearer|Basic)\s+\S{12,}$/i },
  { name: 'jwt_like_value', pattern: /^[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/ },
  { name: 'long_opaque_secret_like_value', pattern: /(?=.*[a-z])(?=.*\d)[A-Za-z0-9._~+/=-]{48,}/ }
]);

const SAFE_STRING_VALUES = new Set([
  STAGE6_NAME,
  PASS_CLASSIFICATION,
  BLOCKED_CLASSIFICATION,
  ...Object.values(ENV),
  'PASS',
  'FAIL',
  'yes',
  'no',
  'not_configured',
  'redacted',
  'json',
  'unknown',
  AUTHORIZED_EXTERNAL_PLUGIN_PATH
]);

function createBaseReceipt() {
  return {
    stage: STAGE6_NAME,
    result: 'FAIL',
    classification: BLOCKED_CLASSIFICATION,
    providerValidationAttempted: false,
    providerConfigured: false,
    providerCredentialPresent: false,
    providerCredentialPrinted: false,
    rawAuthorizationHeaderPrinted: false,
    externalPathResolved: 'no',
    externalPathExactMatch: 'no',
    externalPath: null,
    coreFallback: null,
    coreFallbackFalse: 'no',
    providerEndpointContacted: false,
    providerResponseReceived: false,
    providerAuthAccepted: false,
    providerContractMatched: false,
    imageGenerationAttempted: false,
    imageGenerated: false,
    pluginExecution: false,
    processToolCallInvoked: false,
    executePluginInvoked: false,
    pluginManagerLoadPluginsInvoked: false,
    downstreamDispatch: false,
    localStateWrites: false,
    serverRouteActivation: false,
    runtimeCutover: false,
    providerIdentity: 'not_configured',
    providerConfigSurface: {
      providerNameEnv: ENV.providerName,
      endpointEnv: ENV.endpoint,
      credentialEnv: ENV.credential,
      authSchemeEnv: ENV.authScheme,
      expectedStatusEnv: ENV.expectedStatus,
      expectedJsonFieldEnv: ENV.expectedJsonField,
      expectedJsonValueEnv: ENV.expectedJsonValue,
      timeoutMsEnv: ENV.timeoutMs,
      credentialValueRecorded: false,
      endpointValueRecorded: false,
      rawAuthorizationHeaderRecorded: false,
      responseBodyRecorded: false
    },
    boundedTimeoutMs: DEFAULT_TIMEOUT_MS,
    providerProbe: {
      method: 'GET',
      nonGenerativeProbeOnly: true,
      responseStatusCode: null,
      responseContentType: null,
      responseBytesRead: 0,
      responseBodyRecorded: false,
      expectedStatusCode: 200,
      expectedJsonFieldConfigured: false,
      expectedJsonValueConfigured: false
    },
    blockReasons: []
  };
}

function normalizeComparablePath(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function comparePath(value, expectedValue) {
  const actual = normalizeComparablePath(value);
  const expected = normalizeComparablePath(expectedValue);
  return Boolean(actual && expected && actual === expected);
}

function resolveFreshRealPath(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const realpathSync = fs.realpathSync.native || fs.realpathSync;
    return path.resolve(realpathSync(path.resolve(value)));
  } catch (_error) {
    return null;
  }
}

function proveExternalPluginPath(receipt) {
  const authorizedResolvedPath = path.resolve(AUTHORIZED_EXTERNAL_PLUGIN_PATH);
  const targetResolvedPath = path.resolve(TARGET_EXTERNAL_PLUGIN_PATH);
  const targetRealPath = resolveFreshRealPath(TARGET_EXTERNAL_PLUGIN_PATH);
  const authorizedRealPath = resolveFreshRealPath(AUTHORIZED_EXTERNAL_PLUGIN_PATH);
  const coreFallbackResolvedPath = path.resolve(CORE_FALLBACK_PATH);
  const coreFallbackRealPath = resolveFreshRealPath(CORE_FALLBACK_PATH);

  if (!targetRealPath || !authorizedRealPath) {
    fail(receipt, 'external_path_missing');
    return;
  }

  receipt.externalPathResolved = 'yes';

  const exactExternalPath = comparePath(targetResolvedPath, authorizedResolvedPath)
    && comparePath(targetRealPath, authorizedRealPath);

  if (!exactExternalPath) {
    fail(receipt, 'external_path_exact_match_failed');
    return;
  }

  receipt.externalPathExactMatch = 'yes';
  receipt.externalPath = AUTHORIZED_EXTERNAL_PLUGIN_PATH;

  if (!coreFallbackRealPath) {
    fail(receipt, 'core_fallback_proof_ambiguous');
    return;
  }

  const coreFallback = comparePath(targetResolvedPath, coreFallbackResolvedPath)
    || comparePath(targetRealPath, coreFallbackRealPath)
    || comparePath(authorizedRealPath, coreFallbackRealPath);

  if (coreFallback) {
    fail(receipt, 'core_fallback_true');
    return;
  }

  receipt.coreFallback = false;
  receipt.coreFallbackFalse = 'yes';
}

function fail(receipt, reason) {
  if (!receipt.blockReasons.includes(reason)) {
    receipt.blockReasons.push(reason);
  }
}

function parseTimeoutMs(rawValue) {
  if (!rawValue) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 1000 || parsed > MAX_TIMEOUT_MS) {
    return null;
  }
  return parsed;
}

function parseExpectedStatus(rawValue) {
  if (!rawValue) return 200;
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 100 || parsed > 599) {
    return null;
  }
  return parsed;
}

function redactProviderName(rawValue) {
  if (!rawValue) return 'not_configured';
  const alias = rawValue.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64);
  return alias || 'redacted';
}

function isPlaceholderCredential(value) {
  return /^(?:changeme|change_me|placeholder|example|dummy|test|token|secret|password|api[_-]?key)$/i.test(value);
}

function validateCredentialShape(value) {
  if (typeof value !== 'string') return false;
  if (value.length < 12) return false;
  if (/[\s\x00-\x1f\x7f]/.test(value)) return false;
  if (isPlaceholderCredential(value)) return false;
  return true;
}

function parseProbeUrl(rawValue) {
  try {
    const parsed = new URL(rawValue);
    return parsed;
  } catch (_error) {
    return null;
  }
}

function isUnsafeGenerativePath(url) {
  return /(?:^|[/_-])(?:image|images|generate|generation|generations|render|training|train)(?:$|[/_.-])/i.test(url.pathname);
}

function readConfig(receipt) {
  const providerName = process.env[ENV.providerName] || '';
  const endpoint = process.env[ENV.endpoint] || '';
  const credential = process.env[ENV.credential] || '';
  const authScheme = process.env[ENV.authScheme] || 'Bearer';
  const timeoutMs = parseTimeoutMs(process.env[ENV.timeoutMs]);
  const expectedStatus = parseExpectedStatus(process.env[ENV.expectedStatus]);
  const expectedJsonField = process.env[ENV.expectedJsonField] || '';
  const expectedJsonValue = process.env[ENV.expectedJsonValue] || '';

  receipt.providerIdentity = redactProviderName(providerName);
  receipt.providerCredentialPresent = Boolean(credential);
  receipt.providerProbe.expectedJsonFieldConfigured = Boolean(expectedJsonField);
  receipt.providerProbe.expectedJsonValueConfigured = Boolean(expectedJsonValue);

  if (timeoutMs === null) {
    fail(receipt, 'invalid_timeout_configuration');
    receipt.boundedTimeoutMs = DEFAULT_TIMEOUT_MS;
  } else {
    receipt.boundedTimeoutMs = timeoutMs;
  }

  if (expectedStatus === null) {
    fail(receipt, 'invalid_expected_status_configuration');
    receipt.providerProbe.expectedStatusCode = 200;
  } else {
    receipt.providerProbe.expectedStatusCode = expectedStatus;
  }

  if (!providerName) fail(receipt, 'missing_provider_configuration');
  if (!endpoint) fail(receipt, 'missing_provider_endpoint_configuration');
  if (!credential) fail(receipt, 'missing_provider_credential');
  if (credential && !validateCredentialShape(credential)) fail(receipt, 'malformed_provider_credential');
  if (!/^[A-Za-z][A-Za-z0-9._-]{0,31}$/.test(authScheme)) fail(receipt, 'invalid_auth_scheme_configuration');

  const parsedUrl = endpoint ? parseProbeUrl(endpoint) : null;
  if (endpoint && !parsedUrl) fail(receipt, 'malformed_provider_endpoint_configuration');
  if (parsedUrl && parsedUrl.protocol !== 'https:') fail(receipt, 'non_https_provider_endpoint_blocked');
  if (parsedUrl && isUnsafeGenerativePath(parsedUrl)) fail(receipt, 'generative_provider_endpoint_blocked');

  receipt.providerConfigured = Boolean(providerName && parsedUrl && parsedUrl.protocol === 'https:' && !isUnsafeGenerativePath(parsedUrl));

  return {
    parsedUrl,
    credential,
    authScheme,
    expectedStatus: receipt.providerProbe.expectedStatusCode,
    expectedJsonField,
    expectedJsonValue,
    timeoutMs: receipt.boundedTimeoutMs
  };
}

function requestProviderProbe(config, receipt) {
  return new Promise((resolve) => {
    const transport = config.parsedUrl.protocol === 'https:' ? https : http;
    const requestOptions = {
      protocol: config.parsedUrl.protocol,
      hostname: config.parsedUrl.hostname,
      port: config.parsedUrl.port || undefined,
      path: `${config.parsedUrl.pathname}${config.parsedUrl.search}`,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `${config.authScheme} ${config.credential}`
      }
    };

    let settled = false;
    let timedOut = false;
    receipt.providerEndpointContacted = true;

    const req = transport.request(requestOptions, (res) => {
      receipt.providerResponseReceived = true;
      receipt.providerProbe.responseStatusCode = res.statusCode || null;
      receipt.providerProbe.responseContentType = String(res.headers['content-type'] || 'unknown').split(';')[0].toLowerCase();
      receipt.providerAuthAccepted = Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 300);

      let responseBody = '';
      let bytesRead = 0;

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        bytesRead += Buffer.byteLength(chunk, 'utf8');
        receipt.providerProbe.responseBytesRead = bytesRead;
        if (bytesRead > MAX_RESPONSE_BYTES) {
          fail(receipt, 'provider_response_too_large');
          req.destroy();
          return;
        }
        responseBody += chunk;
      });

      res.on('end', () => {
        if (settled) return;
        settled = true;
        classifyProviderResponse(config, receipt, responseBody);
        resolve();
      });
    });

    req.setTimeout(config.timeoutMs, () => {
      timedOut = true;
      fail(receipt, 'provider_probe_timeout');
      req.destroy();
    });

    req.on('error', (error) => {
      if (settled) return;
      settled = true;
      if (!timedOut) {
        fail(receipt, `provider_endpoint_unavailable:${safeErrorCode(error)}`);
      }
      resolve();
    });

    req.end();
  });
}

function safeErrorCode(error) {
  if (error && typeof error.code === 'string' && /^[A-Z0-9_]+$/.test(error.code)) {
    return error.code;
  }
  return 'UNKNOWN';
}

function classifyProviderResponse(config, receipt, responseBody) {
  const statusCode = receipt.providerProbe.responseStatusCode;
  const contentType = receipt.providerProbe.responseContentType || '';

  if (statusCode === 401 || statusCode === 403) {
    receipt.providerAuthAccepted = false;
    fail(receipt, 'provider_auth_rejected');
  }

  if (statusCode !== config.expectedStatus) {
    fail(receipt, 'provider_status_contract_mismatch');
  }

  if (!contentType.includes('json')) {
    fail(receipt, 'provider_content_type_contract_mismatch');
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(responseBody);
  } catch (_error) {
    fail(receipt, 'provider_json_contract_mismatch');
    return;
  }

  if (config.expectedJsonField) {
    const actualValue = readJsonPath(parsed, config.expectedJsonField);
    if (typeof actualValue === 'undefined') {
      fail(receipt, 'provider_expected_json_field_missing');
      return;
    }
    if (config.expectedJsonValue && String(actualValue) !== config.expectedJsonValue) {
      fail(receipt, 'provider_expected_json_value_mismatch');
      return;
    }
  } else if (!isNonEmptyJsonContract(parsed)) {
    fail(receipt, 'provider_json_contract_empty');
    return;
  }

  receipt.providerContractMatched = receipt.providerAuthAccepted && statusCode === config.expectedStatus;
}

function readJsonPath(value, fieldPath) {
  const parts = fieldPath.split('.').filter(Boolean);
  let current = value;
  for (const part of parts) {
    if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function isNonEmptyJsonContract(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return false;
}

function requiredPassFieldsMet(receipt) {
  return (
    receipt.providerValidationAttempted === true &&
    receipt.externalPathResolved === 'yes' &&
    receipt.externalPathExactMatch === 'yes' &&
    receipt.externalPath === AUTHORIZED_EXTERNAL_PLUGIN_PATH &&
    receipt.coreFallback === false &&
    receipt.coreFallbackFalse === 'yes' &&
    receipt.providerConfigured === true &&
    receipt.providerCredentialPresent === true &&
    receipt.providerCredentialPrinted === false &&
    receipt.rawAuthorizationHeaderPrinted === false &&
    receipt.providerEndpointContacted === true &&
    receipt.providerResponseReceived === true &&
    receipt.providerAuthAccepted === true &&
    receipt.providerContractMatched === true &&
    receipt.imageGenerationAttempted === false &&
    receipt.imageGenerated === false &&
    receipt.pluginExecution === false &&
    receipt.processToolCallInvoked === false &&
    receipt.executePluginInvoked === false &&
    receipt.pluginManagerLoadPluginsInvoked === false &&
    receipt.downstreamDispatch === false &&
    receipt.localStateWrites === false &&
    receipt.serverRouteActivation === false &&
    receipt.runtimeCutover === false
  );
}

function findSecretLikeValues(value, path = '$', findings = []) {
  if (typeof value === 'string') {
    if (!SAFE_STRING_VALUES.has(value)) {
      for (const { name, pattern } of SECRET_PATTERNS) {
        if (pattern.test(value)) {
          findings.push({ path, reason: name });
          break;
        }
      }
    }
    return findings;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => findSecretLikeValues(item, `${path}[${index}]`, findings));
    return findings;
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      findSecretLikeValues(child, `${path}.${key}`, findings);
    }
  }

  return findings;
}

function finalizeReceipt(receipt) {
  const firstFindings = findSecretLikeValues(receipt);
  if (firstFindings.length > 0) {
    receipt.result = 'FAIL';
    receipt.classification = BLOCKED_CLASSIFICATION;
    receipt.providerCredentialPrinted = true;
    receipt.rawAuthorizationHeaderPrinted = true;
    receipt.blockReasons = [
      ...receipt.blockReasons,
      ...firstFindings.map((finding) => `secret_like_output_blocked:${finding.path}:${finding.reason}`)
    ];
  }

  if (receipt.blockReasons.length === 0 && requiredPassFieldsMet(receipt)) {
    receipt.result = 'PASS';
    receipt.classification = PASS_CLASSIFICATION;
  } else {
    receipt.result = 'FAIL';
    receipt.classification = BLOCKED_CLASSIFICATION;
    if (!requiredPassFieldsMet(receipt)) {
      fail(receipt, 'positive_pass_requirements_not_met');
    }
  }

  const secondFindings = findSecretLikeValues(receipt);
  if (secondFindings.length > 0) {
    receipt.result = 'FAIL';
    receipt.classification = BLOCKED_CLASSIFICATION;
    receipt.blockReasons = [
      'secret_like_output_blocked_after_sanitization'
    ];
  }

  return receipt;
}

function printReceipt(receipt) {
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

async function main() {
  const receipt = createBaseReceipt();

  if (process.argv.length !== 3 || process.argv[2] !== STAGE6_ARG) {
    fail(receipt, 'unsupported_or_missing_stage6_flag');
    printReceipt(finalizeReceipt(receipt));
    process.exitCode = 1;
    return;
  }

  receipt.providerValidationAttempted = true;
  proveExternalPluginPath(receipt);
  const config = readConfig(receipt);

  if (receipt.blockReasons.length === 0) {
    await requestProviderProbe(config, receipt);
  }

  const finalReceipt = finalizeReceipt(receipt);
  printReceipt(finalReceipt);
  process.exitCode = finalReceipt.result === 'PASS' ? 0 : 1;
}

main().catch((error) => {
  const receipt = createBaseReceipt();
  receipt.providerValidationAttempted = true;
  fail(receipt, `unexpected_harness_error:${safeErrorCode(error)}`);
  printReceipt(finalizeReceipt(receipt));
  process.exitCode = 1;
});

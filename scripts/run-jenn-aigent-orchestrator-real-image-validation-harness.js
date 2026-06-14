#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');

const STAGE7_ARG = '--stage7-bounded-real-image-generation-validation-probe';
const CONFIRM_ARG = '--confirm-real-image-generation';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_PACKAGE_ROOT = path.resolve(PROJECT_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const LOCAL_STATE_ROOT = path.resolve(PROJECT_ROOT, '..', 'VCPToolBox-JENN-LocalState');
const AUTHORIZED_EXTERNAL_PLUGIN_PATH = String.raw`A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator`;
const TARGET_EXTERNAL_PLUGIN_PATH = path.resolve(EXTERNAL_PACKAGE_ROOT, 'Plugin', 'JennAIGentOrchestrator');
const CORE_FALLBACK_PATH = path.join(PROJECT_ROOT, 'Plugin', 'AIGentOrchestrator');
const PROOF_DIR = path.join(os.tmpdir(), 'vcp-gate82-real-image-proof');
const PROOF_ARTIFACT_PATH = path.join(PROOF_DIR, 'gate82-proof-image.png');
const DEFAULT_TIMEOUT_MS = 300000;
const MAX_TIMEOUT_MS = 300000;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;

const ENV = Object.freeze({
  endpoint: 'AIGENT_ORCHESTRATOR_REAL_IMAGE_GENERATION_ENDPOINT',
  credential: 'AIGENT_ORCHESTRATOR_REAL_IMAGE_GENERATION_CREDENTIAL',
  authScheme: 'AIGENT_ORCHESTRATOR_REAL_IMAGE_GENERATION_AUTH_SCHEME',
  model: 'AIGENT_ORCHESTRATOR_REAL_IMAGE_GENERATION_MODEL',
  prompt: 'AIGENT_ORCHESTRATOR_REAL_IMAGE_GENERATION_PROMPT',
  size: 'AIGENT_ORCHESTRATOR_REAL_IMAGE_GENERATION_SIZE',
  timeoutMs: 'AIGENT_ORCHESTRATOR_REAL_IMAGE_GENERATION_TIMEOUT_MS'
});

const APPROVED_FIELDS = Object.freeze([
  'result',
  'external path resolved',
  'external path exact match',
  'external path',
  'core fallback false',
  'pre-provider guard category',
  'provider endpoint contact',
  'provider response received',
  'provider status category',
  'provider auth accepted',
  'provider contract matched',
  'real image generation invoked',
  'image output produced',
  'image output artifact path',
  'image output artifact retained',
  'image output integrity check',
  'credential value printed',
  'token value printed',
  'raw authorization header printed',
  'secret-like value printed',
  'raw provider response printed',
  'request body printed',
  'raw image bytes printed',
  'base64 image data printed',
  'processToolCall',
  'executePlugin',
  'tool handler execution',
  'bounded image handler execution',
  'downstream dispatch',
  'downstream isolated',
  'LocalState write',
  'server route activation',
  'runtime cutover'
]);

function createProjection() {
  return {
    result: 'BLOCKED',
    'external path resolved': 'no',
    'external path exact match': 'no',
    'external path': AUTHORIZED_EXTERNAL_PLUGIN_PATH,
    'core fallback false': 'no',
    'pre-provider guard category': 'not reached',
    'provider endpoint contact': 'no',
    'provider response received': 'no',
    'provider status category': 'not reached',
    'provider auth accepted': 'no',
    'provider contract matched': 'no',
    'real image generation invoked': 'no',
    'image output produced': 'no',
    'image output artifact path': 'no',
    'image output artifact retained': 'no',
    'image output integrity check': 'BLOCKED',
    'credential value printed': 'no',
    'token value printed': 'no',
    'raw authorization header printed': 'no',
    'secret-like value printed': 'no',
    'raw provider response printed': 'no',
    'request body printed': 'no',
    'raw image bytes printed': 'no',
    'base64 image data printed': 'no',
    processToolCall: 'no',
    executePlugin: 'no',
    'tool handler execution': 'no',
    'bounded image handler execution': 'no',
    'downstream dispatch': 'no',
    'downstream isolated': 'PASS',
    'LocalState write': 'no',
    'server route activation': 'no',
    'runtime cutover': 'no'
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

function isPathInsideOrEqual(candidatePath, parentPath) {
  const candidate = normalizeComparablePath(candidatePath);
  const parent = normalizeComparablePath(parentPath);
  if (!candidate || !parent) return false;
  if (candidate === parent) return true;
  const relativePath = path.relative(parent, candidate);
  return Boolean(relativePath) && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

function proveExternalPath(projection) {
  const targetResolvedPath = path.resolve(TARGET_EXTERNAL_PLUGIN_PATH);
  const authorizedResolvedPath = path.resolve(AUTHORIZED_EXTERNAL_PLUGIN_PATH);
  const targetRealPath = resolveFreshRealPath(TARGET_EXTERNAL_PLUGIN_PATH);
  const authorizedRealPath = resolveFreshRealPath(AUTHORIZED_EXTERNAL_PLUGIN_PATH);
  const coreFallbackResolvedPath = path.resolve(CORE_FALLBACK_PATH);
  const coreFallbackRealPath = resolveFreshRealPath(CORE_FALLBACK_PATH);

  if (!targetRealPath || !authorizedRealPath) return false;

  projection['external path resolved'] = 'yes';

  const exactExternalPath = comparePath(targetResolvedPath, authorizedResolvedPath)
    && comparePath(targetRealPath, authorizedRealPath);
  if (!exactExternalPath) return false;

  projection['external path exact match'] = 'yes';
  projection['external path'] = AUTHORIZED_EXTERNAL_PLUGIN_PATH;

  if (!coreFallbackRealPath) return false;

  const coreFallback = comparePath(targetResolvedPath, coreFallbackResolvedPath)
    || comparePath(targetRealPath, coreFallbackRealPath)
    || comparePath(authorizedRealPath, coreFallbackRealPath);
  if (coreFallback) return false;

  projection['core fallback false'] = 'yes';
  return true;
}

function proveExternalImageSurface() {
  const manifestPath = path.join(TARGET_EXTERNAL_PLUGIN_PATH, 'plugin-manifest.json');
  const sourcePath = path.join(TARGET_EXTERNAL_PLUGIN_PATH, 'AIGentOrchestrator.js');
  const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw);
  const commands = manifest?.capabilities?.invocationCommands || [];
  const hasPlanImagePipeline = commands.some((item) => item?.commandIdentifier === 'PlanImagePipeline');
  const source = fs.readFileSync(sourcePath, 'utf8');
  return manifest?.name === 'JennAIGentOrchestrator'
    && hasPlanImagePipeline
    && source.includes('PlanImagePipeline');
}

function parseTimeoutMs(rawValue) {
  if (!rawValue) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 1000 || parsed > MAX_TIMEOUT_MS) return null;
  return parsed;
}

function validateCredentialShape(value) {
  return typeof value === 'string'
    && value.length >= 12
    && !/[\s\x00-\x1f\x7f]/.test(value)
    && !/^(?:changeme|change_me|placeholder|example|dummy|test|token|secret|password|api[_-]?key)$/i.test(value);
}

function validateSizeShape(value) {
  return /^(?:2K|4K|2048x2048|2304x1728|1728x2304|2560x1440|1440x2560|2496x1664|1664x2496|3024x1296)$/.test(value);
}

function parseGenerationConfig() {
  const endpoint = process.env[ENV.endpoint] || '';
  const credential = process.env[ENV.credential] || '';
  const authScheme = process.env[ENV.authScheme] || 'Bearer';
  const model = process.env[ENV.model] || 'gpt-image-2';
  const prompt = process.env[ENV.prompt] || 'bounded real image generation validation probe';
  const size = process.env[ENV.size] || '1024x1024';
  const timeoutMs = parseTimeoutMs(process.env[ENV.timeoutMs]);

  if (!endpoint || !credential || timeoutMs === null) return null;
  if (!validateCredentialShape(credential)) return null;
  if (!/^[A-Za-z][A-Za-z0-9._-]{0,31}$/.test(authScheme)) return null;
  if (!/^[A-Za-z0-9._:-]{1,96}$/.test(model)) return null;
  if (!validateSizeShape(size)) return null;
  if (prompt.length < 8 || prompt.length > 1000) return null;

  let parsedUrl;
  try {
    parsedUrl = new URL(endpoint);
  } catch (_error) {
    return null;
  }
  if (parsedUrl.protocol !== 'https:') return null;

  return { parsedUrl, credential, authScheme, model, prompt, size, timeoutMs };
}

function requestProvider(config, projection) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: config.model,
      prompt: config.prompt,
      size: config.size,
      sequential_image_generation: 'disabled',
      stream: false,
      response_format: 'b64_json',
      watermark: false
    });
    const options = {
      protocol: config.parsedUrl.protocol,
      hostname: config.parsedUrl.hostname,
      port: config.parsedUrl.port || undefined,
      path: `${config.parsedUrl.pathname}${config.parsedUrl.search}`,
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `${config.authScheme} ${config.credential}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    let settled = false;
    let timedOut = false;
    let responseText = '';
    let responseBytes = 0;
    projection['provider endpoint contact'] = 'yes';
    projection['real image generation invoked'] = 'yes';

    const req = https.request(options, (res) => {
      projection['provider response received'] = 'yes';
      projection['provider status category'] = classifyProviderStatusCategory(res.statusCode || 0);
      projection['provider auth accepted'] = res.statusCode && res.statusCode >= 200 && res.statusCode < 300 ? 'yes' : 'no';

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        responseBytes += Buffer.byteLength(chunk, 'utf8');
        if (responseBytes > MAX_RESPONSE_BYTES) {
          req.destroy();
          return;
        }
        responseText += chunk;
      });

      res.on('end', () => {
        if (settled) return;
        settled = true;
        resolve({ statusCode: res.statusCode || 0, responseText });
      });
    });

    req.setTimeout(config.timeoutMs, () => {
      timedOut = true;
      req.destroy();
    });

    req.on('error', () => {
      if (settled) return;
      settled = true;
      projection['provider status category'] = timedOut ? 'timeout' : 'network_error';
      resolve({ statusCode: 0, responseText: '', timedOut });
    });

    req.end(body);
  });
}

function classifyProviderStatusCategory(statusCode) {
  if (statusCode === 401) return '401';
  if (statusCode === 403) return '403';
  if (statusCode === 404) return '404';
  if (statusCode === 429) return '429';
  if (statusCode === 400) return '400';
  if (statusCode >= 500 && statusCode <= 599) return '5xx';
  return 'unknown';
}

function extractImageBuffer(parsedResponse) {
  const first = Array.isArray(parsedResponse?.data) ? parsedResponse.data[0] : null;
  if (!first || typeof first !== 'object') return null;

  if (typeof first.b64_json === 'string' && first.b64_json.length > 0) {
    const buffer = Buffer.from(first.b64_json, 'base64');
    return buffer.length > 0 ? buffer : null;
  }

  if (typeof first.data_uri === 'string') {
    const match = first.data_uri.match(/^data:image\/[A-Za-z0-9.+-]+;base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (!match) return null;
    const buffer = Buffer.from(match[1], 'base64');
    return buffer.length > 0 ? buffer : null;
  }

  return null;
}

function hasImageMagic(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) return false;
  const png = buffer[0] === 0x89 && buffer.slice(1, 4).toString('ascii') === 'PNG';
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const gif = buffer.slice(0, 6).toString('ascii') === 'GIF87a'
    || buffer.slice(0, 6).toString('ascii') === 'GIF89a';
  const webp = buffer.slice(0, 4).toString('ascii') === 'RIFF'
    && buffer.slice(8, 12).toString('ascii') === 'WEBP';
  return png || jpeg || gif || webp;
}

function writeAndVerifyTemporaryArtifact(buffer, projection) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return false;
  if (!hasImageMagic(buffer)) return false;

  const artifactPath = path.resolve(PROOF_ARTIFACT_PATH);
  if (
    isPathInsideOrEqual(artifactPath, PROJECT_ROOT)
    || isPathInsideOrEqual(artifactPath, EXTERNAL_PACKAGE_ROOT)
    || isPathInsideOrEqual(artifactPath, LOCAL_STATE_ROOT)
  ) {
    return false;
  }

  fs.mkdirSync(PROOF_DIR, { recursive: true });
  fs.writeFileSync(artifactPath, buffer);
  const stats = fs.statSync(artifactPath);
  if (!stats.isFile() || stats.size <= 0) return false;
  fs.unlinkSync(artifactPath);

  projection['image output produced'] = 'yes';
  projection['image output artifact path'] = artifactPath;
  projection['image output artifact retained'] = 'no';
  projection['image output integrity check'] = 'PASS';
  return true;
}

async function runConfirmedProbe(projection) {
  if (!proveExternalPath(projection)) return projection;
  if (!proveExternalImageSurface()) {
    projection['pre-provider guard category'] = 'external image surface guard';
    return projection;
  }

  const config = parseGenerationConfig();
  if (!config) {
    projection['pre-provider guard category'] = 'generation config validation guard';
    return projection;
  }

  const response = await requestProvider(config, projection);
  if (response.statusCode < 200 || response.statusCode >= 300) return projection;

  let parsedResponse;
  try {
    parsedResponse = JSON.parse(response.responseText);
  } catch (_error) {
    return projection;
  }

  const imageBuffer = extractImageBuffer(parsedResponse);
  if (!imageBuffer) return projection;

  projection['provider contract matched'] = 'yes';
  if (!writeAndVerifyTemporaryArtifact(imageBuffer, projection)) return projection;

  projection.result = requiredPassFieldsMet(projection) ? 'PASS' : 'FAIL';
  return projection;
}

function requiredPassFieldsMet(projection) {
  return projection['external path resolved'] === 'yes'
    && projection['external path exact match'] === 'yes'
    && projection['external path'] === AUTHORIZED_EXTERNAL_PLUGIN_PATH
    && projection['core fallback false'] === 'yes'
    && projection['provider endpoint contact'] === 'yes'
    && projection['provider response received'] === 'yes'
    && projection['provider auth accepted'] === 'yes'
    && projection['provider contract matched'] === 'yes'
    && projection['real image generation invoked'] === 'yes'
    && projection['image output produced'] === 'yes'
    && projection['image output integrity check'] === 'PASS'
    && projection['credential value printed'] === 'no'
    && projection['token value printed'] === 'no'
    && projection['raw authorization header printed'] === 'no'
    && projection['secret-like value printed'] === 'no'
    && projection['raw provider response printed'] === 'no'
    && projection['request body printed'] === 'no'
    && projection['raw image bytes printed'] === 'no'
    && projection['base64 image data printed'] === 'no'
    && projection.processToolCall === 'no'
    && projection.executePlugin === 'no'
    && projection['LocalState write'] === 'no'
    && projection['server route activation'] === 'no'
    && projection['runtime cutover'] === 'no';
}

function projectionHasOnlyApprovedFields(projection) {
  const keys = Object.keys(projection);
  return keys.length === APPROVED_FIELDS.length
    && APPROVED_FIELDS.every((field) => Object.prototype.hasOwnProperty.call(projection, field));
}

function projectionHasOnlyApprovedValues(projection) {
  const approvedValues = new Set([
    'yes',
    'no',
    'PASS',
    'FAIL',
    'BLOCKED',
    'false',
    'not reached',
    'external image surface guard',
    'generation config validation guard',
    'unknown',
    '401',
    '403',
    '404',
    '429',
    '400',
    '5xx',
    'timeout',
    'network_error',
    AUTHORIZED_EXTERNAL_PLUGIN_PATH
  ]);

  for (const [key, value] of Object.entries(projection)) {
    if (approvedValues.has(value)) continue;
    if (key === 'image output artifact path') {
      const normalized = normalizeComparablePath(value);
      if (
        typeof value === 'string'
        && normalized
        && !isPathInsideOrEqual(value, PROJECT_ROOT)
        && !isPathInsideOrEqual(value, EXTERNAL_PACKAGE_ROOT)
        && !isPathInsideOrEqual(value, LOCAL_STATE_ROOT)
      ) {
        continue;
      }
    }
    return false;
  }
  return true;
}

function normalizeSanitizedProjection(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  if (!projectionHasOnlyApprovedFields(candidate)) return null;
  if (!projectionHasOnlyApprovedValues(candidate)) return null;
  return candidate;
}

function parseSanitizedJsonProjection(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) return null;
  try {
    return normalizeSanitizedProjection(JSON.parse(rawText));
  } catch (_error) {
    return null;
  }
}

function parseSanitizedKeyValueProjection(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) return null;

  const projection = {};
  const approvedFieldSet = new Set(APPROVED_FIELDS);
  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) return null;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!approvedFieldSet.has(key)) return null;
    projection[key] = value;
  }

  return normalizeSanitizedProjection(projection);
}

function parseSanitizedProjection(rawText) {
  return parseSanitizedJsonProjection(rawText) || parseSanitizedKeyValueProjection(rawText);
}

function formatSanitizedKeyValueProjection(projection) {
  const sanitizedProjection = normalizeSanitizedProjection(projection);
  if (!sanitizedProjection) return null;
  return APPROVED_FIELDS
    .map((field) => `${field}: ${sanitizedProjection[field]}`)
    .join('\n');
}

function finalizeProjection(projection) {
  if (!projectionHasOnlyApprovedFields(projection) || !projectionHasOnlyApprovedValues(projection)) {
    const blocked = createProjection();
    blocked['secret-like value printed'] = 'yes';
    return blocked;
  }

  if (projection.result === 'BLOCKED') return projection;
  projection.result = requiredPassFieldsMet(projection) ? 'PASS' : 'FAIL';
  return projection;
}

function printProjection(projection) {
  const parsedProjection = parseSanitizedProjection(JSON.stringify(projection, null, 2));
  const safeProjection = parsedProjection || (() => {
    const blocked = createProjection();
    blocked['secret-like value printed'] = 'yes';
    return blocked;
  })();
  const keyValueProjection = formatSanitizedKeyValueProjection(safeProjection);

  process.stdout.write(`${JSON.stringify(safeProjection, null, 2)}\n`);
  if (keyValueProjection) {
    process.stdout.write(`${keyValueProjection}\n`);
  }
}

async function main() {
  const projection = createProjection();
  const hasStage7Arg = process.argv.includes(STAGE7_ARG);
  const hasConfirmArg = process.argv.includes(CONFIRM_ARG);
  const argsAreExact = process.argv.length === 4 && hasStage7Arg && hasConfirmArg;

  if (!argsAreExact) {
    printProjection(finalizeProjection(projection));
    process.exitCode = 1;
    return;
  }

  const finalProjection = finalizeProjection(await runConfirmedProbe(projection));
  printProjection(finalProjection);
  process.exitCode = finalProjection.result === 'PASS' ? 0 : 1;
}

main().catch(() => {
  printProjection(finalizeProjection(createProjection()));
  process.exitCode = 1;
});

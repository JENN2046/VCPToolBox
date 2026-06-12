#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const coreRoot = path.resolve(__dirname, '..');
const externalRoot = process.env.JENN_EXTENSIONS_ROOT
  ? path.resolve(process.env.JENN_EXTENSIONS_ROOT)
  : path.resolve(coreRoot, '..', 'VCPToolBox-JENN-Extensions');

const pairs = {
  source: {
    core: 'Plugin/AIGentOrchestrator/AIGentOrchestrator.js',
    external: 'Plugin/JennAIGentOrchestrator/AIGentOrchestrator.js',
  },
  config: {
    core: 'Plugin/AIGentOrchestrator/config.env.example',
    external: 'Plugin/JennAIGentOrchestrator/config.env.example',
  },
  manifest: {
    core: 'Plugin/AIGentOrchestrator/plugin-manifest.json',
    external: 'Plugin/JennAIGentOrchestrator/plugin-manifest.json',
  },
  readme: {
    core: 'Plugin/AIGentOrchestrator/README.md',
    external: 'Plugin/JennAIGentOrchestrator/README.md',
  },
};

const failures = [];

function resolveCore(relativePath) {
  return path.join(coreRoot, relativePath);
}

function resolveExternal(relativePath) {
  return path.join(externalRoot, relativePath);
}

function readBuffer(filePath, label) {
  try {
    return fs.readFileSync(filePath);
  } catch (error) {
    failures.push(`${label} missing or unreadable: ${filePath}`);
    return null;
  }
}

function readJson(filePath, label) {
  const buffer = readBuffer(filePath, label);
  if (!buffer) {
    return null;
  }
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    failures.push(`${label} invalid JSON: ${filePath}`);
    return null;
  }
}

function buffersEqual(coreRelativePath, externalRelativePath, label) {
  const corePath = resolveCore(coreRelativePath);
  const externalPath = resolveExternal(externalRelativePath);
  const coreBuffer = readBuffer(corePath, `${label} core`);
  const externalBuffer = readBuffer(externalPath, `${label} external`);
  const ok = Boolean(coreBuffer && externalBuffer && Buffer.compare(coreBuffer, externalBuffer) === 0);
  if (!ok) {
    failures.push(`${label} byte-for-byte equality failed`);
  }
  return { ok, corePath, externalPath };
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sortObject(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(sortObject(value));
}

function stripIdentityFields(manifest) {
  const clone = { ...manifest };
  delete clone.name;
  delete clone.description;
  return clone;
}

function checkManifest() {
  const corePath = resolveCore(pairs.manifest.core);
  const externalPath = resolveExternal(pairs.manifest.external);
  const coreManifest = readJson(corePath, 'manifest core');
  const externalManifest = readJson(externalPath, 'manifest external');
  if (!coreManifest || !externalManifest) {
    return { ok: false, corePath, externalPath };
  }

  const requiredIdentityFields = ['name', 'description'];
  for (const field of requiredIdentityFields) {
    if (!Object.prototype.hasOwnProperty.call(coreManifest, field)
      || !Object.prototype.hasOwnProperty.call(externalManifest, field)) {
      failures.push(`manifest schema missing approved identity field: ${field}`);
    }
  }

  const strippedEqual = canonicalJson(stripIdentityFields(coreManifest))
    === canonicalJson(stripIdentityFields(externalManifest));
  if (!strippedEqual) {
    failures.push('manifest differs outside name/description-only manifest divergence');
  }

  const identityText = `${externalManifest.name || ''} ${externalManifest.description || ''}`;
  const externalIdentityOk = identityText.includes('JennAIGentOrchestrator');
  if (!externalIdentityOk) {
    failures.push('external manifest identity does not clearly refer to JennAIGentOrchestrator');
  }

  return {
    ok: strippedEqual && externalIdentityOk,
    corePath,
    externalPath,
  };
}

function normalizeReadme(buffer) {
  return buffer.toString('utf8').replace(/\r\n/g, '\n').replace(/\s+$/u, '');
}

function checkReadme() {
  const corePath = resolveCore(pairs.readme.core);
  const externalPath = resolveExternal(pairs.readme.external);
  const coreBuffer = readBuffer(corePath, 'README core');
  const externalBuffer = readBuffer(externalPath, 'README external');
  if (!coreBuffer || !externalBuffer) {
    return { ok: false, corePath, externalPath };
  }

  const coreReadme = normalizeReadme(coreBuffer);
  const externalReadme = normalizeReadme(externalBuffer);
  const bodyContainedAsSuffix = externalReadme === coreReadme || externalReadme.endsWith(coreReadme);
  if (!bodyContainedAsSuffix) {
    failures.push('README body containment / external preface allowance failed');
  }

  const preface = externalReadme === coreReadme
    ? ''
    : externalReadme.slice(0, externalReadme.length - coreReadme.length).trim();
  const prefaceOk = preface === '' || preface.includes('JennAIGentOrchestrator');
  if (!prefaceOk) {
    failures.push('README external preface does not clearly refer to JennAIGentOrchestrator');
  }

  const identityOk = externalReadme.includes('JennAIGentOrchestrator');
  if (!identityOk) {
    failures.push('external README identity does not clearly refer to JennAIGentOrchestrator');
  }

  return {
    ok: bodyContainedAsSuffix && prefaceOk && identityOk,
    corePath,
    externalPath,
  };
}

const source = buffersEqual(pairs.source.core, pairs.source.external, 'source');
const config = buffersEqual(pairs.config.core, pairs.config.external, 'config');
const manifest = checkManifest();
const readme = checkReadme();

console.log('[jenn-aigent-copy-integrity] receipt');
console.log(`core source path: ${source.corePath}`);
console.log(`external target path: ${source.externalPath}`);
console.log(`source equality result: ${source.ok ? 'PASS' : 'FAIL'}`);
console.log(`config equality result: ${config.ok ? 'PASS' : 'FAIL'}`);
console.log(`manifest allowed divergence result: ${manifest.ok ? 'PASS' : 'FAIL'}`);
console.log(`README preface/body containment result: ${readme.ok ? 'PASS' : 'FAIL'}`);
console.log('provider calls: NO');
console.log('downstream dispatch: NO');
console.log('runtime cutover: NO');
console.log('LocalState writes: NO');

if (failures.length > 0) {
  console.error('[jenn-aigent-copy-integrity] failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[jenn-aigent-copy-integrity] ok');

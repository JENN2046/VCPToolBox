'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { digest } = require('./approvalReceiptAuthority');
const C = require('./humanClientAdmissionCrypto');

const LOCKDOWN = 'TRUSTED_CLIENT_RECOVERY_LOCKDOWN';
const MAX_CLIENTS = 256;
const MAX_BYTES = 4 * 1024 * 1024;
const fail = () => { throw Object.assign(new Error(LOCKDOWN), { code: LOCKDOWN }); };
const inside = (candidate, parent) => candidate === parent || candidate.startsWith(parent + path.sep);
const ownerOk = stat => typeof process.getuid === 'function' && stat.uid === process.getuid();

function directory(directoryPath, testOnly) {
  if (typeof directoryPath !== 'string' || !path.isAbsolute(directoryPath) || fs.realpathSync(directoryPath) !== directoryPath) fail();
  for (let current = directoryPath;; current = path.dirname(current)) {
    if (fs.lstatSync(current).isSymbolicLink()) fail();
    if (!testOnly && fs.existsSync(path.join(current, '.git'))) fail();
    if (current === path.dirname(current)) break;
  }
  const stat = fs.statSync(directoryPath);
  if (!stat.isDirectory()) fail();
  if (!testOnly) {
    // Production authority storage requires POSIX owner/mode evidence. Unsupported
    // platforms fail closed rather than silently weakening the trust boundary.
    if (!ownerOk(stat) || (stat.mode & 0o077)) fail();
  }
  if (testOnly && process.platform !== 'win32' && !inside(directoryPath, '/tmp')) fail();
  if (!testOnly && ['/tmp', '/var/tmp', path.resolve(__dirname, '..'), path.resolve(__dirname, '../..'), process.cwd()].some(root => inside(directoryPath, root))) fail();
  return stat;
}

function read(filePath, testOnly) {
  const fd = fs.openSync(filePath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_BYTES) fail();
    if (!testOnly && (!ownerOk(stat) || (stat.mode & 0o077))) fail();
    return JSON.parse(fs.readFileSync(fd, 'utf8'));
  } finally {
    fs.closeSync(fd);
  }
}

function writeAtomic(filePath, value) {
  const tempPath = `${filePath}.${crypto.randomBytes(16).toString('hex')}`;
  const fd = fs.openSync(tempPath, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify(value));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tempPath, filePath);
  const directoryFd = fs.openSync(path.dirname(filePath), 'r');
  try { fs.fsyncSync(directoryFd); } finally { fs.closeSync(directoryFd); }
}

function commitment(registry) {
  return digest({
    hostAuthorityId: registry.hostAuthorityId,
    epoch: registry.epoch,
    clients: registry.clients,
    version: 1
  });
}

function validatePair(registry, anchor, testOnly, validateRecords = true) {
  if (registry.version !== 1 || anchor.version !== 1
    || !/^[-_A-Za-z0-9]{43}$/u.test(registry.hostAuthorityId)
    || !Number.isSafeInteger(registry.epoch) || registry.epoch < 0
    || !Array.isArray(registry.clients) || registry.clients.length > MAX_CLIENTS) fail();
  if (anchor.hostAuthorityId !== registry.hostAuthorityId
    || anchor.highestCommittedAuthorityEpoch !== registry.epoch
    || anchor.authorityHeadCommitment !== commitment(registry)) fail();
  if (!validateRecords) return;
  const ids = new Set();
  for (const client of registry.clients) {
    if (!client || typeof client.clientEnrollmentId !== 'string' || ids.has(client.clientEnrollmentId)
      || client.surface !== 'vcp_chat'
      || !['ENROLLED', 'REVOKED'].includes(client.enrollmentState)
      || !['UNKNOWN', 'ADMITTED', 'DENIED', 'SUSPENDED'].includes(client.admissionState)
      || client.keyVersion !== 1 || !Number.isSafeInteger(client.createdAt)
      || typeof client.implementationProfileId !== 'string') fail();
    const imported = C.importPublicKey(client.publicKeySpki);
    if (imported.fingerprint !== client.publicKeyFingerprint || imported.publicKeyAlgorithm !== client.publicKeyAlgorithm) fail();
    const allowed = [
      'clientEnrollmentId', 'surface', 'publicKeySpki', 'publicKeyAlgorithm',
      'publicKeyFingerprint', 'keyVersion', 'enrollmentState', 'admissionState',
      'createdAt', 'revokedAt', 'revocationReason', 'implementationProfileId', 'clientLabel'
    ];
    if (Object.keys(client).some(key => !allowed.includes(key))) fail();
    ids.add(client.clientEnrollmentId);
  }
}

class TrustedClientAuthorityStore {
  #locked = false;
  #lastEpoch = -1;
  #lastHead = null;
  #root;
  #anchorRoot;
  #testOnly;

  constructor({ registryRoot, anchorRoot, testOnly = false }) {
    this.#root = registryRoot;
    this.#anchorRoot = anchorRoot;
    this.#testOnly = testOnly === true;
    try {
      const registryStat = directory(registryRoot, this.#testOnly);
      const anchorStat = directory(anchorRoot, this.#testOnly);
      if (inside(registryRoot, anchorRoot) || inside(anchorRoot, registryRoot)) fail();
      if (!this.#testOnly && registryStat.dev === anchorStat.dev) fail();
      this.snapshot();
    } catch (_) {
      this.#locked = true;
      fail();
    }
  }

  get testOnly() { return this.#testOnly; }

  snapshot() {
    if (this.#locked) fail();
    try {
      if (fs.existsSync(path.join(this.#root, 'authority.lock'))) fail();
      const registry = read(path.join(this.#root, 'authority.json'), this.#testOnly);
      const anchor = read(path.join(this.#anchorRoot, 'anchor.json'), this.#testOnly);
      validatePair(registry, anchor, this.#testOnly, this.#lastHead !== anchor.authorityHeadCommitment);
      if (registry.epoch < this.#lastEpoch
        || (registry.epoch === this.#lastEpoch && this.#lastHead !== null && this.#lastHead !== anchor.authorityHeadCommitment)) fail();
      this.#lastEpoch = registry.epoch;
      this.#lastHead = anchor.authorityHeadCommitment;
      return registry;
    } catch (_) {
      this.#locked = true;
      fail();
    }
  }

  get(id) {
    return this.snapshot().clients.find(client => client.clientEnrollmentId === id) || null;
  }

  #commit(change) {
    this.snapshot();
    const lockPath = path.join(this.#root, 'authority.lock');
    let lockFd;
    try { lockFd = fs.openSync(lockPath, 'wx', 0o600); } catch (_) { this.#locked = true; fail(); }
    try {
      const registry = read(path.join(this.#root, 'authority.json'), this.#testOnly);
      const anchor = read(path.join(this.#anchorRoot, 'anchor.json'), this.#testOnly);
      validatePair(registry, anchor, this.#testOnly, this.#lastHead !== anchor.authorityHeadCommitment);
      if (registry.epoch !== this.#lastEpoch || anchor.authorityHeadCommitment !== this.#lastHead) fail();
      const result = change(registry);
      if (!Number.isSafeInteger(registry.epoch + 1)) fail();
      registry.epoch += 1;
      const nextAnchor = {
        version: 1,
        hostAuthorityId: registry.hostAuthorityId,
        highestCommittedAuthorityEpoch: registry.epoch,
        authorityHeadCommitment: commitment(registry)
      };
      validatePair(registry, nextAnchor, this.#testOnly);
      writeAtomic(path.join(this.#root, 'authority.json'), registry);
      writeAtomic(path.join(this.#anchorRoot, 'anchor.json'), nextAnchor);
      this.#lastEpoch = registry.epoch;
      this.#lastHead = nextAnchor.authorityHeadCommitment;
      return result;
    } catch (_) {
      this.#locked = true;
      fail();
    } finally {
      if (lockFd !== undefined) fs.closeSync(lockFd);
      if (!this.#locked && fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
    }
  }

  add(record) {
    const snapshot = this.snapshot();
    if (snapshot.clients.length >= MAX_CLIENTS) throw Object.assign(new Error('CAPACITY_REACHED'), { code: 'CAPACITY_REACHED' });
    if (snapshot.clients.some(client => client.clientEnrollmentId === record.clientEnrollmentId)) fail();
    return this.#commit(registry => {
      registry.clients.push({ ...record });
      return { ...record };
    });
  }

  update(id, fields) {
    if (Object.keys(fields).some(key => !['enrollmentState', 'admissionState', 'revokedAt', 'revocationReason'].includes(key))) fail();
    if (!this.get(id)) throw Object.assign(new Error('SESSION_UNKNOWN'), { code: 'SESSION_UNKNOWN' });
    return this.#commit(registry => {
      const client = registry.clients.find(entry => entry.clientEnrollmentId === id);
      if (client.enrollmentState === 'REVOKED' && fields.enrollmentState === 'ENROLLED') fail();
      Object.assign(client, fields);
      return { ...client };
    });
  }
}

module.exports = { TrustedClientAuthorityStore, MAX_CLIENTS, LOCKDOWN };

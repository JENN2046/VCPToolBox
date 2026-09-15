'use strict';

const crypto = require('node:crypto');
const { canonical } = require('./approvalReceiptAuthority');

const PURPOSES = Object.freeze([
  'enrollment-claim',
  'capability-mint',
  'channel-upgrade',
  'http-request',
  'self-revoke',
  'session-authenticate'
]);

const SMALL_ORDER = new Set([
  '00'.repeat(32),
  '01' + '00'.repeat(31),
  '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05',
  'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a',
  'ec' + 'ff'.repeat(30) + '7f',
  'ed' + 'ff'.repeat(30) + '7f',
  'ee' + 'ff'.repeat(30) + '7f'
]);
const FIELD_MAX = Buffer.from('7f' + 'ff'.repeat(30) + 'ed', 'hex');

const ALGORITHMS = Object.freeze({
  ED25519: 'ED25519',
  P256: 'ECDSA_P256_SHA256'
});
const P256_PREFIX = Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex');
const P256_ORDER = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');

const fail = code => { throw Object.assign(new Error(code), { code }); };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function safePointEncoding(raw) {
  if (raw.length !== 32) return false;
  const y = Buffer.from(raw);
  y[31] &= 0x7f;
  if (SMALL_ORDER.has(y.toString('hex'))) return false;
  return Buffer.compare(Buffer.from(y).reverse(), FIELD_MAX) < 0;
}

function decode(value, size) {
  if (typeof value !== 'string' || !value || value.length > 1024 || !/^[A-Za-z0-9_-]+$/u.test(value)) fail('PROOF_INVALID');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.toString('base64url') !== value || (size !== undefined && bytes.length !== size)) fail('PROOF_INVALID');
  return bytes;
}

function publicKey(value) {
  try {
    const der = decode(value, 44);
    if (!safePointEncoding(der.subarray(12))) fail('INVALID_ENROLLMENT');
    const key = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
    if (key.asymmetricKeyType !== 'ed25519' || !key.export({ format: 'der', type: 'spki' }).equals(der)) fail('INVALID_ENROLLMENT');
    return { key, spki: value, fingerprint: hash(der) };
  } catch (_) {
    fail('INVALID_ENROLLMENT');
  }
}

function transcript(fields) {
  if (fields.protocolVersion !== 1 || !PURPOSES.includes(fields.purpose)) fail('PROOF_INVALID');
  const boundFieldDigest = hash(Buffer.from(canonical(fields), 'utf8'));
  const bytes = Buffer.concat([
    Buffer.from(`VCP-HUMAN-CLIENT\0v1\0${fields.purpose}\0`, 'ascii'),
    Buffer.from(boundFieldDigest, 'hex')
  ]);
  return { bytes, boundFieldDigest, signingInput: bytes.toString('base64url') };
}

function verify(key, bytes, signature) {
  try {
    const sig = decode(signature, 64);
    return safePointEncoding(sig.subarray(0, 32)) && crypto.verify(null, bytes, key, sig);
  } catch (_) {
    return false;
  }
}

function algorithmOf(key) {
  if (key?.asymmetricKeyType === 'ed25519') return ALGORITHMS.ED25519;
  if (key?.asymmetricKeyType === 'ec' && key.asymmetricKeyDetails?.namedCurve === 'prime256v1') return ALGORITHMS.P256;
  fail('INVALID_ENROLLMENT');
}

function importPublicKey(value) {
  try {
    const der = decode(value);
    if (der.length === 44) return { ...publicKey(value), publicKeyAlgorithm: ALGORITHMS.ED25519 };
    if (der.length !== 91 || !der.subarray(0, P256_PREFIX.length).equals(P256_PREFIX) || der[P256_PREFIX.length] !== 4) fail('INVALID_ENROLLMENT');
    const key = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
    if (algorithmOf(key) !== ALGORITHMS.P256 || !key.export({ format: 'der', type: 'spki' }).equals(der)) fail('INVALID_ENROLLMENT');
    const point = der.subarray(P256_PREFIX.length);
    if (!crypto.ECDH.convertKey(point, 'prime256v1', undefined, undefined, 'uncompressed').equals(point)) fail('INVALID_ENROLLMENT');
    return { key, spki: value, fingerprint: hash(der), publicKeyAlgorithm: ALGORITHMS.P256 };
  } catch (_) {
    fail('INVALID_ENROLLMENT');
  }
}

function verifyP256(key, bytes, signature) {
  try {
    if (algorithmOf(key) !== ALGORITHMS.P256) return false;
    const sig = decode(signature, 64);
    const r = BigInt('0x' + sig.subarray(0, 32).toString('hex'));
    const s = BigInt('0x' + sig.subarray(32).toString('hex'));
    if (r < 1n || r >= P256_ORDER || s < 1n || s > P256_ORDER / 2n) return false;
    return crypto.verify('sha256', bytes, { key, dsaEncoding: 'ieee-p1363' }, sig);
  } catch (_) {
    return false;
  }
}

function verifyHumanClientProof({ publicKeyAlgorithm, canonicalPublicKey, signingInput, signature }) {
  try {
    if (algorithmOf(canonicalPublicKey) !== publicKeyAlgorithm) return false;
    if (publicKeyAlgorithm === ALGORITHMS.ED25519) return verify(canonicalPublicKey, signingInput, signature);
    if (publicKeyAlgorithm === ALGORITHMS.P256) return verifyP256(canonicalPublicKey, signingInput, signature);
    return false;
  } catch (_) {
    return false;
  }
}

function origin(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.origin !== value || parsed.username || parsed.password) fail('ADMISSION_DISABLED');
    return parsed.origin;
  } catch (_) {
    fail('ADMISSION_DISABLED');
  }
}

module.exports = {
  ALGORITHMS,
  PURPOSES,
  algorithmOf,
  decode,
  fail,
  hash,
  importPublicKey,
  origin,
  publicKey,
  transcript,
  verify,
  verifyHumanClientProof
};

'use strict';

// Compare locked-source PE rebuilds while ignoring only linker-generated metadata.
const fs = require('node:fs');
const crypto = require('node:crypto');

function normalizedPe(file) {
  const bytes = fs.readFileSync(file);
  const out = Buffer.from(bytes);
  const check = (offset, length) => {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) ||
        offset < 0 || length < 0 || offset + length > out.length) {
      throw new Error('Invalid PE metadata range');
    }
  };
  check(0, 0x40);
  if (out.toString('ascii', 0, 2) !== 'MZ') throw new Error('Missing DOS header');
  const pe = out.readUInt32LE(0x3c);
  check(pe, 24);
  if (out.toString('ascii', pe, pe + 4) !== 'PE\0\0') throw new Error('Missing PE header');
  const sections = out.readUInt16LE(pe + 6);
  const optionalSize = out.readUInt16LE(pe + 20);
  const optional = pe + 24;
  check(optional, optionalSize + sections * 40);
  if (out.readUInt16LE(optional) !== 0x20b || optionalSize < 168 ||
      out.readUInt32LE(optional + 108) < 7 || sections === 0 || sections > 64) {
    throw new Error('Unsupported PE layout');
  }
  const sectionTable = optional + optionalSize;
  function mapRva(rva, length) {
    for (let i = 0; i < sections; i++) {
      const row = sectionTable + i * 40;
      const rawSize = out.readUInt32LE(row + 16);
      const virtualAddress = out.readUInt32LE(row + 12);
      const rawOffset = out.readUInt32LE(row + 20);
      if (rva >= virtualAddress && rva - virtualAddress + length <= rawSize) {
        const offset = rawOffset + rva - virtualAddress;
        check(offset, length);
        return offset;
      }
    }
    throw new Error('Unmapped PE debug directory');
  }
  const debugDir = optional + 112 + 6 * 8;
  if (debugDir + 8 > sectionTable) throw new Error('Missing debug directory');
  const debugRva = out.readUInt32LE(debugDir);
  const debugSize = out.readUInt32LE(debugDir + 4);
  if (!debugRva || !debugSize || debugSize % 28 || debugSize > 28 * 16) {
    throw new Error('Invalid PE debug directory');
  }
  const debug = mapRva(debugRva, debugSize);
  // COFF TimeDateStamp.
  out.fill(0, pe + 8, pe + 12);
  let codeview = 0;
  for (let i = 0; i < debugSize / 28; i++) {
    const row = debug + i * 28;
    out.fill(0, row + 4, row + 8); // IMAGE_DEBUG_DIRECTORY.TimeDateStamp
    if (out.readUInt32LE(row + 12) === 2) {
      const length = out.readUInt32LE(row + 16);
      const data = out.readUInt32LE(row + 24);
      check(data, length);
      if (length < 24 || out.toString('ascii', data, data + 4) !== 'RSDS') {
        throw new Error('Unsupported CodeView record');
      }
      out.fill(0, data + 4, data + 20); // RSDS GUID, not code or PDB path
      codeview++;
    }
  }
  if (codeview !== 1) throw new Error('Expected one CodeView record');
  const digest = value => crypto.createHash('sha256').update(value).digest('hex');
  return { raw: digest(bytes), normalized: digest(out) };
}

const [bundled, rebuilt] = process.argv.slice(2);
if (!bundled || !rebuilt) throw new Error('Usage: node verify-windows-pe.cjs BUNDLED REBUILT');
const first = normalizedPe(bundled);
const second = normalizedPe(rebuilt);
console.log(JSON.stringify({ bundled: first, rebuilt: second }));
if (first.normalized !== second.normalized) process.exitCode = 1;

'use strict';

const fs = require('fs');
const path = require('path');

// Directory validation consumes the selected field only. It neither reads a
// configuration file nor decides whether/how encryption is used.
function createDirectoryPolicy(configuration) {
  if (!configuration || configuration.error) {
    return { directories: null, error: configuration?.error || new Error('FileOperator directory configuration error: CONFIG_LOAD_FAILED'), parsing: 'failed' };
  }
  const value = configuration.fieldPresent ? configuration.fieldValue : '';
  if (typeof value !== 'string' || /[\0\r\n]/.test(value)) {
    return { directories: null, error: new Error('FileOperator directory configuration error: INVALID_ALLOWED_DIRECTORIES'), parsing: configuration.parsing };
  }
  return { directories: value.split(',').map(dir => dir.trim()).filter(Boolean), error: null, parsing: configuration.parsing };
}

function isWithin(target, root, pathApi = path) {
  const relative = pathApi.relative(root, target);
  return relative === '' || (!pathApi.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + pathApi.sep));
}

// New files/directories may not exist yet. Only ENOENT on a genuinely missing
// component permits checking its existing ancestor. Dangling links, EACCES,
// ENOTDIR and realpath errors never fall back to lexical authorization.
function resolveExistingOrNew(target, io = fs, pathApi = path) {
  let current = target;
  const missing = [];
  while (true) {
    let entry;
    try { entry = io.lstatSync(current); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = pathApi.dirname(current);
      if (parent === current) throw error;
      missing.unshift(pathApi.basename(current));
      current = parent;
      continue;
    }
    const real = io.realpathSync(current);
    if (missing.length && !io.statSync(current).isDirectory()) throw new Error('Not a directory');
    // lstat is intentional: an existing dangling symlink must fail realpath.
    if (!entry) throw new Error('Unverified path');
    return pathApi.resolve(real, ...missing);
  }
}

function isPathAllowed(policy, target, { io = fs, pathApi = path } = {}) {
  if (policy.error) throw policy.error;
  if (policy.directories.length === 0) return true;
  try {
    if (typeof target !== 'string' || !target || target.includes('\0')) return false;
    const resolved = pathApi.resolve(target);
    const roots = policy.directories.map(dir => {
      const lexical = pathApi.resolve(dir);
      const real = io.realpathSync(lexical);
      if (!io.statSync(lexical).isDirectory()) throw new Error('Invalid root');
      return { lexical, real };
    });
    if (!roots.some(root => isWithin(resolved, root.lexical, pathApi))) return false;
    const real = resolveExistingOrNew(resolved, io, pathApi);
    return roots.some(root => isWithin(resolved, root.lexical, pathApi) && isWithin(real, root.real, pathApi));
  } catch (_) {
    throw new Error('FileOperator directory path verification failed; access denied');
  }
}

module.exports = { createDirectoryPolicy, isPathAllowed, isWithin, resolveExistingOrNew };

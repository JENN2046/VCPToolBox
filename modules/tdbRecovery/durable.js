'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function fail(code) {
    const e = new Error(code);
    e.code = code;
    throw e;
}
function canonical(value) {
    if (Array.isArray(value))
        return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object')
        return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
    return JSON.stringify(value);
}
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const digest = value => hash(canonical(value));
function name(value) {
    if (typeof value !== 'string' || !value || value !== value.trim() || /[<>:"/\\|?*\x00-\x1f]/.test(value) || value === '.' || value === '..')
        fail('UNSAFE_LIBRARY');
    return value;
}
function contained(root, file, {
    missing = false
} = {}) {
    root = path.resolve(root);
    file = path.resolve(file);
    if (file !== root && !file.startsWith(root + path.sep))
        fail('PATH_ESCAPE');
    let cursor = path.parse(file).root;
    for (const part of file.slice(cursor.length).split(path.sep).filter(Boolean)) {
        cursor = path.join(cursor, part);
        try {
            if (fs.lstatSync(cursor).isSymbolicLink())
                fail('SYMLINK_REJECTED');
        } catch (e) {
            if (e.code === 'ENOENT' && missing)
                continue;
            throw e;
        }
    }
    return file;
}
function mkdir(root, file = root) {
    contained(root, file, { missing: true });
    fs.mkdirSync(file, {
        recursive: true,
        mode: 448
    });
    let cursor = path.resolve(file);
    const boundary = path.resolve(root);
    while (true) {
        syncDir(cursor);
        if (cursor === boundary)
            break;
        cursor = path.dirname(cursor);
    }
    syncDir(path.dirname(boundary));
    return contained(root, file);
}
function read(root, file) {
    contained(root, file);
    const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
        const before = fs.fstatSync(fd);
        if (!before.isFile())
            fail('NOT_REGULAR_FILE');
        if (before.nlink !== 1)
            fail('HARDLINK_REJECTED');
        const bytes = fs.readFileSync(fd);
        const after = fs.fstatSync(fd);
        if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || bytes.length !== after.size)
            fail('UNSTABLE_READ');
        return bytes;
    } finally {
        fs.closeSync(fd);
    }
}
function syncDir(dir) {
    const fd = fs.openSync(dir, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    try {
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
}
function write(root, file, bytes) {
    contained(root, file, { missing: true });
    mkdir(root, path.dirname(file));
    const tmp = file + '.' + crypto.randomUUID() + '.install';
    const fd = fs.openSync(tmp, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 384);
    try {
        fs.writeFileSync(fd, bytes);
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
    contained(root, file, { missing: true });
    fs.renameSync(tmp, file);
    syncDir(path.dirname(file));
}
function install(root, file, bytes, job, beforeRename) {
    if (!/^[a-f0-9-]{36}$/.test(job))
        fail('UNSAFE_JOB');
    contained(root, file, { missing: true });
    const temp = file + '.recovery-' + job + '.install';
    contained(root, temp, { missing: true });
    const fd = fs.openSync(temp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 384);
    try {
        fs.writeFileSync(fd, bytes);
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
    if (beforeRename)
        beforeRename();
    fs.renameSync(temp, file);
    syncDir(path.dirname(file));
}
function remove(root, file) {
    contained(root, file, { missing: true });
    if (fs.existsSync(file)) {
        if (!fs.lstatSync(file).isFile())
            fail('NOT_REGULAR_FILE');
        fs.unlinkSync(file);
        syncDir(path.dirname(file));
    }
}
function capacity(root, required) {
    const s = fs.statfsSync(root);
    if (!Number.isFinite(required) || required < 0 || Number(s.bavail) * Number(s.bsize) < required)
        fail('INSUFFICIENT_CAPACITY');
}
module.exports = {
    fs,
    path,
    fail,
    canonical,
    hash,
    digest,
    name,
    contained,
    mkdir,
    read,
    write,
    install,
    remove,
    syncDir,
    capacity
};

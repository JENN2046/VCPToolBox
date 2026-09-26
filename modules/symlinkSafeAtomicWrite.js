'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

function resolveSymlinkTargetSync(targetPath) {
    try {
        const stat = fs.lstatSync(targetPath);
        if (!stat.isSymbolicLink()) return targetPath;
        const link = fs.readlinkSync(targetPath);
        return path.resolve(path.dirname(targetPath), link);
    } catch (error) {
        if (error.code === 'ENOENT') return targetPath;
        throw error;
    }
}

async function resolveSymlinkTarget(targetPath) {
    try {
        const stat = await fsp.lstat(targetPath);
        if (!stat.isSymbolicLink()) return targetPath;
        const link = await fsp.readlink(targetPath);
        return path.resolve(path.dirname(targetPath), link);
    } catch (error) {
        if (error.code === 'ENOENT') return targetPath;
        throw error;
    }
}

async function atomicWriteFilePreserveSymlink(targetPath, data, options = 'utf8') {
    const writeTarget = await resolveSymlinkTarget(targetPath);
    const dir = path.dirname(writeTarget);
    await fsp.mkdir(dir, { recursive: true });

    let mode = null;
    try {
        mode = (await fsp.stat(writeTarget)).mode;
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }

    const tempPath = path.join(
        dir,
        `.${path.basename(writeTarget)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
    );
    try {
        await fsp.writeFile(tempPath, data, options);
        if (mode !== null) await fsp.chmod(tempPath, mode);
        await fsp.rename(tempPath, writeTarget);
    } finally {
        await fsp.unlink(tempPath).catch(() => undefined);
    }
    return writeTarget;
}

module.exports = {
    atomicWriteFilePreserveSymlink,
    resolveSymlinkTarget,
    resolveSymlinkTargetSync
};

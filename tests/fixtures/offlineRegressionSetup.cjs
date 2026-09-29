'use strict';

// Opt-in preload for the isolated delivery regression batch. Keep approval
// decision code intact, but never load/watch the checkout's approval config.
const ToolApprovalManager = require('../../modules/toolApprovalManager');
ToolApprovalManager.prototype.loadConfig = function () {};
ToolApprovalManager.prototype.startWatching = function () {};

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
function assertSafeRead(target) {
    if (typeof target !== 'string') return;
    const resolved = path.resolve(target);
    const relative = path.relative(root, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return;
    const name = path.basename(resolved).toLowerCase();
    if (name === 'config.env' || name === '.env' || (name.startsWith('.env.') && !name.endsWith('.example'))) {
        throw new Error('Offline regression forbids reading checkout runtime environment files');
    }
}
const readFileSync = fs.readFileSync;
fs.readFileSync = function (target, ...args) {
    assertSafeRead(target);
    return readFileSync.call(this, target, ...args);
};
const readFile = fs.promises.readFile;
fs.promises.readFile = async function (target, ...args) {
    assertSafeRead(target);
    return readFile.call(this, target, ...args);
};

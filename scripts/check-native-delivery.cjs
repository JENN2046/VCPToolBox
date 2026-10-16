'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const owners = { vexus: 'rust-vexus-lite', codesearcher: 'Plugin/CodeSearcher/src', daily: 'Plugin/DailyNoteSearcher/src' };
const deliveries = {
    vexus: {
        'x86_64-pc-windows-msvc': ['rust-vexus-lite/vexus-lite.win32-x64-msvc.node'],
        'x86_64-unknown-linux-gnu': ['rust-vexus-lite/vexus-lite.linux-x64-gnu.node'],
    },
    codesearcher: Object.fromEntries(['x86_64-pc-windows-msvc', 'x86_64-unknown-linux-gnu',
        'x86_64-unknown-linux-musl', 'aarch64-unknown-linux-gnu', 'aarch64-unknown-linux-musl'].map(target => {
        const prefix = 'Plugin/CodeSearcher/CodeSearcher';
        const aliases = target === 'x86_64-pc-windows-msvc' ? [prefix + '.exe'] :
            target === 'x86_64-unknown-linux-musl' ? [prefix + '-linux-x64-musl'] :
            target === 'aarch64-unknown-linux-musl' ? [prefix + '-linux-arm64'] : [];
        return [target, [prefix + '-' + target + (target.includes('windows') ? '.exe' : ''), ...aliases]];
    })),
    daily: Object.fromEntries(['x86_64-pc-windows-msvc', 'x86_64-unknown-linux-gnu', 'aarch64-unknown-linux-musl'].map(target => {
        const prefix = 'Plugin/DailyNoteSearcher/DailyNoteSearcher';
        return [target, [prefix + '-' + target + (target.includes('windows') ? '.exe' : ''),
            ...(target.includes('windows') ? [prefix + '.exe'] : [])]];
    })),
};
const digest = data => crypto.createHash('sha256').update(data).digest('hex');

function checkNativeDelivery(root, target, groups) {
    const receipt = JSON.parse(fs.readFileSync(path.join(root, 'docs/native-delivery-30193c89.json'), 'utf8'));
    assert.equal(receipt.schema, 1);
    const read = relative => {
        assert.ok(typeof relative === 'string' && !path.isAbsolute(relative) && !relative.includes('\\') &&
            !relative.split('/').some(part => part === '..' || part === '.' || part === ''), 'Unsafe receipt path');
        const file = path.join(root, relative);
        assert.ok(fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink(), 'Expected a regular source/artifact');
        return fs.readFileSync(file);
    };
    let checked = 0;
    for (const group of groups) {
        const prefix = owners[group];
        assert.ok(prefix, 'Unknown native source group');
        const expected = [];
        const walk = relative => {
            for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
                assert.ok(!entry.isSymbolicLink(), 'Native source symlinks are not accepted');
                const child = relative + '/' + entry.name;
                if (entry.isDirectory()) walk(child);
                else if (entry.name.endsWith('.rs')) expected.push(child);
            }
        };
        walk(prefix + '/src');
        for (const name of ['Cargo.toml', 'Cargo.lock', 'build.rs', 'package.json']) {
            if (fs.existsSync(path.join(root, prefix, name))) expected.push(prefix + '/' + name);
        }
        const inputs = receipt.source_inputs[group];
        assert.ok(Array.isArray(inputs) && inputs.length > 0);
        assert.deepEqual(inputs.map(input => input.path).sort(), expected.sort(), 'Native source inventory changed');
        for (const input of inputs) {
            assert.equal(digest(Buffer.from(read(input.path).toString('utf8').replace(/\r\n/g, '\n'))), input.sha256_lf,
                'Native source differs from the recorded CI build: ' + input.path);
        }
        const artifacts = receipt.artifacts.filter(item => item.group === group && item.target === target);
        const expectedArtifacts = deliveries[group][target];
        assert.ok(expectedArtifacts, 'No verified artifact for ' + group + '/' + target);
        assert.deepEqual(artifacts.map(item => item.path).sort(), [...expectedArtifacts].sort(),
            'Incomplete or duplicated shipped-artifact inventory');
        for (const artifact of artifacts) {
            const owner = group === 'vexus' ? prefix + '/' : prefix.slice(0, -3);
            assert.ok(artifact.path.startsWith(owner), 'Artifact owner mismatch');
            const data = read(artifact.path);
            assert.ok(data.subarray(0, 2).toString() === 'MZ' || data.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70])));
            assert.equal(digest(data), artifact.sha256, 'Bundled artifact differs from recorded CI payload: ' + artifact.path);
            checked++;
        }
    }
    return checked;
}
module.exports = { checkNativeDelivery };
if (require.main === module) {
    const [target, ...groups] = process.argv.slice(2);
    assert.ok(target && groups.length, 'Usage: node scripts/check-native-delivery.cjs TARGET GROUP...');
    console.log(`Native delivery provenance: ${checkNativeDelivery(path.resolve(__dirname, '..'), target, groups)} artifacts checked.`);
}

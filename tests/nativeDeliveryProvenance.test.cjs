'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { checkNativeDelivery } = require('../scripts/check-native-delivery.cjs');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const TARGET = 'x86_64-unknown-linux-gnu';
function fixture(t, group = 'vexus') {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-provenance-synthetic-'));
    fs.mkdirSync(path.join(root, 'docs'));
    const owner = group === 'vexus' ? 'rust-vexus-lite' : `Plugin/${group === 'daily' ? 'DailyNoteSearcher' : 'CodeSearcher'}`;
    const prefix = owner + (group === 'vexus' ? '' : '/src');
    fs.mkdirSync(path.join(root, prefix, 'src'), { recursive: true });
    const source = 'fn main() {}\n';
    const binary = Buffer.from([127, 69, 76, 70, 1, 2, 3, 4]);
    fs.writeFileSync(path.join(root, prefix, 'src/lib.rs'), source);
    const target = group === 'vexus' ? TARGET : 'x86_64-pc-windows-msvc';
    const name = group === 'daily' ? 'DailyNoteSearcher' : 'CodeSearcher';
    const paths = group === 'vexus' ? ['rust-vexus-lite/vexus-lite.linux-x64-gnu.node'] :
        [owner + '/' + name + '-' + target + '.exe', owner + '/' + name + '.exe'];
    for (const file of paths) fs.writeFileSync(path.join(root, file), binary);
    const receipt = { schema: 1, source_inputs: { [group]: [{ path: prefix + '/src/lib.rs', sha256_lf: hash(source) }] },
        artifacts: paths.map(file => ({ group, target, path: file, sha256: hash(binary) })) };
    const save = () => fs.writeFileSync(path.join(root, 'docs/native-delivery-30193c89.json'), JSON.stringify(receipt));
    save();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    return { root, receipt, save, target };
}
test('native delivery checks source and payload identity, tolerating only source CRLF differences', t => {
    const { root } = fixture(t);
    assert.equal(checkNativeDelivery(root, TARGET, ['vexus']), 1);
    fs.writeFileSync(path.join(root, 'rust-vexus-lite/src/lib.rs'), 'fn main() {}\r\n');
    assert.equal(checkNativeDelivery(root, TARGET, ['vexus']), 1);
});
test('modified native source or added Rust input invalidates provenance', t => {
    const { root } = fixture(t);
    fs.writeFileSync(path.join(root, 'rust-vexus-lite/src/lib.rs'), 'fn changed() {}');
    assert.throws(() => checkNativeDelivery(root, TARGET, ['vexus']), /source differs/);
    fs.writeFileSync(path.join(root, 'rust-vexus-lite/src/extra.rs'), 'fn extra() {}');
    assert.throws(() => checkNativeDelivery(root, TARGET, ['vexus']), /inventory changed/);
});
test('modified bundled payload fails its CI artifact hash', t => {
    const { root } = fixture(t);
    fs.appendFileSync(path.join(root, 'rust-vexus-lite/vexus-lite.linux-x64-gnu.node'), 'tamper');
    assert.throws(() => checkNativeDelivery(root, TARGET, ['vexus']), /artifact differs/);
});
test('unknown groups, unverified targets and unsafe receipt paths fail closed', t => {
    const { root, receipt, save } = fixture(t);
    assert.throws(() => checkNativeDelivery(root, TARGET, ['unknown']), /Unknown/);
    assert.throws(() => checkNativeDelivery(root, 'missing', ['vexus']), /No verified artifact/);
    receipt.artifacts[0].path = 'rust-vexus-lite/../forbidden.node';
    save();
    assert.throws(() => checkNativeDelivery(root, TARGET, ['vexus']), /shipped-artifact inventory/);
});

test('omitted or duplicated legacy aliases invalidate both Windows executable inventories', t => {
    for (const group of ['codesearcher', 'daily']) {
        const { root, receipt, save, target } = fixture(t, group);
        assert.equal(checkNativeDelivery(root, target, [group]), 2);
        const alias = receipt.artifacts.pop();
        save();
        assert.throws(() => checkNativeDelivery(root, target, [group]), /shipped-artifact inventory/);
        receipt.artifacts.push({ ...receipt.artifacts[0] });
        save();
        assert.throws(() => checkNativeDelivery(root, target, [group]), /shipped-artifact inventory/);
        receipt.artifacts[1] = alias;
        save();
        assert.equal(checkNativeDelivery(root, target, [group]), 2);
    }
});

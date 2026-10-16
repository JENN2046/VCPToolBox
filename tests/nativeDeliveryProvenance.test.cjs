'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { checkNativeDelivery } = require('../scripts/check-native-delivery.cjs');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-provenance-synthetic-'));
    fs.mkdirSync(path.join(root, 'docs'));
    fs.mkdirSync(path.join(root, 'rust-vexus-lite/src'), { recursive: true });
    const source = 'fn main() {}\n';
    const binary = Buffer.from([127, 69, 76, 70, 1, 2, 3, 4]);
    fs.writeFileSync(path.join(root, 'rust-vexus-lite/src/lib.rs'), source);
    fs.writeFileSync(path.join(root, 'rust-vexus-lite/synthetic.node'), binary);
    const receipt = { schema: 1, source_inputs: { vexus: [{ path: 'rust-vexus-lite/src/lib.rs', sha256_lf: hash(source) }] },
        artifacts: [{ group: 'vexus', target: 'synthetic', path: 'rust-vexus-lite/synthetic.node', sha256: hash(binary) }] };
    const save = () => fs.writeFileSync(path.join(root, 'docs/native-delivery-30193c89.json'), JSON.stringify(receipt));
    save();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    return { root, receipt, save };
}
test('native delivery checks source and payload identity, tolerating only source CRLF differences', t => {
    const { root } = fixture(t);
    assert.equal(checkNativeDelivery(root, 'synthetic', ['vexus']), 1);
    fs.writeFileSync(path.join(root, 'rust-vexus-lite/src/lib.rs'), 'fn main() {}\r\n');
    assert.equal(checkNativeDelivery(root, 'synthetic', ['vexus']), 1);
});
test('modified native source or added Rust input invalidates provenance', t => {
    const { root } = fixture(t);
    fs.writeFileSync(path.join(root, 'rust-vexus-lite/src/lib.rs'), 'fn changed() {}');
    assert.throws(() => checkNativeDelivery(root, 'synthetic', ['vexus']), /source differs/);
    fs.writeFileSync(path.join(root, 'rust-vexus-lite/src/extra.rs'), 'fn extra() {}');
    assert.throws(() => checkNativeDelivery(root, 'synthetic', ['vexus']), /inventory changed/);
});
test('modified bundled payload fails its CI artifact hash', t => {
    const { root } = fixture(t);
    fs.appendFileSync(path.join(root, 'rust-vexus-lite/synthetic.node'), 'tamper');
    assert.throws(() => checkNativeDelivery(root, 'synthetic', ['vexus']), /artifact differs/);
});
test('unknown groups, unverified targets and unsafe receipt paths fail closed', t => {
    const { root, receipt, save } = fixture(t);
    assert.throws(() => checkNativeDelivery(root, 'synthetic', ['unknown']), /Unknown/);
    assert.throws(() => checkNativeDelivery(root, 'missing', ['vexus']), /No verified artifact/);
    receipt.artifacts[0].path = 'rust-vexus-lite/../forbidden.node';
    save();
    assert.throws(() => checkNativeDelivery(root, 'synthetic', ['vexus']), /Unsafe receipt path/);
});

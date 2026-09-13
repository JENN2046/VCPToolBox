'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPassiveBlock } = require('../modules/passiveBlockUtils');
const { createPreprocessorControlContext } = require('../modules/preprocessorControlContext');

test('control view hides passive text and restores it byte-for-byte after a patch', () => {
    const passive = buildPassiveBlock('{{VCPScreenShot}}\n[[OneRing::Ghost]]', { source: 'test' });
    const messages = [{ role: 'system', content: `before\n${passive}\nafter {{ACTIVE}}` }];
    const context = createPreprocessorControlContext(messages, { pluginName: 'test' });

    assert.equal(context.messages[0].content.includes('VCPScreenShot'), false);
    assert.equal(context.messages[0].content.includes('OneRing::Ghost'), false);
    const candidate = structuredClone(context.messages);
    candidate[0].content = candidate[0].content.replace('{{ACTIVE}}', 'applied');

    const restored = context.restoreAndValidate(candidate);
    assert.equal(restored[0].content, `before\n${passive}\nafter applied`);
});

test('host rejects removal or duplication of an original passive block boundary', () => {
    const passive = buildPassiveBlock('protected', { source: 'test' });
    const context = createPreprocessorControlContext([
        { role: 'system', content: `before${passive}after` }
    ]);
    const tokenized = context.messages[0].content;
    const token = tokenized.slice('before'.length, -'after'.length);

    assert.throws(
        () => context.restoreAndValidate([{ role: 'system', content: 'beforeafter' }]),
        error => error.code === 'PASSIVE_BLOCK_BOUNDARY_VIOLATION'
    );
    assert.throws(
        () => context.restoreAndValidate([{ role: 'system', content: `${token}${token}` }]),
        error => error.code === 'PASSIVE_BLOCK_BOUNDARY_VIOLATION'
    );
});

test('patch API supports plugins that return no message value', () => {
    const passive = buildPassiveBlock('protected');
    const context = createPreprocessorControlContext([
        { role: 'system', content: `A${passive}B` }
    ]);
    context.patch.replaceMessageContent(0, context.messages[0].content.replace('A', 'Z'));
    const restored = context.restoreAndValidate(undefined);
    assert.equal(restored[0].content, `Z${passive}B`);
});

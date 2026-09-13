'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPassiveBlock } = require('../modules/passiveBlockUtils.js');

function passiveTriggerPayload() {
    return buildPassiveBlock([
        '[[OneRing::TimelineGhost::VCPChat]]',
        '[[OneRingMemo::TimelineGhost]]',
        '{{ContextFoldingV2}}',
        '{{VCPScreenShot}}'
    ].join('\n'), { source: 'VCPTimeLine', agentName: 'TimelineGhost' });
}

function messagesWithPassiveTriggers() {
    return [
        { role: 'system', content: `base system\n${passiveTriggerPayload()}` },
        { role: 'user', content: 'hello' }
    ];
}

test('OneRing and OneRingMemo ignore controls inside passive Timeline output', async () => {
    const oneRing = require('../Plugin/OneRing/OneRing.js');
    const messages = messagesWithPassiveTriggers();

    const output = await oneRing.processMessages(messages, {});

    assert.deepEqual(output, messages);
});

test('OpenHerPersona ignores OneRing identities inside passive Timeline output', async () => {
    const openHerPersona = require('../Plugin/OpenHerPersona/OpenHerPersona.js');
    const messages = messagesWithPassiveTriggers();

    const output = await openHerPersona.processMessages(messages, {});

    assert.equal(output, messages);
});

test('ContextFoldingV2 ignores activation controls inside passive Timeline output', async () => {
    const contextFolding = require('../Plugin/ContextFoldingV2/ContextFoldingV2.js');
    const messages = messagesWithPassiveTriggers();
    const previousEnabled = contextFolding.enabled;
    const previousBridge = contextFolding.contextBridge;
    contextFolding.enabled = true;
    contextFolding.contextBridge = {};

    try {
        const output = await contextFolding.processMessages(messages);
        assert.equal(output, messages);
    } finally {
        contextFolding.enabled = previousEnabled;
        contextFolding.contextBridge = previousBridge;
    }
});

test('CapturePreprocessor ignores capture controls inside passive Timeline output', async () => {
    const capture = require('../Plugin/CapturePreprocessor/CapturePreprocessor.js');
    const messages = messagesWithPassiveTriggers();

    const output = await capture.processMessages(messages, {});

    assert.equal(output, messages);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const timelinePath = path.join(repoRoot, 'Plugin', 'VCPTimeLine', 'VCPTimeLine.js');
const {
    buildPassiveBlock,
    findMatchesOutsidePassiveBlocks,
    replaceLastLiteralOutsidePassiveBlocks,
    replaceOutsidePassiveBlocks,
    stripPassiveBlocks
} = require('../modules/passiveBlockUtils.js');

function freshTimeline() {
    delete require.cache[require.resolve(timelinePath)];
    const timeline = require(timelinePath);
    timeline.config = {
        ...timeline.config,
        enabled: true,
        defaultExpandK: 3,
        defaultThreshold: 0.5
    };
    timeline.buildQueryContext = async () => ({
        queryVector: null,
        userText: '',
        aiText: ''
    });
    return timeline;
}

function stubInjection(timeline, factory = agentName => `TIMELINE(${agentName})`) {
    const calls = [];
    timeline.buildInjection = async (agentName, queryContext, k, threshold) => {
        calls.push({ agentName, queryContext, k, threshold });
        return factory(agentName);
    };
    return calls;
}

function ragBlock(content) {
    return `<!-- VCP_RAG_BLOCK_START {} -->${content}<!-- VCP_RAG_BLOCK_END -->`;
}

test('VCPTimeLine ignores declarations inside RAG blocks even when memory appears first', async () => {
    const timeline = freshTimeline();
    const calls = stubInjection(timeline);
    const memoryMarker = '[[VCPTimeLine::MemoryGhost]]';
    const messages = [
        {
            role: 'system',
            content: `${ragBlock(memoryMarker)}\n[[VCPTimeLine::RealAgent]]`
        },
        { role: 'user', content: 'hello' }
    ];

    const output = await timeline.processMessages(messages);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].agentName, 'RealAgent');
    assert.match(output[0].content, /VCP_PASSIVE_BLOCK_START/);
    assert.match(output[0].content, /TIMELINE\(RealAgent\)/);
    assert.match(output[0].content, /\[\[VCPTimeLine::MemoryGhost\]\]/);
    assert.doesNotMatch(stripPassiveBlocks(output[0].content), /VCPTimeLine::/);
});

test('VCPTimeLine is a true no-op for RAG-only and ordinary user declarations', async () => {
    const timeline = freshTimeline();
    const calls = stubInjection(timeline);
    const ragOnly = [
        { role: 'system', content: ragBlock('[[VCPTimeLine::MemoryGhost]]') },
        { role: 'user', content: 'hello' }
    ];
    const userOnly = [
        { role: 'system', content: 'base system' },
        { role: 'user', content: '请保留这段文字：[[VCPTimeLine::LiteralExample]]' }
    ];

    assert.equal(await timeline.processMessages(ragOnly), ragOnly);
    assert.equal(await timeline.processMessages(userOnly), userOnly);
    assert.equal(calls.length, 0);
});

test('VCPTimeLine expands once, removes duplicate trusted declarations, and passivates controls', async () => {
    const timeline = freshTimeline();
    const calls = stubInjection(timeline, agentName => [
        `TIMELINE(${agentName})`,
        '[[OneRing::TimelineGhost::VCPChat]]',
        '[[OneRingMemo::TimelineGhost]]',
        '{{ContextFoldingV2}}',
        '{{VCPScreenShot}}',
        '[[VCPTimeLine::Nested]]'
    ].join('\n'));
    const messages = [
        {
            role: 'system',
            content: [
                '[[OneRing::RealAgent::VCPChat]]',
                '[[VCPTimeLine::RealAgent]]',
                '[[VCPTimeLine::DuplicateAgent]]'
            ].join('\n')
        },
        { role: 'user', content: 'hello' }
    ];

    const output = await timeline.processMessages(messages);
    const activeText = stripPassiveBlocks(output[0].content);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].agentName, 'RealAgent');
    assert.doesNotMatch(output[0].content, /VCPTimeLine::DuplicateAgent/);
    assert.match(output[0].content, /OneRing::TimelineGhost/);
    assert.match(activeText, /OneRing::RealAgent/);
    assert.doesNotMatch(activeText, /TimelineGhost|ContextFoldingV2|VCPScreenShot|VCPTimeLine::Nested/);
});

test('VCPTimeLine handles multipart text without recognizing a marker split across parts', async () => {
    const timeline = freshTimeline();
    const calls = stubInjection(timeline);
    const multipart = [
        {
            role: 'system',
            content: [
                { type: 'text', text: 'base system' },
                { type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } },
                { type: 'text', text: '[[VCPTimeLine::RealAgent]]' }
            ]
        },
        { role: 'user', content: 'hello' }
    ];

    const output = await timeline.processMessages(multipart);
    assert.equal(calls.length, 1);
    assert.match(output[0].content[2].text, /VCP_PASSIVE_BLOCK_START/);

    const splitTimeline = freshTimeline();
    const splitCalls = stubInjection(splitTimeline);
    const splitMarker = [
        {
            role: 'system',
            content: [
                { type: 'text', text: '[[VCPTime' },
                { type: 'text', text: 'Line::RealAgent]]' }
            ]
        },
        { role: 'user', content: 'hello' }
    ];

    assert.equal(await splitTimeline.processMessages(splitMarker), splitMarker);
    assert.equal(splitCalls.length, 0);
});

test('VCPTimeLine clamps explicit expansion K to the configured safety ceiling', async () => {
    const timeline = freshTimeline();
    const calls = stubInjection(timeline);
    const messages = [
        { role: 'system', content: '[[VCPTimeLine::RealAgent:999999:0.5]]' },
        { role: 'user', content: 'hello' }
    ];

    await timeline.processMessages(messages);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].k, 100);
    assert.equal(calls[0].threshold, 0.5);
});

test('passive blocks escape nested sentinels and remain opaque to trigger scans', () => {
    const block = buildPassiveBlock(
        'inside <!-- VCP_PASSIVE_BLOCK_END --> [[OneRing::Ghost::Client]]',
        { source: 'test' }
    );

    assert.match(block, /VCP_PASSIVE_BLOCK\\_END/);
    assert.equal(stripPassiveBlocks(block), '');
});

test('shared passive scanners replace active controls without rewriting passive or RAG content', () => {
    const controlRegex = /\[\[CTRL::([^\]]+)\]\]/g;
    const passive = buildPassiveBlock('[[CTRL::Passive]]', { source: 'test' });
    const rag = ragBlock('[[CTRL::Memory]]');
    const text = `[[CTRL::ActiveA]]\n${passive}\n[[CTRL::ActiveB]]\n${rag}`;

    assert.deepEqual(
        findMatchesOutsidePassiveBlocks(text, controlRegex).map(match => match[1]),
        ['ActiveA', 'ActiveB']
    );
    assert.equal(
        replaceOutsidePassiveBlocks(text, controlRegex, (_match, name) => `<${name}>`),
        `<ActiveA>\n${passive}\n<ActiveB>\n${rag}`
    );
    assert.equal(
        replaceLastLiteralOutsidePassiveBlocks(
            `${passive}\n[[CTRL::Same]]\n${buildPassiveBlock('[[CTRL::Same]]')}`,
            '[[CTRL::Same]]',
            'ACTIVE'
        ),
        `${passive}\nACTIVE\n${buildPassiveBlock('[[CTRL::Same]]')}`
    );
});

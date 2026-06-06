const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    extractTextFromMessageContent,
    findLastRealUserMessage,
    isBetaSystemUserText,
    isSystemNotificationText,
    stripSystemNotificationBlocks
} = require('../modules/messageProcessor.js');

test('extractTextFromMessageContent handles string, array text parts, and object text', () => {
    assert.equal(extractTextFromMessageContent('plain text'), 'plain text');
    assert.equal(
        extractTextFromMessageContent([
            { type: 'text', text: 'first' },
            { type: 'image_url', image_url: { url: 'https://example.test/image.png' } },
            { type: 'text', text: 'second' },
            null
        ]),
        'first\nsecond'
    );
    assert.equal(extractTextFromMessageContent({ text: 'object text' }), 'object text');
    assert.equal(extractTextFromMessageContent(null), '');
});

test('system notification text is not classified as beta system user text', () => {
    assert.equal(isSystemNotificationText('[系统通知]当前时间'), true);
    assert.equal(isSystemNotificationText('[系统通知:]当前时间'), true);
    assert.equal(isSystemNotificationText('[系统通知：]当前时间'), true);

    assert.equal(isBetaSystemUserText('[系统通知]当前时间'), false);
    assert.equal(isBetaSystemUserText('[系统提示:]工具占位符承载体'), true);
    assert.equal(isBetaSystemUserText('[系统邀请指令:]现在轮到你发言'), true);
});

test('stripSystemNotificationBlocks removes notification spans without removing visible text', () => {
    assert.equal(stripSystemNotificationBlocks('[系统通知]only notification[系统通知结束]'), '');
    assert.equal(
        stripSystemNotificationBlocks('visible before\n[系统通知：]runtime note[系统通知结束]\nvisible after'),
        'visible before\n\nvisible after'
    );
});

test('findLastRealUserMessage returns latest normal user message', () => {
    const messages = [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'older user' },
        { role: 'assistant', content: 'assistant answer' },
        { role: 'user', content: 'latest user' }
    ];

    assert.deepEqual(
        findLastRealUserMessage(messages),
        {
            index: 3,
            message: messages[3],
            rawContent: 'latest user',
            sanitizedContent: 'latest user'
        }
    );
});

test('findLastRealUserMessage skips system invitation, empty system prompt, beta system carriers, and tool payloads', () => {
    const messages = [
        { role: 'user', content: 'real query' },
        { role: 'user', content: '[系统邀请指令:]邀请下一位发言' },
        { role: 'user', content: '[系统提示:]无内容' },
        { role: 'user', content: '[系统提示:]{{SomePlaceholder}}' },
        { role: 'user', content: '<!-- VCP_TOOL_PAYLOAD -->{"name":"tool"}' }
    ];

    const result = findLastRealUserMessage(messages);

    assert.equal(result.index, 0);
    assert.equal(result.rawContent, 'real query');
    assert.equal(result.sanitizedContent, 'real query');
});

test('findLastRealUserMessage strips notification blocks and keeps visible notification-tail content', () => {
    const messages = [
        { role: 'user', content: 'older query' },
        { role: 'user', content: '[系统通知]runtime note[系统通知结束]\nvisible query' }
    ];

    const result = findLastRealUserMessage(messages);

    assert.equal(result.index, 1);
    assert.equal(result.rawContent, '[系统通知]runtime note[系统通知结束]\nvisible query');
    assert.equal(result.sanitizedContent, 'visible query');
});

test('findLastRealUserMessage continues searching when newest user becomes empty after notification stripping', () => {
    const messages = [
        { role: 'user', content: 'earlier real query' },
        { role: 'assistant', content: 'assistant answer' },
        { role: 'user', content: '[系统通知]runtime note[系统通知结束]' }
    ];

    const result = findLastRealUserMessage(messages);

    assert.equal(result.index, 0);
    assert.equal(result.rawContent, 'earlier real query');
    assert.equal(result.sanitizedContent, 'earlier real query');
});

test('findLastRealUserMessage uses optional sanitizer callback for the returned candidate', () => {
    const calls = [];
    const messages = [
        { role: 'user', content: 'older query' },
        { role: 'user', content: '<b>latest query</b>' }
    ];

    const result = findLastRealUserMessage(messages, {
        sanitize(text, role) {
            calls.push({ text, role });
            return text.replace(/<[^>]+>/g, '');
        }
    });

    assert.equal(result.index, 1);
    assert.equal(result.rawContent, '<b>latest query</b>');
    assert.equal(result.sanitizedContent, 'latest query');
    assert.deepEqual(calls, [{ text: '<b>latest query</b>', role: 'user' }]);
});

test('findLastRealUserMessage does not mutate caller-owned messages', () => {
    const messages = [
        {
            role: 'user',
            content: [
                { type: 'text', text: '[系统通知]runtime note[系统通知结束]\nreal query' },
                { type: 'image_url', image_url: { url: 'https://example.test/image.png' } }
            ]
        }
    ];
    const before = JSON.parse(JSON.stringify(messages));

    const result = findLastRealUserMessage(messages);

    assert.equal(result.sanitizedContent, 'real query');
    assert.deepEqual(messages, before);
});

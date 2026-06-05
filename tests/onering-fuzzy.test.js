'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeComparableText,
  levenshteinDistance,
  calculateTextSimilarity,
  extractComparableText,
  diffContextBlocks,
} = require('../modules/oneringFuzzy');

test('normalizeComparableText strips OneRing markers, system notices, and group headers', () => {
  const input = [
    '[系统通知]server side note[系统通知结束]',
    '[Alice的发言]：  hello   world',
    '[OneRing通知:Alice于2026-06-05 10:11:12发送于VChat]',
  ].join('\n');

  assert.equal(normalizeComparableText(input), 'hello world');
});

test('levenshteinDistance handles basic insertions and substitutions', () => {
  assert.equal(levenshteinDistance('kitten', 'sitting'), 3);
  assert.equal(levenshteinDistance('', 'abc'), 3);
  assert.equal(levenshteinDistance('same', 'same'), 0);
});

test('calculateTextSimilarity treats marker-only differences as identical', () => {
  assert.equal(
    calculateTextSimilarity(
      '[Bob的发言]: hello world [OneRing通知:Bob于2026-06-05 10:11:12发送于QQ]',
      'hello   world',
    ),
    1,
  );
});

test('calculateTextSimilarity short-circuits large length gaps', () => {
  assert.equal(calculateTextSimilarity('short', 'short plus a very long suffix'), 5 / 29);
});

test('extractComparableText keeps visible text and ignores reasoning fields', () => {
  assert.equal(
    extractComparableText({
      content: [
        { type: 'text', text: 'visible one' },
        { reasoning_content: 'hidden' },
        { type: 'text', value: 'visible two' },
      ],
      reasoning_content: 'hidden root',
    }),
    'visible one visible two',
  );
});

test('diffContextBlocks matches a replayed tail window instead of the oldest records', () => {
  const postBlocks = [
    { role: 'user', text: 'newer question' },
    { role: 'assistant', text: 'newer answer' },
  ];
  const storedBlocks = [
    { id: 1, role: 'user', content: 'older question' },
    { id: 2, role: 'assistant', content: 'older answer' },
    { id: 3, role: 'user', content: 'newer question' },
    { id: 4, role: 'assistant', content: 'newer answer' },
  ];

  assert.deepEqual(diffContextBlocks(postBlocks, storedBlocks), {
    matchedCount: 2,
    unknownCount: 0,
    editedBlocks: [],
    newBlocks: [],
    reliable: true,
    matchStartIndex: 2,
  });
});

test('diffContextBlocks reads current post content when text is absent', () => {
  const result = diffContextBlocks(
    [{ role: 'user', content: 'hello' }],
    [{ id: 10, role: 'user', content: 'hello' }],
  );

  assert.equal(result.matchedCount, 1);
  assert.equal(result.unknownCount, 0);
  assert.equal(result.reliable, true);
  assert.deepEqual(result.editedBlocks, []);
  assert.deepEqual(result.newBlocks, []);
});

test('diffContextBlocks reads multimodal current post content when text is absent', () => {
  const result = diffContextBlocks(
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'hello' },
          { type: 'text', value: 'world' },
        ],
      },
    ],
    [{ id: 11, role: 'user', content: 'hello world' }],
  );

  assert.equal(result.matchedCount, 1);
  assert.equal(result.unknownCount, 0);
  assert.equal(result.reliable, true);
});

test('diffContextBlocks classifies moderately similar same-role blocks as edits', () => {
  const result = diffContextBlocks(
    [{ role: 'user', text: 'please summarize chapter two' }],
    [{ id: 7, role: 'user', content: 'please summarize chapter one' }],
    { threshold: 0.96, editFloor: 0.55 },
  );

  assert.equal(result.matchedCount, 0);
  assert.equal(result.unknownCount, 0);
  assert.equal(result.reliable, true);
  assert.equal(result.editedBlocks.length, 1);
  assert.equal(result.editedBlocks[0].dbId, 7);
  assert.equal(result.editedBlocks[0].newText, 'please summarize chapter two');
});

test('diffContextBlocks marks role mismatches as unreliable unknowns', () => {
  const result = diffContextBlocks(
    [{ role: 'assistant', text: 'answer' }],
    [{ id: 1, role: 'user', content: 'answer' }],
  );

  assert.equal(result.matchedCount, 0);
  assert.equal(result.unknownCount, 1);
  assert.equal(result.reliable, false);
  assert.equal(result.matchStartIndex, 0);
});

test('diffContextBlocks emits new blocks when stored history is empty or exhausted', () => {
  assert.deepEqual(
    diffContextBlocks([{ role: 'user', text: 'hello' }], []),
    {
      matchedCount: 0,
      unknownCount: 0,
      editedBlocks: [],
      newBlocks: [{ role: 'user', text: 'hello', postIndex: 0 }],
      reliable: true,
      matchStartIndex: null,
    },
  );

  const result = diffContextBlocks(
    [
      { role: 'user', text: 'hello' },
      { role: 'assistant', text: 'hi' },
    ],
    [{ id: 1, role: 'user', content: 'hello' }],
  );

  assert.equal(result.matchedCount, 1);
  assert.deepEqual(result.newBlocks, [{ role: 'assistant', text: 'hi', postIndex: 1 }]);
});

test('diffContextBlocks treats invalid block arrays as empty without throwing', () => {
  assert.deepEqual(diffContextBlocks(null, null), {
    matchedCount: 0,
    unknownCount: 0,
    editedBlocks: [],
    newBlocks: [],
    reliable: true,
    matchStartIndex: null,
  });
});

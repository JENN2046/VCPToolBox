const test = require('node:test');
const assert = require('node:assert/strict');

const contextFoldingV2 = require('../Plugin/ContextFoldingV2/ContextFoldingV2.js');

function createBridge(options = {}) {
    const embeddedTexts = [];
    const vectorByText = options.vectorByText || new Map();
    const sanitize = options.sanitize || ((text) => String(text || '').trim());

    return {
        embeddedTexts,
        bridge: {
            sanitize,
            async embedText(text) {
                const normalized = String(text || '');
                embeddedTexts.push(normalized);
                return vectorByText.get(normalized) || null;
            },
            weightedAverage(vectors) {
                return vectors.find(Boolean) || null;
            }
        }
    };
}

test('ContextFoldingV2 ignores notification-only latest user when building context vector', async () => {
    const { bridge, embeddedTexts } = createBridge({
        vectorByText: new Map([
            ['real user query', [1, 0]]
        ])
    });

    const vector = await contextFoldingV2._getContextVector(
        [
            { role: 'user', content: 'real user query' },
            { role: 'user', content: '[系统通知]runtime status[系统通知结束]' }
        ],
        bridge
    );

    assert.deepEqual(vector, [1, 0]);
    assert.deepEqual(embeddedTexts, ['real user query']);
});

test('ContextFoldingV2 does not reuse stale user query when latest real user sanitizes empty', async () => {
    const { bridge, embeddedTexts } = createBridge({
        vectorByText: new Map([
            ['stale user query', [1, 0]]
        ]),
        sanitize(text) {
            const normalized = String(text || '');
            return normalized.includes('data-tool-marker')
                ? ''
                : normalized.trim();
        }
    });

    const vector = await contextFoldingV2._getContextVector(
        [
            { role: 'user', content: 'stale user query' },
            { role: 'user', content: '<span data-tool-marker="true"></span>' }
        ],
        bridge
    );

    assert.equal(vector, null);
    assert.deepEqual(embeddedTexts, []);
});

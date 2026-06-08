const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
    parseExternalPluginAllowPolicy,
    evaluateExternalPluginAllowPolicy
} = require('../modules/externalPluginAllowPolicy');

function makeProjectRoot() {
    return path.join(os.tmpdir(), 'vcp-external-plugin-allow-policy');
}

function makeExternalClassification(overrides = {}) {
    const projectRoot = makeProjectRoot();
    const sourceDirectory = path.join(projectRoot, 'reviewed-plugins');
    return {
        pluginName: 'ExternalEcho',
        pluginSource: 'external',
        basePath: path.join(sourceDirectory, 'ExternalEcho'),
        isExternal: true,
        decision: 'would_block',
        ...overrides
    };
}

test('allow policy parser accepts name and reviewed source directory pairs', () => {
    const projectRoot = makeProjectRoot();
    const firstSource = path.join(projectRoot, 'reviewed-plugins');
    const secondSource = path.join(projectRoot, 'other-reviewed-plugins');
    const result = parseExternalPluginAllowPolicy(
        [
            `ExternalEcho@${firstSource}`,
            `ExternalEcho@${firstSource}`,
            `ExternalSearch@${secondSource}`
        ].join(';'),
        { projectRoot }
    );

    assert.equal(result.errors.length, 0);
    assert.equal(result.entries.length, 2);
    assert.deepEqual(result.entries.map((entry) => entry.pluginName), ['ExternalEcho', 'ExternalSearch']);
    assert.equal(result.entries[0].sourceDirectory, firstSource);
    assert.equal(result.entries[0].normalizedSourceDirectory, path.resolve(projectRoot, firstSource));
});

test('allow policy parser rejects name-only, path-only, wildcard, and dot-only entries', () => {
    const projectRoot = makeProjectRoot();
    const result = parseExternalPluginAllowPolicy(
        [
            'ExternalEcho',
            path.join(projectRoot, 'path-only'),
            '*@reviewed-plugins',
            'ExternalSearch@*',
            'ExternalDot@.'
        ].join(';'),
        { projectRoot }
    );

    assert.equal(result.entries.length, 0);
    assert.deepEqual(
        result.errors.map((error) => error.reason),
        [
            'missing-source-directory',
            'missing-plugin-name',
            'wildcard-entry-not-allowed',
            'wildcard-entry-not-allowed',
            'broad-source-directory-not-allowed'
        ]
    );
});

test('allow policy parser rejects filesystem root source directories', () => {
    const projectRoot = makeProjectRoot();
    const currentPlatformRoot = path.parse(projectRoot).root;
    const result = parseExternalPluginAllowPolicy(
        [
            'ExternalPosixRoot@/',
            `ExternalCurrentRoot@${currentPlatformRoot}`,
            'ExternalDriveRoot@C:\\',
            'ExternalUncRoot@\\\\server\\share\\'
        ].join(';'),
        { projectRoot }
    );

    assert.equal(result.entries.length, 0);
    assert.deepEqual(
        result.errors.map((error) => error.reason),
        [
            'broad-source-directory-not-allowed',
            'broad-source-directory-not-allowed',
            'broad-source-directory-not-allowed',
            'broad-source-directory-not-allowed'
        ]
    );
});

test('allow policy evaluation observes non-external plugin classifications', () => {
    const result = evaluateExternalPluginAllowPolicy({
        pluginName: 'SciCalculator',
        pluginSource: 'legacy',
        basePath: 'Plugin/SciCalculator',
        isExternal: false
    }, '');

    assert.equal(result.pluginName, 'SciCalculator');
    assert.equal(result.decision, 'observe');
    assert.equal(result.matchedPolicy, null);
    assert.match(result.reasons.join('\n'), /non-external/);
});

test('allow policy evaluation allows external plugin only when name and source directory match', () => {
    const projectRoot = makeProjectRoot();
    const sourceDirectory = path.join(projectRoot, 'reviewed-plugins');
    const classification = makeExternalClassification({
        basePath: path.join(sourceDirectory, 'ExternalEcho')
    });
    const policy = parseExternalPluginAllowPolicy(`ExternalEcho@${sourceDirectory}`, { projectRoot });
    const result = evaluateExternalPluginAllowPolicy(classification, policy, { projectRoot });

    assert.equal(result.decision, 'would_allow');
    assert.deepEqual(result.matchedPolicy, {
        pluginName: 'ExternalEcho',
        normalizedSourceDirectory: path.resolve(projectRoot, sourceDirectory)
    });
    assert.match(result.reasons.join('\n'), /matched explicit name and source directory/);
});

test('allow policy evaluation keeps invalid policy evidence when a valid entry matches', () => {
    const projectRoot = makeProjectRoot();
    const sourceDirectory = path.join(projectRoot, 'reviewed-plugins');
    const policy = parseExternalPluginAllowPolicy(
        `ExternalEcho@${sourceDirectory};BrokenNameOnly`,
        { projectRoot }
    );
    const result = evaluateExternalPluginAllowPolicy(
        makeExternalClassification({
            basePath: path.join(sourceDirectory, 'ExternalEcho')
        }),
        policy,
        { projectRoot }
    );

    assert.equal(result.decision, 'would_allow');
    assert.match(result.reasons.join('\n'), /matched explicit name and source directory/);
    assert.match(result.reasons.join('\n'), /invalid entries/);
});

test('allow policy evaluation accepts policy objects with sourceDirectory fallback', () => {
    const projectRoot = makeProjectRoot();
    const sourceDirectory = path.join(projectRoot, 'reviewed-plugins');
    const result = evaluateExternalPluginAllowPolicy(
        makeExternalClassification({
            basePath: path.join(sourceDirectory, 'ExternalEcho')
        }),
        {
            entries: [{ pluginName: 'ExternalEcho', sourceDirectory }],
            errors: []
        },
        { projectRoot }
    );

    assert.equal(result.decision, 'would_allow');
    assert.equal(result.matchedPolicy.normalizedSourceDirectory, sourceDirectory);
});

test('allow policy evaluation blocks same-name external plugin when policy source is a filesystem root', () => {
    const projectRoot = makeProjectRoot();
    const result = evaluateExternalPluginAllowPolicy(
        makeExternalClassification({
            basePath: path.join(projectRoot, 'reviewed-plugins', 'ExternalEcho')
        }),
        `ExternalEcho@${path.parse(projectRoot).root}`,
        { projectRoot }
    );

    assert.equal(result.decision, 'would_block');
    assert.equal(result.matchedPolicy, null);
    assert.match(result.reasons.join('\n'), /invalid entries/);
    assert.match(result.reasons.join('\n'), /requires explicit name and source directory/);
});

test('allow policy evaluation blocks broad source directories in policy objects', () => {
    const projectRoot = makeProjectRoot();
    const result = evaluateExternalPluginAllowPolicy(
        makeExternalClassification({
            basePath: path.join(projectRoot, 'reviewed-plugins', 'ExternalEcho')
        }),
        {
            entries: [{ pluginName: 'ExternalEcho', sourceDirectory: path.parse(projectRoot).root }],
            errors: []
        },
        { projectRoot }
    );

    assert.equal(result.decision, 'would_block');
    assert.equal(result.matchedPolicy, null);
    assert.match(result.reasons.join('\n'), /broad source directory entries/);
    assert.match(result.reasons.join('\n'), /source directory did not match/);
});

test('allow policy evaluation blocks same plugin name from a different source directory', () => {
    const projectRoot = makeProjectRoot();
    const reviewedSource = path.join(projectRoot, 'reviewed-plugins');
    const unreviewedSource = path.join(projectRoot, 'unreviewed-plugins');
    const result = evaluateExternalPluginAllowPolicy(
        makeExternalClassification({
            basePath: path.join(unreviewedSource, 'ExternalEcho')
        }),
        `ExternalEcho@${reviewedSource}`,
        { projectRoot }
    );

    assert.equal(result.decision, 'would_block');
    assert.equal(result.matchedPolicy, null);
    assert.match(result.reasons.join('\n'), /source directory did not match/);
});

test('allow policy evaluation blocks external plugin when no matching name exists', () => {
    const projectRoot = makeProjectRoot();
    const sourceDirectory = path.join(projectRoot, 'reviewed-plugins');
    const result = evaluateExternalPluginAllowPolicy(
        makeExternalClassification(),
        `ExternalSearch@${sourceDirectory}`,
        { projectRoot }
    );

    assert.equal(result.decision, 'would_block');
    assert.match(result.reasons.join('\n'), /requires explicit name and source directory/);
});

test('allow policy evaluation preserves invalid policy errors without allowing by name alone', () => {
    const result = evaluateExternalPluginAllowPolicy(
        makeExternalClassification(),
        'ExternalEcho'
    );

    assert.equal(result.decision, 'would_block');
    assert.equal(result.matchedPolicy, null);
    assert.match(result.reasons.join('\n'), /invalid entries/);
    assert.match(result.reasons.join('\n'), /requires explicit name and source directory/);
});

test('allow policy evaluation does not mutate inputs or leak plugin config values', () => {
    const projectRoot = makeProjectRoot();
    const sourceDirectory = path.join(projectRoot, 'reviewed-plugins');
    const classification = makeExternalClassification({
        pluginSpecificEnvConfig: {
            API_TOKEN: 'SECRET_VALUE_SHOULD_NOT_APPEAR'
        }
    });
    const policy = parseExternalPluginAllowPolicy(`ExternalEcho@${sourceDirectory}`, { projectRoot });
    const beforeClassification = JSON.stringify(classification);
    const beforePolicy = JSON.stringify(policy);
    const result = evaluateExternalPluginAllowPolicy(classification, policy, { projectRoot });
    const serialized = JSON.stringify(result);

    assert.equal(result.decision, 'would_allow');
    assert.equal(JSON.stringify(classification), beforeClassification);
    assert.equal(JSON.stringify(policy), beforePolicy);
    assert.equal(serialized.includes('SECRET_VALUE_SHOULD_NOT_APPEAR'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(result, 'pluginSpecificEnvConfig'), false);
});

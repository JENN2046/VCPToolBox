const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const fixtures = require('../modules/aiImageJennTrialFixtures');

const root = path.resolve(__dirname, '..');
const jennAgentImageLabSourceLiteral = /A:\\\\agent-image-lab/;

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('AI image trial fixtures expose frozen generic adapter aggregates', () => {
    const source = read('modules/aiImageJennTrialFixtures.js');
    const trialFixtures = fixtures.AI_IMAGE_SECRETLESS_TRIAL_FIXTURES;

    assert.equal(Object.isFrozen(fixtures), true);
    assert.equal(Object.isFrozen(trialFixtures), true);
    assert.equal(Object.isFrozen(trialFixtures.serumBottleSecretless), true);
    assert.equal(Object.isFrozen(trialFixtures.runtimeToReviewV2Trial001), true);
    assert.equal(Object.isFrozen(trialFixtures.runtimeToReviewV2Trial002), true);
    assert.equal(Object.isFrozen(fixtures.AUTHORIZED_DOUBAO_PROJECT_BASE_PATH_OVERRIDES), true);
    assert.equal(Object.isFrozen(fixtures.SERUM_BOTTLE_SECRETLESS_AUTHORIZED_ROUTE_ID_LIST), true);
    assert.doesNotMatch(source, /process\.env|fs\.|require\('fs'\)|require\("fs"\)|PluginManager|processToolCall/);
    assert.equal(
        trialFixtures.runtimeToReviewV2Trial001.activationId,
        'AUTH-R2R-V2-TRIAL-001-SERUM-DETAIL-CONTROL-20260608-FUTURE-EXECUTION'
    );
    assert.equal(
        trialFixtures.runtimeToReviewV2Trial002.promptPackageRef,
        'prompts/image_generation/product_lifestyle_premium_portable_led_camping_lantern_v2.yaml'
    );
    assert.equal(
        fixtures.AI_IMAGE_DOUBAO_PROJECT_BASE_PATH_OVERRIDES,
        fixtures.AUTHORIZED_DOUBAO_PROJECT_BASE_PATH_OVERRIDES
    );
});

test('Jenn trial local path bindings are out of route and server implementation sources', () => {
    const routeSource = read('routes/admin/aiImageAgents.js');
    const serverSource = read('server.js');
    const fixtureSource = read('modules/aiImageJennTrialFixtures.js');

    assert.doesNotMatch(routeSource, jennAgentImageLabSourceLiteral);
    assert.doesNotMatch(serverSource, jennAgentImageLabSourceLiteral);
    assert.match(fixtureSource, /AUTHORIZED_DOUBAO_PROJECT_BASE_PATH_OVERRIDES/);
    assert.match(fixtureSource, jennAgentImageLabSourceLiteral);
});

test('Jenn trial activation constants are not duplicated in route or server sources', () => {
    const routeSource = read('routes/admin/aiImageAgents.js');
    const serverSource = read('server.js');

    for (const constantName of [
        'SERUM_BOTTLE_SECRETLESS_EXACT_ACTIVATION_ID',
        'R2R_V2_TRIAL_001_EXACT_ACTIVATION_ID',
        'R2R_V2_TRIAL_002_EXACT_ACTIVATION_ID',
    ]) {
        const declarationPattern = new RegExp(`const\\s+${constantName}\\s*=`);
        assert.doesNotMatch(routeSource, declarationPattern);
        assert.doesNotMatch(serverSource, declarationPattern);
    }
});

test('route and server consume generic fixture aggregate boundary', () => {
    const routeSource = read('routes/admin/aiImageAgents.js');
    const serverSource = read('server.js');

    assert.match(routeSource, /AI_IMAGE_SECRETLESS_TRIAL_FIXTURES/);
    assert.match(routeSource, /AI_IMAGE_DOUBAO_PROJECT_BASE_PATH_OVERRIDES/);
    assert.match(serverSource, /AI_IMAGE_SECRETLESS_TRIAL_FIXTURES/);
    assert.doesNotMatch(
        routeSource,
        /SERUM_BOTTLE_SECRETLESS_EXACT_ACTIVATION_ID,\s*\n\s*SERUM_BOTTLE_SECRETLESS_EXACT_PIPELINE_ID,/
    );
    assert.doesNotMatch(
        serverSource,
        /SERUM_BOTTLE_SECRETLESS_EXACT_ACTIVATION_ID,\s*\n\s*SERUM_BOTTLE_SECRETLESS_EXACT_PIPELINE_ID,/
    );
});

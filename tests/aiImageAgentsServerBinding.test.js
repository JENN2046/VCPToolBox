const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const fixtures = require('../modules/aiImageJennTrialFixtures');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('secretless serum server authorizer binding matches route exact activation', () => {
    const routeSource = read('routes/admin/aiImageAgents.js');
    const serverSource = read('server.js');

    assert.equal(
        fixtures.SERUM_BOTTLE_SECRETLESS_EXACT_ACTIVATION_ID,
        'AUTH-SECRETLESS-SERUM-LIVE-PROBE-20260603-018'
    );
    assert.match(routeSource, /require\('\.\.\/\.\.\/modules\/aiImageJennTrialFixtures'\)/);
    assert.match(serverSource, /require\('\.\/modules\/aiImageJennTrialFixtures'\)/);
    assert.match(routeSource, /SERUM_BOTTLE_SECRETLESS_EXACT_ACTIVATION_ID/);
    assert.match(serverSource, /SERUM_BOTTLE_SECRETLESS_EXACT_ACTIVATION_ID/);
    assert.doesNotMatch(routeSource, /const SERUM_BOTTLE_SECRETLESS_EXACT_ACTIVATION_ID\s*=/);
    assert.doesNotMatch(serverSource, /const SERUM_BOTTLE_SECRETLESS_EXACT_ACTIVATION_ID\s*=/);
});

test('secretless serum internal POST remains behind bearer auth', () => {
    const serverSource = read('server.js');

    assert.match(
        serverSource,
        /const SERUM_BOTTLE_SECRETLESS_INTERNAL_ROUTE_PATH = '\/internal\/ai-image-agents\/execute\/serum-bottle-secretless';/
    );
    assert.match(serverSource, /const R2R_V2_TRIAL_001_SECRETLESS_INTERNAL_ROUTE_PATH =\s*\n\s+'\/internal\/ai-image-agents\/execute\/r2r-v2-trial-001-serum-detail-control';/);
    assert.match(serverSource, /const R2R_V2_TRIAL_002_SECRETLESS_INTERNAL_ROUTE_PATH =\s*\n\s+'\/internal\/ai-image-agents\/execute\/r2r-v2-trial-002-lantern-ecommerce-hero';/);
    assert.match(
        serverSource,
        /function isSerumBottleSecretlessInternalRoute\(req\) \{\s+return req && req\.path === SERUM_BOTTLE_SECRETLESS_INTERNAL_ROUTE_PATH;\s+\}/
    );
    assert.match(
        serverSource,
        /function isRuntimeToReviewTrialSecretlessInternalRoute\(req\) \{\s+return req && \(\s+req\.path === R2R_V2_TRIAL_001_SECRETLESS_INTERNAL_ROUTE_PATH \|\|\s+req\.path === R2R_V2_TRIAL_002_SECRETLESS_INTERNAL_ROUTE_PATH\s+\);\s+\}/
    );
    assert.doesNotMatch(
        serverSource,
        /req\.path === SERUM_BOTTLE_SECRETLESS_INTERNAL_ROUTE_PATH[^;]+req\.method === 'POST'/s
    );
    assert.match(serverSource, /authHeader !== `Bearer \$\{serverKey\}`/);
});

test('runtime-to-review Trial 001 internal POST remains behind bearer auth', () => {
    const serverSource = read('server.js');
    const routeSource = read('routes/admin/aiImageAgents.js');

    assert.match(
        serverSource,
        /const isAllowedSecretlessInternalHead =\s+req\.method === 'HEAD' && isLoopbackSocket\(req\);/
    );
    assert.doesNotMatch(
        serverSource,
        /req\.method === 'POST'[\s\S]{0,120}R2R_V2_TRIAL_001_SECRETLESS_INTERNAL_ROUTE_PATH[\s\S]{0,120}return next\(\);/
    );
    assert.match(serverSource, /R2R_V2_TRIAL_001_SECRETLESS_AUTHORIZER_MODE/);
    assert.match(serverSource, /authorizeRuntimeToReviewV2Trial001SecretlessExecution\(request\)/);
    assert.match(routeSource, /handleRuntimeToReviewV2Trial001ExecutionRequest/);
    assert.match(routeSource, /router\.post\('\/execute\/r2r-v2-trial-001-serum-detail-control'/);
});

test('runtime-to-review Trial 002 server authorizer binding matches route exact activation', () => {
    const routeSource = read('routes/admin/aiImageAgents.js');
    const serverSource = read('server.js');

    assert.equal(
        fixtures.R2R_V2_TRIAL_002_EXACT_ACTIVATION_ID,
        'AUTH-R2R-V2-TRIAL-002-LANTERN-ECOMMERCE-HERO-20260609-BINDING-READY'
    );
    assert.match(routeSource, /R2R_V2_TRIAL_002_EXACT_ACTIVATION_ID/);
    assert.match(serverSource, /R2R_V2_TRIAL_002_EXACT_ACTIVATION_ID/);
    assert.doesNotMatch(routeSource, /const R2R_V2_TRIAL_002_EXACT_ACTIVATION_ID\s*=/);
    assert.doesNotMatch(serverSource, /const R2R_V2_TRIAL_002_EXACT_ACTIVATION_ID\s*=/);
});

test('runtime-to-review Trial 002 internal POST reaches route-level secretless authorizer', () => {
    const serverSource = read('server.js');
    const routeSource = read('routes/admin/aiImageAgents.js');

    assert.match(
        serverSource,
        /function isRuntimeToReviewV2Trial002SecretlessInternalRoute\(req\) \{\s+return req && req\.path === R2R_V2_TRIAL_002_SECRETLESS_INTERNAL_ROUTE_PATH;\s+\}/
    );
    assert.match(
        serverSource,
        /const enableAiImageRuntimeToReviewTrialRoutes =\s+process\.env\.ENABLE_AI_IMAGE_RUNTIME_TO_REVIEW_TRIAL_ROUTES === 'true';/
    );
    assert.match(
        serverSource,
        /const isAllowedTrial002SecretlessInternalPost =\s+enableAiImageRuntimeToReviewTrialRoutes &&\s+req\.method === 'POST' &&/
    );
    assert.match(
        serverSource,
        /if \(isAllowedSecretlessInternalHead \|\| isAllowedTrial002SecretlessInternalPost\) \{\s+return next\(\);\s+\}/
    );
    assert.match(serverSource, /R2R_V2_TRIAL_002_SECRETLESS_AUTHORIZER_MODE/);
    assert.match(serverSource, /authorizeRuntimeToReviewV2Trial002SecretlessExecution\(request\)/);
    assert.match(routeSource, /handleRuntimeToReviewV2Trial002ExecutionRequest/);
    assert.match(routeSource, /router\.post\('\/execute\/r2r-v2-trial-002-lantern-ecommerce-hero'/);
});

test('admin ai image real execution receives native Doubao delegate option', () => {
    const serverSource = read('server.js');

    assert.match(
        serverSource,
        /const nativeDoubaoSecretlessRuntimeDelegate = createNativeDoubaoSecretlessRuntimeDelegate\(\{/
    );
    assert.match(
        serverSource,
        /routeOptions\.nativeDoubaoSecretlessRuntimeDelegate = nativeDoubaoSecretlessRuntimeDelegate;/
    );
    assert.match(
        serverSource,
        /registerSerumBottleSecretlessDoubaoDelegate\(\s+routeOptions\.nativeImageDelegateRegistry,\s+nativeDoubaoSecretlessRuntimeDelegate,\s+\{ enabled: true \}\s+\);/
    );
});

test('admin ai image real execution remains default-off and native delegate injection remains explicit', () => {
    const envExample = read('config.env.example');
    const serverSource = read('server.js');
    const routeSource = read('routes/admin/aiImageAgents.js');

    assert.doesNotMatch(envExample, /^ENABLE_AI_IMAGE_REAL_EXECUTION\s*=\s*true$/mi);
    assert.doesNotMatch(envExample, /^ENABLE_NATIVE_DOUBAO_SECRETLESS_RUNTIME_DELEGATE\s*=\s*true$/mi);
    assert.match(
        serverSource,
        /enableAiImageRealExecution:\s+process\.env\.ENABLE_AI_IMAGE_REAL_EXECUTION === 'true',/
    );
    assert.match(
        serverSource,
        /if \(process\.env\.ENABLE_AI_IMAGE_REAL_EXECUTION === 'true'\) \{/
    );
    assert.match(
        serverSource,
        /if \(process\.env\.ENABLE_NATIVE_DOUBAO_SECRETLESS_RUNTIME_DELEGATE === 'true'\) \{/
    );
    assert.match(
        routeSource,
        /typeof options\.nativeDoubaoSecretlessRuntimeDelegate === 'function'/
    );
    assert.match(routeSource, /serum_bottle_secretless_native_delegate_flag_disabled/);
});

test('secretless internal route follows ai image agents route flag', () => {
    const serverSource = read('server.js');

    assert.match(
        serverSource,
        /const enableAiImageAgentsRoute = process\.env\.ENABLE_AI_IMAGE_AGENTS_ROUTE === 'true';/
    );
    assert.match(
        serverSource,
        /enableSerumBottleSecretlessInternalRoute: enableAiImageAgentsRoute,/
    );
    assert.match(
        serverSource,
        /enableRuntimeToReviewTrialInternalRoutes: enableAiImageRuntimeToReviewTrialRoutes,/
    );
    assert.match(serverSource, /if \(enableAiImageAgentsRoute\) \{/);
    assert.doesNotMatch(
        serverSource,
        /enableSerumBottleSecretlessInternalRoute: true,/
    );
    assert.doesNotMatch(
        serverSource,
        /enableRuntimeToReviewTrialInternalRoutes: true,/
    );
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function extractActivationId(source, constantName) {
    const pattern = new RegExp(`${constantName}\\s*=\\s*\\n?\\s*['"]([^'"]+)['"]`);
    const match = source.match(pattern);
    assert.ok(match, `missing ${constantName}`);
    return match[1];
}

test('secretless serum server authorizer binding matches route exact activation', () => {
    const routeSource = read('routes/admin/aiImageAgents.js');
    const serverSource = read('server.js');

    const routeActivationId = extractActivationId(
        routeSource,
        'SERUM_BOTTLE_SECRETLESS_EXACT_ACTIVATION_ID'
    );
    const serverActivationId = extractActivationId(
        serverSource,
        'SERUM_BOTTLE_SECRETLESS_EXACT_ACTIVATION_ID'
    );

    assert.equal(serverActivationId, routeActivationId);
    assert.equal(routeActivationId, 'AUTH-SECRETLESS-SERUM-LIVE-PROBE-20260603-018');
});

test('secretless serum internal POST remains behind bearer auth', () => {
    const serverSource = read('server.js');

    assert.match(
        serverSource,
        /const SERUM_BOTTLE_SECRETLESS_INTERNAL_ROUTE_PATH = '\/internal\/ai-image-agents\/execute\/serum-bottle-secretless';/
    );
    assert.match(serverSource, /const R2R_V2_TRIAL_001_SECRETLESS_INTERNAL_ROUTE_PATH =\s*\n\s+'\/internal\/ai-image-agents\/execute\/r2r-v2-trial-001-serum-detail-control';/);
    assert.match(serverSource, /req\.path === SERUM_BOTTLE_SECRETLESS_INTERNAL_ROUTE_PATH \|\|\s*\n\s*req\.path === R2R_V2_TRIAL_001_SECRETLESS_INTERNAL_ROUTE_PATH/);
    assert.doesNotMatch(
        serverSource,
        /req\.path === SERUM_BOTTLE_SECRETLESS_INTERNAL_ROUTE_PATH[^;]+req\.method === 'POST'/s
    );
    assert.match(serverSource, /authHeader !== `Bearer \$\{serverKey\}`/);
});

test('runtime-to-review Trial 001 internal POST has exact loopback authorizer bypass', () => {
    const serverSource = read('server.js');
    const routeSource = read('routes/admin/aiImageAgents.js');

    assert.match(
        serverSource,
        /if \(isSerumBottleSecretlessInternalRoute\(req\)\) \{\s+if \(\(req\.method === 'HEAD' \|\| req\.method === 'POST'\) && isLoopbackSocket\(req\)\) \{\s+return next\(\);\s+\}\s+\}/
    );
    assert.match(serverSource, /R2R_V2_TRIAL_001_SECRETLESS_AUTHORIZER_MODE/);
    assert.match(serverSource, /authorizeRuntimeToReviewV2Trial001SecretlessExecution\(request\)/);
    assert.match(routeSource, /handleRuntimeToReviewV2Trial001ExecutionRequest/);
    assert.match(routeSource, /router\.post\('\/execute\/r2r-v2-trial-001-serum-detail-control'/);
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
    assert.match(serverSource, /if \(enableAiImageAgentsRoute\) \{/);
    assert.doesNotMatch(
        serverSource,
        /enableSerumBottleSecretlessInternalRoute: true,/
    );
});

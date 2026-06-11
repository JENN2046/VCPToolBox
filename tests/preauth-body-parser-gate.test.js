const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');

function readProjectFile(relativePath) {
    return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function indexOfOrFail(source, needle, label = needle) {
    const index = source.indexOf(needle);
    assert.notEqual(index, -1, `${label} should be present`);
    return index;
}

function assertOrdered(source, firstNeedle, secondNeedle, label) {
    const firstIndex = indexOfOrFail(source, firstNeedle);
    const secondIndex = indexOfOrFail(source, secondNeedle);
    assert.ok(firstIndex < secondIndex, label || `${firstNeedle} should appear before ${secondNeedle}`);
}

test('main server parses request bodies only after admin and bearer auth gates', () => {
    const source = readProjectFile('server.js');
    const parserMarker = '// Authenticated body parsing happens only after admin/basic and bearer authentication.';
    const parserIndex = indexOfOrFail(source, parserMarker, 'authenticated body parser marker');
    const preParserSource = source.slice(0, parserIndex);

    assertOrdered(source, 'app.use(adminAuth);', '// General API authentication', 'adminAuth should run before general bearer auth');
    assertOrdered(source, '// General API authentication', parserMarker, 'bearer auth should run before body parsing');
    assertOrdered(source, parserMarker, 'app.use(specialModelRouter);', 'specialModelRouter should run after authenticated body parsing');
    assert.doesNotMatch(
        preParserSource,
        /app\.use\([^;\n]*express\.(?:json|urlencoded|text)\(/,
        'main server must not register express body parsers before auth'
    );
    assert.doesNotMatch(
        preParserSource,
        /app\.use\(specialModelRouter\)/,
        'body-dependent specialModelRouter must not run before auth'
    );
    assert.match(source, /const DEFAULT_AUTHENTICATED_BODY_LIMIT = '5mb';/);
    assert.match(source, /const LARGE_AUTHENTICATED_BODY_LIMIT = '300mb';/);
    assert.match(source, /app\.use\(routePath, createAuthenticatedJsonParser\(LARGE_AUTHENTICATED_BODY_LIMIT\)\);/);
});

test('admin server parses admin api bodies only after adminAuth', () => {
    const source = readProjectFile('adminServer.js');
    const parserMarker = '// Parse Admin API bodies only after adminAuth has accepted the request.';
    const parserIndex = indexOfOrFail(source, parserMarker, 'admin authenticated body parser marker');
    const preParserSource = source.slice(0, parserIndex);

    assertOrdered(source, 'app.use(adminAuth);', parserMarker, 'adminAuth should run before Admin API body parsing');
    assert.doesNotMatch(
        preParserSource,
        /app\.use\([^;\n]*express\.(?:json|urlencoded|text)\(/,
        'admin server must not register express body parsers before adminAuth'
    );
    assert.match(source, /const DEFAULT_AUTHENTICATED_BODY_LIMIT = '5mb';/);
    assert.match(source, /app\.use\('\/admin_api', createAuthenticatedJsonParser\(DEFAULT_AUTHENTICATED_BODY_LIMIT\)\);/);
    assert.doesNotMatch(source, /limit: '300mb'/, 'admin server should not keep a 300mb body parser');
});

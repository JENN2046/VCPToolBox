const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    createAgentRootResolver,
    getAgentIdFromRelativePath
} = require('../modules/agentRootResolver');

function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-agent-roots-'));
}

function writeAgent(root, relativePath, content = 'prompt') {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
}

function diagnosticCodes(result) {
    return result.diagnostics.map(diagnostic => diagnostic.code);
}

function effectiveById(plan, id) {
    return plan.effectiveAgents.find(agent => agent.id === id);
}

test('Agent root resolver is default-off when external env vars are unset', () => {
    const projectRoot = makeTempDir();
    const coreRoot = path.join(projectRoot, 'Agent');
    fs.mkdirSync(coreRoot, { recursive: true });

    try {
        const resolver = createAgentRootResolver({
            projectRoot,
            coreAgentRoot: coreRoot,
            env: {}
        });
        const snapshot = resolver.getAgentRootSnapshotSync();

        assert.equal(snapshot.coreAgentRoot.rootPath, coreRoot);
        assert.deepEqual(snapshot.externalAdditiveRoots, []);
        assert.deepEqual(snapshot.externalOverrideRoots, []);
        assert.deepEqual(snapshot.loadRoots.map(root => root.rootId), ['core:agent']);
        assert.deepEqual(snapshot.diagnostics, []);
    } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    }
});

test('Agent root resolver requires an explicit external allowlist', () => {
    const projectRoot = makeTempDir();
    const externalRoot = path.join(projectRoot, '..', 'ExternalAgents');
    fs.mkdirSync(externalRoot, { recursive: true });

    try {
        const resolver = createAgentRootResolver({
            projectRoot,
            env: {
                VCP_AGENT_DIRS: externalRoot
            }
        });
        const snapshot = resolver.getAgentRootSnapshotSync();

        assert.deepEqual(snapshot.externalAdditiveRoots, []);
        assert.equal(snapshot.diagnostics.length, 1);
        assert.equal(snapshot.diagnostics[0].code, 'agent_external_roots_require_allowlist');
    } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
        fs.rmSync(externalRoot, { recursive: true, force: true });
    }
});

test('Agent root resolver rejects LocalState and .agent_board roots even when allowlisted', () => {
    const projectRoot = makeTempDir();
    const localStateRoot = path.join(projectRoot, 'LocalState', 'Agent');
    const agentBoardRoot = path.join(projectRoot, '.agent_board', 'Agent');
    fs.mkdirSync(localStateRoot, { recursive: true });
    fs.mkdirSync(agentBoardRoot, { recursive: true });

    try {
        const resolver = createAgentRootResolver({
            projectRoot,
            env: {
                VCP_AGENT_ALLOWED_ROOTS: projectRoot,
                VCP_AGENT_DIRS: [localStateRoot, agentBoardRoot].join(path.delimiter)
            }
        });
        const snapshot = resolver.getAgentRootSnapshotSync();

        assert.deepEqual(snapshot.externalAdditiveRoots, []);
        assert.deepEqual(
            diagnosticCodes(snapshot),
            ['agent_unsafe_external_root', 'agent_unsafe_external_root']
        );
    } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    }
});

test('additive Agent roots add new ids without overriding core ids', () => {
    const projectRoot = makeTempDir();
    const coreRoot = path.join(projectRoot, 'Agent');
    const externalPackage = path.join(projectRoot, '..', 'VCPToolBox-JENN-Extensions');
    const additiveRoot = path.join(externalPackage, 'Agent');
    writeAgent(coreRoot, 'Nova.txt', 'core nova');
    writeAgent(additiveRoot, 'Muse.txt', 'external muse');
    writeAgent(additiveRoot, 'Nova.txt', 'external nova should not override');

    try {
        const resolver = createAgentRootResolver({
            projectRoot,
            coreAgentRoot: coreRoot,
            env: {
                VCP_AGENT_ALLOWED_ROOTS: externalPackage,
                VCP_AGENT_DIRS: additiveRoot
            }
        });
        const plan = resolver.getAgentFilePlanSync();

        assert.equal(effectiveById(plan, 'Nova').effectiveSource, 'core');
        assert.equal(effectiveById(plan, 'Muse').effectiveSource, 'external-additive');
        assert.ok(diagnosticCodes(plan).includes('additive_duplicate_core_agent'));
        assert.equal(
            plan.skippedFiles.some(file => file.id === 'Nova' && file.skippedReason === 'additive_duplicate_core_agent'),
            true
        );
    } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
        fs.rmSync(externalPackage, { recursive: true, force: true });
    }
});

test('override Agent roots replace exact core ids only', () => {
    const projectRoot = makeTempDir();
    const coreRoot = path.join(projectRoot, 'Agent');
    const externalPackage = path.join(projectRoot, '..', 'VCPToolBox-JENN-Extensions');
    const overrideRoot = path.join(externalPackage, 'AgentOverrides');
    writeAgent(coreRoot, 'Nova.txt', 'core nova');
    writeAgent(overrideRoot, 'Nova.txt', 'override nova');
    writeAgent(overrideRoot, 'Muse.txt', 'override without core should be skipped');

    try {
        const resolver = createAgentRootResolver({
            projectRoot,
            coreAgentRoot: coreRoot,
            env: {
                VCP_AGENT_ALLOWED_ROOTS: externalPackage,
                VCP_AGENT_OVERRIDE_DIRS: overrideRoot
            }
        });
        const plan = resolver.getAgentFilePlanSync();

        const nova = effectiveById(plan, 'Nova');
        assert.equal(nova.effectiveSource, 'external-override');
        assert.equal(nova.overrides.effectiveSource, 'core');
        assert.equal(effectiveById(plan, 'Muse'), undefined);
        assert.ok(diagnosticCodes(plan).includes('override_without_core_agent'));
    } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
        fs.rmSync(externalPackage, { recursive: true, force: true });
    }
});

test('duplicate additive Agent ids are blocked unless they use override lane', () => {
    const projectRoot = makeTempDir();
    const coreRoot = path.join(projectRoot, 'Agent');
    const externalPackage = path.join(projectRoot, '..', 'VCPToolBox-JENN-Extensions');
    const additiveOne = path.join(externalPackage, 'AgentOne');
    const additiveTwo = path.join(externalPackage, 'AgentTwo');
    writeAgent(coreRoot, 'Nova.txt', 'core nova');
    writeAgent(additiveOne, 'Muse.txt', 'external muse one');
    writeAgent(additiveTwo, 'Muse.txt', 'external muse two');

    try {
        const resolver = createAgentRootResolver({
            projectRoot,
            coreAgentRoot: coreRoot,
            env: {
                VCP_AGENT_ALLOWED_ROOTS: externalPackage,
                VCP_AGENT_DIRS: [additiveOne, additiveTwo].join(path.delimiter)
            }
        });
        const plan = resolver.getAgentFilePlanSync();

        assert.equal(effectiveById(plan, 'Muse'), undefined);
        assert.ok(diagnosticCodes(plan).includes('additive_duplicate_external_agent'));
        assert.equal(
            plan.skippedFiles.filter(file => file.id === 'Muse' && file.skippedReason === 'additive_duplicate_external_agent').length,
            2
        );
    } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
        fs.rmSync(externalPackage, { recursive: true, force: true });
    }
});

test('Agent package metadata README files are not treated as Agent ids', () => {
    const projectRoot = makeTempDir();
    const coreRoot = path.join(projectRoot, 'Agent');
    const externalPackage = path.join(projectRoot, '..', 'VCPToolBox-JENN-Extensions');
    const additiveRoot = path.join(externalPackage, 'Agent');
    writeAgent(coreRoot, 'Nova.txt', 'core nova');
    writeAgent(additiveRoot, 'Muse.txt', 'external muse');
    writeAgent(additiveRoot, 'README.AGENTS_OS.md', 'metadata only');

    try {
        const resolver = createAgentRootResolver({
            projectRoot,
            coreAgentRoot: coreRoot,
            env: {
                VCP_AGENT_ALLOWED_ROOTS: externalPackage,
                VCP_AGENT_DIRS: additiveRoot
            }
        });
        const plan = resolver.getAgentFilePlanSync();

        assert.equal(effectiveById(plan, 'Muse').effectiveSource, 'external-additive');
        assert.equal(effectiveById(plan, 'README.AGENTS_OS'), undefined);
        assert.equal(plan.additiveFiles.some(file => file.relativePath === 'README.AGENTS_OS.md'), false);
    } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
        fs.rmSync(externalPackage, { recursive: true, force: true });
    }
});

test('Agent ids are derived from normalized relative paths', () => {
    assert.equal(getAgentIdFromRelativePath('Nova.txt'), 'Nova');
    assert.equal(getAgentIdFromRelativePath('Team/Muse.md'), 'Team/Muse');
    assert.equal(getAgentIdFromRelativePath('Team\\Metis.txt'), 'Team/Metis');
});

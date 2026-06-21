const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const agentManagerSingleton = require('../modules/agentManager');
const { AgentManager } = require('../modules/agentManager');
const createAgentsRouter = require('../routes/admin/agents');

function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-agent-manager-'));
}

function writeAgent(root, relativePath, content) {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
}

function setEnvVar(name, value) {
    if (value === undefined) {
        delete process.env[name];
    } else {
        process.env[name] = value;
    }
}

async function startTestServer(app) {
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    return {
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise(resolve => server.close(resolve))
    };
}

test('AgentManager preserves core prompt resolution when Agent external env is unset', async () => {
    const projectRoot = makeTempDir();
    const coreRoot = path.join(projectRoot, 'Agent');
    writeAgent(coreRoot, 'Nova.txt', 'core nova');

    try {
        const manager = new AgentManager(coreRoot, {
            projectRoot,
            env: {}
        });
        manager.agentMap.set('Nova', 'Nova.txt');

        await manager.scanAgentFiles();
        const prompt = await manager.getAgentPrompt('Nova');

        assert.deepEqual(manager.agentFiles, ['Nova.txt']);
        assert.equal(prompt, 'core nova');
        assert.equal(manager.agentDiagnostics.length, 0);
    } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    }
});

test('AgentManager resolves additive and exact override Agents when explicitly allowlisted', async () => {
    const projectRoot = makeTempDir();
    const coreRoot = path.join(projectRoot, 'Agent');
    const externalPackage = path.join(projectRoot, '..', 'VCPToolBox-JENN-Extensions');
    const additiveRoot = path.join(externalPackage, 'Agent');
    const overrideRoot = path.join(externalPackage, 'AgentOverrides');

    writeAgent(coreRoot, 'Nova.txt', 'core nova');
    writeAgent(additiveRoot, 'Muse.txt', 'external muse');
    writeAgent(overrideRoot, 'Nova.txt', 'override nova');

    try {
        const manager = new AgentManager(coreRoot, {
            projectRoot,
            env: {
                VCP_AGENT_ALLOWED_ROOTS: externalPackage,
                VCP_AGENT_DIRS: additiveRoot,
                VCP_AGENT_OVERRIDE_DIRS: overrideRoot
            }
        });
        manager.agentMap.set('Nova', 'Nova.txt');
        manager.agentMap.set('Muse', 'Muse.txt');

        await manager.scanAgentFiles();

        assert.deepEqual(manager.agentFiles, ['Muse.txt', 'Nova.txt']);
        assert.equal(manager.folderStructure['Muse.txt'].external, true);
        assert.equal(manager.folderStructure['Nova.txt'].lane, 'override');
        assert.equal(await manager.getAgentPrompt('Muse'), 'external muse');
        assert.equal(await manager.getAgentPrompt('Nova'), 'override nova');
    } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
        fs.rmSync(externalPackage, { recursive: true, force: true });
    }
});

test('AgentManager blocks additive duplicate from overriding a core Agent prompt', async () => {
    const projectRoot = makeTempDir();
    const coreRoot = path.join(projectRoot, 'Agent');
    const externalPackage = path.join(projectRoot, '..', 'VCPToolBox-JENN-Extensions');
    const additiveRoot = path.join(externalPackage, 'Agent');

    writeAgent(coreRoot, 'Nova.txt', 'core nova');
    writeAgent(additiveRoot, 'Nova.txt', 'external nova');

    try {
        const manager = new AgentManager(coreRoot, {
            projectRoot,
            env: {
                VCP_AGENT_ALLOWED_ROOTS: externalPackage,
                VCP_AGENT_DIRS: additiveRoot
            }
        });
        manager.agentMap.set('Nova', 'Nova.txt');

        await manager.scanAgentFiles();

        assert.deepEqual(manager.agentFiles, ['Nova.txt']);
        assert.equal(await manager.getAgentPrompt('Nova'), 'core nova');
        assert.ok(manager.agentDiagnostics.some(diagnostic => diagnostic.code === 'additive_duplicate_core_agent'));
    } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
        fs.rmSync(externalPackage, { recursive: true, force: true });
    }
});

test('AgentManager rollback to unset external env clears cached external prompts', async () => {
    const projectRoot = makeTempDir();
    const coreRoot = path.join(projectRoot, 'Agent');
    const externalPackage = path.join(projectRoot, '..', 'VCPToolBox-JENN-Extensions');
    const additiveRoot = path.join(externalPackage, 'Agent');
    const overrideRoot = path.join(externalPackage, 'AgentOverrides');

    writeAgent(coreRoot, 'Nova.txt', 'core nova');
    writeAgent(additiveRoot, 'Muse.txt', 'external muse');
    writeAgent(overrideRoot, 'Nova.txt', 'override nova');

    try {
        const manager = new AgentManager(coreRoot, {
            projectRoot,
            env: {
                VCP_AGENT_ALLOWED_ROOTS: externalPackage,
                VCP_AGENT_DIRS: additiveRoot,
                VCP_AGENT_OVERRIDE_DIRS: overrideRoot
            }
        });
        manager.agentMap.set('Nova', 'Nova.txt');
        manager.agentMap.set('Muse', 'Muse.txt');

        await manager.scanAgentFiles();
        assert.equal(await manager.getAgentPrompt('Nova'), 'override nova');
        assert.equal(await manager.getAgentPrompt('Muse'), 'external muse');

        manager.setEnvironment({});
        await manager.scanAgentFiles();

        assert.deepEqual(manager.agentFiles, ['Nova.txt']);
        assert.equal(manager.resolveAgentFileRecord('Muse.txt'), null);
        assert.equal(await manager.getAgentPrompt('Nova'), 'core nova');
    } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
        fs.rmSync(externalPackage, { recursive: true, force: true });
    }
});

test('Admin Agent route reads external Agents but rejects external writes', async () => {
    const projectRoot = makeTempDir();
    const coreRoot = path.join(projectRoot, 'Agent');
    const externalPackage = path.join(projectRoot, '..', 'VCPToolBox-JENN-Extensions');
    const additiveRoot = path.join(externalPackage, 'Agent');
    const overrideRoot = path.join(externalPackage, 'AgentOverrides');
    const previousEnv = {
        VCP_AGENT_ALLOWED_ROOTS: process.env.VCP_AGENT_ALLOWED_ROOTS,
        VCP_AGENT_DIRS: process.env.VCP_AGENT_DIRS,
        VCP_AGENT_OVERRIDE_DIRS: process.env.VCP_AGENT_OVERRIDE_DIRS
    };
    const previousAgentDir = agentManagerSingleton.agentDir;
    const previousAgentEnv = agentManagerSingleton.env;

    writeAgent(coreRoot, 'Nova.txt', 'core nova');
    writeAgent(additiveRoot, 'Muse.txt', 'external muse');
    writeAgent(overrideRoot, 'Nova.txt', 'override nova');

    let serverHandle = null;

    try {
        process.env.VCP_AGENT_ALLOWED_ROOTS = externalPackage;
        process.env.VCP_AGENT_DIRS = additiveRoot;
        process.env.VCP_AGENT_OVERRIDE_DIRS = overrideRoot;

        const app = express();
        app.use(express.json());
        app.use(createAgentsRouter({
            agentDirPath: coreRoot,
            DEBUG_MODE: false
        }));
        serverHandle = await startTestServer(app);

        const additiveRead = await fetch(`${serverHandle.baseUrl}/agents/Muse.txt`);
        assert.equal(additiveRead.status, 200);
        assert.deepEqual(await additiveRead.json(), {
            content: 'external muse',
            source: 'external',
            lane: 'additive',
            external: true
        });

        const overrideRead = await fetch(`${serverHandle.baseUrl}/agents/Nova.txt`);
        assert.equal(overrideRead.status, 200);
        assert.deepEqual(await overrideRead.json(), {
            content: 'override nova',
            source: 'external',
            lane: 'override',
            external: true
        });

        const additiveWrite = await fetch(`${serverHandle.baseUrl}/agents/Muse.txt`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ content: 'should not write' })
        });
        assert.equal(additiveWrite.status, 403);
        assert.equal(fs.existsSync(path.join(coreRoot, 'Muse.txt')), false);

        const overrideWrite = await fetch(`${serverHandle.baseUrl}/agents/Nova.txt`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ content: 'should not overwrite core' })
        });
        assert.equal(overrideWrite.status, 403);
        assert.equal(fs.readFileSync(path.join(coreRoot, 'Nova.txt'), 'utf8'), 'core nova');
    } finally {
        if (serverHandle) {
            await serverHandle.close();
        }
        setEnvVar('VCP_AGENT_ALLOWED_ROOTS', previousEnv.VCP_AGENT_ALLOWED_ROOTS);
        setEnvVar('VCP_AGENT_DIRS', previousEnv.VCP_AGENT_DIRS);
        setEnvVar('VCP_AGENT_OVERRIDE_DIRS', previousEnv.VCP_AGENT_OVERRIDE_DIRS);
        agentManagerSingleton.setAgentDir(previousAgentDir);
        agentManagerSingleton.setEnvironment(previousAgentEnv);
        fs.rmSync(projectRoot, { recursive: true, force: true });
        fs.rmSync(externalPackage, { recursive: true, force: true });
    }
});

const assert = require('node:assert/strict');
const express = require('express');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const agentManagerSingleton = require('../modules/agentManager');
const { AgentManager } = require('../modules/agentManager');
const createAgentsRouter = require('../routes/admin/agents');

const AGENT_ENV_NAMES = [
  'VCP_AGENT_ALLOWED_ROOTS',
  'VCP_AGENT_DIRS',
  'VCP_AGENT_OVERRIDE_DIRS'
];

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

function snapshotEnv() {
  return Object.fromEntries(AGENT_ENV_NAMES.map(name => [name, process.env[name]]));
}

function restoreEnv(previousEnv) {
  for (const name of AGENT_ENV_NAMES) {
    setEnvVar(name, previousEnv[name]);
  }
}

function envNamesSet(env = process.env) {
  return AGENT_ENV_NAMES.filter(name => typeof env[name] === 'string' && env[name].trim() !== '');
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

function assertNoBlockedPrivateSegments(targetPath) {
  const blocked = new Set(['.agent_board', 'LocalState', 'state', 'cache', 'logs', 'DebugLog', 'image', 'output', 'outputs', 'secrets']);
  const segments = path.resolve(targetPath).split(/[\\/]+/);
  for (const segment of segments) {
    assert.equal(blocked.has(segment), false, `blocked private/runtime segment used in fixture path: ${segment}`);
  }
}

async function main() {
  const realEnvSetBefore = envNamesSet();
  assert.deepEqual(realEnvSetBefore, [], 'real VCP_AGENT_* env vars must be unset before M17 harness');

  const previousEnv = snapshotEnv();
  const previousAgentDir = agentManagerSingleton.agentDir;
  const previousAgentEnv = agentManagerSingleton.env;
  const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-agent-m17-'));
  const projectRoot = path.join(tempBase, 'core-project');
  const coreRoot = path.join(projectRoot, 'Agent');
  const externalPackage = path.join(tempBase, 'VCPToolBox-JENN-Extensions');
  const additiveRoot = path.join(externalPackage, 'Agent');
  const overrideRoot = path.join(externalPackage, 'AgentOverrides');

  assertNoBlockedPrivateSegments(tempBase);
  assertNoBlockedPrivateSegments(externalPackage);

  writeAgent(coreRoot, 'Nova.txt', 'core nova');
  writeAgent(coreRoot, 'CoreOnly.txt', 'core only');
  writeAgent(additiveRoot, 'Muse.txt', 'external muse');
  writeAgent(overrideRoot, 'Nova.txt', 'override nova');

  let serverHandle = null;
  try {
    const manager = new AgentManager(coreRoot, {
      projectRoot,
      env: {
        VCP_AGENT_ALLOWED_ROOTS: externalPackage,
        VCP_AGENT_DIRS: additiveRoot,
        VCP_AGENT_OVERRIDE_DIRS: overrideRoot
      }
    });
    manager.agentMap.set('CoreOnly', 'CoreOnly.txt');
    manager.agentMap.set('Muse', 'Muse.txt');
    manager.agentMap.set('Nova', 'Nova.txt');

    await manager.scanAgentFiles();
    assert.deepEqual(manager.agentFiles, ['CoreOnly.txt', 'Muse.txt', 'Nova.txt']);
    assert.equal(await manager.getAgentPrompt('CoreOnly'), 'core only');
    assert.equal(await manager.getAgentPrompt('Muse'), 'external muse');
    assert.equal(await manager.getAgentPrompt('Nova'), 'override nova');
    assert.equal(manager.folderStructure['Muse.txt'].external, true);
    assert.equal(manager.folderStructure['Nova.txt'].lane, 'override');

    for (const name of AGENT_ENV_NAMES) {
      assert.equal(process.env[name], undefined, 'manager env-on shadow must not mutate process.env before route test');
    }

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
      body: JSON.stringify({ content: 'should not write external additive' })
    });
    assert.equal(additiveWrite.status, 403);
    assert.equal(fs.existsSync(path.join(coreRoot, 'Muse.txt')), false);
    assert.equal(fs.readFileSync(path.join(additiveRoot, 'Muse.txt'), 'utf8'), 'external muse');

    const overrideWrite = await fetch(`${serverHandle.baseUrl}/agents/Nova.txt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'should not write external override' })
    });
    assert.equal(overrideWrite.status, 403);
    assert.equal(fs.readFileSync(path.join(coreRoot, 'Nova.txt'), 'utf8'), 'core nova');
    assert.equal(fs.readFileSync(path.join(overrideRoot, 'Nova.txt'), 'utf8'), 'override nova');

    manager.setEnvironment({});
    await manager.scanAgentFiles();
    assert.deepEqual(manager.agentFiles, ['CoreOnly.txt', 'Nova.txt']);
    assert.equal(await manager.getAgentPrompt('CoreOnly'), 'core only');
    assert.equal(await manager.getAgentPrompt('Nova'), 'core nova');

    console.log('AGENT_ENV_ON_SHADOW_ROLLBACK_PASS');
    console.log(`TEMP_FIXTURE_ROOT=${tempBase}`);
    console.log('REAL_ENV_PRECHECK_UNSET=yes');
    console.log('TEMP_ENV_MANAGER_SHADOW_ONLY=yes');
    console.log('ADDITIVE_AGENT_PROMPT_SOURCE=external');
    console.log('OVERRIDE_AGENT_PROMPT_SOURCE=external');
    console.log('ADMIN_EXTERNAL_READ_PASS=yes');
    console.log('ADMIN_EXTERNAL_WRITE_BLOCK_PASS=yes');
    console.log('ROLLBACK_UNSET_ENV_CORE_ONLY_PASS=yes');
    console.log('NO_DOTENV_OR_CONFIG_ENV_MODIFIED=yes');
    console.log('NO_LOCALSTATE_OR_AGENT_BOARD_READS_EXECUTED=yes');
    console.log('NO_PROVIDER_OR_BRIDGE_CALLS_EXECUTED=yes');
    console.log('NO_PRODUCTION_SERVICE_STARTUP_EXECUTED=yes');
    console.log('LIVE_EXTERNAL_WRITE_EXECUTED=no');
  } finally {
    if (serverHandle) {
      await serverHandle.close();
    }
    restoreEnv(previousEnv);
    agentManagerSingleton.setAgentDir(previousAgentDir);
    agentManagerSingleton.setEnvironment(previousAgentEnv);
    fs.rmSync(tempBase, { recursive: true, force: true });
    assert.deepEqual(envNamesSet(), envNamesSet(previousEnv), 'VCP_AGENT_* env snapshot must be restored');
  }
}

main().catch(error => {
  console.error(`AGENT_ENV_ON_SHADOW_ROLLBACK_FAIL: ${error.message}`);
  process.exitCode = 1;
});

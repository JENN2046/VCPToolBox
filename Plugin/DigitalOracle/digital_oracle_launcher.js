const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const pluginDir = __dirname;
const targetScript = path.join(pluginDir, 'digital_oracle_vcp.py');

if (!fs.existsSync(targetScript)) {
  console.error(JSON.stringify({
    status: 'error',
    error: 'DigitalOracle Python entry script not found.',
    details: { targetScript }
  }));
  process.exit(1);
}

const candidates = [
  { command: 'python', args: [targetScript] },
  { command: 'py', args: ['-3', targetScript] },
  { command: 'python3', args: [targetScript] }
];

function trySpawn(index = 0) {
  if (index >= candidates.length) {
    console.error(JSON.stringify({
      status: 'error',
      error: 'No compatible Python launcher found for DigitalOracle.',
      details: {
        tried: candidates.map((item) => [item.command, ...item.args].join(' '))
      }
    }));
    process.exit(1);
    return;
  }

  const candidate = candidates[index];
  const child = spawn(candidate.command, candidate.args, {
    cwd: pluginDir,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true
  });

  let settled = false;

  child.on('error', (error) => {
    if (settled) return;
    settled = true;
    if (error && error.code === 'ENOENT') {
      trySpawn(index + 1);
      return;
    }

    console.error(JSON.stringify({
      status: 'error',
      error: `Failed to start DigitalOracle with ${candidate.command}.`,
      details: { message: error.message }
    }));
    process.exit(1);
  });

  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  process.stdin.pipe(child.stdin);

  child.on('spawn', () => {
    settled = true;
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

trySpawn();

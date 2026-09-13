'use strict';

const { execFile } = require('child_process');
const pm2 = require('pm2');

function execFileAsync(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        execFile(command, args, {
            windowsHide: true,
            timeout: options.timeout || 3000,
            maxBuffer: 1024 * 1024
        }, (error, stdout, stderr) => {
            if (error) {
                error.stderr = stderr;
                reject(error);
                return;
            }
            resolve(stdout);
        });
    });
}

function normalizeSystemdStatus(activeState, subState) {
    if (activeState === 'active' && subState === 'running') return 'online';
    if (activeState === 'activating') return 'launching';
    if (activeState === 'failed') return 'errored';
    return activeState || 'unknown';
}

async function listSystemdUserProcesses(options = {}) {
    const stdout = await execFileAsync('systemctl', [
        '--user',
        'list-units',
        '--type=service',
        '--all',
        '--no-legend',
        '--plain'
    ], options);

    const unitNames = stdout
        .split(/\r?\n/)
        .map(line => line.trim().split(/\s+/)[0])
        .filter(name => name && /vcp(?:toolbox)?/i.test(name));

    const processes = [];
    for (const unitName of unitNames) {
        const details = await execFileAsync('systemctl', [
            '--user',
            'show',
            unitName,
            '--property=Id,MainPID,ActiveState,SubState,ActiveEnterTimestamp,NRestarts,MemoryCurrent,CPUUsageNSec',
            '--no-pager'
        ], options);
        const properties = Object.fromEntries(details
            .split(/\r?\n/)
            .filter(line => line.includes('='))
            .map(line => {
                const index = line.indexOf('=');
                return [line.slice(0, index), line.slice(index + 1)];
            }));

        const activeSince = Date.parse(properties.ActiveEnterTimestamp || '');
        processes.push({
            name: properties.Id || unitName,
            pid: Number(properties.MainPID || 0),
            status: normalizeSystemdStatus(properties.ActiveState, properties.SubState),
            cpu: 0,
            cpuUsageNSec: Number(properties.CPUUsageNSec || 0),
            memory: Number(properties.MemoryCurrent || 0),
            uptime: Number.isFinite(activeSince) ? activeSince : 0,
            restarts: Number(properties.NRestarts || 0),
            health: properties.ActiveState === 'active' && properties.SubState === 'running'
                ? 'healthy'
                : 'unhealthy',
            unit: unitName
        });
    }

    return {
        supervisor: 'systemd-user',
        processes
    };
}

function listPm2Processes() {
    return new Promise((resolve, reject) => {
        pm2.list((error, list) => {
            if (error) {
                try { pm2.disconnect(); } catch (_) {}
                reject(error);
                return;
            }
            const result = {
                supervisor: 'pm2',
                processes: list.map(proc => ({
                    name: proc.name,
                    pid: proc.pid,
                    status: proc.pm2_env.status,
                    cpu: proc.monit.cpu,
                    memory: proc.monit.memory,
                    uptime: proc.pm2_env.pm_uptime,
                    restarts: proc.pm2_env.restart_time,
                    health: proc.pm2_env.status === 'online' ? 'healthy' : 'unhealthy'
                }))
            };
            try { pm2.disconnect(); } catch (_) {}
            resolve(result);
        });
    });
}

async function listSupervisedProcesses(options = {}) {
    if (process.platform === 'linux') {
        try {
            const systemdResult = await listSystemdUserProcesses(options);
            if (systemdResult.processes.length > 0 || process.env.NOTIFY_SOCKET) {
                return systemdResult;
            }
        } catch (_) {
            // A missing user bus is normal in containers and non-systemd hosts.
        }
    }

    return listPm2Processes();
}

module.exports = {
    listSupervisedProcesses,
    listSystemdUserProcesses,
    listPm2Processes
};

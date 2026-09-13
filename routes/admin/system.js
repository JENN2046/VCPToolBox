const { authority: approvalReceiptAuthority } = require('../../modules/approvalReceiptAuthority');
const { forwardApprovalChannel } = require('../../modules/approvalChannelProxy');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const util = require('util');
const execAsync = util.promisify(exec);
const { getAuthCode } = require('../../modules/captchaDecoder');
const { listSupervisedProcesses } = require('../../modules/supervisorAdapter');

const CPU_TEMPERATURE_URL = 'http://localhost:8085/data.json';
const CPU_TEMPERATURE_TIMEOUT_MS = 800;
const CPU_TEMPERATURE_PRIORITY = [
    'CPU Package',
    'Core Max',
    'Core Average',
    'CPU Core #1'
];

function parseTemperatureValue(value) {
    if (!value || typeof value !== 'string') {
        return null;
    }

    const matched = value.match(/-?\d+(?:\.\d+)?/);
    if (!matched) {
        return null;
    }

    const parsed = Number.parseFloat(matched[0]);
    return Number.isFinite(parsed) ? parsed : null;
}

function collectCpuTemperatureSensors(node, output = []) {
    if (!node || typeof node !== 'object') {
        return output;
    }

    if (
        node.Type === 'Temperature' &&
        typeof node.SensorId === 'string' &&
        node.SensorId.includes('/intelcpu/')
    ) {
        output.push(node);
    }

    if (Array.isArray(node.Children)) {
        node.Children.forEach(child => collectCpuTemperatureSensors(child, output));
    }

    return output;
}

function pickCpuTemperatureSensor(sensors) {
    for (const preferredName of CPU_TEMPERATURE_PRIORITY) {
        const matched = sensors.find(sensor => sensor.Text === preferredName);
        if (matched) {
            return matched;
        }
    }

    return sensors.find(sensor => !String(sensor.Text || '').includes('Distance to TjMax')) || null;
}

async function getCpuTemperature() {
    if (typeof fetch !== 'function' || typeof AbortController !== 'function') {
        return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CPU_TEMPERATURE_TIMEOUT_MS);

    try {
        const response = await fetch(CPU_TEMPERATURE_URL, {
            signal: controller.signal,
            cache: 'no-store'
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        const sensor = pickCpuTemperatureSensor(collectCpuTemperatureSensors(data));
        const value = parseTemperatureValue(sensor?.Value || sensor?.RawValue);

        if (value === null) {
            return null;
        }

        return {
            value,
            unit: '°C',
            source: sensor?.Text || '',
            sensorId: sensor?.SensorId || '',
            updatedAt: new Date().toISOString()
        };
    } catch (error) {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = function(options) {
    const router = express.Router();
    // Independent Admin process uses the same authenticated, fixed Host proxy contract.
    router.use('/human-client', require('../../modules/humanClientAdmissionRoutes').createAdminRouter());
    const { vectorDBManager, tdbKnowledgeManager } = options;

    // 保留原有 URL/`processes` 字段，当前部署优先读取 systemd user
    // units；没有 user bus 时兼容回退到 PM2。
    const listSupervisorProcesses = async (req, res) => {
        try {
            const result = await listSupervisedProcesses();
            res.json({
                success: true,
                supervisor: result.supervisor,
                health: result.processes.every(item => item.health === 'healthy')
                    ? 'healthy'
                    : 'degraded',
                processes: result.processes
            });
        } catch (error) {
            console.error('[SystemMonitor] Supervisor API Error:', error);
            res.status(500).json({
                success: false,
                supervisor: 'unavailable',
                health: 'unhealthy',
                processes: [],
                error: 'Failed to get supervised processes',
                details: error.message
            });
        }
    };
    router.get('/system-monitor/pm2/processes', listSupervisorProcesses);
    router.get('/system-monitor/supervisor/processes', listSupervisorProcesses);

    // 获取系统整体资源使用情况
    router.get('/system-monitor/system/resources', async (req, res) => {
        try {
            const systemInfo = {};
            const execOptions = { windowsHide: true };

            if (process.platform === 'win32') {
                try {
                    const { stdout: memInfo } = await execAsync('powershell -NoProfile -Command "Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize,FreePhysicalMemory | ConvertTo-Json"', execOptions);
                    const memData = JSON.parse(memInfo);
                    systemInfo.memory = {
                        total: (memData.TotalVisibleMemorySize || 0) * 1024,
                        free: (memData.FreePhysicalMemory || 0) * 1024,
                        used: ((memData.TotalVisibleMemorySize || 0) - (memData.FreePhysicalMemory || 0)) * 1024
                    };
                } catch (powershellError) {
                    const { stdout: memInfo } = await execAsync('wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /value', execOptions);
                    const memData = Object.fromEntries(memInfo.split('\r\n').filter(line => line.includes('=')).map(line => {
                        const [key, value] = line.split('=');
                        return [key.trim(), parseInt(value.trim()) * 1024];
                    }));
                    systemInfo.memory = {
                        total: memData.TotalVisibleMemorySize || 0,
                        free: memData.FreePhysicalMemory || 0,
                        used: (memData.TotalVisibleMemorySize || 0) - (memData.FreePhysicalMemory || 0)
                    };
                }

                try {
                    const { stdout: cpuInfo } = await execAsync('powershell -NoProfile -Command "Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select-Object Average | ConvertTo-Json"', execOptions);
                    const cpuData = JSON.parse(cpuInfo);
                    systemInfo.cpu = { usage: Math.round(cpuData.Average || 0) };
                } catch (powershellError) {
                    const { stdout: cpuInfo } = await execAsync('wmic cpu get loadpercentage /value', execOptions);
                    const cpuMatch = cpuInfo.match(/LoadPercentage=(\d+)/);
                    systemInfo.cpu = { usage: cpuMatch ? parseInt(cpuMatch[1]) : 0 };
                }
            } else if (process.platform === 'darwin') {
                const totalMemory = os.totalmem();
                const freeMemory = os.freemem();
                systemInfo.memory = {
                    total: totalMemory,
                    free: freeMemory,
                    used: totalMemory - freeMemory
                };
                try {
                    const { stdout: cpuInfo } = await execAsync("top -l 1 | grep 'CPU usage' | awk '{print $3}' | sed 's/%//'", execOptions);
                    systemInfo.cpu = { usage: parseFloat(cpuInfo.trim()) || 0 };
                } catch (cpuErr) {
                    systemInfo.cpu = { usage: 0 };
                }
            } else {
                try {
                    const { stdout: memInfo } = await execAsync('free -b', execOptions);
                    const memLine = memInfo.split('\n')[1].split(/\s+/);
                    systemInfo.memory = { total: parseInt(memLine[1]), used: parseInt(memLine[2]), free: parseInt(memLine[3]) };
                } catch (memErr) {
                    const totalMemory = os.totalmem();
                    const freeMemory = os.freemem();
                    systemInfo.memory = {
                        total: totalMemory,
                        free: freeMemory,
                        used: totalMemory - freeMemory
                    };
                }
                try {
                    const { stdout: cpuInfo } = await execAsync("top -bn1 | grep -E '^\\s*(%?Cpu\\(s\\)?:|CPU:)' | head -1 | awk '{print $2}'", execOptions);
                    systemInfo.cpu = { usage: parseFloat(cpuInfo.trim().replace('%', '')) || 0 };
                } catch (cpuErr) {
                    systemInfo.cpu = { usage: 0 };
                }
            }
            const cpuTemperature = await getCpuTemperature();
            if (cpuTemperature && systemInfo.cpu) {
                systemInfo.cpu.temperature = cpuTemperature;
            }

            systemInfo.nodeProcess = {
                pid: process.pid,
                memory: process.memoryUsage(),
                uptime: process.uptime(),
                version: process.version,
                platform: process.platform,
                arch: process.arch
            };
            res.json({ success: true, system: systemInfo });
        } catch (error) {
            console.error('[SystemMonitor] Error getting system resources:', error);
            res.status(500).json({ success: false, error: 'Failed to get system resources', details: error.message });
        }
    });

    // 获取记忆库内存剖面（估算）：热记忆 KnowledgeBase + 冷知识库 TDB
    router.get('/system-monitor/memory/profile', (req, res) => {
        try {
            const processMemory = process.memoryUsage();
            const knowledgeBase = vectorDBManager && typeof vectorDBManager.getMemoryProfile === 'function'
                ? vectorDBManager.getMemoryProfile()
                : { available: false, error: 'KnowledgeBaseManager profile unavailable', estimatedBytes: 0 };
            const tdbKnowledge = tdbKnowledgeManager && typeof tdbKnowledgeManager.getMemoryProfile === 'function'
                ? tdbKnowledgeManager.getMemoryProfile()
                : { available: false, error: 'TDBKnowledge profile unavailable', estimatedBytes: 0 };

            const estimatedBytes = (knowledgeBase.estimatedBytes || 0) + (tdbKnowledge.estimatedBytes || 0);

            res.json({
                success: true,
                profile: {
                    estimatedBytes,
                    processMemory,
                    knowledgeBase,
                    tdbKnowledge,
                    note: 'estimatedBytes 为诊断级估算；Rust/N-API/SQLite/TriviumDB 原生分配的真实 RSS 不能被 Node.js 按模块精确归因。',
                    generatedAt: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('[SystemMonitor] Error getting memory profile:', error);
            res.status(500).json({ success: false, error: 'Failed to get memory profile', details: error.message });
        }
    });
 
    // 获取 UserAuth 认证码
    router.get('/user-auth-code', async (req, res) => {
        const authCodePath = path.join(__dirname, '..', '..', 'Plugin', 'UserAuth', 'code.bin');
        try {
            const decryptedCode = await getAuthCode(authCodePath);
            if (decryptedCode) {
                res.json({ success: true, code: decryptedCode });
            } else {
                throw new Error('Failed to get auth code internally.');
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({ success: false, error: '认证码文件未找到。插件可能尚未运行。' });
            } else {
                res.status(500).json({ success: false, error: '读取或解密认证码文件失败。', details: error.message });
            }
        }
    });

    // 获取天气预报数据
    router.get('/weather', async (req, res) => {
        const weatherCachePath = path.join(__dirname, '..', '..', 'Plugin', 'WeatherReporter', 'weather_cache.json');
        try {
            const content = await fs.readFile(weatherCachePath, 'utf-8');
            res.json(JSON.parse(content));
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({ success: false, error: '天气缓存文件未找到。' });
            } else {
                res.status(500).json({ success: false, error: '读取天气缓存失败。', details: error.message });
            }
        }
    });

    // 获取每日热榜数据
    router.get('/dailyhot', async (req, res) => {
        const dailyHotPath = path.join(__dirname, '..', '..', 'Plugin', 'DailyHot', 'dailyhot_cache.md');
        try {
            const content = await fs.readFile(dailyHotPath, 'utf-8');
            const lines = content.split('\n');
            const newsItems = [];
            let currentSource = '';

            for (const line of lines) {
                const sourceMatch = line.match(/^##\s+(.+)$/);
                if (sourceMatch) {
                    currentSource = sourceMatch[1].trim();
                    continue;
                }

                const itemMatch = line.match(/^\d+\.\s+\[(.+?)\]\((.+?)\)/);
                if (itemMatch) {
                    newsItems.push({
                        source: currentSource,
                        title: itemMatch[1],
                        url: itemMatch[2]
                    });
                }
            }

            res.json({ success: true, data: newsItems });
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({ success: false, error: '热榜缓存文件未找到。' });
            } else {
                res.status(500).json({ success: false, error: '读取热榜缓存失败。', details: error.message });
            }
        }
    });

    // 获取 VCPLog WebSocket 通知通道连接信息（VCP_Key + PORT）
    // 用于 Vue 管理面板的右上角通知中心直连 VCP 主服务器的 VCPLog 频道
    router.get('/notifications/connection', async (req, res) => {
        try {
            let capability;
            try { approvalReceiptAuthority.assertAdminRequest(req); }
            catch { return res.status(401).json({success:false,error:'Authenticated Admin session required.'}); }
            res.setHeader('Cache-Control', 'no-store');
            const port = parseInt(process.env.PORT, 10) || 6005;
            if (!approvalReceiptAuthority.isChannelIssuer()) {
                if (req.headers['x-vcp-approval-forwarded']) return res.status(503).json({success:false,error:'Approval issuer unavailable.'});
                const forwarded = await forwardApprovalChannel(req, port);
                return res.status(forwarded.status).json(forwarded.body);
            }
            capability = approvalReceiptAuthority.issueChannel(req);

            // 反向代理场景下，WebSocket 应使用对外 Host，不应拼接内部 PORT。
            // 直连管理端口场景下，则把 Host 归一到主服务 PORT。
            const forwardedHost = (req.headers['x-forwarded-host'] || '').toString().split(',')[0].trim();
            const requestHost = (req.headers.host || '').toString().split(',')[0].trim();
            const rawHost = forwardedHost || requestHost || `localhost:${port}`;
            const hostname = rawHost.replace(/:\d+$/, '') || 'localhost';
            const forwardedProto = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0].trim();
            const proto = forwardedProto || (req.protocol === 'https' ? 'https' : 'http');
            const wsProto = proto === 'https' ? 'wss' : 'ws';
            const wsHost = forwardedHost ? rawHost : `${hostname}:${port}`;

            const deviceName = 'AdminPanel-Vue-Notifications';
            res.json({
                success: true,
                connection: {
                    vcpKey: '', // Legacy response field; no shared credential is exposed.
                    port,
                    hostname,
                    deviceName,
                    wsUrl: `${wsProto}://${wsHost}/VCPlog/admin-approval?capability=${encodeURIComponent(capability)}&deviceName=${encodeURIComponent(deviceName)}`
                }
            });
        } catch (error) {
            console.error('[Notifications] Failed to build VCPLog connection info:', error);
            res.status(500).json({
                success: false,
                error: '获取 VCPLog 连接信息失败。',
                details: error.message
            });
        }
    });

    return router;
};

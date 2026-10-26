'use strict';
const path = require('node:path');
const fs = require('node:fs');
let service = null, runtime = null, managedHost = null;
const mounted = new WeakSet();
const pending = new Set();
let draining = false;

async function initialize(config = {}) {
    await shutdown();
    if (config.ChannelHubEnabled !== true) return;
    if (!path.isAbsolute(config.ChannelHubDataDir || '')) throw new Error('CHANNELHUB_ABSOLUTE_DATA_DIR_REQUIRED');
    const timeoutMs = config.ChannelHubTimeoutMs ?? 120000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) throw new Error('CHANNELHUB_INVALID_TIMEOUT');
    const baseDir = path.resolve(config.ChannelHubDataDir);
    if (baseDir === path.parse(baseDir).root || baseDir === path.resolve(config.PROJECT_BASE_PATH || process.cwd())) throw new Error('CHANNELHUB_DEDICATED_DATA_DIR_REQUIRED');
    let current = path.parse(baseDir).root;
    for (const segment of baseDir.slice(current.length).split(path.sep).filter(Boolean)) {
        current = path.join(current, segment);
        if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('CHANNELHUB_DATA_DIR_ALIAS');
    }
    const agents = JSON.parse(config.ChannelHubAgents || '{}');
    if (!agents || Array.isArray(agents) || typeof agents !== 'object') throw new Error('CHANNELHUB_INVALID_AGENT_MAPPING');
    const { ChannelHubService } = require('./core/ChannelHubService');
    const { HostRuntime } = require('./host-runtime');
    // Plugin.js injects the host's own PORT and Key. Validate before allocating resources.
    const hostPort = Number(config.PORT);
    if (!Number.isSafeInteger(hostPort) || hostPort < 1 || hostPort > 65535
        || typeof config.Key !== 'string' || !config.Key.trim()) {
        throw new Error('CHANNELHUB_HOST_PORT_OR_KEY_UNAVAILABLE');
    }
    runtime = new HostRuntime({ agentManager: require('../../modules/agentManager'), agents, model: config.ChannelHubModel, timeoutMs });
    runtime.setEndpoint({ url: `http://127.0.0.1:${hostPort}/v1/chat/completions`, key: config.Key });
    // Adapter discovery is manifest-driven, inactive until ChannelHub is enabled.
    const { discoverAdapterFactories } = require('./adapter-loader');
    const adapterResolver = await discoverAdapterFactories({ pluginsDir: path.dirname(__dirname) });
    service = new ChannelHubService({ runtimeGateway: runtime, adapterResolver, config: {
        baseDir, deliveryMode: 'inline', enforceAdapterIdentity: true, CHANNEL_HUB_AUTH_MODE: 'enforce',
        mediaStoragePath: path.join(baseDir, 'state/channelHub/media'),
        auditLogDir: path.join(baseDir, 'state/channelHub/logs')
    } });
    try {
        await service.initialize();
        const admin = require('./routes/admin/channelHub');
        const media = require('./routes/admin/mediaGateway');
        const internal = require('./routes/internal/channelHub');
        const { ManagedAdapterHost } = require('./managed-adapters');
        managedHost = new ManagedAdapterHost({ service, adapterResolver });
        admin.initialize(service, managedHost); media.initialize(service.mediaGateway);
        internal.initialize({ channelHubService: service });
        // The HTTP client can disconnect before processing ends. Track actual
        // work as well as response lifetimes so shutdown cannot close underneath it.
        const handleInbound = service.handleInboundEvent;
        service.handleInboundEvent = (...args) => {
            const operation = handleInbound(...args);
            pending.add(operation);
            operation.finally(() => pending.delete(operation)).catch(() => {});
            return operation;
        };
        draining = false;
        // Optional QQ/NapCat must not delay VCP server bootstrap.
        // Wait for the host loopback listener before consuming QQ events.
        managedHost.startWhenHostListening(hostPort).catch(error => {
            console.error('[ChannelHub] Managed adapter bootstrap failed:', error.message);
        });
    } catch (error) {
        await shutdown();
        throw error;
    }
}

function guard(req, res, next) {
    if (!service?.initialized || draining) return res.status(503).json({ success: false, error: 'ChannelHub disabled or draining' });
    next();
}

function dispatch(modulePath) {
    return (req, res, next) => {
        const operation = new Promise(resolve => { res.once('finish', resolve); res.once('close', resolve); });
        pending.add(operation); operation.finally(() => pending.delete(operation));
        return require(modulePath).router(req, res, next);
    };
}

function registerRoutes(app, adminApiRouter, _config, _projectBasePath) {
    if (mounted.has(app)) return;
    mounted.add(app);
    // Small, bundled admin page: no Vue build or additional host routes required.
    // The host's /admin_api Basic Auth runs before these plugin-owned handlers.
    function serveUi(filename, contentType) {
        return (_req, res) => {
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            if (filename === 'index.html') {
                res.setHeader('Content-Security-Policy',
                    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
            }
            res.type(contentType).sendFile(path.join(__dirname, 'ui', filename));
        };
    }
    adminApiRouter.get('/channelHub/ui', guard, serveUi('index.html', 'html'));
    adminApiRouter.get('/channelHub/ui/app.js', guard, serveUi('app.js', 'application/javascript'));
    adminApiRouter.get('/channelHub/ui/style.css', guard, serveUi('style.css', 'text/css'));
    adminApiRouter.use('/channelHub', guard, dispatch('./routes/admin/channelHub'));
    adminApiRouter.use('/mediaGateway', guard, dispatch('./routes/admin/mediaGateway'));
    // Legacy internal URL retains the host Bearer gate. External adapters use
    // the existing plugin-callback surface with strict, per-adapter credentials.
    app.use('/internal/channelHub', guard, dispatch('./routes/internal/channelHub'));
    app.use('/plugin-callback/ChannelHub', guard, (req, res, next) => {
        if (req.method !== 'POST' || req.path !== '/events' || !req.headers['x-channel-adapter-id'] || !['2.0', 'B2'].includes(req.body?.version)) return res.status(404).end();
        next();
    }, dispatch('./routes/internal/channelHub'));
}

function setExecutionEndpoint(endpoint) { runtime?.setEndpoint(endpoint); }
function beginDrain() { draining = true; managedHost?.beginDrain(); runtime?.beginDrain(); service?.deliveryOutbox?.stop(); }
async function shutdown() {
    beginDrain();
    await runtime?.close();
    await Promise.allSettled([...pending]);
    await managedHost?.shutdown();
    await service?.shutdown();
    service = null; runtime = null; managedHost = null;
}
function snapshot() { return { ready: Boolean(service?.initialized) && !draining, deliveryMode: 'inline' }; }
module.exports = { initialize, registerRoutes, shutdown, beginDrain, setExecutionEndpoint, snapshot };

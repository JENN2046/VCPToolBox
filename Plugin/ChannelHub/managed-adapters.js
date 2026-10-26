'use strict';
const net = require('node:net');

function probeLocalListener(port) {
    return new Promise(resolve => {
        const socket = net.connect({ host: '127.0.0.1', port });
        let finished = false;
        const finish = ok => {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            socket.destroy();
            resolve(ok);
        };
        const timeout = setTimeout(() => finish(false), 250);
        socket.once('connect', () => finish(true));
        socket.once('error', () => finish(false));
    });
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generic, optional adapter runtime supervisor inside ChannelHub plugin.
 * Platform code is loaded only for explicitly active, manifest-declared drivers.
 * ChannelHub core and VCP host have no QQ-specific branching.
 */
class ManagedAdapterHost {
    constructor({ service, adapterResolver, logger = console }) {
        this.service = service;
        this.adapterResolver = adapterResolver;
        this.logger = logger;
        this.starts = new Map();
        this.stopping = false;
        this.startup = null;
        this.reconcileTimer = null;
    }

    manages(channel) {
        return Boolean(this.adapterResolver?.supportsManaged?.(channel));
    }

    async activate(adapterId) {
        if (this.stopping || !this.service?.initialized) throw new Error('CHANNELHUB_MANAGED_HOST_NOT_READY');
        if (this.starts.has(adapterId)) return this.starts.get(adapterId);
        const operation = this._activate(adapterId);
        this.starts.set(adapterId, operation);
        try { return await operation; }
        finally { this.starts.delete(adapterId); }
    }

    async _activate(adapterId) {
        const registry = this.service.adapterRegistry;
        const current = await registry.getAdapter(adapterId);
        if (!current || current.status !== 'active') return false;
        if (!this.manages(current.channel)) return false;
        if (registry.getAdapterInstance(adapterId)) return true;

        // One concrete managed endpoint has exactly one process-local owner.
        const endpoint = current.config?.wsUrl || current.options?.wsUrl;
        if (typeof endpoint !== 'string' || !endpoint.trim()) {
            throw new Error('CHANNELHUB_MANAGED_WS_ENDPOINT_REQUIRED');
        }
        const active = await registry.listAdapters({ status: 'active' });
        if (active.some(other => other.adapterId !== adapterId &&
            this.manages(other.channel) &&
            (other.config?.wsUrl || other.options?.wsUrl) === endpoint)) {
            throw new Error('CHANNELHUB_MANAGED_ENDPOINT_CONFLICT');
        }

        const onInboundEvent = async envelope => {
            if (this.stopping || !this.service.initialized) throw new Error('CHANNELHUB_MANAGED_HOST_DRAINING');
            const latest = await registry.getAdapter(adapterId);
            if (!latest || latest.status !== 'active') throw new Error('CHANNELHUB_ADAPTER_DISABLED');
            if (envelope.adapterId !== adapterId || envelope.channel !== latest.channel) {
                throw new Error('CHANNELHUB_ADAPTER_IDENTITY_MISMATCH');
            }
            return this.service.handleInboundEvent(adapterId, envelope, { source: 'managed_adapter' });
        };

        const instance = await this.service._createAdapterInstanceFromContract(current, { onInboundEvent });
        if (!instance) throw new Error('CHANNELHUB_MANAGED_ADAPTER_START_FAILED');
        return true;
    }

    /**
     * Optional channel connections are launched after the VCP host is listening.
     * A dead NapCat instance can recover without blocking/restarting VCP.
     */
    async startWhenHostListening(port) {
        const configured = await this.service.adapterRegistry.listAdapters({ status: 'active' });
        if (!configured.some(item => this.manages(item.channel))) return;
        if (this.startup) return this.startup;
        this.startup = (async () => {
            let ready = false;
            for (let attempt = 0; attempt < 120 && !this.stopping; attempt++) {
                if (await probeLocalListener(port)) { ready = true; break; }
                if (!this.stopping) await sleep(250);
            }
            if (this.stopping) return;
            if (!ready) {
                this.logger.error('[ChannelHub] Host port never became ready; optional adapter startup skipped');
                return;
            }
            await this.startActive();
            if (this.stopping) return;
            this.reconcileTimer = setInterval(() => {
                if (!this.stopping) this.startActive().catch(error => {
                    this.logger.error('[ChannelHub] Managed adapter reconcile failed: ' + error.message);
                });
            }, 30000);
            this.reconcileTimer.unref?.();
        })();
        return this.startup;
    }

    async startActive() {
        const list = await this.service.adapterRegistry.listAdapters({ status: 'active' });
        for (const entry of list) {
            if (!this.manages(entry.channel)) continue;
            try { await this.activate(entry.adapterId); }
            catch (error) {
                // Other channels remain available. Never pretend this account is connected.
                this.logger.error('[ChannelHub] Managed adapter ' + entry.adapterId + ' failed: ' + error.message);
            }
        }
    }

    async enable(adapterId) {
        await this.service.adapterRegistry.enableAdapter(adapterId);
        try { await this.activate(adapterId); }
        catch (error) {
            await this.service.adapterRegistry.disableAdapter(adapterId);
            throw error;
        }
    }

    async create(config) {
        const adapter = await this.service.adapterRegistry.upsertAdapter(config);
        if (adapter.status === 'active' && this.manages(adapter.channel)) {
            try { await this.activate(adapter.adapterId); }
            catch (error) {
                await this.service.adapterRegistry.disableAdapter(adapter.adapterId);
                throw error;
            }
        }
        return adapter;
    }

    async update(adapterId, updates) {
        const registry = this.service.adapterRegistry;
        const current = await registry.getAdapter(adapterId);
        if (!current) throw new Error('Adapter not found: ' + adapterId);
        if (this.manages(current.channel) && current.status === 'active') {
            // A bound Agent may be switched without touching the sole NapCat
            // socket. ChannelHubService reads this binding for every new event.
            const keys = Object.keys(updates || {});
            const nextConfig = updates?.config;
            const changes = nextConfig && typeof nextConfig === 'object' && !Array.isArray(nextConfig)
                ? Object.keys(nextConfig).filter(key => JSON.stringify(nextConfig[key]) !== JSON.stringify(current.config?.[key]))
                : [];
            if (keys.length === 1 && keys[0] === 'config' &&
                changes.length === 1 && changes[0] === 'agentId' &&
                typeof nextConfig.agentId === 'string' && nextConfig.agentId.trim()) {
                return registry.updateAdapter(adapterId, {
                    config: { ...(current.config || {}), agentId: nextConfig.agentId }
                });
            }
            const error = new Error('CHANNELHUB_DISABLE_MANAGED_ADAPTER_BEFORE_EDIT');
            error.httpStatus = 409;
            throw error;
        }
        if (this.manages(updates?.channel) && updates?.status === 'active') {
            const error = new Error('CHANNELHUB_DISABLE_MANAGED_ADAPTER_BEFORE_EDIT');
            error.httpStatus = 409;
            throw error;
        }
        return registry.updateAdapter(adapterId, updates);
    }

    beginDrain() {
        this.stopping = true;
        if (this.reconcileTimer) { clearInterval(this.reconcileTimer); this.reconcileTimer = null; }
    }

    async shutdown() {
        this.beginDrain();
        await Promise.allSettled([this.startup, ...this.starts.values()].filter(Boolean));
        // ChannelHubService.shutdown owns every created adapter instance.
    }
}

module.exports = { ManagedAdapterHost };

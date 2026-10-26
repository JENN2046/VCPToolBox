'use strict';

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
        const current = await this.service.adapterRegistry.getAdapter(adapterId);
        if (!current) throw new Error('Adapter not found: ' + adapterId);
        if (this.manages(current.channel) || this.manages(updates?.channel)) {
            if (current.status === 'active' || updates?.status === 'active') {
                const error = new Error('CHANNELHUB_DISABLE_MANAGED_ADAPTER_BEFORE_EDIT');
                error.httpStatus = 409;
                throw error;
            }
        }
        return this.service.adapterRegistry.updateAdapter(adapterId, updates);
    }

    beginDrain() { this.stopping = true; }

    async shutdown() {
        this.beginDrain();
        await Promise.allSettled([...this.starts.values()]);
        // ChannelHubService.shutdown owns every created adapter instance.
    }
}

module.exports = { ManagedAdapterHost };

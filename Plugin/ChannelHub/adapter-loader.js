'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Discover only explicitly declared sibling adapters. Discovery reads metadata
// but does not import platform code or start network connections.
async function discoverAdapterFactories({ pluginsDir = path.dirname(__dirname), logger = console } = {}) {
    const factories = new Map();
    const conflicts = new Set();
    const entries = await fs.readdir(pluginsDir, { withFileTypes: true });

    for (const item of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (!item.isDirectory() || item.name === 'ChannelHub') continue;
        const root = path.join(pluginsDir, item.name);
        const descriptorPath = path.join(root, 'channelhub-adapter.json');
        let manifest;
        try {
            const stat = await fs.lstat(descriptorPath);
            if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('ADAPTER_DESCRIPTOR_NOT_REGULAR_FILE');
            manifest = JSON.parse(await fs.readFile(descriptorPath, 'utf8'));
        } catch (error) {
            if (error.code === 'ENOENT') continue;
            logger.warn?.(`[ChannelHub] Ignoring invalid adapter descriptor in ${item.name}: ${error.message}`);
            continue;
        }
        try {
            if (manifest.apiVersion !== 1 ||
                (manifest.managedInbound !== undefined && typeof manifest.managedInbound !== 'boolean') ||
                !Array.isArray(manifest.channels) ||
                !manifest.channels.length ||
                new Set(manifest.channels).size !== manifest.channels.length ||
                !manifest.channels.every(x => typeof x === 'string' && /^[a-z][a-z0-9_-]{0,39}$/.test(x)) ||
                typeof manifest.entryPoint !== 'string' ||
                !/^[a-zA-Z0-9_.\/-]+$/.test(manifest.entryPoint) ||
                manifest.entryPoint.split('/').some(x => x === '..' || x === '.' || !x) ||
                typeof manifest.exportName !== 'string' ||
                !/^[A-Za-z_$][\w$]*$/.test(manifest.exportName)
            ) throw new Error('ADAPTER_DESCRIPTOR_INVALID_SCHEMA');

            const candidate = path.resolve(root, manifest.entryPoint);
            const realRoot = await fs.realpath(root);
            const realEntry = await fs.realpath(candidate);
            if (!realEntry.startsWith(realRoot + path.sep)) throw new Error('ADAPTER_ENTRY_OUTSIDE_PLUGIN');
            if (!(await fs.stat(realEntry)).isFile()) throw new Error('ADAPTER_ENTRY_NOT_FILE');
            for (const channel of manifest.channels) {
                if (conflicts.has(channel)) continue;
                if (factories.has(channel)) {
                    factories.delete(channel);
                    conflicts.add(channel);
                    logger.warn?.(`[ChannelHub] Duplicate adapter declaration for ${channel}; channel disabled`);
                } else {
                    factories.set(channel, { root: item.name, entry: realEntry, exported: manifest.exportName, managedInbound: manifest.managedInbound === true });
                }
            }
        } catch (error) {
            logger.warn?.(`[ChannelHub] Ignoring invalid adapter descriptor in ${item.name}: ${error.message}`);
        }
    }

    async function resolveAdapter(adapterConfig, adapterLogger = logger, runtimeHooks = {}) {
        const channel = adapterConfig?.channel;
        if (conflicts.has(channel)) throw new Error(`CHANNELHUB_ADAPTER_CHANNEL_CONFLICT:${channel}`);
        const declaration = factories.get(channel);
        if (!declaration) return null;

        // Path and export name come from an installed, validated manifest, never
        // from the incoming message or editable adapter configuration.
        const module = await import(pathToFileURL(declaration.entry).href);
        const AdapterClass = module[declaration.exported] || module.default?.[declaration.exported];
        if (typeof AdapterClass !== 'function') throw new Error(`CHANNELHUB_ADAPTER_EXPORT_MISSING:${channel}`);

        return new AdapterClass({
            metadata: {
                id: adapterConfig.adapterId,
                channel,
                displayName: adapterConfig.displayName || adapterConfig.name || `${channel}-adapter`,
                transportMode: adapterConfig.transportMode || 'http_webhook',
                sessionGrammar: adapterConfig.sessionGrammar || `${channel}:{conversationType}:{conversationId}`,
                capabilities: adapterConfig.capabilities || adapterConfig.capabilityProfile || {}
            },
            options: {
                logger: adapterLogger,
                ...(adapterConfig.config || {}),
                ...(adapterConfig.options || {}),
                // Private callback injected from ChannelHub after user configuration.
                ...(declaration.managedInbound && typeof runtimeHooks.onInboundEvent === 'function'
                    ? { onInboundEvent: runtimeHooks.onInboundEvent } : {})
            }
        });
    }
    resolveAdapter.supportsManaged = channel => Boolean(factories.get(channel)?.managedInbound) && !conflicts.has(channel);
    return resolveAdapter;
}

module.exports = { discoverAdapterFactories };

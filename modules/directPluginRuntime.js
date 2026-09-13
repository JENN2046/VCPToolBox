'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { createHash, randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const artifactIdentities = new WeakMap();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// Synchronous load observation only. Compile exactly the captured bytes; a
// later disk read is never used as the identity of an already-loaded module.
// External dependencies retain Node's normal loader/cache. source_files covers
// the plugin-owned graph consumed during load, not mutable runtime data.
function loadIdentityBoundDirectModule(manifest, load, manifestBytes = null, expectedIdentity = null) {
    const root = fs.realpathSync(manifest.basePath);
    const entry = fs.realpathSync(path.resolve(root, manifest.entryPoint.script));
    const inside = filename => {
        const relative = path.relative(root, filename);
        return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
    };
    if (!inside(entry)) throw new Error('PLUGIN_ENTRY_OUTSIDE_BASE');
    const bytes = manifestBytes || fs.readFileSync(path.join(root, 'plugin-manifest.json'));
    const diskManifest = JSON.parse(bytes.toString('utf8'));
    for (const key of Object.keys(diskManifest)) {
        if (!isDeepStrictEqual(diskManifest[key], JSON.parse(JSON.stringify(manifest[key]) ?? 'null'))) throw new Error('PLUGIN_MANIFEST_CHANGED_DURING_LOAD');
    }
    if (expectedIdentity && sha256(bytes) !== expectedIdentity.manifest_sha256) throw new Error('PLUGIN_ACCEPTED_IDENTITY_MISMATCH');
    const files = new Map();
    const originals = {};
    for (const extension of ['.js', '.json', '.node']) {
        originals[extension] = Module._extensions[extension];
        Module._extensions[extension] = (module, filename) => {
            if (!inside(filename)) return originals[extension](module, filename);
            // Native addons under a plugin root need a separate byte-binding
            // contract. Do not report a pre-dlopen disk digest as loaded code.
            if (extension === '.node') throw new Error('PLUGIN_LOCAL_NATIVE_IDENTITY_UNSUPPORTED');
            const source = fs.readFileSync(filename);
            if (filename === entry && expectedIdentity && sha256(source) !== expectedIdentity.source_sha256) throw new Error('PLUGIN_ACCEPTED_IDENTITY_MISMATCH');
            files.set(filename, sha256(source));
            if (extension === '.json') module.exports = JSON.parse(source.toString('utf8').replace(/^\uFEFF/, ''));
            else module._compile(source.toString('utf8'), filename);
        };
    }
    try {
        const exports = load(entry);
        if (!files.has(entry)) throw new Error('PLUGIN_ENTRY_IDENTITY_NOT_CAPTURED');
        const sourceFiles = Object.freeze(Array.from(files, ([resolved_path, source_sha256]) =>
            Object.freeze({ resolved_path, source_sha256 })).sort((a, b) => a.resolved_path.localeCompare(b.resolved_path)));
        const identity = Object.freeze({
            plugin_name: manifest.name,
            resolved_entry_path: entry,
            source_sha256: files.get(entry),
            manifest_sha256: sha256(bytes),
            source_files: sourceFiles,
            source_graph_sha256: sha256(JSON.stringify(sourceFiles)),
            scope: 'plugin_owned_load_time_graph'
        });
        artifactIdentities.set(exports, identity);
        return exports;
    } finally {
        for (const extension of Object.keys(originals)) Module._extensions[extension] = originals[extension];
    }
}


/**
 * Runtime V2 adapter for resident/direct plugins.
 *
 * Native Runtime V2 modules export createRuntime(context). During the one-cycle
 * compatibility window, built-in modules that still expose the historical
 * initialize/processMessages/processToolCall/shutdown surface are adapted to the
 * same lifecycle. The adapter deliberately performs no initialization in
 * prepare(), so discovery can fail without disturbing the active generation.
 */
class DirectPluginRuntime {
    constructor(moduleExports, context) {
        this.moduleExports = moduleExports;
        const artifact = artifactIdentities.get(moduleExports);
        // Object-only isolated fixtures have no source artifact. Production
        // PluginManager loaders always supply an observed artifact identity.
        Object.defineProperty(this, 'loadedIdentity', { enumerable: true, value: artifact
            ? Object.freeze({ ...artifact, instance_id: randomUUID(), generation: context.generationId ?? null })
            : null });
        this.context = context;
        this.instance = null;
        this.prepared = false;
        this.started = false;
        this.startCount = 0;
    }

    async prepare() {
        if (this.prepared) return this;

        const factory = this.moduleExports?.createRuntime;
        this.instance = typeof factory === 'function'
            ? await factory(this.context)
            : this.moduleExports;

        if (!this.instance || (typeof this.instance !== 'object' && typeof this.instance !== 'function')) {
            throw new Error(`Runtime factory for ${this.context.manifest.name} did not return a runtime object.`);
        }

        if (typeof this.instance.prepare === 'function') {
            await this.instance.prepare();
        }
        this.prepared = true;
        return this;
    }

    async start() {
        if (this.started) return;
        if (!this.prepared) await this.prepare();

        try {
            if (typeof this.instance.start === 'function') {
                await this.instance.start();
            } else if (typeof this.instance.initialize === 'function') {
                await this.instance.initialize(this.context.config, this.context.dependencies);
            }

            this.started = true;
            this.startCount += 1;
        } catch (error) {
            // initialize() may have opened a watcher or port before failing.
            // Give the module one idempotent cleanup opportunity even though it
            // never reached the RUNNING state.
            if (typeof this.instance.shutdown === 'function') {
                try {
                    await this.instance.shutdown();
                } catch (shutdownError) {
                    error.cleanupError = shutdownError;
                }
            }
            throw error;
        }
    }

    async process(args, requestContext) {
        if (!this.started) {
            const error = new Error(`Plugin ${this.context.manifest.name} is not running.`);
            error.code = 'PLUGIN_NOT_RUNNING';
            throw error;
        }
        const handler = this.instance.process || this.instance.processToolCall;
        if (typeof handler !== 'function') {
            throw new Error(`Plugin ${this.context.manifest.name} has no process/processToolCall handler.`);
        }
        return handler.call(this.instance, args, requestContext);
    }

    async processMessages(messages, requestContext) {
        if (!this.started) {
            const error = new Error(`Plugin ${this.context.manifest.name} is not running.`);
            error.code = 'PLUGIN_NOT_RUNNING';
            throw error;
        }
        if (typeof this.instance.processMessages !== 'function') {
            throw new Error(`Plugin ${this.context.manifest.name} has no processMessages handler.`);
        }
        return this.instance.processMessages(messages, requestContext);
    }

    async shutdown() {
        if (!this.prepared) return;
        if (!this.started) {
            // A custom prepare() may allocate reversible in-memory resources.
            if (typeof this.instance.shutdownPrepared === 'function') {
                await this.instance.shutdownPrepared();
            }
            return;
        }

        // Set the state before awaiting so concurrent shutdown calls are
        // idempotent. A failed shutdown remains stopped from the dispatcher's
        // perspective and is reported to the host.
        this.started = false;
        if (typeof this.instance.shutdown === 'function') {
            await this.instance.shutdown();
        }
    }

    async health() {
        if (typeof this.instance?.health === 'function') {
            return this.instance.health();
        }
        return {
            status: this.started ? 'ready' : (this.prepared ? 'stopped' : 'new'),
            startCount: this.startCount
        };
    }

    async getReloadBlockers() {
        if (typeof this.instance?.getReloadBlockers !== 'function') return [];
        const blockers = await this.instance.getReloadBlockers();
        return Array.isArray(blockers) ? blockers : [];
    }

    get routeModule() {
        return this.instance || this.moduleExports;
    }
}

function createDirectPluginRuntime(moduleExports, context) {
    return new DirectPluginRuntime(moduleExports, context);
}

module.exports = {
    loadIdentityBoundDirectModule,
    DirectPluginRuntime,
    createDirectPluginRuntime
};

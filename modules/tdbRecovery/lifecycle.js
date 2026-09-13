'use strict';
const d = require('./durable');
const mutations = new Set([
    'batchInsert',
    'insert',
    'insertWithId',
    'batchInsertWithIds',
    'delete',
    'link',
    'unlink',
    'indexText',
    'indexKeyword',
    'buildTextIndex',
    'compact',
    'flush',
    'close',
    'tqlMut',
    'publishGenerationManifest'
]);
function protectHandle(runtime, library, handle) {
    const db = handle.db;
    handle.db = new Proxy(db, {
        get(target, key) {
            const value = target[key];
            if (typeof value !== 'function')
                return value;
            return (...args) => {
                const context = runtime.admission.context.getStore();
                if (!runtime.admission.has(library))
                    d.fail('UNREGISTERED_NATIVE_HANDLE');
                if (mutations.has(key) && !context.exclusive)
                    runtime.journal.bump(library, 'live');
                return value.apply(target, args);
            };
        }
    });
    return handle;
}
async function strictClose(runtime, library) {
    const m = runtime.manager;
    const context = runtime.admission.context.getStore();
    if (!context?.exclusive || !runtime.admission.has(library))
        d.fail('STRICT_CLOSE_REQUIRES_EXCLUSIVE');
    const queued = m.libraryQueues.get(library);
    if (queued)
        await queued;
    const handle = m.libs.get(library);
    if (!handle)
        return;
    if (handle.busyCount)
        d.fail('HELD_NATIVE_HANDLE');
    // Unlike compatibility helpers, every persistence error propagates and keeps admission closed.
    handle.db.buildTextIndex();
    handle.db.compact();
    handle.db.flush();
    handle.db.close();
    m.libs.delete(library);
    m.dirtyTextIndexLibraries.delete(library);
}
function attach(runtime) {
    const m = runtime.manager, a = runtime.admission;
    const queue = m._withLibraryQueue.bind(m);
    m._withLibraryQueue = (lib, fn) => a.use(lib, () => queue(lib, fn));
    const open = m.getOrOpenLibrary.bind(m);
    m.getOrOpenLibrary = lib => {
        if (!a.has(lib))
            d.fail('UNREGISTERED_NATIVE_HANDLE');
        const existing = m.libs.has(lib);
        const h = open(lib);
        if (!existing)
            protectHandle(runtime, lib, h);
        return h;
    };
    for (const method of [
            '_upsertFileUnlocked',
            '_deleteFileUnlocked'
        ]) {
        const original = m[method].bind(m);
        m[method] = async (file, ...args) => {
            const lib = m._resolveLibrary(file).library;
            return a.use(lib, async () => {
                runtime.journal.bump(lib, 'live');
                return original(file, ...args);
            });
        };
    }
    const after = m._afterSuccessfulIngest.bind(m);
    m._afterSuccessfulIngest = lib => {
        a.assert(lib);
        return a.useSync(lib, () => after(lib));
    };
    const map = m._mapSearchHit.bind(m);
    m._mapSearchHit = (lib, hit) => ({
        ...map(lib, hit),
        generation: runtime.journal.epoch(lib).generation
    });
    async function many(libs, fn, i = 0) {
        if (i === libs.length)
            return fn();
        return a.use(libs[i], () => many(libs, fn, i + 1));
    }
    const search = m.searchWithVector.bind(m);
    m.searchWithVector = (vector, text, options = {}) => many(options.libraries?.length ? options.libraries : m.listLibraries(), () => search(vector, text, options));
    const fileSearch = m.searchFileWithVector.bind(m);
    m.searchFileWithVector = (lib, source, vector, options = {}) => a.use(lib, () => fileSearch(lib, source, vector, {
        ...options,
        generation: runtime.journal.epoch(lib).generation
    }));
    for (const method of [
            'reachable',
            'subgraph',
            'searchGraphFirst'
        ]) {
        const original = m[method].bind(m);
        m[method] = (lib, ...args) => {
            const options = args[args.length - 1] || {};
            const generation = runtime.journal.epoch(lib).generation;
            if (runtime.journal.all().some(j => j.library === lib && j.commit_receipt) && options.generation !== generation)
                d.fail('STALE_OR_UNQUALIFIED_ANCHOR');
            return original(lib, ...args);
        };
    }
    const expand = m._expandHits.bind(m);
    m._expandHits = hits => many([...new Set(hits.map(h => h.library))], () => {
        for (const h of hits)
            if (h.generation !== runtime.journal.epoch(h.library).generation)
                d.fail('STALE_EXPANSION');
        return expand(hits);
    });
}
module.exports = {
    strictClose,
    attach
};

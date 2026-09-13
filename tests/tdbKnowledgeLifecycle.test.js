'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

// Evaluate the real manager with an explicit dependency allowlist. No native DB,
// production filesystem, environment, watcher, timer or embedding API is used.
const source = fs.readFileSync(path.join(__dirname, '..', 'TDBKnowledge.js'), 'utf8');

function fixture() {
    const events = [];
    const content = 'A small cold knowledge document.';
    const root = path.resolve('/virtual/tdb-lifecycle');
    const file = path.join(root, 'knowledge', 'Library', 'doc.md');
    const stats = { size: Buffer.byteLength(content), mtimeMs: 100 };
    const state = { old: undefined, document: undefined, chunks: [], embeddings: 0, writes: 0 };
    const meta = {
        pragma() {},
        transaction: fn => fn,
        prepare(sql) {
            return {
                get() {
                    if (sql.startsWith('SELECT checksum')) return state.old;
                    if (sql.startsWith('SELECT doc_node_id')) return state.document;
                    throw new Error(`Unexpected fake metadata query: ${sql}`);
                },
                all() {
                    if (sql.includes('FROM chunks')) return state.chunks;
                    if (sql === 'SELECT DISTINCT library FROM files') return [{ library: 'FromMeta' }];
                    throw new Error(`Unexpected fake metadata query: ${sql}`);
                },
                run() { state.writes++; }
            };
        },
        close() { events.push('meta.close'); }
    };
    const fakeFs = {
        promises: {
            async stat(name) { assert.equal(name, file); return stats; },
            async readFile(name) { assert.equal(name, file); return content; },
            async mkdir(name) {
                assert.ok([path.join(root, 'knowledge'), path.join(root, 'store')].includes(name));
            }
        },
        existsSync(name) { assert.equal(name, path.join(root, 'store')); return true; },
        readdirSync(name) {
            assert.equal(name, path.join(root, 'store'));
            return ['FromDisk.tdb', 'ignore.sqlite'];
        }
    };
    let nextId = 1;
    const db = {
        buildTextIndex() { events.push('build'); },
        compact() { events.push('compact'); },
        flush() { events.push('flush'); },
        close() { events.push('close'); },
        batchInsert(vectors) { return vectors.map(() => nextId++); },
        indexText() { events.push('indexText'); },
        link() { events.push('link'); },
        delete(id) { events.push(`delete:${id}`); }
    };
    const modules = {
        fs: fakeFs,
        path,
        crypto,
        'better-sqlite3': function FakeMetadata(name) {
            assert.equal(name, path.join(root, 'store', 'tdb_knowledge_meta.sqlite'));
            return meta;
        },
        chokidar: {},
        './TextChunker': { chunkText: text => [text] },
        './EmbeddingUtils': {
            async getEmbeddingsBatch(texts) {
                state.embeddings++;
                return texts.map(() => [1, 0]);
            }
        },
        triviumdb: { TriviumDB: function ForbiddenNativeOpen() { throw new Error('Unexpected DB open'); } },
        './rust-vexus-lite': {}
    };
    const module = { exports: {} };
    vm.runInNewContext(source, {
        module,
        __dirname: root,
        process: { env: {} },
        console: { log() {}, warn() {}, error() {} },
        require(name) {
            if (!Object.hasOwn(modules, name)) throw new Error(`Unmocked dependency: ${name}`);
            return modules[name];
        },
        setInterval() { throw new Error('Unexpected timer'); },
        setTimeout() { throw new Error('Unexpected timer'); },
        clearInterval() {},
        clearTimeout() {}
    }, { filename: 'TDBKnowledge.js' });
    const manager = module.exports;
    manager.config.rootPath = path.join(root, 'knowledge');
    manager.config.storePath = path.join(root, 'store');
    manager.metaDb = meta;
    const handle = { db, busyCount: 0, lastUsedAt: Date.now(), openedAt: Date.now() };
    manager.libs.set('Library', handle);
    return { manager, db, meta, handle, events, state, file, stats, content };
}

test('F07 helper calls buildTextIndex and owns no lifecycle state', () => {
    const { manager, db, events, handle } = fixture();
    manager._markTextIndexDirty('Library');
    const dirty = manager.dirtyTextIndexLibraries;
    const queues = manager.libraryQueues;
    const worker = Promise.resolve();
    manager.activeQueueWorkerPromise = worker;
    manager.processedSinceFlush = 7;
    assert.equal(typeof manager._safeBuildTextIndex, 'function');
    manager._safeBuildTextIndex(db);
    assert.deepEqual(events, ['build']);
    assert.equal(manager.dirtyTextIndexLibraries, dirty);
    assert.deepEqual([...dirty], ['Library']);
    assert.equal(manager.libraryQueues, queues);
    assert.equal(queues.size, 0);
    assert.equal(manager.activeQueueWorkerPromise, worker);
    assert.equal(manager.processedSinceFlush, 7);
    assert.equal(manager.isShuttingDown, false);
    assert.equal(manager.libs.get('Library'), handle);
    assert.equal(handle.busyCount, 0);
});

test('F07 helper tolerates a throwing or unavailable buildTextIndex', () => {
    const { manager } = fixture();
    let calls = 0;
    assert.doesNotThrow(() => manager._safeBuildTextIndex({ buildTextIndex() {
        calls++;
        throw new Error('unsupported index');
    } }));
    assert.equal(calls, 1);
    assert.doesNotThrow(() => manager._safeBuildTextIndex({}));
});

test('closeLibrary executes build/compact/flush/close and removes the opened handle', async () => {
    const { manager, events } = fixture();
    assert.equal(await manager.closeLibrary('Library'), true);
    assert.deepEqual(events, ['build', 'compact', 'flush', 'close']);
    assert.equal(manager.libs.has('Library'), false);
    assert.equal(await manager.closeLibrary('Library'), false);
});

test('build compatibility failure does not prevent the remaining close steps', async () => {
    const { manager, db, events } = fixture();
    db.buildTextIndex = () => { events.push('build'); throw new Error('unsupported index'); };
    assert.equal(await manager.closeLibrary('Library'), true);
    assert.deepEqual(events, ['build', 'compact', 'flush', 'close']);
    assert.equal(manager.libs.size, 0);
});

test('a real close error propagates and retains the opened handle', async () => {
    const { manager, db, events, handle } = fixture();
    const error = new Error('native close failed');
    db.close = () => { events.push('close'); throw error; };
    await assert.rejects(manager.closeLibrary('Library'), candidate => candidate === error);
    assert.deepEqual(events, ['build', 'compact', 'flush', 'close']);
    assert.equal(manager.libs.get('Library'), handle);
});

test('busy handles are not closed', async () => {
    const { manager, handle, events } = fixture();
    handle.busyCount = 1;
    assert.equal(await manager.closeLibrary('Library'), false);
    assert.deepEqual(events, []);
    assert.equal(manager.libs.get('Library'), handle);
});

test('idle reclamation uses real close lifecycle and preserves fresh/busy handles', async () => {
    const { manager, handle, db, events } = fixture();
    manager.initialized = true;
    manager.config.idleUnloadHours = 1;
    handle.lastUsedAt = Date.now() - 2 * 3600 * 1000;
    manager.libs.set('Busy', { ...handle, busyCount: 1 });
    manager.libs.set('Fresh', { db, busyCount: 0, lastUsedAt: Date.now() });
    await manager._evictIdleLibraries();
    assert.deepEqual(events, ['build', 'compact', 'flush', 'close']);
    assert.deepEqual([...manager.libs.keys()], ['Busy', 'Fresh']);
});

test('T01 rebuild clears successful libraries, retains failures, and retries', async () => {
    const { manager, db, events, handle } = fixture();
    let fails = true;
    manager.libs.set('Retry', { ...handle, db: { ...db, buildTextIndex() {
        events.push('retry.build');
        if (fails) throw new Error('temporary index failure');
    } } });
    manager._markTextIndexDirty('Library');
    manager._markTextIndexDirty('Retry');
    await manager._rebuildDirtyTextIndexes('test');
    assert.deepEqual([...manager.dirtyTextIndexLibraries], ['Retry']);
    assert.deepEqual(events, ['build', 'flush', 'retry.build']);
    assert.equal(handle.busyCount, 0);
    assert.equal(manager.libs.get('Retry').busyCount, 0);
    fails = false;
    await manager._rebuildDirtyTextIndexes('retry');
    assert.equal(manager.dirtyTextIndexLibraries.size, 0);
    assert.deepEqual(events, ['build', 'flush', 'retry.build', 'retry.build', 'flush']);
});

test('T01 a missing buildTextIndex remains dirty even though the close helper tolerates it', async () => {
    const { manager, db } = fixture();
    delete db.buildTextIndex;
    manager._markTextIndexDirty('Library');
    await manager._rebuildDirtyTextIndexes('test');
    assert.equal(manager.dirtyTextIndexLibraries.has('Library'), true);
    assert.equal(await manager.closeLibrary('Library'), true);
    assert.equal(manager.dirtyTextIndexLibraries.has('Library'), true);
});

test('T02 initialize schedules existing metadata/disk libraries for sparse repair', async () => {
    const { manager } = fixture();
    manager.config.enabled = true;
    manager.config.fullScanOnStartup = false;
    // Only unrelated schema/watcher/periodic startup side effects are replaced.
    manager._initSchema = () => {};
    manager._recoverStaleQueueJobs = () => {};
    manager._startWatcher = () => {};
    manager._startQueueWorker = () => {};
    manager._startIdleEvictor = () => {};
    await manager.initialize();
    assert.equal(manager.initialized, true);
    assert.deepEqual([...manager.dirtyTextIndexLibraries].sort(), ['FromDisk', 'FromMeta']);
});

test('T03 checksum/size no-op returns false without embedding, writes or dirtying', async () => {
    const { manager, file, state, stats, content, events } = fixture();
    state.old = {
        checksum: crypto.createHash('sha256').update(content).digest('hex'),
        size: stats.size,
        mtime: stats.mtimeMs
    };
    assert.equal(await manager.upsertFile(file), false);
    assert.equal(state.embeddings, 0);
    assert.equal(state.writes, 0);
    assert.equal(manager.dirtyTextIndexLibraries.size, 0);
    assert.deepEqual(events, []);
});

test('T03 material upsert returns true and dirties only its own library', async () => {
    const { manager, file, state, events, handle } = fixture();
    assert.equal(await manager.upsertFile(file), true);
    assert.equal(state.embeddings, 2); // Fake document and chunk embeddings only.
    assert.ok(state.writes > 0);
    assert.ok(events.includes('indexText'));
    assert.deepEqual([...manager.dirtyTextIndexLibraries], ['Library']);
    assert.equal(handle.busyCount, 0);
});

test('T03 absent delete returns false without deleting, writing, flushing or dirtying', async () => {
    const { manager, file, state, events, handle } = fixture();
    assert.equal(await manager.deleteFile(file), false);
    assert.deepEqual(events, []);
    assert.equal(state.writes, 0);
    assert.equal(manager.dirtyTextIndexLibraries.size, 0);
    assert.equal(handle.busyCount, 0);
});

test('T03 material delete returns true and preserves flush/dirty accounting', async () => {
    const { manager, file, state, events } = fixture();
    state.document = { doc_node_id: 1 };
    state.chunks = [{ node_id: 2 }];
    assert.equal(await manager.deleteFile(file), true);
    assert.deepEqual(events, ['delete:2', 'delete:1', 'flush']);
    assert.equal(state.writes, 2);
    assert.deepEqual([...manager.dirtyTextIndexLibraries], ['Library']);
});

test('T04 shutdown waits an active real queue worker, rebuilds, then closes libraries and metadata', async () => {
    const { manager, events } = fixture();
    let release;
    const blocked = new Promise(resolve => { release = resolve; });
    let claims = 0;
    manager._claimQueueJobs = () => ++claims === 1 ? [{ action: 'upsert' }] : [];
    manager._processUpsertJob = async () => {
        events.push('worker.start');
        await blocked;
        manager._markTextIndexDirty('Library');
        events.push('worker.end');
    };
    manager._completeQueueJob = () => events.push('job.complete');
    manager._failQueueJob = () => assert.fail('worker unexpectedly failed');
    const working = manager._runQueueWorker();
    assert.ok(manager.activeQueueWorkerPromise);
    const joining = manager._runQueueWorker();
    const stopping = manager.shutdown();
    try {
        await Promise.resolve();
        await Promise.resolve();
        assert.deepEqual(events, ['worker.start']);
        assert.equal(manager.isShuttingDown, true);
        assert.equal(manager.libs.size, 1);
        assert.equal(claims, 1);
    } finally {
        release();
        await Promise.all([working, joining, stopping]);
    }
    assert.deepEqual(events, [
        'worker.start', 'worker.end', 'job.complete', 'build', 'flush',
        'build', 'compact', 'flush', 'close', 'meta.close'
    ]);
    assert.equal(manager.activeQueueWorkerPromise, null);
    assert.equal(manager.isQueueWorkerRunning, false);
    assert.equal(manager.isProcessing, false);
    assert.equal(manager.dirtyTextIndexLibraries.size, 0);
    assert.equal(manager.libs.size, 0);
    assert.equal(manager.metaDb, null);
});

test('shutdown retries a failed queue-drain rebuild before closing', async () => {
    const { manager, db, events } = fixture();
    manager._claimQueueJobs = () => [];
    manager._markTextIndexDirty('Library');
    let builds = 0;
    db.buildTextIndex = () => {
        events.push('build');
        if (++builds === 1) throw new Error('first rebuild fails');
    };
    await manager.shutdown();
    assert.deepEqual(events, ['build', 'build', 'flush', 'build', 'compact', 'flush', 'close', 'meta.close']);
    assert.equal(manager.dirtyTextIndexLibraries.size, 0);
    assert.equal(manager.libs.size, 0);
});

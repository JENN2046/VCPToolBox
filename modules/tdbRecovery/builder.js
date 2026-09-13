'use strict';
const d = require('./durable');
const {fingerprint} = require('./snapshot');
const {witness, pending, bundle} = require('./artifacts');
async function build(runtime, job, snapshot) {
    const m = runtime.manager, root = runtime.jobPath(job, 'candidate'), knowledge = d.mkdir(runtime.root, d.path.join(root, 'knowledge')), store = d.mkdir(runtime.root, d.path.join(root, 'store'));
    // Estimate canonical copies, vectors/graph/index expansion and live/backup/install/rollback reserves.
    let chunks = 0;
    for (const file of snapshot.files) {
        const bytes = d.read(runtime.root, d.path.join(runtime.jobPath(job, 'snapshot'), file.path));
        if (d.hash(bytes) !== file.hash)
            d.fail('SNAPSHOT_HASH_MISMATCH');
        chunks += runtime.chunkText(bytes.toString('utf8')).filter(Boolean).length;
    }
    const nodes = chunks + snapshot.files.length;
    const liveBytes = Object.values(bundle(m.config.storePath, job.library)).reduce((n, a) => n + a.bytes, 0);
    const candidateEstimate = snapshot.bytes * 8 + nodes * (m.config.dimension * 16 + 4096);
    const required = candidateEstimate * 4 + liveBytes * 3 + (runtime.options.minimumFreeBytes ?? 64 * 1024 * 1024);
    d.capacity(runtime.root, required);
    for (const file of snapshot.files) {
        const bytes = d.read(runtime.root, d.path.join(runtime.jobPath(job, 'snapshot'), file.path));
        if (d.hash(bytes) !== file.hash)
            d.fail('SNAPSHOT_HASH_MISMATCH');
        d.write(runtime.root, d.path.join(knowledge, file.path), bytes);
    }
    const candidate = new m.constructor({
        ...m.config,
        rootPath: knowledge,
        storePath: store,
        recovery: false,
        fullScanOnStartup: false
    });
    candidate._startWatcher = () => {
    };
    candidate._startQueueWorker = () => {
    };
    candidate._startIdleEvictor = () => {
    };
    try {
        await candidate.initialize();
        for (const file of snapshot.files) {
            if (file.disposition === 'NO_TEXT_EXPECTED')
                continue;
            await runtime.checkpoint('BUILD_SOURCE');
            if (!await candidate._upsertFileUnlocked(d.path.join(knowledge, file.path)))
                d.fail('PARTIAL_CANDIDATE');
        }
        for (const [lib, handle] of candidate.libs) {
            handle.db.buildTextIndex();
            handle.db.compact();
            handle.db.flush();
            handle.db.close();
            candidate.libs.delete(lib);
        }
        if (pending(store, job.library, candidate.metaDb))
            d.fail('PENDING_CANDIDATE_WORK');
        candidate.metaDb.pragma('wal_checkpoint(TRUNCATE)');
        candidate.metaDb.close();
        candidate.metaDb = null;
        const copied = fingerprint(m, job.library, knowledge);
        if (copied.excluded.length || d.digest({
                library: copied.library,
                files: copied.files,
                excluded: snapshot.excluded,
                recipe: copied.recipe
            }) !== snapshot.fingerprint)
            d.fail('CANDIDATE_SOURCE_CHANGED');
        const receipt = {
            job_id: job.job_id,
            generation: job.candidate_generation,
            source: snapshot.fingerprint,
            recipe: d.digest(snapshot.recipe),
            capacity_receipt: {
                required_bytes: required,
                estimated_nodes: nodes
            },
            ...witness(store, job.library, undefined, false)
        };
        d.write(runtime.root, runtime.jobPath(job, 'candidate.json'), d.canonical(receipt));
        return receipt;
    } finally {
        for (const handle of candidate.libs.values()) {
            try {
                handle.db.close();
            } catch {
            }
        }
        if (candidate.metaDb?.open)
            candidate.metaDb.close();
    }
}
module.exports = { build };

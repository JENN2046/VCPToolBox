'use strict';
const {Journal} = require('./journal');
const {Admission} = require('./admission');
const {reconcile} = require('./reconcile');
const {Scheduler} = require('./scheduler');
const {Coordinator} = require('./coordinator');
const {snapshot} = require('./snapshot');
const {build} = require('./builder');
const {verify} = require('./verifier');
const {publish} = require('./publish');
const {rollback} = require('./rollback');
const {retire} = require('./retirement');
const {attach} = require('./lifecycle');
const {inspectLibrary} = require('./inspector');
const artifacts = require('./artifacts');
const d = require('./durable');
class RecoveryRuntime {
    constructor(manager, options = {}) {
        this.manager = manager;
        this.options = options;
        this.admission = new Admission();
        this.active = new Set();
        this.stopping = false;
        this.autoPublish = false;
        this.root = d.path.join(manager.config.storePath, '.recovery');
        this.native = require('triviumdb').TriviumDB;
        this.chunkText = require('../../TextChunker').chunkText;
    }
    async initialize() {
        this.journal = new Journal(this.root);
        console.info('[TDBRecovery] journal_open; reconciliation_begin');
        this.scheduler = new Scheduler(this.journal);
        this.coordinator = new Coordinator(this);
        await reconcile(this.journal, this.admission, {
            rollback: job => this.rollback(job),
            committed: job => this.resumeCommitted(job)
        });
        console.info('[TDBRecovery] reconciliation_complete; normal_discovery_pending');
        require('./writer-marker').installMarker(this.manager.config.rootPath, this.root);
        attach(this);
    }
    jobPath(job, ...parts) {
        if (!/^[a-f0-9-]{36}$/.test(job.job_id))
            d.fail('UNSAFE_JOB');
        return d.contained(this.root, d.path.join(this.root, 'jobs', job.job_id, ...parts), { missing: true });
    }
    assertWriters(library) {
        const inventory = this.options.writerInventory?.[library];
        if (!Array.isArray(inventory) || !inventory.length)
            d.fail('WRITER_INVENTORY_UNQUALIFIED');
        for (const writer of inventory) {
            if (writer.classification === 'READ_ONLY')
                continue;
            if (writer.classification === 'LEASE_AWARE' && writer.protocol === 'VCP_TDB_SOURCE_LEASE_V1')
                continue;
            if (writer.classification === 'QUIESCABLE' && typeof writer.isQuiesced === 'function' && writer.isQuiesced() === true)
                continue;
            d.fail('UNCOORDINATED_WRITER');
        }
        if (this.options.sourceOwned?.[library] !== true)
            d.fail('CANONICAL_OWNERSHIP_UNQUALIFIED');
    }
    inspect(library) {
        return inspectLibrary({
            store: this.manager.config.storePath,
            library,
            generation: this.journal.db.prepare('SELECT source,live,generation FROM epochs WHERE library=?').get(library) || null
        });
    }
    checkpointSync(point) {
        if (this.options.checkpoint)
            this.options.checkpoint(point);
    }
    async checkpoint(point) {
        if (this.stopping && [
                'BUILD_SOURCE',
                'SNAPSHOTTING',
                'BUILT',
                'VERIFIED'
            ].includes(point))
            d.fail('RECOVERY_CANCELLED');
        if (this.options.checkpoint)
            await this.options.checkpoint(point);
    }
    request(input) {
        return this.coordinator.request(input);
    }
    run(id) {
        if (this.stopping)
            return Promise.reject(Object.assign(new Error('RECOVERY_SHUTTING_DOWN'), { code: 'RECOVERY_SHUTTING_DOWN' }));
        const promise = this.execute(id);
        this.active.add(promise);
        promise.finally(() => this.active.delete(promise)).catch(() => {
        });
        return promise;
    }
    async execute(id) {
        let j = this.journal.get(id);
        if (j.state === 'COMMITTED')
            return j;
        if (j.state !== 'QUEUED')
            d.fail('JOB_NOT_QUEUED');
        let lease = this.journal.acquire(j.library, 'publish');
        try {
            this.assertWriters(j.library);
            j = this.scheduler.attempt(id, 'build');
            j = this.journal.update(id, j.sequence, { state: 'SNAPSHOTTING' });
            await this.checkpoint('SNAPSHOTTING');
            const source = snapshot(this, j);
            const base = await this.admission.use(j.library, () => ({
                epoch: this.journal.epoch(j.library),
                witness: d.digest(artifacts.witness(this.manager.config.storePath, j.library, this.manager.metaDb))
            }));
            j = this.journal.update(id, j.sequence, {
                state: 'BUILDING',
                source_snapshot_fingerprint: source.fingerprint,
                recipe_fingerprint: d.digest(source.recipe),
                base_live_generation: base,
                normalized_dedup_key: d.digest({
                    library: j.library,
                    failure: j.reasons.every(reason => [
                        'missing_text',
                        'missing_meta',
                        'missing_both',
                        'invalid_text'
                    ].includes(reason)) ? 'text_integrity' : [...j.reasons].sort().join(','),
                    source: source.fingerprint,
                    recipe: d.digest(source.recipe),
                    base: base.epoch
                }),
                snapshot_receipt: source
            });
            const candidate = await build(this, j, source);
            await this.checkpoint('BUILT');
            j = this.journal.update(id, j.sequence, {
                state: 'VERIFYING',
                candidate_receipt: candidate,
                verify_attempt: j.verify_attempt + 1
            });
            const receipt = await verify(this, j, {
                store: this.jobPath(j, 'candidate', 'store'),
                knowledge: this.jobPath(j, 'candidate', 'knowledge'),
                snapshot: source,
                expectedReceipt: candidate
            });
            j = this.journal.update(id, j.sequence, {
                state: 'READY_TO_PUBLISH',
                verification_receipt: receipt
            });
            await this.checkpoint('VERIFIED');
            lease.release();
            lease = null;
            return await publish(this, j, source);
        } catch (error) {
            if (this.options.onError)
                this.options.onError(error);
            j = this.journal.get(id);
            if ([
                    'QUEUED',
                    'SNAPSHOTTING',
                    'BUILDING',
                    'VERIFYING',
                    'READY_TO_PUBLISH'
                ].includes(j.state)) {
                const code = error.code || 'BUILD_OR_VERIFY_FAILED';
                const state = code === 'RECOVERY_CANCELLED' ? 'CANCELLED' : code.startsWith('STALE_') ? 'STALE' : 'FAILED';
                // QUEUED can only cancel; failures after admission have SNAPSHOTTING state.
                j = this.journal.update(id, j.sequence, {
                    state: j.state === 'QUEUED' ? 'CANCELLED' : state,
                    last_error: code,
                    quarantined: ![
                        'EIO',
                        'ENOSPC',
                        'ETIMEDOUT',
                        'LEASE_BUSY'
                    ].includes(code)
                });
            }
            return j;
        } finally {
            lease?.release();
        }
    }
    retry(id, kind) {
        if (![
                'build',
                'verify',
                'publish'
            ].includes(kind))
            d.fail('INVALID_RETRY_PHASE');
        const j = this.journal.get(id);
        if (j.quarantined)
            d.fail('CANDIDATE_QUARANTINED');
        if (![
                'FAILED',
                'STALE'
            ].includes(j.state))
            d.fail('RETRY_STATE');
        if (j.build_attempt >= 3)
            d.fail('RETRY_EXHAUSTED');
        const next = this.scheduler.queue({
            library: j.library,
            reasons: j.reasons,
            origins: j.origins,
            base: this.journal.epoch(j.library)
        });
        return this.journal.update(next.job_id, next.sequence, {
            retry_of: id,
            build_attempt: j.build_attempt,
            next_attempt: { build: Date.now() + 1000 * 2 ** j.build_attempt },
            [kind + '_attempt']: j[kind + '_attempt'] || 0
        });
    }
    rollback(job) {
        return rollback(this, job);
    }
    readNativeBaseline(library) {
        const db = new this.native(d.contained(this.manager.config.storePath, d.path.join(this.manager.config.storePath, library + '.tdb')), {
            dim: this.manager.config.dimension,
            dtype: 'f32',
            storageMode: 'mmap',
            loadTextIndex: true,
            accessMode: 'readOnly',
            missingIndexPolicy: 'fallback',
            autoBuildQuiver: false
        });
        try {
            return {
                open: true,
                node_count: Number(db.storageInfo().node_count),
                text: this.inspect(library).evidence
            };
        } finally {
            db.close();
        }
    }
    async resumeCommitted(job) {
        const history = this.journal.all().filter(j => j.library === job.library);
        if (history.some(j => j.state === 'ROLLBACK_FAILED'))
            return;
        const commits = history.filter(j => j.commit_receipt).sort((a, b) => a.commit_receipt.serial - b.commit_receipt.serial);
        if (new Set(commits.map(j => j.commit_receipt.serial)).size !== commits.length)
            d.fail('AMBIGUOUS_COMMIT_ORDER');
        const latest = commits.at(-1);
        if (latest.job_id === job.job_id) {
            this.readNativeBaseline(job.library);
            this.journal.generation(job.library, job.candidate_generation);
        }
        if (job.state === 'RETIRING')
            await retire(this, job);
    }
    retire(id, now) {
        return retire(this, this.journal.get(id), now);
    }
    async shutdown() {
        this.stopping = true;
        await Promise.allSettled([...this.active]);
    }
    close() {
        this.journal.close();
    }
}
module.exports = { RecoveryRuntime };

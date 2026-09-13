'use strict';
const d = require('./durable');
const artifacts = require('./artifacts');
const {fingerprint} = require('./snapshot');
const {strictClose} = require('./lifecycle');
const {verify} = require('./verifier');
const {rowsetReplace, approvedNames} = require('./rollback');
async function publish(runtime, job, snapshot) {
    const m = runtime.manager;
    let sourceLease, publishLease;
    try {
        publishLease = runtime.journal.acquire(job.library, 'publish');
        sourceLease = runtime.journal.acquire(job.library, 'source');
    } catch (e) {
        publishLease?.release();
        throw e;
    }
    try {
        return await runtime.admission.exclusive(job.library, async () => {
            let j = runtime.journal.get(job.job_id);
            if (j.state === 'COMMITTED') {
                runtime.admission.unblock(job.library);
                return j;
            }
            if (j.state !== 'READY_TO_PUBLISH')
                d.fail('UNVERIFIED_CANDIDATE');
            try {
                runtime.assertWriters(job.library);
                sourceLease.check();
                publishLease.check();
                if (fingerprint(m, job.library).fingerprint !== snapshot.fingerprint || runtime.journal.epoch(job.library).source !== snapshot.source_epoch)
                    d.fail('STALE_SOURCE');
                if (d.digest(runtime.journal.epoch(job.library)) !== d.digest(j.base_live_generation.epoch) || d.digest(artifacts.witness(m.config.storePath, job.library, m.metaDb)) !== j.base_live_generation.witness)
                    d.fail('STALE_LIVE_GENERATION');
                if (artifacts.pending(m.config.storePath, job.library, m.metaDb))
                    d.fail('PENDING_LIVE_INGEST');
                const candidate = runtime.jobPath(job, 'candidate');
                await verify(runtime, j, {
                    store: d.path.join(candidate, 'store'),
                    knowledge: d.path.join(candidate, 'knowledge'),
                    snapshot,
                    expectedReceipt: j.verification_receipt
                });
                const size = Object.values(j.verification_receipt.artifacts).reduce((n, a) => n + a.bytes, 0) + Object.values(artifacts.bundle(m.config.storePath, job.library)).reduce((n, a) => n + a.bytes, 0);
                d.capacity(runtime.root, size * 3 + (runtime.options.minimumFreeBytes ?? 64 * 1024 * 1024));
                j = runtime.journal.update(j.job_id, j.sequence, {
                    state: 'PUBLISHING',
                    phase: 'PREPARING',
                    fencing_token: publishLease.token,
                    publish_attempt: j.publish_attempt + 1
                });
                try {
                    await strictClose(runtime, job.library);
                } catch (error) {
                    error.code = 'STRICT_CLOSE_FAILED';
                    throw error;
                }
                await runtime.checkpoint('PREPARING');
                require('./ownership').qualify(runtime, job.library);
                const old = artifacts.witness(m.config.storePath, job.library, m.metaDb);
                const health = runtime.readNativeBaseline(job.library);
                approvedNames(job, old.artifacts);
                for (const [name, entry] of Object.entries(old.artifacts)) {
                    const bytes = d.read(m.config.storePath, d.path.join(m.config.storePath, name));
                    if (d.hash(bytes) !== entry.sha)
                        d.fail('BASELINE_CHANGED');
                    d.write(runtime.root, runtime.jobPath(job, 'old-backup', name), bytes);
                }
                const undo = {
                    ...old,
                    epoch: runtime.journal.epoch(job.library),
                    baseline_health: health
                };
                d.write(runtime.root, runtime.jobPath(job, 'undo.json'), d.canonical(undo));
                for (const [name, entry] of Object.entries(old.artifacts))
                    if (d.hash(d.read(runtime.root, runtime.jobPath(job, 'old-backup', name))) !== entry.sha)
                        d.fail('BACKUP_VERIFY_FAILED');
                j = runtime.journal.update(j.job_id, j.sequence, {
                    phase: 'PREPARED',
                    undo_receipt: undo
                });
                await runtime.checkpoint('PREPARED');
                approvedNames(job, j.verification_receipt.artifacts);
                const names = [...new Set([
                        ...Object.keys(old.artifacts),
                        ...Object.keys(j.verification_receipt.artifacts)
                    ])].sort();
                for (let i = 0; i < names.length; i++) {
                    const name = names[i];
                    j = runtime.journal.update(j.job_id, j.sequence, {
                        phase: 'INSTALLING',
                        install_index: i,
                        install_name: name
                    });
                    await runtime.checkpoint('BEFORE_FILE_' + i);
                    const dst = d.path.join(m.config.storePath, name);
                    if (j.verification_receipt.artifacts[name]) {
                        const bytes = d.read(runtime.root, d.path.join(candidate, 'store', name));
                        if (d.hash(bytes) !== j.verification_receipt.artifacts[name].sha)
                            d.fail('SEALED_ARTIFACT_CHANGED');
                        d.install(m.config.storePath, dst, bytes, j.job_id, () => runtime.checkpointSync('MID_INSTALL_WRITE'));
                    } else
                        d.remove(m.config.storePath, dst);
                    await runtime.checkpoint('MID_FILE_' + i);
                }
                j = runtime.journal.update(j.job_id, j.sequence, { install_name: 'SQLITE_ROWSET' });
                rowsetReplace(runtime, j, j.verification_receipt.metadata, () => runtime.checkpointSync('MID_METADATA'));
                await runtime.checkpoint('AFTER_METADATA');
                j = runtime.journal.update(j.job_id, j.sequence, { phase: 'SWITCHED' });
                await runtime.checkpoint('SWITCHED');
                j = runtime.journal.update(j.job_id, j.sequence, { state: 'POST_VERIFYING' });
                await runtime.checkpoint('POST_VERIFYING');
                const post = await verify(runtime, j, {
                    store: m.config.storePath,
                    knowledge: m.config.rootPath,
                    snapshot
                });
                sourceLease.check();
                publishLease.check();
                if (fingerprint(m, job.library).fingerprint !== snapshot.fingerprint || runtime.journal.epoch(job.library).source !== snapshot.source_epoch)
                    d.fail('STALE_SOURCE');
                j = runtime.journal.update(j.job_id, j.sequence, { post_verification_receipt: post });
                await runtime.checkpoint('POST_VERIFIED');
                // Commit receipt and monotonically ordered public generation share one FULL transaction.
                j = runtime.journal.db.transaction(() => {
                    const serial = runtime.journal.epoch(job.library).live + 1;
                    const committed = runtime.journal.update(j.job_id, j.sequence, {
                        state: 'COMMITTED',
                        phase: 'COMMITTED',
                        commit_receipt: {
                            generation: j.candidate_generation,
                            serial,
                            verified: d.digest(post),
                            time: Date.now()
                        },
                        outcome: 'RECOVERED'
                    });
                    runtime.journal.db.prepare('UPDATE epochs SET generation=?,live=? WHERE library=?').run(j.candidate_generation, serial, job.library);
                    return committed;
                }).immediate();
                await runtime.checkpoint('COMMITTED');
                runtime.admission.unblock(job.library);
                return j;
            } catch (error) {
                if (runtime.options.onError)
                    runtime.options.onError(error);
                j = runtime.journal.get(job.job_id);
                if (j.state === 'COMMITTED')
                    throw error;
                if (j.undo_receipt) {
                    j = runtime.journal.update(j.job_id, j.sequence, { last_error: error.code || 'PUBLISH_IO_FAILURE' });
                    return runtime.rollback(j);
                }
                if (error.code === 'STRICT_CLOSE_FAILED') {
                    j = runtime.journal.update(j.job_id, j.sequence, {
                        state: 'ROLLBACK_FAILED',
                        last_error: 'STRICT_CLOSE_FAILED_NO_REPLACEMENT'
                    });
                    runtime.admission.block(job.library, 'STRICT_CLOSE_FAILED');
                    return j;
                }
                const state = String(error.code).startsWith('STALE_') ? 'STALE' : 'FAILED';
                j = runtime.journal.update(j.job_id, j.sequence, {
                    state,
                    last_error: error.code || 'PUBLISH_IO_FAILURE',
                    outcome: error.code || 'PUBLISH_FAILED'
                });
                runtime.admission.unblock(job.library);
                return j;
            }
        });
    } finally {
        sourceLease.release();
        publishLease.release();
    }
}
module.exports = { publish };

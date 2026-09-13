'use strict';
const SQL = require('better-sqlite3');
const d = require('./durable');
const artifacts = require('./artifacts');
function rowsetReplace(runtime, job, rows, midpoint, restore = false) {
    const file = d.contained(runtime.manager.config.storePath, d.path.join(runtime.manager.config.storePath, 'tdb_knowledge_meta.sqlite'));
    const db = new SQL(file);
    db.pragma('synchronous = FULL');
    db.pragma('busy_timeout = 5000');
    try {
        db.transaction(() => {
            for (const t of [
                    'chunks',
                    'files'
                ])
                db.prepare(`DELETE FROM ${ t } WHERE library=?`).run(job.library);
            if (midpoint)
                midpoint();
            for (const table of [
                    'files',
                    'chunks'
                ])
                for (const row of rows[table]) {
                    const allowed = table === 'files' ? [
                        'library',
                        'path',
                        'checksum',
                        'mtime',
                        'size',
                        'doc_node_id',
                        'updated_at'
                    ] : [
                        'library',
                        'path',
                        'chunk_index',
                        'node_id',
                        'checksum'
                    ];
                    if (restore)
                        allowed.unshift('id');
                    if (row.library !== job.library || Object.keys(row).some(k => !allowed.includes(k)))
                        d.fail('ROWSET_SCOPE');
                    db.prepare(`INSERT INTO ${ table }(${ allowed.join(',') }) VALUES(${ allowed.map(() => '?').join(',') })`).run(...allowed.map(k => row[k]));
                }
        }).immediate();
    } finally {
        db.close();
    }
}
function approvedNames(job, receipt) {
    for (const name of Object.keys(receipt)) {
        if (!artifacts.suffixes.some(s => name === job.library + '.tdb' + s))
            d.fail('ARTIFACT_SCOPE');
    }
}
async function rollback(runtime, job) {
    let current = runtime.journal.get(job.job_id);
    const undo = current.undo_receipt;
    if (!undo)
        d.fail('ROLLBACK_UNAVAILABLE');
    runtime.admission.block(job.library, 'ROLLBACK_IN_PROGRESS');
    try {
        approvedNames(job, undo.artifacts);
        approvedNames(job, current.verification_receipt.artifacts);
        current = runtime.journal.update(current.job_id, current.sequence, { rollback_attempt: current.rollback_attempt + 1 });
        for (const name of new Set([
                ...Object.keys(undo.artifacts),
                ...Object.keys(current.verification_receipt.artifacts)
            ])) {
            await runtime.checkpoint('ROLLBACK_FILE');
            const dst = d.path.join(runtime.manager.config.storePath, name);
            d.remove(runtime.manager.config.storePath, dst + '.recovery-' + job.job_id + '.install');
            if (undo.artifacts[name]) {
                const bytes = d.read(runtime.root, runtime.jobPath(job, 'old-backup', name));
                if (d.hash(bytes) !== undo.artifacts[name].sha)
                    d.fail('UNDO_HASH_MISMATCH');
                d.install(runtime.manager.config.storePath, dst, bytes, job.job_id);
            } else
                d.remove(runtime.manager.config.storePath, dst);
        }
        rowsetReplace(runtime, job, undo.metadata, undefined, true);
        const actual = artifacts.witness(runtime.manager.config.storePath, job.library);
        if (d.digest(actual) !== d.digest({
                artifacts: undo.artifacts,
                metadata: undo.metadata
            }))
            d.fail('RESTORED_BASELINE_MISMATCH');
        runtime.readNativeBaseline(job.library);
        runtime.journal.db.prepare('UPDATE epochs SET live=?,generation=? WHERE library=?').run(undo.epoch.live, undo.epoch.generation, job.library);
        current = runtime.journal.get(job.job_id);
        current = runtime.journal.update(job.job_id, current.sequence, {
            state: 'ROLLED_BACK',
            outcome: 'ROLLED_BACK',
            restored_baseline: undo.baseline_health
        });
        runtime.admission.unblock(job.library);
        return current;
    } catch (error) {
        current = runtime.journal.get(job.job_id);
        if (current.state !== 'ROLLBACK_FAILED')
            current = runtime.journal.update(job.job_id, current.sequence, {
                state: 'ROLLBACK_FAILED',
                last_error: error.code || 'ROLLBACK_IO_FAILURE'
            });
        runtime.admission.block(job.library, 'ROLLBACK_FAILED');
        return current;
    }
}
module.exports = {
    rollback,
    rowsetReplace,
    approvedNames
};

'use strict';
const d = require('./durable');
async function retire(runtime, job, now = Date.now()) {
    let j = runtime.journal.get(job.job_id);
    if (j.state === 'RETIRED')
        return j;
    if (![
            'COMMITTED',
            'RETIRING'
        ].includes(j.state))
        d.fail('RETIRE_BEFORE_COMMIT');
    if (j.state === 'COMMITTED' && now - j.commit_receipt.time < 24 * 60 * 60 * 1000)
        d.fail('RETENTION_ACTIVE');
    if (runtime.journal.all().some(x => x.job_id !== j.job_id && ![
            'COMMITTED',
            'RETIRED',
            'FAILED',
            'STALE',
            'ROLLED_BACK',
            'CANCELLED'
        ].includes(x.state) && x.base_live_generation?.epoch?.generation === j.undo_receipt.epoch.generation))
        d.fail('OLD_GENERATION_REFERENCED');
    if (runtime.journal.epoch(j.library).generation === j.undo_receipt.epoch.generation)
        d.fail('OLD_GENERATION_STILL_ACTIVE');
    if (runtime.admission.state(j.library).active)
        d.fail('GENERATION_IN_USE');
    if (j.state === 'COMMITTED')
        j = runtime.journal.update(j.job_id, j.sequence, {
            state: 'RETIRING',
            cleanup_attempt: j.cleanup_attempt + 1,
            retirement_receipt: {
                eligible_at: now,
                old_generation: j.undo_receipt.epoch.generation
            }
        });
    try {
        for (const name of Object.keys(j.undo_receipt.artifacts)) {
            await runtime.checkpoint('RETIRING');
            d.remove(runtime.root, runtime.jobPath(j, 'old-backup', name));
            await runtime.checkpoint('AFTER_RETIRE_FILE');
        }
        j = runtime.journal.update(j.job_id, j.sequence, { state: 'RETIRED' });
    } catch (e) {
        j = runtime.journal.update(j.job_id, j.sequence, {
            last_error: e.code || 'CLEANUP_FAILED',
            cleanup_attempt: j.cleanup_attempt + 1,
            next_attempt: {
                ...j.next_attempt,
                cleanup: now + 60000
            }
        });
    }
    return j;
}
module.exports = { retire };

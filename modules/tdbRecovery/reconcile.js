'use strict';
// Invoked before ordinary metadata discovery, T02, ingestion or readiness.
async function reconcile(journal, admission, adapter) {
    admission.globalBlocked = true;
    const jobs = journal.all();
    // Any malformed record blocks the entire manager, without guessing its library.
    for (const job of jobs)
        if ([
                'PUBLISHING',
                'POST_VERIFYING',
                'ROLLBACK_FAILED'
            ].includes(job.state))
            admission.block(job.library);
    // Restore incomplete bundles before opening any historical committed generation.
    const ordered = [...jobs].sort((a, b) => Number(Boolean(a.commit_receipt)) - Number(Boolean(b.commit_receipt)));
    for (let job of ordered) {
        const lease = journal.acquire(job.library, 'publish');
        try {
            if ([
                    'PUBLISHING',
                    'POST_VERIFYING'
                ].includes(job.state)) {
                const source = journal.acquire(job.library, 'source');
                try {
                    if (job.undo_receipt)
                        await adapter.rollback(job);
                    else
                        journal.update(job.job_id, job.sequence, {
                            state: 'FAILED',
                            last_error: 'INTERRUPTED_PREPARATION'
                        });
                } finally {
                    source.release();
                }
            } else if (job.state === 'ROLLBACK_FAILED')
                admission.block(job.library, 'ROLLBACK_FAILED');
            else if ([
                    'COMMITTED',
                    'RETIRING',
                    'RETIRED'
                ].includes(job.state)) {
                await adapter.committed(job);
            } else if ([
                    'SNAPSHOTTING',
                    'BUILDING',
                    'VERIFYING',
                    'READY_TO_PUBLISH'
                ].includes(job.state))
                journal.update(job.job_id, job.sequence, {
                    state: 'FAILED',
                    last_error: 'INTERRUPTED_PRE_SWITCH',
                    quarantined: true
                });
            const current = journal.get(job.job_id);
            if (current.state !== 'ROLLBACK_FAILED')
                admission.unblock(job.library);
        } finally {
            lease.release();
        }
    }
    for (const job of journal.all())
        if (job.state === 'ROLLBACK_FAILED')
            admission.block(job.library, 'ROLLBACK_FAILED');
    admission.globalBlocked = false;
}
module.exports = { reconcile };

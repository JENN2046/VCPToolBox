'use strict';
const {Journal} = require('./journal');
const d = require('./durable');
// Internal adapter shared by Core and the App. Module path comes from trusted operator configuration, never a tool argument.
async function withSourceMutation({journalRoot, sourceRoot, library}, fn) {
    d.name(library);
    d.contained(sourceRoot, sourceRoot);
    const journal = new Journal(journalRoot);
    let lease;
    try {
        lease = journal.acquire(library, 'source');
        if (journal.all().some(j => j.library === library && [
                'PUBLISHING',
                'POST_VERIFYING',
                'ROLLBACK_FAILED'
            ].includes(j.state)))
            d.fail('RECOVERY_ADMISSION_BLOCKED');
        journal.bump(library, 'source');
        return await fn();
    } finally {
        if (lease)
            lease.release();
        journal.close();
    }
}
module.exports = { withSourceMutation };

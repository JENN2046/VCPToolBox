'use strict';
const d = require('./durable');
class Scheduler {
    constructor(journal, {maxAttempts = 3, clock = Date.now} = {}) {
        this.journal = journal;
        this.maxAttempts = maxAttempts;
        this.clock = clock;
    }
    queue(input) {
        let j = this.journal.create(input);
        if (j.state === 'DETECTED')
            j = this.journal.update(j.job_id, j.sequence, { state: 'QUEUED' });
        return j;
    }
    attempt(id, kind) {
        if (![
                'build',
                'verify',
                'publish',
                'rollback',
                'cleanup'
            ].includes(kind))
            d.fail('INVALID_RETRY_PHASE');
        const j = this.journal.get(id), key = kind + '_attempt';
        if (j[key] >= this.maxAttempts)
            d.fail('RETRY_EXHAUSTED');
        if ((j.next_attempt[kind] || 0) > this.clock())
            d.fail('RETRY_BACKOFF');
        return this.journal.update(id, j.sequence, { [key]: j[key] + 1 });
    }
    retry(id, kind, code, {
        deterministic = false
    } = {}) {
        const j = this.journal.get(id);
        return this.journal.update(id, j.sequence, {
            last_error: code,
            quarantined: deterministic || j[kind + '_attempt'] >= this.maxAttempts,
            next_attempt: {
                ...j.next_attempt,
                [kind]: this.clock() + 1000 * 2 ** j[kind + '_attempt']
            }
        });
    }
    pending() {
        return this.journal.all().filter(j => j.state === 'QUEUED' && !j.quarantined);
    }
}
module.exports = { Scheduler };

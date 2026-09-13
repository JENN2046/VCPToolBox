'use strict';
const d = require('./durable');
class Coordinator {
    constructor(runtime) {
        this.runtime = runtime;
    }
    validate({library, reason = 'manual', origin = 'operator', automatic = false}) {
        const r = this.runtime;
        d.name(library);
        if (![
                'manual',
                'healthy',
                'missing_text',
                'missing_meta',
                'missing_both',
                'invalid_text',
                'sparse_detected',
                'stale_detected',
                'integrity_failure'
            ].includes(reason) || typeof origin !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(origin))
            d.fail('INVALID_RECOVERY_REASON');
        if (r.stopping)
            d.fail('RECOVERY_SHUTTING_DOWN');
        if (automatic)
            d.fail('AUTO_RECOVERY_DISABLED');
        // Deliberate hard-off, no environment variable enables it.
        if (r.operatorControl)
            r.operatorControl.authorize(library);
        else if (!r.options.manualEnabled)
            d.fail('MANUAL_RECOVERY_DISABLED');
        if (r.operatorControl)
            r.operatorControl.assertLibrary(library);
        if (r.manager.config.excludeFolders.includes(library))
            d.fail('UNSUPPORTED_DAMAGE');
        r.assertWriters(library);
        d.capacity(r.root, r.options.minimumFreeBytes ?? 64 * 1024 * 1024);
        if (r.journal.all().some(j => j.library === library && [
                'PUBLISHING',
                'POST_VERIFYING',
                'ROLLBACK_FAILED'
            ].includes(j.state)))
            d.fail('INCOMPATIBLE_RECOVERY');
        return {
            library,
            reason,
            origin,
            automatic: false
        };
    }
    request(input) {
        const {library, reason, origin} = this.validate(input);
        const r = this.runtime;
        return r.scheduler.queue({
            library,
            reasons: [reason],
            origins: [origin],
            base: r.journal.epoch(library)
        });
    }
}
module.exports = { Coordinator };

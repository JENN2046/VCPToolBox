'use strict';
const crypto = require('node:crypto');
const d = require('./durable');
const operations = new Set([
    'STATUS',
    'ENABLE_MANUAL',
    'VALIDATE',
    'SUBMIT',
    'JOB_STATUS',
    'DISABLE_MANUAL'
]);
const jobFields = [
    'job_id',
    'library',
    'reasons',
    'origins',
    'state',
    'phase',
    'sequence',
    'created_at',
    'last_error',
    'build_attempt',
    'verify_attempt',
    'publish_attempt',
    'rollback_attempt',
    'cleanup_attempt',
    'source_snapshot_fingerprint',
    'recipe_fingerprint',
    'candidate_generation'
];
function token(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value))
        d.fail('INVALID_OPERATOR_ORIGIN');
    return value;
}
function ownedFile(root, file) {
    d.contained(root, file);
    const s = d.fs.lstatSync(file);
    if (!s.isFile() || s.uid !== process.getuid() || s.mode & 63 || s.nlink !== 1)
        d.fail('UNSAFE_OPERATOR_FILE');
    return d.read(root, file);
}
class OperatorControl {
    constructor(runtime, {root, clock = Date.now, dispatch = fn => setImmediate(fn)} = {}) {
        this.runtime = runtime;
        this.root = root;
        this.clock = clock;
        this.dispatch = dispatch;
        this.grant = null;
        this.instance = crypto.randomUUID();
        this.auditFailure = false;
        this.scheduled = new Set();
        // Keep audit history on the persistent recovery volume, not the ephemeral socket directory.
        this.auditRoot = runtime.root;
        this.auditPath = d.path.join(this.auditRoot, 'operator-audit.jsonl');
        if (runtime) {
            runtime.options.manualEnabled = false;
            runtime.operatorControl = this;
        }
    }
    manual() {
        const g = this.grant;
        const enabled = !!g && this.clock() < g.expires_at && !this.auditFailure && !this.runtime?.stopping;
        return {
            enabled,
            authorization_id: g?.id || null,
            library: g?.library || null,
            expires_at: g?.expires_at || null,
            max_jobs: 1,
            operator_origin: g?.origin || null
        };
    }
    health() {
        const r = this.runtime;
        if (!r?.journal?.db?.open)
            return {
                healthy: false,
                error: 'RECOVERY_NOT_INITIALIZED',
                jobs: null
            };
        try {
            if (r.journal.db.pragma('quick_check', { simple: true }) !== 'ok')
                d.fail('JOURNAL_UNHEALTHY');
            return {
                healthy: true,
                error: null,
                jobs: r.journal.all()
            };
        } catch {
            return {
                healthy: false,
                error: 'JOURNAL_UNHEALTHY',
                jobs: null
            };
        }
    }
    requireHealth() {
        const h = this.health();
        if (!h.healthy)
            d.fail(h.error);
        if (this.auditFailure)
            d.fail('OPERATOR_AUDIT_UNHEALTHY');
        return h;
    }
    authorize(library) {
        if (!this.manual().enabled)
            d.fail('MANUAL_RECOVERY_DISABLED');
        if (library !== this.grant.library)
            d.fail('MANUAL_LIBRARY_SCOPE');
        this.requireHealth();
    }
    assertLibrary(library) {
        const m = this.runtime.manager;
        // Relative identity only; no native open, source-body read, epoch advance or job creation.
        const root = m.config.rootPath;
        const target = d.path.join(root, library === 'Root' ? '' : library);
        if (!d.fs.existsSync(target) || !d.fs.statSync(d.contained(root, target)).isDirectory() || !m.listLibraries().includes(library))
            d.fail('UNKNOWN_LIBRARY');
    }
    status() {
        const r = this.runtime, h = this.health();
        const failed = h.jobs?.filter(j => j.state === 'ROLLBACK_FAILED').map(j => j.job_id) ?? null;
        return {
            pid: process.pid,
            uid: process.getuid(),
            runtime_instance_id: this.instance,
            invocation_id: process.env.INVOCATION_ID || null,
            initialized: !!r?.manager?.initialized,
            journal_healthy: h.healthy,
            journal_error: h.error,
            journal_path_hash: r?.journal?.path ? d.hash(r.journal.path) : null,
            auto_enabled: r?.autoPublish === true,
            manual: this.manual(),
            job_count: h.jobs?.length ?? null,
            active_jobs: r?.active?.size ?? 0,
            blocked_jobs: h.jobs?.filter(j => j.state === 'ROLLBACK_FAILED').map(j => j.job_id) ?? null,
            rollback_failed_jobs: failed,
            admission_blocked: r ? [...r.admission.libraries].filter(([, s]) => s.blocked).map(([library, s]) => ({
                library,
                reason: s.reason
            })) : [],
            admission_global_blocked: r?.admission.globalBlocked ?? true,
            audit_healthy: !this.auditFailure
        };
    }
    audit(op, library, result, jobId = null, authorizationId = this.grant?.id || null) {
        const entry = {
            timestamp: this.clock(),
            operation: op,
            library: library || null,
            authorization_id: authorizationId,
            result_class: result,
            job_id: jobId,
            authority_class: 'LOCAL_OS_UID',
            uid: process.getuid(),
            pid: process.pid
        };
        try {
            if (d.fs.existsSync(this.auditPath))
                ownedFile(this.auditRoot, this.auditPath);
            const fd = d.fs.openSync(this.auditPath, d.fs.constants.O_WRONLY | d.fs.constants.O_APPEND | d.fs.constants.O_CREAT | d.fs.constants.O_NOFOLLOW, 384);
            try {
                d.fs.writeFileSync(fd, JSON.stringify(entry) + '\n');
                d.fs.fsyncSync(fd);
            } finally {
                d.fs.closeSync(fd);
            }
            d.syncDir(this.auditRoot);
        } catch {
            this.auditFailure = true;
            this.grant = null;
            d.fail('OPERATOR_AUDIT_UNHEALTHY');
        }
    }
    loadQualification(library) {
        // Optional local operator-maintained qualification: not a request path and never accepted over MCP.
        // These are exactly rev1's existing ownership/writer options, with positively attested quiescence.
        const file = d.path.join(this.root, 'qualified-writers.json');
        if (!d.fs.existsSync(file))
            return;
        const bytes = ownedFile(this.root, file), hash = d.hash(bytes), all = JSON.parse(bytes), q = all[library];
        if (!q)
            return;
        if (q.sourceOwned !== true || !Array.isArray(q.writers) || !q.writers.length || !Number.isSafeInteger(q.expires_at) || q.expires_at <= this.clock() || q.expires_at > this.clock() + 900000)
            d.fail('WRITER_QUALIFICATION_INVALID');
        const stillQualified = () => {
            try {
                return this.clock() < q.expires_at && d.hash(ownedFile(this.root, file)) === hash;
            } catch {
                return false;
            }
        };
        const writers = q.writers.map(w => {
            token(w.id);
            if (w.classification === 'READ_ONLY')
                return {
                    id: w.id,
                    classification: w.classification
                };
            if (w.classification === 'LEASE_AWARE' && w.protocol === 'VCP_TDB_SOURCE_LEASE_V1')
                return {
                    id: w.id,
                    classification: w.classification,
                    protocol: w.protocol
                };
            if (w.classification === 'QUIESCABLE' && w.positively_quiesced === true)
                return {
                    id: w.id,
                    classification: w.classification,
                    isQuiesced: stillQualified
                };
            d.fail('UNCONTROLLED_WRITER');
        });
        // A qualification must expire even if every inventoried writer is lease-aware/read-only.
        writers.push({
            id: 'operator-qualification',
            classification: 'QUIESCABLE',
            isQuiesced: stillQualified
        });
        // Keep the qualification distinct from manual enablement: disabling new submits must not kill an active job.
        this.runtime.options.sourceOwned = {
            ...this.runtime.options.sourceOwned,
            [library]: true
        };
        this.runtime.options.writerInventory = {
            ...this.runtime.options.writerInventory,
            [library]: writers
        };
    }
    jobStatus(id) {
        if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))
            d.fail('INVALID_JOB_ID');
        this.requireHealth();
        const job = this.runtime.journal.get(id);
        return {
            ...Object.fromEntries(jobFields.map(k => [
                k,
                job[k]
            ])),
            last_error: job.last_error === null ? null : /^[A-Z_]{1,64}$/.test(job.last_error || '') ? job.last_error : 'RECOVERY_ERROR',
            base_live_generation_hash: d.digest(job.base_live_generation)
        };
    }
    handle(input) {
        if (!input || Array.isArray(input) || typeof input !== 'object' || !operations.has(input.operation))
            d.fail('INVALID_OPERATOR_OPERATION');
        const {operation: op} = input;
        const fields = {
            STATUS: [],
            JOB_STATUS: ['job_id'],
            ENABLE_MANUAL: [
                'library',
                'origin',
                'ttl_seconds'
            ],
            DISABLE_MANUAL: [],
            VALIDATE: [
                'library',
                'reason',
                'origin',
                'automatic'
            ],
            SUBMIT: [
                'library',
                'reason',
                'origin',
                'automatic'
            ]
        }[op];
        let library;
        try {
            if (Object.keys(input).some(k => k !== 'operation' && !fields.includes(k)))
                d.fail('INVALID_OPERATOR_FIELD');
            if (op === 'STATUS')
                return this.status();
            if (op === 'JOB_STATUS')
                return this.jobStatus(input.job_id);
            if ([
                    'ENABLE_MANUAL',
                    'VALIDATE',
                    'SUBMIT'
                ].includes(op) && (typeof input.library !== 'string' || input.library.length > 128))
                d.fail('INVALID_OPERATOR_LIBRARY');
            library = Object.hasOwn(input, 'library') ? d.name(input.library) : this.grant?.library;
        } catch (e) {
            if (op !== 'STATUS' && op !== 'JOB_STATUS')
                this.audit(op, null, 'INVALID_OPERATOR_REQUEST');
            throw e;
        }
        const grantBefore = this.grant?.id;
        this.audit(op, library, 'INTENT');
        try {
            let result;
            if (op === 'DISABLE_MANUAL') {
                this.grant = null;
                result = this.manual();
            } else if (op === 'ENABLE_MANUAL') {
                this.requireHealth();
                if (this.runtime.stopping)
                    d.fail('RECOVERY_SHUTTING_DOWN');
                const ttl = input.ttl_seconds ?? 300, origin = token(input.origin || 'OPERATOR');
                if (!Number.isInteger(ttl) || ttl < 1 || ttl > 900)
                    d.fail('INVALID_MANUAL_TTL');
                if (this.manual().enabled) {
                    if (this.grant.library !== library || this.grant.origin !== origin)
                        d.fail('MANUAL_AUTHORIZATION_ACTIVE');
                } else {
                    this.loadQualification(library);
                    this.grant = {
                        id: crypto.randomUUID(),
                        library,
                        origin,
                        enabled_at: this.clock(),
                        expires_at: this.clock() + ttl * 1000
                    };
                }
                result = this.manual();
            } else {
                const request = {
                    library,
                    reason: input.reason,
                    origin: input.origin || 'OPERATOR',
                    automatic: input.automatic ?? false
                };
                if (typeof request.automatic !== 'boolean')
                    d.fail('INVALID_OPERATOR_REQUEST');
                // The one validation function is shared by validate and real Coordinator.request.
                if (op === 'VALIDATE')
                    result = {
                        validated: true,
                        policy: 'Coordinator.validate',
                        request: this.runtime.coordinator.validate(request),
                        jobs_created: 0
                    };
                else {
                    const job = this.runtime.request(request), durable = this.runtime.journal.get(job.job_id);
                    result = this.jobStatus(durable.job_id);
                    this.grant = null;
                    this.audit(op, library, 'DURABLE_SUBMIT', job.job_id, grantBefore);
                    // Future accepted manual submit follows the single existing data plane; qualification never invokes this branch successfully.
                    if (job.state === 'QUEUED' && !this.scheduled.has(job.job_id)) {
                        this.scheduled.add(job.job_id);
                        this.dispatch(() => {
                            Promise.resolve().then(() => this.runtime.run(job.job_id)).catch(() => {
                                try {
                                    this.audit('EXECUTION', library, 'RECOVERY_JOB_FAILED', job.job_id, grantBefore);
                                } catch {
                                }
                            }).finally(() => this.scheduled.delete(job.job_id));
                        });
                    }
                    return result;
                }
            }
            this.audit(op, library, 'OK', null, grantBefore || this.grant?.id);
            return result;
        } catch (e) {
            const code = typeof e.code === 'string' && /^[A-Z_]{1,64}$/.test(e.code) ? e.code : 'OPERATOR_REQUEST_REJECTED';
            this.audit(op, library, code, null, grantBefore);
            throw Object.assign(new Error(code), { code });
        }
    }
}
module.exports = {
    OperatorControl,
    ownedFile
};

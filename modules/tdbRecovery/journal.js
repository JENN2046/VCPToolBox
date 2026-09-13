'use strict';
const SQL = require('better-sqlite3');
const crypto = require('node:crypto');
const d = require('./durable');
const transitions = {
    DETECTED: ['QUEUED'],
    QUEUED: [
        'SNAPSHOTTING',
        'CANCELLED'
    ],
    SNAPSHOTTING: [
        'BUILDING',
        'FAILED',
        'STALE',
        'CANCELLED'
    ],
    BUILDING: [
        'VERIFYING',
        'FAILED',
        'STALE',
        'CANCELLED'
    ],
    VERIFYING: [
        'READY_TO_PUBLISH',
        'FAILED',
        'STALE',
        'CANCELLED'
    ],
    READY_TO_PUBLISH: [
        'PUBLISHING',
        'STALE',
        'FAILED',
        'CANCELLED'
    ],
    PUBLISHING: [
        'POST_VERIFYING',
        'ROLLED_BACK',
        'ROLLBACK_FAILED',
        'FAILED'
    ],
    POST_VERIFYING: [
        'COMMITTED',
        'ROLLED_BACK',
        'ROLLBACK_FAILED'
    ],
    COMMITTED: ['RETIRING'],
    RETIRING: ['RETIRED'],
    FAILED: [],
    STALE: [],
    CANCELLED: [],
    ROLLED_BACK: [],
    ROLLBACK_FAILED: [],
    RETIRED: []
};
const required = [
    'schema_version',
    'job_id',
    'library',
    'reasons',
    'origins',
    'normalized_dedup_key',
    'state',
    'sequence',
    'phase',
    'source_snapshot_fingerprint',
    'recipe_fingerprint',
    'base_live_generation',
    'candidate_generation',
    'fencing_token',
    'build_attempt',
    'verify_attempt',
    'publish_attempt',
    'rollback_attempt',
    'cleanup_attempt',
    'candidate_receipt',
    'verification_receipt',
    'undo_receipt',
    'commit_receipt',
    'retirement_receipt',
    'created_at',
    'updated_at',
    'last_error'
];
const unfinished = j => ![
    'FAILED',
    'STALE',
    'CANCELLED',
    'ROLLED_BACK',
    'RETIRED',
    'COMMITTED'
].includes(j.state);
function identity(pid = process.pid) {
    try {
        const s = d.fs.readFileSync(`/proc/${ pid }/stat`, 'utf8');
        return d.fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim() + ':' + s.slice(s.lastIndexOf(')') + 2).split(' ')[19];
    } catch (e) {
        if (e.code === 'ENOENT')
            return null;
        throw e;
    }
}
class Journal {
    constructor(root) {
        this.root = d.mkdir(root);
        this.path = d.path.join(root, 'journal.sqlite');
        if (d.fs.existsSync(d.path.join(root, 'jobs')) && !d.fs.existsSync(this.path))
            d.fail('JOURNAL_MISSING');
        for (const ext of [
                '',
                '-wal',
                '-shm'
            ])
            d.contained(root, this.path + ext, { missing: true });
        this.db = new SQL(this.path);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = FULL');
        this.db.pragma('busy_timeout = 5000');
        if (this.db.pragma('quick_check', { simple: true }) !== 'ok')
            d.fail('JOURNAL_CORRUPT');
        this.db.exec('CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, library TEXT NOT NULL, sequence INTEGER NOT NULL, body TEXT NOT NULL, checksum TEXT NOT NULL); CREATE TABLE IF NOT EXISTS epochs (library TEXT PRIMARY KEY, source INTEGER NOT NULL DEFAULT 0, live INTEGER NOT NULL DEFAULT 0, generation TEXT NOT NULL); CREATE TABLE IF NOT EXISTS leases (library TEXT NOT NULL, kind TEXT NOT NULL, token TEXT NOT NULL, pid INTEGER NOT NULL, identity TEXT NOT NULL, PRIMARY KEY(library,kind));');
        d.syncDir(root);
        this.owner = identity();
    }
    validate(j) {
        if (!j || required.some(k => !Object.hasOwn(j, k)) || j.schema_version !== 1 || !Object.hasOwn(transitions, j.state) || !Number.isSafeInteger(j.sequence) || j.sequence < 1)
            d.fail('JOURNAL_CORRUPT');
        d.name(j.library);
        if (!/^[a-f0-9-]{36}$/.test(j.job_id) || !Array.isArray(j.reasons) || !Array.isArray(j.origins))
            d.fail('JOURNAL_CORRUPT');
        const phases = [
            'NONE',
            'PREPARING',
            'PREPARED',
            'INSTALLING',
            'SWITCHED',
            'COMMITTED'
        ];
        if (!phases.includes(j.phase) || [
                'DETECTED',
                'QUEUED',
                'SNAPSHOTTING',
                'BUILDING',
                'VERIFYING',
                'READY_TO_PUBLISH',
                'STALE',
                'CANCELLED'
            ].includes(j.state) && j.phase !== 'NONE' || j.state === 'POST_VERIFYING' && j.phase !== 'SWITCHED' || [
                'COMMITTED',
                'RETIRING',
                'RETIRED'
            ].includes(j.state) && j.phase !== 'COMMITTED')
            d.fail('JOURNAL_PHASE_INVALID');
        if ([
                'build',
                'verify',
                'publish',
                'rollback',
                'cleanup'
            ].some(k => !Number.isSafeInteger(j[k + '_attempt']) || j[k + '_attempt'] < 0))
            d.fail('JOURNAL_CORRUPT');
        if (j.undo_receipt && (!j.undo_receipt.artifacts || !Array.isArray(j.undo_receipt.metadata?.files) || !Array.isArray(j.undo_receipt.metadata?.chunks) || !j.undo_receipt.epoch || !j.undo_receipt.baseline_health))
            d.fail('JOURNAL_UNDO_INVALID');
        if (j.state === 'PUBLISHING' && ![
                'PREPARING',
                'PREPARED',
                'INSTALLING',
                'SWITCHED'
            ].includes(j.phase))
            d.fail('JOURNAL_PHASE_INVALID');
        if ([
                'PREPARED',
                'INSTALLING',
                'SWITCHED'
            ].includes(j.phase) && !j.undo_receipt)
            d.fail('JOURNAL_UNDO_MISSING');
        if ([
                'COMMITTED',
                'RETIRING',
                'RETIRED'
            ].includes(j.state) && (!j.commit_receipt || !Number.isSafeInteger(j.commit_receipt.serial) || j.commit_receipt.serial < 1 || j.commit_receipt.generation !== j.candidate_generation))
            d.fail('JOURNAL_COMMIT_MISSING');
        return j;
    }
    decode(row) {
        let j;
        try {
            j = JSON.parse(row.body);
        } catch {
            d.fail('JOURNAL_CORRUPT');
        }
        if (d.digest(j) !== row.checksum || j.sequence !== row.sequence || j.job_id !== row.id || j.library !== row.library)
            d.fail('JOURNAL_CORRUPT');
        return this.validate(j);
    }
    all() {
        const jobs = this.db.prepare('SELECT * FROM jobs ORDER BY rowid').all().map(r => this.decode(r));
        const folder = d.path.join(this.root, 'jobs');
        if (d.fs.existsSync(folder))
            for (const id of d.fs.readdirSync(folder)) {
                d.contained(this.root, d.path.join(folder, id));
                if (!jobs.some(j => j.job_id === id))
                    d.fail('ORPHAN_JOB_NAMESPACE');
            }
        return jobs;
    }
    get(id) {
        const r = this.db.prepare('SELECT * FROM jobs WHERE id=?').get(id);
        if (!r)
            d.fail('JOB_NOT_FOUND');
        return this.decode(r);
    }
    put(j) {
        this.validate(j);
        this.db.prepare('INSERT INTO jobs VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET library=excluded.library, sequence=excluded.sequence, body=excluded.body, checksum=excluded.checksum').run(j.job_id, j.library, j.sequence, d.canonical(j), d.digest(j));
        return j;
    }
    update(id, sequence, fields) {
        return this.db.transaction(() => {
            const old = this.get(id);
            if (old.sequence !== sequence)
                d.fail('STALE_JOURNAL_WRITE');
            if (fields.state && fields.state !== old.state && !transitions[old.state].includes(fields.state))
                d.fail('ILLEGAL_TRANSITION');
            for (const k of [
                    'job_id',
                    'library',
                    'schema_version',
                    'sequence'
                ])
                if (Object.hasOwn(fields, k))
                    d.fail('IMMUTABLE_JOB_IDENTITY');
            return this.put({
                ...old,
                ...fields,
                sequence: old.sequence + 1,
                updated_at: Date.now()
            });
        }).immediate();
    }
    create({library, reasons, origins, source = null, recipe = null, base = null}) {
        d.name(library);
        return this.db.transaction(() => {
            const failure = reasons.every(r => [
                'missing_text',
                'missing_meta',
                'missing_both',
                'invalid_text'
            ].includes(r)) ? 'text_integrity' : [...reasons].sort().join(',');
            const key = d.digest({
                library,
                failure,
                source,
                recipe,
                base
            });
            const prior = this.all().find(j => unfinished(j) && (j.normalized_dedup_key === key || source === null && j.library === library && d.digest(j.base_live_generation?.epoch || j.base_live_generation) === d.digest(base) && (j.reasons.every(reason => [
                'missing_text',
                'missing_meta',
                'missing_both',
                'invalid_text'
            ].includes(reason)) ? 'text_integrity' : [...j.reasons].sort().join(',')) === failure));
            if (prior)
                return this.update(prior.job_id, prior.sequence, {
                    reasons: [...new Set([
                            ...prior.reasons,
                            ...reasons
                        ])],
                    origins: [...new Set([
                            ...prior.origins,
                            ...origins
                        ])]
                });
            const j = {
                schema_version: 1,
                job_id: crypto.randomUUID(),
                library,
                reasons: [...new Set(reasons)],
                origins: [...new Set(origins)],
                normalized_dedup_key: key,
                state: 'DETECTED',
                sequence: 1,
                phase: 'NONE',
                source_snapshot_fingerprint: source,
                recipe_fingerprint: recipe,
                base_live_generation: base,
                candidate_generation: crypto.randomUUID(),
                fencing_token: null,
                candidate_receipt: null,
                verification_receipt: null,
                undo_receipt: null,
                commit_receipt: null,
                retirement_receipt: null,
                created_at: Date.now(),
                updated_at: Date.now(),
                last_error: null,
                next_attempt: {},
                build_attempt: 0,
                verify_attempt: 0,
                publish_attempt: 0,
                rollback_attempt: 0,
                cleanup_attempt: 0
            };
            return this.put(j);
        }).immediate();
    }
    epoch(library) {
        d.name(library);
        this.db.prepare('INSERT OR IGNORE INTO epochs(library,generation) VALUES(?,?)').run(library, crypto.randomUUID());
        return this.db.prepare('SELECT source,live,generation FROM epochs WHERE library=?').get(library);
    }
    bump(library, kind) {
        if (![
                'source',
                'live'
            ].includes(kind))
            d.fail('INVALID_EPOCH');
        this.epoch(library);
        this.db.prepare(`UPDATE epochs SET ${ kind }=${ kind }+1 WHERE library=?`).run(library);
        return this.epoch(library);
    }
    generation(library, generation) {
        this.epoch(library);
        this.db.prepare('UPDATE epochs SET generation=? WHERE library=?').run(generation, library);
    }
    acquire(library, kind) {
        d.name(library);
        if (![
                'source',
                'publish'
            ].includes(kind))
            d.fail('INVALID_LEASE');
        const token = crypto.randomUUID();
        this.db.transaction(() => {
            const old = this.db.prepare('SELECT * FROM leases WHERE library=? AND kind=?').get(library, kind);
            if (old && identity(old.pid) === old.identity)
                d.fail('LEASE_BUSY');
            if (old)
                this.db.prepare('DELETE FROM leases WHERE library=? AND kind=?').run(library, kind);
            this.db.prepare('INSERT INTO leases VALUES(?,?,?,?,?)').run(library, kind, token, process.pid, this.owner);
        }).immediate();
        return {
            token,
            check: () => {
                const r = this.db.prepare('SELECT token FROM leases WHERE library=? AND kind=?').get(library, kind);
                if (r?.token !== token)
                    d.fail('STALE_FENCING_TOKEN');
            },
            release: () => this.db.prepare('DELETE FROM leases WHERE library=? AND kind=? AND token=?').run(library, kind, token)
        };
    }
    close() {
        this.db.close();
    }
}
module.exports = {
    Journal,
    transitions,
    unfinished
};

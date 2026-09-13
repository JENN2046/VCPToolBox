'use strict';
const d = require('./durable');
const SQL = require('better-sqlite3');
const suffixes = [
    '',
    '.vec',
    '.wal',
    '.flush_ok',
    '.quiver',
    '.quiver.meta',
    '.text',
    '.text.meta',
    '.pidx',
    '.gidx',
    '.manifest.json'
];
function bundle(store, library) {
    d.name(library);
    const prefix = library + '.tdb', out = {};
    for (const n of d.fs.readdirSync(store)) {
        if (!n.startsWith(prefix))
            continue;
        const s = n.slice(prefix.length);
        if (s === '.lock') {
            d.contained(store, d.path.join(store, n));
            continue;
        }
        if (!suffixes.includes(s))
            d.fail('UNKNOWN_ARTIFACT');
        const file = d.contained(store, d.path.join(store, n));
        const bytes = d.read(store, file);
        out[n] = {
            sha: d.hash(bytes),
            bytes: bytes.length
        };
    }
    if (!out[prefix])
        d.fail('MISSING_NATIVE');
    return out;
}
function metadata(store, library, db, preserveIds = false) {
    let own = false;
    if (!db) {
        const file = d.contained(store, d.path.join(store, 'tdb_knowledge_meta.sqlite'));
        db = new SQL(file, {
            readonly: true,
            fileMustExist: true
        });
        own = true;
    }
    try {
        const rows = {};
        for (const table of [
                'files',
                'chunks'
            ])
            rows[table] = db.prepare(`SELECT * FROM ${ table } WHERE library=? ORDER BY path${ table === 'chunks' ? ',chunk_index' : '' }`).all(library).map(({id, ...r}) => preserveIds ? {
                id,
                ...r
            } : r);
        return rows;
    } finally {
        if (own)
            db.close();
    }
}
function pending(store, library, db) {
    let own = false;
    if (!db) {
        db = new SQL(d.contained(store, d.path.join(store, 'tdb_knowledge_meta.sqlite')), {
            readonly: true,
            fileMustExist: true
        });
        own = true;
    }
    try {
        return db.prepare('SELECT COUNT(*) AS n FROM ingest_queue WHERE library=?').get(library).n;
    } finally {
        if (own)
            db.close();
    }
}
function witness(store, library, db, preserveIds = true) {
    return {
        artifacts: bundle(store, library),
        metadata: metadata(store, library, db, preserveIds)
    };
}
module.exports = {
    suffixes,
    bundle,
    metadata,
    pending,
    witness
};

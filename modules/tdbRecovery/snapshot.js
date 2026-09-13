'use strict';
const d = require('./durable');
function inventory(manager, library, root = manager.config.rootPath) {
    d.name(library);
    if (manager.config.excludeFolders.includes(library))
        d.fail('UNSUPPORTED_SOURCE_PROFILE');
    const dir = d.contained(root, library === 'Root' ? root : d.path.join(root, library));
    const files = [], excluded = [];
    function walk(folder) {
        for (const entry of d.fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const p = d.contained(root, d.path.join(folder, entry.name));
            if (entry.isDirectory()) {
                if (library !== 'Root')
                    walk(p);
            } else if (entry.isFile()) {
                const rel = d.path.relative(root, p);
                if (!manager._isIndexable(d.path.join(manager.config.rootPath, rel))) {
                    excluded.push(rel);
                    continue;
                }
                const bytes = d.read(root, p);
                const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
                files.push({
                    path: rel,
                    size: bytes.length,
                    hash: d.hash(bytes),
                    disposition: text.trim() ? 'INDEX' : 'NO_TEXT_EXPECTED'
                });
            } else
                d.fail('UNSUPPORTED_SOURCE_TYPE');
        }
    }
    walk(dir);
    files.sort((a, b) => a.path.localeCompare(b.path));
    excluded.sort();
    if (!files.length)
        d.fail('EMPTY_LIBRARY_UNQUALIFIED');
    return {
        library,
        files,
        excluded
    };
}
function recipe(manager) {
    return {
        schema: 1,
        model: manager.config.model,
        dimension: manager.config.dimension,
        dtype: 'f32',
        chunker: manager.config.recoveryRecipe?.chunkerSha || d.hash(d.read(d.path.resolve(__dirname, '../..'), d.path.resolve(__dirname, '../../TextChunker.js'))),
        maxTokens: manager.config.recoveryRecipe?.maxTokens || Number(process.env.WhitelistEmbeddingModelMaxToken) || 8000,
        extensions: [...manager.config.extensions].sort(),
        excludeFolders: [...manager.config.excludeFolders].sort(),
        ignorePrefixes: manager.config.ignorePrefixes,
        ignoreSuffixes: manager.config.ignoreSuffixes
    };
}
function fingerprint(manager, library, root) {
    const inv = inventory(manager, library, root);
    return {
        ...inv,
        recipe: recipe(manager),
        fingerprint: d.digest({
            ...inv,
            recipe: recipe(manager)
        })
    };
}
function snapshot(runtime, job) {
    const m = runtime.manager, lease = runtime.journal.acquire(job.library, 'source');
    try {
        const before = fingerprint(m, job.library);
        const epoch = runtime.journal.epoch(job.library).source;
        d.capacity(runtime.root, before.files.reduce((n, f) => n + f.size, 0) * 2 + (runtime.options.minimumFreeBytes ?? 64 * 1024 * 1024));
        const root = runtime.jobPath(job, 'snapshot');
        d.mkdir(runtime.root, root);
        let bytes = 0;
        for (const file of before.files) {
            bytes += file.size;
            const input = d.read(m.config.rootPath, d.path.join(m.config.rootPath, file.path));
            if (d.hash(input) !== file.hash)
                d.fail('SNAPSHOT_CHANGED');
            d.write(runtime.root, d.path.join(root, file.path), input);
        }
        lease.check();
        if (fingerprint(m, job.library).fingerprint !== before.fingerprint || runtime.journal.epoch(job.library).source !== epoch)
            d.fail('SNAPSHOT_CHANGED');
        const receipt = {
            ...before,
            source_epoch: epoch,
            bytes,
            job_id: job.job_id,
            candidate_generation: job.candidate_generation
        };
        d.write(runtime.root, runtime.jobPath(job, 'snapshot.json'), d.canonical(receipt));
        return receipt;
    } finally {
        lease.release();
    }
}
module.exports = {
    inventory,
    recipe,
    fingerprint,
    snapshot
};

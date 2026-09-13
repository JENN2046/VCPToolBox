'use strict';
const d = require('./durable');
const {inventory} = require('./snapshot');
function qualify(runtime, library) {
    const m = runtime.manager, store = m.config.storePath;
    if (d.fs.existsSync(d.path.join(store, library + '.tdb.pidx')))
        d.fail('UNQUALIFIED_PROPERTY_INDEX');
    const sources = new Set(inventory(m, library).files.map(f => f.path));
    const db = new runtime.native(d.path.join(store, library + '.tdb'), {
        dim: m.config.dimension,
        dtype: 'f32',
        storageMode: 'mmap',
        loadTextIndex: true,
        accessMode: 'readOnly',
        missingIndexPolicy: 'fallback',
        autoBuildQuiver: false
    });
    try {
        const count = Number(db.storageInfo().node_count);
        if (count > (runtime.options.maxVerifyNodes ?? 100000))
            d.fail('OWNERSHIP_BUDGET');
        const vector = Array(m.config.dimension).fill(0);
        vector[0] = 1;
        const nodes = db.searchExact(vector, count + 1), ids = new Map(nodes.map(n => [
                n.id,
                n.payload
            ]));
        if (ids.size !== count)
            d.fail('OWNERSHIP_ENUMERATION');
        for (const node of nodes) {
            const p = node.payload || {};
            if (![
                    'document',
                    'chunk'
                ].includes(p.type) || p.library !== library || !sources.has(p.source_path))
                d.fail('UNOWNED_NATIVE_STATE');
            const allowed = p.type === 'document' ? [
                'type',
                'library',
                'source_path',
                'title',
                'checksum',
                'chunk_count',
                'mtime',
                'size',
                'updated_at'
            ] : [
                'type',
                'library',
                'source_path',
                'chunk_index',
                'text_preview',
                'checksum',
                'updated_at'
            ];
            if (Object.keys(p).some(k => !allowed.includes(k)))
                d.fail('UNOWNED_PAYLOAD_STATE');
            for (const edge of db.getEdges(node.id)) {
                const target = ids.get(edge.targetId);
                if (!target || target.source_path !== p.source_path || ![
                        'contains',
                        'next',
                        'prev'
                    ].includes(edge.label) || edge.metadata != null)
                    d.fail('UNOWNED_GRAPH_REFERENCE');
            }
        }
    } finally {
        db.close();
    }
}
module.exports = { qualify };

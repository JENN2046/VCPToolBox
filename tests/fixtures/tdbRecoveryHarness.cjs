'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
// Each test process changes to an empty temporary directory before requiring the real manager.
// This prevents TextChunker's existing cwd-relative dotenv loader from reading production config.
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-tdb-recovery-impl-cwd-'));
process.chdir(cwd);
process.env.EMBEDDING_AUDIT_LOG_ENABLED = 'false';
process.env.WhitelistEmbeddingModelMaxToken = '8000';
let embed = async texts => texts.map(() => [
    1,
    0
]);
const embeddingPath = require.resolve('../../EmbeddingUtils');
require.cache[embeddingPath] = {
    id: embeddingPath,
    filename: embeddingPath,
    loaded: true,
    exports: { getEmbeddingsBatch: (...args) => embed(...args) }
};
const Manager = require('../../TDBKnowledge').constructor;
const d = require('../../modules/tdbRecovery/durable');
const {Journal} = require('../../modules/tdbRecovery/journal');
const {inspect} = require('../../modules/tdbRecovery/text-index');
function config(root, options = {}) {
    return {
        enabled: true,
        rootPath: path.join(root, 'knowledge'),
        storePath: path.join(root, 'store'),
        model: 'isolated-deterministic',
        dimension: 2,
        autoBuildQuiver: false,
        memoryLimitMb: 64,
        expectedNodes: 100,
        fullScanOnStartup: false,
        ...options
    };
}
function manager(root, options = {}) {
    const m = new Manager(config(root, options));
    m._startWatcher = () => {
    };
    m._startQueueWorker = () => {
    };
    m._startIdleEvictor = () => {
    };
    return m;
}
function recoveryOptions(extra = {}) {
    return {
        onError: e => console.error(e.stack),
        manualEnabled: true,
        minimumFreeBytes: 1024,
        sourceOwned: {
            A: true,
            B: true
        },
        writerInventory: {
            A: [{
                    id: 'fixture-writer',
                    classification: 'LEASE_AWARE',
                    protocol: 'VCP_TDB_SOURCE_LEASE_V1'
                }],
            B: [{
                    id: 'fixture-writer',
                    classification: 'LEASE_AWARE',
                    protocol: 'VCP_TDB_SOURCE_LEASE_V1'
                }]
        },
        ...extra
    };
}
async function seed(root) {
    for (const lib of [
            'A',
            'B'
        ])
        fs.mkdirSync(path.join(root, 'knowledge', lib), { recursive: true });
    fs.mkdirSync(path.join(root, 'store'), { recursive: true });
    const docs = [
        'quasar ' + 'filler '.repeat(110) + 'tailonlyalpha 星河\u3002',
        'nebula 中文边界 tailonlybeta\u3002',
        'pulsar multi source tailonlygamma\u3002'
    ];
    for (let i = 0; i < 3; i++)
        fs.writeFileSync(path.join(root, 'knowledge/A', `doc${ i }.md`), docs[i]);
    fs.writeFileSync(path.join(root, 'knowledge/B/other.md'), 'independent library quokka\u3002');
    const m = manager(root, { recovery: false });
    await m.initialize();
    for (const lib of [
            'A',
            'B'
        ])
        for (const file of fs.readdirSync(path.join(root, 'knowledge', lib)))
            await m._upsertFileUnlocked(path.join(root, 'knowledge', lib, file));
    await m.shutdown();
}
function mutate(root, damage) {
    for (const ext of damage === 'missing_both' ? [
            '.text',
            '.text.meta'
        ] : damage === 'missing_text' ? ['.text'] : damage === 'missing_meta' ? ['.text.meta'] : [])
        fs.unlinkSync(path.join(root, 'store/A.tdb' + ext));
    if (damage === 'invalid_text')
        fs.writeFileSync(path.join(root, 'store/A.tdb.text.meta'), 'invalid');
}
function bytes(root) {
    return Object.fromEntries(fs.readdirSync(path.join(root, 'store')).filter(n => !n.endsWith('.lock') && !n.endsWith('-shm') && !n.endsWith('-wal') && fs.statSync(path.join(root, 'store', n)).isFile()).map(n => [
        n,
        d.hash(fs.readFileSync(path.join(root, 'store', n)))
    ]));
}
if (require.main === module)
    (async () => {
        const [mode, root, point] = process.argv.slice(2);
        if (!path.resolve(root).startsWith('/tmp/vcp-tdb-recovery-impl-'))
            throw Error('fixture containment');
        if (mode === 'seed') {
            await seed(root);
            return;
        }
        const options = recoveryOptions({
            checkpoint: p => {
                if (p === point)
                    process.kill(process.pid, 'SIGKILL');
            }
        });
        const m = manager(root, { recovery: options });
        await m.initialize();
        if (mode === 'recover') {
            const j = m.recovery.request({ library: 'A' });
            const result = await m.recovery.run(j.job_id);
            if (point === 'AFTER_RETIRE_FILE')
                await m.recovery.retire(result.job_id, result.commit_receipt.time + 86400001);
            console.log('RECEIPT ' + JSON.stringify({
                state: result.state,
                error: result.last_error,
                job: result.job_id
            }));
        } else if (mode === 'restart') {
            console.log('RECEIPT ' + JSON.stringify(m.recovery.journal.all().map(j => ({
                state: j.state,
                phase: j.phase,
                job: j.job_id,
                sequence: j.sequence,
                generation: j.commit_receipt?.generation,
                old_generation: j.undo_receipt?.epoch?.generation,
                blocked: m.recovery.admission.state(j.library).blocked
            }))));
        }
        // Do not invoke ordinary T02/shutdown normalization after a crash-baseline observation.
        m.recovery.close();
        if (m.metaDb)
            m.metaDb.close();
    })().catch(e => {
        console.error(e.stack);
        process.exitCode = 1;
    });
module.exports = {
    setEmbedding: fn => {
        embed = fn || (async texts => texts.map(() => [
            1,
            0
        ]));
    },
    seed,
    manager,
    recoveryOptions,
    mutate,
    bytes,
    Journal,
    inspect,
    d
};

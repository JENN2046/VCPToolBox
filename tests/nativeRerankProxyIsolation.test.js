'use strict';

// Each native HTTP client runs in a fresh child with synthetic proxy settings;
// no process-global Rust environment mutation can race another test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function child() {
    const Database = require('better-sqlite3');
    const { VexusIndex, NativeKnowledgeRuntime } = require('../rust-vexus-lite');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-proxy-child-'));
    const dbPath = path.join(root, 'synthetic.sqlite');
    const runtime = new NativeKnowledgeRuntime(new VexusIndex(2, 16));
    try {
        runtime.openAndInitStore(dbPath);
        const db = new Database(dbPath);
        try {
            db.prepare('INSERT INTO files(id,path,diary_name,checksum,mtime,size) VALUES (1,?,?,?,0,1)')
                .run('A/fixture.md', 'A', 'synthetic');
            const insert = db.prepare('INSERT INTO chunks(id,file_id,chunk_index,content,vector) VALUES (?,1,?,?,?)');
            insert.run(1, 0, 'synthetic one', Buffer.from(new Float32Array([1, 0]).buffer));
            insert.run(2, 1, 'synthetic two', Buffer.from(new Float32Array([0.8, 0.2]).buffer));
        } finally { db.close(); }
        const index = new VexusIndex(2, 16);
        await runtime.restoreDiaryIndex(dbPath, 'A', path.join(root, 'a.vec'), 'synthetic', 16, index);
        runtime.registerDiaryIndex('A', index);
        const modes = process.env.NATIVE_PROXY_ORDER === 'rerank-then-jev' ? [false, true]
            : process.env.NATIVE_PROXY_ORDER === 'jev-then-rerank' ? [true, false] : [true];
        for (const useJev of modes) {
            const result = JSON.parse(await runtime.executeExternalRerank(JSON.stringify({
                diaryNames: ['A'], useJev, topK: 2, candidateK: 16, externalK: 2,
                configPath: path.join(root, 'missing.env'), excludedPrefixes: []
            }), new Float32Array([1, 0])));
            assert.deepEqual(result.results.map(row => row.chunkId), [2, 1]);
        }
    } finally {
        runtime.shutdown();
        fs.rmSync(root, { recursive: true, force: true });
    }
}

if (process.env.NATIVE_RERANK_PROXY_CHILD === '1') {
    child().catch(error => { console.error(error); process.exitCode = 1; });
} else {
    const test = require('node:test');
    const http = require('node:http');
    const { spawn } = require('node:child_process');
    const { once } = require('node:events');
    test('native Jev proxy policy and cached clients remain isolated from ordinary rerank', async () => {
        const response = JSON.stringify({
            answers: { best_memory: { type: 'choice', probabilities: { doc_000: 0.2, doc_001: 0.8 } } },
            results: [{ index: 0, relevance_score: 0.2 }, { index: 1, relevance_score: 0.8 }]
        });
        const counts = { target: 0, ambient: 0, explicit: 0 };
        const servers = {};
        try {
            for (const name of Object.keys(counts)) {
                servers[name] = http.createServer(async (request, reply) => {
                    for await (const chunk of request) {} // Drain the synthetic request only.
                    counts[name]++;
                    reply.setHeader('Content-Type', 'application/json');
                    reply.end(response);
                });
                servers[name].listen(0, '127.0.0.1');
                await once(servers[name], 'listening');
            }
            const endpoint = name => `http://127.0.0.1:${servers[name].address().port}`;
            for (const mode of ['jev-direct', 'jev-explicit', 'rerank-then-jev', 'jev-then-rerank']) {
                const before = { ...counts };
                const explicit = mode === 'jev-explicit';
                const cached = mode.includes('then');
                const worker = spawn(process.execPath, [__filename], {
                    cwd: path.resolve(__dirname, '..'),
                    env: {
                        PATH: process.env.PATH || '', LANG: 'C.UTF-8',
                        NATIVE_RERANK_PROXY_CHILD: '1', NATIVE_PROXY_ORDER: mode, JEV_API_URL: endpoint('target') + '/jev',
                        RerankUrl: endpoint('target') + '/', RerankModel: 'fixture', RerankApi: 'synthetic-fixture',
                        JEV_API_KEY: 'synthetic-fixture', JEV_MODEL: 'fixture', JEV_PROVIDER: 'typesafe',
                        JEV_PROXY_URL: explicit ? endpoint('explicit') : '', NativeRerankTimeoutMs: '5000',
                        HTTP_PROXY: endpoint('ambient'), HTTPS_PROXY: endpoint('ambient'),
                        ALL_PROXY: endpoint('ambient'), http_proxy: endpoint('ambient'),
                        https_proxy: endpoint('ambient'), all_proxy: endpoint('ambient'),
                        NO_PROXY: '', no_proxy: ''
                    },
                    stdio: ['ignore', 'pipe', 'pipe']
                });
                let output = '';
                worker.stdout.on('data', chunk => { output += chunk; });
                worker.stderr.on('data', chunk => { output += chunk; });
                const timer = setTimeout(() => worker.kill(), 15000);
                const [code, signal] = await once(worker, 'exit');
                clearTimeout(timer);
                assert.equal(code, 0, `${signal || ''} ${output}`);
                assert.equal(counts.ambient - before.ambient, cached ? 1 : 0,
                    `${mode}: only ordinary rerank may use the ambient proxy`);
                assert.equal(counts.target - before.target, explicit ? 0 : 1,
                    `${mode}: direct Jev must reach the configured endpoint exactly once`);
                assert.equal(counts.explicit - before.explicit, explicit ? 1 : 0,
                    `${mode}: explicit JEV_PROXY_URL must remain effective`);
            }
        } finally {
            for (const server of Object.values(servers)) {
                server.closeAllConnections();
                await new Promise(resolve => server.close(resolve));
            }
        }
    });
}

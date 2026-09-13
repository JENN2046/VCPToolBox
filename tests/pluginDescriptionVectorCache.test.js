'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const knowledgeBaseModule = require('../KnowledgeBaseManager');
const { KnowledgeBaseManager } = knowledgeBaseModule;

test('plugin description cache migrates legacy keys and namespaces model and dimension', async t => {
    const manager = new KnowledgeBaseManager();
    const db = new Database(':memory:');
    t.after(() => db.close());
    db.exec('CREATE TABLE kv_store (key TEXT PRIMARY KEY, vector BLOB)');
    manager.db = db;
    manager.config.dimension = 3;
    manager.config.model = 'embedding-a';
    manager.config.modelSig = 'embedding-a';

    db.prepare('INSERT INTO kv_store (key, vector) VALUES (?, ?)').run(
        'plugin_desc_hash:legacy',
        Buffer.from(new Float32Array(1024).buffer)
    );
    assert.equal(manager._migratePluginDescriptionVectorCache(), 1);

    let calls = 0;
    const first = await manager.getPluginDescriptionVector('same description', async () => {
        calls += 1;
        return [1, 2, 3];
    });
    const second = await manager.getPluginDescriptionVector('same description', async () => {
        calls += 1;
        return [9, 9, 9];
    });
    assert.deepEqual(first, [1, 2, 3]);
    assert.deepEqual(second, [1, 2, 3]);
    assert.equal(calls, 1);

    const keys = db.prepare('SELECT key FROM kv_store').all().map(row => row.key);
    assert.equal(keys.length, 1);
    assert.match(keys[0], /^plugin_desc:v2:/);
    assert.match(keys[0], /:3:/);

    manager.config.modelSig = 'embedding-b';
    const third = await manager.getPluginDescriptionVector('same description', async () => {
        calls += 1;
        return [4, 5, 6];
    });
    assert.deepEqual(third, [4, 5, 6]);
    assert.equal(calls, 2);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM kv_store').get().count, 2);
});

test('plugin description cache rejects a wrong embedding dimension before write', async t => {
    const manager = new KnowledgeBaseManager();
    const db = new Database(':memory:');
    t.after(() => db.close());
    db.exec('CREATE TABLE kv_store (key TEXT PRIMARY KEY, vector BLOB)');
    manager.db = db;
    manager.config.dimension = 3;
    manager.config.modelSig = 'embedding-a';

    assert.equal(
        await manager.getPluginDescriptionVector('wrong dimension', async () => [1, 2]),
        null
    );
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM kv_store').get().count, 0);
});

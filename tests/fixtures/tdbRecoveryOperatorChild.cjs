'use strict';
const h = require('./tdbRecoveryHarness.cjs');
const {start} = require('../../modules/tdbRecovery/operator-server');
(async () => {
    const root = process.argv[2];
    if (!root.startsWith('/tmp/vcp-tdb-operator-'))
        throw Error('FIXTURE_PATH');
    const manager = h.manager(root, { recovery: h.recoveryOptions() });
    await manager.initialize();
    const server = await start(manager.recovery, { root: root + '/control' });
    process.send({
        ready: true,
        socket: server.socket,
        pid: process.pid
    });
    process.on('message', async msg => {
        if (msg === 'stop') {
            await server.close();
            await manager.shutdown();
            process.exit(0);
        }
    });
})().catch(e => {
    console.error(e.code || e.message);
    process.exit(1);
});

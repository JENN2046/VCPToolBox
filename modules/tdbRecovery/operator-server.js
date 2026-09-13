'use strict';
const net = require('node:net');
const d = require('./durable');
const {OperatorControl} = require('./operator-control');
function defaultRoot() {
    return `/run/user/${ process.getuid() }/vcp-tdb-recovery-operator`;
}
function privateRoot(root) {
    d.mkdir(d.path.dirname(root), root);
    const st = d.fs.lstatSync(root);
    if (!st.isDirectory() || st.uid !== process.getuid() || st.mode & 63)
        d.fail('UNSAFE_OPERATOR_DIRECTORY');
}
async function removeStale(socket) {
    if (!d.fs.existsSync(socket))
        return;
    const st = d.fs.lstatSync(socket);
    if (!st.isSocket() || st.uid !== process.getuid())
        d.fail('UNSAFE_OPERATOR_SOCKET');
    await new Promise((resolve, reject) => {
        const s = net.createConnection(socket);
        s.once('connect', () => {
            s.destroy();
            reject(Object.assign(new Error('OPERATOR_ALREADY_RUNNING'), { code: 'OPERATOR_ALREADY_RUNNING' }));
        });
        s.once('error', e => e.code === 'ECONNREFUSED' ? resolve() : reject(e));
    });
    const current = d.fs.lstatSync(socket);
    if (current.ino !== st.ino || current.dev !== st.dev)
        d.fail('OPERATOR_SOCKET_CHANGED');
    d.fs.unlinkSync(socket);
}
async function start(runtime, {root = defaultRoot(), clock, dispatch} = {}) {
    privateRoot(root);
    const socket = d.path.join(root, 'operator.sock');
    d.contained(root, socket, { missing: true });
    await removeStale(socket);
    const control = new OperatorControl(runtime, {
        root,
        clock,
        dispatch
    });
    const clients = new Set();
    const server = net.createServer(client => {
        clients.add(client);
        client.once('close', () => clients.delete(client));
        client.on('error', () => {
        });
        client.setTimeout(5000, () => client.destroy());
        let data = Buffer.alloc(0), handled = false;
        client.on('data', chunk => {
            if (handled)
                return;
            data = Buffer.concat([
                data,
                chunk
            ]);
            const respond = obj => {
                handled = true;
                client.end(JSON.stringify(obj) + '\n');
            };
            if (data.length > 8192)
                return respond({
                    ok: false,
                    error: 'OPERATOR_REQUEST_TOO_LARGE'
                });
            if (!data.includes(10))
                return;
            try {
                const input = JSON.parse(data.toString('utf8'));
                respond({
                    ok: true,
                    result: control.handle(input)
                });
            } catch (e) {
                respond({
                    ok: false,
                    error: /^[A-Z_]{1,64}$/.test(e.code || '') ? e.code : 'INVALID_OPERATOR_REQUEST'
                });
            }
        });
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(socket, resolve);
    });
    d.fs.chmodSync(socket, 384);
    const identity = d.fs.lstatSync(socket);
    server.on('error', () => {
        control.grant = null;
        control.auditFailure = true;
    });
    console.info(`[TDBRecoveryOperator] ready pid=${ process.pid } auto=false manual=false transport=unix`);
    return {
        control,
        server,
        socket,
        async close() {
            control.grant = null;
            for (const client of clients)
                client.destroy();
            await new Promise(resolve => server.close(resolve));
            if (d.fs.existsSync(socket)) {
                const st = d.fs.lstatSync(socket);
                if (st.ino === identity.ino && st.dev === identity.dev)
                    d.fs.unlinkSync(socket);
            }
        }
    };
}
module.exports = {
    start,
    defaultRoot
};

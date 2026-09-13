'use strict';
const net = require('node:net');
const {defaultRoot} = require('./operator-server');
const d = require('./durable');
function request(input, {socket = d.path.join(defaultRoot(), 'operator.sock'), timeout = 5000} = {}) {
    return new Promise((resolve, reject) => {
        const client = net.createConnection(socket);
        let bytes = Buffer.alloc(0), done = false;
        const finish = (error, result) => {
            if (done)
                return;
            done = true;
            client.destroy();
            error ? reject(error) : resolve(result);
        };
        client.setTimeout(timeout, () => finish(Object.assign(new Error('OPERATOR_IPC_TIMEOUT'), { code: 'OPERATOR_IPC_TIMEOUT' })));
        client.once('error', () => finish(Object.assign(new Error('MAIN_OPERATOR_UNAVAILABLE'), { code: 'MAIN_OPERATOR_UNAVAILABLE' })));
        client.once('connect', () => client.write(JSON.stringify(input) + '\n'));
        client.on('data', chunk => {
            bytes = Buffer.concat([
                bytes,
                chunk
            ]);
            if (bytes.length > 1048576)
                return finish(Object.assign(new Error('INVALID_OPERATOR_RESPONSE'), { code: 'INVALID_OPERATOR_RESPONSE' }));
            if (!bytes.includes(10))
                return;
            try {
                const message = JSON.parse(bytes.toString('utf8'));
                if (!message.ok)
                    throw Object.assign(new Error(message.error), { code: message.error });
                finish(null, message.result);
            } catch (e) {
                finish(e);
            }
        });
        client.once('end', () => {
            if (!done)
                finish(Object.assign(new Error('OPERATOR_IPC_CLOSED'), { code: 'OPERATOR_IPC_CLOSED' }));
        });
    });
}
module.exports = { request };

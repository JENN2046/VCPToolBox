'use strict';
// An unset option preserves both legacy TCP and Unix-socket listen semantics.
function localListenArguments(port, host) {
 if (host === undefined) return [port];
 if (!['127.0.0.1', '::1'].includes(host)) throw new Error('VCP_LOCAL_LISTEN_HOST_MUST_BE_LOOPBACK');
 if (!/^[0-9]{1,5}$/.test(String(port)) || Number(port)>65535) throw new Error('VCP_LOCAL_LISTEN_PORT_INVALID');
 return [Number(port), host];
}
function localMainOrigin(port,host){
 localListenArguments(port,host);
 return `http://${host==='::1'?'[::1]':'127.0.0.1'}:${port}`;
}
module.exports={localListenArguments,localMainOrigin};

'use strict';

// Additive v1 response/sync types; no capability or receipt values enter these messages.
function send(socket, type, data) {
    if (socket.readyState !== 1) return false;
    try { socket.send(JSON.stringify({ type, data })); return true; }
    catch { return false; } // Durable-in-process terminal state remains available for reconnect.
}
function dispatchApprovalMessage(socket, message, manager) {
    if (message.type === 'tool_approval_response') {
        const data = message.data && typeof message.data === 'object' ? message.data : {};
        const outcome = manager.handleApprovalResponseOutcome(data, socket);
        send(socket, 'tool_approval_ack', outcome);
        return true;
    }
    if (message.type === 'tool_approval_sync') {
        const data = message.data;
        const result = data?.protocolVersion === 1 ? manager.syncApprovals(socket) : { protocolVersion: 1, outcome: 'INVALID_RESPONSE' };
        send(socket, 'tool_approval_snapshot', result);
        return true;
    }
    return false;
}
function broadcastApprovalTerminal(clients, authority, terminal) {
    for (const socket of clients) if (authority.isHuman(socket)) send(socket, 'tool_approval_terminal', { protocolVersion: 1, ...terminal });
}
module.exports = { dispatchApprovalMessage, broadcastApprovalTerminal };

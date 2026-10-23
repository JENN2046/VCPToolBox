'use strict';
const crypto=require('node:crypto');
function extractTextForHash(content) {
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        return content
            .filter(part => part && part.type === 'text' && typeof part.text === 'string')
            .map(part => part.text)
            .join('\n');
    }
    if (content && typeof content.text === 'string') {
        return content.text;
    }
    return '';
}

function hashSentMessage(message) {
    return `sha256:${crypto.createHash('sha256').update(extractTextForHash(message.content), 'utf8').digest('hex')}`;
}

function buildVcpChatExtensionsFromMessages(messages, context = null, requestId = null) {
    const messageTimestampBindings = [];
    messages.forEach((message, index) => {
        const meta = message && message.__vcpchatTimestampMeta;
        if (!meta || !meta.messageId || typeof meta.timestamp !== 'number') {
            return;
        }
        messageTimestampBindings.push({
            messageId: meta.messageId,
            role: message.role || meta.role,
            timestamp: meta.timestamp,
            timestampIso: new Date(meta.timestamp).toISOString(),
            source: 'client_history',
            sentMessageHash: hashSentMessage(message),
            sentMessageIndex: index
        });
    });

    const requestContext = buildRequestContext(context, requestId);
    if (messageTimestampBindings.length === 0 && !requestContext) {
        return null;
    }

    return {
        schemaVersion: 1,
        messageMetadataMode: 'hash_only',
        ...(messageTimestampBindings.length > 0 ? { messageTimestampBindings } : {}),
        ...(requestContext ? { requestContext } : {})
    };
}

function buildRequestContext(context, requestId) {
    if (!context || typeof context !== 'object') return null;
    const agentId = typeof context.agentId === 'string' ? context.agentId.trim() : '';
    const agentName = typeof context.agentName === 'string' ? context.agentName.trim() : '';
    const topicId = typeof context.topicId === 'string' ? context.topicId.trim() : '';
    if (!agentId && !topicId) return null;

    return {
        requestId: typeof requestId === 'string' ? requestId : undefined,
        agentId: agentId || undefined,
        agentName: agentName || undefined,
        topicId: topicId || undefined,
        ownerType: context.isGroupMessage === true ? 'group' : 'agent',
        isGroupMessage: context.isGroupMessage === true
    };
}

function stripInternalMessageMetadata(messages) {
    return messages.map(message => {
        if (!message || typeof message !== 'object') return message;
        const { __vcpchatTimestampMeta, __vcpContextCheckpoint, ...cleanMessage } = message;
        return cleanMessage;
    });
}

module.exports={buildVcpChatExtensionsFromMessages,stripInternalMessageMetadata};

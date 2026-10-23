'use strict';
function attachTimestampMetadata(vcpMessage, historyMessage) {
    if (
        !historyMessage?.id
        || typeof historyMessage.timestamp !== 'number'
        || !Number.isFinite(historyMessage.timestamp)
    ) {
        return vcpMessage;
    }

    return {
        ...vcpMessage,
        __vcpchatTimestampMeta: {
            messageId: historyMessage.id,
            role: historyMessage.role,
            timestamp: historyMessage.timestamp,
        },
    };
}

module.exports={attachTimestampMetadata};

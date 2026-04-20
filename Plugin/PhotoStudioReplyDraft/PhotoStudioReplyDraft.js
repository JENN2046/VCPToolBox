const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');
const { generateClientReplyDraft } = require('../../modules/photoStudio/replyDraftService');

runPhotoStudioCommand(generateClientReplyDraft, {
    pluginName: 'generate_client_reply_draft',
    version: '1.0.0'
});

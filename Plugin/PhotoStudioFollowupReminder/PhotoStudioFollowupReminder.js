const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');
const { createFollowupReminder } = require('../../modules/photoStudio/followupReminderService');

runPhotoStudioCommand(createFollowupReminder, {
    pluginName: 'create_followup_reminder',
    version: '1.0.0'
});

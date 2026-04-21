const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');
const { syncCalendarEvent } = require('../../modules/photoStudio/calendarSyncService');

runPhotoStudioCommand(syncCalendarEvent, {
    pluginName: 'sync_calendar_event',
    version: '1.0.0'
});

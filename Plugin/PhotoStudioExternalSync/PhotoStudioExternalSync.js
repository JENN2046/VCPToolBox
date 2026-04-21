const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');
const { syncToExternalSheetOrNotion } = require('../../modules/photoStudio/externalSyncService');

runPhotoStudioCommand(syncToExternalSheetOrNotion, {
    pluginName: 'sync_to_external_sheet_or_notion',
    version: '1.0.0'
});

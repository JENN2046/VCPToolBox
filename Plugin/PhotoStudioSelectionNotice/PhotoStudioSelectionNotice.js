const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');
const { createSelectionNotice } = require('../../modules/photoStudio/selectionNoticeService');

runPhotoStudioCommand(createSelectionNotice, {
    pluginName: 'create_selection_notice',
    version: '1.0.0'
});

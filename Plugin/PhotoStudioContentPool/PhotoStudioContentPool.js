const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');
const { pushProjectToContentPool } = require('../../modules/photoStudio/contentPoolService');

runPhotoStudioCommand(pushProjectToContentPool, {
    pluginName: 'push_project_to_content_pool',
    version: '1.0.0'
});

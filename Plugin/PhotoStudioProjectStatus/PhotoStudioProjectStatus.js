const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');
const { updateProjectStatus } = require('../../modules/photoStudio/statusService');

runPhotoStudioCommand(updateProjectStatus, {
    pluginName: 'update_project_status',
    version: '1.0.0'
});

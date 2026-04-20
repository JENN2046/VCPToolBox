const { createProjectRecord } = require('../../modules/photoStudio/projectService');
const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');

runPhotoStudioCommand(createProjectRecord, {
    pluginName: 'create_project_record',
    version: '1.0.0'
});

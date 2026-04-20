const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');
const { createProjectTasks } = require('../../modules/photoStudio/taskService');

runPhotoStudioCommand(createProjectTasks, {
    pluginName: 'create_project_tasks',
    version: '1.0.0'
});

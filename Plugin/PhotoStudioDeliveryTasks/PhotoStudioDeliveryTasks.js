const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');
const { createDeliveryTasks } = require('../../modules/photoStudio/deliveryTaskService');

runPhotoStudioCommand(createDeliveryTasks, {
    pluginName: 'create_delivery_tasks',
    version: '1.0.0'
});

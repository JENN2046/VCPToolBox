const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');
const { generateDeliveryQueueSchedule } = require('../../modules/photoStudio/queueSchedulingService');

runPhotoStudioCommand(generateDeliveryQueueSchedule, {
    pluginName: 'generate_delivery_queue_schedule',
    version: '1.0.0'
});

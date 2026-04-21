const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');
const { processExternalDeliveryQueue } = require('../../modules/photoStudio/externalDeliveryQueueService');

runPhotoStudioCommand(processExternalDeliveryQueue, {
    pluginName: 'process_external_delivery_queue',
    version: '1.0.0'
});

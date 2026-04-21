const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');
const { prioritizePendingDeliveryActions } = require('../../modules/photoStudio/queueSchedulingService');

runPhotoStudioCommand(prioritizePendingDeliveryActions, {
    pluginName: 'prioritize_pending_delivery_actions',
    version: '1.0.0'
});

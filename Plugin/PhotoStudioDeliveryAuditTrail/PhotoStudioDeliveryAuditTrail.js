const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');
const { inspectDeliveryAuditTrail } = require('../../modules/photoStudio/deliveryReportingService');

runPhotoStudioCommand(inspectDeliveryAuditTrail, {
    pluginName: 'inspect_delivery_audit_trail',
    version: '1.0.0'
});

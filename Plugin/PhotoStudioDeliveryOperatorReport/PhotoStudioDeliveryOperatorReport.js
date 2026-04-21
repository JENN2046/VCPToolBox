const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');
const { generateDeliveryOperatorReport } = require('../../modules/photoStudio/deliveryReportingService');

runPhotoStudioCommand(generateDeliveryOperatorReport, {
    pluginName: 'generate_delivery_operator_report',
    version: '1.0.0'
});

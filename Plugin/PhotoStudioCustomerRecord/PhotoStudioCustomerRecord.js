const { createCustomerRecord } = require('../../modules/photoStudio/customerService');
const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');

runPhotoStudioCommand(createCustomerRecord, {
    pluginName: 'create_customer_record',
    version: '1.0.0'
});

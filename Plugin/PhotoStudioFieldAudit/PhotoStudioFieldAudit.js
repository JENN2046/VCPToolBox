const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');
const { checkMissingProjectFields } = require('../../modules/photoStudio/missingProjectFieldsAuditService');

runPhotoStudioCommand(checkMissingProjectFields, {
    pluginName: 'check_missing_project_fields',
    version: '1.0.0'
});

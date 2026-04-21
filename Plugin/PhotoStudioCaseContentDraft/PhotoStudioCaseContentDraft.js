const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');
const { generateCaseContentDraft } = require('../../modules/photoStudio/caseContentDraftService');

runPhotoStudioCommand(generateCaseContentDraft, {
    pluginName: 'generate_case_content_draft',
    version: '1.0.0'
});

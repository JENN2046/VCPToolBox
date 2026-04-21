const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');
const { generateWeeklyProjectDigest } = require('../../modules/photoStudio/weeklyDigestService');

runPhotoStudioCommand(generateWeeklyProjectDigest, {
    pluginName: 'generate_weekly_project_digest',
    version: '1.0.0'
});

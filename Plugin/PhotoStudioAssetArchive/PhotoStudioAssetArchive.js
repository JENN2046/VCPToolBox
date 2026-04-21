const { runPhotoStudioCommand } = require('../../modules/photoStudio/runtime');
const { archiveProjectAssets } = require('../../modules/photoStudio/archiveProjectAssetsService');

runPhotoStudioCommand(archiveProjectAssets, {
    pluginName: 'archive_project_assets',
    version: '1.0.0'
});

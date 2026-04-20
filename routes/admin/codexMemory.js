const express = require('express');
const path = require('path');

const {
    DEFAULT_AUDIT_WINDOW,
    DEFAULT_LIST_LIMIT,
    buildCodexMemoryOverview,
    toInt
} = require('../../modules/codexMemoryOverview');

module.exports = function createCodexMemoryAdminRoute(options) {
    const router = express.Router();
    const { dailyNoteRootPath, projectBasePath: injectedProjectBasePath } = options;
    const projectBasePath = injectedProjectBasePath
        ? path.resolve(injectedProjectBasePath)
        : path.join(__dirname, '..', '..');

    router.get('/codex-memory/overview', async (req, res) => {
        try {
            const auditWindow = toInt(req.query.auditWindow, DEFAULT_AUDIT_WINDOW, 10, 2000);
            const listLimit = toInt(req.query.limit, DEFAULT_LIST_LIMIT, 1, 50);
            const overview = await buildCodexMemoryOverview({
                projectBasePath,
                dailyNoteRootPath,
                auditWindow,
                listLimit
            });

            res.json(overview);
        } catch (error) {
            console.error('[AdminAPI] Error building Codex memory overview:', error);
            res.status(500).json({
                error: 'Failed to load Codex memory overview',
                details: error.message
            });
        }
    });

    return router;
};

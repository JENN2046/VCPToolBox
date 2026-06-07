const express = require('express');
const finalContextStore = require('../../modules/finalContextStore.js');
const {
    getRequestOneRingAdminConfig,
    readOneRingAdminConfig,
    writeOneRingAdminConfig
} = require('../../modules/oneringAdminConfig.js');

module.exports = function(options = {}) {
    const router = express.Router();
    const projectRoot = options.projectBasePath;

    router.get('/final-context', (req, res) => {
        const snapshot = finalContextStore.getLastFinalContext();

        if (!snapshot) {
            return res.json({
                available: false,
                message: '尚未捕获任何最终上下文。请先发起一次 /v1/chat/completions 请求。'
            });
        }

        res.json({
            available: true,
            snapshot
        });
    });

    router.get('/onering-config', async (req, res) => {
        try {
            const result = await readOneRingAdminConfig({ projectRoot });
            res.json(result);
        } catch (error) {
            console.error('[AdminAPI] Error reading OneRing config:', error);
            res.status(500).json({
                error: 'Failed to read OneRing config',
                details: 'OneRing config path could not be resolved.'
            });
        }
    });

    router.put('/onering-config', async (req, res) => {
        try {
            const config = getRequestOneRingAdminConfig(req.body);
            const result = await writeOneRingAdminConfig({ projectRoot, config });
            res.json({
                success: true,
                message: 'OneRing config saved.',
                config: result.config,
                path: result.path,
                exists: result.exists
            });
        } catch (error) {
            if (error?.code === 'INVALID_ONERING_CONFIG') {
                return res.status(400).json({
                    error: 'Invalid OneRing config',
                    details: error.details
                });
            }

            console.error('[AdminAPI] Error writing OneRing config:', error);
            res.status(500).json({
                error: 'Failed to write OneRing config',
                details: 'OneRing config could not be saved.'
            });
        }
    });

    return router;
};

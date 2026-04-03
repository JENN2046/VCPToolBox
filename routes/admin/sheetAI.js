const express = require('express');

module.exports = function sheetAIAdminModule() {
    const router = express.Router();
    const sheetAIRoutes = require('../sheetAIRoutes')();

    router.use('/sheetai', sheetAIRoutes);
    return router;
};

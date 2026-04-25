const express = require('express');

module.exports = function toolExecutionRoutes() {
    const router = express.Router();

    // Compatibility shim:
    // server.js mounts this module, while the actual human tool endpoint is
    // implemented directly in server.js. Keep the router available so startup
    // does not fail when the module is required.

    return router;
};

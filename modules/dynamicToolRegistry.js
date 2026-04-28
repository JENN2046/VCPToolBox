'use strict';

/**
 * Dynamic tool registry bootstrap.
 *
 * The current server bootstrap always awaits `dynamicToolRegistry.initialize(...)`
 * before plugin loading. This module provides a safe no-op initializer so startup
 * never fails when dynamic tool registration is not configured.
 */
class DynamicToolRegistry {
    constructor() {
        this.initialized = false;
    }

    async initialize({ debugMode = false } = {}) {
        if (this.initialized) {
            if (debugMode) {
                console.log('[DynamicToolRegistry] Already initialized, skipping.');
            }
            return;
        }

        this.initialized = true;

        if (debugMode) {
            console.log('[DynamicToolRegistry] Initialized with no dynamic registrations.');
        }
    }
}

module.exports = new DynamicToolRegistry();

'use strict';

class RuntimeHealthRegistry {
    constructor() {
        this.startedAt = new Date().toISOString();
        this.phase = 'starting';
        this.components = new Map();
        this.lastTransitionAt = this.startedAt;
    }

    setPhase(phase) {
        this.phase = phase;
        this.lastTransitionAt = new Date().toISOString();
    }

    setComponent(name, status, details = null, required = true) {
        this.components.set(name, {
            name,
            status,
            required,
            details,
            updatedAt: new Date().toISOString()
        });
    }

    removeComponent(name) {
        this.components.delete(name);
    }

    isReady() {
        if (this.phase !== 'ready') return false;
        for (const component of this.components.values()) {
            if (component.required && component.status !== 'ready') {
                return false;
            }
        }
        return true;
    }

    getPublicLiveness() {
        return { status: 'ok' };
    }

    getPublicReadiness() {
        return { status: this.isReady() ? 'ready' : 'not_ready' };
    }

    getDetailedStatus() {
        return {
            phase: this.phase,
            ready: this.isReady(),
            startedAt: this.startedAt,
            lastTransitionAt: this.lastTransitionAt,
            components: Array.from(this.components.values()).map(component => ({
                ...component,
                details: component.details && typeof component.details === 'object'
                    ? { ...component.details }
                    : component.details
            }))
        };
    }
}

module.exports = new RuntimeHealthRegistry();
module.exports.RuntimeHealthRegistry = RuntimeHealthRegistry;

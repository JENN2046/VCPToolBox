'use strict';
const {AsyncLocalStorage} = require('node:async_hooks');
const {fail} = require('./durable');
class Admission {
    constructor() {
        this.context = new AsyncLocalStorage();
        this.libraries = new Map();
        this.globalBlocked = true;
    }
    state(lib) {
        if (!this.libraries.has(lib))
            this.libraries.set(lib, {
                blocked: false,
                active: 0,
                waiters: []
            });
        return this.libraries.get(lib);
    }
    block(lib, reason = 'RECOVERY_INCOMPLETE') {
        const s = this.state(lib);
        s.blocked = true;
        s.reason = reason;
    }
    unblock(lib) {
        const s = this.state(lib);
        s.blocked = false;
        s.reason = null;
    }
    has(lib) {
        return this.context.getStore()?.scopes?.get(lib)?.active === true;
    }
    assert(lib) {
        if (this.has(lib))
            return;
        const s = this.state(lib);
        if (this.globalBlocked || s.blocked)
            fail(s.reason || 'RECOVERY_STARTUP_PENDING');
    }
    enter(lib, exclusive = false) {
        const parent = this.context.getStore();
        const token = { active: true };
        const scopes = new Map(parent?.scopes || []);
        scopes.set(lib, token);
        const state = this.state(lib);
        state.active++;
        return {
            context: {
                scopes,
                exclusive
            },
            release: () => {
                token.active = false;
                if (--state.active === 0)
                    state.waiters.splice(0).forEach(f => f());
            }
        };
    }
    useSync(lib, fn) {
        if (this.has(lib))
            return fn();
        this.assert(lib);
        const scope = this.enter(lib);
        try {
            return this.context.run(scope.context, fn);
        } finally {
            scope.release();
        }
    }
    async use(lib, fn) {
        if (this.has(lib))
            return fn();
        this.assert(lib);
        const scope = this.enter(lib);
        try {
            return await this.context.run(scope.context, fn);
        } finally {
            scope.release();
        }
    }
    async exclusive(lib, fn) {
        if (this.has(lib))
            fail('LOCK_ORDER_VIOLATION');
        this.block(lib);
        const s = this.state(lib);
        if (s.active)
            await new Promise(resolve => s.waiters.push(resolve));
        const scope = this.enter(lib, true);
        try {
            return await this.context.run(scope.context, fn);
        } finally {
            scope.release();
        }
    }
}
module.exports = { Admission };

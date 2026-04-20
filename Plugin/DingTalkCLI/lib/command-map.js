'use strict';

const fs = require('fs');

const DEFAULT_ALIASES = {
  query: 'query',
  list: 'query',
  get: 'query',
  read: 'query',
  create: 'write',
  write: 'write',
  add: 'write',
  send: 'write',
  update: 'update',
  modify: 'update',
  delete: 'delete',
  remove: 'delete'
};

class CommandMap {
  constructor(options) {
    this.path = options.path;
    this.logger = options.logger;
    this.cache = null;
    this.loadedAt = 0;
  }

  load() {
    if (this.cache) {
      return this.cache;
    }

    try {
      if (!fs.existsSync(this.path)) {
        this.cache = {};
        return this.cache;
      }

      const parsed = JSON.parse(fs.readFileSync(this.path, 'utf8'));
      this.cache = parsed && typeof parsed === 'object' ? parsed : {};
      this.loadedAt = Date.now();
      return this.cache;
    } catch (error) {
      if (this.logger) {
        this.logger.warn('failed to load capability map', { path: this.path, error: error.message });
      }
      this.cache = {};
      return this.cache;
    }
  }

  resolve(product, toolTokens) {
    const map = this.load();
    const productMap = map[product] || null;

    if (!productMap || !Array.isArray(toolTokens) || toolTokens.length !== 1) {
      return {
        resolved: toolTokens,
        mapped: false,
        from: null,
        to: Array.isArray(toolTokens) ? toolTokens.join(' ') : ''
      };
    }

    const aliasKey = DEFAULT_ALIASES[toolTokens[0]];
    if (!aliasKey || !productMap[aliasKey]) {
      return {
        resolved: toolTokens,
        mapped: false,
        from: toolTokens[0],
        to: Array.isArray(toolTokens) ? toolTokens.join(' ') : ''
      };
    }

    const resolved = String(productMap[aliasKey]).split(/\s+/).filter(Boolean);
    return {
      resolved,
      mapped: true,
      from: toolTokens[0],
      to: resolved.join(' ')
    };
  }
}

module.exports = {
  CommandMap
};
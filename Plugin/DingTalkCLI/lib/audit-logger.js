'use strict';

const fs = require('fs');
const path = require('path');
const { ensureDirSync, nowIso } = require('./helpers');

class AuditLogger {
  constructor(options) {
    this.logPath = options.logPath;
    this.logger = options.logger;

    ensureDirSync(path.dirname(this.logPath));
  }

  write(entry) {
    const enriched = {
      timestamp: nowIso(),
      ...entry
    };

    try {
      fs.appendFileSync(this.logPath, `${JSON.stringify(enriched)}\n`, 'utf8');
    } catch (error) {
      if (this.logger) {
        this.logger.warn('failed to write audit log', {
          logPath: this.logPath,
          error: error.message
        });
      }
    }
  }
}

module.exports = {
  AuditLogger
};
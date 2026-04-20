'use strict';

const { nowIso } = require('./helpers');

function createLogger(debugEnabled = false) {
  function write(level, message, meta) {
    if (level === 'DEBUG' && !debugEnabled) {
      return;
    }

    const payload = meta && typeof meta === 'object' ? ` ${JSON.stringify(meta)}` : '';
    process.stderr.write(`[${level}] ${nowIso()} ${message}${payload}\n`);
  }

  return {
    info(message, meta) {
      write('INFO', message, meta);
    },
    warn(message, meta) {
      write('WARN', message, meta);
    },
    error(message, meta) {
      write('ERROR', message, meta);
    },
    debug(message, meta) {
      write('DEBUG', message, meta);
    }
  };
}

module.exports = {
  createLogger
};
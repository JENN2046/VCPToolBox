'use strict';

const {
  PRODUCT_ALIASES,
  SUPPORTED_PRODUCTS,
  WRITE_TOOL_HINTS,
  READ_TOOL_HINTS,
  DEFAULTS,
  GRAY_STAGE,
  LOW_RISK_WRITE_PRODUCTS
} = require('./constants');

function normalizeProduct(product) {
  const raw = String(product || '').trim().toLowerCase();
  if (!raw) {
    return '';
  }
  return PRODUCT_ALIASES[raw] || raw;
}

function normalizeTool(tool) {
  return String(tool || '')
    .trim()
    .toLowerCase()
    .replace(/[/:.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitToolPath(tool) {
  const normalized = normalizeTool(tool);
  if (!normalized) {
    return [];
  }
  return normalized.split(' ').filter(Boolean);
}

function isSafeToken(value) {
  return /^[a-z0-9_-]+$/i.test(value);
}

function estimateSizeBytes(obj) {
  try {
    return Buffer.byteLength(JSON.stringify(obj || {}), 'utf8');
  } catch (_) {
    return Number.POSITIVE_INFINITY;
  }
}

function containsDisallowedKey(obj) {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(obj, '__proto__')) {
    return true;
  }

  if (Object.prototype.hasOwnProperty.call(obj, 'constructor')) {
    return true;
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && containsDisallowedKey(value)) {
      return true;
    }
  }

  return false;
}

function collectUrls(value, collector) {
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) {
      collector.push(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectUrls(item, collector);
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectUrls(item, collector);
    }
  }
}

function extractHost(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch (_) {
    return null;
  }
}

function isWriteOperation(toolName) {
  const tool = String(toolName || '').toLowerCase();
  if (!tool) {
    return false;
  }

  if (READ_TOOL_HINTS.some((hint) => tool.includes(hint)) && !WRITE_TOOL_HINTS.some((hint) => tool.includes(hint))) {
    return false;
  }

  return WRITE_TOOL_HINTS.some((hint) => tool.includes(hint));
}

function findLargestArrayLength(value) {
  let max = 0;

  const walk = (node) => {
    if (Array.isArray(node)) {
      max = Math.max(max, node.length);
      for (const item of node) {
        walk(item);
      }
      return;
    }

    if (node && typeof node === 'object') {
      for (const v of Object.values(node)) {
        walk(v);
      }
    }
  };

  walk(value);
  return max;
}

class SecurityHandler {
  constructor(options) {
    this.trustedDomains = options.trustedDomains || [];
    this.maxArgBytes = options.maxArgBytes;
    this.batchLimit = options.batchLimit;
    this.grayStage = options.grayStage || DEFAULTS.DWS_GRAY_STAGE;
  }

  validateReleaseGate(input) {
    const write = input && input.write === true;
    if (!write) {
      return { ok: true };
    }

    const stage = this.grayStage || DEFAULTS.DWS_GRAY_STAGE;
    const product = normalizeProduct(input && input.product);
    const tool = normalizeTool(input && input.tool);

    if (stage === GRAY_STAGE.QUERY_ONLY) {
      return {
        ok: false,
        reason: `write operation blocked in gray stage: ${stage}`,
        hint: `query-only stage allows read tools only (${product}.${tool})`
      };
    }

    if (stage === GRAY_STAGE.LOW_RISK_WRITE && !LOW_RISK_WRITE_PRODUCTS.has(product)) {
      return {
        ok: false,
        reason: `write operation blocked for product ${product} in gray stage: ${stage}`,
        hint: 'allowed write products: todo, ding, chat'
      };
    }

    return { ok: true };
  }

  validateExecuteInput(input) {
    const product = normalizeProduct(input.product);
    const tool = normalizeTool(input.tool);
    const toolTokens = splitToolPath(tool);

    if (!product) {
      return { ok: false, reason: 'product is required' };
    }

    if (!tool) {
      return { ok: false, reason: 'tool is required' };
    }

    if (!SUPPORTED_PRODUCTS.has(product)) {
      return {
        ok: false,
        reason: `unsupported product: ${product}`,
        hint: `supported products: ${Array.from(SUPPORTED_PRODUCTS).join(', ')}`
      };
    }

    if (!isSafeToken(product) || toolTokens.length === 0 || toolTokens.some((token) => !isSafeToken(token))) {
      return {
        ok: false,
        reason: 'product/tool contains unsafe characters',
        hint: 'tool path supports spaces but each token must use letters, digits, underscore or hyphen'
      };
    }

    const args = input.args && typeof input.args === 'object' ? input.args : {};
    if (containsDisallowedKey(args)) {
      return {
        ok: false,
        reason: 'args contains unsafe key',
        hint: 'remove __proto__ and constructor keys'
      };
    }

    const argBytes = estimateSizeBytes(args);
    if (argBytes > this.maxArgBytes) {
      return {
        ok: false,
        reason: `args payload too large (${argBytes} bytes)`,
        hint: `max allowed bytes: ${this.maxArgBytes}`
      };
    }

    if (this.trustedDomains.length > 0) {
      const urls = [];
      collectUrls(args, urls);

      for (const url of urls) {
        const host = extractHost(url);
        if (!host) {
          return {
            ok: false,
            reason: `invalid url in args: ${url}`,
            hint: 'provide valid https url values'
          };
        }

        const trusted = this.trustedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
        if (!trusted) {
          return {
            ok: false,
            reason: `url host is not trusted: ${host}`,
            hint: `trusted domains: ${this.trustedDomains.join(', ')}`
          };
        }
      }
    }

    const largestArray = findLargestArrayLength(args);
    if (largestArray > this.batchLimit) {
      return {
        ok: false,
        reason: `batch size ${largestArray} exceeds limit`,
        hint: `split into chunks <= ${this.batchLimit}`
      };
    }

    const apply = input.apply === true;
    const yes = input.yes === true;
    const requestedDryRun = typeof input.dry_run === 'boolean' ? input.dry_run : true;
    const write = isWriteOperation(tool);

    let effectiveDryRun = requestedDryRun;
    if (apply) {
      effectiveDryRun = false;
    } else if (!write) {
      effectiveDryRun = false;
    }

    if (write && !apply) {
      effectiveDryRun = true;
    }

    return {
      ok: true,
      value: {
        product,
        tool,
        toolTokens,
        args,
        write,
        apply,
        yes,
        jq: typeof input.jq === 'string' ? input.jq.trim() : '',
        format: typeof input.format === 'string' && input.format.trim() ? input.format.trim().toLowerCase() : 'json',
        dryRun: effectiveDryRun,
        requestedDryRun
      }
    };
  }
}

module.exports = {
  SecurityHandler,
  normalizeProduct,
  normalizeTool,
  splitToolPath,
  isWriteOperation
};

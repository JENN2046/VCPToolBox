'use strict';

const fs = require('fs');
const path = require('path');
const { ensureDirSync, safeJsonParse, toJsonIfPossible, nowIso } = require('./helpers');

function normalizeToolRecord(raw) {
  if (!raw) {
    return null;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    const pair = trimmed.split(/[\s/:]+/).filter(Boolean);
    if (pair.length >= 2) {
      return {
        product: pair[0].toLowerCase(),
        tool: pair[1].toLowerCase(),
        raw: trimmed
      };
    }

    return {
      product: 'unknown',
      tool: trimmed,
      raw: trimmed
    };
  }

  const product = String(raw.product || raw.namespace || raw.module || '').toLowerCase();
  const tool = String(raw.tool || raw.name || raw.command || raw.id || '').toLowerCase();

  if (!tool) {
    return null;
  }

  return {
    product: product || 'unknown',
    tool,
    description: raw.description || '',
    params: raw.params || raw.parameters || raw.schema || null,
    raw
  };
}

class SchemaDiscoverer {
  constructor(options) {
    this.executor = options.executor;
    this.logger = options.logger;
    this.auditLogger = options.auditLogger;
    this.cachePath = options.cachePath;
    this.cacheTtlMs = options.cacheTtlMs;
  }

  loadCache() {
    try {
      if (!fs.existsSync(this.cachePath)) {
        return null;
      }

      const parsed = safeJsonParse(fs.readFileSync(this.cachePath, 'utf8'), null);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      return parsed;
    } catch (error) {
      this.logger.warn('failed to load schema cache', { error: error.message });
      return null;
    }
  }

  saveCache(data) {
    ensureDirSync(path.dirname(this.cachePath));
    fs.writeFileSync(this.cachePath, JSON.stringify(data, null, 2), 'utf8');
  }

  isCacheFresh(cache) {
    if (!cache || !cache.updatedAt) {
      return false;
    }

    const ageMs = Date.now() - new Date(cache.updatedAt).getTime();
    if (!Number.isFinite(ageMs) || ageMs < 0) {
      return false;
    }

    return ageMs <= this.cacheTtlMs;
  }

  normalizeSchemaPayload(payload) {
    let tools = [];

    if (Array.isArray(payload)) {
      tools = payload;
    } else if (payload && Array.isArray(payload.tools)) {
      tools = payload.tools;
    } else if (payload && Array.isArray(payload.data)) {
      tools = payload.data;
    } else if (payload && Array.isArray(payload.products)) {
      for (const productRow of payload.products) {
        const productId = String(productRow.id || productRow.product || '').toLowerCase();
        const entries = Array.isArray(productRow.tools) ? productRow.tools : [];
        for (const row of entries) {
          tools.push({ product: productId, ...(typeof row === 'object' ? row : { tool: String(row) }) });
        }
      }
    } else if (payload && payload.products && typeof payload.products === 'object') {
      for (const [product, entries] of Object.entries(payload.products)) {
        const rows = Array.isArray(entries) ? entries : [];
        for (const row of rows) {
          tools.push({ product, ...(typeof row === 'object' ? row : { tool: String(row) }) });
        }
      }
    }

    const normalizedTools = tools
      .map((item) => normalizeToolRecord(item))
      .filter(Boolean);

    const byProduct = {};
    for (const item of normalizedTools) {
      if (!byProduct[item.product]) {
        byProduct[item.product] = [];
      }
      byProduct[item.product].push(item);
    }

    return {
      tools: normalizedTools,
      products: byProduct
    };
  }

  parseTextSchema(rawText) {
    const lines = String(rawText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const records = [];
    for (const line of lines) {
      if (line.startsWith('#') || line.startsWith('-')) {
        continue;
      }

      const plain = line.replace(/^\*+/, '').trim();
      const dotMatch = plain.match(/^([a-z0-9_-]+)[.\s:]+([a-z0-9_-]+)/i);
      if (dotMatch) {
        records.push({
          product: dotMatch[1].toLowerCase(),
          tool: dotMatch[2].toLowerCase(),
          raw: plain
        });
      }
    }

    const byProduct = {};
    for (const record of records) {
      if (!byProduct[record.product]) {
        byProduct[record.product] = [];
      }
      byProduct[record.product].push(record);
    }

    return {
      tools: records,
      products: byProduct
    };
  }

  async fetchSchemaList(requestId) {
    const attempts = [
      ['schema', '--format', 'json'],
      ['schema']
    ];

    let lastFailure = null;

    for (const args of attempts) {
      const result = await this.executor.runCommand(args, { requestId });
      if (result.code !== 0) {
        lastFailure = result;
        continue;
      }

      const jsonTry = toJsonIfPossible(result.stdout);
      if (jsonTry.ok) {
        const normalized = this.normalizeSchemaPayload(jsonTry.value);
        if (normalized.tools.length > 0) {
          return {
            ok: true,
            data: normalized,
            sourceCommand: args.join(' '),
            raw: result.stdout
          };
        }
      }

      const textNormalized = this.parseTextSchema(result.stdout);
      if (textNormalized.tools.length > 0) {
        return {
          ok: true,
          data: textNormalized,
          sourceCommand: args.join(' '),
          raw: result.stdout
        };
      }

      lastFailure = {
        ...result,
        stderr: result.stderr || 'schema output could not be parsed'
      };
    }

    return {
      ok: false,
      error: lastFailure || { stderr: 'schema list command failed' }
    };
  }

  async listSchema(options = {}) {
    const requestId = options.requestId || null;
    const forceRefresh = options.forceRefresh === true;
    const cache = this.loadCache();

    if (!forceRefresh && this.isCacheFresh(cache)) {
      return {
        status: 'success',
        result: {
          source: 'cache',
          updated_at: cache.updatedAt,
          schema: cache.schema,
          degraded: false
        }
      };
    }

    const fetched = await this.fetchSchemaList(requestId);
    if (fetched.ok) {
      const nextCache = {
        updatedAt: nowIso(),
        sourceCommand: fetched.sourceCommand,
        schema: fetched.data
      };
      this.saveCache(nextCache);

      return {
        status: 'success',
        result: {
          source: 'origin',
          updated_at: nextCache.updatedAt,
          schema: nextCache.schema,
          degraded: false
        }
      };
    }

    if (cache && cache.schema) {
      return {
        status: 'success',
        result: {
          source: 'stale-cache',
          updated_at: cache.updatedAt,
          schema: cache.schema,
          degraded: true,
          warning: 'schema refresh failed and stale cache was returned'
        }
      };
    }

    return {
      status: 'error',
      error: {
        message: 'schema discovery failed',
        details: fetched.error
      }
    };
  }

  findToolInSchema(schema, product, tool) {
    const list = schema && schema.products && schema.products[product]
      ? schema.products[product]
      : [];

    const normalizedTool = String(tool || '').toLowerCase().replace(/[.\s/:-]+/g, '_');
    return (
      list.find((item) => String(item.tool || '').toLowerCase() === tool) ||
      list.find((item) => String(item.tool || '').toLowerCase().replace(/[.\s/:-]+/g, '_') === normalizedTool) ||
      null
    );
  }

  async fetchSchemaTool(product, tool, requestId) {
    const variants = Array.from(new Set([
      `${product}.${tool}`,
      `${product}.${tool.replace(/\s+/g, '_')}`,
      `${product}.${tool.replace(/\s+/g, '-')}`,
      `${product}.${tool.replace(/\s+/g, '.')}`
    ]));

    const attempts = [
      ...variants.map((value) => ['schema', value, '--format', 'json']),
      ...variants.map((value) => ['schema', value])
    ];

    for (const args of attempts) {
      const result = await this.executor.runCommand(args, { requestId });
      if (result.code !== 0) {
        continue;
      }

      const parsed = toJsonIfPossible(result.stdout);
      if (parsed.ok) {
        return {
          ok: true,
          data: parsed.value,
          sourceCommand: args.join(' ')
        };
      }

      if (result.stdout && result.stdout.trim()) {
        return {
          ok: true,
          data: {
            raw: result.stdout
          },
          sourceCommand: args.join(' ')
        };
      }
    }

    return { ok: false };
  }

  async getSchemaTool(product, tool, options = {}) {
    const requestId = options.requestId || null;
    const listResult = await this.listSchema({ requestId, forceRefresh: options.forceRefresh });
    if (listResult.status !== 'success') {
      return listResult;
    }

    const schema = listResult.result.schema;
    const fromRegistry = this.findToolInSchema(schema, product, tool);
    if (fromRegistry) {
      return {
        status: 'success',
        result: {
          source: listResult.result.source,
          product,
          tool,
          schema: fromRegistry
        }
      };
    }

    const fallback = await this.fetchSchemaTool(product, tool, requestId);
    if (fallback.ok) {
      return {
        status: 'success',
        result: {
          source: 'origin-tool',
          product,
          tool,
          schema: fallback.data,
          source_command: fallback.sourceCommand
        }
      };
    }

    return {
      status: 'error',
      error: {
        message: `schema for ${product}.${tool} not found`,
        details: {
          product,
          tool
        }
      }
    };
  }
}

module.exports = {
  SchemaDiscoverer
};

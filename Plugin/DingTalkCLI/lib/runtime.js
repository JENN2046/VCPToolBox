'use strict';

const path = require('path');
const { readRuntimeConfig } = require('./env');
const { createLogger } = require('./logger');
const { AuditLogger } = require('./audit-logger');
const { DingTalkExecutor } = require('./dingtalk-executor');
const { SchemaDiscoverer } = require('./schema-discoverer');
const { SecurityHandler, normalizeProduct, normalizeTool, isWriteOperation } = require('./security-handler');
const { validateArgsAgainstSchema } = require('./arg-validator');
const { buildToolCommandArgs } = require('./cli-args');
const { CommandMap } = require('./command-map');
const { WorkflowEngine } = require('../workflows/workflow-engine');
const {
  fromCommandResult,
  fromException,
  fromParse,
  fromSecurity,
  fromValidation
} = require('./error-handler');
const { randomId, toJsonIfPossible, summarizeArgs } = require('./helpers');
const { SUPPORTED_PRODUCTS } = require('./constants');

class DingTalkCLIRuntime {
  constructor(options = {}) {
    const basePath = options.basePath || path.join(__dirname, '..');
    this.config = options.config || readRuntimeConfig(basePath);
    this.logger = options.logger || createLogger(this.config.debug);
    this.auditLogger = options.auditLogger || new AuditLogger({
      logPath: this.config.auditLogPath,
      logger: this.logger
    });

    this.executor = options.executor || new DingTalkExecutor({
      dwsBin: this.config.dwsBin,
      dwsMinVersion: this.config.dwsMinVersion,
      timeoutMs: this.config.timeoutMs,
      logger: this.logger,
      auditLogger: this.auditLogger,
      cwd: this.config.projectBasePath,
      env: process.env,
      binArgs: options.binArgs || []
    });

    this.schemaDiscoverer = options.schemaDiscoverer || new SchemaDiscoverer({
      executor: this.executor,
      logger: this.logger,
      auditLogger: this.auditLogger,
      cachePath: this.config.cachePath,
      cacheTtlMs: this.config.schemaCacheTtlMs
    });

    this.securityHandler = options.securityHandler || new SecurityHandler({
      trustedDomains: this.config.trustedDomains,
      maxArgBytes: this.config.maxArgBytes,
      batchLimit: this.config.batchLimit,
      grayStage: this.config.grayStage
    });
    this.commandMap = options.commandMap || new CommandMap({
      path: this.config.toolMapPath,
      logger: this.logger
    });

    this.workflowEngine = options.workflowEngine || new WorkflowEngine({
      executeTool: (request, context) => this.executeTool(request, context),
      stateDir: this.config.workflowStateDir,
      auditLogger: this.auditLogger,
      logger: this.logger
    });
  }

  buildRequestContext(request) {
    const requestId = request && request.request_id ? String(request.request_id) : randomId('dws');
    return {
      requestId
    };
  }

  toErrorResponse(errorPayload) {
    return {
      status: 'error',
      error: {
        category: errorPayload.category,
        reason: errorPayload.reason,
        hint: errorPayload.hint,
        actions: errorPayload.actions,
        details: errorPayload.details || null
      }
    };
  }

  async healthCheck(context) {
    const health = await this.executor.checkHealth();
    const auth = await this.authStatus(context, true);
    const proxyDiagnostics = this.buildProxyDiagnostics();

    const ok = health.ok === true;
    return {
      status: ok ? 'success' : 'error',
      ...(ok
        ? {
            result: {
              dws_ok: true,
              version: health.version,
              min_version: health.requiredVersion,
              auth: auth.status === 'success' ? auth.result : auth.error,
              proxy: proxyDiagnostics,
              supported_products: Array.from(SUPPORTED_PRODUCTS),
              workflows: this.workflowEngine.listWorkflows(),
              defaults: {
                dry_run: true,
                format: 'json'
              },
              gray_stage: this.config.grayStage
            }
          }
        : {
            error: fromValidation(health.reason || 'dws health check failed', 'install dws and verify DWS_BIN')
          })
    };
  }

  buildProxyDiagnostics() {
    const proxyEnv = {
      HTTP_PROXY: process.env.HTTP_PROXY || '',
      HTTPS_PROXY: process.env.HTTPS_PROXY || '',
      ALL_PROXY: process.env.ALL_PROXY || ''
    };

    const blockedTargets = Object.values(proxyEnv)
      .filter(Boolean)
      .some((value) => /127\.0\.0\.1:9|localhost:9/i.test(String(value)));

    return {
      ...proxyEnv,
      warning: blockedTargets ? 'proxy points to localhost:9; dws auth may fail to fetch client id' : null
    };
  }

  parseAuthState(raw) {
    const parsed = toJsonIfPossible(raw);
    if (parsed.ok) {
      const value = parsed.value;
      const authenticated = Boolean(
        value.authenticated === true ||
          value.logged_in === true ||
          String(value.status || '').toLowerCase() === 'authenticated'
      );

      const expiresAt = value.expires_at || value.expiresAt || value.token_expiry || null;
      let tokenValid = null;
      if (expiresAt) {
        const expiryTime = new Date(expiresAt).getTime();
        tokenValid = Number.isFinite(expiryTime) ? expiryTime > Date.now() : null;
      }

      return {
        authenticated,
        token_valid: tokenValid,
        expires_at: expiresAt,
        output: value
      };
    }

    const text = String(raw || '').toLowerCase();
    const authenticated = text.includes('authenticated') || text.includes('logged in');

    return {
      authenticated,
      token_valid: null,
      expires_at: null,
      output: parsed.value
    };
  }

  async authStatus(context, inline = false) {
    const attempts = [
      ['auth', 'status', '--format', 'json'],
      ['auth', 'status']
    ];

    let lastResult = null;
    for (const args of attempts) {
      const result = await this.executor.runCommand(args, { requestId: context.requestId });
      lastResult = result;
      if (result.code === 0) {
        const authInfo = this.parseAuthState(result.stdout || result.stderr || '');

        return {
          status: 'success',
          result: {
            auth_mode: this.config.authMode,
            authenticated: authInfo.authenticated,
            token_valid: authInfo.token_valid,
            expires_at: authInfo.expires_at,
            output: authInfo.output
          }
        };
      }
    }

    const mapped = fromCommandResult(lastResult || {});
    if (inline) {
      return { status: 'error', error: mapped };
    }
    return this.toErrorResponse(mapped);
  }

  async authLogin(request, context) {
    const mode = String(request.mode || this.config.authMode || 'auto').trim().toLowerCase();
    if (!['auto', 'org', 'custom_app'].includes(mode)) {
      return this.toErrorResponse(fromValidation(`unsupported auth mode: ${mode}`, 'mode must be auto/org/custom_app'));
    }

    if (mode === 'custom_app') {
      if (!this.config.dwsClientId || !this.config.dwsClientSecret) {
        return this.toErrorResponse(
          fromValidation(
            'custom_app auth requires DWS_CLIENT_ID and DWS_CLIENT_SECRET',
            'set credentials in plugin config.env'
          )
        );
      }

      process.env.DWS_CLIENT_ID = this.config.dwsClientId;
      process.env.DWS_CLIENT_SECRET = this.config.dwsClientSecret;
    }

    const commandArgs = ['auth', 'login'];
    if (request.yes === true) {
      commandArgs.push('--yes');
    }
    if (request.force === true) {
      commandArgs.push('--force');
    }
    if (mode === 'custom_app') {
      commandArgs.push('--client-id', this.config.dwsClientId, '--client-secret', this.config.dwsClientSecret);
    }

    const result = await this.executor.runCommand(commandArgs, { requestId: context.requestId });
    if (result.code !== 0) {
      return this.toErrorResponse(fromCommandResult(result));
    }

    const status = await this.authStatus(context, true);
    if (status.status !== 'success') {
      return this.toErrorResponse(status.error);
    }

    return {
      status: 'success',
      result: {
        message: 'auth login completed',
        mode,
        auth: status.result
      }
    };
  }

  async schemaList(request, context) {
    const result = await this.schemaDiscoverer.listSchema({
      requestId: context.requestId,
      forceRefresh: request.force_refresh === true
    });

    if (result.status !== 'success') {
      return this.toErrorResponse(fromException(new Error(result.error.message || 'schema list failed'), 'upstream'));
    }

    return result;
  }

  async schemaTool(request, context) {
    const product = normalizeProduct(request.product);
    const tool = normalizeTool(request.tool);

    if (!product || !tool) {
      return this.toErrorResponse(fromValidation('product and tool are required', 'set both product and tool'));
    }

    const result = await this.schemaDiscoverer.getSchemaTool(product, tool, {
      requestId: context.requestId,
      forceRefresh: request.force_refresh === true
    });

    if (result.status !== 'success') {
      return this.toErrorResponse(fromValidation(`schema for ${product}.${tool} not found`, 'run schema_list first'));
    }

    return result;
  }

  async runCommandWithFallback(normalized, context) {
    const primaryFormat = normalized.format === 'raw' ? 'raw' : 'json';
    const baseArgs = buildToolCommandArgs({ ...normalized, outputFormat: primaryFormat });
    let result = await this.executor.runCommand(baseArgs, { requestId: context.requestId });
    if (
      result.code !== 0 &&
      primaryFormat === 'json' &&
      result.stderr &&
      /unknown\s+option|unknown\s+flag|invalid\s+option/i.test(result.stderr)
    ) {
      const fallbackArgs = buildToolCommandArgs({ ...normalized, outputFormat: null });
      result = await this.executor.runCommand(fallbackArgs, { requestId: context.requestId });
    }

    return result;
  }

  async executeTool(request, context) {
    const security = this.securityHandler.validateExecuteInput(request);
    if (!security.ok) {
      return this.toErrorResponse(fromSecurity(security.reason, security.hint));
    }

    const normalized = security.value;

    const mapping = this.commandMap.resolve(normalized.product, normalized.toolTokens);
    const resolvedToolTokens = mapping.resolved;
    const resolvedTool = resolvedToolTokens.join(' ');
    const normalizedForExecution = {
      ...normalized,
      tool: resolvedTool,
      toolTokens: resolvedToolTokens
    };

    const releaseGate = this.securityHandler.validateReleaseGate({
      product: normalized.product,
      tool: resolvedTool,
      write: normalized.write === true || isWriteOperation(resolvedTool)
    });
    if (!releaseGate.ok) {
      return this.toErrorResponse(fromSecurity(releaseGate.reason, releaseGate.hint));
    }

    const schemaResult = await this.schemaDiscoverer.getSchemaTool(normalized.product, resolvedTool, {
      requestId: context.requestId,
      forceRefresh: false
    });

    let schemaValidation = { ok: true };
    if (schemaResult.status === 'success') {
      schemaValidation = validateArgsAgainstSchema(normalized.args, schemaResult.result.schema || null);
      if (!schemaValidation.ok) {
        return this.toErrorResponse(fromValidation(schemaValidation.reason, schemaValidation.hint));
      }
    }

    const commandResult = await this.runCommandWithFallback(normalizedForExecution, context);
    if (commandResult.code !== 0) {
      return this.toErrorResponse(fromCommandResult(commandResult));
    }

    let output;
    if (normalized.format === 'raw') {
      output = commandResult.stdout;
    } else {
      const parsed = toJsonIfPossible(commandResult.stdout);
      if (!parsed.ok) {
        return this.toErrorResponse(fromParse('failed to parse dws output as json', commandResult.stdout));
      }
      output = parsed.value;
    }

    this.auditLogger.write({
      requestId: context.requestId,
      phase: 'execute_tool',
      operator: process.env.VCP_AGENT_ALIAS || process.env.VCP_AGENT_ID || 'unknown',
      product: normalized.product,
      tool: resolvedTool,
      args_summary: summarizeArgs(normalized.args),
      apply: normalized.apply,
      dry_run: normalized.dryRun,
      yes: normalized.yes,
      category: 'success',
      duration_ms: commandResult.durationMs,
      code: commandResult.code
    });

    return {
      status: 'success',
      result: {
        product: normalized.product,
        tool: resolvedTool,
        command_mapping: mapping.mapped
          ? {
              from: mapping.from,
              to: mapping.to
            }
          : null,
        apply: normalized.apply,
        dry_run: normalized.dryRun,
        yes: normalized.yes,
        format: normalized.format,
        schema_validation_warning: schemaValidation.warning || null,
        output,
        metrics: {
          duration_ms: commandResult.durationMs,
          exit_code: commandResult.code
        }
      }
    };
  }

  async runWorkflow(request, context) {
    const result = await this.workflowEngine.runWorkflow(request, context);
    if (result.status !== 'success' && result.error) {
      return this.toErrorResponse(result.error);
    }
    return result;
  }

  async handleRequest(request) {
    const context = this.buildRequestContext(request || {});
    const action = String((request && request.action) || '').trim();

    this.logger.debug('incoming request', {
      requestId: context.requestId,
      action
    });

    this.auditLogger.write({
      requestId: context.requestId,
      phase: 'request',
      action,
      operator: process.env.VCP_AGENT_ALIAS || process.env.VCP_AGENT_ID || 'unknown'
    });

    try {
      switch (action) {
        case 'health_check':
          return await this.healthCheck(context);
        case 'auth_status':
          return await this.authStatus(context, false);
        case 'auth_login':
          return await this.authLogin(request || {}, context);
        case 'schema_list':
          return await this.schemaList(request || {}, context);
        case 'schema_tool':
          return await this.schemaTool(request || {}, context);
        case 'execute_tool':
          return await this.executeTool(request || {}, context);
        case 'run_workflow':
          return await this.runWorkflow(request || {}, context);
        default:
          return this.toErrorResponse(
            fromValidation(
              `unknown action: ${action}`,
              'supported actions: health_check, auth_status, auth_login, schema_list, schema_tool, execute_tool, run_workflow'
            )
          );
      }
    } catch (error) {
      return this.toErrorResponse(fromException(error));
    }
  }
}

module.exports = {
  DingTalkCLIRuntime
};

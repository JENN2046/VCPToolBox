const { spawn } = require('child_process');

const DEFAULT_DWS_BIN = 'dws';
const DEFAULT_DWS_TIMEOUT_MS = 15000;
const DINGTALK_BASE_URL = 'https://alidocs.dingtalk.com/i/nodes';

class DingTalkAITablePublishAdapter {
  constructor() {
    this._config = {};
  }

  configure(nextConfig = {}) {
    this._config = {
      ...nextConfig
    };

    return this;
  }

  async publishRecord(record, options = {}) {
    const executionMode = this._resolveExecutionMode(options.execution_mode);
    const config = this._resolveConfig();

    if (config.invalid_fields.length > 0) {
      return {
        ok: false,
        attempted: false,
        no_op: true,
        activation_status: 'invalid_live_config',
        adapter: 'dingtalk_ai_table',
        execution_mode: executionMode,
        target_type: record.target_type || null,
        target_name: record.target_name || null,
        invalid_fields: config.invalid_fields,
        reason: 'DingTalk AI table live publish config is invalid.'
      };
    }

    if (config.missing_fields.length > 0) {
      return {
        ok: false,
        attempted: false,
        no_op: true,
        activation_status: 'missing_live_config',
        adapter: 'dingtalk_ai_table',
        execution_mode: executionMode,
        target_type: record.target_type || null,
        target_name: record.target_name || null,
        missing_fields: config.missing_fields,
        reason: 'DingTalk AI table live publish is not configured.'
      };
    }

    const cellsResult = this._buildCells(record, config.fieldMap);
    if (cellsResult.error) {
      return {
        ok: false,
        attempted: false,
        no_op: true,
        activation_status: 'invalid_live_config',
        adapter: 'dingtalk_ai_table',
        execution_mode: executionMode,
        target_type: record.target_type || null,
        target_name: record.target_name || null,
        invalid_fields: ['DingTalkFieldMap'],
        reason: cellsResult.error
      };
    }

    const preview = this._buildPreview(record, config, cellsResult.cells);
    const authResult = await this._checkAuth(config);

    if (!authResult.ok) {
      return {
        ok: false,
        attempted: false,
        no_op: true,
        activation_status: authResult.activation_status,
        adapter: 'dingtalk_ai_table',
        execution_mode: executionMode,
        target_type: record.target_type || null,
        target_name: record.target_name || null,
        reason: authResult.reason,
        request_preview: preview
      };
    }

    if (executionMode === 'dry_run') {
      return {
        ok: true,
        attempted: false,
        no_op: false,
        activation_status: 'dry_run_preview',
        adapter: 'dingtalk_ai_table',
        execution_mode: executionMode,
        target_type: record.target_type || null,
        target_name: record.target_name || null,
        request_preview: preview,
        auth_preview: authResult.payload
      };
    }

    const publishResult = await this._runCommand(config, preview.command_preview.args);
    if (!publishResult.ok) {
      return {
        ok: false,
        attempted: true,
        no_op: false,
        activation_status: 'live_publish_failed',
        adapter: 'dingtalk_ai_table',
        execution_mode: executionMode,
        target_type: record.target_type || null,
        target_name: record.target_name || null,
        error_message: publishResult.error_message,
        request_preview: preview,
        response_preview: publishResult.payload || null
      };
    }

    return {
      ok: true,
      attempted: true,
      no_op: false,
      activation_status: 'live_published',
      adapter: 'dingtalk_ai_table',
      execution_mode: executionMode,
      target_type: record.target_type || null,
      target_name: record.target_name || null,
      receipt_id: this._extractReceiptId(publishResult.payload),
      external_reference_url: preview.external_reference_url,
      request_preview: preview,
      response_preview: publishResult.payload || null
    };
  }

  _resolveExecutionMode(value) {
    return value === 'live' ? 'live' : 'dry_run';
  }

  _resolveConfig() {
    const dwsBin = String(this._config.DwsBin || DEFAULT_DWS_BIN).trim() || DEFAULT_DWS_BIN;
    const baseId = String(this._config.DingTalkBaseId || '').trim();
    const tableId = String(this._config.DingTalkTableId || '').trim();
    const timeoutMs = this._resolveTimeout(this._config.DwsTimeoutMs);
    const fieldMapResult = this._parseFieldMap(this._config.DingTalkFieldMap);

    const missing_fields = [];
    if (!baseId) {
      missing_fields.push('DingTalkBaseId');
    }
    if (!tableId) {
      missing_fields.push('DingTalkTableId');
    }
    if (!this._config.DingTalkFieldMap) {
      missing_fields.push('DingTalkFieldMap');
    }

    return {
      dwsBin,
      baseId,
      tableId,
      timeoutMs,
      fieldMap: fieldMapResult.value,
      missing_fields,
      invalid_fields: fieldMapResult.error ? ['DingTalkFieldMap'] : []
    };
  }

  _resolveTimeout(value) {
    if (value === null || value === undefined || value === '') {
      return DEFAULT_DWS_TIMEOUT_MS;
    }

    const parsed = Number(String(value).trim());
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return DEFAULT_DWS_TIMEOUT_MS;
    }

    return parsed;
  }

  _parseFieldMap(rawValue) {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return { value: null, error: null };
    }

    if (typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      return { value: rawValue, error: null };
    }

    try {
      const parsed = JSON.parse(String(rawValue));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { value: null, error: 'DingTalkFieldMap must be a JSON object.' };
      }

      return { value: parsed, error: null };
    } catch (error) {
      return { value: null, error: 'DingTalkFieldMap must be valid JSON.' };
    }
  }

  _buildCells(record, fieldMap) {
    if (!fieldMap || typeof fieldMap !== 'object') {
      return { cells: null, error: 'DingTalkFieldMap is required.' };
    }

    const cells = {};
    for (const [fieldId, descriptor] of Object.entries(fieldMap)) {
      const normalizedFieldId = String(fieldId || '').trim();
      if (!normalizedFieldId) {
        continue;
      }

      const resolved = this._resolveMappedValue(descriptor, record);
      const normalized = this._normalizeCellValue(resolved);
      if (normalized !== undefined) {
        cells[normalizedFieldId] = normalized;
      }
    }

    if (Object.keys(cells).length === 0) {
      return { cells: null, error: 'DingTalkFieldMap did not resolve any writable cells.' };
    }

    return { cells, error: null };
  }

  _resolveMappedValue(descriptor, record) {
    if (typeof descriptor === 'string') {
      return this._getPathValue(record, descriptor);
    }

    if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
      return undefined;
    }

    if (Object.prototype.hasOwnProperty.call(descriptor, 'path')) {
      return this._getPathValue(record, descriptor.path);
    }

    if (Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      return descriptor.value;
    }

    return undefined;
  }

  _getPathValue(target, pathValue) {
    const segments = String(pathValue || '')
      .split('.')
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length === 0) {
      return undefined;
    }

    let current = target;
    for (const segment of segments) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = current[segment];
    }

    return current;
  }

  _normalizeCellValue(value) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
      return JSON.stringify(value);
    }

    return value;
  }

  _buildPreview(record, config, cells) {
    const args = [
      'aitable',
      'record',
      'create',
      '--base-id',
      config.baseId,
      '--table-id',
      config.tableId,
      '--records',
      JSON.stringify([{ cells }]),
      '--format',
      'json'
    ];

    return {
      provider: 'dingtalk_ai_table',
      mode: 'dws_aitable_record_create',
      target_type: record.target_type || null,
      target_name: record.target_name || null,
      base_id: config.baseId,
      table_id: config.tableId,
      field_ids: Object.keys(cells),
      records_preview: [{ cells }],
      external_reference_url: `${DINGTALK_BASE_URL}/${config.baseId}`,
      command_preview: {
        command: config.dwsBin,
        args
      }
    };
  }

  async _checkAuth(config) {
    const authArgs = ['auth', 'status', '--format', 'json'];
    const authResult = await this._runCommand(config, authArgs);

    if (!authResult.ok) {
      if (authResult.error_code === 'ENOENT') {
        return {
          ok: false,
          activation_status: 'missing_runtime_dependency',
          reason: `Unable to find dws binary "${config.dwsBin}".`,
          payload: authResult.payload || null
        };
      }

      return {
        ok: false,
        activation_status: 'authentication_required',
        reason: authResult.error_message || 'Unable to verify DingTalk workspace authentication.',
        payload: authResult.payload || null
      };
    }

    const payload = authResult.payload || {};
    if (payload.authenticated !== true || payload.token_valid !== true) {
      return {
        ok: false,
        activation_status: 'authentication_required',
        reason: 'dws is not authenticated for DingTalk AI table publishing.',
        payload
      };
    }

    return {
      ok: true,
      activation_status: 'ready',
      payload
    };
  }

  async _runCommand(config, args) {
    const runner = this._resolveCommandRunner();

    try {
      const result = await runner(config.dwsBin, args, {
        timeout_ms: config.timeoutMs
      });

      if (result && result.ok === false) {
        return {
          ok: false,
          error_code: result.error_code || null,
          error_message: result.error_message || 'dws command failed.',
          payload: result.payload || null
        };
      }

      return {
        ok: true,
        payload: result && Object.prototype.hasOwnProperty.call(result, 'payload')
          ? result.payload
          : result
      };
    } catch (error) {
      return {
        ok: false,
        error_code: error && error.code ? error.code : null,
        error_message: error instanceof Error ? error.message : String(error),
        payload: null
      };
    }
  }

  _resolveCommandRunner() {
    if (typeof this._config.DingTalkCommandRunner === 'function') {
      return this._config.DingTalkCommandRunner;
    }

    return async (command, args, options = {}) => new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        shell: false,
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, options.timeout_ms || DEFAULT_DWS_TIMEOUT_MS);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      child.on('close', (code) => {
        clearTimeout(timeout);

        if (timedOut) {
          reject(new Error(`dws command timed out after ${options.timeout_ms || DEFAULT_DWS_TIMEOUT_MS}ms.`));
          return;
        }

        const trimmedStdout = String(stdout || '').trim();
        let payload = null;

        if (trimmedStdout) {
          try {
            payload = JSON.parse(trimmedStdout);
          } catch (error) {
            resolve({
              ok: false,
              error_message: 'dws returned non-JSON output.',
              payload: {
                stdout: trimmedStdout,
                stderr: String(stderr || '').trim()
              }
            });
            return;
          }
        }

        if (code !== 0) {
          resolve({
            ok: false,
            error_message: String(stderr || '').trim() || `dws exited with code ${code}.`,
            payload
          });
          return;
        }

        resolve({
          ok: true,
          payload
        });
      });
    });
  }

  _extractReceiptId(payload) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    if (typeof payload.recordId === 'string' && payload.recordId.trim()) {
      return payload.recordId.trim();
    }

    if (typeof payload.id === 'string' && payload.id.trim()) {
      return payload.id.trim();
    }

    const candidates = [
      payload.data,
      payload.result,
      payload.data && Array.isArray(payload.data.records) ? payload.data.records[0] : null,
      payload.result && Array.isArray(payload.result.records) ? payload.result.records[0] : null,
      Array.isArray(payload.records) ? payload.records[0] : null,
      payload.record
    ];

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') {
        continue;
      }

      if (typeof candidate.recordId === 'string' && candidate.recordId.trim()) {
        return candidate.recordId.trim();
      }

      if (typeof candidate.id === 'string' && candidate.id.trim()) {
        return candidate.id.trim();
      }
    }

    return null;
  }
}

module.exports = new DingTalkAITablePublishAdapter();

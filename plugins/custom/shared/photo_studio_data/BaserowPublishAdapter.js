class BaserowPublishAdapter {
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
        adapter: 'baserow',
        execution_mode: executionMode,
        target_type: record.target_type || null,
        target_name: record.target_name || null,
        target_provider: record.target_provider || null,
        invalid_fields: config.invalid_fields,
        reason: 'Baserow live publish config is invalid.'
      };
    }

    if (config.missing_fields.length > 0) {
      return {
        ok: false,
        attempted: false,
        no_op: true,
        activation_status: 'missing_live_config',
        adapter: 'baserow',
        execution_mode: executionMode,
        target_type: record.target_type || null,
        target_name: record.target_name || null,
        target_provider: record.target_provider || null,
        missing_fields: config.missing_fields,
        reason: 'Baserow live publish is not configured.'
      };
    }

    const rowResult = this._buildRow(record, config.fieldMap);
    if (rowResult.error) {
      return {
        ok: false,
        attempted: false,
        no_op: true,
        activation_status: 'invalid_live_config',
        adapter: 'baserow',
        execution_mode: executionMode,
        target_type: record.target_type || null,
        target_name: record.target_name || null,
        target_provider: record.target_provider || null,
        invalid_fields: ['BaserowFieldMap'],
        reason: rowResult.error
      };
    }

    const preview = this._buildPreview(record, config, rowResult.row);
    if (executionMode === 'dry_run') {
      return {
        ok: true,
        attempted: false,
        no_op: false,
        activation_status: 'dry_run_preview',
        adapter: 'baserow',
        execution_mode: executionMode,
        target_type: record.target_type || null,
        target_name: record.target_name || null,
        target_provider: record.target_provider || null,
        request_preview: preview
      };
    }

    const fetchImpl = this._resolveFetchImpl();
    if (!fetchImpl) {
      return {
        ok: false,
        attempted: false,
        no_op: true,
        activation_status: 'missing_http_client',
        adapter: 'baserow',
        execution_mode: executionMode,
        target_type: record.target_type || null,
        target_name: record.target_name || null,
        target_provider: record.target_provider || null,
        reason: 'No HTTP client is available for Baserow publishing.',
        request_preview: preview
      };
    }

    try {
      const response = await fetchImpl(preview.endpoint_url, {
        method: 'POST',
        headers: {
          Authorization: `Token ${config.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(rowResult.row)
      });

      const responsePayload = await this._readJsonSafely(response);
      if (!response.ok) {
        return {
          ok: false,
          attempted: true,
          no_op: false,
          activation_status: 'live_publish_failed',
          adapter: 'baserow',
          execution_mode: executionMode,
          target_type: record.target_type || null,
          target_name: record.target_name || null,
          target_provider: record.target_provider || null,
          status_code: response.status,
          error_message: this._extractErrorMessage(responsePayload, `Baserow publish failed with status ${response.status}.`),
          request_preview: preview,
          response_preview: responsePayload || null
        };
      }

      const receiptId = this._extractReceiptId(responsePayload);
      return {
        ok: true,
        attempted: true,
        no_op: false,
        activation_status: 'live_published',
        adapter: 'baserow',
        execution_mode: executionMode,
        target_type: record.target_type || null,
        target_name: record.target_name || null,
        target_provider: record.target_provider || null,
        receipt_id: receiptId,
        external_reference_url: this._buildRowReferenceUrl(config, receiptId),
        request_preview: preview,
        response_preview: responsePayload || null
      };
    } catch (error) {
      return {
        ok: false,
        attempted: true,
        no_op: false,
        activation_status: 'live_publish_failed',
        adapter: 'baserow',
        execution_mode: executionMode,
        target_type: record.target_type || null,
        target_name: record.target_name || null,
        target_provider: record.target_provider || null,
        error_message: error instanceof Error ? error.message : String(error),
        request_preview: preview
      };
    }
  }

  _resolveExecutionMode(value) {
    return value === 'live' ? 'live' : 'dry_run';
  }

  _resolveConfig() {
    const apiUrl = this._normalizeApiUrl(this._config.BaserowApiUrl);
    const apiToken = String(this._config.BaserowApiToken || '').trim();
    const tableId = String(this._config.BaserowTableId || '').trim();
    const fieldMapResult = this._parseFieldMap(this._config.BaserowFieldMap);

    const missing_fields = [];
    if (!apiUrl) {
      missing_fields.push('BaserowApiUrl');
    }
    if (!apiToken) {
      missing_fields.push('BaserowApiToken');
    }
    if (!tableId) {
      missing_fields.push('BaserowTableId');
    }
    if (!this._config.BaserowFieldMap) {
      missing_fields.push('BaserowFieldMap');
    }

    return {
      apiUrl,
      apiToken,
      tableId,
      fieldMap: fieldMapResult.value,
      missing_fields,
      invalid_fields: fieldMapResult.error ? ['BaserowFieldMap'] : []
    };
  }

  _normalizeApiUrl(value) {
    const normalized = String(value || '').trim().replace(/\/+$/, '');
    return normalized || '';
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
        return { value: null, error: 'BaserowFieldMap must be a JSON object.' };
      }

      return { value: parsed, error: null };
    } catch (error) {
      return { value: null, error: 'BaserowFieldMap must be valid JSON.' };
    }
  }

  _buildRow(record, fieldMap) {
    if (!fieldMap || typeof fieldMap !== 'object') {
      return { row: null, error: 'BaserowFieldMap is required.' };
    }

    const row = {};
    for (const [fieldName, descriptor] of Object.entries(fieldMap)) {
      const normalizedFieldName = String(fieldName || '').trim();
      if (!normalizedFieldName) {
        continue;
      }

      const resolved = this._resolveMappedValue(descriptor, record);
      if (resolved !== undefined) {
        row[normalizedFieldName] = resolved;
      }
    }

    if (Object.keys(row).length === 0) {
      return { row: null, error: 'BaserowFieldMap did not resolve any writable fields.' };
    }

    return { row, error: null };
  }

  _resolveMappedValue(descriptor, record) {
    if (typeof descriptor === 'string') {
      const resolvedPathValue = this._getPathValue(record, descriptor);
      if (resolvedPathValue !== undefined) {
        return resolvedPathValue;
      }

      return descriptor;
    }

    if (
      descriptor === null
      || typeof descriptor === 'number'
      || typeof descriptor === 'boolean'
      || Array.isArray(descriptor)
    ) {
      return descriptor;
    }

    if (!descriptor || typeof descriptor !== 'object') {
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
    const pathSegments = String(pathValue || '')
      .split('.')
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (pathSegments.length === 0) {
      return undefined;
    }

    let current = target;
    for (const segment of pathSegments) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (Array.isArray(current)) {
        const index = Number(segment);
        current = Number.isInteger(index) ? current[index] : undefined;
        continue;
      }

      current = current[segment];
    }

    return current;
  }

  _buildPreview(record, config, row) {
    const endpointUrl = `${config.apiUrl}/api/database/rows/table/${encodeURIComponent(config.tableId)}/?user_field_names=true`;

    return {
      provider: 'baserow',
      target_type: record.target_type || null,
      target_name: record.target_name || null,
      target_provider: record.target_provider || null,
      api_url: config.apiUrl,
      table_id: config.tableId,
      endpoint_url: endpointUrl,
      row_preview: row
    };
  }

  _buildRowReferenceUrl(config, receiptId) {
    if (!receiptId) {
      return `${config.apiUrl}/api/database/rows/table/${encodeURIComponent(config.tableId)}/?user_field_names=true`;
    }

    return `${config.apiUrl}/api/database/rows/table/${encodeURIComponent(config.tableId)}/${encodeURIComponent(String(receiptId))}/?user_field_names=true`;
  }

  _resolveFetchImpl() {
    if (typeof this._config.BaserowFetch === 'function') {
      return this._config.BaserowFetch;
    }

    if (typeof this._config.ExternalPublishFetch === 'function') {
      return this._config.ExternalPublishFetch;
    }

    if (typeof fetch === 'function') {
      return fetch;
    }

    return null;
  }

  async _readJsonSafely(response) {
    if (!response || typeof response.json !== 'function') {
      return null;
    }

    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  _extractReceiptId(payload) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    return payload.id || payload.row_id || null;
  }

  _extractErrorMessage(payload, fallback) {
    if (!payload || typeof payload !== 'object') {
      return fallback;
    }

    return payload.detail || payload.error || payload.message || fallback;
  }
}

module.exports = new BaserowPublishAdapter();

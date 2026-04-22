const DEFAULT_NOTION_VERSION = '2022-06-28';
const DEFAULT_EXECUTION_MODE = 'dry_run';
const NOTION_API_BASE_URL = 'https://api.notion.com/v1/pages';
const TEXT_BLOCK_MAX_LENGTH = 1800;

class ExternalPublishAdapter {
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
    const targetType = String(record.target_type || '').trim();

    if (targetType !== 'notion') {
      return {
        ok: false,
        attempted: false,
        no_op: true,
        activation_status: 'unsupported_live_target',
        adapter: null,
        execution_mode: executionMode,
        target_type: targetType,
        target_name: record.target_name || null,
        reason: `Live publish is not implemented for target_type "${targetType}".`
      };
    }

    const preview = this._buildNotionPreview(record);

    if (executionMode === 'dry_run') {
      return {
        ok: true,
        attempted: false,
        no_op: false,
        activation_status: 'dry_run_preview',
        adapter: 'notion_page',
        execution_mode: executionMode,
        target_type: targetType,
        target_name: record.target_name || null,
        request_preview: preview
      };
    }

    const config = this._resolveNotionConfig();
    if (config.missing_fields.length > 0) {
      return {
        ok: false,
        attempted: false,
        no_op: true,
        activation_status: 'missing_live_config',
        adapter: 'notion_page',
        execution_mode: executionMode,
        target_type: targetType,
        target_name: record.target_name || null,
        missing_fields: config.missing_fields,
        reason: 'Notion live publish is not configured.',
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
        adapter: 'notion_page',
        execution_mode: executionMode,
        target_type: targetType,
        target_name: record.target_name || null,
        reason: 'No HTTP client is available for external publishing.',
        request_preview: preview
      };
    }

    const requestBody = this._buildNotionRequestBody(record, config.parentPageId, preview);

    try {
      const response = await fetchImpl(NOTION_API_BASE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': config.notionVersion
        },
        body: JSON.stringify(requestBody)
      });

      const responsePayload = await this._readJsonSafely(response);
      if (!response.ok) {
        return {
          ok: false,
          attempted: true,
          no_op: false,
          activation_status: 'live_publish_failed',
          adapter: 'notion_page',
          execution_mode: executionMode,
          target_type: targetType,
          target_name: record.target_name || null,
          status_code: response.status,
          error_message: this._extractErrorMessage(responsePayload, `Notion publish failed with status ${response.status}.`),
          request_preview: preview,
          response_preview: responsePayload
        };
      }

      return {
        ok: true,
        attempted: true,
        no_op: false,
        activation_status: 'live_published',
        adapter: 'notion_page',
        execution_mode: executionMode,
        target_type: targetType,
        target_name: record.target_name || null,
        receipt_id: responsePayload.id || null,
        external_reference_url: responsePayload.url || null,
        status_code: response.status,
        request_preview: preview,
        response_preview: responsePayload
      };
    } catch (error) {
      return {
        ok: false,
        attempted: true,
        no_op: false,
        activation_status: 'live_publish_failed',
        adapter: 'notion_page',
        execution_mode: executionMode,
        target_type: targetType,
        target_name: record.target_name || null,
        error_message: error instanceof Error ? error.message : String(error),
        request_preview: preview
      };
    }
  }

  _resolveExecutionMode(value) {
    return value === 'live' ? 'live' : DEFAULT_EXECUTION_MODE;
  }

  _resolveNotionConfig() {
    const apiKey = String(
      this._config.NotionApiKey
      || process.env.VCP_PHOTO_STUDIO_NOTION_API_KEY
      || process.env.NOTION_API_KEY
      || ''
    ).trim();

    const parentPageId = String(
      this._config.NotionParentPageId
      || process.env.VCP_PHOTO_STUDIO_NOTION_PARENT_PAGE_ID
      || process.env.NOTION_PARENT_PAGE_ID
      || ''
    ).trim();

    const notionVersion = String(
      this._config.NotionVersion
      || process.env.VCP_PHOTO_STUDIO_NOTION_VERSION
      || DEFAULT_NOTION_VERSION
    ).trim() || DEFAULT_NOTION_VERSION;

    const missing_fields = [];
    if (!apiKey) {
      missing_fields.push('NotionApiKey');
    }
    if (!parentPageId) {
      missing_fields.push('NotionParentPageId');
    }

    return {
      apiKey,
      parentPageId,
      notionVersion,
      missing_fields
    };
  }

  _resolveFetchImpl() {
    if (typeof this._config.ExternalPublishFetch === 'function') {
      return this._config.ExternalPublishFetch;
    }

    if (typeof fetch === 'function') {
      return fetch;
    }

    return null;
  }

  _buildNotionPreview(record) {
    const title = this._buildNotionTitle(record);
    const contentLines = String(record.export_text || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 12);

    return {
      provider: 'notion',
      mode: 'page_under_parent',
      target_type: record.target_type || null,
      target_name: record.target_name || null,
      page_title: title,
      content_preview_lines: contentLines
    };
  }

  _buildNotionRequestBody(record, parentPageId, preview) {
    return {
      parent: {
        page_id: parentPageId
      },
      properties: {
        title: [
          {
            type: 'text',
            text: {
              content: preview.page_title
            }
          }
        ]
      },
      children: this._buildNotionChildren(record)
    };
  }

  _buildNotionTitle(record) {
    const targetName = String(record.target_name || 'photo_studio_export').trim() || 'photo_studio_export';
    const exportScope = String(record.export_scope || 'all_projects').trim() || 'all_projects';
    const referenceDate = String(record.reference_date || '').trim() || 'undated';
    const projectId = record.project_id ? ` | ${record.project_id}` : '';
    return `Photo Studio Export | ${targetName} | ${exportScope} | ${referenceDate}${projectId}`.slice(0, 200);
  }

  _buildNotionChildren(record) {
    const lines = String(record.export_text || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return [
        this._paragraphBlock('Photo Studio export payload is empty.')
      ];
    }

    return lines
      .flatMap((line) => this._chunkText(line, TEXT_BLOCK_MAX_LENGTH))
      .slice(0, 100)
      .map((line) => this._paragraphBlock(line));
  }

  _chunkText(text, maxLength) {
    const chunks = [];
    let remaining = String(text || '');

    while (remaining.length > maxLength) {
      chunks.push(remaining.slice(0, maxLength));
      remaining = remaining.slice(maxLength);
    }

    if (remaining) {
      chunks.push(remaining);
    }

    return chunks;
  }

  _paragraphBlock(content) {
    return {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: {
              content
            }
          }
        ]
      }
    };
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

  _extractErrorMessage(payload, fallback) {
    if (!payload || typeof payload !== 'object') {
      return fallback;
    }

    return payload.message || payload.error || fallback;
  }
}

module.exports = new ExternalPublishAdapter();

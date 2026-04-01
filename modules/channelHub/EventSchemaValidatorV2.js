// modules/channelHub/EventSchemaValidatorV2.js
const { CHANNEL_EVENT_VERSION } = require('./constants');

const REQUIRED_FIELDS = ['version', 'eventId', 'adapterId', 'channel', 'eventType', 'occurredAt'];
const REQUIRED_NESTED_FIELDS = {
  target: ['agentId'],
  client: ['messageId'],
  payload: ['messages']
};
const ALLOWED_EVENT_VERSIONS = [CHANNEL_EVENT_VERSION, 'B2'];
const DEFAULT_VALUES = {
  version: CHANNEL_EVENT_VERSION,
  eventType: 'message.created',
  'client.conversationType': 'single',
  'session.allowCreateTopic': true,
  'session.allowSwitchTopic': true,
  'runtime.stream': false
};

class EventSchemaValidatorV2 {
  constructor(options = {}) {
    this.options = options;
    this.strictMode = options.strictMode || false;
    this.schema = null;
  }

  validateEnvelope(input) {
    const errors = [];

    if (!input || typeof input !== 'object') {
      errors.push('input must be an object');
      return { valid: false, envelope: null, errors };
    }

    for (const field of REQUIRED_FIELDS) {
      if (input[field] === undefined || input[field] === null) {
        errors.push(`missing required field: ${field}`);
      }
    }

    if (input.version !== undefined && !ALLOWED_EVENT_VERSIONS.includes(input.version)) {
      errors.push(`version must be one of: ${ALLOWED_EVENT_VERSIONS.join(', ')}`);
    }

    for (const [parent, children] of Object.entries(REQUIRED_NESTED_FIELDS)) {
      if (!input[parent] || typeof input[parent] !== 'object') {
        errors.push(`missing required object: ${parent}`);
        continue;
      }
      for (const child of children) {
        if (input[parent][child] === undefined) {
          errors.push(`missing required field: ${parent}.${child}`);
        }
      }
    }

    if (input.payload?.messages) {
      errors.push(...this._validateMessages(input.payload.messages));
    }

    if (input.occurredAt && typeof input.occurredAt !== 'number' && typeof input.occurredAt !== 'string') {
      errors.push('occurredAt must be a number or ISO timestamp string');
    }

    return {
      valid: errors.length === 0,
      envelope: errors.length === 0 ? input : null,
      errors
    };
  }

  normalizeEnvelope(input) {
    const envelope = JSON.parse(JSON.stringify(input));
    const warnings = [];

    for (const [path, value] of Object.entries(DEFAULT_VALUES)) {
      const parts = path.split('.');
      let obj = envelope;
      for (let i = 0; i < parts.length - 1; i += 1) {
        if (!obj[parts[i]]) {
          obj[parts[i]] = {};
        }
        obj = obj[parts[i]];
      }
      const lastKey = parts[parts.length - 1];
      if (obj[lastKey] === undefined) {
        obj[lastKey] = value;
      }
    }

    const versionWarning = this._normalizeVersion(envelope);
    if (versionWarning) {
      warnings.push(versionWarning);
    }

    if (envelope.occurredAt && typeof envelope.occurredAt === 'string') {
      envelope.occurredAt = new Date(envelope.occurredAt).getTime();
    }

    if (!envelope.metadata) {
      envelope.metadata = {};
    }

    if (warnings.length > 0) {
      envelope.metadata.compatibilityWarnings = [
        ...(Array.isArray(envelope.metadata.compatibilityWarnings) ? envelope.metadata.compatibilityWarnings : []),
        ...warnings
      ];
    }

    if (Array.isArray(envelope.payload?.messages)) {
      envelope.payload.messages = envelope.payload.messages.map((msg) => this._normalizeMessage(msg));
    }

    return { envelope, warnings };
  }

  _validateMessages(messages) {
    const errors = [];
    if (!Array.isArray(messages)) {
      errors.push('payload.messages must be an array');
      return errors;
    }
    if (messages.length === 0) {
      errors.push('payload.messages must not be empty');
      return errors;
    }
    for (let i = 0; i < messages.length; i += 1) {
      const msg = messages[i];
      if (!msg.role) {
        errors.push(`messages[${i}] missing role`);
      }
      if (!msg.content && !msg.tool_calls) {
        errors.push(`messages[${i}] missing content or tool_calls`);
      }
    }
    return errors;
  }

  _normalizeMessage(msg) {
    const normalized = { ...msg };
    if (typeof normalized.content === 'string') {
      normalized.content = [{ type: 'text', text: normalized.content }];
    } else if (Array.isArray(normalized.content)) {
      normalized.content = normalized.content.map((part) => {
        if (typeof part === 'string') {
          return { type: 'text', text: part };
        }
        return part;
      });
    }
    return normalized;
  }

  _normalizeVersion(envelope) {
    if (!envelope || envelope.version === undefined || envelope.version === null) {
      envelope.version = CHANNEL_EVENT_VERSION;
      return null;
    }
    if (envelope.version === 'B2') {
      envelope.version = CHANNEL_EVENT_VERSION;
      return 'Version normalized from B2 to 2.0';
    }
    return null;
  }

  validateAndNormalize(input) {
    const { valid, errors } = this.validateEnvelope(input);
    if (!valid) {
      return { valid, envelope: null, errors, warnings: [] };
    }
    const normalized = this.normalizeEnvelope(input);
    return {
      valid: true,
      envelope: normalized.envelope,
      errors: [],
      warnings: normalized.warnings || []
    };
  }
}

module.exports = EventSchemaValidatorV2;

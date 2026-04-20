'use strict';

function validateRequiredFields(args, requiredFields) {
  const missing = [];

  for (const field of requiredFields) {
    if (!(field in args) || args[field] === undefined || args[field] === null || args[field] === '') {
      missing.push(field);
    }
  }

  return missing;
}

function inferRequiredFields(schema) {
  if (!schema || typeof schema !== 'object') {
    return [];
  }

  if (Array.isArray(schema.required)) {
    return schema.required.map((item) => String(item));
  }

  const params = schema.params || schema.parameters;
  if (Array.isArray(params)) {
    return params
      .filter((item) => item && (item.required === true || String(item.required).toLowerCase() === 'true'))
      .map((item) => String(item.name || item.key || '').trim())
      .filter(Boolean);
  }

  return [];
}

function inferAllowedFields(schema) {
  if (!schema || typeof schema !== 'object') {
    return [];
  }

  if (schema.properties && typeof schema.properties === 'object') {
    return Object.keys(schema.properties);
  }

  const params = schema.params || schema.parameters;
  if (Array.isArray(params)) {
    return params
      .map((item) => String(item.name || item.key || '').trim())
      .filter(Boolean);
  }

  return [];
}

function validateArgsAgainstSchema(args, schema) {
  if (!schema || typeof schema !== 'object') {
    return {
      ok: true,
      warning: 'schema unavailable, skipped strict validation'
    };
  }

  const required = inferRequiredFields(schema);
  const missing = validateRequiredFields(args, required);
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `missing required args: ${missing.join(', ')}`,
      hint: 'fill all required arguments from schema_tool output'
    };
  }

  const allowed = inferAllowedFields(schema);
  if (allowed.length > 0) {
    const unknown = Object.keys(args || {}).filter((key) => !allowed.includes(key));
    if (unknown.length > 0) {
      return {
        ok: true,
        warning: `unknown args not declared in schema: ${unknown.join(', ')}`
      };
    }
  }

  return {
    ok: true
  };
}

module.exports = {
  validateArgsAgainstSchema,
  inferRequiredFields,
  inferAllowedFields
};
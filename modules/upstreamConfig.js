function firstNonEmptyEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) {
      return { name, value: value.trim() };
    }
  }
  return { name: null, value: '' };
}

function normalizeApiBaseUrl(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return '';

  try {
    const url = new URL(raw);
    if (/^\/v1$/i.test(url.pathname)) {
      url.pathname = '';
      return url.toString().replace(/\/+$/, '');
    }
  } catch {
    return raw.replace(/\/v1$/i, '');
  }

  return raw.replace(/\/v1$/i, '');
}

function resolveMainApiKey() {
  return firstNonEmptyEnv([
    'API_Key',
    'API_KEY',
    'OPENAI_API_KEY',
    'NVIDIA_API_KEY',
    'NIM_API_KEY'
  ]);
}

function resolveMainApiUrl() {
  const resolved = firstNonEmptyEnv(['API_URL', 'OPENAI_BASE_URL', 'NVIDIA_BASE_URL']);
  return {
    name: resolved.name,
    value: normalizeApiBaseUrl(resolved.value)
  };
}

module.exports = {
  normalizeApiBaseUrl,
  resolveMainApiKey,
  resolveMainApiUrl
};

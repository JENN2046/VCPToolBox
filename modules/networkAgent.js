// Shared fetch agent selection for upstream HTTP(S) calls.
// Keeps the existing keep-alive behavior, and uses env proxy settings for non-local targets.
const http = require('http');
const https = require('https');
const { getProxyForUrl } = require('proxy-from-env');
const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');

const agentOptions = {
  keepAlive: true,
  keepAliveMsecs: 1000,
  freeSocketTimeout: 8000,
  scheduling: 'lifo',
  maxSockets: 10000
};

const keepAliveHttpAgent = new http.Agent(agentOptions);
const keepAliveHttpsAgent = new https.Agent(agentOptions);
const proxyAgents = new Map();
const loggedProxyKeys = new Set();

function normalizeUrl(input) {
  if (input && input.protocol && input.hostname) {
    return input;
  }
  return new URL(String(input));
}

function isBypassHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host === '::1' || host === '0.0.0.0') return true;
  if (host.startsWith('127.')) return true;
  if (host.startsWith('10.')) return true;
  if (host.startsWith('192.168.')) return true;

  const parts = host.split('.').map(part => Number(part));
  if (parts.length === 4 && parts.every(Number.isInteger)) {
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
  }

  return false;
}

function redactProxyUrl(proxyUrl) {
  try {
    const url = new URL(proxyUrl);
    if (url.username) url.username = '***';
    if (url.password) url.password = '***';
    return url.toString();
  } catch {
    return '<invalid-proxy-url>';
  }
}

function getKeepAliveAgent(parsedUrl) {
  return parsedUrl.protocol === 'http:' ? keepAliveHttpAgent : keepAliveHttpsAgent;
}

function getProxyUrl(targetUrl) {
  if (String(process.env.VCP_PROXY_ENABLED || '').toLowerCase() === 'false') {
    return '';
  }
  return getProxyForUrl(targetUrl) || '';
}

function getProxyAgent(parsedUrl) {
  if (!parsedUrl || !/^https?:$/.test(parsedUrl.protocol)) return null;
  if (isBypassHost(parsedUrl.hostname)) return null;

  const proxyUrl = getProxyUrl(parsedUrl.href);
  if (!proxyUrl) return null;

  const key = `${parsedUrl.protocol}|${proxyUrl}`;
  if (!proxyAgents.has(key)) {
    const AgentCtor = parsedUrl.protocol === 'http:' ? HttpProxyAgent : HttpsProxyAgent;
    proxyAgents.set(key, new AgentCtor(proxyUrl, agentOptions));
  }

  if (!loggedProxyKeys.has(key)) {
    loggedProxyKeys.add(key);
    console.log(`[NetworkProxy] Upstream ${parsedUrl.protocol} requests will use proxy ${redactProxyUrl(proxyUrl)}`);
  }

  return proxyAgents.get(key);
}

function getFetchAgent(input) {
  const parsedUrl = normalizeUrl(input);
  return getProxyAgent(parsedUrl) || getKeepAliveAgent(parsedUrl);
}

module.exports = {
  getFetchAgent,
  getKeepAliveAgent,
  getProxyAgent
};

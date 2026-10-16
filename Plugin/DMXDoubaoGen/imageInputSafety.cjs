'use strict';

const dns = require('node:dns').promises;
const fsPromises = require('node:fs/promises');
const http = require('node:http');
const https = require('node:https');
const { BlockList, isIP } = require('node:net');
const path = require('node:path');

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const nonPublicV4 = new BlockList();
for (const [address, prefix] of [
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
    ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
    ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
    ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
]) nonPublicV4.addSubnet(address, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
const nonPublicV6 = new BlockList();
for (const [address, prefix] of [
    ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]
]) nonPublicV6.addSubnet(address, prefix, 'ipv6');

function reject(reason) {
    return Object.assign(new Error(`Unsafe image input: ${reason}`), { code: 'DMX_IMAGE_INPUT_REJECTED' });
}

function parseHttpUrl(value, base) {
    let url;
    try { url = new URL(value, base); } catch { throw reject('invalid URL'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw reject('unsupported protocol or URL credentials');
    }
    return url;
}

function isPublicAddress(address) {
    const family = isIP(address);
    if (family === 4) return !nonPublicV4.check(address, 'ipv4');
    return family === 6 && globalV6.check(address, 'ipv6') && !nonPublicV6.check(address, 'ipv6');
}

function isWithin(root, target) {
    const relative = path.relative(root, target);
    return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

// No environment/config reads here. The caller supplies its already-configured image origins.
function createHttpImageReader({ axios, fs = fsPromises, lookup = dns.lookup,
    projectBasePath, serverPort, imageOrigins = [], mimeLookup = () => 'image/png' }) {
    const ownOrigins = new Set();
    for (const value of imageOrigins.filter(Boolean)) {
        try {
            const origin = parseHttpUrl(value);
            ownOrigins.add(origin.origin);
            if (!origin.port && serverPort) {
                origin.port = String(serverPort);
                ownOrigins.add(origin.origin);
            }
        } catch { /* An invalid configured origin must not grant local-file access. */ }
    }

    async function readLocalImage(url) {
        if (!projectBasePath || !ownOrigins.has(url.origin)) return null;
        const match = url.pathname.match(/^(?:\/pw=[^/]+)?\/images\/(.+)$/);
        if (!match) return null;
        let subPath;
        try { subPath = decodeURIComponent(match[1]); } catch { throw reject('invalid image path encoding'); }
        if (subPath.includes('\0') || subPath.includes('\\') || path.posix.isAbsolute(subPath)
            || path.win32.isAbsolute(subPath) || subPath.split('/').includes('..')) {
            throw reject('image path escapes its root');
        }
        const imageRoot = path.resolve(projectBasePath, 'image');
        const target = path.resolve(imageRoot, subPath);
        if (!isWithin(imageRoot, target)) throw reject('image path escapes its root');
        try {
            const realRoot = await fs.realpath(imageRoot);
            const realTarget = await fs.realpath(target);
            if (!isWithin(realRoot, realTarget)) throw reject('image symlink escapes its root');
            const stat = await fs.stat(realTarget);
            if (!stat.isFile() || stat.size > MAX_IMAGE_BYTES) throw reject('not a supported image file');
            const buffer = await fs.readFile(realTarget);
            if (buffer.length > MAX_IMAGE_BYTES) throw reject('image exceeds 10 MiB');
            return `data:${mimeLookup(realTarget) || 'image/png'};base64,${buffer.toString('base64')}`;
        } catch (error) {
            if (['ENOENT', 'ENOTDIR'].includes(error.code)) return null;
            throw error;
        }
    }

    async function publicDestination(url) {
        const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
        if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
            throw reject('local hostname');
        }
        const family = isIP(hostname);
        let records;
        try { records = family ? [{ address: hostname, family }] : await lookup(hostname, { all: true, verbatim: true }); }
        catch { throw reject('cannot verify DNS destination'); }
        if (!Array.isArray(records) || !records.length || records.some(record => !isPublicAddress(record.address))) {
            throw reject('non-public destination');
        }
        const selected = records[0];
        // Pin the checked address for the actual socket, rather than resolving again.
        return (_hostname, options, callback) => {
            if (typeof options === 'function') { callback = options; options = {}; }
            if (options?.all) callback(null, [{ address: selected.address, family: isIP(selected.address) }]);
            else callback(null, selected.address, isIP(selected.address));
        };
    }

    return async function readHttpImage(value) {
        let url = parseHttpUrl(value);
        const localImage = await readLocalImage(url);
        if (localImage !== null) return localImage;
        for (let hop = 0; hop <= 5; hop++) {
            const pinnedLookup = await publicDestination(url);
            const httpAgent = new http.Agent({ lookup: pinnedLookup });
            const httpsAgent = new https.Agent({ lookup: pinnedLookup });
            let response;
            try {
                response = await axios.get(url.href, {
                    responseType: 'arraybuffer', timeout: 15000, maxContentLength: MAX_IMAGE_BYTES,
                    maxRedirects: 0, proxy: false, httpAgent, httpsAgent, validateStatus: () => true
                });
            } catch {
                // Only a verified public URL may retain the upstream download-failure fallback.
                return url.href;
            } finally {
                httpAgent.destroy();
                httpsAgent.destroy();
            }
            if ([301, 302, 303, 307, 308].includes(response.status)) {
                if (hop === 5 || !response.headers.location) throw reject('invalid or excessive redirect');
                url = parseHttpUrl(response.headers.location, url);
                continue; // Re-check every redirect; never reinterpret it as a local image path.
            }
            if (response.status < 200 || response.status >= 300) return url.href;
            const buffer = Buffer.from(response.data);
            if (buffer.length > MAX_IMAGE_BYTES) throw reject('image exceeds 10 MiB');
            const mimeType = response.headers['content-type']?.split(';')[0]?.trim() || 'image/png';
            return `data:${mimeType};base64,${buffer.toString('base64')}`;
        }
        throw reject('excessive redirect');
    };
}

module.exports = { createHttpImageReader };

'use strict';

const fs = require('fs');
const path = require('path');

function normalizeString(value) {
    return typeof value === 'string' && value.trim()
        ? value.trim()
        : null;
}

function normalizePath(value, projectRoot = process.cwd()) {
    const pathValue = normalizeString(value);
    if (!pathValue) {
        return null;
    }
    return path.resolve(projectRoot, pathValue);
}

function splitPolicyEntries(rawPolicy) {
    if (typeof rawPolicy !== 'string') {
        return [];
    }
    return rawPolicy
        .split(/[;\r\n]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function looksLikePathOnly(value) {
    return /^[A-Za-z]:[\\/]/.test(value) || value.includes('/') || value.includes('\\');
}

function hasWildcard(value) {
    return typeof value === 'string' && value.includes('*');
}

function isDotOnlyPath(value) {
    const pathValue = normalizeString(value);
    if (!pathValue) {
        return false;
    }
    return pathValue.replace(/[\\/]/g, '') === '.';
}

function isParsedRoot(parsedPath) {
    return Boolean(parsedPath.root) && parsedPath.dir === parsedPath.root && !parsedPath.base;
}

function isFilesystemRootPath(value, options = {}) {
    const pathValue = normalizeString(value);
    if (!pathValue) {
        return false;
    }

    const normalized = normalizePath(pathValue, options.projectRoot);
    if (normalized && normalized === path.parse(normalized).root) {
        return true;
    }

    if (path.posix.isAbsolute(pathValue) && isParsedRoot(path.posix.parse(path.posix.resolve(pathValue)))) {
        return true;
    }

    return path.win32.isAbsolute(pathValue) && isParsedRoot(path.win32.parse(path.win32.resolve(pathValue)));
}

function isBroadSourceDirectory(value, options = {}) {
    return isDotOnlyPath(value) || isFilesystemRootPath(value, options);
}

function makeError(entry, reason) {
    return { entry, reason };
}

function parsePolicyEntry(rawEntry, options = {}) {
    const separatorIndex = rawEntry.indexOf('@');
    if (separatorIndex === -1) {
        return {
            entry: null,
            error: makeError(
                rawEntry,
                looksLikePathOnly(rawEntry) ? 'missing-plugin-name' : 'missing-source-directory'
            )
        };
    }

    const pluginName = normalizeString(rawEntry.slice(0, separatorIndex));
    const sourceDirectory = normalizeString(rawEntry.slice(separatorIndex + 1));

    if (!pluginName) {
        return { entry: null, error: makeError(rawEntry, 'missing-plugin-name') };
    }
    if (!sourceDirectory) {
        return { entry: null, error: makeError(rawEntry, 'missing-source-directory') };
    }
    if (hasWildcard(pluginName) || hasWildcard(sourceDirectory)) {
        return { entry: null, error: makeError(rawEntry, 'wildcard-entry-not-allowed') };
    }
    if (isBroadSourceDirectory(sourceDirectory, options)) {
        return { entry: null, error: makeError(rawEntry, 'broad-source-directory-not-allowed') };
    }

    return {
        entry: {
            pluginName,
            sourceDirectory,
            normalizedSourceDirectory: normalizePath(sourceDirectory, options.projectRoot)
        },
        error: null
    };
}

function parseExternalPluginAllowPolicy(rawPolicy, options = {}) {
    const entries = [];
    const errors = [];
    const seen = new Set();

    for (const rawEntry of splitPolicyEntries(rawPolicy)) {
        const parsed = parsePolicyEntry(rawEntry, options);
        if (parsed.error) {
            errors.push(parsed.error);
            continue;
        }

        const dedupeKey = `${parsed.entry.pluginName}\0${parsed.entry.normalizedSourceDirectory}`;
        if (seen.has(dedupeKey)) {
            continue;
        }
        seen.add(dedupeKey);
        entries.push(parsed.entry);
    }

    return { entries, errors };
}

function normalizePolicy(policy, options = {}) {
    if (typeof policy === 'string') {
        return parseExternalPluginAllowPolicy(policy, options);
    }
    if (!policy || typeof policy !== 'object') {
        return { entries: [], errors: [] };
    }
    return {
        entries: Array.isArray(policy.entries) ? policy.entries.slice() : [],
        errors: Array.isArray(policy.errors) ? policy.errors.slice() : []
    };
}

function normalizeComparablePath(value, options = {}) {
    const pathValue = normalizeString(value);
    if (!pathValue) {
        return null;
    }
    const normalized = path.resolve(pathValue);
    return (options.platform || process.platform) === 'win32'
        ? normalized.toLowerCase()
        : normalized;
}

function isPathInsideOrEqual(sourceDirectory, candidatePath, options = {}) {
    const source = normalizeComparablePath(sourceDirectory, options);
    const candidate = normalizeComparablePath(candidatePath, options);
    if (!source || !candidate) {
        return false;
    }
    if (candidate === source) {
        return true;
    }

    const relativePath = path.relative(source, candidate);
    return Boolean(relativePath)
        && !relativePath.startsWith('..')
        && !path.isAbsolute(relativePath);
}

function resolveFreshRealPath(value, options = {}) {
    const normalized = normalizePath(value, options.projectRoot);
    if (!normalized) {
        return null;
    }

    const realpathSync = typeof options.realpathSync === 'function'
        ? options.realpathSync
        : (fs.realpathSync.native || fs.realpathSync);
    try {
        return path.resolve(realpathSync(normalized));
    } catch {
        return null;
    }
}

function getEntrySourceDirectory(entry) {
    return entry?.normalizedSourceDirectory || entry?.sourceDirectory;
}

function makeMatchedPolicy(entry, options = {}, realSourceDirectory = null) {
    if (!entry) {
        return null;
    }
    return {
        pluginName: entry.pluginName,
        normalizedSourceDirectory: normalizePath(getEntrySourceDirectory(entry), options.projectRoot),
        realSourceDirectory: realSourceDirectory || resolveFreshRealPath(getEntrySourceDirectory(entry), options)
    };
}

function comparePath(value, expectedValue, options = {}) {
    const actual = normalizeComparablePath(value, options);
    const expected = normalizeComparablePath(expectedValue, options);
    return Boolean(actual && expected && actual === expected);
}

function readManifestIdentity(manifestPath, options = {}) {
    const readFileSync = typeof options.readFileSync === 'function'
        ? options.readFileSync
        : fs.readFileSync;
    try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        return {
            manifestIdentity: normalizeString(manifest?.name),
            error: null
        };
    } catch (error) {
        return {
            manifestIdentity: null,
            error: error instanceof SyntaxError ? 'manifest-json-invalid' : 'manifest-read-error'
        };
    }
}

function evaluateExactExternalPluginResolution(classification = {}, policy, options = {}) {
    const targetPluginName = normalizeString(options.targetPluginName);
    const targetPluginPath = normalizePath(options.targetPluginPath, options.projectRoot);
    const coreFallbackPath = normalizePath(options.coreFallbackPath, options.projectRoot);
    const manifestFileName = normalizeString(options.manifestFileName) || 'plugin-manifest.json';
    const pluginName = normalizeString(classification.pluginName || classification.name);
    const basePath = normalizePath(classification.basePath, options.projectRoot);
    const baseRealPath = resolveFreshRealPath(classification.basePath, options);
    const targetRealPath = resolveFreshRealPath(targetPluginPath, options);
    const parsedPolicy = parseExternalPluginAllowPolicy(policy, options);
    const isTargetPlugin = Boolean(targetPluginName && pluginName === targetPluginName);
    const isExternal = classification.isExternal === true || classification.pluginSource === 'external';
    const reasons = [];
    const evidence = {
        exactAllowlistParsed: false,
        externalPathResolved: false,
        resolvedPathIsExternalPackagePath: false,
        manifestIdentityMatched: false,
        coreFallback: false,
        executionHandoff: false,
        pluginManagerLoadPluginsInvoked: false,
        processToolCallInvoked: false,
        executePluginInvoked: false,
        providerCalls: false,
        downstreamDispatch: false,
        localStateWrites: false,
        serverRouteActivation: false,
        imageGeneration: false,
        runtimeCutover: false
    };

    if (!isExternal || !isTargetPlugin) {
        return {
            pluginName: pluginName || 'unknown',
            basePath,
            baseRealPath,
            targetPluginPath,
            targetRealPath,
            manifestPath: null,
            manifestIdentity: null,
            decision: 'observe',
            matchedPolicy: null,
            evidence,
            reasons: ['non-target external plugin does not use exact Jenn resolution policy']
        };
    }

    if (!targetPluginName) {
        reasons.push('exact external plugin resolution target name is missing');
    }
    if (!targetPluginPath) {
        reasons.push('exact external plugin resolution target path is missing');
    }
    if (!pluginName) {
        reasons.push('external plugin is missing a concrete plugin name');
    }
    if (!basePath) {
        reasons.push('external plugin is missing a base path');
    }
    if (!baseRealPath) {
        reasons.push('external plugin base path realpath is unavailable');
    }
    if (!targetRealPath) {
        reasons.push('exact external plugin target path realpath is unavailable');
    }
    if (parsedPolicy.errors.length > 0) {
        reasons.push('external plugin allow policy contains invalid entries');
    }

    const sameNameEntries = parsedPolicy.entries.filter((entry) => entry.pluginName === targetPluginName);
    const targetPluginRoot = targetPluginPath ? path.dirname(targetPluginPath) : null;
    const targetPackageRoot = targetPluginRoot ? path.dirname(targetPluginRoot) : null;
    const localStatePattern = /LocalState|VCPToolBox-JENN-LocalState/i;
    let exactEntry = null;

    for (const entry of sameNameEntries) {
        const sourceDirectory = getEntrySourceDirectory(entry);
        const normalizedSourceDirectory = normalizePath(sourceDirectory, options.projectRoot);
        if (hasWildcard(sourceDirectory) || hasWildcard(entry.pluginName)) {
            reasons.push('wildcard allowlist is forbidden');
            continue;
        }
        if (targetPluginRoot && comparePath(normalizedSourceDirectory, targetPluginRoot, options)) {
            reasons.push('package-root allowlist is forbidden');
            continue;
        }
        if (targetPackageRoot && comparePath(normalizedSourceDirectory, targetPackageRoot, options)) {
            reasons.push('package-root allowlist is forbidden');
            continue;
        }
        if (localStatePattern.test(String(normalizedSourceDirectory || sourceDirectory || ''))) {
            reasons.push('LocalState-root allowlist is forbidden');
            continue;
        }
        if (targetPluginPath && comparePath(normalizedSourceDirectory, targetPluginPath, options)) {
            exactEntry = entry;
        }
    }

    if (!exactEntry) {
        reasons.push('exact external plugin allowlist entry is missing');
    } else {
        evidence.exactAllowlistParsed = true;
    }

    if (basePath) {
        evidence.externalPathResolved = true;
        evidence.resolvedPathIsExternalPackagePath = comparePath(basePath, targetPluginPath, options)
            && comparePath(baseRealPath, targetRealPath, options);
        evidence.coreFallback = coreFallbackPath
            ? comparePath(basePath, coreFallbackPath, options) || comparePath(baseRealPath, coreFallbackPath, options)
            : false;
    }

    if (!evidence.resolvedPathIsExternalPackagePath) {
        reasons.push('resolved path is not the sealed external plugin path');
    }
    if (evidence.coreFallback) {
        reasons.push('core fallback path is forbidden');
    }

    const manifestPath = basePath ? path.join(basePath, manifestFileName) : null;
    let manifestIdentity = null;
    if (manifestPath && evidence.resolvedPathIsExternalPackagePath) {
        const manifestResult = readManifestIdentity(manifestPath, options);
        manifestIdentity = manifestResult.manifestIdentity;
        if (manifestResult.error) {
            reasons.push(manifestResult.error === 'manifest-json-invalid'
                ? 'manifest identity JSON is invalid'
                : 'manifest identity could not be read');
        }
    } else if (manifestPath) {
        reasons.push('manifest identity proof skipped because resolved path is not exact');
    }

    evidence.manifestIdentityMatched = Boolean(manifestIdentity && manifestIdentity === targetPluginName);
    if (!evidence.manifestIdentityMatched) {
        reasons.push('manifest identity mismatch');
    }

    const matchedPolicy = exactEntry
        ? makeMatchedPolicy(exactEntry, options, resolveFreshRealPath(getEntrySourceDirectory(exactEntry), options))
        : null;
    const allowed = reasons.length === 0
        && evidence.exactAllowlistParsed
        && evidence.externalPathResolved
        && evidence.resolvedPathIsExternalPackagePath
        && evidence.manifestIdentityMatched
        && evidence.coreFallback === false;

    return {
        pluginName: pluginName || 'unknown',
        basePath,
        baseRealPath,
        targetPluginPath,
        targetRealPath,
        manifestPath,
        manifestIdentity,
        decision: allowed ? 'would_allow' : 'would_block',
        matchedPolicy,
        evidence,
        reasons: allowed
            ? ['external plugin matched exact Jenn runtime resolution policy']
            : reasons
    };
}

function evaluateExternalPluginAllowPolicy(classification = {}, policy, options = {}) {
    const parsedPolicy = normalizePolicy(policy, options);
    const pluginName = normalizeString(classification.pluginName || classification.name);
    const basePath = normalizePath(classification.basePath, options.projectRoot);
    const baseRealPath = resolveFreshRealPath(classification.basePath, options);
    const isExternal = classification.isExternal === true || classification.pluginSource === 'external';
    const reasons = [];

    if (!isExternal) {
        return {
            pluginName: pluginName || 'unknown',
            basePath,
            baseRealPath,
            decision: 'observe',
            matchedPolicy: null,
            reasons: ['non-external plugin does not require external allow policy']
        };
    }

    if (!pluginName || pluginName === 'unknown') {
        reasons.push('external plugin is missing a concrete plugin name');
    }
    if (!basePath) {
        reasons.push('external plugin is missing a base path');
    } else if (!baseRealPath) {
        reasons.push('external plugin base path realpath is unavailable');
    }
    if (parsedPolicy.errors.length > 0) {
        reasons.push('external plugin allow policy contains invalid entries');
    }

    if (pluginName && pluginName !== 'unknown' && basePath && baseRealPath) {
        const sameNameEntries = parsedPolicy.entries.filter((entry) => entry.pluginName === pluginName);
        const scopedSameNameEntries = sameNameEntries
            .filter((entry) => !isBroadSourceDirectory(getEntrySourceDirectory(entry), options))
            .map((entry) => ({
                entry,
                realSourceDirectory: resolveFreshRealPath(getEntrySourceDirectory(entry), options)
            }))
            .filter((item) => item.realSourceDirectory);

        if (sameNameEntries.length > scopedSameNameEntries.length) {
            reasons.push('external plugin allow policy contains broad or unresolved source directory entries');
        }

        const matchedEntry = scopedSameNameEntries.find((item) => (
            isPathInsideOrEqual(item.realSourceDirectory, baseRealPath, options)
        ));

        if (matchedEntry) {
            return {
                pluginName,
                basePath,
                baseRealPath,
                decision: 'would_allow',
                matchedPolicy: makeMatchedPolicy(matchedEntry.entry, options, matchedEntry.realSourceDirectory),
                reasons: [
                    'external plugin matched explicit name and source directory policy',
                    ...reasons
                ]
            };
        }

        if (sameNameEntries.length > 0) {
            reasons.push('external plugin name matched allow policy but source directory did not match');
        } else {
            reasons.push('external plugin requires explicit name and source directory allow policy');
        }
    }

    return {
        pluginName: pluginName || 'unknown',
        basePath,
        baseRealPath,
        decision: 'would_block',
        matchedPolicy: null,
        reasons
    };
}

module.exports = {
    parseExternalPluginAllowPolicy,
    evaluateExternalPluginAllowPolicy,
    evaluateExactExternalPluginResolution
};

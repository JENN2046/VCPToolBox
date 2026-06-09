// modules/pluginRootResolver.js
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const LEGACY_MANIFEST_FILE_NAME = 'plugin-manifest.json';
const BLOCKED_MANIFEST_SUFFIX = '.block';
const VCP_PLUGIN_DIRS_ENV = 'VCP_PLUGIN_DIRS';
const VCP_PLUGIN_ALLOWED_ROOTS_ENV = 'VCP_PLUGIN_ALLOWED_ROOTS';

function uniqueByResolvedPath(paths) {
    const seen = new Set();
    const result = [];
    for (const value of paths) {
        if (!value) continue;
        const resolved = path.resolve(value);
        const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(resolved);
    }
    return result;
}

function splitPathList(rawValue) {
    if (!rawValue || typeof rawValue !== 'string') return [];

    const trimmed = rawValue.trim();
    if (!trimmed) return [];

    if (trimmed.includes(';')) {
        return trimmed.split(';').map(item => item.trim()).filter(Boolean);
    }

    if (/^[A-Za-z]:[\\/]/.test(trimmed)) {
        return [trimmed];
    }

    return trimmed.split(path.delimiter).map(item => item.trim()).filter(Boolean);
}

function isSubPath(candidate, parent) {
    const resolvedCandidate = path.resolve(candidate);
    const resolvedParent = path.resolve(parent);
    if (resolvedCandidate === resolvedParent) return true;

    const relative = path.relative(resolvedParent, resolvedCandidate);
    return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function toDisplayPath(projectRoot, absolutePath, source = 'external') {
    const resolved = path.resolve(absolutePath);
    const resolvedProjectRoot = path.resolve(projectRoot);

    if (isSubPath(resolved, resolvedProjectRoot)) {
        return path.relative(resolvedProjectRoot, resolved).replace(/\\/g, '/') || '.';
    }

    return `[${source}]/${path.basename(resolved)}`;
}

function isUnsafeRoot(projectRoot, rootPath) {
    const resolvedProjectRoot = path.resolve(projectRoot);
    const resolvedRoot = path.resolve(rootPath);

    if (resolvedRoot === resolvedProjectRoot) {
        return 'external root must not equal project root';
    }

    const lowered = resolvedRoot.toLowerCase();
    if (lowered.includes(`${path.sep}.git${path.sep}`) || lowered.endsWith(`${path.sep}.git`)) {
        return 'external root must not be inside .git';
    }

    if (lowered.includes(`${path.sep}node_modules${path.sep}`) || lowered.endsWith(`${path.sep}node_modules`)) {
        return 'external root must not be inside node_modules';
    }

    return null;
}

async function pathExists(targetPath) {
    try {
        await fsp.access(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function realpathOrResolve(targetPath) {
    try {
        return await fsp.realpath(targetPath);
    } catch {
        return path.resolve(targetPath);
    }
}

function realpathOrResolveSync(targetPath) {
    try {
        return fs.realpathSync(targetPath);
    } catch {
        return path.resolve(targetPath);
    }
}

class PluginRootResolver {
    constructor(options = {}) {
        this.projectRoot = path.resolve(options.projectRoot || path.join(__dirname, '..'));
        this.env = options.env || process.env;
        this.coreLegacyRoot = path.resolve(options.coreLegacyRoot || path.join(this.projectRoot, 'Plugin'));
        this.coreModernRoot = path.resolve(options.coreModernRoot || path.join(this.projectRoot, 'plugins'));
    }

    resolvePathList(rawValue) {
        return uniqueByResolvedPath(
            splitPathList(rawValue).map(item => {
                const normalized = path.normalize(item);
                return path.isAbsolute(normalized)
                    ? normalized
                    : path.resolve(this.projectRoot, normalized);
            })
        ).map(rootPath => ({
            rootPath,
            displayPath: toDisplayPath(this.projectRoot, rootPath, 'external')
        }));
    }

    getAllowedRootsSync() {
        return this.resolvePathList(this.env[VCP_PLUGIN_ALLOWED_ROOTS_ENV])
            .map(root => realpathOrResolveSync(root.rootPath));
    }

    _buildExternalRootInfo(entry, index, allowedRoots, diagnostics, options = {}) {
        const rootId = `external:${index + 1}`;
        const rootPath = options.realpath
            ? options.realpath(entry.rootPath)
            : realpathOrResolveSync(entry.rootPath);
        const displayPath = toDisplayPath(this.projectRoot, rootPath, 'external');
        const unsafeReason = isUnsafeRoot(this.projectRoot, rootPath);

        if (unsafeReason) {
            diagnostics.push({ level: 'warn', code: 'unsafe_external_root', rootId, root: displayPath, message: unsafeReason });
            return null;
        }

        if (allowedRoots.length === 0) {
            diagnostics.push({ level: 'warn', code: 'external_roots_require_allowlist', rootId, root: displayPath });
            return null;
        }

        const allowed = allowedRoots.some(allowedRoot => isSubPath(rootPath, allowedRoot));
        if (!allowed) {
            diagnostics.push({ level: 'warn', code: 'external_root_not_allowed', rootId, root: displayPath });
            return null;
        }

        return {
            rootId,
            source: 'external',
            rootPath,
            displayPath,
            allowConfigEnv: false,
            enabled: true
        };
    }

    getExternalLegacyRootsSync() {
        const allowedRoots = this.getAllowedRootsSync();
        const diagnostics = [];
        const roots = [];

        this.resolvePathList(this.env[VCP_PLUGIN_DIRS_ENV]).forEach((entry, index) => {
            const rootInfo = this._buildExternalRootInfo(entry, index, allowedRoots, diagnostics);
            if (rootInfo) roots.push(rootInfo);
        });

        return { roots, diagnostics };
    }

    getWatchRoots() {
        return this.getPluginRootSnapshotSync().watchRoots;
    }

    getPluginRootSnapshotSync() {
        const { roots: externalLegacyRoots, diagnostics } = this.getExternalLegacyRootsSync();
        const coreLegacyRoot = {
            rootId: 'core:legacy',
            source: 'core',
            rootPath: this.coreLegacyRoot,
            displayPath: toDisplayPath(this.projectRoot, this.coreLegacyRoot, 'core'),
            allowConfigEnv: true,
            enabled: true
        };

        const coreModernRoot = {
            rootId: 'core:modern',
            source: 'core-modern',
            rootPath: this.coreModernRoot,
            displayPath: toDisplayPath(this.projectRoot, this.coreModernRoot, 'core'),
            allowConfigEnv: true,
            enabled: true
        };

        return {
            projectRoot: this.projectRoot,
            coreLegacyRoot,
            coreModernRoot,
            externalLegacyRoots,
            legacyLoadRoots: [coreLegacyRoot, ...externalLegacyRoots],
            watchRoots: uniqueByResolvedPath([
                this.coreLegacyRoot,
                this.coreModernRoot,
                ...externalLegacyRoots.map(root => root.rootPath)
            ]),
            diagnostics
        };
    }

    async getAllowedRoots() {
        const roots = this.resolvePathList(this.env[VCP_PLUGIN_ALLOWED_ROOTS_ENV]);
        const resolved = [];
        for (const root of roots) {
            resolved.push(await realpathOrResolve(root.rootPath));
        }
        return uniqueByResolvedPath(resolved);
    }

    async getExternalLegacyRoots() {
        const allowedRoots = await this.getAllowedRoots();
        const diagnostics = [];
        const roots = [];
        const entries = this.resolvePathList(this.env[VCP_PLUGIN_DIRS_ENV]);

        for (let index = 0; index < entries.length; index += 1) {
            const entry = entries[index];
            const exists = await pathExists(entry.rootPath);
            const realRoot = await realpathOrResolve(entry.rootPath);
            const displayPath = toDisplayPath(this.projectRoot, realRoot, 'external');

            if (!exists) {
                diagnostics.push({ level: 'warn', code: 'external_root_missing', rootId: `external:${index + 1}`, root: displayPath });
                continue;
            }

            const rootInfo = this._buildExternalRootInfo(
                { ...entry, rootPath: realRoot },
                index,
                allowedRoots,
                diagnostics,
                { realpath: value => value }
            );
            if (rootInfo) roots.push(rootInfo);
        }

        return { roots, diagnostics };
    }

    async getPluginRootSnapshot() {
        const coreLegacyRealPath = await realpathOrResolve(this.coreLegacyRoot);
        const coreModernRealPath = await realpathOrResolve(this.coreModernRoot);
        const { roots: externalLegacyRoots, diagnostics } = await this.getExternalLegacyRoots();

        const coreLegacyRoot = {
            rootId: 'core:legacy',
            source: 'core',
            rootPath: coreLegacyRealPath,
            displayPath: toDisplayPath(this.projectRoot, coreLegacyRealPath, 'core'),
            allowConfigEnv: true,
            enabled: true
        };

        const coreModernRoot = {
            rootId: 'core:modern',
            source: 'core-modern',
            rootPath: coreModernRealPath,
            displayPath: toDisplayPath(this.projectRoot, coreModernRealPath, 'core'),
            allowConfigEnv: true,
            enabled: true
        };

        return {
            projectRoot: this.projectRoot,
            coreLegacyRoot,
            coreModernRoot,
            externalLegacyRoots,
            legacyLoadRoots: [coreLegacyRoot, ...externalLegacyRoots],
            watchRoots: uniqueByResolvedPath([
                coreLegacyRealPath,
                coreModernRealPath,
                ...externalLegacyRoots.map(root => root.rootPath)
            ]),
            diagnostics
        };
    }
}

function createPluginRootResolver(options = {}) {
    return new PluginRootResolver(options);
}

module.exports = {
    createPluginRootResolver,
    PluginRootResolver,
    splitPathList,
    isSubPath,
    toDisplayPath,
    LEGACY_MANIFEST_FILE_NAME,
    BLOCKED_MANIFEST_SUFFIX,
    VCP_PLUGIN_DIRS_ENV,
    VCP_PLUGIN_ALLOWED_ROOTS_ENV
};

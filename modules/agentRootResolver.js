'use strict';

const fs = require('fs');
const path = require('path');

const {
    splitPathList,
    isSubPath,
    pathKey,
    toDisplayPath
} = require('./pluginRootResolver');

const VCP_AGENT_DIRS_ENV = 'VCP_AGENT_DIRS';
const VCP_AGENT_OVERRIDE_DIRS_ENV = 'VCP_AGENT_OVERRIDE_DIRS';
const VCP_AGENT_ALLOWED_ROOTS_ENV = 'VCP_AGENT_ALLOWED_ROOTS';

const AGENT_FILE_EXTENSIONS = new Set(['.txt', '.md']);
const AGENT_METADATA_FILE_NAMES = new Set(['README.AGENTS_OS.md']);
const BLOCKED_ROOT_SEGMENTS = new Set([
    '.git',
    '.agent_board',
    'node_modules',
    'LocalState',
    'state',
    'cache',
    'log',
    'logs',
    'DebugLog',
    'image',
    'output',
    'outputs',
    'secrets'
]);

function uniqueByResolvedPath(paths) {
    const seen = new Set();
    const result = [];
    for (const candidate of paths) {
        if (!candidate) continue;
        const resolved = path.resolve(candidate);
        const key = pathKey(resolved);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(resolved);
    }
    return result;
}

function realpathOrResolveSync(targetPath) {
    try {
        return fs.realpathSync(targetPath);
    } catch {
        return path.resolve(targetPath);
    }
}

function normalizeAgentPath(relativePath) {
    return relativePath.replace(/\\/g, '/');
}

function getAgentIdFromRelativePath(relativePath) {
    const normalized = normalizeAgentPath(relativePath);
    return normalized.replace(/\.(txt|md)$/i, '');
}

function resolvePathList(rawValue, projectRoot) {
    return uniqueByResolvedPath(
        splitPathList(rawValue).map(item => {
            const normalized = path.normalize(item);
            return path.isAbsolute(normalized)
                ? normalized
                : path.resolve(projectRoot, normalized);
        })
    );
}

function hasBlockedPathSegment(rootPath) {
    return path.resolve(rootPath)
        .split(/[\\/]+/)
        .some(segment => BLOCKED_ROOT_SEGMENTS.has(segment));
}

function getUnsafeAgentRootReason(projectRoot, rootPath) {
    const resolvedProjectRoot = path.resolve(projectRoot);
    const resolvedRoot = path.resolve(rootPath);

    if (resolvedRoot === resolvedProjectRoot) {
        return 'agent external root must not equal project root';
    }

    if (hasBlockedPathSegment(resolvedRoot)) {
        return 'agent external root must not be inside blocked runtime/private paths';
    }

    return null;
}

function scanAgentFilesFromRoot(rootInfo, diagnostics = []) {
    const files = [];
    const rootPath = rootInfo.rootPath;

    function scanDirectory(dirPath, relativeBase) {
        let entries;
        try {
            entries = fs.readdirSync(dirPath, { withFileTypes: true });
        } catch (error) {
            if (error.code !== 'ENOENT') {
                diagnostics.push({
                    level: 'warn',
                    code: 'agent_root_read_error',
                    rootId: rootInfo.rootId,
                    root: rootInfo.displayPath,
                    errorCode: error.code || 'UNKNOWN'
                });
            }
            return;
        }

        for (const entry of entries) {
            if (entry.name.startsWith('.')) {
                continue;
            }

            const entryPath = path.join(dirPath, entry.name);
            const relativePath = relativeBase ? path.join(relativeBase, entry.name) : entry.name;

            if (entry.isSymbolicLink()) {
                diagnostics.push({
                    level: 'warn',
                    code: 'agent_symlink_unsupported',
                    rootId: rootInfo.rootId,
                    path: normalizeAgentPath(relativePath)
                });
                continue;
            }

            if (entry.isDirectory()) {
                scanDirectory(entryPath, relativePath);
                continue;
            }

            if (!entry.isFile()) {
                continue;
            }

            if (AGENT_METADATA_FILE_NAMES.has(entry.name)) {
                continue;
            }

            const extension = path.extname(entry.name).toLowerCase();
            if (!AGENT_FILE_EXTENSIONS.has(extension)) {
                continue;
            }

            const normalizedRelativePath = normalizeAgentPath(relativePath);
            files.push({
                id: getAgentIdFromRelativePath(normalizedRelativePath),
                relativePath: normalizedRelativePath,
                absolutePath: entryPath,
                rootId: rootInfo.rootId,
                source: rootInfo.source,
                lane: rootInfo.lane,
                displayPath: `${rootInfo.displayPath}/${normalizedRelativePath}`
            });
        }
    }

    scanDirectory(rootPath, '');
    return files;
}

function groupById(files) {
    const grouped = new Map();
    for (const file of files) {
        if (!grouped.has(file.id)) {
            grouped.set(file.id, []);
        }
        grouped.get(file.id).push(file);
    }
    return grouped;
}

class AgentRootResolver {
    constructor(options = {}) {
        this.projectRoot = path.resolve(options.projectRoot || path.join(__dirname, '..'));
        this.env = options.env || process.env;
        this.coreAgentRoot = path.resolve(options.coreAgentRoot || path.join(this.projectRoot, 'Agent'));
    }

    getAllowedRootsSync() {
        return resolvePathList(this.env[VCP_AGENT_ALLOWED_ROOTS_ENV], this.projectRoot)
            .map(rootPath => realpathOrResolveSync(rootPath));
    }

    _buildExternalRootInfo(rootPath, index, lane, allowedRoots, diagnostics) {
        const rootId = `external:${lane}:${index + 1}`;
        const realRoot = realpathOrResolveSync(rootPath);
        const displayPath = toDisplayPath(this.projectRoot, realRoot, 'external');
        const unsafeReason = getUnsafeAgentRootReason(this.projectRoot, realRoot);

        if (unsafeReason) {
            diagnostics.push({
                level: 'warn',
                code: 'agent_unsafe_external_root',
                rootId,
                lane,
                root: displayPath,
                message: unsafeReason
            });
            return null;
        }

        if (allowedRoots.length === 0) {
            diagnostics.push({
                level: 'warn',
                code: 'agent_external_roots_require_allowlist',
                rootId,
                lane,
                root: displayPath
            });
            return null;
        }

        const allowed = allowedRoots.some(allowedRoot => isSubPath(realRoot, allowedRoot));
        if (!allowed) {
            diagnostics.push({
                level: 'warn',
                code: 'agent_external_root_not_allowed',
                rootId,
                lane,
                root: displayPath
            });
            return null;
        }

        return {
            rootId,
            source: 'external',
            lane,
            rootPath: realRoot,
            displayPath,
            enabled: true
        };
    }

    _getExternalRootsSync(envName, lane, allowedRoots, diagnostics) {
        const roots = [];
        resolvePathList(this.env[envName], this.projectRoot).forEach((rootPath, index) => {
            const rootInfo = this._buildExternalRootInfo(rootPath, index, lane, allowedRoots, diagnostics);
            if (rootInfo) {
                roots.push(rootInfo);
            }
        });
        return roots;
    }

    getAgentRootSnapshotSync() {
        const diagnostics = [];
        const allowedRoots = this.getAllowedRootsSync();
        const coreAgentRoot = {
            rootId: 'core:agent',
            source: 'core',
            lane: 'core',
            rootPath: this.coreAgentRoot,
            displayPath: toDisplayPath(this.projectRoot, this.coreAgentRoot, 'core'),
            enabled: true
        };
        const externalAdditiveRoots = this._getExternalRootsSync(
            VCP_AGENT_DIRS_ENV,
            'additive',
            allowedRoots,
            diagnostics
        );
        const externalOverrideRoots = this._getExternalRootsSync(
            VCP_AGENT_OVERRIDE_DIRS_ENV,
            'override',
            allowedRoots,
            diagnostics
        );

        return {
            projectRoot: this.projectRoot,
            coreAgentRoot,
            externalAdditiveRoots,
            externalOverrideRoots,
            loadRoots: [
                coreAgentRoot,
                ...externalAdditiveRoots,
                ...externalOverrideRoots
            ],
            watchRoots: uniqueByResolvedPath([
                this.coreAgentRoot,
                ...externalAdditiveRoots.map(root => root.rootPath),
                ...externalOverrideRoots.map(root => root.rootPath)
            ]),
            diagnostics
        };
    }

    getAgentFilePlanSync() {
        const snapshot = this.getAgentRootSnapshotSync();
        const diagnostics = [...snapshot.diagnostics];
        const coreFiles = scanAgentFilesFromRoot(snapshot.coreAgentRoot, diagnostics);
        const additiveFiles = snapshot.externalAdditiveRoots.flatMap(root => scanAgentFilesFromRoot(root, diagnostics));
        const overrideFiles = snapshot.externalOverrideRoots.flatMap(root => scanAgentFilesFromRoot(root, diagnostics));

        const coreById = new Map();
        const skippedFiles = [];
        for (const file of coreFiles) {
            if (coreById.has(file.id)) {
                diagnostics.push({
                    level: 'warn',
                    code: 'core_duplicate_agent_id',
                    id: file.id,
                    path: file.displayPath
                });
                skippedFiles.push({ ...file, skippedReason: 'core_duplicate_agent_id' });
                continue;
            }
            coreById.set(file.id, { ...file, effectiveSource: 'core' });
        }

        const effectiveById = new Map(coreById);
        const additiveById = groupById(additiveFiles);
        for (const [id, files] of additiveById.entries()) {
            if (coreById.has(id)) {
                diagnostics.push({
                    level: 'warn',
                    code: 'additive_duplicate_core_agent',
                    id,
                    count: files.length
                });
                skippedFiles.push(...files.map(file => ({ ...file, skippedReason: 'additive_duplicate_core_agent' })));
                continue;
            }

            if (files.length > 1) {
                diagnostics.push({
                    level: 'warn',
                    code: 'additive_duplicate_external_agent',
                    id,
                    count: files.length
                });
                skippedFiles.push(...files.map(file => ({ ...file, skippedReason: 'additive_duplicate_external_agent' })));
                continue;
            }

            effectiveById.set(id, { ...files[0], effectiveSource: 'external-additive' });
        }

        const overrideById = groupById(overrideFiles);
        for (const [id, files] of overrideById.entries()) {
            if (!coreById.has(id)) {
                diagnostics.push({
                    level: 'warn',
                    code: 'override_without_core_agent',
                    id,
                    count: files.length
                });
                skippedFiles.push(...files.map(file => ({ ...file, skippedReason: 'override_without_core_agent' })));
                continue;
            }

            if (files.length > 1) {
                diagnostics.push({
                    level: 'warn',
                    code: 'override_duplicate_external_agent',
                    id,
                    count: files.length
                });
                skippedFiles.push(...files.map(file => ({ ...file, skippedReason: 'override_duplicate_external_agent' })));
                continue;
            }

            effectiveById.set(id, {
                ...files[0],
                effectiveSource: 'external-override',
                overrides: coreById.get(id)
            });
        }

        const effectiveAgents = Array.from(effectiveById.values())
            .sort((first, second) => first.id.localeCompare(second.id));

        return {
            snapshot,
            coreFiles,
            additiveFiles,
            overrideFiles,
            effectiveAgents,
            skippedFiles,
            diagnostics
        };
    }
}

function createAgentRootResolver(options = {}) {
    return new AgentRootResolver(options);
}

module.exports = {
    createAgentRootResolver,
    AgentRootResolver,
    scanAgentFilesFromRoot,
    getAgentIdFromRelativePath,
    VCP_AGENT_DIRS_ENV,
    VCP_AGENT_OVERRIDE_DIRS_ENV,
    VCP_AGENT_ALLOWED_ROOTS_ENV
};

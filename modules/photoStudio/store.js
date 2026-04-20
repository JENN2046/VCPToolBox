const fs = require('fs').promises;
const path = require('path');
const lockfile = require('proper-lockfile');
const {
    COLLECTION_FILES,
    DEFAULT_RELATIVE_DATA_DIR,
    RECORD_VERSION
} = require('./constants');
const { PhotoStudioError } = require('./runtime');
const { nowIso } = require('./utils');

function resolveProjectBasePath() {
    if (process.env.PROJECT_BASE_PATH) {
        return path.resolve(process.env.PROJECT_BASE_PATH);
    }

    return path.resolve(__dirname, '..', '..');
}

function resolveDataDir() {
    if (process.env.PhotoStudioDataPath) {
        return path.resolve(process.env.PhotoStudioDataPath);
    }

    if (process.env.PHOTO_STUDIO_DATA_DIR) {
        return path.resolve(process.env.PHOTO_STUDIO_DATA_DIR);
    }

    return path.join(resolveProjectBasePath(), DEFAULT_RELATIVE_DATA_DIR);
}

function resolveCollectionPath(collectionName, dataDir = resolveDataDir()) {
    const fileName = COLLECTION_FILES[collectionName];
    if (!fileName) {
        throw new PhotoStudioError('UNKNOWN_ERROR', `Unknown photo_studio collection: ${collectionName}.`, {
            collection: collectionName
        });
    }

    return path.join(dataDir, fileName);
}

async function ensureDataDir(dataDir = resolveDataDir()) {
    await fs.mkdir(dataDir, { recursive: true });
    return dataDir;
}

async function withStoreLock(work) {
    const dataDir = await ensureDataDir();
    const lockPath = path.join(dataDir, '.photo-studio.lock');
    await fs.writeFile(lockPath, '', { flag: 'a' });

    const release = await lockfile.lock(lockPath, {
        realpath: false,
        retries: {
            retries: 5,
            factor: 1.4,
            minTimeout: 50,
            maxTimeout: 200
        }
    });

    try {
        return await work({ dataDir, lockPath });
    } finally {
        await release();
    }
}

async function readCollection(collectionName, dataDir = resolveDataDir()) {
    const collectionPath = resolveCollectionPath(collectionName, dataDir);

    try {
        const raw = await fs.readFile(collectionPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.records)) {
            throw new Error('records array missing');
        }

        return parsed;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {
                version: RECORD_VERSION,
                updated_at: null,
                records: []
            };
        }

        throw new PhotoStudioError('UNKNOWN_ERROR', `Failed to read ${collectionName} store.`, {
            collection: collectionName,
            cause: error.message
        });
    }
}

async function writeCollection(collectionName, records, dataDir = resolveDataDir()) {
    const collectionPath = resolveCollectionPath(collectionName, dataDir);
    const tempPath = `${collectionPath}.${process.pid}.${Date.now()}.tmp`;
    const payload = {
        version: RECORD_VERSION,
        updated_at: nowIso(),
        records
    };

    await ensureDataDir(dataDir);
    await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf8');
    await fs.rm(collectionPath, { force: true });
    await fs.rename(tempPath, collectionPath);

    return collectionPath;
}

module.exports = {
    readCollection,
    resolveCollectionPath,
    resolveDataDir,
    withStoreLock,
    writeCollection
};

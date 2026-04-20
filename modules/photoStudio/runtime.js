const { ERROR_CODES } = require('./constants');

class PhotoStudioError extends Error {
    constructor(code, message, details = null) {
        super(message);
        this.name = 'PhotoStudioError';
        this.code = ERROR_CODES.includes(code) ? code : 'UNKNOWN_ERROR';
        this.details = details;
    }
}

function buildSuccess(data, meta = {}) {
    return {
        success: true,
        data,
        error: null,
        meta
    };
}

function buildFailure(error, meta = {}, data = null) {
    const normalizedError = error instanceof PhotoStudioError
        ? error
        : new PhotoStudioError(
            'UNKNOWN_ERROR',
            error && error.message ? error.message : 'Unhandled photo_studio plugin error.',
            error ? { name: error.name } : null
        );

    return {
        success: false,
        data,
        error: {
            code: normalizedError.code,
            message: normalizedError.message,
            field: normalizedError.details && normalizedError.details.field ? normalizedError.details.field : undefined,
            details: normalizedError.details || null
        },
        meta
    };
}

async function readJsonFromStdin() {
    const chunks = [];
    process.stdin.setEncoding('utf8');

    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }

    const rawInput = chunks.join('').trim();
    if (!rawInput) {
        throw new PhotoStudioError('INVALID_INPUT', 'No JSON input received via stdin.');
    }

    try {
        return JSON.parse(rawInput);
    } catch (error) {
        throw new PhotoStudioError('INVALID_INPUT', 'Input payload must be valid JSON.', {
            cause: error.message
        });
    }
}

function withBaseMeta(result, baseMeta) {
    return {
        ...result,
        meta: {
            ...baseMeta,
            ...(result.meta || {})
        }
    };
}

async function runPhotoStudioCommand(handler, { pluginName, version }) {
    const baseMeta = {
        plugin_name: pluginName,
        version,
        timestamp: new Date().toISOString()
    };

    try {
        const payload = await readJsonFromStdin();
        const result = await handler(payload);
        const normalizedResult = withBaseMeta(result, baseMeta);

        if (normalizedResult.success === false) {
            process.exitCode = 1;
        }

        process.stdout.write(JSON.stringify(normalizedResult));
    } catch (error) {
        process.exitCode = 1;
        process.stdout.write(JSON.stringify(withBaseMeta(buildFailure(error), baseMeta)));
    }
}

module.exports = {
    PhotoStudioError,
    buildFailure,
    buildSuccess,
    runPhotoStudioCommand
};

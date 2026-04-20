const crypto = require('crypto');
const { PhotoStudioError } = require('./runtime');

function collapseWhitespace(value) {
    return value.trim().replace(/\s+/g, ' ');
}

function requireString(value, fieldName) {
    if (typeof value !== 'string') {
        throw new PhotoStudioError('MISSING_REQUIRED_FIELD', `${fieldName} is required.`, {
            field: fieldName
        });
    }

    const normalized = collapseWhitespace(value);
    if (!normalized) {
        throw new PhotoStudioError('MISSING_REQUIRED_FIELD', `${fieldName} is required.`, {
            field: fieldName
        });
    }

    return normalized;
}

function optionalString(value, fieldName) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    if (typeof value !== 'string') {
        throw new PhotoStudioError('INVALID_INPUT', `${fieldName} must be a string or null.`, {
            field: fieldName
        });
    }

    const normalized = collapseWhitespace(value);
    return normalized || null;
}

function requireEnum(value, fieldName, allowedValues) {
    const normalized = requireString(value, fieldName).toLowerCase();
    if (!allowedValues.includes(normalized)) {
        throw new PhotoStudioError('INVALID_INPUT', `${fieldName} must be one of the supported values.`, {
            field: fieldName,
            allowedValues
        });
    }

    return normalized;
}

function optionalDate(value, fieldName) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const normalized = requireString(value, fieldName);
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
        throw new PhotoStudioError('INVALID_INPUT', `${fieldName} must be a valid date string.`, {
            field: fieldName,
            value
        });
    }

    return parsed.toISOString().slice(0, 10);
}

function optionalNumber(value, fieldName) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const normalized = collapseWhitespace(value);
        if (!normalized) {
            return null;
        }

        const parsed = Number(normalized);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    throw new PhotoStudioError('INVALID_INPUT', `${fieldName} must be a valid number.`, {
        field: fieldName,
        value
    });
}

function optionalBoolean(value, fieldName) {
    if (value === null || value === undefined) {
        return false;
    }

    if (typeof value !== 'boolean') {
        throw new PhotoStudioError('INVALID_INPUT', `${fieldName} must be a boolean.`, {
            field: fieldName,
            value
        });
    }

    return value;
}

function optionalObjectArray(value, fieldName) {
    if (value === null || value === undefined) {
        return [];
    }

    if (!Array.isArray(value)) {
        throw new PhotoStudioError('INVALID_INPUT', `${fieldName} must be an array.`, {
            field: fieldName
        });
    }

    value.forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new PhotoStudioError('INVALID_INPUT', `${fieldName} entries must be objects.`, {
                field: fieldName,
                index
            });
        }
    });

    return value;
}

function nowIso() {
    return new Date().toISOString();
}

function generateRecordId(prefix) {
    return `${prefix}_${crypto.randomBytes(4).toString('hex')}`;
}

function normalizeLookup(value) {
    if (value === null || value === undefined) {
        return '';
    }

    return collapseWhitespace(String(value)).toLowerCase();
}

function normalizePhoneValue(value) {
    const normalized = String(value || '').replace(/[^\d+]/g, '');
    if (!normalized) {
        return '';
    }

    if (normalized.startsWith('+')) {
        return `+${normalized.slice(1).replace(/\+/g, '')}`;
    }

    return normalized.replace(/\+/g, '');
}

function normalizeEmailValue(value) {
    return normalizeLookup(value);
}

module.exports = {
    generateRecordId,
    normalizeEmailValue,
    normalizeLookup,
    normalizePhoneValue,
    nowIso,
    optionalBoolean,
    optionalDate,
    optionalNumber,
    optionalObjectArray,
    optionalString,
    requireEnum,
    requireString
};

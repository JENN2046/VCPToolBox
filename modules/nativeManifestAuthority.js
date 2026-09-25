'use strict';

const { isDeepStrictEqual } = require('node:util');

const NATIVE_MANIFEST_UNAVAILABLE = 'VCP_NATIVE_MANIFEST_UNAVAILABLE';
const DIRECT_REFRESH_METADATA_FIELDS = Object.freeze([
    'displayName',
    'description',
    'version',
    'author',
    'capabilities.invocationCommands'
]);

const authorityByRuntimeEntry = new WeakMap();

class NativeManifestAuthorityError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NativeManifestAuthorityError';
        this.code = NATIVE_MANIFEST_UNAVAILABLE;
    }
}

function unavailable(message) {
    return new NativeManifestAuthorityError(message);
}

function clonePrimitive(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return { cloned: true, value };
    }

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw unavailable('Native manifest contains a non-JSON number.');
        }
        return { cloned: true, value };
    }

    if (typeof value !== 'object') {
        throw unavailable(`Native manifest contains unsupported JSON value type: ${typeof value}.`);
    }

    return { cloned: false };
}

function createContainer(source) {
    if (Array.isArray(source)) {
        if (Object.getPrototypeOf(source) !== Array.prototype) {
            throw unavailable('Native manifest contains a non-standard array.');
        }
        return [];
    }

    const prototype = Object.getPrototypeOf(source);
    if (prototype !== Object.prototype && prototype !== null) {
        throw unavailable('Native manifest contains a non-JSON object.');
    }
    return {};
}

function cloneJsonSemanticData(value) {
    const primitive = clonePrimitive(value);
    if (primitive.cloned) return primitive.value;

    const root = createContainer(value);
    const seen = new WeakSet([value]);
    const stack = [{ source: value, target: root }];

    const cloneChild = (child, assign) => {
        const childPrimitive = clonePrimitive(child);
        if (childPrimitive.cloned) {
            assign(childPrimitive.value);
            return;
        }

        if (seen.has(child)) {
            throw unavailable('Native manifest contains a cycle or shared object reference.');
        }

        const childTarget = createContainer(child);
        seen.add(child);
        assign(childTarget);
        stack.push({ source: child, target: childTarget });
    };

    while (stack.length > 0) {
        const { source, target } = stack.pop();

        if (Array.isArray(source)) {
            const keys = Reflect.ownKeys(source).filter(key => key !== 'length');
            if (keys.some(key => typeof key !== 'string') || keys.length !== source.length) {
                throw unavailable('Native manifest array is not valid JSON data.');
            }

            for (let index = 0; index < source.length; index += 1) {
                const key = String(index);
                const descriptor = Object.getOwnPropertyDescriptor(source, key);
                if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
                    throw unavailable('Native manifest array contains an accessor or sparse element.');
                }

                cloneChild(descriptor.value, clonedValue => {
                    target[index] = clonedValue;
                });
            }
            continue;
        }

        for (const key of Reflect.ownKeys(source)) {
            if (typeof key !== 'string') {
                throw unavailable('Native manifest contains a symbol key.');
            }

            const descriptor = Object.getOwnPropertyDescriptor(source, key);
            if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
                throw unavailable('Native manifest contains an accessor or non-enumerable value.');
            }

            cloneChild(descriptor.value, clonedValue => {
                Object.defineProperty(target, key, {
                    value: clonedValue,
                    enumerable: true,
                    configurable: true,
                    writable: true
                });
            });
        }
    }

    return root;
}

function assertManifestObject(manifest) {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        throw unavailable('Native manifest authority must be a JSON object.');
    }
}

function attachNativeManifestAuthority(runtimeEntry, nativeManifest) {
    if (!runtimeEntry || typeof runtimeEntry !== 'object') {
        throw unavailable('Runtime plugin entry is unavailable for native manifest authority.');
    }

    const authority = cloneJsonSemanticData(nativeManifest);
    assertManifestObject(authority);
    authorityByRuntimeEntry.set(runtimeEntry, authority);
    return runtimeEntry;
}

function createRuntimePluginEntry(nativeManifest) {
    const authority = cloneJsonSemanticData(nativeManifest);
    assertManifestObject(authority);

    const runtimeEntry = cloneJsonSemanticData(authority);
    authorityByRuntimeEntry.set(runtimeEntry, authority);
    return runtimeEntry;
}

function getCurrentNativeManifest(runtimeEntry) {
    const authority = authorityByRuntimeEntry.get(runtimeEntry);
    return authority ? cloneJsonSemanticData(authority) : null;
}

function withoutDirectRefreshMetadata(nativeManifest) {
    const projected = cloneJsonSemanticData(nativeManifest);
    assertManifestObject(projected);

    delete projected.displayName;
    delete projected.description;
    delete projected.version;
    delete projected.author;

    if (
        projected.capabilities &&
        typeof projected.capabilities === 'object' &&
        !Array.isArray(projected.capabilities)
    ) {
        delete projected.capabilities.invocationCommands;
    }

    return projected;
}

function hasDirectRuntimeContractChange(currentRuntimeEntry, freshManifest) {
    const currentAuthority = getCurrentNativeManifest(currentRuntimeEntry);
    if (!currentAuthority) {
        throw unavailable('Current runtime plugin entry has no native manifest authority.');
    }

    return !isDeepStrictEqual(
        withoutDirectRefreshMetadata(currentAuthority),
        withoutDirectRefreshMetadata(freshManifest)
    );
}

function setOptionalJsonField(target, key, value) {
    if (value === undefined) {
        delete target[key];
        return;
    }
    target[key] = cloneJsonSemanticData(value);
}

function buildDirectRefreshEffectiveNativeManifest(currentRuntimeEntry, freshManifest) {
    const currentAuthority = getCurrentNativeManifest(currentRuntimeEntry);
    if (!currentAuthority) {
        throw unavailable('Current runtime plugin entry has no native manifest authority.');
    }

    const fresh = cloneJsonSemanticData(freshManifest);
    assertManifestObject(fresh);

    const effective = cloneJsonSemanticData(currentAuthority);
    effective.displayName = fresh.displayName || fresh.name;
    effective.description = fresh.description || '';
    setOptionalJsonField(effective, 'version', fresh.version);
    setOptionalJsonField(effective, 'author', fresh.author);

    const currentCapabilities = currentAuthority.capabilities &&
        typeof currentAuthority.capabilities === 'object' &&
        !Array.isArray(currentAuthority.capabilities)
        ? cloneJsonSemanticData(currentAuthority.capabilities)
        : {};
    const invocationCommands = fresh.capabilities?.invocationCommands ||
        currentAuthority.capabilities?.invocationCommands;
    setOptionalJsonField(currentCapabilities, 'invocationCommands', invocationCommands);
    effective.capabilities = currentCapabilities;

    return effective;
}

module.exports = {
    DIRECT_REFRESH_METADATA_FIELDS,
    NATIVE_MANIFEST_UNAVAILABLE,
    NativeManifestAuthorityError,
    attachNativeManifestAuthority,
    buildDirectRefreshEffectiveNativeManifest,
    cloneJsonSemanticData,
    createRuntimePluginEntry,
    getCurrentNativeManifest,
    hasDirectRuntimeContractChange
};

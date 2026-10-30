'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Selected by the host, never by the external manifest or its config.env.
// Values are explicit literals, not names to look up in the global environment.
function readExternalPluginHostConfig(filename, manifest) {
    if (!filename) return {};
    try {
        if (!path.isAbsolute(filename) || fs.statSync(filename).size > 65536) throw Error();
        const document = JSON.parse(fs.readFileSync(filename, 'utf8'));
        if (!document || Object.keys(document).join(',') !== 'bindings' || !Array.isArray(document.bindings)) throw Error();
        const matches = document.bindings.filter(binding => {
            if (!binding || typeof binding !== 'object' || Array.isArray(binding)
                || Object.keys(binding).sort().join(',') !== 'config,pluginName,sourceDirectory'
                || typeof binding.pluginName !== 'string' || !binding.pluginName
                || typeof binding.sourceDirectory !== 'string' || !path.isAbsolute(binding.sourceDirectory)) throw Error();
            return binding.pluginName === manifest.name
                && fs.realpathSync(binding.sourceDirectory) === fs.realpathSync(manifest.pluginRoot);
        });
        if (matches.length > 1) throw Error();
        if (!matches.length) return {};
        const values = matches[0].config;
        if (!values || typeof values !== 'object' || Array.isArray(values)) throw Error();
        const config = Object.create(null);
        for (const [key, value] of Object.entries(values)) {
            if (['__proto__', 'constructor', 'prototype'].includes(key)
                || !Object.hasOwn(manifest.configSchema || {}, key)) throw Error();
            const schema = manifest.configSchema[key];
            const type = typeof schema === 'object' && schema ? schema.type : schema;
            if (type === 'string' ? typeof value !== 'string'
                : type === 'integer' ? !Number.isSafeInteger(value)
                : type === 'boolean' ? typeof value !== 'boolean' : true) throw Error();
            config[key] = value;
        }
        return config;
    } catch {
        // Do not include file contents, paths, parser exceptions or supplied values.
        throw new Error('EXTERNAL_PLUGIN_HOST_CONFIG_INVALID');
    }
}
module.exports = { readExternalPluginHostConfig };

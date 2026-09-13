'use strict';
const d = require('./durable');
const {withSourceMutation} = require('./writer');
function markerPath(root) {
    return root + '.recovery-coordination.json';
}
function installMarker(sourceRoot, journalRoot) {
    const file = markerPath(sourceRoot);
    const value = {
        protocol: 'VCP_TDB_SOURCE_LEASE_V1',
        sourceRoot,
        journalRoot,
        module: require.resolve('./writer')
    };
    if (d.fs.existsSync(file)) {
        if (d.digest(JSON.parse(d.read(d.path.dirname(file), file))) !== d.digest(value))
            d.fail('WRITER_MARKER_CONFLICT');
    } else
        d.write(d.path.dirname(file), file, d.canonical(value));
}
async function coordinate(sourceRoot, libraries, fn) {
    const file = markerPath(sourceRoot);
    if (!d.fs.existsSync(file))
        return fn();
    const m = JSON.parse(d.read(d.path.dirname(file), file));
    if (m.protocol !== 'VCP_TDB_SOURCE_LEASE_V1' || m.sourceRoot !== sourceRoot)
        d.fail('WRITER_MARKER_INVALID');
    const names = [...new Set(libraries)].sort();
    if (!names.length)
        d.fail('WRITER_SCOPE_REQUIRED');
    async function next(i) {
        if (i === names.length)
            return fn();
        return withSourceMutation({
            sourceRoot,
            journalRoot: m.journalRoot,
            library: d.name(names[i])
        }, () => next(i + 1));
    }
    return next(0);
}
module.exports = {
    installMarker,
    coordinate
};

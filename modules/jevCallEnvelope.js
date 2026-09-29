'use strict';

// Shared by registration-time sizing and runtime final-call enforcement.
const SEMANTIC_ENVELOPE_MAX_BYTES = 16 * 1024;

function buildExpandedCallEnvelope(name, args, jevMeta, inheritedMeta = {}) {
    return {
        name,
        args,
        archery: inheritedMeta.archery === true,
        archeryNoReply: inheritedMeta.archeryNoReply === true,
        markHistory: inheritedMeta.markHistory === true,
        river: inheritedMeta.river || null,
        vref: inheritedMeta.vref || null,
        jev: jevMeta
    };
}

module.exports = { SEMANTIC_ENVELOPE_MAX_BYTES, buildExpandedCallEnvelope };

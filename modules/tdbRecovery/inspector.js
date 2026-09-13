'use strict';
const d = require('./durable');
const text = require('./text-index');
function inspectLibrary({store, library, generation = null, maxBytes}) {
    d.name(library);
    const main = d.contained(store, d.path.join(store, library + '.tdb'), { missing: true });
    const result = text.inspect(store, main, { maxBytes });
    const damage = !result.main_exists ? 'missing_native' : !result.text_exists && !result.meta_exists ? 'missing_both' : !result.text_exists ? 'missing_text' : !result.meta_exists ? 'missing_meta' : !result.valid ? result.error === 'INSPECTION_BUDGET_EXCEEDED' ? 'inspection_budget' : 'invalid_text' : 'health_not_proven';
    return {
        library,
        damage_type: damage,
        confidence: damage === 'health_not_proven' ? 'STRUCTURAL_ONLY' : 'HIGH',
        evidence: {
            main: result.main_exists,
            text: result.text_exists,
            meta: result.meta_exists,
            structurally_valid: result.valid,
            error: result.error || null
        },
        automatic_eligible: [
            'missing_text',
            'missing_meta',
            'missing_both',
            'invalid_text'
        ].includes(damage),
        observed_generation: generation
    };
}
module.exports = { inspectLibrary };

const {
    CUSTOMER_SOURCES,
    CUSTOMER_TYPES
} = require('./constants');
const { buildFailure, buildSuccess, PhotoStudioError } = require('./runtime');
const { readCollection, withStoreLock, writeCollection } = require('./store');
const {
    generateRecordId,
    normalizeEmailValue,
    normalizeLookup,
    normalizePhoneValue,
    nowIso,
    optionalString,
    requireEnum,
    requireString
} = require('./utils');

function buildCustomerSummary(record, isNew) {
    return {
        customer_id: record.customer_id,
        customer_name: record.customer_name,
        customer_type: record.customer_type,
        is_new: isNew,
        created_at: record.created_at
    };
}

function hasCustomerConflict(existingRecord, candidate) {
    if (existingRecord.normalized_customer_name !== candidate.normalized_customer_name) {
        return false;
    }

    const phoneMatch = candidate.normalized_contact_phone
        && existingRecord.normalized_contact_phone
        && existingRecord.normalized_contact_phone === candidate.normalized_contact_phone;
    const wechatMatch = candidate.normalized_contact_wechat
        && existingRecord.normalized_contact_wechat
        && existingRecord.normalized_contact_wechat === candidate.normalized_contact_wechat;

    return Boolean(phoneMatch || wechatMatch);
}

function buildCustomerRecord(input) {
    const customerName = requireString(input.customer_name, 'customer_name');
    const customerType = requireEnum(input.customer_type, 'customer_type', CUSTOMER_TYPES);
    const contactPhone = optionalString(input.contact_phone, 'contact_phone');
    const contactWechat = optionalString(input.contact_wechat, 'contact_wechat');
    const contactEmail = optionalString(input.contact_email, 'contact_email');
    const source = input.source === null || input.source === undefined || input.source === ''
        ? null
        : requireEnum(input.source, 'source', CUSTOMER_SOURCES);
    const remark = optionalString(input.remark, 'remark');
    const timestamp = nowIso();

    return {
        customer_id: generateRecordId('cust'),
        customer_name: customerName,
        customer_type: customerType,
        contact_phone: contactPhone,
        contact_wechat: contactWechat,
        contact_email: contactEmail,
        source,
        remark,
        created_at: timestamp,
        updated_at: timestamp,
        normalized_customer_name: normalizeLookup(customerName),
        normalized_contact_phone: normalizePhoneValue(contactPhone),
        normalized_contact_wechat: normalizeLookup(contactWechat),
        normalized_contact_email: normalizeEmailValue(contactEmail)
    };
}

async function createCustomerRecord(input) {
    const candidate = buildCustomerRecord(input);

    return withStoreLock(async ({ dataDir }) => {
        const customerCollection = await readCollection('customers', dataDir);
        const duplicate = customerCollection.records.find((record) => hasCustomerConflict(record, candidate));

        if (duplicate) {
            return buildFailure(
                new PhotoStudioError('CONFLICT', 'A customer record with the same name and contact already exists.', {
                    field: 'customer_name'
                }),
                {
                    entity: 'customer',
                    data_dir: dataDir
                },
                buildCustomerSummary(duplicate, false)
            );
        }

        customerCollection.records.push(candidate);
        await writeCollection('customers', customerCollection.records, dataDir);

        return buildSuccess(buildCustomerSummary(candidate, true), {
            entity: 'customer',
            data_dir: dataDir
        });
    });
}

module.exports = {
    createCustomerRecord
};

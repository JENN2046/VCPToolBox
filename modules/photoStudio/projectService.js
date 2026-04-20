const {
    DEFAULT_PROJECT_STATUS,
    PROJECT_TYPES
} = require('./constants');
const { buildFailure, buildSuccess, PhotoStudioError } = require('./runtime');
const { readCollection, withStoreLock, writeCollection } = require('./store');
const {
    generateRecordId,
    normalizeLookup,
    nowIso,
    optionalDate,
    optionalNumber,
    optionalString,
    requireEnum,
    requireString
} = require('./utils');

function buildProjectSummary(record, isNew) {
    return {
        project_id: record.project_id,
        customer_id: record.customer_id,
        project_name: record.project_name,
        project_type: record.project_type,
        status: record.status,
        is_new: isNew,
        created_at: record.created_at
    };
}

function buildProjectRecord(input) {
    const customerId = requireString(input.customer_id, 'customer_id');
    const projectName = requireString(input.project_name, 'project_name');
    const projectType = requireEnum(input.project_type, 'project_type', PROJECT_TYPES);
    const startDate = optionalDate(input.start_date, 'start_date');
    const dueDate = optionalDate(input.due_date, 'due_date');
    const budget = optionalNumber(input.budget, 'budget');
    const remark = optionalString(input.remark, 'remark');
    const timestamp = nowIso();

    return {
        project_id: generateRecordId('proj'),
        customer_id: customerId,
        project_name: projectName,
        project_type: projectType,
        start_date: startDate,
        due_date: dueDate,
        budget,
        remark,
        status: DEFAULT_PROJECT_STATUS,
        created_at: timestamp,
        updated_at: timestamp,
        normalized_project_name: normalizeLookup(projectName)
    };
}

async function createProjectRecord(input) {
    const candidate = buildProjectRecord(input);

    return withStoreLock(async ({ dataDir }) => {
        const customerCollection = await readCollection('customers', dataDir);
        const customer = customerCollection.records.find((record) => record.customer_id === candidate.customer_id);

        if (!customer) {
            throw new PhotoStudioError('RESOURCE_NOT_FOUND', 'customer_id does not reference an existing customer.', {
                field: 'customer_id',
                customer_id: candidate.customer_id
            });
        }

        const projectCollection = await readCollection('projects', dataDir);
        const duplicate = projectCollection.records.find((record) =>
            record.customer_id === candidate.customer_id
            && record.normalized_project_name === candidate.normalized_project_name
        );

        if (duplicate) {
            return buildFailure(
                new PhotoStudioError('CONFLICT', 'A project with the same name already exists for this customer.', {
                    field: 'project_name'
                }),
                {
                    entity: 'project',
                    customer_id: candidate.customer_id,
                    data_dir: dataDir
                },
                buildProjectSummary(duplicate, false)
            );
        }

        projectCollection.records.push(candidate);
        await writeCollection('projects', projectCollection.records, dataDir);

        return buildSuccess(buildProjectSummary(candidate, true), {
            entity: 'project',
            customer_id: candidate.customer_id,
            data_dir: dataDir
        });
    });
}

module.exports = {
    createProjectRecord
};

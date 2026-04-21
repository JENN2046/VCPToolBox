const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs').promises;
const path = require('path');
const {
    assertSuccessEnvelope,
    cleanupWorkspace,
    createTempWorkspace,
    runPlugin
} = require('./helpers');

const FIELD_AUDIT_PLUGIN = 'Plugin/PhotoStudioFieldAudit/PhotoStudioFieldAudit.js';

async function writeStore(dataDir, fileName, records) {
    const payload = {
        version: 1,
        updated_at: '2026-04-21T00:00:00.000Z',
        records
    };

    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(path.join(dataDir, fileName), JSON.stringify(payload, null, 2), 'utf8');
}

test('check_missing_project_fields audits missing required and recommended fields across projects', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    await writeStore(workspace.dataDir, 'customers.json', [
        {
            customer_id: 'cust_10000001',
            customer_name: 'Northlight Studio'
        }
    ]);

    await writeStore(workspace.dataDir, 'projects.json', [
        {
            project_id: 'proj_20000001',
            customer_id: 'cust_10000001',
            project_name: 'May Wedding Story',
            project_type: 'wedding',
            start_date: '2026-05-01',
            due_date: '2026-05-10',
            budget: 28000,
            status: 'reviewing',
            created_at: '2026-04-21T08:00:00.000Z',
            updated_at: '2026-04-21T08:00:00.000Z',
            normalized_project_name: 'may wedding story'
        },
        {
            project_id: 'proj_20000002',
            customer_id: 'cust_missing',
            project_name: 'Incomplete Commercial',
            project_type: 'commercial',
            start_date: null,
            due_date: '',
            budget: null,
            status: 'quoted',
            created_at: '2026-04-21T08:00:00.000Z',
            updated_at: '2026-04-21T08:00:00.000Z',
            normalized_project_name: 'incomplete commercial'
        },
        {
            project_id: 'proj_20000003',
            customer_id: 'cust_10000001',
            project_name: '',
            project_type: null,
            start_date: '2026-05-02',
            due_date: '2026-05-12',
            budget: 8600,
            status: 'inquiry',
            created_at: '2026-04-21T08:00:00.000Z',
            updated_at: '2026-04-21T08:00:00.000Z',
            normalized_project_name: ''
        }
    ]);

    const result = await runPlugin(FIELD_AUDIT_PLUGIN, {
        include_recommended_fields: true
    }, env);

    assertSuccessEnvelope(result);
    assert.equal(result.json.data.audit_label, 'missing_project_fields');
    assert.equal(result.json.data.audit_mode, 'all_projects');
    assert.equal(result.json.data.summary.total_projects_checked, 3);
    assert.equal(result.json.data.summary.projects_with_issues, 2);
    assert.equal(result.json.data.summary.required_field_gap_count, 3);
    assert.equal(result.json.data.summary.recommended_field_gap_count, 3);
    assert.equal(result.json.data.summary.invalid_customer_reference_count, 1);
    assert.equal(result.json.meta.degraded, true);
    assert.equal(result.json.data.project_rows.length, 2);
    assert.equal(result.json.data.project_rows[0].project_name, 'Incomplete Commercial');
    assert.deepEqual(result.json.data.project_rows[0].missing_required_fields, []);
    assert.deepEqual(result.json.data.project_rows[0].missing_recommended_fields, ['start_date', 'due_date', 'budget']);
    assert.deepEqual(result.json.data.project_rows[0].invalid_reference_fields, ['customer_id']);
    assert.equal(result.json.data.project_rows[1].project_name, '[未命名项目]');
    assert.deepEqual(result.json.data.project_rows[1].missing_required_fields, ['project_name', 'project_type', 'normalized_project_name']);
    assert.match(result.json.data.audit_text, /Photo Studio project field audit/);
    assert.match(result.json.data.audit_text, /Incomplete Commercial/);
});

test('check_missing_project_fields can target a single project and rejects missing project_id references', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    await writeStore(workspace.dataDir, 'customers.json', []);
    await writeStore(workspace.dataDir, 'projects.json', [
        {
            project_id: 'proj_20000004',
            customer_id: 'cust_missing',
            project_name: 'One-off Audit',
            project_type: 'event',
            status: 'editing',
            created_at: '2026-04-21T08:00:00.000Z',
            updated_at: '2026-04-21T08:00:00.000Z',
            normalized_project_name: 'one-off audit'
        }
    ]);

    const singleResult = await runPlugin(FIELD_AUDIT_PLUGIN, {
        project_id: 'proj_20000004',
        include_recommended_fields: false
    }, env);

    assertSuccessEnvelope(singleResult);
    assert.equal(singleResult.json.data.audit_mode, 'single_project');
    assert.equal(singleResult.json.data.checked_project_id, 'proj_20000004');
    assert.equal(singleResult.json.data.project_rows.length, 1);
    assert.equal(singleResult.json.data.project_rows[0].missing_recommended_fields.length, 0);
    assert.equal(singleResult.json.data.project_rows[0].invalid_reference_fields[0], 'customer_id');

    const missingResult = await runPlugin(FIELD_AUDIT_PLUGIN, {
        project_id: 'proj_missing'
    }, env);

    assert.equal(missingResult.code, 1);
    assert.equal(missingResult.json.success, false);
    assert.equal(missingResult.json.error.code, 'RESOURCE_NOT_FOUND');
    assert.equal(missingResult.json.error.field, 'project_id');
});

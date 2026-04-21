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

const DIGEST_PLUGIN = 'Plugin/PhotoStudioWeeklyProjectDigest/PhotoStudioWeeklyProjectDigest.js';

async function writeStore(dataDir, fileName, records) {
    const payload = {
        version: 1,
        updated_at: '2026-04-21T00:00:00.000Z',
        records
    };

    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(path.join(dataDir, fileName), JSON.stringify(payload, null, 2), 'utf8');
}

test('generate_weekly_project_digest summarizes project activity and due dates', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    await writeStore(workspace.dataDir, 'customers.json', [
        {
            version: 1,
            customer_id: 'cust_10000001',
            customer_name: 'Northlight Studio'
        },
        {
            version: 1,
            customer_id: 'cust_10000002',
            customer_name: 'Morning Light'
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
            remark: null,
            status: 'reviewing',
            created_at: '2026-04-21T08:00:00.000Z',
            updated_at: '2026-04-21T08:00:00.000Z',
            normalized_project_name: 'may wedding story'
        },
        {
            project_id: 'proj_20000002',
            customer_id: 'cust_10000002',
            project_name: 'Studio Portraits',
            project_type: 'portrait',
            start_date: '2026-04-20',
            due_date: '2026-05-01',
            budget: 9600,
            remark: null,
            status: 'shooting',
            created_at: '2026-04-21T08:00:00.000Z',
            updated_at: '2026-04-21T08:00:00.000Z',
            normalized_project_name: 'studio portraits'
        },
        {
            project_id: 'proj_20000003',
            customer_id: 'cust_10000001',
            project_name: 'Commercial Retouch',
            project_type: 'commercial',
            start_date: '2026-04-12',
            due_date: '2026-04-28',
            budget: 12000,
            remark: null,
            status: 'completed',
            created_at: '2026-04-21T08:00:00.000Z',
            updated_at: '2026-04-21T08:00:00.000Z',
            normalized_project_name: 'commercial retouch'
        }
    ]);

    await writeStore(workspace.dataDir, 'status_log.json', [
        {
            status_log_id: 'log_30000001',
            project_id: 'proj_20000001',
            previous_status: 'editing',
            new_status: 'reviewing',
            transition_time: '2026-05-04T10:00:00.000Z',
            remark: 'Sent for final review'
        },
        {
            status_log_id: 'log_30000002',
            project_id: 'proj_20000002',
            previous_status: 'editing',
            new_status: 'shooting',
            transition_time: '2026-05-03T10:00:00.000Z',
            remark: 'Entered studio'
        },
        {
            status_log_id: 'log_30000003',
            project_id: 'proj_20000003',
            previous_status: 'reviewing',
            new_status: 'completed',
            transition_time: '2026-04-25T10:00:00.000Z',
            remark: 'Client approved'
        }
    ]);

    const result = await runPlugin(DIGEST_PLUGIN, {
        reference_date: '2026-05-05',
        lookback_days: 7,
        upcoming_days: 7
    }, env);

    assertSuccessEnvelope(result);
    assert.equal(result.json.data.reference_date, '2026-05-05');
    assert.equal(result.json.data.summary.total_projects, 3);
    assert.equal(result.json.data.summary.active_projects, 2);
    assert.equal(result.json.data.summary.closed_projects, 1);
    assert.equal(result.json.data.overdue_projects.length, 1);
    assert.equal(result.json.data.upcoming_due_projects.length, 1);
    assert.equal(result.json.data.recent_transitions.length, 2);
    assert.equal(result.json.meta.degraded, false);
    assert.match(result.json.data.digest_text, /Weekly photo_studio digest/);
    assert.match(result.json.data.digest_text, /May Wedding Story/);
    assert.match(result.json.data.digest_text, /Studio Portraits/);
});

test('generate_weekly_project_digest flags missing project references and due dates explicitly', async (t) => {
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
            project_name: 'Incomplete Project',
            project_type: 'event',
            start_date: '2026-05-01',
            due_date: null,
            budget: 4000,
            remark: null,
            status: 'reviewing',
            created_at: '2026-04-21T08:00:00.000Z',
            updated_at: '2026-04-21T08:00:00.000Z',
            normalized_project_name: 'incomplete project'
        }
    ]);
    await writeStore(workspace.dataDir, 'status_log.json', []);

    const result = await runPlugin(DIGEST_PLUGIN, {
        reference_date: '2026-05-05'
    }, env);

    assertSuccessEnvelope(result);
    assert.equal(result.json.meta.degraded, true);
    assert.equal(result.json.data.data_quality.missing_due_date_count, 1);
    assert.equal(result.json.data.data_quality.missing_customer_count, 1);
    assert.equal(result.json.data.data_quality.missing_project_reference_count, 0);
    assert.equal(result.json.data.project_rows[0].customer_name, '[客户姓名]');
    assert.equal(result.json.data.project_rows[0].attention_state, 'missing_due_date');
});

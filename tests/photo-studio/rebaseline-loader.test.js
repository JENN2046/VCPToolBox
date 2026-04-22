const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('photo_studio rebaseline modern registry points to plugin.json contracts', async () => {
  const registryPath = path.join(__dirname, '..', '..', 'plugins', 'registry.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  const pluginNames = registry.plugins.map(plugin => plugin.name).sort();

  assert.deepEqual(pluginNames, [
    'archive_project_assets',
    'check_missing_project_fields',
    'create_customer_record',
    'create_delivery_tasks',
    'create_followup_reminder',
    'create_project_record',
    'create_project_tasks',
    'create_selection_notice',
    'generate_client_reply_draft',
    'generate_weekly_project_digest',
    'sync_calendar_event',
    'sync_to_external_sheet_or_notion',
    'update_project_status'
  ]);

  registry.plugins.forEach((plugin) => {
    const pluginJsonPath = path.join(path.dirname(registryPath), plugin.path, 'plugin.json');
    const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));

    assert.equal(plugin.enabled, true);
    assert.equal(plugin.branch, 'staging/current');
    assert.equal(pluginJson.name, plugin.name);
    assert.equal(pluginJson.runtime.entry_point.script, 'src/index.js');
    assert.match(pluginJsonPath, /\\plugins\\custom\\/);
  });
});

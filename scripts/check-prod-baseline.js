#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function runGit(args) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function readText(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function listTrackedFiles() {
  const output = runGit(['ls-files', '-z']);
  return output.split('\0').filter(Boolean);
}

function hasLine(text, pattern) {
  return pattern.test(text);
}

const trackedFiles = listTrackedFiles();
const denyRules = [
  { label: 'actual config.env', pattern: /(^|\/)config\.env$/ },
  { label: 'env files', pattern: /(^|\/)\.env(\.|$)|(^|\/)config\.env\.local$/ },
  { label: 'chat/debug logs', pattern: /(^|\/)DebugLog\/|(^|\/)logs\/|\.log$/ },
  { label: 'runtime sqlite/db files', pattern: /\.(sqlite|sqlite-shm|sqlite-wal|db)$/ },
  { label: 'runtime vector stores', pattern: /(^|\/)VectorStore\/|^data\/(candidate-cache|chat-history-index|memory-vectors)\.json$/ },
  { label: 'plugin state directories', pattern: /^Plugin\/[^/]+\/state\// },
  { label: 'runtime auth code', pattern: /^Plugin\/UserAuth\/code\.bin$/ },
  { label: 'plugin generated caches', pattern: /^Plugin\/ArtistMatcher\/artist_cache\.json$/ },
];

const allowedEnvTemplatePattern = /(^|\/)\.env\.(example|sample|template)$/;

function findDenyRule(file) {
  const normalized = file.replace(/\\/g, '/');
  if (allowedEnvTemplatePattern.test(normalized)) {
    return null;
  }
  return denyRules.find(rule => rule.pattern.test(normalized)) || null;
}

const violations = [];
for (const file of trackedFiles) {
  const rule = findDenyRule(file);
  if (rule) {
    violations.push(`${rule.label}: ${file}`);
  }
}

const requiredChecks = [];

const envExample = readText('config.env.example');
requiredChecks.push({
  label: 'config.env.example keeps DebugMode=false',
  ok: hasLine(envExample, /^DebugMode=false$/m),
});
requiredChecks.push({
  label: 'config.env.example keeps CHAT_LOG_ENABLED=false',
  ok: hasLine(envExample, /^CHAT_LOG_ENABLED=false$/m),
});
requiredChecks.push({
  label: 'config.env.example does not enable AI image agent route',
  ok: !hasLine(envExample, /^ENABLE_AI_IMAGE_AGENTS_ROUTE\s*=\s*true$/mi),
});
requiredChecks.push({
  label: 'config.env.example does not enable AI image real execution',
  ok: !hasLine(envExample, /^ENABLE_AI_IMAGE_REAL_EXECUTION\s*=\s*true$/mi),
});
requiredChecks.push({
  label: 'config.env.example does not enable AI image runtime-to-review trial routes',
  ok: !hasLine(envExample, /^ENABLE_AI_IMAGE_RUNTIME_TO_REVIEW_TRIAL_ROUTES\s*=\s*true$/mi),
});
requiredChecks.push({
  label: 'config.env.example does not enable pipeline execution',
  ok: !hasLine(envExample, /^AIGENT_PIPELINE_ALLOW_EXECUTION\s*=\s*true$/mi),
});

const server = readText('server.js');
requiredChecks.push({
  label: 'AI image admin route is gated by ENABLE_AI_IMAGE_AGENTS_ROUTE',
  ok: server.includes("process.env.ENABLE_AI_IMAGE_AGENTS_ROUTE === 'true'"),
});
requiredChecks.push({
  label: 'AI image real execution is gated by ENABLE_AI_IMAGE_REAL_EXECUTION',
  ok: server.includes("process.env.ENABLE_AI_IMAGE_REAL_EXECUTION === 'true'"),
});
requiredChecks.push({
  label: 'AI image runtime-to-review trial routes are gated by ENABLE_AI_IMAGE_RUNTIME_TO_REVIEW_TRIAL_ROUTES',
  ok: server.includes("process.env.ENABLE_AI_IMAGE_RUNTIME_TO_REVIEW_TRIAL_ROUTES === 'true'"),
});

const safetyGate = readText('modules/pipelineSafetyGate.js');
requiredChecks.push({
  label: 'pipeline safety gate requires AIGENT_PIPELINE_ALLOW_EXECUTION',
  ok: safetyGate.includes('AIGENT_PIPELINE_ALLOW_EXECUTION'),
});

const pluginRuntime = readText('Plugin.js');
requiredChecks.push({
  label: 'Plugin runtime debug logs use env key lists instead of env values',
  ok: pluginRuntime.includes('function formatRuntimeEnvDebugKeyList')
    && pluginRuntime.includes('formatRuntimeEnvDebugKeyList(finalEnv)')
    && !pluginRuntime.includes('JSON.stringify(finalEnv'),
});
requiredChecks.push({
  label: 'Plugin runtime debug logs redact sensitive env keys',
  ok: pluginRuntime.includes('isPluginRuntimeEnvKeyDenied(key)')
    && pluginRuntime.includes('redactedCount')
    && pluginRuntime.includes('sensitive keys')
    && pluginRuntime.includes('Core async plugin')
    && pluginRuntime.includes('External async plugin'),
});
requiredChecks.push({
  label: 'Plugin runtime duplicate manifests warn and skip without reordering',
  ok: pluginRuntime.includes('_warnDuplicateLocalPluginSkipped')
    && pluginRuntime.includes('_buildRuntimeDuplicateDescriptor')
    && pluginRuntime.includes('duplicate_plugin_name')
    && (pluginRuntime.match(/this\._warnDuplicateLocalPluginSkipped\(manifest, this\.plugins\.get\(manifest\.name\)\);\s+continue;/g) || []).length >= 2,
});
requiredChecks.push({
  label: 'Plugin diagnostic output scrubs secrets and operator paths',
  ok: pluginRuntime.includes('PLUGIN_DIAGNOSTIC_SECRET_PATTERNS')
    && pluginRuntime.includes('function scrubPluginDiagnosticText')
    && pluginRuntime.includes('function scrubPluginDiagnosticSnippet')
    && pluginRuntime.includes('[redacted]')
    && pluginRuntime.includes('[path]')
    && pluginRuntime.includes('scrubPluginDiagnosticText(errorOutput.trim())')
    && pluginRuntime.includes('scrubPluginDiagnosticSnippet(outputBuffer.trim(), 200)'),
});

const pluginRuntimeEnvTests = readText('tests/plugin-external-runtime-env-sandbox.test.js');
requiredChecks.push({
  label: 'Plugin runtime debug redaction has targeted test coverage',
  ok: pluginRuntimeEnvTests.includes('core async plugin debug log never prints runtime env secret values')
    && pluginRuntimeEnvTests.includes('Core async plugin CoreAsyncRuntimeEnvFixture runtime env keys:')
    && pluginRuntimeEnvTests.includes('Final ENV')
    && pluginRuntimeEnvTests.includes('redacted \\d+ sensitive keys'),
});
requiredChecks.push({
  label: 'Plugin diagnostic output tests cover stdio and static secret/path scrubbing',
  ok: pluginRuntimeEnvTests.includes('stdio plugin diagnostic errors and debug logs scrub secrets and paths')
    && pluginRuntimeEnvTests.includes('stdio plugin startup errors scrub secrets and paths')
    && pluginRuntimeEnvTests.includes('static plugin stderr diagnostics scrub secrets and paths')
    && pluginRuntimeEnvTests.includes('static plugin startup errors scrub secrets and paths')
    && pluginRuntimeEnvTests.includes('stdout-secret')
    && pluginRuntimeEnvTests.includes('stderr-secret')
    && pluginRuntimeEnvTests.includes('static-secret')
    && pluginRuntimeEnvTests.includes('redacted'),
});

const pluginExternalDirsTests = readText('tests/plugin-external-dirs.test.js');
requiredChecks.push({
  label: 'Plugin runtime duplicate diagnostics tests cover path-safe root identity and order',
  ok: pluginExternalDirsTests.includes('duplicate runtime warning is path-safe and includes root identity')
    && pluginExternalDirsTests.includes('discovers duplicate legacy plugin manifests in resolver order')
    && pluginExternalDirsTests.includes('duplicate_plugin_name')
    && pluginExternalDirsTests.includes('assert.equal(logText.includes(path.resolve(root)), false)')
    && pluginExternalDirsTests.includes('snapshot.legacyLoadRoots'),
});

const externalAllowPolicy = readText('modules/externalPluginAllowPolicy.js');
const externalAllowPolicyTests = readText('tests/externalPluginAllowPolicy.test.js');
requiredChecks.push({
  label: 'external plugin allow policy matches on fresh realpaths',
  ok: externalAllowPolicy.includes('function resolveFreshRealPath')
    && externalAllowPolicy.includes('baseRealPath = resolveFreshRealPath(classification.basePath, options)')
    && externalAllowPolicy.includes('realSourceDirectory: resolveFreshRealPath(getEntrySourceDirectory(entry), options)')
    && externalAllowPolicy.includes('isPathInsideOrEqual(item.realSourceDirectory, baseRealPath, options)')
    && externalAllowPolicy.includes('realSourceDirectory: realSourceDirectory || resolveFreshRealPath'),
});
requiredChecks.push({
  label: 'external plugin allow policy tests cover realpath escape and match evidence',
  ok: externalAllowPolicyTests.includes('uses fresh realpath and blocks symlink escape')
    && externalAllowPolicyTests.includes('returns matched source and base realpaths')
    && externalAllowPolicyTests.includes('fs.symlinkSync')
    && externalAllowPolicyTests.includes('fs.realpathSync(escapedPluginPath)')
    && externalAllowPolicyTests.includes('fs.realpathSync(reviewedSource)'),
});

const adminPluginsRoute = readText('routes/admin/plugins.js');
const adminPluginTargetTests = readText('tests/admin-plugin-command-description-target.test.js');
const adminConfigRoute = readText('routes/admin/config.js');
const adminConfigRouteTests = readText('tests/toolApprovalConfigRoute.test.js');
requiredChecks.push({
  label: 'Admin plugin config.env status redacts external and symlink metadata',
  ok: adminPluginsRoute.includes('function createDeferredConfigEnvStatus')
    && adminPluginsRoute.includes('function shouldDeferConfigEnvStatus')
    && adminPluginsRoute.includes("createDeferredConfigEnvStatus('external_config_deferred')")
    && adminPluginsRoute.includes('fs.lstat(configPath)')
    && adminPluginsRoute.includes("status: 'config_env_symlink_unsupported'")
    && adminPluginsRoute.includes('delete clone.pluginSpecificEnvConfig')
    && adminPluginsRoute.includes('delete clone.configEnvContent'),
});
requiredChecks.push({
  label: 'Admin plugin config.env metadata tests prevent path and stat leaks',
  ok: adminPluginTargetTests.includes('plugin list redacts external config.env status without stat metadata')
    && adminPluginTargetTests.includes('external config.env should not be statted')
    && adminPluginTargetTests.includes('external config.env should not be lstatted')
    && adminPluginTargetTests.includes('config_env_symlink_unsupported')
    && adminPluginTargetTests.includes('assertNoAbsolutePathLeak')
    && adminPluginTargetTests.includes("Object.prototype.hasOwnProperty.call(externalRecord.configEnvStatus, 'size')")
    && adminPluginTargetTests.includes("Object.prototype.hasOwnProperty.call(externalRecord.configEnvStatus, 'updatedAt')"),
});

const pluginApiTypes = readText('AdminPanel-Vue/src/types/api.plugin.ts');
const pluginApiClient = readText('AdminPanel-Vue/src/api/plugin.ts');
const appRouteManifest = readText('AdminPanel-Vue/src/app/routes/manifest.ts');
const recentVisitsComposable = readText('AdminPanel-Vue/src/composables/useRecentVisits.ts');
const commandPaletteUtils = readText('AdminPanel-Vue/src/utils/commandPalette.ts');
const pluginHubState = readText('AdminPanel-Vue/src/features/plugins-hub/derivePluginHubState.ts');
const pluginsHubView = readText('AdminPanel-Vue/src/views/PluginsHub.vue');
const pluginConfigView = readText('AdminPanel-Vue/src/views/PluginConfig.vue');
const pluginConfigStore = readText('AdminPanel-Vue/src/stores/pluginConfig.ts');
const pluginHubStateTests = readText('AdminPanel-Vue/tests/features/plugins-hub/derivePluginHubState.test.ts');
const pluginApiTests = readText('AdminPanel-Vue/tests/api/plugin.test.ts');
const pluginConfigStoreTests = readText('AdminPanel-Vue/tests/stores/pluginConfig.test.ts');
const recentVisitsTests = readText('AdminPanel-Vue/tests/composables/useRecentVisits.test.ts');
const commandPaletteTests = readText('AdminPanel-Vue/tests/utils/commandPalette.test.ts');
requiredChecks.push({
  label: 'Admin plugin hub models explicit external runtime trust metadata',
  ok: pluginApiTypes.includes('export interface PluginRuntimeTrust')
    && pluginApiTypes.includes('environmentSandbox?: boolean | null')
    && pluginApiTypes.includes('processSandbox?: boolean | null')
    && pluginApiTypes.includes('fileSystemSandbox?: boolean | null')
    && pluginApiTypes.includes('untrustedSandbox?: boolean')
    && pluginApiTypes.includes('warningCode?: string')
    && pluginApiTypes.includes('runtimeTrust?: PluginRuntimeTrust'),
});
requiredChecks.push({
  label: 'Admin plugin writes carry explicit root/source target criteria',
  ok: pluginApiTypes.includes('pluginRootId?: string')
    && pluginApiClient.includes('export interface PluginTargetCriteria')
    && pluginApiClient.includes('function withTargetCriteria')
    && pluginApiClient.includes('body: withTargetCriteria({ content }, targetCriteria)')
    && pluginApiClient.includes('body: withTargetCriteria({ enable }, targetCriteria)')
    && pluginApiClient.includes('body: withTargetCriteria({ description }, targetCriteria)')
    && pluginsHubView.includes('pluginRootId: plugin.pluginRootId')
    && pluginsHubView.includes('pluginSource: plugin.pluginSource')
    && pluginConfigView.includes('route.query.pluginRootId')
    && pluginConfigView.includes('targetCriteria: pluginTargetCriteria.value')
    && pluginConfigStore.includes('function getLoadedPluginTargetCriteria')
    && pluginConfigStore.includes('function matchesPluginTargetCriteria')
    && pluginConfigStore.includes('getLoadedPluginTargetCriteria()')
    && appRouteManifest.includes('targetCriteria?: { pluginRootId?: string; pluginSource?: string }')
    && recentVisitsComposable.includes('pluginRootId?: string')
    && recentVisitsComposable.includes('getPluginVisitKey')
    && commandPaletteUtils.includes('pluginRootId?: string')
    && commandPaletteUtils.includes('recent:plugin:${pluginName}:${plugin.pluginRootId || ""}:${plugin.pluginSource || ""}')
    && pluginApiTests.includes('pluginApi managed write target criteria')
    && pluginApiTests.includes('preserves legacy payloads when target criteria are unavailable')
    && pluginConfigStoreTests.includes('loads the plugin record matching explicit target criteria')
    && pluginConfigStoreTests.includes('does not fall back to another duplicate plugin when explicit target criteria miss')
    && recentVisitsTests.includes('recent plugin visits target criteria')
    && commandPaletteTests.includes('command palette plugin target criteria'),
});
requiredChecks.push({
  label: 'Admin plugin hub labels trusted external process runtime risk',
  ok: pluginHubState.includes('runtimeTrustWarningLabel')
    && pluginHubState.includes('runtimeTrustWarningTitle')
    && pluginHubState.includes('external_process_not_untrusted_sandbox')
    && pluginHubState.includes('可信外部进程')
    && pluginHubState.includes('不是文件系统或进程沙箱')
    && (pluginsHubView.match(/plugin\.runtimeTrustWarningLabel/g) || []).length >= 4
    && pluginsHubView.includes(':title="plugin.runtimeTrustWarningTitle"')
    && pluginsHubView.includes('security'),
});
requiredChecks.push({
  label: 'Admin plugin hub runtime trust labels have targeted unit coverage',
  ok: pluginHubStateTests.includes('derivePluginHubState runtime trust labels')
    && pluginHubStateTests.includes('external_process_not_untrusted_sandbox')
    && pluginHubStateTests.includes('可信外部进程')
    && pluginHubStateTests.includes('不是文件系统或进程沙箱')
    && pluginHubStateTests.includes("runtimeTrustWarningLabel).toBe('')"),
});

const externalRunnerRfc = readText('docs/governance/EXTERNAL_RUNNER_BOUNDARY_RFC_20260611.md');
const jennSurfaceExtractionPlan = readText('docs/governance/JENN_SURFACE_EXTRACTION_PLAN_20260611.md');
requiredChecks.push({
  label: 'Jenn surface extraction plan stays plan-only and default-off focused',
  ok: jennSurfaceExtractionPlan.includes('**Status:** plan only')
    && jennSurfaceExtractionPlan.includes('It does not authorize a broad migration by itself')
    && jennSurfaceExtractionPlan.includes('AI Image management route remains behind `ENABLE_AI_IMAGE_AGENTS_ROUTE ===')
    && jennSurfaceExtractionPlan.includes('Trial runtime-to-review internal routes have a separate explicit gate')
    && jennSurfaceExtractionPlan.includes('Codex memory MCP route requires mount-site or route-local auth hooks')
    && jennSurfaceExtractionPlan.includes('No trial route, delegate, or Photo Studio path is described as an untrusted sandbox')
    && jennSurfaceExtractionPlan.includes('no `A:\\agent-image-lab` string remains in core source after the split')
    && jennSurfaceExtractionPlan.includes('Do not delete current AI image behavior in a single broad PR'),
});
requiredChecks.push({
  label: 'external runner RFC keeps trusted adapter distinct from untrusted sandbox',
  ok: externalRunnerRfc.includes('trusted-adapter boundary')
    && externalRunnerRfc.includes('it is not an untrusted sandbox')
    && externalRunnerRfc.includes('Only `untrusted_runner_enabled` may be described as sandboxed')
    && externalRunnerRfc.includes('Network is deny-by-default')
    && externalRunnerRfc.includes('The repository and core runtime are mounted read-only')
    && externalRunnerRfc.includes('the runner cannot read root `.env` or `config.env`')
    && externalRunnerRfc.includes('direct/hybrid same-process manifests remain denied'),
});

const pluginStoreRoute = readText('routes/admin/pluginStore.js');
const pluginStoreApiClient = readText('AdminPanel-Vue/src/api/pluginStore.ts');
const pluginStoreView = readText('AdminPanel-Vue/src/views/PluginStore.vue');
const pluginStoreInstallTests = readText('tests/plugin-store-install-env-sandbox.test.js');
const pluginStoreSsrfTests = readText('tests/plugin-store-ssrf-policy.test.js');
const pluginStoreSourceTests = readText('tests/plugin-store-source-redaction.test.js');
requiredChecks.push({
  label: 'Plugin Store install gates disable lifecycle scripts by default',
  ok: pluginStoreRoute.includes("'--ignore-scripts'")
    && pluginStoreRoute.includes('allowLifecycleScripts')
    && pluginStoreRoute.includes('lifecycleScriptsConfirmation')
    && pluginStoreRoute.includes('NPM_LIFECYCLE_SCRIPT_CONFIRMATION')
    && pluginStoreRoute.includes('plugin_store_download_url_mixed_target_unsupported')
    && pluginStoreInstallTests.includes("['install', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund']")
    && pluginStoreInstallTests.includes('resolveLifecycleScriptApproval')
    && pluginStoreInstallTests.includes('plugin_store_direct_download_url_disabled'),
});
requiredChecks.push({
  label: 'Plugin Store UI requires explicit lifecycle script confirmation retry',
  ok: pluginStoreView.includes("const LIFECYCLE_SCRIPT_CONFIRMATION = 'ALLOW_NPM_LIFECYCLE_SCRIPTS'")
    && pluginStoreView.includes('function isLifecycleConfirmationRequired')
    && pluginStoreView.includes('function confirmLifecycleScripts')
    && pluginStoreView.includes('allowLifecycleScripts: true')
    && pluginStoreView.includes('lifecycleScriptsConfirmation: LIFECYCLE_SCRIPT_CONFIRMATION')
    && pluginStoreView.includes('createUploadFormData(files, relPaths, true)')
    && pluginStoreView.includes('保持禁用')
    && pluginStoreView.includes('仅在确认来源可信时继续'),
});
requiredChecks.push({
  label: 'Plugin Store remote downloads enforce byte quota and cleanup',
  ok: pluginStoreRoute.includes('MAX_REMOTE_DOWNLOAD_BYTES')
    && pluginStoreRoute.includes('parseContentLength')
    && pluginStoreRoute.includes('createDownloadByteLimitStream')
    && pluginStoreRoute.includes('plugin_store_remote_download_too_large')
    && pluginStoreRoute.includes("fs.createWriteStream(destFile, { flags: 'wx' })")
    && pluginStoreRoute.includes('https://codeload.github.com/${parsed.owner}/${parsed.repo}/zip/refs/heads/${branch}')
    && pluginStoreRoute.includes('await downloadToFile(zipUrl, zipPath)')
    && pluginStoreSsrfTests.includes('downloadToFile rejects oversized Content-Length before writing file')
    && pluginStoreSsrfTests.includes('downloadToFile aborts streaming body that exceeds quota and removes partial file'),
});
requiredChecks.push({
  label: 'Plugin Store source APIs return redacted source URLs only',
  ok: pluginStoreRoute.includes('function redactSourceUrl')
    && pluginStoreRoute.includes('function sanitizeSourceForApi')
    && pluginStoreRoute.includes('function sanitizePluginItemForApi')
    && pluginStoreRoute.includes('const { url, ...safeSource } = source')
    && pluginStoreRoute.includes('const { downloadUrl, ...safePlugin } = plugin')
    && pluginStoreRoute.includes('sources: sanitizeSourcesForApi(sources)')
    && pluginStoreRoute.includes('plugins: sanitizePluginItemsForApi(all)')
    && pluginStoreRoute.includes("res.json({ sources: sanitizeSourcesForApi(await loadSources()) })")
    && !pluginStoreApiClient.includes('url?: string')
    && !/export interface PluginStoreItem[\s\S]*?downloadUrl\?: string[\s\S]*?export interface PluginSource/.test(pluginStoreApiClient)
    && !pluginStoreView.includes('source.url')
    && !pluginStoreView.includes('plugin.downloadUrl')
    && !pluginStoreView.includes('last.downloadUrl')
    && pluginStoreSourceTests.includes('redactSourceUrl removes credentials and token query values')
    && pluginStoreSourceTests.includes('sanitizeSourceForApi omits raw url and exposes redacted display fields')
    && pluginStoreSourceTests.includes('sanitizePluginItemForApi omits raw downloadUrl from plugin list items')
    && pluginStoreSourceTests.includes('GET /plugin-store/sources does not return raw source URLs')
    && pluginStoreSourceTests.includes('aggregate source sanitizer used by /plugin-store output omits raw URLs'),
});
requiredChecks.push({
  label: 'Plugin Store install download logs redact source URLs',
  ok: pluginStoreRoute.includes('function pushDownloadLog')
    && (pluginStoreRoute.match(/pushDownloadLog\(task, /g) || []).length >= 3
    && !pluginStoreRoute.includes('pushLog(task, `[download] ${downloadUrl}`)')
    && !pluginStoreRoute.includes('pushLog(task, `[download] ${target.downloadUrl}`)')
    && pluginStoreInstallTests.includes('scrubPluginStoreLog redacts token-like output, credential URLs, and absolute paths')
    && pluginStoreInstallTests.includes('access_token=abc123'),
});

requiredChecks.push({
  label: 'Admin managed write routes require unambiguous targets',
  ok: adminPluginsRoute.includes('function resolveAdminPluginRecordForManagedWrite')
    && (adminPluginsRoute.match(/resolveAdminPluginRecordForManagedWrite\(catalog, pluginName, getLookupCriteria\(req\)\)/g) || []).length >= 4
    && adminPluginsRoute.includes('ambiguous_admin_plugin_target')
    && adminPluginTargetTests.includes('duplicate core and external pluginName blocks general description writes')
    && adminPluginTargetTests.includes('duplicate core and external pluginName blocks config writes')
    && adminPluginTargetTests.includes('duplicate core and external pluginName blocks toggle writes')
    && adminPluginTargetTests.includes('assertNoAbsolutePathLeak'),
});
requiredChecks.push({
  label: 'Admin config.env writes reject symlink and non-regular targets',
  ok: adminPluginsRoute.includes('config_env_symlink_unsupported')
    && adminPluginsRoute.includes("await fs.writeFile(tempPath, content, { encoding: 'utf-8', flag: 'wx' })")
    && adminPluginsRoute.includes('await fs.rename(tempPath, configPath)')
    && adminPluginsRoute.includes('isManagedPathInsideRoot(configPath, pluginRoot)')
    && adminPluginTargetTests.includes('config write rejects existing config.env symlink without writing target')
    && adminPluginTargetTests.includes('config write rejects existing config.env directory'),
});
requiredChecks.push({
  label: 'Admin main config.env writes reject symlink and non-regular targets',
  ok: adminConfigRoute.includes('function writeMainConfigNoFollow')
    && adminConfigRoute.includes('main_config_env_symlink_unsupported')
    && adminConfigRoute.includes('main_config_env_non_regular_unsupported')
    && adminConfigRoute.includes("await fs.writeFile(tempPath, content, { encoding: 'utf-8', flag: 'wx' })")
    && adminConfigRoute.includes('await fs.rename(tempPath, configPath)')
    && adminConfigRouteTests.includes('main config route rejects existing config.env symlink without writing target')
    && adminConfigRouteTests.includes('main config route rejects existing config.env directory')
    && adminConfigRouteTests.includes('main config route writes config.env through regular temp file and reloads plugins'),
});

const codexMemoryMcpRoute = readText('routes/codexMemoryMcp.js');
const codexMemoryMcpTests = readText('tests/codex-memory-mcp.test.js');
requiredChecks.push({
  label: 'Codex memory MCP route requires auth hooks and include_content permission',
  ok: codexMemoryMcpRoute.includes('requires authorizeRequest option')
    && codexMemoryMcpRoute.includes('router.use(requireAuthorizedRequest)')
    && codexMemoryMcpRoute.includes('authorizeIncludeContent')
    && codexMemoryMcpRoute.includes('codex_memory_include_content_forbidden')
    && server.includes('authorizeRequest: authorizeCodexMemoryMcpRequest')
    && server.includes('authorizeIncludeContent: authorizeCodexMemoryMcpIncludeContent')
    && codexMemoryMcpTests.includes('codex-memory MCP router should refuse creation without route-local auth')
    && codexMemoryMcpTests.includes('codex-memory MCP should deny include_content without separate permission'),
});

requiredChecks.push({
  label: 'baseline deny rules catch nested env files',
  ok: [
    'AdminPanel-Vue/.env.production',
    'Plugin/Example/.env',
    'Plugin/Example/config.env.local',
  ].every(file => findDenyRule(file)?.label === 'env files'),
});
requiredChecks.push({
  label: 'baseline deny rules allow env templates',
  ok: [
    'Plugin/Example/.env.example',
    'Plugin/Example/.env.sample',
    'Plugin/Example/.env.template',
  ].every(file => findDenyRule(file) === null),
});
requiredChecks.push({
  label: 'baseline deny rules no longer treat dailynote as automatic stable failure',
  ok: findDenyRule('dailynote/Codex/example.txt') === null,
});
requiredChecks.push({
  label: 'baseline deny rules no longer treat tracked image outputs as automatic stable failure',
  ok: findDenyRule('image/gptimagegen/example.png') === null
    && findDenyRule('image/fluxgen/example.png') === null,
});
requiredChecks.push({
  label: 'baseline deny rules no longer treat admin dist artifacts as automatic stable failure',
  ok: findDenyRule('AdminPanel-Vue/dist/index.html') === null,
});

const aiImageRoute = readText('routes/admin/aiImageAgents.js');
const serverSource = readText('server.js');
const aiImageJennTrialFixtures = readText('modules/aiImageJennTrialFixtures.js');
requiredChecks.push({
  label: 'AI image route keeps dry-run forcing path',
  ok: aiImageRoute.includes('forceDryRun: true') && aiImageRoute.includes('resolveDryRunMode'),
});
requiredChecks.push({
  label: 'AI image runtime-to-review trial route registration requires explicit route option',
  ok: aiImageRoute.includes('shouldEnableRuntimeToReviewTrialRoutes')
    && aiImageRoute.includes('enableRuntimeToReviewTrialInternalRoutes === true'),
});
requiredChecks.push({
  label: 'AI image Jenn trial data is split out of route and server implementation sources',
  ok: aiImageRoute.includes("require('../../modules/aiImageJennTrialFixtures')")
    && serverSource.includes("require('./modules/aiImageJennTrialFixtures')")
    && !aiImageRoute.includes('A:\\agent-image-lab')
    && !serverSource.includes('A:\\agent-image-lab')
    && aiImageJennTrialFixtures.includes('AUTHORIZED_DOUBAO_PROJECT_BASE_PATH_OVERRIDES')
    && aiImageJennTrialFixtures.includes('A:\\\\agent-image-lab'),
});

const failedChecks = requiredChecks.filter((check) => !check.ok);

if (violations.length > 0 || failedChecks.length > 0) {
  console.error('[prod-baseline] failed');

  if (violations.length > 0) {
    console.error('\nTracked forbidden/runtime files:');
    for (const item of violations) {
      console.error(`- ${item}`);
    }
  }

  if (failedChecks.length > 0) {
    console.error('\nMissing or unsafe baseline checks:');
    for (const check of failedChecks) {
      console.error(`- ${check.label}`);
    }
  }

  process.exit(1);
}

console.log(`[prod-baseline] ok: ${trackedFiles.length} tracked files checked, ${requiredChecks.length} safety checks passed`);

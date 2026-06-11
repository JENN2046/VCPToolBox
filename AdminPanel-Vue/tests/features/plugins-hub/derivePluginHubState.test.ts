import { describe, expect, it } from 'vitest'
import {
  buildPluginHubRecords,
  buildRecentPluginVisitItems,
} from '@/features/plugins-hub/derivePluginHubState'
import type { PluginInfo } from '@/types/api.plugin'

function makePlugin(overrides: Partial<PluginInfo> = {}): PluginInfo {
  return {
    name: 'ExternalEcho',
    manifest: {
      name: 'ExternalEcho',
      displayName: 'External Echo',
      description: 'External reviewed plugin',
    },
    pluginSource: 'external',
    runtimeTrust: {
      warningCode: 'external_process_not_untrusted_sandbox',
      environmentSandbox: true,
      processSandbox: false,
      fileSystemSandbox: false,
      untrustedSandbox: false,
    },
    enabled: true,
    ...overrides,
  }
}

describe('derivePluginHubState runtime trust labels', () => {
  it('labels reviewed external process plugins as trusted external process risk', () => {
    const records = buildPluginHubRecords([makePlugin()], [], 80)

    expect(records).toHaveLength(1)
    expect(records[0]?.runtimeTrustWarningLabel).toBe('可信外部进程')
    expect(records[0]?.runtimeTrustWarningTitle).toContain('不是文件系统或进程沙箱')
  })

  it('keeps ordinary plugins without a runtime trust warning label', () => {
    const records = buildPluginHubRecords([
      makePlugin({
        pluginSource: 'core',
        runtimeTrust: undefined,
      }),
    ], [], 80)

    expect(records[0]?.runtimeTrustWarningLabel).toBe('')
    expect(records[0]?.runtimeTrustWarningTitle).toBe('')
  })
})

describe('derivePluginHubState recent plugin visits', () => {
  it('preserves the visited duplicate plugin root and source', () => {
    const records = buildPluginHubRecords([
      makePlugin({
        manifest: {
          name: 'Echo',
          displayName: 'Core Echo',
          description: 'Core plugin',
        },
        pluginSource: 'core',
        pluginRootId: 'core:legacy',
        runtimeTrust: undefined,
      }),
      makePlugin({
        manifest: {
          name: 'Echo',
          displayName: 'External Echo',
          description: 'External plugin',
        },
        pluginSource: 'external',
        pluginRootId: 'external:0',
      }),
    ], [], 80)

    const items = buildRecentPluginVisitItems([
      {
        target: 'plugin-Echo-config',
        label: 'External Echo',
        pluginName: 'Echo',
        pluginRootId: 'external:0',
        pluginSource: 'external',
      },
    ], records)

    expect(items).toEqual([
      {
        pluginName: 'Echo',
        pluginRootId: 'external:0',
        pluginSource: 'external',
        label: 'External Echo',
        icon: 'extension',
      },
    ])
  })
})

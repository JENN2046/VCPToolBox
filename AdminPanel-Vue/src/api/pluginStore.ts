/**
 * 插件商店 API
 */

import {
  requestWithUi,
  type RequestUiOptions,
} from './requestWithUi'

const DEFAULT_READ_UI_OPTIONS: RequestUiOptions = { showLoader: false }

export interface PluginStoreItem {
  name: string
  displayName: string
  description: string
  version: string
  category?: string
  author?: string
  icon?: string
  installed?: boolean
  installedVersion?: string
  updateAvailable?: boolean
  sourceId?: string
  sourceName?: string
  installedSource?: 'core' | 'external' | string
  installedRootId?: string
  installedDisplayPath?: string
  conflictReason?: string
  github?: {
    owner: string
    repo: string
    branch: string | null
    subpath?: string
  }
}

export interface PluginSource {
  id: string
  name: string
  displayUrl?: string
  redactedUrl?: string
  type: 'registry' | 'github'
  builtin?: boolean
}

export interface PluginStoreDiagnostic {
  level?: string
  code?: string
  rootId?: string | null
  message?: string | null
}

export interface PluginStoreListResponse {
  plugins: PluginStoreItem[]
  total: number
  sources?: PluginSource[]
  errors?: Array<{ sourceId: string; error: string }>
  installMode?: 'legacy' | 'external' | string
  diagnostics?: PluginStoreDiagnostic[]
}

export interface InstallTaskResponse {
  taskId: string
  message?: string
}

export interface InstallFromPayload {
  sourceId?: string
  pluginName?: string
  githubUrl?: string
  downloadUrl?: string
  force?: boolean
  allowLifecycleScripts?: boolean
  lifecycleScriptsConfirmation?: string
}

export interface UninstallPluginPayload {
  pluginName: string
  installedSource?: string
  installedRootId?: string
}

export interface UninstallPluginCandidate {
  pluginName?: string
  installedSource?: string
  installedRootId?: string
  installedDisplayPath?: string
}

export interface UninstallPluginResponse {
  ok: boolean
  message?: string
  backupPath?: string
  installedSource?: string
  installedRootId?: string
  code?: string
  requiresInstalledRoot?: boolean
  candidates?: UninstallPluginCandidate[]
}

export const pluginStoreApi = {
  async getStorePlugins(
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<PluginStoreListResponse> {
    return requestWithUi<PluginStoreListResponse>(
      { url: '/admin_api/plugin-store' },
      uiOptions
    )
  },

  async listSources(
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<{ sources: PluginSource[] }> {
    return requestWithUi(
      { url: '/admin_api/plugin-store/sources' },
      uiOptions
    )
  },

  async addSource(
    payload: { name: string; url: string; type: 'registry' | 'github' },
    uiOptions: RequestUiOptions = {}
  ): Promise<{ source: PluginSource }> {
    return requestWithUi(
      {
        url: '/admin_api/plugin-store/sources',
        method: 'POST',
        body: payload,
      },
      uiOptions
    )
  },

  async deleteSource(
    id: string,
    uiOptions: RequestUiOptions = {}
  ): Promise<{ ok: boolean }> {
    return requestWithUi(
      {
        url: `/admin_api/plugin-store/sources/${encodeURIComponent(id)}`,
        method: 'DELETE',
      },
      uiOptions
    )
  },

  async install(
    payload: InstallFromPayload,
    uiOptions: RequestUiOptions = {}
  ): Promise<InstallTaskResponse> {
    return requestWithUi(
      {
        url: '/admin_api/plugin-store/install',
        method: 'POST',
        body: payload,
      },
      uiOptions
    )
  },

  async uninstallPlugin(
    payloadOrPluginName: string | UninstallPluginPayload,
    uiOptions: RequestUiOptions = {}
  ): Promise<UninstallPluginResponse> {
    const payload = typeof payloadOrPluginName === 'string'
      ? { pluginName: payloadOrPluginName }
      : payloadOrPluginName
    return requestWithUi(
      {
        url: '/admin_api/plugin-store/uninstall',
        method: 'POST',
        body: payload,
      },
      uiOptions
    )
  },

  async uploadPlugin(
    formData: FormData,
    uiOptions: RequestUiOptions = {}
  ): Promise<InstallTaskResponse> {
    return requestWithUi(
      {
        url: '/admin_api/plugin-store/upload',
        method: 'POST',
        body: formData as unknown as undefined,
      },
      uiOptions
    )
  },

  async getInstallStatus(
    taskId: string,
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<{ id: string; status: string; message: string; logs: string[] }> {
    return requestWithUi(
      { url: `/admin_api/plugin-store/install-status/${encodeURIComponent(taskId)}` },
      uiOptions
    )
  },

  /**
   * Subscribe to Server-Sent install logs.
   * Returns a cleanup function.
   */
  streamInstallLog(
    taskId: string,
    handlers: {
      onLog?: (line: string) => void
      onEnd?: (payload: { status: string; message?: string }) => void
      onError?: (err: Event) => void
    }
  ): () => void {
    const es = new EventSource(
      `/admin_api/plugin-store/install-log/${encodeURIComponent(taskId)}`,
      { withCredentials: true }
    )
    es.addEventListener('log', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data)
        handlers.onLog?.(String(data))
      } catch {
        handlers.onLog?.((ev as MessageEvent).data)
      }
    })
    es.addEventListener('end', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data)
        handlers.onEnd?.(data)
      } finally {
        es.close()
      }
    })
    es.onerror = (ev) => {
      handlers.onError?.(ev)
    }
    return () => es.close()
  },
}

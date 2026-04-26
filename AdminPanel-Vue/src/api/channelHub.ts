import {
  requestWithUi,
  type RequestUiOptions,
} from "./requestWithUi";

const DEFAULT_READ_UI_OPTIONS: RequestUiOptions = { showLoader: false };
const API_BASE = "/admin_api/channelHub";
const MEDIA_GATEWAY_API_BASE = "/admin_api/mediaGateway";

export interface ChannelHubApiResponse<TData = unknown> {
  success: boolean;
  data?: TData;
  message?: string;
  error?: string;
  timestamp?: string;
  pagination?: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface ChannelHubAdapter {
  adapterId: string;
  id?: string;
  channel: string;
  name?: string;
  status?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  lastSeenAt?: string;
  [key: string]: unknown;
}

export interface ChannelHubBinding {
  bindingKey: string;
  adapterId: string;
  channel?: string;
  externalSessionKey?: string;
  agentId?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ChannelHubOutboxJob {
  jobId?: string;
  messageId?: string;
  id?: string;
  adapterId?: string;
  channel?: string;
  status?: string;
  retryCount?: number;
  createdAt?: string;
  updatedAt?: string;
  nextAttemptAt?: string;
  error?: string;
  [key: string]: unknown;
}

export interface ChannelHubAuditLog {
  id?: string;
  eventId?: string;
  adapterId?: string;
  eventType?: string;
  action?: string;
  timestamp?: string;
  status?: string;
  message?: string;
  [key: string]: unknown;
}

export interface ChannelHubMetrics {
  period?: string;
  eventsReceived?: number;
  eventsProcessed?: number;
  eventsFailed?: number;
  eventsDuplicate?: number;
  avgProcessingTimeMs?: number;
  outboundJobsTotal?: number;
  outboundJobsSuccess?: number;
  outboundJobsFailed?: number;
  activeAdapters?: number;
  [key: string]: unknown;
}

export interface ChannelHubOutboxStats {
  total?: number;
  pending?: number;
  processing?: number;
  sent?: number;
  failed?: number;
  deadLetter?: number;
  [key: string]: unknown;
}

export interface ChannelHubHealth {
  status?: string;
  initialized?: boolean;
  uptime?: number;
  adapters?: {
    total?: number;
    healthy?: number;
    unhealthy?: number;
  };
  outbox?: Record<string, unknown>;
  modules?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ChannelHubAdapterPayload {
  adapterId: string;
  channel: string;
  name?: string;
  status?: string;
  config?: Record<string, unknown>;
}

export interface ChannelHubBindingPayload {
  bindingKey: string;
  adapterId: string;
  channel?: string;
  externalSessionKey?: string;
  agentId?: string;
  isActive?: boolean;
}

export interface ChannelHubMediaItem {
  mediaId?: string;
  id?: string;
  filename?: string;
  mediaType?: string;
  adapterId?: string;
  size?: number;
  createdAt?: string;
  expiresAt?: string;
  [key: string]: unknown;
}

export interface ChannelHubMediaStats {
  total?: number;
  byType?: Record<string, number>;
  byAdapter?: Record<string, number>;
  totalSize?: number;
  [key: string]: unknown;
}

export interface ChannelHubSignedMediaUrl {
  url?: string;
  expiresAt?: string;
  [key: string]: unknown;
}

async function unwrapData<TData>(
  request: {
    url: string;
    method?: "GET" | "POST" | "PUT" | "DELETE";
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
  },
  uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
): Promise<ChannelHubApiResponse<TData>> {
  return requestWithUi<ChannelHubApiResponse<TData>>(request, uiOptions);
}

function requireData<TData>(response: ChannelHubApiResponse<TData>, fallback: TData): TData {
  return response.data ?? fallback;
}

export const channelHubApi = {
  async getHealth(
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<ChannelHubHealth> {
    const response = await unwrapData<ChannelHubHealth>({
      url: `${API_BASE}/health`,
    }, uiOptions);
    return requireData(response, {});
  },

  async getMetrics(
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<ChannelHubMetrics> {
    const response = await unwrapData<ChannelHubMetrics>({
      url: `${API_BASE}/metrics`,
    }, uiOptions);
    return requireData(response, {});
  },

  async getOutboxStats(
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<ChannelHubOutboxStats> {
    const response = await unwrapData<ChannelHubOutboxStats>({
      url: `${API_BASE}/outbox/stats`,
    }, uiOptions);
    return requireData(response, {});
  },

  async getAdapters(
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<ChannelHubAdapter[]> {
    const response = await unwrapData<ChannelHubAdapter[]>({
      url: `${API_BASE}/adapters`,
    }, uiOptions);
    return requireData(response, []);
  },

  async createAdapter(
    payload: ChannelHubAdapterPayload,
    uiOptions: RequestUiOptions = {}
  ): Promise<ChannelHubAdapter> {
    const response = await unwrapData<ChannelHubAdapter>({
      url: `${API_BASE}/adapters`,
      method: "POST",
      body: payload,
    }, uiOptions);
    return requireData(response, {
      ...payload,
    });
  },

  async updateAdapter(
    adapterId: string,
    payload: Partial<ChannelHubAdapterPayload>,
    uiOptions: RequestUiOptions = {}
  ): Promise<ChannelHubAdapter> {
    const response = await unwrapData<ChannelHubAdapter>({
      url: `${API_BASE}/adapters/${encodeURIComponent(adapterId)}`,
      method: "PUT",
      body: payload,
    }, uiOptions);
    return requireData(response, { adapterId, channel: payload.channel || "" });
  },

  async deleteAdapter(
    adapterId: string,
    uiOptions: RequestUiOptions = {}
  ): Promise<void> {
    await unwrapData<void>({
      url: `${API_BASE}/adapters/${encodeURIComponent(adapterId)}`,
      method: "DELETE",
    }, uiOptions);
  },

  async setAdapterEnabled(
    adapterId: string,
    enabled: boolean,
    uiOptions: RequestUiOptions = {}
  ): Promise<void> {
    await unwrapData<void>({
      url: `${API_BASE}/adapters/${encodeURIComponent(adapterId)}/${enabled ? "enable" : "disable"}`,
      method: "POST",
    }, uiOptions);
  },

  async testAdapter(
    adapterId: string,
    uiOptions: RequestUiOptions = {}
  ): Promise<Record<string, unknown>> {
    const response = await unwrapData<Record<string, unknown>>({
      url: `${API_BASE}/adapters/${encodeURIComponent(adapterId)}/test`,
      method: "POST",
    }, uiOptions);
    return requireData(response, {});
  },

  async getBindings(
    filters: { adapterId?: string; channel?: string; agentId?: string } = {},
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<ChannelHubBinding[]> {
    const response = await unwrapData<ChannelHubBinding[]>({
      url: `${API_BASE}/bindings`,
      query: filters,
    }, uiOptions);
    return requireData(response, []);
  },

  async saveBinding(
    payload: ChannelHubBindingPayload,
    editingKey = "",
    uiOptions: RequestUiOptions = {}
  ): Promise<ChannelHubBinding> {
    const response = await unwrapData<ChannelHubBinding>({
      url: editingKey
        ? `${API_BASE}/bindings/${encodeURIComponent(editingKey)}`
        : `${API_BASE}/bindings`,
      method: editingKey ? "PUT" : "POST",
      body: payload,
    }, uiOptions);
    return requireData(response, {
      ...payload,
    });
  },

  async deleteBinding(
    bindingKey: string,
    uiOptions: RequestUiOptions = {}
  ): Promise<void> {
    await unwrapData<void>({
      url: `${API_BASE}/bindings/${encodeURIComponent(bindingKey)}`,
      method: "DELETE",
    }, uiOptions);
  },

  async getOutbox(
    filters: { status?: string; adapterId?: string; limit?: number; offset?: number } = {},
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<ChannelHubApiResponse<ChannelHubOutboxJob[]>> {
    return unwrapData<ChannelHubOutboxJob[]>({
      url: `${API_BASE}/outbox`,
      query: {
        limit: 100,
        offset: 0,
        ...filters,
      },
    }, uiOptions);
  },

  async retryOutboxJob(
    jobId: string,
    uiOptions: RequestUiOptions = {}
  ): Promise<void> {
    await unwrapData<void>({
      url: `${API_BASE}/outbox/${encodeURIComponent(jobId)}/retry`,
      method: "POST",
    }, uiOptions);
  },

  async deleteOutboxJob(
    jobId: string,
    uiOptions: RequestUiOptions = {}
  ): Promise<void> {
    await unwrapData<void>({
      url: `${API_BASE}/outbox/${encodeURIComponent(jobId)}`,
      method: "DELETE",
    }, uiOptions);
  },

  async getDeadLetters(
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<ChannelHubOutboxJob[]> {
    const response = await unwrapData<ChannelHubOutboxJob[]>({
      url: `${API_BASE}/outbox/dead-letters`,
      query: { limit: 100 },
    }, uiOptions);
    return requireData(response, []);
  },

  async cleanupDeadLetters(
    retentionDays?: number,
    uiOptions: RequestUiOptions = {}
  ): Promise<Record<string, unknown>> {
    const response = await unwrapData<Record<string, unknown>>({
      url: `${API_BASE}/dead-letter/cleanup`,
      method: "POST",
      body: { retentionDays },
    }, uiOptions);
    return requireData(response, {});
  },

  async getMediaStats(
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<ChannelHubMediaStats> {
    const response = await unwrapData<ChannelHubMediaStats>({
      url: `${MEDIA_GATEWAY_API_BASE}/stats`,
    }, uiOptions);
    return requireData(response, {});
  },

  async getMedia(
    filters: { adapterId?: string; type?: string; limit?: number; offset?: number } = {},
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<ChannelHubMediaItem[]> {
    const response = await unwrapData<ChannelHubMediaItem[]>({
      url: `${MEDIA_GATEWAY_API_BASE}/media`,
      query: {
        limit: 50,
        offset: 0,
        ...filters,
      },
    }, uiOptions);
    return requireData(response, []);
  },

  async getMediaDetail(
    mediaId: string,
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<ChannelHubMediaItem> {
    const response = await unwrapData<ChannelHubMediaItem>({
      url: `${MEDIA_GATEWAY_API_BASE}/media/${encodeURIComponent(mediaId)}`,
    }, uiOptions);
    return requireData(response, { mediaId });
  },

  async getSignedMediaUrl(
    mediaId: string,
    expiresIn = 3600,
    uiOptions: RequestUiOptions = {}
  ): Promise<ChannelHubSignedMediaUrl> {
    const response = await unwrapData<ChannelHubSignedMediaUrl>({
      url: `${MEDIA_GATEWAY_API_BASE}/signed-url/${encodeURIComponent(mediaId)}`,
      query: { expiresIn },
    }, uiOptions);
    return requireData(response, {});
  },

  async deleteMedia(
    mediaId: string,
    uiOptions: RequestUiOptions = {}
  ): Promise<void> {
    await unwrapData<void>({
      url: `${MEDIA_GATEWAY_API_BASE}/media/${encodeURIComponent(mediaId)}`,
      method: "DELETE",
    }, uiOptions);
  },

  async cleanupMedia(
    maxAge?: number,
    uiOptions: RequestUiOptions = {}
  ): Promise<Record<string, unknown>> {
    const response = await unwrapData<Record<string, unknown>>({
      url: `${MEDIA_GATEWAY_API_BASE}/cleanup`,
      method: "POST",
      body: { maxAge },
    }, uiOptions);
    return requireData(response, {});
  },

  async getAuditLogs(
    filters: { adapterId?: string; eventType?: string; limit?: number; offset?: number } = {},
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<ChannelHubApiResponse<ChannelHubAuditLog[]>> {
    return unwrapData<ChannelHubAuditLog[]>({
      url: `${API_BASE}/audit-logs`,
      query: {
        limit: 100,
        offset: 0,
        ...filters,
      },
    }, uiOptions);
  },
};

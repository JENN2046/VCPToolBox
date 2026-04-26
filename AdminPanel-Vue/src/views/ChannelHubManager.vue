<template>
  <section class="channelhub-page">
    <header class="channelhub-header">
      <div>
        <span class="eyebrow">ChannelHub</span>
        <h2>ChannelHub 管理</h2>
        <p class="description">
          管理多通道 adapter、会话绑定、发件箱和审计记录。
        </p>
      </div>
      <div class="header-actions">
        <button type="button" class="btn-secondary btn-sm-touch" @click="loadAll">
          <span class="material-symbols-outlined">refresh</span>
          刷新
        </button>
      </div>
    </header>

    <section class="summary-grid">
      <article class="summary-card">
        <span>服务状态</span>
        <strong>{{ health.status || "unknown" }}</strong>
      </article>
      <article class="summary-card">
        <span>活跃 Adapter</span>
        <strong>{{ activeAdapterCount }}</strong>
      </article>
      <article class="summary-card">
        <span>会话绑定</span>
        <strong>{{ bindings.length }}</strong>
      </article>
      <article class="summary-card">
        <span>待处理消息</span>
        <strong>{{ outboxStats.pending ?? 0 }}</strong>
      </article>
      <article class="summary-card">
        <span>入站成功</span>
        <strong>{{ metrics.eventsProcessed ?? 0 }}</strong>
      </article>
      <article class="summary-card warning">
        <span>死信</span>
        <strong>{{ outboxStats.deadLetter ?? 0 }}</strong>
      </article>
    </section>

    <nav class="tab-strip" aria-label="ChannelHub 管理区">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        :class="['tab-button', { active: activeTab === tab.id }]"
        @click="selectTab(tab.id)"
      >
        <span class="material-symbols-outlined">{{ tab.icon }}</span>
        {{ tab.label }}
      </button>
    </nav>

    <section v-if="activeTab === 'adapters'" class="panel-grid">
      <form class="card editor-card" @submit.prevent="saveAdapter">
        <div class="card-heading">
          <h3>{{ editingAdapterId ? "编辑 Adapter" : "新增 Adapter" }}</h3>
          <button v-if="editingAdapterId" type="button" class="btn-secondary btn-sm" @click="resetAdapterForm">
            取消编辑
          </button>
        </div>

        <div class="form-grid">
          <label class="field">
            <span>Adapter ID</span>
            <input v-model.trim="adapterForm.adapterId" type="text" :disabled="Boolean(editingAdapterId)" required>
          </label>
          <label class="field">
            <span>Channel</span>
            <input v-model.trim="adapterForm.channel" type="text" placeholder="dingtalk / wecom / feishu / onebot" required>
          </label>
          <label class="field">
            <span>名称</span>
            <input v-model.trim="adapterForm.name" type="text">
          </label>
          <label class="field">
            <span>状态</span>
            <select v-model="adapterForm.status">
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
        </div>

        <label class="field">
          <span>Config JSON</span>
          <textarea v-model="adapterForm.configText" rows="8" spellcheck="false"></textarea>
        </label>

        <div class="form-actions">
          <button type="submit" class="btn-primary">
            <span class="material-symbols-outlined">save</span>
            保存 Adapter
          </button>
        </div>
      </form>

      <div class="card table-card">
        <div class="card-heading">
          <h3>Adapters</h3>
          <span class="muted">{{ adapters.length }} 个</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Channel</th>
                <th>状态</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="adapter in adapters" :key="adapter.adapterId">
                <td>
                  <strong>{{ adapter.name || adapter.adapterId }}</strong>
                  <small>{{ adapter.adapterId }}</small>
                </td>
                <td>{{ adapter.channel || "-" }}</td>
                <td><span :class="['status-pill', adapterStatusClass(adapter)]">{{ isAdapterActive(adapter) ? "active" : "inactive" }}</span></td>
                <td>{{ formatDate(adapter.updatedAt || adapter.lastSeenAt) }}</td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="btn-secondary btn-sm" @click="editAdapter(adapter)">编辑</button>
                    <button type="button" class="btn-secondary btn-sm" @click="toggleAdapter(adapter)">
                      {{ isAdapterActive(adapter) ? "停用" : "启用" }}
                    </button>
                    <button type="button" class="btn-secondary btn-sm" @click="testAdapter(adapter)">测试</button>
                    <button type="button" class="btn-danger btn-sm" @click="deleteAdapter(adapter)">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="adapters.length === 0" class="empty-note">还没有注册 adapter。</p>
      </div>
    </section>

    <section v-else-if="activeTab === 'bindings'" class="panel-grid">
      <form class="card editor-card" @submit.prevent="saveBinding">
        <div class="card-heading">
          <h3>{{ editingBindingKey ? "编辑绑定" : "新增绑定" }}</h3>
          <button v-if="editingBindingKey" type="button" class="btn-secondary btn-sm" @click="resetBindingForm">
            取消编辑
          </button>
        </div>

        <label class="field">
          <span>Binding Key</span>
          <input v-model.trim="bindingForm.bindingKey" type="text" :disabled="Boolean(editingBindingKey)" required>
        </label>
        <div class="form-grid">
          <label class="field">
            <span>Adapter</span>
            <select v-model="bindingForm.adapterId" required>
              <option value="">选择 Adapter</option>
              <option v-for="adapter in adapters" :key="adapter.adapterId" :value="adapter.adapterId">
                {{ adapter.name || adapter.adapterId }}
              </option>
            </select>
          </label>
          <label class="field">
            <span>Channel</span>
            <input v-model.trim="bindingForm.channel" type="text">
          </label>
          <label class="field">
            <span>外部会话 Key</span>
            <input v-model.trim="bindingForm.externalSessionKey" type="text">
          </label>
          <label class="field">
            <span>Agent ID</span>
            <input v-model.trim="bindingForm.agentId" type="text">
          </label>
        </div>
        <label class="switch-row">
          <span>启用绑定</span>
          <span class="switch">
            <input v-model="bindingForm.isActive" type="checkbox">
            <span class="slider"></span>
          </span>
        </label>
        <div class="form-actions">
          <button type="submit" class="btn-primary">
            <span class="material-symbols-outlined">save</span>
            保存绑定
          </button>
        </div>
      </form>

      <div class="card table-card">
        <div class="card-heading">
          <h3>Bindings</h3>
          <span class="muted">{{ bindings.length }} 个</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Binding</th>
                <th>Adapter</th>
                <th>Agent</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="binding in bindings" :key="binding.bindingKey">
                <td>
                  <strong>{{ binding.bindingKey }}</strong>
                  <small>{{ binding.externalSessionKey || "-" }}</small>
                </td>
                <td>{{ binding.adapterId }}</td>
                <td>{{ binding.agentId || "-" }}</td>
                <td><span :class="['status-pill', binding.isActive === false ? 'muted' : 'ok']">{{ binding.isActive === false ? "inactive" : "active" }}</span></td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="btn-secondary btn-sm" @click="editBinding(binding)">编辑</button>
                    <button type="button" class="btn-danger btn-sm" @click="deleteBinding(binding)">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="bindings.length === 0" class="empty-note">还没有会话绑定。</p>
      </div>
    </section>

    <section v-else-if="activeTab === 'outbox'" class="card table-card">
      <div class="card-heading">
        <h3>发件箱</h3>
        <select v-model="outboxFilter" @change="loadOutbox">
          <option value="">全部状态</option>
          <option value="pending">pending</option>
          <option value="processing">processing</option>
          <option value="delivered">delivered</option>
          <option value="failed">failed</option>
          <option value="dead_letter">dead_letter</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Adapter</th>
              <th>状态</th>
              <th>重试</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in outboxJobs" :key="getJobId(job)">
              <td>
                <strong>{{ getJobId(job) }}</strong>
                <small>{{ job.error || "-" }}</small>
              </td>
              <td>{{ job.adapterId || job.channel || "-" }}</td>
              <td><span class="status-pill muted">{{ job.status || "-" }}</span></td>
              <td>{{ job.retryCount ?? 0 }}</td>
              <td>{{ formatDate(job.createdAt) }}</td>
              <td>
                <div class="row-actions">
                  <button type="button" class="btn-secondary btn-sm" @click="retryOutboxJob(job)">重试</button>
                  <button type="button" class="btn-danger btn-sm" @click="deleteOutboxJob(job)">取消</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="outboxJobs.length === 0" class="empty-note">当前没有发件箱记录。</p>
    </section>

    <section v-else-if="activeTab === 'deadLetters'" class="card table-card">
      <div class="card-heading">
        <h3>死信队列</h3>
        <button type="button" class="btn-secondary btn-sm-touch" @click="cleanupDeadLetters">
          <span class="material-symbols-outlined">cleaning_services</span>
          清理过期死信
        </button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Adapter</th>
              <th>错误</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in deadLetters" :key="getJobId(job)">
              <td>{{ getJobId(job) }}</td>
              <td>{{ job.adapterId || job.channel || "-" }}</td>
              <td class="error-cell">{{ job.error || "-" }}</td>
              <td>{{ formatDate(job.updatedAt || job.createdAt) }}</td>
              <td><button type="button" class="btn-secondary btn-sm" @click="retryOutboxJob(job)">重试</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="deadLetters.length === 0" class="empty-note">当前没有死信记录。</p>
    </section>

    <section v-else-if="activeTab === 'media'" class="card table-card">
      <div class="card-heading">
        <h3>Media Gateway</h3>
        <div class="row-actions">
          <select v-model="mediaTypeFilter" @change="loadMediaGateway">
            <option value="">All types</option>
            <option value="image">image</option>
            <option value="audio">audio</option>
            <option value="file">file</option>
          </select>
          <select v-model="mediaAdapterFilter" @change="loadMediaGateway">
            <option value="">All adapters</option>
            <option v-for="adapter in adapters" :key="adapter.adapterId" :value="adapter.adapterId">
              {{ adapter.name || adapter.adapterId }}
            </option>
          </select>
          <button type="button" class="btn-secondary btn-sm-touch" @click="loadMediaGateway">
            <span class="material-symbols-outlined">refresh</span>
            Refresh
          </button>
          <button type="button" class="btn-danger btn-sm-touch" @click="cleanupMedia">
            <span class="material-symbols-outlined">cleaning_services</span>
            Cleanup
          </button>
        </div>
      </div>

      <div class="media-stats">
        <div class="media-stat">
          <span>Total</span>
          <strong>{{ mediaStats.total ?? mediaItems.length }}</strong>
        </div>
        <div class="media-stat">
          <span>Images</span>
          <strong>{{ mediaStats.byType?.image ?? 0 }}</strong>
        </div>
        <div class="media-stat">
          <span>Audio</span>
          <strong>{{ mediaStats.byType?.audio ?? 0 }}</strong>
        </div>
        <div class="media-stat">
          <span>Files</span>
          <strong>{{ mediaStats.byType?.file ?? 0 }}</strong>
        </div>
        <div class="media-stat">
          <span>Size</span>
          <strong>{{ formatBytes(mediaStats.totalSize) }}</strong>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Media</th>
              <th>Type</th>
              <th>Adapter</th>
              <th>Size</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="media in mediaItems" :key="getMediaId(media)">
              <td>
                <strong>{{ media.filename || getMediaId(media) }}</strong>
                <small>{{ getMediaId(media) }}</small>
              </td>
              <td><span class="status-pill muted">{{ media.mediaType || "-" }}</span></td>
              <td>{{ media.adapterId || "-" }}</td>
              <td>{{ formatBytes(media.size) }}</td>
              <td>{{ formatDate(media.createdAt) }}</td>
              <td>
                <div class="row-actions">
                  <button type="button" class="btn-secondary btn-sm" @click="inspectMedia(media)">Details</button>
                  <button type="button" class="btn-secondary btn-sm" @click="showSignedMediaUrl(media)">Signed URL</button>
                  <button type="button" class="btn-danger btn-sm" @click="deleteMedia(media)">Delete</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="mediaItems.length === 0" class="empty-note">No media files.</p>
    </section>

    <section v-else class="card table-card">
      <div class="card-heading">
        <h3>审计记录</h3>
        <select v-model="auditAdapterFilter" @change="loadAuditLogs">
          <option value="">全部 Adapter</option>
          <option v-for="adapter in adapters" :key="adapter.adapterId" :value="adapter.adapterId">
            {{ adapter.name || adapter.adapterId }}
          </option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>Adapter</th>
              <th>事件</th>
              <th>状态</th>
              <th>消息</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in auditLogs" :key="getAuditKey(log)">
              <td>{{ formatDate(log.timestamp) }}</td>
              <td>{{ log.adapterId || "-" }}</td>
              <td>{{ log.eventType || log.action || "-" }}</td>
              <td><span class="status-pill muted">{{ log.status || "-" }}</span></td>
              <td>{{ log.message || log.error || "-" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="auditLogs.length === 0" class="empty-note">暂无审计记录。</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  channelHubApi,
  type ChannelHubAdapter,
  type ChannelHubAuditLog,
  type ChannelHubBinding,
  type ChannelHubHealth,
  type ChannelHubMediaItem,
  type ChannelHubMediaStats,
  type ChannelHubMetrics,
  type ChannelHubOutboxJob,
  type ChannelHubOutboxStats,
} from "@/api";
import { showMessage } from "@/utils";

type ChannelHubTab = "adapters" | "bindings" | "outbox" | "deadLetters" | "media" | "audit";

interface AdapterFormState {
  adapterId: string;
  channel: string;
  name: string;
  status: "active" | "inactive";
  configText: string;
}

interface BindingFormState {
  bindingKey: string;
  adapterId: string;
  channel: string;
  externalSessionKey: string;
  agentId: string;
  isActive: boolean;
}

const tabs: Array<{ id: ChannelHubTab; label: string; icon: string }> = [
  { id: "adapters", label: "Adapters", icon: "hub" },
  { id: "bindings", label: "Bindings", icon: "link" },
  { id: "outbox", label: "Outbox", icon: "outbox" },
  { id: "deadLetters", label: "Dead Letters", icon: "report" },
  { id: "media", label: "Media", icon: "perm_media" },
  { id: "audit", label: "Audit", icon: "fact_check" },
];

function createAdapterForm(): AdapterFormState {
  return {
    adapterId: "",
    channel: "",
    name: "",
    status: "inactive",
    configText: "{\n  \n}",
  };
}

function createBindingForm(): BindingFormState {
  return {
    bindingKey: "",
    adapterId: "",
    channel: "",
    externalSessionKey: "",
    agentId: "",
    isActive: true,
  };
}

const activeTab = ref<ChannelHubTab>("adapters");
const health = ref<ChannelHubHealth>({});
const metrics = ref<ChannelHubMetrics>({});
const outboxStats = ref<ChannelHubOutboxStats>({});
const adapters = ref<ChannelHubAdapter[]>([]);
const bindings = ref<ChannelHubBinding[]>([]);
const outboxJobs = ref<ChannelHubOutboxJob[]>([]);
const deadLetters = ref<ChannelHubOutboxJob[]>([]);
const mediaStats = ref<ChannelHubMediaStats>({});
const mediaItems = ref<ChannelHubMediaItem[]>([]);
const auditLogs = ref<ChannelHubAuditLog[]>([]);
const outboxFilter = ref("");
const mediaTypeFilter = ref("");
const mediaAdapterFilter = ref("");
const auditAdapterFilter = ref("");
const adapterForm = ref<AdapterFormState>(createAdapterForm());
const bindingForm = ref<BindingFormState>(createBindingForm());
const editingAdapterId = ref("");
const editingBindingKey = ref("");

const activeAdapterCount = computed(() =>
  adapters.value.filter((adapter) => isAdapterActive(adapter)).length
);

function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Config 必须是 JSON object");
  }
  return parsed as Record<string, unknown>;
}

function formatJson(value: unknown): string {
  return JSON.stringify(value && typeof value === "object" ? value : {}, null, 2);
}

function isAdapterActive(adapter: ChannelHubAdapter): boolean {
  return adapter.status === "active" || adapter.enabled === true;
}

function adapterStatusClass(adapter: ChannelHubAdapter): "ok" | "muted" {
  return isAdapterActive(adapter) ? "ok" : "muted";
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getJobId(job: ChannelHubOutboxJob): string {
  return String(job.jobId || job.messageId || job.id || "");
}

function getAuditKey(log: ChannelHubAuditLog): string {
  return String(log.id || log.eventId || `${log.timestamp}-${log.adapterId}-${log.eventType}`);
}

function getMediaId(media: ChannelHubMediaItem): string {
  return String(media.mediaId || media.id || "");
}

function formatBytes(value?: number): string {
  if (value == null) return "-";
  if (value === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function selectTab(tabId: ChannelHubTab) {
  activeTab.value = tabId;
  if (tabId === "media" && mediaItems.value.length === 0) {
    void loadMediaGateway();
  }
}

async function loadOverview() {
  const [nextHealth, nextMetrics, nextOutboxStats] = await Promise.all([
    channelHubApi.getHealth({ showLoader: false, loadingKey: "channelhub.health.load" }),
    channelHubApi.getMetrics({ showLoader: false, loadingKey: "channelhub.metrics.load" }),
    channelHubApi.getOutboxStats({ showLoader: false, loadingKey: "channelhub.outbox.stats.load" }),
  ]);
  health.value = nextHealth;
  metrics.value = nextMetrics;
  outboxStats.value = nextOutboxStats;
}

async function loadAdapters() {
  adapters.value = await channelHubApi.getAdapters({
    showLoader: false,
    loadingKey: "channelhub.adapters.load",
  });
}

async function loadBindings() {
  bindings.value = await channelHubApi.getBindings({}, {
    showLoader: false,
    loadingKey: "channelhub.bindings.load",
  });
}

async function loadOutbox() {
  const response = await channelHubApi.getOutbox({
    status: outboxFilter.value || undefined,
    limit: 100,
  }, {
    showLoader: false,
    loadingKey: "channelhub.outbox.load",
  });
  outboxJobs.value = response.data || [];
}

async function loadDeadLetters() {
  deadLetters.value = await channelHubApi.getDeadLetters({
    showLoader: false,
    loadingKey: "channelhub.deadletters.load",
  });
}

async function loadMediaGateway() {
  try {
    const [nextStats, nextMedia] = await Promise.all([
      channelHubApi.getMediaStats({
        showLoader: false,
        loadingKey: "channelhub.media.stats.load",
      }),
      channelHubApi.getMedia({
        adapterId: mediaAdapterFilter.value || undefined,
        type: mediaTypeFilter.value || undefined,
        limit: 50,
      }, {
        showLoader: false,
        loadingKey: "channelhub.media.load",
      }),
    ]);
    mediaStats.value = nextStats;
    mediaItems.value = nextMedia;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showMessage(`Media Gateway load failed: ${errorMessage}`, "error");
  }
}

async function loadAuditLogs() {
  const response = await channelHubApi.getAuditLogs({
    adapterId: auditAdapterFilter.value || undefined,
    limit: 100,
  }, {
    showLoader: false,
    loadingKey: "channelhub.audit.load",
  });
  auditLogs.value = response.data || [];
}

async function loadAll() {
  try {
    await Promise.all([
      loadOverview(),
      loadAdapters(),
      loadBindings(),
      loadOutbox(),
      loadDeadLetters(),
      loadAuditLogs(),
    ]);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showMessage(`ChannelHub 加载失败：${errorMessage}`, "error");
  }
}

function resetAdapterForm() {
  editingAdapterId.value = "";
  adapterForm.value = createAdapterForm();
}

function editAdapter(adapter: ChannelHubAdapter) {
  editingAdapterId.value = adapter.adapterId;
  adapterForm.value = {
    adapterId: adapter.adapterId,
    channel: adapter.channel || "",
    name: adapter.name || adapter.adapterId,
    status: isAdapterActive(adapter) ? "active" : "inactive",
    configText: formatJson(adapter.config),
  };
}

async function saveAdapter() {
  try {
    const payload = {
      adapterId: adapterForm.value.adapterId,
      channel: adapterForm.value.channel,
      name: adapterForm.value.name || adapterForm.value.adapterId,
      status: adapterForm.value.status,
      config: parseJsonObject(adapterForm.value.configText),
    };

    if (editingAdapterId.value) {
      await channelHubApi.updateAdapter(editingAdapterId.value, payload, {
        loadingKey: "channelhub.adapter.save",
      });
    } else {
      await channelHubApi.createAdapter(payload, {
        loadingKey: "channelhub.adapter.create",
      });
    }

    resetAdapterForm();
    await Promise.all([loadAdapters(), loadOverview()]);
    showMessage("Adapter 已保存", "success");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showMessage(`保存 Adapter 失败：${errorMessage}`, "error");
  }
}

async function toggleAdapter(adapter: ChannelHubAdapter) {
  const nextEnabled = !isAdapterActive(adapter);
  await channelHubApi.setAdapterEnabled(adapter.adapterId, nextEnabled, {
    loadingKey: "channelhub.adapter.toggle",
  });
  await Promise.all([loadAdapters(), loadOverview()]);
  showMessage(nextEnabled ? "Adapter 已启用" : "Adapter 已停用", "success");
}

async function testAdapter(adapter: ChannelHubAdapter) {
  const result = await channelHubApi.testAdapter(adapter.adapterId, {
    loadingKey: "channelhub.adapter.test",
  });
  showMessage(String(result.message || "Adapter 测试完成"), result.success === false ? "error" : "success");
}

async function deleteAdapter(adapter: ChannelHubAdapter) {
  if (!window.confirm(`删除 Adapter ${adapter.adapterId}？`)) return;
  await channelHubApi.deleteAdapter(adapter.adapterId, {
    loadingKey: "channelhub.adapter.delete",
  });
  await Promise.all([loadAdapters(), loadOverview()]);
  showMessage("Adapter 已删除", "success");
}

function resetBindingForm() {
  editingBindingKey.value = "";
  bindingForm.value = createBindingForm();
}

function editBinding(binding: ChannelHubBinding) {
  editingBindingKey.value = binding.bindingKey;
  bindingForm.value = {
    bindingKey: binding.bindingKey,
    adapterId: binding.adapterId,
    channel: binding.channel || "",
    externalSessionKey: binding.externalSessionKey || "",
    agentId: binding.agentId || "",
    isActive: binding.isActive !== false,
  };
}

async function saveBinding() {
  try {
    await channelHubApi.saveBinding({
      bindingKey: bindingForm.value.bindingKey,
      adapterId: bindingForm.value.adapterId,
      channel: bindingForm.value.channel || undefined,
      externalSessionKey: bindingForm.value.externalSessionKey || undefined,
      agentId: bindingForm.value.agentId || undefined,
      isActive: bindingForm.value.isActive,
    }, editingBindingKey.value, {
      loadingKey: "channelhub.binding.save",
    });
    resetBindingForm();
    await Promise.all([loadBindings(), loadOverview()]);
    showMessage("绑定已保存", "success");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showMessage(`保存绑定失败：${errorMessage}`, "error");
  }
}

async function deleteBinding(binding: ChannelHubBinding) {
  if (!window.confirm(`删除绑定 ${binding.bindingKey}？`)) return;
  await channelHubApi.deleteBinding(binding.bindingKey, {
    loadingKey: "channelhub.binding.delete",
  });
  await Promise.all([loadBindings(), loadOverview()]);
  showMessage("绑定已删除", "success");
}

async function retryOutboxJob(job: ChannelHubOutboxJob) {
  const jobId = getJobId(job);
  if (!jobId) return;
  await channelHubApi.retryOutboxJob(jobId, {
    loadingKey: "channelhub.outbox.retry",
  });
  await Promise.all([loadOutbox(), loadDeadLetters(), loadOverview()]);
  showMessage("重试任务已提交", "success");
}

async function deleteOutboxJob(job: ChannelHubOutboxJob) {
  const jobId = getJobId(job);
  if (!jobId || !window.confirm(`取消发件箱任务 ${jobId}？`)) return;
  await channelHubApi.deleteOutboxJob(jobId, {
    loadingKey: "channelhub.outbox.delete",
  });
  await Promise.all([loadOutbox(), loadOverview()]);
  showMessage("发件箱任务已取消", "success");
}

async function cleanupDeadLetters() {
  await channelHubApi.cleanupDeadLetters(undefined, {
    loadingKey: "channelhub.deadletters.cleanup",
  });
  await Promise.all([loadDeadLetters(), loadOverview()]);
  showMessage("死信清理已完成", "success");
}

async function inspectMedia(media: ChannelHubMediaItem) {
  const mediaId = getMediaId(media);
  if (!mediaId) return;
  const detail = await channelHubApi.getMediaDetail(mediaId, {
    loadingKey: "channelhub.media.detail",
  });
  window.alert(JSON.stringify(detail, null, 2));
}

async function showSignedMediaUrl(media: ChannelHubMediaItem) {
  const mediaId = getMediaId(media);
  if (!mediaId) return;
  const access = await channelHubApi.getSignedMediaUrl(mediaId, 3600, {
    loadingKey: "channelhub.media.signedUrl",
  });
  window.prompt("Signed URL", String(access.url || ""));
}

async function deleteMedia(media: ChannelHubMediaItem) {
  const mediaId = getMediaId(media);
  if (!mediaId || !window.confirm(`Delete media ${mediaId}?`)) return;
  await channelHubApi.deleteMedia(mediaId, {
    loadingKey: "channelhub.media.delete",
  });
  await loadMediaGateway();
  showMessage("Media deleted", "success");
}

async function cleanupMedia() {
  const input = window.prompt("Keep media for how many days?", "7");
  if (input === null) return;
  const maxAge = Number.parseInt(input, 10);
  if (!Number.isFinite(maxAge) || maxAge < 0) {
    showMessage("Cleanup days must be a non-negative integer", "warning");
    return;
  }
  await channelHubApi.cleanupMedia(maxAge, {
    loadingKey: "channelhub.media.cleanup",
  });
  await loadMediaGateway();
  showMessage("Media cleanup completed", "success");
}

onMounted(() => {
  void loadAll();
});
</script>

<style scoped>
.channelhub-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.channelhub-header,
.card-heading,
.header-actions,
.row-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.channelhub-header,
.card-heading {
  justify-content: space-between;
}

.channelhub-header h2,
.card-heading h3 {
  margin: 0;
}

.eyebrow {
  color: var(--highlight-text);
  font-size: var(--font-size-helper);
  font-weight: 700;
  text-transform: uppercase;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: var(--space-3);
}

.summary-card {
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--secondary-bg);
}

.summary-card span {
  display: block;
  color: var(--secondary-text);
  font-size: var(--font-size-helper);
}

.summary-card strong {
  display: block;
  margin-top: var(--space-2);
  font-size: var(--font-size-display);
}

.summary-card.warning strong {
  color: var(--warning-color);
}

.media-stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.media-stat {
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--secondary-bg);
}

.media-stat span {
  display: block;
  color: var(--secondary-text);
  font-size: var(--font-size-helper);
}

.media-stat strong {
  display: block;
  margin-top: var(--space-1);
}

.tab-strip {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.tab-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--secondary-bg);
  color: var(--primary-text);
  cursor: pointer;
}

.tab-button.active {
  border-color: var(--highlight-text);
  background: var(--info-bg);
  color: var(--highlight-text);
}

.panel-grid {
  display: grid;
  grid-template-columns: minmax(320px, 0.8fr) minmax(0, 1.2fr);
  gap: var(--space-4);
}

.editor-card,
.table-card {
  padding: var(--space-5);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.field span,
.switch-row > span {
  font-weight: 600;
}

.field input,
.field textarea,
.field select,
.card-heading select {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  color: var(--primary-text);
  font: inherit;
}

.field textarea {
  resize: vertical;
  font-family: Consolas, Monaco, monospace;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-4);
}

.table-wrap {
  margin-top: var(--space-4);
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
}

th,
td {
  padding: var(--space-3);
  border-bottom: 1px solid var(--border-color);
  text-align: left;
  vertical-align: top;
}

th {
  color: var(--secondary-text);
  font-size: var(--font-size-helper);
  font-weight: 700;
}

td small {
  display: block;
  margin-top: var(--space-1);
  color: var(--secondary-text);
}

.row-actions {
  flex-wrap: wrap;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-helper);
}

.status-pill.ok {
  color: var(--success-color);
  background: var(--success-bg);
}

.status-pill.muted {
  color: var(--secondary-text);
  background: var(--input-bg);
}

.muted,
.empty-note {
  color: var(--secondary-text);
}

.empty-note {
  margin-top: var(--space-4);
}

.error-cell {
  max-width: 380px;
  color: var(--danger-color);
}

@media (max-width: 980px) {
  .summary-grid,
  .media-stats,
  .panel-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .channelhub-header,
  .card-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>

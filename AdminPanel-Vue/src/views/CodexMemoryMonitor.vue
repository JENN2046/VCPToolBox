<template>
  <section class="config-section active-section codex-memory-monitor">
    <header class="monitor-header card">
      <div class="monitor-header__title">
        <span class="material-symbols-outlined">memory</span>
        <div>
          <h2>Codex 记忆监控</h2>
          <p>{{ recallMessage }}</p>
        </div>
      </div>

      <button type="button" class="btn-secondary monitor-header__refresh" @click="loadOverview">
        <span class="material-symbols-outlined">refresh</span>
        刷新
      </button>
    </header>

    <div v-if="isLoading" class="monitor-state card">
      <span class="material-symbols-outlined">hourglass_top</span>
      <strong>正在读取 Codex 记忆状态</strong>
    </div>

    <div v-else-if="loadError" class="monitor-state monitor-state--error card">
      <span class="material-symbols-outlined">error</span>
      <strong>{{ loadError }}</strong>
      <button type="button" class="btn-secondary" @click="loadOverview">重试</button>
    </div>

    <template v-else>
      <section class="metric-grid" aria-label="Codex memory metrics">
        <article v-for="metric in metrics" :key="metric.label" class="metric-card card">
          <span class="metric-card__label">{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <small>{{ metric.detail }}</small>
        </article>
      </section>

      <section class="monitor-grid">
        <article class="monitor-panel card">
          <header class="monitor-panel__header">
            <div>
              <span class="panel-kicker">Adaptive</span>
              <h3>自适应调参</h3>
            </div>
          </header>

          <div class="profile-list">
            <section
              v-for="profile in adaptiveProfiles"
              :key="profile.dbName"
              class="profile-row"
            >
              <div class="profile-row__main">
                <div class="profile-row__title">
                  <strong>{{ profile.dbName }}</strong>
                  <span :class="['status-pill', `status-pill--${profile.status}`]">
                    {{ getStatusLabel(profile.status) }}
                  </span>
                </div>
                <p>{{ profile.reasons[0] || "暂无调参建议" }}</p>
              </div>

              <div class="profile-row__metrics">
                <span>命中率 {{ formatPercent(profile.hitRate) }}</span>
                <span>阈值 {{ formatDelta(profile.thresholdDelta) }}</span>
                <span>K {{ formatDelta(profile.kDelta) }}</span>
              </div>
            </section>
          </div>
        </article>

        <article class="monitor-panel card">
          <header class="monitor-panel__header">
            <div>
              <span class="panel-kicker">Tags</span>
              <h3>标签贡献</h3>
            </div>
          </header>

          <div class="compact-table">
            <div class="compact-table__head compact-table__row">
              <span>标签</span>
              <span>目标</span>
              <span>命中</span>
              <span>均分</span>
            </div>
            <div
              v-for="tag in tagContributions"
              :key="`${tag.dbName}-${tag.tag}`"
              class="compact-table__row"
            >
              <span class="mono">{{ tag.tag }}</span>
              <span>{{ getTargetLabel(tag.target) }}</span>
              <span>{{ tag.hitCount }}</span>
              <span>{{ formatScore(tag.avgTopScore) }}</span>
            </div>
            <p v-if="tagContributions.length === 0" class="empty-note">暂无标签命中样本。</p>
          </div>
        </article>
      </section>

      <article class="monitor-panel card">
        <header class="monitor-panel__header">
          <div>
            <span class="panel-kicker">Recall</span>
            <h3>最近召回</h3>
          </div>
          <span class="path-chip">{{ safePath(overview?.paths.recallLogPath) }}</span>
        </header>

        <div class="wide-table">
          <div class="wide-table__head wide-table__row">
            <span>时间</span>
            <span>目标</span>
            <span>类型</span>
            <span>结果</span>
            <span>最高分</span>
            <span>记忆</span>
            <span>标签</span>
          </div>
          <div
            v-for="entry in recentRecall"
            :key="`${entry.timestamp}-${entry.topMemoryId}-${entry.recallType}`"
            class="wide-table__row"
          >
            <span>{{ formatDate(entry.timestamp) }}</span>
            <span>{{ getTargetLabel(entry.target) }}</span>
            <span>{{ getRecallTypeLabel(entry.recallType) }}</span>
            <span>{{ entry.resultCount }}</span>
            <span>{{ formatScore(entry.topScore) }}</span>
            <span class="mono">{{ entry.topMemoryId || safePath(entry.topSourceFile) }}</span>
            <span>{{ joinTags(entry.matchedTags) }}</span>
          </div>
          <p v-if="recentRecall.length === 0" class="empty-note">暂无召回审计记录。</p>
        </div>
      </article>

      <section class="monitor-grid">
        <article class="monitor-panel card">
          <header class="monitor-panel__header">
            <div>
              <span class="panel-kicker">Links</span>
              <h3>写入与召回关联</h3>
            </div>
          </header>

          <div class="link-list">
            <section
              v-for="item in memoryLinks"
              :key="item.memoryId || item.filePath || item.title"
              class="link-row"
            >
              <div>
                <strong>{{ item.title }}</strong>
                <p class="mono">{{ item.memoryId || safePath(item.filePath) }}</p>
              </div>
              <div class="link-row__stats">
                <span>{{ item.recallCount }} 次召回</span>
                <span>{{ formatScore(item.lastTopScore) }}</span>
              </div>
            </section>
            <p v-if="memoryLinks.length === 0" class="empty-note">暂无可关联的记忆写入。</p>
          </div>
        </article>

        <article class="monitor-panel card">
          <header class="monitor-panel__header">
            <div>
              <span class="panel-kicker">Guard</span>
              <h3>拒绝原因</h3>
            </div>
          </header>

          <div class="reason-list">
            <section v-for="reason in rejectionReasons" :key="reason.reason" class="reason-row">
              <span>{{ reason.reason }}</span>
              <strong>{{ reason.count }}</strong>
            </section>
            <p v-if="rejectionReasons.length === 0" class="empty-note">当前窗口无拒绝记录。</p>
          </div>
        </article>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  codexMemoryApi,
  type CodexMemoryOverview,
  type CodexMemoryRecallEntry,
} from "@/api";
import { showMessage } from "@/utils";

const overview = ref<CodexMemoryOverview | null>(null);
const isLoading = ref(true);
const loadError = ref("");

const summary = computed(() => overview.value?.summary);
const recallSummary = computed(() => overview.value?.recall.summary);
const adaptiveProfiles = computed(() => overview.value?.adaptive.profiles ?? []);
const tagContributions = computed(() => overview.value?.adaptive.tagContribution.flat ?? []);
const recentRecall = computed<CodexMemoryRecallEntry[]>(() => overview.value?.recall.recent ?? []);
const memoryLinks = computed(() => overview.value?.memoryLinks ?? []);
const rejectionReasons = computed(() => overview.value?.rejectionReasons ?? []);
const recallMessage = computed(() => overview.value?.recall.message ?? "只读统计视图");

const metrics = computed(() => [
  {
    label: "已接收写入",
    value: formatInteger(summary.value?.accepted),
    detail: `流程 ${formatInteger(summary.value?.processAccepted)} / 知识 ${formatInteger(summary.value?.knowledgeAccepted)}`,
  },
  {
    label: "已拒绝写入",
    value: formatInteger(summary.value?.rejected),
    detail: `敏感拦截 ${formatInteger(summary.value?.sensitiveRejected)}`,
  },
  {
    label: "召回命中",
    value: formatInteger(recallSummary.value?.totalHits),
    detail: `流程 ${formatInteger(recallSummary.value?.processHits)} / 知识 ${formatInteger(recallSummary.value?.knowledgeHits)}`,
  },
  {
    label: "缓存召回",
    value: formatInteger(recallSummary.value?.cacheHits),
    detail: `最新 ${formatDate(recallSummary.value?.latestHitAt)}`,
  },
]);

function formatInteger(value: number | null | undefined): string {
  return Number.isFinite(value) ? String(value) : "0";
}

function formatScore(value: number | null | undefined): string {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return Number(value).toFixed(3).replace(/\.?0+$/, "");
}

function formatPercent(value: number | null | undefined): string {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return `${Math.round(Number(value) * 100)}%`;
}

function formatDelta(value: number | null | undefined): string {
  if (!Number.isFinite(value) || Number(value) === 0) {
    return "0";
  }

  return `${Number(value) > 0 ? "+" : ""}${formatScore(value)}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safePath(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }

  const parts = value.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.slice(-2).join("/") || value;
}

function joinTags(tags: string[]): string {
  if (!Array.isArray(tags) || tags.length === 0) {
    return "--";
  }

  return tags.slice(0, 4).join(", ");
}

function getTargetLabel(target: string | null | undefined): string {
  if (target === "process") return "流程";
  if (target === "knowledge") return "知识";
  return "--";
}

function getRecallTypeLabel(type: string): string {
  if (type === "snippet") return "片段";
  if (type === "full_text") return "全文";
  if (type === "direct") return "直引";
  return type || "--";
}

function getStatusLabel(status: string): string {
  if (status === "boosted") return "增强";
  if (status === "steady") return "稳定";
  if (status === "warming") return "预热";
  if (status === "disabled") return "关闭";
  return status || "--";
}

async function loadOverview(): Promise<void> {
  isLoading.value = true;
  loadError.value = "";

  try {
    overview.value = await codexMemoryApi.getOverview(
      { limit: 12, auditWindow: 500 },
      {
        showLoader: false,
        loadingKey: "codex-memory.overview.load",
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    loadError.value = `读取失败：${errorMessage}`;
    showMessage(loadError.value, "error");
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  void loadOverview();
});
</script>

<style scoped>
.codex-memory-monitor {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.monitor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5);
  border-radius: var(--radius-xl);
}

.monitor-header__title {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
}

.monitor-header__title .material-symbols-outlined {
  font-size: var(--font-size-section-icon);
  color: var(--highlight-text);
}

.monitor-header h2,
.monitor-header p,
.monitor-panel h3,
.profile-row p,
.link-row p,
.empty-note {
  margin: 0;
}

.monitor-header p,
.profile-row p,
.link-row p,
.empty-note {
  color: var(--secondary-text);
}

.monitor-header__refresh {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  white-space: nowrap;
}

.monitor-state {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5);
  border-radius: var(--radius-xl);
}

.monitor-state--error {
  justify-content: space-between;
  border-color: var(--danger-border);
  background: var(--danger-bg);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}

.metric-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-height: 120px;
  padding: var(--space-5);
  border-radius: var(--radius-xl);
}

.metric-card__label,
.panel-kicker {
  color: var(--highlight-text);
  font-size: var(--font-size-caption);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.metric-card strong {
  font-size: var(--font-size-display);
  line-height: 1;
}

.metric-card small {
  color: var(--secondary-text);
}

.monitor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5);
}

.monitor-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  border-radius: var(--radius-xl);
  min-width: 0;
}

.monitor-panel__header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--space-4);
}

.path-chip {
  max-width: 280px;
  padding: 7px 10px;
  border-radius: var(--radius-full);
  background: var(--surface-overlay-soft);
  color: var(--secondary-text);
  font-family: "Consolas", "Monaco", monospace;
  font-size: var(--font-size-helper);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-list,
.link-list,
.reason-list {
  display: grid;
  gap: var(--space-3);
}

.profile-row,
.link-row,
.reason-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-overlay-soft);
}

.profile-row__main,
.link-row > div:first-child {
  min-width: 0;
}

.profile-row__title,
.profile-row__metrics,
.link-row__stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.profile-row__metrics,
.link-row__stats {
  justify-content: flex-end;
  color: var(--secondary-text);
  font-size: var(--font-size-helper);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: var(--radius-full);
  background: var(--surface-overlay);
  color: var(--secondary-text);
  font-size: var(--font-size-caption);
  font-weight: 700;
}

.status-pill--boosted {
  background: var(--info-bg);
  color: var(--info-text);
}

.status-pill--steady {
  background: var(--success-bg);
  color: var(--success-text);
}

.status-pill--warming {
  background: var(--warning-bg);
  color: var(--warning-text);
}

.status-pill--disabled {
  background: var(--danger-bg);
  color: var(--danger-text);
}

.compact-table,
.wide-table {
  display: grid;
  overflow-x: auto;
}

.compact-table__row,
.wide-table__row {
  display: grid;
  gap: var(--space-3);
  align-items: center;
  min-width: 0;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}

.compact-table__row {
  grid-template-columns: minmax(140px, 1fr) 72px 72px 72px;
}

.wide-table__row {
  grid-template-columns: 120px 72px 72px 72px 80px minmax(160px, 1fr) minmax(160px, 1fr);
  min-width: 860px;
}

.compact-table__head,
.wide-table__head {
  color: var(--secondary-text);
  font-size: var(--font-size-helper);
  font-weight: 700;
}

.mono {
  font-family: "Consolas", "Monaco", monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-note {
  padding: var(--space-4) 0 0;
}

.reason-row {
  grid-template-columns: minmax(0, 1fr) 48px;
}

.reason-row strong {
  text-align: right;
}

@media (max-width: 1180px) {
  .metric-grid,
  .monitor-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .monitor-header,
  .monitor-panel__header,
  .profile-row,
  .link-row,
  .reason-row {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }

  .metric-grid,
  .monitor-grid {
    grid-template-columns: 1fr;
  }

  .monitor-header__refresh,
  .path-chip {
    width: 100%;
  }
}
</style>

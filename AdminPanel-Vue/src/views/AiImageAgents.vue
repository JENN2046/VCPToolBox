<template>
  <section class="config-section active-section">
    <div class="ai-image-page">
      <h2 class="page-title">AI Image Agent Dry-Run</h2>

      <form class="dry-run-form" @submit.prevent="handleDryRun">
        <div class="form-group">
          <label for="pipeline-id">Pipeline ID</label>
          <input
            id="pipeline-id"
            v-model="pipelineId"
            type="text"
            placeholder="例如：my-pipeline-001"
          />
        </div>

        <div class="form-group">
          <label for="task-id">Task ID</label>
          <input
            id="task-id"
            v-model="taskId"
            type="text"
            placeholder="例如：my-task-001"
          />
        </div>

        <div class="form-group">
          <label for="plan-json">Plan JSON</label>
          <textarea
            id="plan-json"
            v-model="planJson"
            rows="6"
            placeholder='{ "steps": [] }'
          ></textarea>
          <span v-if="planParseError" class="field-error">{{ planParseError }}</span>
        </div>

        <button
          type="submit"
          class="dry-run-btn"
          :disabled="isLoading || planParseError !== null"
        >
          <span v-if="isLoading" class="loading-spinner-sm"></span>
          <span v-else class="material-symbols-outlined">play_arrow</span>
          Dry Run
        </button>
      </form>

      <div v-if="errorMessage" class="result-error">
        <span class="material-symbols-outlined">error</span>
        {{ errorMessage }}
      </div>

      <div v-if="result" class="result-panel">
        <h3>返回结果</h3>

        <div class="result-grid">
          <div class="result-item">
            <span class="result-label">Status</span>
            <span :class="['result-value', 'badge', result.ok ? 'badge-ok' : 'badge-fail']">
              {{ result.status || '-' }}
            </span>
          </div>
          <div class="result-item">
            <span class="result-label">Mode</span>
            <span class="result-value">{{ result.mode || '-' }}</span>
          </div>
        </div>

        <details v-if="result.state" class="result-section">
          <summary>State</summary>
          <pre>{{ formatJson(result.state) }}</pre>
        </details>

        <details v-if="result.safety" class="result-section">
          <summary>Safety</summary>
          <pre>{{ formatJson(result.safety) }}</pre>
        </details>

        <details v-if="result.audit" class="result-section">
          <summary>Audit</summary>
          <pre>{{ formatJson(result.audit) }}</pre>
        </details>

        <details v-if="result.error" class="result-section result-section-error">
          <summary>Error</summary>
          <pre>{{ result.error }}</pre>
        </details>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { aiImageAgentsApi, type AiImageDryRunResult } from "@/api/aiImageAgents";

const pipelineId = ref("");
const taskId = ref("");
const planJson = ref('{\n  "steps": []\n}');
const isLoading = ref(false);
const result = ref<AiImageDryRunResult | null>(null);
const errorMessage = ref("");

const planParseError = computed(() => {
  if (!planJson.value.trim()) return null;
  try {
    JSON.parse(planJson.value);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
});

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function handleDryRun() {
  errorMessage.value = "";
  result.value = null;

  let plan: Record<string, unknown>;
  try {
    plan = JSON.parse(planJson.value);
  } catch {
    errorMessage.value = "Plan JSON 格式无效";
    return;
  }

  isLoading.value = true;
  try {
    const res = await aiImageAgentsApi.dryRun(
      {
        pipelineId: pipelineId.value || "default-pipeline",
        taskId: taskId.value || "default-task",
        plan,
      },
      {},
      { showLoader: false }
    );
    result.value = res;
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e);
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
.ai-image-page {
  max-width: 780px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}

.page-title {
  font-size: var(--font-size-heading);
  font-weight: 600;
  color: var(--primary-text);
  margin-bottom: var(--space-6);
}

.dry-run-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-group label {
  font-size: var(--font-size-helper);
  font-weight: 500;
  color: var(--secondary-text);
}

.form-group input,
.form-group textarea {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--input-bg, var(--tertiary-bg));
  color: var(--primary-text);
  font-size: var(--font-size-body);
  font-family: inherit;
  resize: vertical;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--highlight-text);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.field-error {
  font-size: var(--font-size-helper);
  color: #fca5a5;
}

.dry-run-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  background: var(--button-bg);
  color: var(--on-accent-text);
  font-size: var(--font-size-body);
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.dry-run-btn:hover:not(:disabled) {
  background: var(--button-hover-bg);
}

.dry-run-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.result-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
  font-size: var(--font-size-body);
  margin-bottom: var(--space-4);
}

.result-panel {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: var(--space-5);
  background: var(--secondary-bg);
}

.result-panel h3 {
  font-size: var(--font-size-emphasis);
  color: var(--primary-text);
  margin-bottom: var(--space-4);
}

.result-grid {
  display: flex;
  gap: var(--space-6);
  margin-bottom: var(--space-4);
}

.result-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.result-label {
  font-size: var(--font-size-helper);
  color: var(--secondary-text);
}

.result-value {
  font-size: var(--font-size-body);
  color: var(--primary-text);
}

.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: var(--font-size-helper);
  font-weight: 600;
}

.badge-ok {
  background: rgba(34, 197, 94, 0.15);
  color: #86efac;
}

.badge-fail {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
}

.result-section {
  margin-top: var(--space-3);
}

.result-section summary {
  cursor: pointer;
  font-size: var(--font-size-body);
  font-weight: 500;
  color: var(--secondary-text);
  padding: var(--space-1) 0;
}

.result-section summary:hover {
  color: var(--primary-text);
}

.result-section pre {
  margin-top: var(--space-2);
  padding: var(--space-3);
  background: var(--tertiary-bg);
  border-radius: 6px;
  font-size: var(--font-size-code);
  color: var(--primary-text);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 400px;
  overflow-y: auto;
}

.result-section-error summary {
  color: #fca5a5;
}

.result-section-error pre {
  color: #fca5a5;
}

.loading-spinner-sm {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 480px) {
  .result-grid {
    flex-direction: column;
    gap: var(--space-3);
  }
}
</style>

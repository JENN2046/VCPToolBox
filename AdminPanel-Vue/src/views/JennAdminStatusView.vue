<template>
  <section class="jenn-admin-status-view">
    <header class="jenn-admin-status-view__header">
      <span class="material-symbols-outlined" aria-hidden="true">monitor_heart</span>
      <div>
        <h2>Jenn Admin Status</h2>
        <p>Reviewed AdminPanel extension route, registered as a static frontend entry.</p>
      </div>
    </header>

    <dl class="jenn-admin-status-view__facts">
      <div>
        <dt>Extension</dt>
        <dd>jenn.admin.status</dd>
      </div>
      <div>
        <dt>Backend route</dt>
        <dd>/admin_api/jenn-admin-status/status</dd>
      </div>
      <div>
        <dt>Runtime mode</dt>
        <dd>read-only</dd>
      </div>
      <div>
        <dt>Writes</dt>
        <dd>disabled</dd>
      </div>
      <div>
        <dt>Local proof</dt>
        <dd>M57 production-server smoke PASS</dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
defineOptions({
  name: "JennAdminStatusView",
});
</script>

<style scoped>
.jenn-admin-status-view {
  display: grid;
  gap: 16px;
}

.jenn-admin-status-view__header {
  align-items: center;
  display: flex;
  gap: 12px;
}

.jenn-admin-status-view__header .material-symbols-outlined {
  color: var(--accent-color, #79b8ff);
  font-size: var(--font-size-icon-hero);
}

.jenn-admin-status-view__header h2 {
  margin: 0;
}

.jenn-admin-status-view__header p {
  color: var(--text-muted, #657083);
  margin: 4px 0 0;
}

.jenn-admin-status-view__facts {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.jenn-admin-status-view__facts div {
  border: 1px solid var(--border-color, #d8dee8);
  border-radius: 6px;
  padding: 12px;
}

.jenn-admin-status-view__facts dt {
  color: var(--text-muted, #657083);
  font-size: var(--font-size-helper);
}

.jenn-admin-status-view__facts dd {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
}
</style>

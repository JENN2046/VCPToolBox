'use strict';
(() => {
  const base = '/admin_api/channelHub';
  const byId = id => document.getElementById(id);
  let busy = false;
  const text = (node, value) => { node.textContent = String(value ?? '–'); };
  function notify(message, isError = false) {
    const target = byId('message');
    text(target, message);
    target.classList.toggle('error', Boolean(isError));
  }
  async function api(endpoint, options = {}) {
    const response = await fetch(base + endpoint, {
      credentials: 'same-origin',
      ...options,
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.success === false) {
      throw new Error(data?.error || data?.message || 'HTTP ' + response.status);
    }
    return data.data === undefined ? data : data.data;
  }
  function emptyRow(tbody, colspan, message) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = colspan;
    td.className = 'empty';
    text(td, message);
    tr.append(td);
    tbody.append(tr);
  }
  function makeCell(tr, label, secondary) {
    const td = document.createElement('td');
    text(td, label);
    if (secondary) {
      const sub = document.createElement('span');
      sub.className = 'sub';
      text(sub, secondary);
      td.append(sub);
    }
    tr.append(td);
    return td;
  }
  function action(label, onClick, danger = false) {
    const b = document.createElement('button');
    b.className = 'small' + (danger ? ' danger' : '');
    b.type = 'button';
    text(b, label);
    b.addEventListener('click', () => onClick().catch(error => notify(error.message, true)));
    return b;
  }
  async function editAdapter(item, operation) {
    const id = encodeURIComponent(item.adapterId);
    if (operation === 'delete' && !confirm('确认删除适配器 ' + item.adapterId + '？此操作不删除其他插件或历史数据。')) return;
    if (busy) return;
    busy = true;
    try {
      const endpoint = '/adapters/' + id + (operation === 'delete' ? '' : '/' + operation);
      await api(endpoint, { method: operation === 'delete' ? 'DELETE' : 'POST' });
      notify('操作成功：' + item.adapterId);
      await refresh();
    } finally { busy = false; }
  }
  function displayAdapters(adapters) {
    const tbody = byId('adapterRows');
    tbody.replaceChildren();
    const rows = Array.isArray(adapters) ? adapters : [];
    text(byId('adapterCount'), rows.length);
    if (!rows.length) return emptyRow(tbody, 4, '暂无适配器。新建后再配置平台回调。');
    rows.forEach(item => {
      const tr = document.createElement('tr');
      makeCell(tr, item.name || item.adapterId, item.adapterId);
      makeCell(tr, item.channel);
      const state = makeCell(tr, item.status || 'unknown');
      state.className = 'state ' + (item.status === 'active' ? 'active' : '');
      const td = document.createElement('td');
      const toggle = item.status === 'active' ? 'disable' : 'enable';
      td.append(action(toggle === 'enable' ? '启用' : '停用', () => editAdapter(item, toggle)));
      td.append(action('删除', () => editAdapter(item, 'delete'), true));
      tr.append(td);
      tbody.append(tr);
    });
  }
  function displayBindings(bindings) {
    const tbody = byId('bindingRows');
    tbody.replaceChildren();
    const rows = Array.isArray(bindings) ? bindings : [];
    text(byId('bindingCount'), rows.length);
    if (!rows.length) return emptyRow(tbody, 3, '暂无会话绑定。');
    rows.forEach(item => {
      const tr = document.createElement('tr');
      makeCell(tr, item.bindingKey || item.externalSessionKey);
      makeCell(tr, item.adapterId);
      makeCell(tr, item.agentId);
      tbody.append(tr);
    });
  }
  async function refresh() {
    const [health, metrics, adapters, bindings] = await Promise.allSettled([
      api('/health'), api('/metrics'), api('/adapters'), api('/bindings')
    ]);
    text(byId('health'), health.status === 'fulfilled' ? health.value.status : '获取失败');
    text(byId('processed'), metrics.status === 'fulfilled' ? metrics.value.eventsProcessed : '–');
    if (adapters.status === 'fulfilled') displayAdapters(adapters.value);
    if (bindings.status === 'fulfilled') displayBindings(bindings.value);
    const errors = [health, metrics, adapters, bindings].filter(x => x.status === 'rejected');
    if (errors.length) notify('部分信息加载失败：' + errors.map(x => x.reason.message).join('；'), true);
    else notify('状态已更新');
  }
  byId('refresh').addEventListener('click', () => refresh().catch(error => notify(error.message, true)));
  byId('adapterForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const payload = {
      adapterId: String(values.get('adapterId') || '').trim(),
      channel: String(values.get('channel') || '').trim().toLowerCase(),
      config: { bridgeKey: String(values.get('bridgeKey') || '') },
      status: 'inactive'
    };
    if (!payload.adapterId || payload.config.bridgeKey.length < 16) return notify('请输入适配器 ID 和至少 16 位的独立密钥', true);
    if (!/^[a-z][a-z0-9_-]{0,39}$/.test(payload.channel)) return notify('渠道类型只能使用小写字母、数字、下划线和连字符', true);
    busy = true;
    try {
      await api('/adapters', { method: 'POST', body: JSON.stringify(payload) });
      form.reset();
      notify('适配器已创建（默认关闭）');
      await refresh();
    } catch (error) { notify(error.message, true); }
    finally { busy = false; }
  });
  refresh().catch(error => notify(error.message, true));
})();

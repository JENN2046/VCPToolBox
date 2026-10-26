'use strict';
(() => {
  const base = '/admin_api/channelHub';
  const byId = id => document.getElementById(id);
  const text = (node, value) => { node.textContent = String(value ?? '–'); };
  let busy = false;
  let agents = [];
  let editing = null;

  function notify(message, isError = false) {
    const target = byId('message');
    text(target, message);
    target.classList.toggle('error', Boolean(isError));
  }

  async function api(endpoint, options = {}) {
    const response = await fetch(base + endpoint, {
      credentials: 'same-origin',
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.success === false) {
      throw new Error(data?.error || data?.message || 'HTTP ' + response.status);
    }
    return data.data === undefined ? data : data.data;
  }

  function fillAgentOptions(select, selected = '', requireAgent = false) {
    select.replaceChildren();
    const fallback = document.createElement('option');
    fallback.value = '';
    text(fallback, requireAgent ? '请选择 VCP Agent' : '继承渠道原有路由');
    select.append(fallback);
    for (const agent of agents) {
      const option = document.createElement('option');
      option.value = agent.id;
      text(option, agent.name);
      select.append(option);
    }
    select.required = requireAgent;
    if (selected && !agents.some(item => item.id === selected)) {
      const missing = document.createElement('option');
      missing.value = selected;
      text(missing, selected + '（不在当前 VCP Agent 列表中）');
      missing.disabled = true;
      select.append(missing);
    }
    select.value = selected;
  }

  function readJson(textValue) {
    const value = textValue.trim() ? JSON.parse(textValue) : {};
    if (!value || Array.isArray(value) || typeof value !== 'object') throw Error('配置必须是 JSON 对象');
    return value;
  }

  function emptyRow(tbody, colspan, message) {
    const tr = document.createElement('tr'), td = document.createElement('td');
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
    const button = document.createElement('button');
    button.className = 'small' + (danger ? ' danger' : '');
    button.type = 'button';
    text(button, label);
    button.addEventListener('click', () => onClick().catch(error => notify(error.message, true)));
    return button;
  }

  async function editAdapter(item, operation) {
    const id = encodeURIComponent(item.adapterId);
    if (operation === 'delete' && !confirm('确认删除适配器 ' + item.adapterId + '？历史数据不会自动删除。')) return;
    if (busy) return;
    busy = true;
    try {
      const endpoint = '/adapters/' + id + (operation === 'delete' ? '' : '/' + operation);
      await api(endpoint, { method: operation === 'delete' ? 'DELETE' : 'POST' });
      if (editing?.adapterId === item.adapterId) closeEditor();
      await refresh();
      notify('操作成功：' + item.adapterId);
    } finally { busy = false; }
  }

  async function testAdapterConnection(item) {
    if (busy) return;
    busy = true;
    try {
      const result = await api('/adapters/' + encodeURIComponent(item.adapterId) + '/test', { method: 'POST' });
      notify(result.success
        ? '连接正常：' + item.adapterId
        : '连接未就绪：' + item.adapterId + ' (' + (result.message || '未连接') + ')',
        result.success !== true);
    } finally { busy = false; }
  }

  function closeEditor() {
    editing = null;
    byId('adapterEditor').hidden = true;
    byId('adapterEditForm').reset();
  }

  async function openEditor(item) {
    if (busy) return;
    busy = true;
    try {
      const adapter = await api('/adapters/' + encodeURIComponent(item.adapterId));
      editing = adapter;
      const form = byId('adapterEditForm');
      form.elements.namedItem('name').value = adapter.name || adapter.adapterId;
      form.elements.namedItem('configJson').value = JSON.stringify(adapter.config || {}, null, 2);
      form.elements.namedItem('bridgeKey').value = '';
      fillAgentOptions(byId('editAgent'), adapter.config?.agentId || '', adapter.channel === 'qq');
      text(byId('editHeading'), '编辑 ' + adapter.adapterId + ' (' + adapter.channel + ')');
      const secrets = adapter.configuredSecrets || [];
      text(byId('editHint'), (secrets.length ? '已保存的密钥字段：' + secrets.join('、') + '；留空保持不变。' : '当前没有需要回显的密钥。')
        + (adapter.status === 'active' ? ' 当前为运行状态：只能在线切换 Agent，连接、白名单和名称请先停用后修改。' : ' 当前已停用，可以修改 Agent 和连接参数。'));
      byId('adapterEditor').hidden = false;
      byId('adapterEditor').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } finally { busy = false; }
  }

  async function saveEditor(event) {
    event.preventDefault();
    if (busy || !editing) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    let config;
    try { config = readJson(String(data.get('configJson') || '')); }
    catch (error) { notify('渠道配置 JSON 无效：' + error.message, true); return; }
    const agentId = String(data.get('agentId') || '');
    const original = editing.config || {};
    if (editing.channel === 'qq' && !agentId) return notify('QQ 渠道必须绑定已存在的 VCP Agent', true);
    if (agentId) config.agentId = agentId;
    else delete config.agentId;

    const bridgeKey = String(data.get('bridgeKey') || '');
    if (bridgeKey && bridgeKey.length < 16) return notify('新的 Bridge Key 不能少于 16 位', true);
    if (bridgeKey) config.bridgeKey = bridgeKey;
    const name = String(data.get('name') || '').trim();
    const updatedKeys = Object.keys(config).filter(key => JSON.stringify(config[key]) !== JSON.stringify(original[key]));
    const deleted = Object.keys(original).some(key => !Object.hasOwn(config, key));
    const nameChanged = name !== editing.name;

    let patch;
    if (editing.status === 'active') {
      if (deleted || nameChanged || updatedKeys.length !== 1 || updatedKeys[0] !== 'agentId' || !agentId) {
        return notify('运行中的渠道只支持直接切换 Agent。其他配置请先停用该适配器后再编辑。', true);
      }
      patch = { config: { agentId } };
    } else {
      if (deleted) return notify('删除已有配置字段需手动清理；本页面保存会保留未提交字段，请用明确配置覆盖。', true);
      patch = { name, config };
    }
    patch.expectedUpdatedAt = editing.updatedAt;

    busy = true;
    try {
      await api('/adapters/' + encodeURIComponent(editing.adapterId), {
        method: 'PUT', body: JSON.stringify(patch)
      });
      const id = editing.adapterId;
      closeEditor();
      await refresh();
      notify('配置已保存：' + id + (patch.config?.agentId ? '，绑定 Agent ' + patch.config.agentId : ''));
    } catch (error) { notify('保存失败：' + error.message, true); }
    finally { busy = false; }
  }

  function displayAdapters(adapters) {
    const tbody = byId('adapterRows');
    tbody.replaceChildren();
    const rows = Array.isArray(adapters) ? adapters : [];
    text(byId('adapterCount'), rows.length);
    if (!rows.length) return emptyRow(tbody, 5, '暂无适配器。创建后再配置渠道连接。');
    rows.forEach(item => {
      const tr = document.createElement('tr');
      makeCell(tr, item.name || item.adapterId, item.adapterId);
      makeCell(tr, item.channel);
      makeCell(tr, item.config?.agentId || '原有渠道路由');
      const status = makeCell(tr, item.status || 'unknown');
      status.className = 'state ' + (item.status === 'active' ? 'active' : '');
      const td = document.createElement('td');
      td.append(action('编辑', () => openEditor(item)));
      const toggle = item.status === 'active' ? 'disable' : 'enable';
      td.append(action(toggle === 'enable' ? '启用' : '停用', () => editAdapter(item, toggle)));
      td.append(action('测试连接', () => testAdapterConnection(item)));
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
    const [health, metrics, adapters, bindings, catalog] = await Promise.allSettled([
      api('/health'), api('/metrics'), api('/adapters'), api('/bindings'), api('/agents')
    ]);
    text(byId('health'), health.status === 'fulfilled' ? health.value.status : '获取失败');
    text(byId('processed'), metrics.status === 'fulfilled' ? metrics.value.eventsProcessed : '–');
    if (catalog.status === 'fulfilled') {
      agents = Array.isArray(catalog.value.agents) ? catalog.value.agents : [];
      fillAgentOptions(byId('createAgent'), byId('createAgent').value);
    }
    if (adapters.status === 'fulfilled') displayAdapters(adapters.value);
    if (bindings.status === 'fulfilled') displayBindings(bindings.value);
    const errors = [health, metrics, adapters, bindings, catalog].filter(x => x.status === 'rejected');
    if (errors.length) notify('部分信息加载失败：' + errors.map(x => x.reason.message).join('；'), true);
    else notify('状态已更新');
  }

  byId('refresh').addEventListener('click', () => refresh().catch(error => notify(error.message, true)));
  byId('cancelEdit').addEventListener('click', closeEditor);
  byId('adapterEditForm').addEventListener('submit', saveEditor);
  byId('adapterForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget, values = new FormData(form);
    let config;
    try { config = readJson(String(values.get('configJson') || '')); }
    catch (error) { return notify('渠道配置 JSON 无效：' + error.message, true); }
    const bridgeKey = String(values.get('bridgeKey') || '');
    const channel = String(values.get('channel') || '').trim().toLowerCase();
    const agentId = String(values.get('agentId') || '');
    if (agentId) config.agentId = agentId;
    if (channel === 'qq' && !config.agentId) return notify('QQ 渠道必须指定一个现有 Agent', true);
    if (bridgeKey && bridgeKey.length < 16) return notify('Bridge Key 至少需要 16 位', true);
    if (bridgeKey) config.bridgeKey = bridgeKey;
    const payload = {
      adapterId: String(values.get('adapterId') || '').trim(),
      channel, config, status: 'inactive'
    };
    if (!payload.adapterId || Object.keys(config).length === 0) return notify('请输入适配器 ID 和渠道配置', true);
    if (!/^[a-z][a-z0-9_-]{0,39}$/.test(channel)) return notify('渠道类型只能使用小写字母、数字、下划线和连字符', true);

    busy = true;
    try {
      await api('/adapters', { method: 'POST', body: JSON.stringify(payload) });
      form.reset();
      notify('适配器已创建（默认关闭）；确认配置后再启用');
      await refresh();
    } catch (error) { notify(error.message, true); }
    finally { busy = false; }
  });

  refresh().catch(error => notify(error.message, true));
})();

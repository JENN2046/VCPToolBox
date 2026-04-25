/**
 * PhotoStudioDataStore — `photo_studio` re-baseline 共享数据层
 *
 * 采用 Guide 要求的 6 类核心数据实体：
 * customers / projects / tasks / status_log / content_pool / templates
 * 所有写操作保持原子写入，方便 staging/current 上的本地 shadow 数据验证。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_DATA_ROOT = __dirname;
const DATA_FILES = {
  customers: 'customers.json',
  projects: 'projects.json',
  tasks: 'tasks.json',
  statusLog: 'status_log.json',
  reminders: 'reminders.json',
  calendarEvents: 'calendar_events.json',
  archiveAssets: 'archive_assets.json',
  externalExports: 'external_exports.json',
  contentPool: 'content_pool.json',
  templates: 'templates.json'
};

const DEFAULT_FILE_CONTENT = {
  [DATA_FILES.customers]: {},
  [DATA_FILES.projects]: {},
  [DATA_FILES.tasks]: {},
  [DATA_FILES.statusLog]: [],
  [DATA_FILES.reminders]: {},
  [DATA_FILES.calendarEvents]: {},
  [DATA_FILES.archiveAssets]: {},
  [DATA_FILES.externalExports]: {},
  [DATA_FILES.contentPool]: {},
  [DATA_FILES.templates]: {}
};

function _clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function _pickContactValue(phone, wechat, email) {
  return String(phone || wechat || email || '').trim();
}

function _normalizeContactKey(name, contactValue) {
  const normalizedName = String(name || '').trim().toLowerCase();
  const normalizedContact = String(contactValue || '').trim().toLowerCase();
  return normalizedContact ? `${normalizedName}::${normalizedContact}` : normalizedName;
}

class PhotoStudioDataStore {
  constructor(options = {}) {
    this.dataRoot = options.dataRoot || DEFAULT_DATA_ROOT;
    this._cache = new Map();
    this._ensureDataDir();
  }

  configureDataRoot(dataRoot) {
    const nextDataRoot = dataRoot && String(dataRoot).trim() ? String(dataRoot).trim() : DEFAULT_DATA_ROOT;
    if (nextDataRoot !== this.dataRoot) {
      this.dataRoot = nextDataRoot;
      this._cache.clear();
    }
    this._ensureDataDir();
    return this;
  }

  getDataRoot() {
    return this.dataRoot;
  }

  clearCache() {
    this._cache.clear();
    return this;
  }

  resetAllData() {
    Object.entries(DEFAULT_FILE_CONTENT).forEach(([filename, initialValue]) => {
      this._atomicWrite(this._filePath(filename), initialValue);
    });
  }

  generateId(prefix) {
    const suffix = crypto.randomBytes(4).toString('hex').toLowerCase();
    return `${prefix}_${suffix}`;
  }

  _filePath(filename) {
    return path.join(this.dataRoot, filename);
  }

  _ensureDataDir() {
    if (!fs.existsSync(this.dataRoot)) {
      fs.mkdirSync(this.dataRoot, { recursive: true });
    }

    Object.entries(DEFAULT_FILE_CONTENT).forEach(([filename, initialValue]) => {
      const filePath = this._filePath(filename);
      if (!fs.existsSync(filePath)) {
        this._atomicWrite(filePath, initialValue);
      }
    });
  }

  _atomicWrite(filePath, data) {
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, filePath);
    this._cache.set(filePath, _clone(data));
  }

  _read(filename) {
    const filePath = this._filePath(filename);
    if (this._cache.has(filePath)) {
      return this._cache.get(filePath);
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      this._cache.set(filePath, parsed);
      return parsed;
    } catch (error) {
      const fallback = _clone(DEFAULT_FILE_CONTENT[filename] || {});
      this._cache.set(filePath, fallback);
      return fallback;
    }
  }

  _reload(filename) {
    const filePath = this._filePath(filename);
    this._cache.delete(filePath);
    return this._read(filename);
  }

  getCustomer(customerId) {
    const customers = this._read(DATA_FILES.customers);
    return customers[customerId] || null;
  }

  listCustomers() {
    return Object.values(this._read(DATA_FILES.customers));
  }

  findCustomerByNameAndContact(name, phone, wechat, email = '') {
    const customers = this._read(DATA_FILES.customers);
    const targetContactValue = _pickContactValue(phone, wechat, email);
    const targetNormalizedKey = _normalizeContactKey(name, targetContactValue);

    for (const customer of Object.values(customers)) {
      const existingNormalizedKey = customer.normalized_contact_key
        || _normalizeContactKey(customer.customer_name, _pickContactValue(customer.contact_phone, customer.contact_wechat, customer.contact_email));

      if (customer.customer_name === name && existingNormalizedKey === targetNormalizedKey) {
        return customer;
      }
    }

    return null;
  }

  createCustomer(customerData) {
    const customers = this._read(DATA_FILES.customers);
    const now = new Date().toISOString();
    const customerId = this.generateId('cust');
    const contactValue = _pickContactValue(customerData.contact_phone, customerData.contact_wechat, customerData.contact_email);

    const record = {
      customer_id: customerId,
      customer_name: customerData.customer_name,
      customer_type: customerData.customer_type,
      contact_value: contactValue,
      normalized_contact_key: _normalizeContactKey(customerData.customer_name, contactValue),
      source_channel: customerData.source_channel || customerData.source || 'other',
      project_type_preference: customerData.project_type_preference || '',
      budget_range: customerData.budget_range || '',
      status: customerData.status || 'active',
      last_contact_at: customerData.last_contact_at || now,
      created_at: now,
      updated_at: now,
      notes: customerData.notes || customerData.remark || '',
      contact_phone: customerData.contact_phone || '',
      contact_wechat: customerData.contact_wechat || '',
      contact_email: customerData.contact_email || '',
      source: customerData.source || customerData.source_channel || 'other',
      remark: customerData.remark || customerData.notes || ''
    };

    customers[customerId] = record;
    this._atomicWrite(this._filePath(DATA_FILES.customers), customers);
    return record;
  }

  getProject(projectId) {
    const projects = this._read(DATA_FILES.projects);
    return projects[projectId] || null;
  }

  listProjects() {
    return Object.values(this._read(DATA_FILES.projects));
  }

  findProjectByCustomerAndName(customerId, projectName) {
    const projects = this._read(DATA_FILES.projects);
    for (const project of Object.values(projects)) {
      if (project.customer_id === customerId && project.project_name === projectName) {
        return project;
      }
    }
    return null;
  }

  createProject(projectData) {
    const projects = this._read(DATA_FILES.projects);
    const now = new Date().toISOString();
    const projectId = this.generateId('proj');
    const styleKeywords = Array.isArray(projectData.style_keywords)
      ? projectData.style_keywords
      : String(projectData.style_keywords || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);

    const record = {
      project_id: projectId,
      customer_id: projectData.customer_id,
      project_name: projectData.project_name,
      project_type: projectData.project_type,
      shoot_date: projectData.shoot_date || projectData.start_date || '',
      location: projectData.location || '',
      style_keywords: styleKeywords,
      delivery_deadline: projectData.delivery_deadline || projectData.due_date || '',
      status: projectData.status || 'lead',
      is_public_allowed: Boolean(projectData.is_public_allowed),
      current_blocker: projectData.current_blocker || '',
      created_at: now,
      updated_at: now,
      notes: projectData.notes || projectData.remark || '',
      start_date: projectData.start_date || projectData.shoot_date || '',
      due_date: projectData.due_date || projectData.delivery_deadline || '',
      budget: Number(projectData.budget || 0),
      remark: projectData.remark || projectData.notes || ''
    };

    projects[projectId] = record;
    this._atomicWrite(this._filePath(DATA_FILES.projects), projects);
    return record;
  }

  updateProject(projectId, updates) {
    const projects = this._reload(DATA_FILES.projects);
    if (!projects[projectId]) {
      return null;
    }

    const nextUpdates = { ...updates };
    if (nextUpdates.delivery_deadline && !nextUpdates.due_date) {
      nextUpdates.due_date = nextUpdates.delivery_deadline;
    }
    if (nextUpdates.shoot_date && !nextUpdates.start_date) {
      nextUpdates.start_date = nextUpdates.shoot_date;
    }
    if (nextUpdates.notes && !nextUpdates.remark) {
      nextUpdates.remark = nextUpdates.notes;
    }
    if (nextUpdates.remark && !nextUpdates.notes) {
      nextUpdates.notes = nextUpdates.remark;
    }

    projects[projectId] = {
      ...projects[projectId],
      ...nextUpdates,
      updated_at: new Date().toISOString()
    };

    this._atomicWrite(this._filePath(DATA_FILES.projects), projects);
    return projects[projectId];
  }

  getTasksByProject(projectId) {
    const tasks = this._read(DATA_FILES.tasks);
    return tasks[projectId] || [];
  }

  createTasks(projectId, taskList) {
    const tasks = this._reload(DATA_FILES.tasks);
    const now = new Date().toISOString();
    const created = [];

    for (const task of taskList) {
      const taskId = this.generateId('task');
      const phase = task.phase || task.task_type || 'other';
      const record = {
        task_id: taskId,
        project_id: projectId,
        task_template_id: task.task_template_id || '',
        task_name: task.task_name,
        phase,
        priority: task.priority || 'medium',
        due_date: task.due_date || '',
        status: task.status || 'pending',
        assignee: task.assignee || '',
        blocker_flag: Boolean(task.blocker_flag),
        created_at: now,
        updated_at: now,
        notes: task.notes || task.remark || '',
        task_type: task.task_type || phase,
        sort_order: task.sort_order || 0,
        remark: task.remark || task.notes || ''
      };
      created.push(record);
    }

    tasks[projectId] = [...(tasks[projectId] || []), ...created];
    this._atomicWrite(this._filePath(DATA_FILES.tasks), tasks);
    return created;
  }

  setTasksByProject(projectId, taskList) {
    const tasks = this._reload(DATA_FILES.tasks);
    tasks[projectId] = taskList;
    this._atomicWrite(this._filePath(DATA_FILES.tasks), tasks);
    return tasks[projectId];
  }

  appendStatusLog(logEntry) {
    const logs = this._reload(DATA_FILES.statusLog);
    const now = new Date().toISOString();
    const record = {
      log_id: logEntry.log_id || this.generateId('log'),
      project_id: logEntry.project_id,
      old_status: logEntry.old_status || logEntry.previous_status || '',
      new_status: logEntry.new_status,
      reason: logEntry.reason || logEntry.remark || '',
      changed_at: logEntry.changed_at || logEntry.transition_time || now,
      changed_by: logEntry.changed_by || 'system',
      logged_at: now
    };
    logs.push(record);
    this._atomicWrite(this._filePath(DATA_FILES.statusLog), logs);
    return record;
  }

  getStatusLog(projectId) {
    const logs = this._read(DATA_FILES.statusLog);
    return logs.filter(entry => entry.project_id === projectId);
  }

  listStatusLog() {
    return this._read(DATA_FILES.statusLog).slice();
  }

  getRemindersByProject(projectId) {
    const reminders = this._read(DATA_FILES.reminders);
    return Object.values(reminders).filter(reminder => reminder.project_id === projectId);
  }

  findPendingReminder(projectId, reminderType) {
    const reminders = this._read(DATA_FILES.reminders);
    return Object.values(reminders).find((reminder) =>
      reminder.project_id === projectId
      && reminder.reminder_type === reminderType
      && reminder.status === 'pending'
    ) || null;
  }

  createReminder(reminderData) {
    const reminders = this._read(DATA_FILES.reminders);
    const now = new Date().toISOString();
    const reminderId = this.generateId('rem');
    const record = {
      reminder_id: reminderId,
      project_id: reminderData.project_id,
      customer_id: reminderData.customer_id,
      reminder_type: reminderData.reminder_type,
      due_date: reminderData.due_date || '',
      status: reminderData.status || 'pending',
      note: reminderData.note || '',
      created_at: now,
      updated_at: now
    };
    reminders[reminderId] = record;
    this._atomicWrite(this._filePath(DATA_FILES.reminders), reminders);
    return record;
  }

  getCalendarEventsByProject(projectId) {
    const calendarEvents = this._read(DATA_FILES.calendarEvents);
    return Object.values(calendarEvents).filter(event => event.project_id === projectId);
  }

  upsertCalendarEvent(eventData) {
    const calendarEvents = this._reload(DATA_FILES.calendarEvents);
    const existing = Object.values(calendarEvents).find((event) =>
      event.project_id === eventData.project_id
      && event.calendar_surface === eventData.calendar_surface
      && event.event_key === eventData.event_key
    ) || null;

    const now = new Date().toISOString();
    const calendarEventId = existing ? existing.calendar_event_id : this.generateId('calendar');
    const record = {
      calendar_event_id: calendarEventId,
      created_at: existing ? existing.created_at : now,
      updated_at: now,
      sync_state: 'local_shadow',
      ...existing,
      ...eventData,
      calendar_event_id: calendarEventId,
      created_at: existing ? existing.created_at : now,
      updated_at: now
    };

    calendarEvents[calendarEventId] = record;
    this._atomicWrite(this._filePath(DATA_FILES.calendarEvents), calendarEvents);
    return { record, existing };
  }

  getArchiveAssetsByProject(projectId) {
    const archiveAssets = this._read(DATA_FILES.archiveAssets);
    return Object.values(archiveAssets).filter(asset => asset.project_id === projectId);
  }

  upsertArchiveAsset(assetData) {
    const archiveAssets = this._reload(DATA_FILES.archiveAssets);
    const existing = Object.values(archiveAssets).find((asset) =>
      asset.project_id === assetData.project_id
      && asset.archive_surface === assetData.archive_surface
      && asset.archive_key === assetData.archive_key
    ) || null;

    const now = new Date().toISOString();
    const archiveAssetId = existing ? existing.archive_asset_id : this.generateId('archive');
    const record = {
      archive_asset_id: archiveAssetId,
      created_at: existing ? existing.created_at : now,
      updated_at: now,
      sync_state: 'local_shadow',
      ...existing,
      ...assetData,
      archive_asset_id: archiveAssetId,
      created_at: existing ? existing.created_at : now,
      updated_at: now
    };

    archiveAssets[archiveAssetId] = record;
    this._atomicWrite(this._filePath(DATA_FILES.archiveAssets), archiveAssets);
    return { record, existing };
  }

  getExternalExports() {
    return Object.values(this._read(DATA_FILES.externalExports));
  }

  upsertExternalExport(exportData) {
    const externalExports = this._reload(DATA_FILES.externalExports);
    const existingById = exportData.external_export_id
      ? externalExports[exportData.external_export_id] || null
      : null;
    const existing = existingById || Object.values(externalExports).find((exportRecord) =>
      exportRecord.export_key === exportData.export_key
    ) || null;

    const now = new Date().toISOString();
    const externalExportId = existing ? existing.external_export_id : this.generateId('export');
    const record = {
      external_export_id: externalExportId,
      created_at: existing ? existing.created_at : now,
      updated_at: now,
      sync_state: 'local_shadow',
      ...existing,
      ...exportData,
      external_export_id: externalExportId,
      created_at: existing ? existing.created_at : now,
      updated_at: now
    };

    externalExports[externalExportId] = record;
    this._atomicWrite(this._filePath(DATA_FILES.externalExports), externalExports);
    return { record, existing };
  }

  listContentPool() {
    return Object.values(this._read(DATA_FILES.contentPool));
  }

  upsertContentPoolItem(contentItem) {
    const contentPool = this._reload(DATA_FILES.contentPool);
    const contentId = contentItem.content_id || this.generateId('content');
    const now = new Date().toISOString();
    contentPool[contentId] = {
      content_id: contentId,
      reuse_count: 0,
      created_at: now,
      updated_at: now,
      ...contentPool[contentId],
      ...contentItem,
      updated_at: now
    };
    this._atomicWrite(this._filePath(DATA_FILES.contentPool), contentPool);
    return contentPool[contentId];
  }

  listTemplates() {
    return Object.values(this._read(DATA_FILES.templates));
  }

  upsertTemplate(template) {
    const templates = this._reload(DATA_FILES.templates);
    const templateId = template.template_id || this.generateId('tmpl');
    const now = new Date().toISOString();
    templates[templateId] = {
      template_id: templateId,
      version: template.version || '1.0.0',
      updated_at: now,
      effect_feedback: template.effect_feedback || '',
      ...templates[templateId],
      ...template,
      updated_at: now
    };
    this._atomicWrite(this._filePath(DATA_FILES.templates), templates);
    return templates[templateId];
  }
}

const store = new PhotoStudioDataStore();

module.exports = store;

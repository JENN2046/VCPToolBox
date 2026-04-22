const path = require('path');

const store = require(path.join(__dirname, '..', '..', '..', 'shared', 'photo_studio_data', 'PhotoStudioDataStore'));

const PROJECT_STATUSES = Object.freeze([
  'lead',
  'quoted',
  'confirmed',
  'preparing',
  'shot',
  'selection_pending',
  'retouching',
  'delivering',
  'completed',
  'archived',
  'cancelled'
]);

const PROJECT_TYPES = Object.freeze([
  'wedding',
  'portrait',
  'commercial',
  'event',
  'other'
]);

const CLOSED_STATUSES = new Set(['completed', 'archived', 'cancelled']);
const DAY_MS = 24 * 60 * 60 * 1000;

const PLUGIN_NAME = 'generate_weekly_project_digest';
const PLUGIN_VERSION = '2.0.0';

let config = { DebugMode: false };

function _timestamp() {
  return new Date().toISOString();
}

function _meta(extra) {
  return {
    plugin_name: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    timestamp: _timestamp(),
    ...extra
  };
}

function _success(data, extraMeta) {
  return {
    success: true,
    data,
    error: null,
    meta: _meta(extraMeta || {})
  };
}

function _error(code, message, field, details) {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      field: field || null,
      details: details || {}
    },
    meta: _meta()
  };
}

function _toUtcDayStart(dateString) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function _isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(_toUtcDayStart(value).getTime());
}

function _resolveReferenceDate(value) {
  const candidate = String(value || '').trim();
  if (!candidate) {
    return new Date().toISOString().slice(0, 10);
  }

  return _isIsoDate(candidate) ? candidate : null;
}

function _parsePositiveInteger(value, fieldName, defaultValue) {
  if (value === null || value === undefined || value === '') {
    return { value: defaultValue, error: null };
  }

  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return {
      value: null,
      error: _error('INVALID_INPUT', `${fieldName} must be a positive integer.`, fieldName)
    };
  }

  return { value: parsed, error: null };
}

function _toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function _addDays(dateString, days) {
  const date = _toUtcDayStart(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return _toIsoDate(date);
}

function _diffInDays(targetDateString, referenceDateString) {
  const target = _toUtcDayStart(targetDateString);
  const reference = _toUtcDayStart(referenceDateString);
  return Math.round((target.getTime() - reference.getTime()) / DAY_MS);
}

function _buildStatusCountMap(projects) {
  const counts = Object.fromEntries(PROJECT_STATUSES.map((status) => [status, 0]));
  projects.forEach((project) => {
    if (Object.prototype.hasOwnProperty.call(counts, project.status)) {
      counts[project.status] += 1;
    }
  });
  return counts;
}

function _buildTypeCountMap(projects) {
  const counts = Object.fromEntries(PROJECT_TYPES.map((type) => [type, 0]));
  projects.forEach((project) => {
    if (Object.prototype.hasOwnProperty.call(counts, project.project_type)) {
      counts[project.project_type] += 1;
    }
  });
  return counts;
}

function _projectStartDate(project) {
  return project.shoot_date || project.start_date || null;
}

function _projectDueDate(project) {
  return project.delivery_deadline || project.due_date || null;
}

function _buildProjectRows(projects, customerMap, referenceDate, upcomingDays) {
  return projects
    .map((project) => {
      const customer = customerMap.get(project.customer_id) || null;
      const customerName = customer && customer.customer_name ? customer.customer_name : '[Customer Name]';
      const dueDate = _projectDueDate(project);
      const startDate = _projectStartDate(project);
      const isClosed = CLOSED_STATUSES.has(project.status);
      const daysUntilDue = dueDate ? _diffInDays(dueDate, referenceDate) : null;
      let attentionState = 'on_track';

      if (!dueDate && !isClosed) {
        attentionState = 'missing_due_date';
      } else if (!isClosed && daysUntilDue !== null && daysUntilDue < 0) {
        attentionState = 'overdue';
      } else if (!isClosed && daysUntilDue !== null && daysUntilDue <= upcomingDays) {
        attentionState = 'due_soon';
      } else if (isClosed) {
        attentionState = 'closed';
      }

      return {
        project_id: project.project_id,
        customer_id: project.customer_id,
        customer_name: customerName,
        project_name: project.project_name,
        project_type: project.project_type,
        status: project.status,
        shoot_date: startDate,
        delivery_deadline: dueDate,
        budget: project.budget ?? null,
        days_until_due: daysUntilDue,
        attention_state: attentionState,
        has_customer: Boolean(customer),
        has_due_date: Boolean(dueDate)
      };
    })
    .sort((left, right) => {
      const leftSortDate = left.delivery_deadline || '9999-12-31';
      const rightSortDate = right.delivery_deadline || '9999-12-31';

      if (leftSortDate !== rightSortDate) {
        return leftSortDate.localeCompare(rightSortDate);
      }

      return String(left.project_name || '').localeCompare(String(right.project_name || ''));
    });
}

function _buildRecentTransitions(statusLogRecords, projectMap, customerMap, windowStart, windowEnd) {
  return statusLogRecords
    .filter((record) => {
      const transitionTime = record.changed_at || record.transition_time || record.logged_at || '';
      return transitionTime >= `${windowStart}T00:00:00.000Z`
        && transitionTime <= `${windowEnd}T23:59:59.999Z`;
    })
    .map((record) => {
      const transitionTime = record.changed_at || record.transition_time || record.logged_at || '';
      const project = projectMap.get(record.project_id) || null;
      const customer = project ? customerMap.get(project.customer_id) || null : null;

      return {
        log_id: record.log_id || record.status_log_id || null,
        project_id: record.project_id,
        project_name: project ? project.project_name : null,
        customer_id: project ? project.customer_id : null,
        customer_name: customer && customer.customer_name ? customer.customer_name : '[Customer Name]',
        old_status: record.old_status || record.previous_status || null,
        new_status: record.new_status || null,
        changed_at: transitionTime,
        reason: record.reason || record.remark || ''
      };
    })
    .sort((left, right) => String(right.changed_at).localeCompare(String(left.changed_at)));
}

function _buildDigestText({ referenceDate, windowStart, windowEnd, summary, overdueProjects, upcomingDueProjects, recentTransitions, dataQuality }) {
  const lines = [
    'Weekly photo_studio digest',
    `Reference date: ${referenceDate}`,
    `Window: ${windowStart} -> ${windowEnd}`,
    `Total projects: ${summary.total_projects}`,
    `Active projects: ${summary.active_projects}`,
    `Closed projects: ${summary.closed_projects}`,
    `Overdue projects: ${summary.overdue_projects}`,
    `Due soon projects: ${summary.due_soon_projects}`,
    `Recent transitions: ${summary.recent_transition_count}`,
    `Missing due dates: ${dataQuality.missing_due_date_count}`,
    `Missing customers: ${dataQuality.missing_customer_count}`,
    `Missing transition references: ${dataQuality.missing_project_reference_count}`
  ];

  if (overdueProjects.length > 0) {
    lines.push('', 'Overdue projects:');
    overdueProjects.forEach((project) => {
      lines.push(`- ${project.project_name} (${project.delivery_deadline})`);
    });
  }

  if (upcomingDueProjects.length > 0) {
    lines.push('', 'Due soon projects:');
    upcomingDueProjects.forEach((project) => {
      lines.push(`- ${project.project_name} (${project.delivery_deadline})`);
    });
  }

  if (recentTransitions.length > 0) {
    lines.push('', 'Recent transitions:');
    recentTransitions.slice(0, 10).forEach((record) => {
      lines.push(`- ${record.project_name || record.project_id}: ${record.old_status || 'unknown'} -> ${record.new_status || 'unknown'}`);
    });
  }

  return lines.join('\n');
}

async function processToolCall(args) {
  const referenceDate = _resolveReferenceDate(args.reference_date);
  if (!referenceDate) {
    return _error('INVALID_INPUT', 'reference_date must be in YYYY-MM-DD format.', 'reference_date');
  }

  const lookbackDaysResult = _parsePositiveInteger(args.lookback_days, 'lookback_days', 7);
  if (lookbackDaysResult.error) {
    return lookbackDaysResult.error;
  }

  const upcomingDaysResult = _parsePositiveInteger(args.upcoming_days, 'upcoming_days', 14);
  if (upcomingDaysResult.error) {
    return upcomingDaysResult.error;
  }

  const lookbackDays = lookbackDaysResult.value;
  const upcomingDays = upcomingDaysResult.value;
  const windowStart = _addDays(referenceDate, -(lookbackDays - 1));
  const windowEnd = referenceDate;
  const projects = store.listProjects();
  const customers = store.listCustomers();
  const statusLog = store.listStatusLog();
  const customerMap = new Map(customers.map((record) => [record.customer_id, record]));
  const projectMap = new Map(projects.map((record) => [record.project_id, record]));
  const projectRows = _buildProjectRows(projects, customerMap, referenceDate, upcomingDays);
  const overdueProjects = projectRows.filter((project) => project.attention_state === 'overdue');
  const upcomingDueProjects = projectRows.filter((project) => project.attention_state === 'due_soon');
  const recentTransitions = _buildRecentTransitions(statusLog, projectMap, customerMap, windowStart, windowEnd);
  const dataQuality = {
    missing_due_date_count: projectRows.filter((project) => project.attention_state === 'missing_due_date').length,
    missing_customer_count: projectRows.filter((project) => !project.has_customer).length,
    missing_project_reference_count: recentTransitions.filter((transition) => !transition.project_name).length
  };
  const activeProjects = projectRows.filter((project) => !CLOSED_STATUSES.has(project.status));
  const summary = {
    total_projects: projectRows.length,
    active_projects: activeProjects.length,
    closed_projects: projectRows.length - activeProjects.length,
    overdue_projects: overdueProjects.length,
    due_soon_projects: upcomingDueProjects.length,
    recent_transition_count: recentTransitions.length
  };

  return _success({
    digest_label: 'weekly_project_digest',
    reference_date: referenceDate,
    lookback_days: lookbackDays,
    upcoming_days: upcomingDays,
    generated_at: `${referenceDate}T23:59:59.999Z`,
    window_start: windowStart,
    window_end: windowEnd,
    summary,
    status_counts: _buildStatusCountMap(projects),
    project_type_counts: _buildTypeCountMap(projects),
    overdue_projects: overdueProjects,
    upcoming_due_projects: upcomingDueProjects,
    recent_transitions: recentTransitions,
    data_quality: dataQuality,
    digest_text: _buildDigestText({
      referenceDate,
      windowStart,
      windowEnd,
      summary,
      overdueProjects,
      upcomingDueProjects,
      recentTransitions,
      dataQuality
    }),
    project_rows: projectRows
  }, {
    entity: 'weekly_project_digest',
    degraded: dataQuality.missing_due_date_count > 0
      || dataQuality.missing_customer_count > 0
      || dataQuality.missing_project_reference_count > 0
  });
}

async function initialize(initialConfig) {
  config = initialConfig || {};
  if (config.PhotoStudioDataPath) {
    store.configureDataRoot(config.PhotoStudioDataPath);
  }
}

function shutdown() {}

module.exports = {
  initialize,
  processToolCall,
  shutdown
};

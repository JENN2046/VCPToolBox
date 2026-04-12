import { apiFetch, escapeHTML } from './utils.js';

const API_BASE = '/admin_api';

function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('zh-CN');
}

function renderMetricCard(title, value, subtitle = '') {
    return `
        <div class="codex-memory-card">
            <h3>${escapeHTML(title)}</h3>
            <div class="codex-memory-metric">${escapeHTML(String(value))}</div>
            ${subtitle ? `<div class="codex-memory-subtle">${escapeHTML(subtitle)}</div>` : ''}
        </div>
    `;
}

function renderAuditRows(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return '<tr><td colspan="5" class="text-center text-muted">暂无记录</td></tr>';
    }

    return items.map(item => `
        <tr>
            <td>${escapeHTML(formatDateTime(item.timestamp))}</td>
            <td>${escapeHTML(item.decision || 'unknown')}</td>
            <td>${escapeHTML(item.target || '—')}</td>
            <td>${escapeHTML(item.reason || '—')}</td>
            <td><code>${escapeHTML(item.filePath || '—')}</code></td>
        </tr>
    `).join('');
}

function renderReasonRows(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return '<tr><td colspan="2" class="text-center text-muted">暂无拒绝记录</td></tr>';
    }

    return items.map(item => `
        <tr>
            <td>${escapeHTML(item.reason)}</td>
            <td>${escapeHTML(String(item.count))}</td>
        </tr>
    `).join('');
}

function renderFileRows(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return '<tr><td colspan="4" class="text-center text-muted">暂无文件</td></tr>';
    }

    return items.map(item => `
        <tr>
            <td>${escapeHTML(item.name)}</td>
            <td>${escapeHTML(formatDateTime(item.updatedAt))}</td>
            <td>${escapeHTML(String(item.size))}</td>
            <td><code>${escapeHTML(item.path)}</code></td>
        </tr>
    `).join('');
}

function buildOverviewHtml(data) {
    const summary = data.summary || {};
    const paths = data.paths || {};
    const recentFiles = data.recentFiles || {};
    const recall = data.recall || {};

    return `
        <div class="codex-memory-grid">
            ${renderMetricCard('近样本接受', summary.accepted || 0, `最近接受: ${formatDateTime(summary.latestAcceptedAt)}`)}
            ${renderMetricCard('近样本拒绝', summary.rejected || 0, `最近拒绝: ${formatDateTime(summary.latestRejectedAt)}`)}
            ${renderMetricCard('过程写入', summary.processAccepted || 0, `过程拒绝: ${summary.processRejected || 0}`)}
            ${renderMetricCard('知识写入', summary.knowledgeAccepted || 0, `知识拒绝: ${summary.knowledgeRejected || 0}`)}
            ${renderMetricCard('直写拦截', summary.blockedDirectWrites || 0, '最近样本中命中')}
            ${renderMetricCard('敏感拒绝', summary.sensitiveRejected || 0, `统计窗口: ${summary.sampleSize || 0} 条`)}
        </div>

        <div class="codex-memory-section-block card">
            <h3>路径</h3>
            <div class="codex-memory-paths">
                <div><strong>审计日志</strong><code>${escapeHTML(paths.auditLogPath || '—')}</code></div>
                <div><strong>过程日记本</strong><code>${escapeHTML(paths.processDiaryPath || '—')}</code></div>
                <div><strong>知识日记本</strong><code>${escapeHTML(paths.knowledgeDiaryPath || '—')}</code></div>
            </div>
            <div class="codex-memory-subtle">召回观测: ${escapeHTML(recall.message || '—')}</div>
        </div>

        <div class="codex-memory-section-block card">
            <h3>最近审计</h3>
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>时间</th>
                        <th>决策</th>
                        <th>目标</th>
                        <th>原因</th>
                        <th>文件</th>
                    </tr>
                </thead>
                <tbody>${renderAuditRows(data.recentAudit)}</tbody>
            </table>
        </div>

        <div class="codex-memory-section-block card">
            <h3>拒绝原因</h3>
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>原因</th>
                        <th>次数</th>
                    </tr>
                </thead>
                <tbody>${renderReasonRows(data.rejectionReasons)}</tbody>
            </table>
        </div>

        <div class="codex-memory-section-block card">
            <h3>最新过程文件</h3>
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>文件名</th>
                        <th>更新时间</th>
                        <th>大小</th>
                        <th>路径</th>
                    </tr>
                </thead>
                <tbody>${renderFileRows(recentFiles.process)}</tbody>
            </table>
        </div>

        <div class="codex-memory-section-block card">
            <h3>最新知识文件</h3>
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>文件名</th>
                        <th>更新时间</th>
                        <th>大小</th>
                        <th>路径</th>
                    </tr>
                </thead>
                <tbody>${renderFileRows(recentFiles.knowledge)}</tbody>
            </table>
        </div>
    `;
}

export async function initializeCodexMemoryMonitor() {
    const container = document.getElementById('codex-memory-content');
    const status = document.getElementById('codex-memory-status');
    const refreshButton = document.getElementById('codex-memory-refresh-button');
    if (!container || !status || !refreshButton) return;

    const setStatus = (text, type = 'info') => {
        status.textContent = text;
        status.className = `status-message ${type}`;
    };

    const load = async () => {
        setStatus('加载中', 'info');
        container.innerHTML = '<p class="codex-memory-subtle">加载中...</p>';
        try {
            const data = await apiFetch(`${API_BASE}/codex-memory/overview?limit=10&auditWindow=500`);
            container.innerHTML = buildOverviewHtml(data);
            setStatus('已刷新', 'success');
        } catch (error) {
            container.innerHTML = `<p class="error-message">加载失败: ${escapeHTML(error.message)}</p>`;
            setStatus('加载失败', 'error');
        }
    };

    if (!refreshButton.dataset.bound) {
        refreshButton.addEventListener('click', load);
        refreshButton.dataset.bound = 'true';
    }

    await load();
}

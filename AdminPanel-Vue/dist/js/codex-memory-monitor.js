import { apiFetch, escapeHTML } from './utils.js';

const API_BASE = '/admin_api';

function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('zh-CN');
}

function formatScore(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    return value.toFixed(4);
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

function renderRecallRows(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return '<tr><td colspan="7" class="text-center text-muted">暂无命中记录</td></tr>';
    }

    return items.map(item => `
        <tr>
            <td>${escapeHTML(formatDateTime(item.timestamp))}</td>
            <td>${escapeHTML(item.target || '—')}</td>
            <td>${escapeHTML(item.recallType || 'unknown')}</td>
            <td>${escapeHTML(String(item.resultCount || 0))}</td>
            <td>${escapeHTML(formatScore(item.topScore))}</td>
            <td>${escapeHTML(item.fromCache ? '是' : '否')}</td>
            <td><code>${escapeHTML(item.topSourceFile || '—')}</code></td>
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

function renderMemoryLinkRows(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return '<tr><td colspan="7" class="text-center text-muted">暂无可关联记忆</td></tr>';
    }

    return items.map(item => `
        <tr>
            <td>${escapeHTML(item.title || '未命名记忆')}</td>
            <td>${escapeHTML(item.target || '—')}</td>
            <td>${escapeHTML(String(item.recallCount || 0))}</td>
            <td>${escapeHTML(String(item.cacheRecallCount || 0))}</td>
            <td>${escapeHTML(formatDateTime(item.writtenAt))}</td>
            <td>${escapeHTML(formatDateTime(item.lastRecallAt))}</td>
            <td><code>${escapeHTML(item.memoryId || item.filePath || '—')}</code></td>
        </tr>
    `).join('');
}

function renderAdaptiveRows(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return '<tr><td colspan="8" class="text-center text-muted">暂无自适应数据</td></tr>';
    }

    return items.map(item => `
        <tr>
            <td>${escapeHTML(item.dbName || '—')}</td>
            <td>${escapeHTML(item.status || '—')}</td>
            <td>${escapeHTML((item.hitRate || 0).toFixed(2))}</td>
            <td>${escapeHTML(String(item.writeCount || 0))}</td>
            <td>${escapeHTML(String(item.totalHits || 0))}</td>
            <td>${escapeHTML((item.thresholdDelta || 0).toFixed(3))}</td>
            <td>${escapeHTML((item.tagWeightDelta || 0).toFixed(3))}</td>
            <td>${escapeHTML(`K+${item.kDelta || 0} / T+${(item.truncationDelta || 0).toFixed(3)}`)}</td>
        </tr>
    `).join('');
}

function renderTagContributionRows(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return '<tr><td colspan="7" class="text-center text-muted">暂无标签贡献数据</td></tr>';
    }

    return items.map(item => `
        <tr>
            <td>${escapeHTML(item.dbName || '—')}</td>
            <td>${escapeHTML(item.tag || '—')}</td>
            <td>${escapeHTML(String(item.hitCount || 0))}</td>
            <td>${escapeHTML(String(item.matchedHitCount || 0))}</td>
            <td>${escapeHTML(String(item.coreHitCount || 0))}</td>
            <td>${escapeHTML(formatScore(item.avgTopScore))}</td>
            <td>${escapeHTML(String(item.uniqueMemoryCount || 0))}</td>
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
    const recallSummary = recall.summary || {};
    const adaptive = data.adaptive || {};
    const adaptiveProfiles = Array.isArray(adaptive.profiles) ? adaptive.profiles : [];
    const boostedProfiles = adaptiveProfiles.filter(item => item.status === 'boosted').length;
    const tagContribution = Array.isArray(adaptive.tagContribution?.flat) ? adaptive.tagContribution.flat : [];

    return `
        <div class="codex-memory-grid">
            ${renderMetricCard('近样本接受', summary.accepted || 0, `最近接受: ${formatDateTime(summary.latestAcceptedAt)}`)}
            ${renderMetricCard('近样本拒绝', summary.rejected || 0, `最近拒绝: ${formatDateTime(summary.latestRejectedAt)}`)}
            ${renderMetricCard('过程写入', summary.processAccepted || 0, `过程拒绝: ${summary.processRejected || 0}`)}
            ${renderMetricCard('知识写入', summary.knowledgeAccepted || 0, `知识拒绝: ${summary.knowledgeRejected || 0}`)}
            ${renderMetricCard('直写拦截', summary.blockedDirectWrites || 0, '统计窗口内命中')}
            ${renderMetricCard('敏感拒绝', summary.sensitiveRejected || 0, `统计窗口: ${summary.sampleSize || 0} 条`)}
        </div>

        <div class="codex-memory-grid">
            ${renderMetricCard('召回命中', recallSummary.totalHits || 0, `最近命中: ${formatDateTime(recallSummary.latestHitAt)}`)}
            ${renderMetricCard('过程召回', recallSummary.processHits || 0, `最近过程命中: ${formatDateTime(recallSummary.latestProcessHitAt)}`)}
            ${renderMetricCard('知识召回', recallSummary.knowledgeHits || 0, `最近知识命中: ${formatDateTime(recallSummary.latestKnowledgeHitAt)}`)}
            ${renderMetricCard('片段召回', recallSummary.snippetHits || 0, `全文: ${recallSummary.fullTextHits || 0} / 直引: ${recallSummary.directHits || 0}`)}
            ${renderMetricCard('缓存命中', recallSummary.cacheHits || 0, `统计窗口: ${recallSummary.sampleSize || 0} 条`)}
            ${renderMetricCard('自适应调参', boostedProfiles, adaptive.config?.enabled === false ? '当前已关闭' : '当前提升中的日记本数量')}
            ${renderMetricCard('高频标签', tagContribution.length > 0 ? tagContribution[0].tag : '—', tagContribution.length > 0 ? `来自 ${tagContribution[0].dbName}，命中 ${tagContribution[0].hitCount} 次` : '暂无标签贡献数据')}
        </div>

        <div class="codex-memory-section-block card">
            <h3>路径</h3>
            <div class="codex-memory-paths">
                <div><strong>写入审计</strong><code>${escapeHTML(paths.auditLogPath || '—')}</code></div>
                <div><strong>召回审计</strong><code>${escapeHTML(paths.recallLogPath || '—')}</code></div>
                <div><strong>过程日记本</strong><code>${escapeHTML(paths.processDiaryPath || '—')}</code></div>
                <div><strong>知识日记本</strong><code>${escapeHTML(paths.knowledgeDiaryPath || '—')}</code></div>
            </div>
            <div class="codex-memory-subtle">召回观测: ${escapeHTML(recall.message || '—')}</div>
        </div>

        <div class="codex-memory-section-block card">
            <h3>自适应调参</h3>
            <div class="codex-memory-subtle">
                ${escapeHTML(adaptive.config?.enabled === false
                    ? '自适应召回调参已关闭'
                    : `目标命中率 ${String((adaptive.config?.targetHitRate ?? 0).toFixed(2))}，最小样本 ${String(adaptive.config?.minWritesBeforeAdjust ?? 0)} 条`)}
            </div>
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>日记本</th>
                        <th>状态</th>
                        <th>命中率</th>
                        <th>写入数</th>
                        <th>命中数</th>
                        <th>阈值Δ</th>
                        <th>Tag权重Δ</th>
                        <th>K / 截断</th>
                    </tr>
                </thead>
                <tbody>${renderAdaptiveRows(adaptiveProfiles)}</tbody>
            </table>
        </div>

        <div class="codex-memory-section-block card">
            <h3>标签贡献</h3>
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>日记本</th>
                        <th>标签</th>
                        <th>命中数</th>
                        <th>匹配数</th>
                        <th>核心数</th>
                        <th>平均分</th>
                        <th>记忆覆盖</th>
                    </tr>
                </thead>
                <tbody>${renderTagContributionRows(tagContribution)}</tbody>
            </table>
        </div>

        <div class="codex-memory-section-block card">
            <h3>最近召回</h3>
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>时间</th>
                        <th>目标</th>
                        <th>方式</th>
                        <th>命中数</th>
                        <th>Top分数</th>
                        <th>缓存</th>
                        <th>来源文件</th>
                    </tr>
                </thead>
                <tbody>${renderRecallRows(recall.recent)}</tbody>
            </table>
        </div>

        <div class="codex-memory-section-block card">
            <h3>记忆关联</h3>
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>标题</th>
                        <th>目标</th>
                        <th>召回次数</th>
                        <th>缓存次数</th>
                        <th>写入时间</th>
                        <th>最近召回</th>
                        <th>ID / 文件</th>
                    </tr>
                </thead>
                <tbody>${renderMemoryLinkRows(data.memoryLinks)}</tbody>
            </table>
        </div>

        <div class="codex-memory-section-block card">
            <h3>最近写入审计</h3>
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

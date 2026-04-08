// AdminPanel/js/dashboard.js
import { apiFetch } from './utils.js';
import { initializeCalendarWidget } from './schedule-manager.js';

const MONITOR_API_BASE_URL = '/admin_api/system-monitor';
const API_BASE_URL = '/admin_api';

let monitorIntervalId = null;
let activityDataPoints = new Array(60).fill(0);
let lastLogCheckTime = null;

let logoClickCount = 0;
let logoClickTimer = null;

/**
 * 鍒濆鍖栦华琛ㄧ洏锛岃缃畾鏃跺櫒骞跺姞杞藉垵濮嬫暟鎹€? */
export function initializeDashboard() {
    console.log('Initializing Dashboard...');
    if (monitorIntervalId) {
        clearInterval(monitorIntervalId);
    }
    updateDashboardData();
    updateWeatherData();
    updateDailyHotNews();
    initializeCalendarWidget();
    
    updateActivityChart().then(() => {
        drawActivityChart();
    });

    monitorIntervalId = setInterval(() => {
        updateDashboardData();
        updateWeatherData();
        updateDailyHotNews();
        initializeCalendarWidget();
        updateActivityChart().then(() => {
             drawActivityChart();
        });
    }, 5000);

    // 褰╄泲閫昏緫锛氱偣鍑?娆ogo杩涘叆娌夋蹈妯″紡
    const logo = document.getElementById('vcp-logo-main');
    if (logo && !logo.dataset.easterEggInitialized) {
        logo.addEventListener('click', () => {
            logoClickCount++;
            clearTimeout(logoClickTimer);
            if (logoClickCount >= 5) {
                enterImmersiveMode();
                logoClickCount = 0;
            } else {
                logoClickTimer = setTimeout(() => {
                    logoClickCount = 0;
                }, 2000);
            }
        });
        logo.dataset.easterEggInitialized = 'true';
    }

    const exitBtn = document.getElementById('exit-immersive-button');
    if (exitBtn && !exitBtn.dataset.easterEggInitialized) {
        exitBtn.addEventListener('click', exitImmersiveMode);
        exitBtn.dataset.easterEggInitialized = 'true';
    }
}

/**
 * 杩涘叆澶槼绯绘矇娴歌鏅ā寮? */
function enterImmersiveMode() {
    const bg = document.querySelector('.solar-system-bg');
    if (bg) {
        bg.classList.add('immersive-mode');
        document.documentElement.classList.add('ui-hidden-immersive');
        document.body.style.overflow = 'hidden';
        console.log('Entering immersive solar system mode...');
    }
}

/**
 * 閫€鍑烘矇娴告ā寮? */
function exitImmersiveMode() {
    const bg = document.querySelector('.solar-system-bg');
    if (bg) {
        bg.classList.remove('immersive-mode');
        document.documentElement.classList.remove('ui-hidden-immersive');
        document.body.style.overflow = '';
        console.log('Exiting immersive mode.');
    }
}

/**
 * 鍋滄浠〃鐩樼殑鏁版嵁杞銆? */
export function stopDashboardUpdates() {
    if (monitorIntervalId) {
        clearInterval(monitorIntervalId);
        monitorIntervalId = null;
        console.log('Dashboard monitoring stopped.');
    }
}

/**
 * 鏇存柊浠〃鐩樹笂鐨勬墍鏈夋暟鎹€? */
async function updateDashboardData() {
    const cpuProgress = document.getElementById('cpu-progress');
    const cpuUsageText = document.getElementById('cpu-usage-text');
    const cpuInfoText = document.getElementById('cpu-info-text');
    const memProgress = document.getElementById('mem-progress');
    const memUsageText = document.getElementById('mem-usage-text');
    const memInfoText = document.getElementById('mem-info-text');
    const pm2ProcessList = document.getElementById('pm2-process-list');
    const nodeInfoList = document.getElementById('node-info-list');
    const userAuthCodeDisplay = document.getElementById('user-auth-code-display');

    try {
        const [resources, processes, authCodeData] = await Promise.all([
            apiFetch(`${MONITOR_API_BASE_URL}/system/resources`, {}, false),
            apiFetch(`${MONITOR_API_BASE_URL}/processes`, {}, false),
            apiFetch(`${API_BASE_URL}/user-auth-code`, {}, false).catch(err => {
                console.warn('Failed to fetch user auth code:', err.message);
                return { success: false, code: 'N/A (Error)' };
            })
        ]);
        
        if (userAuthCodeDisplay) {
            userAuthCodeDisplay.textContent = authCodeData.success ? authCodeData.code : (authCodeData.code || 'N/A (鏈繍琛?');
        }

        if (cpuProgress && cpuUsageText && cpuInfoText) {
            const cpuUsage = resources.system.cpu.usage.toFixed(1);
            updateProgressCircle(cpuProgress, cpuUsageText, cpuUsage);
            cpuInfoText.innerHTML = `骞冲彴: ${resources.system.nodeProcess.platform} <br> 鏋舵瀯: ${resources.system.nodeProcess.arch}`;
        }

        if (memProgress && memUsageText && memInfoText) {
            const memUsed = resources.system.memory.used;
            const memTotal = resources.system.memory.total;
            const vcpMemUsed = resources.system.nodeProcess.memory.rss;
            const memUsage = memTotal > 0 ? ((memUsed / memTotal) * 100).toFixed(1) : 0;
            const vcpMemUsage = memTotal > 0 ? ((vcpMemUsed / memTotal) * 100).toFixed(1) : 0;
            updateProgressCircle(memProgress, memUsageText, memUsage, vcpMemUsage);
            memInfoText.innerHTML = `宸茬敤: ${(memUsed / 1024 / 1024 / 1024).toFixed(2)} GB <br> 鎬诲叡: ${(memTotal / 1024 / 1024 / 1024).toFixed(2)} GB`;
        }
        
        if (pm2ProcessList) {
            pm2ProcessList.innerHTML = '';
            if (processes.success && processes.processes.length > 0) {
                processes.processes.forEach(proc => {
                    const procEl = document.createElement('div');
                    procEl.className = 'process-item';
                    procEl.innerHTML = `
                        <strong>${proc.name}</strong> (PID: ${proc.pid})
                        <span class="status ${proc.status}">${proc.status}</span> <br>
                        CPU: ${proc.cpu}% | RAM: ${(proc.memory / 1024 / 1024).toFixed(1)} MB
                    `;
                    pm2ProcessList.appendChild(procEl);
                });
            } else {
                pm2ProcessList.innerHTML = '<p>娌℃湁姝ｅ湪杩愯鐨?PM2 杩涚▼銆?/p>';
            }
        }

        if (nodeInfoList) {
            const nodeInfo = resources.system.nodeProcess;
            const uptimeSeconds = nodeInfo.uptime;
            const uptimeHours = Math.floor(uptimeSeconds / 3600);
            const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
            nodeInfoList.innerHTML = `
                <div class="node-info-item"><strong>PID:</strong> ${nodeInfo.pid}</div>
                <div class="node-info-item"><strong>Node.js 鐗堟湰:</strong> ${nodeInfo.version}</div>
                <div class="node-info-item"><strong>鍐呭瓨鍗犵敤:</strong> ${(nodeInfo.memory.rss / 1024 / 1024).toFixed(2)} MB</div>
                <div class="node-info-item"><strong>杩愯鏃堕棿:</strong> ${uptimeHours}h ${uptimeMinutes}m</div>
            `;
        }

    } catch (error) {
        console.error('Failed to update dashboard data:', error);
        if (pm2ProcessList) pm2ProcessList.innerHTML = `<p class="error-message">鍔犺浇 PM2 鏁版嵁澶辫触: ${error.message}</p>`;
        if (nodeInfoList) nodeInfoList.innerHTML = `<p class="error-message">鍔犺浇绯荤粺鏁版嵁澶辫触: ${error.message}</p>`;
    }
}

/**
 * 鏇存柊澶╂皵棰勬姤鏁版嵁銆? */
async function updateWeatherData() {
    const weatherIcon = document.getElementById('weather-icon');
    const weatherTemp = document.getElementById('weather-temp');
    const weatherText = document.getElementById('weather-text');
    const weatherHumidity = document.getElementById('weather-humidity');
    const weatherWind = document.getElementById('weather-wind');
    const weatherPressure = document.getElementById('weather-pressure');
    const weatherForecast = document.getElementById('weather-forecast');

    if (!weatherIcon) return;

    try {
        const data = await apiFetch(`${API_BASE_URL}/weather`, {}, false);
        
        // 鏄犲皠澶╂皵鍥炬爣 (浣跨敤 Material Symbols)
        const iconMap = {
            '100': 'sunny',
            '101': 'cloudy',
            '102': 'cloudy',
            '103': 'partly_cloudy_day',
            '104': 'cloud',
            '150': 'clear_night',
            '151': 'nights_stay',
            '152': 'nights_stay',
            '153': 'nights_stay',
            '154': 'cloud',
            '300': 'rainy',
            '301': 'rainy',
            '302': 'rainy_heavy',
            '303': 'rainy_heavy',
            '304': 'rainy_heavy',
            '305': 'rainy',
            '306': 'rainy',
            '307': 'rainy_heavy',
            '308': 'rainy_heavy',
            '309': 'rainy',
            '310': 'rainy_heavy',
            '311': 'rainy_heavy',
            '312': 'rainy_heavy',
            '313': 'rainy_heavy',
            '314': 'rainy',
            '315': 'rainy_heavy',
            '316': 'rainy_heavy',
            '317': 'rainy_heavy',
            '318': 'rainy_heavy',
            '350': 'rainy',
            '351': 'rainy_heavy',
            '399': 'rainy',
            'default': 'wb_sunny'
        };

        if (data && data.hourly && data.hourly.length > 0) {
            // 瀵绘壘鏈€鎺ヨ繎褰撳墠鏃堕棿鐨勬暣鐐归鎶?            const now = new Date();
            let current = data.hourly[0];
            let minDiff = Infinity;

            for (const hourData of data.hourly) {
                const forecastTime = new Date(hourData.fxTime);
                const diff = Math.abs(now - forecastTime);
                if (diff < minDiff) {
                    minDiff = diff;
                    current = hourData;
                }
            }

            weatherIcon.textContent = iconMap[current.icon] || iconMap['default'];
            weatherTemp.textContent = current.temp;
            weatherText.textContent = current.text;
            weatherHumidity.textContent = `${current.humidity}%`;
            weatherWind.textContent = `${current.windDir} ${current.windScale}绾;
            weatherPressure.textContent = `${current.pressure} hPa`;
        }

        if (data && data.daily && data.daily.length > 0 && weatherForecast) {
            weatherForecast.innerHTML = '';
            // 鏄剧ず鏈潵 4 澶╃殑棰勬姤 (璺宠繃浠婂ぉ)
            data.daily.slice(1, 5).forEach(day => {
                const date = new Date(day.fxDate);
                const dayName = date.toLocaleDateString('zh-CN', { weekday: 'short' });
                
                const forecastItem = document.createElement('div');
                forecastItem.className = 'forecast-item';
                forecastItem.innerHTML = `
                    <span class="forecast-date">${dayName}</span>
                    <span class="material-symbols-outlined forecast-icon">${iconMap[day.iconDay] || iconMap['default']}</span>
                    <span class="forecast-temp">${day.tempMin}掳/${day.tempMax}掳</span>
                `;
                weatherForecast.appendChild(forecastItem);
            });
        }
    } catch (error) {
        console.error('Failed to update weather data:', error);
        if (weatherText) weatherText.textContent = '鍔犺浇澶辫触';
    }
}

/**
 * 鏇存柊姣忔棩鐑鏁版嵁銆? */
async function updateDailyHotNews() {
    const newsScroller = document.getElementById('news-scroller');
    if (!newsScroller) return;

    try {
        const response = await apiFetch(`${API_BASE_URL}/dailyhot`, {}, false);
        if (response.success && response.data.length > 0) {
            // Check if content actually changed to avoid restarting animation unnecessarily
            const currentItemCount = newsScroller.querySelectorAll('.news-item').length;
            if (currentItemCount === response.data.length * 2) return; 

            newsScroller.innerHTML = '';
            
            // 涓轰簡瀹炵幇鏃犵紳婊氬姩锛屾垜浠渶瑕佸鍒朵竴浠芥暟鎹?            const allItems = [...response.data, ...response.data];
            
            allItems.forEach(item => {
                const itemEl = document.createElement('a');
                itemEl.className = 'news-item';
                itemEl.href = item.url;
                itemEl.target = '_blank';
                itemEl.innerHTML = `
                    <span class="news-source">${item.source}</span>
                    <span class="news-title">${item.title}</span>
                `;
                newsScroller.appendChild(itemEl);
            });

            // 璁＄畻鍔ㄧ敾鏃堕暱锛氭瘡涓潯鐩害 4 绉?            const duration = response.data.length * 4;
            newsScroller.style.animation = `scroll-news ${duration}s linear infinite`;
        } else {
            newsScroller.innerHTML = '<p style="text-align: center; padding: 20px; opacity: 0.6;">鏆傛棤鐑鏁版嵁銆?/p>';
        }
    } catch (error) {
        console.error('Failed to update daily hot news:', error);
        newsScroller.innerHTML = `<p class="error-message">鍔犺浇鐑澶辫触: ${error.message}</p>`;
    }
}

/**
 * 鏇存柊鍦嗗舰杩涘害鏉°€? * @param {HTMLElement} circleElement - SVG 鍏冪礌
 * @param {HTMLElement} textElement - 鏄剧ず鐧惧垎姣旂殑鏂囨湰鍏冪礌
 * @param {number} percentage - 鐧惧垎姣? */
function updateProgressCircle(circleElement, textElement, percentage, secondaryPercentage = null) {
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    
    const progressBar = circleElement.querySelector('.progress-bar');
    if (progressBar) {
        progressBar.style.strokeDashoffset = offset;
    }

    if (secondaryPercentage !== null) {
        const secondaryProgressBar = circleElement.querySelector('.progress-bar-secondary');
        if (secondaryProgressBar) {
            const secondaryOffset = circumference - (secondaryPercentage / 100) * circumference;
            secondaryProgressBar.style.strokeDashoffset = secondaryOffset;
        }
    }

    if (textElement) {
        textElement.textContent = `${percentage}%`;
    }
}

/**
 * 浠庢湇鍔″櫒鏃ュ織鏇存柊娲诲姩鍥捐〃鐨勬暟鎹€? */
async function updateActivityChart() {
    const activityChartCanvas = document.getElementById('activity-chart-canvas');
    if (!activityChartCanvas) return;

    try {
        const logData = await apiFetch(`${API_BASE_URL}/server-log`, {}, false);
        const logLines = logData.content.split('\n');
        
        let newLogsCount = 0;
        let latestTimeInThisBatch = null;

        const regex = /\[(\d{4}\/\d{1,2}\/\d{1,2}\s\d{1,2}:\d{2}:\d{2})\]/;
        for (const line of logLines) {
            const match = line.match(regex);
            if (match && match[1]) {
                const timestamp = new Date(match[1]);
                if (isNaN(timestamp.getTime())) continue;

                if (lastLogCheckTime && timestamp > lastLogCheckTime) {
                    newLogsCount++;
                }

                if (!latestTimeInThisBatch || timestamp > latestTimeInThisBatch) {
                    latestTimeInThisBatch = timestamp;
                }
            }
        }
        
        if (latestTimeInThisBatch) {
            lastLogCheckTime = latestTimeInThisBatch;
        }
        
        activityDataPoints.push(newLogsCount);
        if (activityDataPoints.length > 60) {
            activityDataPoints.shift();
        }

    } catch (error) {
        console.error('Failed to update activity chart data:', error);
        activityDataPoints.push(0);
        if (activityDataPoints.length > 60) {
            activityDataPoints.shift();
        }
    }
}

/**
 * 缁樺埗鏈嶅姟鍣ㄦ椿鍔ㄥ浘琛ㄣ€? */
function drawActivityChart() {
    const activityChartCanvas = document.getElementById('activity-chart-canvas');
    if (!activityChartCanvas) return;
    const canvas = activityChartCanvas;
    const ctx = canvas.getContext('2d');
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width;
    canvas.height = height;

    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const lineColor = theme === 'dark' ? 'rgba(138, 180, 248, 0.8)' : 'rgba(26, 115, 232, 0.8)';
    const fillColor = theme === 'dark' ? 'rgba(138, 180, 248, 0.15)' : 'rgba(26, 115, 232, 0.15)';
    const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    
    const maxCount = Math.max(5, ...activityDataPoints);
    const padding = 10;

    ctx.clearRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
        const y = height / 5 * i + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Draw the line and area fill
    ctx.beginPath();
    
    const points = activityDataPoints.map((d, i) => {
        const x = (i / (activityDataPoints.length - 1)) * (width - padding * 2) + padding;
        const y = height - (d / maxCount) * (height - padding * 2) - padding;
        return { x, y };
    });

    if (points.length > 0) {
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
    }
    
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Area fill
    if (points.length > 1) {
        ctx.lineTo(points[points.length - 1].x, height - padding);
        ctx.lineTo(points[0].x, height - padding);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
    }
}

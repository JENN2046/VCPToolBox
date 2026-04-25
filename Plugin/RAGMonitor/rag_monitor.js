const fs = require('fs');
const path = require('path');
const { WebSocket } = require('ws'); // 假设环境支持或引入

// === 配置区 ===
const SERVER_LOG_PATH = path.join(__dirname, '../../DebugLog/ServerLog.txt');
const OUTPUT_LOG_PATH = path.join(__dirname, '../../logs/batch_operations/rag_monitor_log.txt');

// 状态缓存
let state = {
    processedFiles: 0,
    totalVectors: 0,
    status: 'Initializing',
    lastUpdate: Date.now()
};

console.log('🚀 [RAG-Monitor-Pro] 启动！监听目标:', SERVER_LOG_PATH);

// 1. 初始化输出日志
const outputDir = path.dirname(OUTPUT_LOG_PATH);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// 2. 核心推送函数 (模拟 VCP 内部广播)
function pushToDesktop(data) {
    // 写入本地日志
    const logLine = `[${new Date().toLocaleTimeString()}] [RAG-MONITOR] 📊 文件:${data.processedFiles} | 向量:${data.totalVectors} | 状态:${data.status}\n`;
    fs.appendFile(OUTPUT_LOG_PATH, logLine, (err) => {
        if (err) console.error('写日志失败:', err);
    });

    // 【关键】推送到桌面端
    // 这里调用 VCP 内部的全局消息推送机制 (模拟 pushVcpInfo 或直接广播)
    // 在实际 VCP 环境中，这可能是 global.pushStaticPlaceholder 或 wsServer.broadcast
    try {
        // 假设 VCP 全局有一个用于推送动态上下文的函数
        if (global.pushVcpInfo) {
            global.pushVcpInfo('RAG_PROGRESS', data); 
        }
        // 或者通过 WebSocket 广播特定 Topic
        if (global.wsServer) {
             global.wsServer.broadcast(JSON.stringify({
                type: 'RAG_PROGRESS_UPDATE',
                payload: data
            }));
        }
        console.log(`✅ 已推送进度到桌面：${data.status}`);
    } catch (e) {
        console.log('⚠️ 推送模块暂未完全接入全局，暂存本地日志:', e.message);
    }
}

// 3. 文件流监听 (fs.watch 实现实时响应)
let isProcessing = false;
let debounceTimer;

function watchLog() {
    if (!fs.existsSync(SERVER_LOG_PATH)) {
        console.log('⏳ 等待日志文件生成...');
        setTimeout(watchLog, 1000);
        return;
    }

    // 初始读取一次
    fs.stat(SERVER_LOG_PATH, (err, stats) => {
        if (err) return;
        // 从文件末尾开始监听，或者根据需要从头
        // 这里简化为持续轮询最后几行以捕获变化 (更稳健的实现是用 chokidar + fs.createReadStream)
        checkChanges(); 
    });

    // 简单轮询实现实时性 (每 500ms)
    setInterval(checkChanges, 500);
}

let lastSize = 0;
let lastKnownLine = "";

function checkChanges() {
    fs.stat(SERVER_LOG_PATH, (err, stats) => {
        if (err || stats.size < lastSize) {
            lastSize = 0; 
            lastKnownLine = "";
            return;
        }
        if (stats.size === lastSize) return; // 无变化

        // 读取新增部分
        const stream = fs.createReadStream(SERVER_LOG_PATH, {
            start: lastSize,
            encoding: 'utf8'
        });

        let newData = "";
        stream.on('data', chunk => { newData += chunk; });
        stream.on('end', () => {
            lastSize += Buffer.byteLength(newData, 'utf8');
            analyzeAndPush(newData);
        });
    });
}

function analyzeAndPush(text) {
    const lines = text.split('\n');
    let hasUpdate = false;
    
    lines.forEach(line => {
        if (line.includes('Processing') && line.includes('files')) {
            state.processedFiles += 50;
            state.status = 'Processing Files';
            hasUpdate = true;
        }
        if (line.includes('Loaded') && line.includes('vectors')) {
            const match = line.match(/(\d+)/);
            if (match) state.totalVectors = parseInt(match[1]);
            state.status = 'Loading Vectors';
            hasUpdate = true;
        }
        if (line.includes('System Ready')) {
            state.status = 'System Ready';
            hasUpdate = true;
        }
    });

    if (hasUpdate) {
        state.lastUpdate = Date.now();
        pushToDesktop(state);
    }
}

// 启动
watchLog();
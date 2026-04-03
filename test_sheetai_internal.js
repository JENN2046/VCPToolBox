// 内部渗透测试脚本：直接调用路由逻辑，绕过 HTTP 鉴权
const path = require('path');
const fs = require('fs');

// 1. 设置环境变量 (模拟 config.env 加载后的状态)
// 注意：这里必须使用绝对路径，且要确保目录存在
const targetRoot = 'A:\\VCP\\VCPChat\\AppData\\UserData\\SheetAI';
console.log(`🔧 设置 SHEETAI_ROOT_PATH 为：${targetRoot}`);
process.env.SHEETAI_ROOT_PATH = targetRoot;

// 2. 引入路由模块 (假设模块导出的是函数)
// 为了防止路径问题，我们尝试动态加载
const routesPath = path.join(__dirname, 'routes', 'sheetAIRoutes.js');
console.log(`📂 尝试加载路由模块：${routesPath}`);

let createSheetAIRoutes;
try {
    createSheetAIRoutes = require(routesPath);
} catch (e) {
    console.error('❌ 加载路由模块失败:', e.message);
    console.log('提示：请确保 sheetAIRoutes.js 存在且导出正确。');
    process.exit(1);
}

// 3. 模拟 Express 的 router 和 request/response
const router = createSheetAIRoutes();
const express = require('express');
const app = express();
app.use(express.json());
app.use('/sheetai', router);

// 4. 创建测试服务器
const server = app.listen(6006, () => {
    console.log('🚀 内部测试服务器已启动在端口 6006');
    
    // 发送测试请求
    const http = require('http');
    const data = JSON.stringify({ title: 'Nova_Internal_Test_001' });
    
    const req = http.request({
        hostname: 'localhost',
        port: 6006,
        path: '/sheetai/workbooks',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            console.log(`\n📡 响应状态码：${res.statusCode}`);
            console.log('返回数据:', body);
            
            if (res.statusCode === 201) {
                try {
                    const result = JSON.parse(body);
                    const wbId = result.workbook?.id;
                    if (wbId) {
                        const expectedPath = path.join(targetRoot, 'workbooks', wbId, 'workbook.json');
                        console.log(`\n🔍 验证文件路径：${expectedPath}`);
                        setTimeout(() => {
                            if (fs.existsSync(expectedPath)) {
                                console.log('🎉 验证成功！文件已写入正确位置。');
                                console.log('文件内容:', fs.readFileSync(expectedPath, 'utf8'));
                            } else {
                                console.log('⚠️ 文件未找到。检查根目录内容:');
                                if(fs.existsSync(targetRoot)) {
                                    console.log(fs.readdirSync(targetRoot, {recursive: true}));
                                }
                            }
                            server.close();
                        }, 500);
                        return;
                    }
                } catch(e) {}
            }
            server.close();
        });
    });
    
    req.on('error', (e) => {
        console.error('请求错误:', e.message);
        server.close();
    });
    
    req.write(data);
    req.end();
});
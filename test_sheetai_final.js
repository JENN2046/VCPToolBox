const http = require('http');
const fs = require('fs');
const path = require('path');

// 配置
const API_KEY = 'rusfV67PmofYMxjhPrQ8HMbU'; // 从 config.env 获取的 Key
const TARGET_PATH = 'A:\\VCP\\VCPChat\\AppData\\UserData\\SheetAI\\workbooks';

// 1. 发送创建请求
const data = JSON.stringify({ title: 'Nova_最终测试_001' });
console.log('🚀 正在发送创建请求...');

const req = http.request({
    hostname: 'localhost',
    port: 6005,
    path: '/admin_api/sheetai/workbooks',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'x-api-key': API_KEY, // 尝试使用 x-api-key
        'Authorization': `Bearer ${API_KEY}` // 同时也试试 Bearer
    }
}, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log(`\n📡 响应状态码：${res.statusCode}`);
        if (res.statusCode === 201 || res.statusCode === 200) {
            try {
                const result = JSON.parse(body);
                console.log('✅ 创建成功！');
                console.log('返回数据:', JSON.stringify(result, null, 2));
                
                // 2. 验证文件路径
                const workbookId = result.workbook?.id;
                if (workbookId) {
                    const expectedFile = path.join(TARGET_PATH, workbookId, 'workbook.json');
                    console.log(`\n🔍 验证文件是否存在：${expectedFile}`);
                    
                    // 给文件系统一点时间同步
                    setTimeout(() => {
                        if (fs.existsSync(expectedFile)) {
                            console.log('🎉 验证通过！文件已持久化。');
                            console.log('文件内容:');
                            console.log(fs.readFileSync(expectedFile, 'utf8'));
                        } else {
                            console.log('⚠️ 文件未在预期路径找到。尝试列出目标目录:');
                            if(fs.existsSync(path.dirname(expectedFile))) {
                                console.log(fs.readdirSync(path.dirname(expectedFile)));
                            } else {
                                console.log('⚠️ 连父目录都不存在！可能是路径配置问题。');
                                // 检查根目录
                                const root = 'A:\\VCP\\VCPChat\\AppData\\UserData\\SheetAI';
                                if(fs.existsSync(root)) {
                                    console.log(`根目录 (${root}) 内容:`, fs.readdirSync(root, {recursive:true}));
                                }
                            }
                        }
                    }, 500);
                }
            } catch (e) {
                console.log('解析返回数据失败:', e.message);
                console.log('原始返回:', body);
            }
        } else {
            console.log('❌ 请求失败:', body);
        }
    });
});

req.on('error', (e) => {
    console.error(`\n❌ 请求出错：${e.message}`);
});

req.write(data);
req.end();
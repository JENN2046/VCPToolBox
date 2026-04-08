// fix_session_store.js
// 诺宝特供：一键修复 SessionBindingStore.js 脚本

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'modules', 'channelHub', 'SessionBindingStore.js');
const backupPath = filePath + '.bak';

console.log('🔧 诺宝正在检查文件...', filePath);

if (!fs.existsSync(filePath)) {
    console.error('❌ 错误：找不到文件！请确认路径是否正确。');
    process.exit(1);
}

// 读取原始内容
let content = fs.readFileSync(filePath, 'utf-8');

// 定义需要替换的关键片段
// 1. 更新 JSDoc 注释，添加新字段说明
const oldDoc = '* - externalSessionKey: 外部平台会话标识\n * - topicId: VCP 内部话题 ID';
const newDoc = '* - externalSessionKey: 外部平台会话标识\n * - sessionWebhook: (钉钉专用) 群聊会话的 Webhook 地址\n * - sessionWebhookExpiredTime: (钉钉专用) Webhook 过期时间戳\n * - topicId: VCP 内部话题 ID';

// 2. 替换 _createBinding 方法中的 record 对象构建逻辑
// 我们找到 const record = { ... 这一行，并在其中插入新字段
// 为了精准，我们匹配 _createBinding 方法内部的逻辑
const oldRecordLogic = `const record = {
 bindingKey,
 externalSessionKey: envelope.session?.externalSessionKey || bindingKey,
 platform: envelope.channel,`;

const newRecordLogic = `// 【修复】从 metadata.platformData 中提取平台特有会话数据 (如钉钉的 sessionWebhook)
const platformData = envelope.metadata?.platformData || {};

const record = {
 bindingKey,
 externalSessionKey: envelope.session?.externalSessionKey || bindingKey,
 // 【核心修复】保存钉钉群聊关键的 sessionWebhook 和过期时间
 sessionWebhook: platformData.sessionWebhook || envelope.session?.sessionWebhook || null,
 sessionWebhookExpiredTime: platformData.sessionWebhookExpiredTime || envelope.session?.sessionWebhookExpiredTime || null,
 platform: envelope.channel,`;

let modified = false;

// 执行替换
if (content.includes(oldDoc)) {
    content = content.replace(oldDoc, newDoc);
    console.log('✅ 已更新 JSDoc 注释');
    modified = true;
} else {
    console.log('ℹ️  JSDoc 注释似乎已更新或格式不同，跳过。');
}

if (content.includes(oldRecordLogic)) {
    content = content.replace(oldRecordLogic, newRecordLogic);
    console.log('✅ 已修复 _createBinding 方法，添加 sessionWebhook 字段');
    modified = true;
} else {
    console.log('⚠️  _createBinding 方法逻辑似乎已修改或格式不同，跳过。');
    // 如果没找到旧逻辑，可能是之前已经部分修复过，我们尝试再次确认
    if (content.includes('sessionWebhook:')) {
        console.log('✅ 检测到代码中已包含 sessionWebhook 字段，逻辑可能已存在。');
    }
}

if (modified || content.includes('sessionWebhook:')) {
    // 备份旧文件
    console.log('💾 正在备份原文件...', backupPath);
    fs.copyFileSync(filePath, backupPath);

    // 写入新文件
    console.log('✍️  正在写入修复后的代码...');
    fs.writeFileSync(filePath, content, 'utf-8');

    console.log('🎉 修复成功！原文件已备份为 SessionBindingStore.js.bak');
    console.log('🚀 下一步：请重启 VCP 服务器 (node server.js) 以生效！');
} else {
    console.log('⚠️  未进行任何修改，代码可能已经是最新的或者结构差异较大。');
}
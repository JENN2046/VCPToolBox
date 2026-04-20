/**
 * 图片评分系统 - 快速测试脚本
 *
 * 运行方式：node test-rating-system.js
 */

const path = require('path');
const ratingManager = require('./image-rating-manager.js');

// 初始化数据库
console.log('1. 初始化数据库...');
const initResult = ratingManager.initDatabase();
console.log('   数据库初始化:', initResult ? '成功' : '失败');

if (!initResult) {
  console.error('数据库初始化失败，退出测试');
  process.exit(1);
}

// 测试注册图片
console.log('\n2. 测试注册图片...');
const testImagePath = 'image/zimagegen/test-001.png';
const registerResult = ratingManager.registerImage(testImagePath, 'TestPlugin', {
  width: 512,
  height: 512,
  generated_at: new Date().toISOString()
});
console.log('   注册结果:', registerResult.success ? '成功' : '失败');
if (registerResult.success) {
  console.log('   图片 ID:', registerResult.id);
}

// 测试设置评分
if (registerResult.success) {
  console.log('\n3. 测试设置评分...');
  const ratingResult = ratingManager.setRating(registerResult.id, 8, '测试评价');
  console.log('   评分结果:', ratingResult.success ? '成功' : '失败');

  // 测试添加标签
  console.log('\n4. 测试添加标签...');
  const tagResult = ratingManager.addTags(registerResult.id, ['测试', '高质量']);
  console.log('   标签结果:', tagResult.success ? '成功' : '失败');

  // 测试获取图片信息
  console.log('\n5. 测试获取图片信息...');
  const infoResult = ratingManager.getImageInfo(registerResult.id);
  if (infoResult.success) {
    console.log('   图片路径:', infoResult.image.image_path);
    console.log('   评分:', infoResult.rating?.score || '无');
    console.log('   标签:', infoResult.tags.join(', ') || '无');
  }

  // 测试搜索
  console.log('\n6. 测试搜索图片...');
  const searchResult = ratingManager.searchImages({ minScore: 7 });
  if (searchResult.success) {
    console.log('   找到', searchResult.images.length, '张图片');
  }

  // 测试统计
  console.log('\n7. 测试统计信息...');
  const statsResult = ratingManager.getStats();
  if (statsResult.success) {
    console.log('   总图片数:', statsResult.stats.total_images);
    console.log('   已评分:', statsResult.stats.rated_images);
    console.log('   平均分:', statsResult.stats.average_score?.toFixed(2) || '0');
  }

}

// 测试获取所有标签
console.log('\n8. 测试获取所有标签...');
const tagsResult = ratingManager.getAllTags();
if (tagsResult.success) {
  console.log('   标签列表:', tagsResult.tags.map(t => t.name).join(', ') || '无');
}

console.log('\n=== 测试完成 ===');

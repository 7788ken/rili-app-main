const axios = require('axios');
const crypto = require('crypto');

// 配置
const API_SECRET = 'your-secret-key-please-change-in-production';
const BASE_URL = 'http://localhost:3002';

// 生成安全头部
function generateSecurityHeaders(path) {
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHash('md5')
    .update(path + timestamp + API_SECRET)
    .digest('hex');

  return {
    'X-Timestamp': timestamp,
    'X-Sign': signature
  };
}

// 测试用例
async function runTests() {
  console.log('开始测试签名验证机制...\n');

  try {
    // 测试 1: 正确的签名
    console.log('测试 1: 使用正确的签名请求 /health');
    const path1 = '/health';
    const response1 = await axios.get(`${BASE_URL}${path1}`, {
      headers: generateSecurityHeaders(path1)
    });
    console.log('结果: 成功 ✅');
    console.log('响应:', response1.data);
    console.log('-------------------\n');

    // 测试 2: 错误的签名
    console.log('测试 2: 使用错误的签名请求 /api/calendars');
    const path2 = '/api/calendars';
    try {
      await axios.get(`${BASE_URL}${path2}`, {
        headers: {
          'X-Timestamp': Date.now().toString(),
          'X-Sign': 'wrong-signature'
        }
      });
      console.log('结果: 失败 ❌ (应该被拒绝但没有)');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('结果: 成功 ✅ (正确拒绝了错误签名)');
        console.log('错误信息:', error.response.data);
      }
    }
    console.log('-------------------\n');

    // 测试 3: 过期的时间戳
    console.log('测试 3: 使用过期的时间戳');
    const path3 = '/api/calendars';
    const oldTimestamp = (Date.now() - 6 * 60 * 1000).toString(); // 6分钟前
    const oldSignature = crypto
      .createHash('md5')
      .update(path3 + oldTimestamp + API_SECRET)
      .digest('hex');

    try {
      await axios.get(`${BASE_URL}${path3}`, {
        headers: {
          'X-Timestamp': oldTimestamp,
          'X-Sign': oldSignature
        }
      });
      console.log('结果: 失败 ❌ (应该拒绝过期请求但没有)');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('结果: 成功 ✅ (正确拒绝了过期请求)');
        console.log('错误信息:', error.response.data);
      }
    }
    console.log('-------------------\n');

    // 测试 4: 获取日历列表
    console.log('测试 4: 获取日历列表');
    const path4 = '/api/calendars/7265109629a8/schedules';
    const response4 = await axios.get(`${BASE_URL}${path4}`, {
      headers: generateSecurityHeaders(path4)
    });
    console.log('结果: 成功 ✅');
    console.log('响应:', response4.data);
    console.log('-------------------\n');

  } catch (error) {
    console.error('测试过程中出现未预期的错误:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 运行测试
runTests(); 
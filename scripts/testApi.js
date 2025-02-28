/**
 * API测试脚本
 * 用于测试日历共享服务的API
 */
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// API基础URL
const API_URL = process.env.API_URL || 'http://localhost:3000/api';

// 调试模式
const DEBUG = process.env.DEBUG === 'true' || true;

// 存储认证令牌
let token = '';

// 测试用户数据
const testUser = {
  name: '测试用户',
  email: 'test@example.com',
  password: 'test123'
};

// 测试日历数据
const testCalendar = {
  title: '测试日历',
  description: '这是一个测试日历',
  color: '#FF5733'
};

// 测试日程数据
const testSchedule = {
  title: '测试日程',
  description: '这是一个测试日程',
  location: '测试地点',
  startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 明天
  endTime: new Date(Date.now() + 25 * 60 * 60 * 1000), // 明天+1小时
  isAllDay: false,
  color: '#33FF57'
};

// 辅助函数：打印响应
const printResponse = (title, response) => {
  console.log(`\n===== ${title} =====`);
  console.log('状态码:', response.status);
  console.log('数据:', JSON.stringify(response.data, null, 2));
};

// 辅助函数：打印错误
const printError = (title, error) => {
  console.error(`\n===== ${title} 错误 =====`);
  if (error.response) {
    console.error('状态码:', error.response.status);
    console.error('响应数据:', error.response.data);
  } else {
    console.error('错误:', error.message);
  }
  
  if (DEBUG) {
    if (error.config) {
      console.error('\n请求详情:');
      console.error('URL:', error.config.url);
      console.error('方法:', error.config.method);
      console.error('头信息:', error.config.headers);
      if (error.config.data) {
        try {
          console.error('数据:', JSON.parse(error.config.data));
        } catch (e) {
          console.error('数据:', error.config.data);
        }
      }
    }
  }
};

// 测试用户注册
const testRegister = async () => {
  try {
    const response = await axios.post(`${API_URL}/users/register`, testUser);
    printResponse('用户注册', response);
    return response.data.data;
  } catch (error) {
    printError('用户注册', error);
    // 如果用户已存在，尝试登录
    return await testLogin();
  }
};

// 测试用户登录
const testLogin = async () => {
  try {
    const response = await axios.post(`${API_URL}/users/login`, {
      email: testUser.email,
      password: testUser.password
    });
    printResponse('用户登录', response);
    return response.data.data;
  } catch (error) {
    printError('用户登录', error);
    throw error;
  }
};

// 测试获取用户资料
const testGetProfile = async () => {
  try {
    const response = await axios.get(`${API_URL}/users/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    printResponse('获取用户资料', response);
  } catch (error) {
    printError('获取用户资料', error);
  }
};

// 测试创建日历
const testCreateCalendar = async () => {
  try {
    const response = await axios.post(
      `${API_URL}/calendars`,
      testCalendar,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    printResponse('创建日历', response);
    return response.data.data;
  } catch (error) {
    printError('创建日历', error);
    throw error;
  }
};

// 测试获取用户的日历
const testGetCalendars = async () => {
  try {
    const response = await axios.get(
      `${API_URL}/calendars`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    printResponse('获取用户的日历', response);
    return response.data.data;
  } catch (error) {
    printError('获取用户的日历', error);
    throw error;
  }
};

// 测试创建日程
const testCreateSchedule = async (calendarId) => {
  try {
    const response = await axios.post(
      `${API_URL}/calendars/${calendarId}/schedules`,
      testSchedule,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    printResponse('创建日程', response);
    return response.data.data;
  } catch (error) {
    printError('创建日程', error);
    throw error;
  }
};

// 测试获取日历的日程
const testGetSchedules = async (calendarId) => {
  try {
    const response = await axios.get(
      `${API_URL}/calendars/${calendarId}/schedules`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    printResponse('获取日历的日程', response);
    return response.data.data;
  } catch (error) {
    printError('获取日历的日程', error);
    throw error;
  }
};

// 测试服务器状态
const testServerStatus = async () => {
  try {
    console.log('正在测试服务器状态...');
    const response = await axios.get(`${API_URL.replace('/api', '')}/`);
    printResponse('服务器状态', response);
    return true;
  } catch (error) {
    printError('服务器状态', error);
    return false;
  }
};

// 主测试函数
const runTests = async () => {
  try {
    console.log('开始API测试...');
    console.log(`API URL: ${API_URL}`);
    
    // 测试服务器状态
    const serverOnline = await testServerStatus();
    if (!serverOnline) {
      console.error('\n服务器未响应，请确保服务器已启动');
      process.exit(1);
    }
    
    // 测试用户认证
    const userData = await testRegister();
    token = userData.token;
    await testGetProfile();

    // 测试日历功能
    const calendar = await testCreateCalendar();
    const calendars = await testGetCalendars();

    // 如果有日历，测试日程功能
    if (calendars && calendars.length > 0) {
      const calendarId = calendars[0].id;
      await testCreateSchedule(calendarId);
      await testGetSchedules(calendarId);
    }

    console.log('\n测试完成！');
  } catch (error) {
    console.error('\n测试过程中出错:', error.message);
  }
};

// 执行测试
runTests(); 
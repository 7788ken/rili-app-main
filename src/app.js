const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./config/db');
const { syncModels } = require('./models');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// 设置基本速率限制
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP最多100个请求
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: '请求频率过高，请稍后再试',
  }
});

// 分享请求的特殊限制
const shareLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5分钟
  max: 200, // 每个IP最多200个请求
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: '请求频率过高，请稍后再试',
  }
});

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// 请求日志中间件
app.use((req, res, next) => {
  // 跳过健康检查端点的日志
  if (req.path === '/health') {
    return next();
  }

  console.log('\n-------------- 收到客户端请求 --------------');
  console.log(`${new Date().toISOString()}`);
  console.log(`${req.method} ${req.originalUrl}`);
  console.log('请求头:', JSON.stringify(req.headers, null, 2));
  
  if (req.method !== 'GET') {
    console.log('请求体:', JSON.stringify(req.body, null, 2));
  }
  
  // 记录响应
  const originalSend = res.send;
  res.send = function(data) {
    console.log('响应状态码:', res.statusCode);
    try {
      // 尝试解析并打印JSON响应
      const parsedData = JSON.parse(data);
      console.log('响应体:', JSON.stringify(parsedData, null, 2));
    } catch (e) {
      // 如果不是JSON，只记录长度
      console.log(`响应体: [非JSON数据, 长度 ${data.length}]`);
    }
    console.log('-------------- 请求处理完成 --------------\n');
    return originalSend.call(this, data);
  };
  
  next();
});

// 日志中间件
if (process.env.NODE_ENV === 'development') {
  // 跳过健康检查端点的开发环境日志
  app.use(morgan('dev', {
    skip: (req) => req.path === '/health'
  }));
}

// 对API路由应用速率限制
app.use('/api/', apiLimiter);
app.use('/api/share', shareLimiter);
app.use('/api/calendars', shareLimiter);

// 处理favicon.ico请求
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // 返回"无内容"状态码
});

// 首页路由
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to Calendar Sharing Service API - No Login Required',
    version: '2.0.0',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    // timestamp: new Date().toISOString(),
    // uptime: process.uptime(),
    // memory: process.memoryUsage()
  });
});

// API分享路由 - 新的无登录系统
app.use('/api/share', require('./routes/shareRoutes'));

// API日历路由 - 符合前端需求的API
app.use('/api/calendars', require('./routes/calendarRoutes'));

// 客户端日历导入页面
app.get('/calendar/:shareCode', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/calendar.html'));
});

// 错误处理中间件
app.use(notFound);
app.use(errorHandler);

// Socket.io事件处理 - 用于实时同步
io.on('connection', (socket) => {
  console.log('设备已连接:', socket.id);
  
  socket.on('join-calendar', (shareCode) => {
    socket.join(shareCode);
    console.log(`设备 ${socket.id} 加入日历: ${shareCode}`);
  });
  
  socket.on('leave-calendar', (shareCode) => {
    socket.leave(shareCode);
    console.log(`设备 ${socket.id} 离开日历: ${shareCode}`);
  });
  
  socket.on('calendar-change', ({ shareCode, action, data }) => {
    // 广播变更给所有订阅此日历的其他客户端
    socket.to(shareCode).emit('calendar-updated', { action, data });
  });
  
  socket.on('disconnect', () => {
    console.log('设备已断开连接:', socket.id);
  });
});

// 定期清理过期的日历数据
const cleanupInterval = process.env.CLEANUP_INTERVAL || 24 * 60 * 60 * 1000; // 默认每24小时
if (process.env.NODE_ENV === 'production') {
  const { Calendar, Schedule } = require('./models');
  const { Op } = require('sequelize');

  setInterval(async () => {
    try {
      const now = new Date();
      // 找到过期的日历
      const expiredCalendars = await Calendar.findAll({
        where: {
          shareExpire: {
            [Op.lt]: now
          }
        },
        attributes: ['id']
      });
      
      const expiredCalendarIds = expiredCalendars.map(cal => cal.id);
      
      // 删除这些日历的日程
      if (expiredCalendarIds.length > 0) {
        await Schedule.destroy({
          where: {
            calendarId: {
              [Op.in]: expiredCalendarIds
            }
          }
        });
      }
      
      // 删除过期的日历
      const result = await Calendar.destroy({
        where: {
          shareExpire: {
            [Op.lt]: now
          }
        }
      });
      
      console.log(`清理过期日历: ${result} 个已删除，包含的日程已清理`);
    } catch (error) {
      console.error('清理过期日历出错:', error);
    }
  }, cleanupInterval);
}

// 启动服务器
const PORT = process.env.PORT || 3002;

// 连接数据库并启动服务器
const startServer = async () => {
  try {
    // 连接到MySQL数据库
    await connectDB();
    
    // 同步数据库模型
    await syncModels();
    
    // 启动服务器
    server.listen(PORT, () => {
      console.log(`服务器运行在${process.env.NODE_ENV}模式下，端口: ${PORT}`);
    });
  } catch (error) {
    console.error(`服务器启动失败: ${error.message}`);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server, io }; 
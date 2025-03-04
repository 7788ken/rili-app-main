const crypto = require('crypto');
require('dotenv').config();

// 从环境变量获取签名密钥
const API_SECRET = process.env.API_SECRET;

if (!API_SECRET) {
  console.error('警告: API_SECRET 未在环境变量中设置');
  process.exit(1);
}

// 验证请求签名
const verifySignature = (req, res, next) => {
  // 跳过健康检查接口和静态文件
  if (req.path === '/health' || req.path.startsWith('/static/')) {
    return next();
  }

  const timestamp = req.headers['x-timestamp'];
  const signature = req.headers['x-sign'];

  // 验证必要的头部信息
  if (!timestamp || !signature) {
    return res.status(401).json({
      success: false,
      message: '缺少必要的安全验证信息'
    });
  }

  // 验证时间戳是否在有效期内（5分钟）
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
    return res.status(401).json({
      success: false,
      message: '请求已过期'
    });
  }

  // 使用原始URL路径计算签名
  const expectedSign = crypto
    .createHash('md5')
    .update(req.originalUrl + timestamp + API_SECRET)
    .digest('hex');

  // 验证签名
  if (signature !== expectedSign) {
    console.log('Invalid signature:');
    console.log('Expected:', expectedSign);
    console.log('Received:', signature);
    console.log('Path:', req.originalUrl);
    console.log('Timestamp:', timestamp);
    
    return res.status(401).json({
      success: false,
      message: '无效的签名'
    });
  }

  next();
};

module.exports = {
  verifySignature
}; 
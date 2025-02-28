const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const { User } = require('../models/index');

/**
 * 保护路由中间件 - 验证用户令牌
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // 从Authorization头获取令牌
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // 获取令牌部分
      token = req.headers.authorization.split(' ')[1];

      // 验证令牌
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'calendar-app-jwt-secret'
      );

      // 获取用户信息（不包含密码）
      req.user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password'] }
      });

      next();
    } catch (error) {
      console.error('身份验证失败', error);
      res.status(401);
      throw new Error('未授权，令牌验证失败');
    }
  }

  if (!token) {
    res.status(401);
    throw new Error('未授权，未提供令牌');
  }
});

/**
 * 管理员权限中间件
 */
const isAdmin = asyncHandler(async (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403);
    throw new Error('未授权，需要管理员权限');
  }
});

module.exports = { protect, isAdmin }; 
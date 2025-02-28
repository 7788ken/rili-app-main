const { User } = require('../models/index');
const bcrypt = require('bcrypt');
const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const { Op } = require('sequelize');

/**
 * @desc    注册新用户
 * @route   POST /api/users/register
 * @access  Public
 */
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  // 检查用户是否已存在
  const userExists = await User.findOne({ where: { email } });

  if (userExists) {
    res.status(400);
    throw new Error('用户已存在');
  }

  // 创建新用户
  const user = await User.create({
    name,
    email,
    password
  });

  if (user) {
    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: user.generateAuthToken()
      }
    });
  } else {
    res.status(400);
    throw new Error('无效的用户数据');
  }
});

/**
 * @desc    用户登录，获取JWT令牌
 * @route   POST /api/users/login
 * @access  Public
 */
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // 查找用户
  const user = await User.findOne({ where: { email } });

  // 验证用户与密码
  if (user && (await user.matchPassword(password))) {
    // 更新最近登录时间
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: user.generateAuthToken()
      }
    });
  } else {
    res.status(401);
    throw new Error('无效的邮箱或密码');
  }
});

/**
 * @desc    获取用户个人资料
 * @route   GET /api/users/profile
 * @access  Private
 */
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: { exclude: ['password'] }
  });

  if (user) {
    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  } else {
    res.status(404);
    throw new Error('用户未找到');
  }
});

/**
 * @desc    更新用户个人资料
 * @route   PUT /api/users/profile
 * @access  Private
 */
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id);

  if (!user) {
    res.status(404);
    throw new Error('用户未找到');
  }

  // 更新用户信息
  user.name = req.body.name || user.name;
  user.email = req.body.email || user.email;
  user.avatar = req.body.avatar || user.avatar;
  
  // 如果提供了密码，则更新密码
  if (req.body.password) {
    user.password = req.body.password;
  }

  // 保存更新后的用户信息
  const updatedUser = await user.save();

  res.json({
    success: true,
    data: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      role: updatedUser.role,
      token: updatedUser.generateAuthToken()
    }
  });
});

/**
 * @desc    请求重置密码
 * @route   POST /api/users/reset-password-request
 * @access  Public
 */
const resetPasswordRequest = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // 查找用户
  const user = await User.findOne({ where: { email } });

  if (!user) {
    // 为了安全起见，即使用户不存在也返回相同的消息
    res.json({
      success: true,
      message: '如果该邮箱存在，一封包含密码重置指南的邮件已发送'
    });
    return;
  }

  // 生成密码重置令牌
  const resetToken = user.getResetPasswordToken();
  await user.save();

  // 构建密码重置URL
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

  // 这里应发送包含重置链接的电子邮件
  // 在实际项目中，应该调用邮件发送服务

  console.log(`密码重置链接: ${resetUrl}`);

  res.json({
    success: true,
    message: '如果该邮箱存在，一封包含密码重置指南的邮件已发送',
    resetUrl: process.env.NODE_ENV === 'development' ? resetUrl : undefined
  });
});

/**
 * @desc    重置密码
 * @route   POST /api/users/reset-password
 * @access  Public
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  // 获取加密的令牌
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // 查找具有有效令牌的用户
  const user = await User.findOne({
    where: {
      resetPasswordToken,
      resetPasswordExpire: {
        [Op.gt]: Date.now()
      }
    }
  });

  if (!user) {
    res.status(400);
    throw new Error('无效或过期的令牌');
  }

  // 设置新密码
  user.password = password;
  user.resetPasswordToken = null;
  user.resetPasswordExpire = null;
  await user.save();

  res.json({
    success: true,
    message: '密码已成功重置，现在可以使用新密码登录'
  });
});

/**
 * @desc    验证用户是否是管理员
 * @route   GET /api/users/admin-check
 * @access  Private
 */
const checkAdmin = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id);

  if (user && user.role === 'admin') {
    res.json({
      success: true,
      isAdmin: true
    });
  } else {
    res.status(403);
    throw new Error('需要管理员权限');
  }
});

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  resetPasswordRequest,
  resetPassword,
  checkAdmin
}; 
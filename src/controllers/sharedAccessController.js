/**
 * 共享访问控制器
 * 用于管理日历的共享访问权限
 */
const asyncHandler = require('express-async-handler');
const { Calendar, User, SharedAccess } = require('../models');
const { Op } = require('sequelize');

/**
 * @desc    共享日历给用户
 * @route   POST /api/calendars/:calendarId/share
 * @access  Private
 */
const shareCalendar = asyncHandler(async (req, res) => {
  const { calendarId } = req.params;
  const { email, permission } = req.body;

  // 验证权限类型
  if (!['read', 'write', 'admin'].includes(permission)) {
    res.status(400);
    throw new Error('无效的权限类型，必须是 read、write 或 admin');
  }

  // 查找日历
  const calendar = await Calendar.findByPk(calendarId);
  if (!calendar) {
    res.status(404);
    throw new Error('日历不存在');
  }

  // 验证当前用户是否为日历所有者或管理员
  if (calendar.ownerId !== req.user.id && !req.user.isAdmin) {
    res.status(403);
    throw new Error('没有权限共享此日历');
  }

  // 查找要共享给的用户
  const targetUser = await User.findOne({ where: { email } });
  if (!targetUser) {
    res.status(404);
    throw new Error('用户不存在');
  }

  // 不能共享给自己
  if (targetUser.id === req.user.id) {
    res.status(400);
    throw new Error('不能共享日历给自己');
  }

  // 检查是否已经共享给该用户
  const existingShare = await SharedAccess.findOne({
    where: {
      calendarId,
      userId: targetUser.id
    }
  });

  if (existingShare) {
    // 更新现有权限
    existingShare.permission = permission;
    await existingShare.save();
    
    res.status(200).json({
      success: true,
      message: '共享权限已更新',
      data: {
        id: existingShare.id,
        calendarId: existingShare.calendarId,
        userId: existingShare.userId,
        permission: existingShare.permission
      }
    });
  } else {
    // 创建新的共享访问
    const sharedAccess = await SharedAccess.create({
      calendarId,
      userId: targetUser.id,
      permission
    });

    res.status(201).json({
      success: true,
      message: '日历已成功共享',
      data: {
        id: sharedAccess.id,
        calendarId: sharedAccess.calendarId,
        userId: sharedAccess.userId,
        permission: sharedAccess.permission
      }
    });
  }
});

/**
 * @desc    获取日历的共享用户列表
 * @route   GET /api/calendars/:calendarId/share
 * @access  Private
 */
const getSharedUsers = asyncHandler(async (req, res) => {
  const { calendarId } = req.params;

  // 查找日历
  const calendar = await Calendar.findByPk(calendarId);
  if (!calendar) {
    res.status(404);
    throw new Error('日历不存在');
  }

  // 验证当前用户是否有权限查看共享列表
  const isOwner = calendar.ownerId === req.user.id;
  const hasAccess = await SharedAccess.findOne({
    where: {
      calendarId,
      userId: req.user.id,
      permission: {
        [Op.in]: ['write', 'admin']
      }
    }
  });

  if (!isOwner && !hasAccess && !req.user.isAdmin) {
    res.status(403);
    throw new Error('没有权限查看此日历的共享用户');
  }

  // 获取共享用户列表
  const sharedUsers = await SharedAccess.findAll({
    where: { calendarId },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'avatar']
      }
    ]
  });

  res.status(200).json({
    success: true,
    count: sharedUsers.length,
    data: sharedUsers.map(share => ({
      id: share.id,
      permission: share.permission,
      user: share.user
    }))
  });
});

/**
 * @desc    更新共享权限
 * @route   PUT /api/calendars/:calendarId/share/:userId
 * @access  Private
 */
const updateSharePermission = asyncHandler(async (req, res) => {
  const { calendarId, userId } = req.params;
  const { permission } = req.body;

  // 验证权限类型
  if (!['read', 'write', 'admin'].includes(permission)) {
    res.status(400);
    throw new Error('无效的权限类型，必须是 read、write 或 admin');
  }

  // 查找日历
  const calendar = await Calendar.findByPk(calendarId);
  if (!calendar) {
    res.status(404);
    throw new Error('日历不存在');
  }

  // 验证当前用户是否为日历所有者或管理员
  if (calendar.ownerId !== req.user.id && !req.user.isAdmin) {
    res.status(403);
    throw new Error('没有权限修改共享权限');
  }

  // 查找共享记录
  const sharedAccess = await SharedAccess.findOne({
    where: {
      calendarId,
      userId
    }
  });

  if (!sharedAccess) {
    res.status(404);
    throw new Error('共享记录不存在');
  }

  // 更新权限
  sharedAccess.permission = permission;
  await sharedAccess.save();

  res.status(200).json({
    success: true,
    message: '共享权限已更新',
    data: {
      id: sharedAccess.id,
      calendarId: sharedAccess.calendarId,
      userId: sharedAccess.userId,
      permission: sharedAccess.permission
    }
  });
});

/**
 * @desc    取消共享
 * @route   DELETE /api/calendars/:calendarId/share/:userId
 * @access  Private
 */
const removeSharedAccess = asyncHandler(async (req, res) => {
  const { calendarId, userId } = req.params;

  // 查找日历
  const calendar = await Calendar.findByPk(calendarId);
  if (!calendar) {
    res.status(404);
    throw new Error('日历不存在');
  }

  // 验证当前用户是否为日历所有者或管理员
  if (calendar.ownerId !== req.user.id && !req.user.isAdmin) {
    res.status(403);
    throw new Error('没有权限取消共享');
  }

  // 查找共享记录
  const sharedAccess = await SharedAccess.findOne({
    where: {
      calendarId,
      userId
    }
  });

  if (!sharedAccess) {
    res.status(404);
    throw new Error('共享记录不存在');
  }

  // 删除共享记录
  await sharedAccess.destroy();

  res.status(200).json({
    success: true,
    message: '已取消共享',
    data: {}
  });
});

/**
 * @desc    通过分享码访问日历
 * @route   POST /api/calendars/access/:shareCode
 * @access  Private
 */
const accessByShareCode = asyncHandler(async (req, res) => {
  const { shareCode } = req.params;

  // 查找具有该分享码的日历
  const calendar = await Calendar.findOne({
    where: {
      shareCode,
      shareExpire: {
        [Op.gt]: new Date()
      }
    }
  });

  if (!calendar) {
    res.status(404);
    throw new Error('无效或已过期的分享码');
  }

  // 检查用户是否已有访问权限
  const existingAccess = await SharedAccess.findOne({
    where: {
      calendarId: calendar.id,
      userId: req.user.id
    }
  });

  if (existingAccess) {
    res.status(400);
    throw new Error('您已经有此日历的访问权限');
  }

  // 创建只读访问权限
  const sharedAccess = await SharedAccess.create({
    calendarId: calendar.id,
    userId: req.user.id,
    permission: 'read'
  });

  res.status(201).json({
    success: true,
    message: '成功获取日历访问权限',
    data: {
      calendar: {
        id: calendar.id,
        title: calendar.title,
        description: calendar.description,
        color: calendar.color
      },
      access: {
        id: sharedAccess.id,
        permission: sharedAccess.permission
      }
    }
  });
});

/**
 * @desc    生成日历分享码
 * @route   POST /api/calendars/:calendarId/shareCode
 * @access  Private
 */
const generateShareCode = asyncHandler(async (req, res) => {
  const { calendarId } = req.params;
  const { expiresIn } = req.body; // 过期时间（小时）

  // 查找日历
  const calendar = await Calendar.findByPk(calendarId);
  if (!calendar) {
    res.status(404);
    throw new Error('日历不存在');
  }

  // 验证当前用户是否为日历所有者或管理员
  if (calendar.ownerId !== req.user.id && !req.user.isAdmin) {
    res.status(403);
    throw new Error('没有权限生成分享码');
  }

  // 生成随机分享码
  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // 设置分享码和过期时间
  const shareCode = generateCode();
  const shareExpire = new Date();
  shareExpire.setHours(shareExpire.getHours() + (expiresIn || 24)); // 默认24小时

  // 更新日历
  calendar.shareCode = shareCode;
  calendar.shareExpire = shareExpire;
  await calendar.save();

  res.status(200).json({
    success: true,
    message: '分享码生成成功',
    data: {
      shareCode: calendar.shareCode,
      shareExpire: calendar.shareExpire
    }
  });
});

module.exports = {
  shareCalendar,
  getSharedUsers,
  updateSharePermission,
  removeSharedAccess,
  accessByShareCode,
  generateShareCode
}; 
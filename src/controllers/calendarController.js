const asyncHandler = require('express-async-handler');
const { Calendar, Schedule, Device } = require('../models/index');
const { Op } = require('sequelize');
const crypto = require('crypto');

/**
 * @desc    创建新日历
 * @route   POST /api/calendars
 * @access  私有
 */
const createCalendar = asyncHandler(async (req, res) => {
  const { title, description, color } = req.body;

  // 创建日历
  const calendar = await Calendar.create({
    title,
    description: description || '',
    color: color || '#3788d8',
    ownerId: req.user.id
  });

  // 生成分享码
  calendar.generateShareCode();
  await calendar.save();

  // 为创建者创建访问权限（管理员权限）
  await SharedAccess.create({
    userId: req.user.id,
    calendarId: calendar.id,
    permission: 'admin'
  });

  res.status(201).json({
    success: true,
    data: calendar
  });
});

/**
 * @desc    获取用户的所有日历
 * @route   GET /api/calendars
 * @access  私有
 */
const getUserCalendars = asyncHandler(async (req, res) => {
  // 查找用户拥有的日历
  const ownedCalendars = await Calendar.findAll({
    where: { ownerId: req.user.id },
    include: [
      {
        model: User,
        as: 'owner',
        attributes: ['id', 'name', 'email', 'avatar']
      }
    ]
  });

  // 查找用户有共享权限的日历
  const sharedCalendars = await Calendar.findAll({
    include: [
      {
        model: User,
        as: 'members',
        where: { id: req.user.id },
        attributes: ['id', 'name', 'email', 'avatar'],
        through: {
          attributes: ['permission']
        }
      },
      {
        model: User,
        as: 'owner',
        attributes: ['id', 'name', 'email', 'avatar']
      }
    ]
  });

  // 合并结果
  const calendars = [
    ...ownedCalendars.map(cal => ({
      ...cal.toJSON(),
      isOwner: true,
      permission: 'admin'
    })),
    ...sharedCalendars.map(cal => {
      const calJSON = cal.toJSON();
      return {
        ...calJSON,
        isOwner: false,
        permission: calJSON.members[0].SharedAccess.permission
      };
    })
  ];

  res.json({
    success: true,
    count: calendars.length,
    data: calendars
  });
});

/**
 * @desc    获取单个日历详情
 * @route   GET /api/calendars/:id
 * @access  私有
 */
const getCalendarById = asyncHandler(async (req, res) => {
  const calendar = await Calendar.findByPk(req.params.id, {
    include: [
      {
        model: User,
        as: 'owner',
        attributes: ['id', 'name', 'email', 'avatar']
      }
    ]
  });

  if (!calendar) {
    res.status(404);
    throw new Error('日历未找到');
  }

  // 检查用户是否有权限访问此日历
  if (calendar.ownerId !== req.user.id) {
    // 如果不是所有者，检查是否有共享权限
    const access = await SharedAccess.findOne({
      where: { 
        userId: req.user.id, 
        calendarId: calendar.id
      }
    });

    if (!access) {
      res.status(403);
      throw new Error('无权访问此日历');
    }

    // 添加权限信息
    calendar.dataValues.permission = access.permission;
    calendar.dataValues.isOwner = false;
  } else {
    // 是所有者
    calendar.dataValues.permission = 'admin';
    calendar.dataValues.isOwner = true;
  }

  res.json({
    success: true,
    data: calendar
  });
});

/**
 * @desc    更新日历信息
 * @route   PUT /api/calendars/:id
 * @access  私有
 */
const updateCalendar = asyncHandler(async (req, res) => {
  const calendar = await Calendar.findByPk(req.params.id);

  if (!calendar) {
    res.status(404);
    throw new Error('日历未找到');
  }

  // 检查用户是否有编辑权限
  let hasEditPermission = false;
  
  if (calendar.ownerId === req.user.id) {
    // 所有者有完全权限
    hasEditPermission = true;
  } else {
    // 检查共享权限
    const access = await SharedAccess.findOne({
      where: { 
        userId: req.user.id, 
        calendarId: calendar.id
      }
    });
    
    if (access && (access.permission === 'write' || access.permission === 'admin')) {
      hasEditPermission = true;
    }
  }

  if (!hasEditPermission) {
    res.status(403);
    throw new Error('无权编辑此日历');
  }

  // 更新日历信息
  calendar.title = req.body.title || calendar.title;
  calendar.description = req.body.description !== undefined ? req.body.description : calendar.description;
  calendar.color = req.body.color || calendar.color;
  
  if (req.body.isPublic !== undefined && calendar.ownerId === req.user.id) {
    calendar.isPublic = req.body.isPublic;
  }

  const updatedCalendar = await calendar.save();

  res.json({
    success: true,
    data: updatedCalendar
  });
});

/**
 * @desc    删除日历
 * @route   DELETE /api/calendars/:id
 * @access  私有
 */
const deleteCalendar = asyncHandler(async (req, res) => {
  const calendar = await Calendar.findByPk(req.params.id);

  if (!calendar) {
    res.status(404);
    throw new Error('日历未找到');
  }

  // 检查用户是否是日历所有者
  if (calendar.ownerId !== req.user.id) {
    res.status(403);
    throw new Error('必须是日历所有者才能删除');
  }

  // 删除关联的日程安排
  await Schedule.destroy({
    where: { calendarId: calendar.id }
  });

  // 删除共享访问权限
  await SharedAccess.destroy({
    where: { calendarId: calendar.id }
  });

  // 删除日历
  await calendar.destroy();

  res.json({
    success: true,
    message: '日历已成功删除'
  });
});

/**
 * @desc    创建/分享日历
 * @route   POST /api/calendars/share
 * @access  公开
 */
const shareCalendar = asyncHandler(async (req, res) => {
  const { name, color, schedules } = req.body;
  
  if (!name) {
    res.status(400);
    throw new Error('日历名称不能为空');
  }

  // 生成随机的deviceId (如果前端没有提供)
  const deviceId = req.body.deviceId || crypto.randomBytes(8).toString('hex');
  
  // 创建或更新设备信息
  let device = await Device.findOne({ where: { deviceId } });
  if (!device) {
    device = await Device.create({
      deviceId,
      deviceName: req.body.deviceName || '未知设备',
      platform: req.body.platform || '未知平台',
      lastActive: new Date()
    });
  } else {
    device.lastActive = new Date();
    await device.save();
  }

  // 创建日历
  const calendar = await Calendar.create({
    title: name,
    description: req.body.description || '',
    color: color || '#3788d8',
    deviceId: deviceId,
    isPublic: true
  });

  // 生成分享码
  const shareCode = calendar.generateShareCode();
  await calendar.save();

  // 添加日程
  if (schedules && Array.isArray(schedules)) {
    for (const schedule of schedules) {
      await Schedule.create({
        localId: schedule.id || crypto.randomBytes(8).toString('hex'),
        title: schedule.title,
        description: schedule.description || '',
        location: schedule.location || '',
        startTime: new Date(schedule.startTime),
        endTime: new Date(schedule.endTime),
        isAllDay: schedule.isAllDay ? true : false,
        color: schedule.color || calendar.color,
        calendarId: calendar.id,
        deviceId: deviceId
      });
    }
  }

  res.status(201).json({
    success: true,
    shareCode: calendar.shareCode
  });
});

/**
 * @desc    获取共享日历信息
 * @route   GET /api/calendars/:shareCode
 * @access  公开
 */
const getCalendarByShareCode = asyncHandler(async (req, res) => {
  const { shareCode } = req.params;

  const calendar = await Calendar.findOne({
    where: { shareCode },
    include: [{
      model: Device,
      as: 'device',
      attributes: ['deviceId', 'deviceName', 'platform']
    }]
  });

  if (!calendar) {
    res.status(404);
    throw new Error('日历未找到，请检查分享码是否正确');
  }

  // 检查分享码是否过期
  if (!calendar.isShareCodeValid()) {
    res.status(410);
    throw new Error('分享码已过期');
  }

  res.json({
    name: calendar.title,
    color: calendar.color,
    ownerId: calendar.deviceId,
    createdAt: calendar.createdAt
  });
});

/**
 * @desc    更新共享日历信息
 * @route   PUT /api/calendars/:shareCode
 * @access  公开
 */
const updateCalendarByShareCode = asyncHandler(async (req, res) => {
  const { shareCode } = req.params;
  const { name, color } = req.body;

  const calendar = await Calendar.findOne({ where: { shareCode } });

  if (!calendar) {
    res.status(404);
    throw new Error('日历未找到，请检查分享码是否正确');
  }

  // 检查分享码是否过期
  if (!calendar.isShareCodeValid()) {
    res.status(410);
    throw new Error('分享码已过期');
  }

  // 更新日历信息
  if (name) calendar.title = name;
  if (color) calendar.color = color;
  
  await calendar.save();

  res.json({ success: true });
});

/**
 * @desc    获取日历下所有日程
 * @route   GET /api/calendars/:shareCode/schedules
 * @access  公开
 */
const getSchedulesByShareCode = asyncHandler(async (req, res) => {
  const { shareCode } = req.params;

  const calendar = await Calendar.findOne({ where: { shareCode } });

  if (!calendar) {
    res.status(404);
    throw new Error('日历未找到，请检查分享码是否正确');
  }

  // 检查分享码是否过期
  if (!calendar.isShareCodeValid()) {
    res.status(410);
    throw new Error('分享码已过期');
  }

  // 获取该日历下的所有日程
  const schedules = await Schedule.findAll({
    where: { 
      calendarId: calendar.id,
      isDeleted: false
    }
  });

  res.json({
    schedules: schedules.map(schedule => ({
      id: schedule.localId,
      title: schedule.title,
      description: schedule.description,
      startTime: schedule.startTime.getTime(),
      endTime: schedule.endTime.getTime(),
      isAllDay: schedule.isAllDay ? 1 : 0,
      location: schedule.location || ''
    }))
  });
});

/**
 * @desc    添加日程
 * @route   POST /api/calendars/:shareCode/schedules
 * @access  公开
 */
const addScheduleByShareCode = asyncHandler(async (req, res) => {
  const { shareCode } = req.params;
  const scheduleData = req.body;

  const calendar = await Calendar.findOne({ where: { shareCode } });

  if (!calendar) {
    res.status(404);
    throw new Error('日历未找到，请检查分享码是否正确');
  }

  // 检查分享码是否过期
  if (!calendar.isShareCodeValid()) {
    res.status(410);
    throw new Error('分享码已过期');
  }

  // 创建日程
  const schedule = await Schedule.create({
    localId: scheduleData.id || crypto.randomBytes(8).toString('hex'),
    title: scheduleData.title,
    description: scheduleData.description || '',
    location: scheduleData.location || '',
    startTime: new Date(scheduleData.startTime),
    endTime: new Date(scheduleData.endTime),
    isAllDay: scheduleData.isAllDay ? true : false,
    color: scheduleData.color || calendar.color,
    calendarId: calendar.id,
    deviceId: calendar.deviceId
  });

  res.status(201).json({
    id: schedule.localId,
    title: schedule.title,
    description: schedule.description,
    startTime: schedule.startTime.getTime(),
    endTime: schedule.endTime.getTime(),
    isAllDay: schedule.isAllDay ? 1 : 0,
    location: schedule.location || ''
  });
});

/**
 * @desc    更新日程
 * @route   PUT /api/calendars/:shareCode/schedules/:scheduleId
 * @access  公开
 */
const updateScheduleByShareCode = asyncHandler(async (req, res) => {
  const { shareCode, scheduleId } = req.params;
  const scheduleData = req.body;

  const calendar = await Calendar.findOne({ where: { shareCode } });

  if (!calendar) {
    res.status(404);
    throw new Error('日历未找到，请检查分享码是否正确');
  }

  // 检查分享码是否过期
  if (!calendar.isShareCodeValid()) {
    res.status(410);
    throw new Error('分享码已过期');
  }

  // 查找日程
  const schedule = await Schedule.findOne({
    where: { 
      calendarId: calendar.id,
      localId: scheduleId
    }
  });

  if (!schedule) {
    res.status(404);
    throw new Error('日程未找到');
  }

  // 更新日程
  if (scheduleData.title) schedule.title = scheduleData.title;
  if (scheduleData.description !== undefined) schedule.description = scheduleData.description;
  if (scheduleData.location !== undefined) schedule.location = scheduleData.location;
  if (scheduleData.startTime) schedule.startTime = new Date(scheduleData.startTime);
  if (scheduleData.endTime) schedule.endTime = new Date(scheduleData.endTime);
  if (scheduleData.isAllDay !== undefined) schedule.isAllDay = scheduleData.isAllDay ? true : false;
  if (scheduleData.color) schedule.color = scheduleData.color;

  await schedule.save();

  res.json({ success: true });
});

/**
 * @desc    删除日程
 * @route   DELETE /api/calendars/:shareCode/schedules/:scheduleId
 * @access  公开
 */
const deleteScheduleByShareCode = asyncHandler(async (req, res) => {
  const { shareCode, scheduleId } = req.params;

  const calendar = await Calendar.findOne({ where: { shareCode } });

  if (!calendar) {
    res.status(404);
    throw new Error('日历未找到，请检查分享码是否正确');
  }

  // 检查分享码是否过期
  if (!calendar.isShareCodeValid()) {
    res.status(410);
    throw new Error('分享码已过期');
  }

  // 查找日程
  const schedule = await Schedule.findOne({
    where: { 
      calendarId: calendar.id,
      localId: scheduleId
    }
  });

  if (!schedule) {
    res.status(404);
    throw new Error('日程未找到');
  }

  // 标记为已删除（软删除）
  schedule.isDeleted = true;
  await schedule.save();

  res.json({ success: true });
});

/**
 * @desc    批量同步日程
 * @route   POST /api/calendars/:shareCode/sync
 * @access  公开
 */
const syncSchedulesByShareCode = asyncHandler(async (req, res) => {
  const { shareCode } = req.params;
  const { changes } = req.body;

  if (!changes || !Array.isArray(changes)) {
    res.status(400);
    throw new Error('请提供有效的日程变更数据');
  }

  const calendar = await Calendar.findOne({ where: { shareCode } });

  if (!calendar) {
    res.status(404);
    throw new Error('日历未找到，请检查分享码是否正确');
  }

  // 检查分享码是否过期
  if (!calendar.isShareCodeValid()) {
    res.status(410);
    throw new Error('分享码已过期');
  }

  let updatedCount = 0;

  // 处理每个日程变更
  for (const change of changes) {
    // 查找现有日程
    let schedule = await Schedule.findOne({
      where: { 
        calendarId: calendar.id,
        localId: change.id
      }
    });

    if (schedule) {
      // 更新现有日程
      schedule.title = change.title;
      schedule.description = change.description || '';
      schedule.location = change.location || '';
      schedule.startTime = new Date(change.startTime);
      schedule.endTime = new Date(change.endTime);
      schedule.isAllDay = change.isAllDay ? true : false;
      schedule.isCompleted = change.isCompleted ? true : false;
      if (change.color) schedule.color = change.color;
      
      await schedule.save();
    } else {
      // 创建新日程
      schedule = await Schedule.create({
        localId: change.id,
        title: change.title,
        description: change.description || '',
        location: change.location || '',
        startTime: new Date(change.startTime),
        endTime: new Date(change.endTime),
        isAllDay: change.isAllDay ? true : false,
        color: change.color || calendar.color,
        calendarId: calendar.id,
        deviceId: calendar.deviceId
      });
    }

    updatedCount++;
  }

  res.json({ 
    success: true, 
    updatedCount 
  });
});

module.exports = {
  createCalendar,
  getUserCalendars,
  getCalendarById,
  updateCalendar,
  deleteCalendar,
  shareCalendar,
  getCalendarByShareCode,
  updateCalendarByShareCode,
  getSchedulesByShareCode,
  addScheduleByShareCode,
  updateScheduleByShareCode,
  deleteScheduleByShareCode,
  syncSchedulesByShareCode
}; 
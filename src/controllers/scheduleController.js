const asyncHandler = require('express-async-handler');
const { Schedule, Calendar, SharedAccess, User } = require('../models/index');
const { Op } = require('sequelize');

/**
 * @desc    创建新日程安排
 * @route   POST /api/calendars/:calendarId/schedules
 * @access  Private
 */
const createSchedule = asyncHandler(async (req, res) => {
  const { calendarId } = req.params;
  const { title, description, location, startTime, endTime, isAllDay, color, reminder } = req.body;

  // 检查日历是否存在
  const calendar = await Calendar.findByPk(calendarId);
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
    throw new Error('无权在此日历中创建日程');
  }

  // 检查日期有效性
  if (new Date(startTime) > new Date(endTime)) {
    res.status(400);
    throw new Error('开始时间必须早于结束时间');
  }

  // 创建日程安排
  const schedule = await Schedule.create({
    calendarId,
    title,
    description: description || '',
    location: location || '',
    startTime,
    endTime,
    isAllDay: isAllDay || false,
    color: color || calendar.color,
    reminder: reminder || null,
    creatorId: req.user.id
  });

  res.status(201).json({
    success: true,
    data: schedule
  });
});

/**
 * @desc    获取日历的所有日程安排
 * @route   GET /api/calendars/:calendarId/schedules
 * @access  Private
 */
const getSchedules = asyncHandler(async (req, res) => {
  const { calendarId } = req.params;
  const { start, end } = req.query;

  // 检查日历是否存在
  const calendar = await Calendar.findByPk(calendarId);
  if (!calendar) {
    res.status(404);
    throw new Error('日历未找到');
  }

  // 检查用户是否有访问权限
  let hasAccess = false;
  
  if (calendar.ownerId === req.user.id) {
    hasAccess = true;
  } else {
    const access = await SharedAccess.findOne({
      where: { 
        userId: req.user.id, 
        calendarId: calendar.id
      }
    });
    
    if (access) {
      hasAccess = true;
    }
  }

  if (!hasAccess) {
    res.status(403);
    throw new Error('无权访问此日历的日程');
  }

  // 查询条件
  let where = { calendarId };

  // 如果提供了日期范围，则筛选在范围内的日程
  if (start && end) {
    where = {
      ...where,
      [Op.or]: [
        {
          startTime: {
            [Op.between]: [new Date(start), new Date(end)]
          }
        },
        {
          endTime: {
            [Op.between]: [new Date(start), new Date(end)]
          }
        },
        {
          [Op.and]: [
            { startTime: { [Op.lte]: new Date(start) } },
            { endTime: { [Op.gte]: new Date(end) } }
          ]
        }
      ]
    };
  }

  // 获取日程安排
  const schedules = await Schedule.findAll({
    where,
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'name', 'email', 'avatar']
      }
    ],
    order: [['startTime', 'ASC']]
  });

  res.json({
    success: true,
    count: schedules.length,
    data: schedules
  });
});

/**
 * @desc    获取单个日程安排详情
 * @route   GET /api/calendars/:calendarId/schedules/:id
 * @access  Private
 */
const getScheduleById = asyncHandler(async (req, res) => {
  const { calendarId, id } = req.params;

  // 查找日程安排
  const schedule = await Schedule.findOne({
    where: {
      id,
      calendarId
    },
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'name', 'email', 'avatar']
      },
      {
        model: Calendar,
        as: 'calendar',
        attributes: ['id', 'title', 'color']
      }
    ]
  });

  if (!schedule) {
    res.status(404);
    throw new Error('日程安排未找到');
  }

  // 检查用户是否有访问权限
  const calendar = await Calendar.findByPk(calendarId);
  let hasAccess = false;
  
  if (calendar.ownerId === req.user.id) {
    hasAccess = true;
  } else {
    const access = await SharedAccess.findOne({
      where: { 
        userId: req.user.id, 
        calendarId: calendar.id
      }
    });
    
    if (access) {
      hasAccess = true;
    }
  }

  if (!hasAccess) {
    res.status(403);
    throw new Error('无权访问此日程安排');
  }

  res.json({
    success: true,
    data: schedule
  });
});

/**
 * @desc    更新日程安排
 * @route   PUT /api/calendars/:calendarId/schedules/:id
 * @access  Private
 */
const updateSchedule = asyncHandler(async (req, res) => {
  const { calendarId, id } = req.params;
  const updates = req.body;

  // 查找日程安排
  const schedule = await Schedule.findOne({
    where: {
      id,
      calendarId
    }
  });

  if (!schedule) {
    res.status(404);
    throw new Error('日程安排未找到');
  }

  // 检查用户是否有编辑权限
  const calendar = await Calendar.findByPk(calendarId);
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
    throw new Error('无权编辑此日程安排');
  }

  // 检查日期有效性
  if (updates.startTime && updates.endTime && new Date(updates.startTime) > new Date(updates.endTime)) {
    res.status(400);
    throw new Error('开始时间必须早于结束时间');
  }

  // 更新日程安排
  await schedule.update(updates);

  // 获取更新后的日程详情
  const updatedSchedule = await Schedule.findByPk(id, {
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'name', 'email', 'avatar']
      }
    ]
  });

  res.json({
    success: true,
    data: updatedSchedule
  });
});

/**
 * @desc    删除日程安排
 * @route   DELETE /api/calendars/:calendarId/schedules/:id
 * @access  Private
 */
const deleteSchedule = asyncHandler(async (req, res) => {
  const { calendarId, id } = req.params;

  // 查找日程安排
  const schedule = await Schedule.findOne({
    where: {
      id,
      calendarId
    }
  });

  if (!schedule) {
    res.status(404);
    throw new Error('日程安排未找到');
  }

  // 检查用户是否有编辑权限
  const calendar = await Calendar.findByPk(calendarId);
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
    throw new Error('无权删除此日程安排');
  }

  // 删除日程安排
  await schedule.destroy();

  res.json({
    success: true,
    message: '日程安排已成功删除'
  });
});

/**
 * @desc    批量创建或更新日程安排
 * @route   POST /api/calendars/:calendarId/schedules/batch
 * @access  Private
 */
const batchSchedules = asyncHandler(async (req, res) => {
  const { calendarId } = req.params;
  const { items, action } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error('请提供有效的日程安排数据');
  }

  if (!['create', 'update', 'delete'].includes(action)) {
    res.status(400);
    throw new Error('请提供有效的操作类型：create, update 或 delete');
  }

  // 检查日历是否存在
  const calendar = await Calendar.findByPk(calendarId);
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
    throw new Error('无权在此日历中批量操作日程');
  }

  let result;

  // 根据操作类型执行不同的批量操作
  switch (action) {
    case 'create':
      // 批量创建
      const createItems = items.map(item => ({
        ...item,
        calendarId,
        creatorId: req.user.id
      }));
      
      result = await Schedule.bulkCreate(createItems);
      break;
      
    case 'update':
      // 批量更新
      result = [];
      for (const item of items) {
        if (!item.id) {
          continue;
        }
        
        const schedule = await Schedule.findOne({
          where: {
            id: item.id,
            calendarId
          }
        });
        
        if (schedule) {
          await schedule.update(item);
          result.push(schedule);
        }
      }
      break;
      
    case 'delete':
      // 批量删除
      const ids = items.map(item => item.id).filter(id => id);
      
      if (ids.length > 0) {
        await Schedule.destroy({
          where: {
            id: {
              [Op.in]: ids
            },
            calendarId
          }
        });
      }
      
      result = { deletedCount: ids.length };
      break;
  }

  res.json({
    success: true,
    action,
    count: action === 'delete' ? result.deletedCount : result.length,
    data: result
  });
});

module.exports = {
  createSchedule,
  getSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
  batchSchedules
}; 